const crypto = require('crypto');

// Trips that earn points are started and finished in the app. Starting hands
// back a signed token (so the server needn't store anything between the two
// calls) and finishing is checked against it. These are plausibility checks,
// not proof: a phone's location can be faked, and an average speed can't tell
// a bike from a car in city traffic.

const MODES = {
  // Average speed over the whole trip, in km/h. Wide on purpose: stops, red
  // lights, waiting for a train and e-bikes all happen.
  bike:    { minKmh: 3, maxKmh: 40, maxKm: 80 },
  transit: { minKmh: 2, maxKmh: 100, maxKm: 200 },
};
const DRIVE_CO2_PER_KM = 0.21; // kg of CO2 per km driven
const MAX_ROUTE_FACTOR = 3;    // no road or rail route is longer than this x the straight line...
const MAX_ROUTE_EXTRA_KM = 1;  // ...plus a kilometre of slack

const START_RADIUS_M = 1000;  // you must be near where the trip starts
const ARRIVE_RADIUS_M = 150;  // ...and near where it ends
const MAX_ACCURACY_M = 500;   // a worse GPS fix is ignored when widening the radius
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const MIN_TRIP_MS = 30 * 1000;

class TripError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function secret() {
  const key = process.env.TRIP_TOKEN_SECRET || process.env.SUPABASE_SERVICE_KEY;
  if (!key) throw new Error('No signing secret configured');
  return key;
}

const sign = body => crypto.createHmac('sha256', secret()).update(body).digest('base64url');

function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

function readToken(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) throw new TripError('Invalid trip token');
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    throw new TripError('Invalid trip token');
  }
  return JSON.parse(Buffer.from(body, 'base64url').toString());
}

// 10 points per kg of CO2 saved. Done in whole grams so the browser and the
// server can never disagree over floating-point rounding.
function pointsFor(savedKg) {
  return Math.floor(Math.round(savedKg * 1000) / 100);
}

function haversineM(a, b) {
  const R = 6371000, toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const isCoord = c => c && Number.isFinite(c.lat) && Number.isFinite(c.lng) &&
  Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180;
const slack = accuracy => Math.min(Math.max(Number(accuracy) || 0, 0), MAX_ACCURACY_M);

// Check a start request and return the token payload to sign.
function planTrip(body, userId, now = Date.now()) {
  const {
    route_type, origin, destination, origin_coord, dest_coord, distance_km, position,
    co2_saved_kg, co2_emitted_kg,
  } = body;
  const mode = MODES[route_type];
  if (!mode) throw new TripError('Only bike and transit trips are started this way');
  if (!origin || !destination) throw new TripError('Missing origin or destination');
  if (!isCoord(origin_coord) || !isCoord(dest_coord) || !isCoord(position)) {
    throw new TripError('Missing or invalid coordinates');
  }
  const km = Number(distance_km);
  if (!(km > 0) || km > mode.maxKm) throw new TripError('Trip distance is out of range');

  // A route can't be shorter than the straight line between its ends, and a
  // wildly longer one is just a way to claim more distance.
  const straightKm = haversineM(origin_coord, dest_coord) / 1000;
  const longestRouteKm = straightKm * MAX_ROUTE_FACTOR + MAX_ROUTE_EXTRA_KM;
  if (km < straightKm * 0.9 || km > longestRouteKm) {
    throw new TripError('Trip distance does not match its start and end');
  }

  // The CO2 figures are the ones the route card showed (saving against driving
  // the same trip). The server can't redo that sum, because the car route and
  // the transit mix are worked out in the browser, so it caps them instead:
  // nothing can save more than driving the longest plausible road route would
  // have emitted. The cap comes from the straight-line distance and not from
  // this trip's own length, because a bike route is often shorter than the car
  // route it is compared with.
  const ceilingKg = longestRouteKm * DRIVE_CO2_PER_KM;
  if (!Number.isFinite(co2_saved_kg) || !Number.isFinite(co2_emitted_kg)) {
    throw new TripError('Missing CO2 figures for this trip');
  }
  if (co2_saved_kg < 0 || co2_saved_kg > ceilingKg || co2_emitted_kg < 0 || co2_emitted_kg > ceilingKg) {
    throw new TripError('CO2 figures are out of range for this trip');
  }

  const fromStart = haversineM(position, origin_coord);
  if (fromStart > START_RADIUS_M + slack(position.accuracy)) {
    throw new TripError(
      `You are ${(fromStart / 1000).toFixed(1)} km from the start. Start the trip from where it begins.`,
    );
  }

  return {
    sid: crypto.randomUUID(),
    uid: userId,
    mode: route_type,
    origin,
    destination,
    dest: { lat: dest_coord.lat, lng: dest_coord.lng },
    km,
    saved: parseFloat(co2_saved_kg.toFixed(3)),
    emitted: parseFloat(co2_emitted_kg.toFixed(3)),
    t0: now,
  };
}

// Check a finish request against its token. Returns the verified trip.
function verifyFinish(token, position, userId, now = Date.now()) {
  const trip = readToken(token);
  if (trip.uid !== userId) throw new TripError('This trip belongs to another account', 403);
  const mode = MODES[trip.mode];
  if (!mode) throw new TripError('Invalid trip token');
  if (!Number.isFinite(trip.saved) || !Number.isFinite(trip.emitted)) {
    throw new TripError('This trip was started before an update. Start a new one.');
  }
  if (now - trip.t0 > TOKEN_TTL_MS) throw new TripError('This trip expired. Start a new one.');
  if (!isCoord(position)) throw new TripError('Location is required to finish a trip');

  const away = haversineM(position, trip.dest);
  if (away > ARRIVE_RADIUS_M + slack(position.accuracy)) {
    throw new TripError(`You are ${Math.round(away)} m from the destination. Keep going.`);
  }

  const elapsedMs = now - trip.t0;
  if (elapsedMs < MIN_TRIP_MS) throw new TripError('That was too quick to count as a trip');
  const avgKmh = trip.km / (elapsedMs / 3600000);
  if (avgKmh > mode.maxKmh) {
    throw new TripError(`That was faster than ${trip.mode === 'bike' ? 'a bike ride' : 'a transit trip'} can go`);
  }
  if (avgKmh < mode.minKmh) throw new TripError('This trip took too long to count. Start a new one.');

  return trip;
}

// What gets logged and paid is exactly what was signed at the start, so the
// route card, Eco-Impact, points and trip history all show one number.
function rewardFor(trip) {
  return {
    co2_emitted_kg: trip.emitted,
    co2_saved_kg: trip.saved,
    points_earned: pointsFor(trip.saved),
  };
}

module.exports = {
  TripError, planTrip, verifyFinish, signToken, readToken, rewardFor, pointsFor, haversineM,
  START_RADIUS_M, ARRIVE_RADIUS_M, MODES,
};
