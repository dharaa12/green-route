// Relatable equivalents for a CO2 saving (kilograms). Factors from EPA
// "Greenhouse Gas Equivalencies" and common energy references.
export function ecoEquivalents(kg) {
  const v = Math.max(0, kg);
  return [
    { key: 'trees',  value: v / 0.058,  label: 'tree-days of CO₂ absorption' },
    { key: 'phone',  value: v / 0.0082, label: 'smartphone charges' },
    { key: 'drive',  value: v / 0.404,  label: 'miles of driving avoided' },
    { key: 'led',    value: v / 0.004,  label: 'hours of LED lighting' },
  ];
}

export function formatCount(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 100) return Math.round(n).toString();
  if (n >= 10) return n.toFixed(0);
  return n.toFixed(1);
}

export function formatCo2(kg) {
  return kg < 1 ? `${Math.round(kg * 1000)} g` : `${kg.toFixed(2)} kg`;
}
