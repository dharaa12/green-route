-- Trips that earn points are now started and completed in the app. The server
-- signs a token when a trip starts; its id is stored here when the trip is
-- completed, and the unique index means one start can only be redeemed once.
-- Trips logged before this migration (and driving trips) have no session_id.

alter table trips add column if not exists session_id uuid;

create unique index if not exists trips_session_id_key
  on trips (session_id)
  where session_id is not null;
