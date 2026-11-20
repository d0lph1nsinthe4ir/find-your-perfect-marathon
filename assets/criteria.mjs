const choice = (value, label = value) => ({value, label});
const ranges = (...bands) => bands.map(([label, low, high]) => ({
  value: label, label, low, high,
}));
const upper = (...limits) => limits.map(([label, high]) => ({
  value: label, label, low: -Infinity, high,
}));
const categories = (...values) => values.map(value => choice(value));

export const criteria = [
  {key:'month', label:'Race month', options:categories(...'January February March April May June July August September October November December'.split(' ')), scale:2, icon:'M4 6h16v15H4zM4 10h16M8 3v5m8-5v5'},
  {key:'season', label:'Race season', options:categories('Spring','Summer','Autumn','Winter'), icon:'M12 2v4m0 12v4M2 12h4m12 0h4M8 8l8 8m0-8-8 8'},
  {key:'region', label:'Geographic region', options:categories('Africa','Asia','Europe','North America','Oceania','South America'), icon:'M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16m6-14v16'},
  {key:'temperature', label:'Typical morning temperature', options:ranges(['Below 10 °C',-Infinity,9],['10–16 °C',10,16],['17–23 °C',17,23],['24 °C or warmer',24,Infinity]), scale:10, unit:' °C', icon:'M10 14V5a2 2 0 014 0v9a4 4 0 11-4 0Zm2-5v8'},
  {key:'gain', label:'Elevation gain', options:upper(['At most 150 m',150],['At most 350 m',350],['At most 600 m',600]), scale:500, unit:' m', icon:'M2 20 9 9l4 5 4-8 5 14M5 10V3m-3 3 3-3 3 3'},
  {key:'loss', label:'Elevation loss', options:upper(['At most 150 m',150],['At most 350 m',350],['At most 600 m',600]), scale:500, unit:' m', icon:'M2 20 7 6l5 8 4-5 6 11M19 3v7m-3-3 3 3 3-3'},
  {key:'surface', label:'Course surface', options:categories('Road','Trail','Mixed'), icon:'M8 3 3 21h18L16 3M12 3v4m0 3v4m0 3v4'},
  {key:'boston', label:'Boston qualifying eligibility', options:[choice('eligible','Eligible course')], icon:'M4 22V3m0 1h15l-3 4 3 4H4'},
  {key:'field', label:'Field size', options:ranges(['Under 2,000',0,1999],['2,000–9,999',2000,9999],['10,000 or more',10000,Infinity]), scale:10000, unit:' runners', icon:'M3 20v-4l4-4 4 4v4m2 0v-4l4-4 4 4v4M5 6h4v4H5zm10 0h4v4h-4z'},
  {key:'scenery', label:'Scenery', options:categories('Waterfront','Urban','Forest','Mountains','Countryside'), icon:'M3 4h18v16H3zM3 17l6-7 4 5 3-3 5 5M16 8h2'},
  {key:'cost', label:'Registration cost', matchable:false, options:upper(['At most $80 USD',80],['At most $130 USD',130],['At most $200 USD',200]), scale:100, unit:' USD', icon:'M3 6h18v12H3zm9 3v6M9 10h6m-6 4h6'},
  {key:'travel', label:'Travel convenience', options:categories('Airport and transit','Airport nearby','Car recommended'), scale:2, icon:'M3 18h18M4 11l5 2 10-7 2 1-7 7-5 1z'},
  {key:'configuration', label:'Course configuration', options:categories('Loop','Mostly loop','Multiple loops','Point-to-point','Out-and-back','Mostly out-and-back','Multiple out-and-backs'), icon:'M8 5h8l4 4v7l-4 4H8l-4-4V9zm7-2 2 2-2 2'},
  {key:'registration', label:'Registration availability', options:categories('Open','Upcoming','Waitlist','Closed'), icon:'M3 5h18v14H3zm4 7 3 3 7-7'},
];

export const importance = [
  ['1','Nice to have'], ['2','Important'], ['4','Very important'], ['required','Required'],
];

export function displayValue(criterion, value) {
  if (criterion.key === 'boston') return value === 'eligible' ? 'Eligible course' : 'Ineligible course';
  return typeof value === 'number' ? value.toLocaleString('en-US') + criterion.unit : value;
}
