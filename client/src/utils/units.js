// The app targets a US audience — display CO2 in pounds and distance in miles,
// while everything is stored metric.
const LBS_PER_KG = 2.2046226218;
const MI_PER_KM = 0.6213711922;

export const kgToLbs = (kg) => (kg || 0) * LBS_PER_KG;
export const kmToMi = (km) => (km || 0) * MI_PER_KM;

export const lbs = (kg, digits = 1) => kgToLbs(kg).toFixed(digits);
export const mi = (km, digits = 1) => kmToMi(km).toFixed(digits);
