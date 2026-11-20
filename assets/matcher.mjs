import {criteria, displayValue} from './criteria.mjs';

const mostlyVariant = new Map([
  ['Mostly loop', 'Loop'],
  ['Mostly out-and-back', 'Out-and-back'],
  ['Mostly road', 'Road'],
  ['Mostly trail', 'Trail'],
]);

export function similarity(criterion, option, value) {
  if (Object.prototype.hasOwnProperty.call(option, 'low')) {
    const distance = Math.max(option.low - value, value - option.high, 0);
    return Math.max(0, 1 - distance / criterion.scale);
  }
  if (Array.isArray(value)) return Number(value.includes(option.value));
  if (value === option.value) return 1;
  if (mostlyVariant.get(value) === option.value || mostlyVariant.get(option.value) === value) return 0.5;
  if (!criterion.scale) return 0;
  const index = criterion.options.findIndex(item => item.value === value);
  if (index < 0) return 0;
  const target = criterion.options.indexOf(option);
  const distance = Math.abs(index - target);
  const gap = criterion.key === 'month' ? Math.min(distance, 12 - distance) : distance;
  return Math.max(0, 1 - gap / criterion.scale);
}

const dateCriterion = {key:'date', label:'Race date range', scale:60};
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle:'medium', timeZone:'UTC',
});

function calendarDay(value) {
  return Date.parse(value + 'T00:00:00Z') / 86400000;
}

export function rankRaces(races, selections) {
  const selected = criteria.flatMap(criterion => {
    const selection = selections[criterion.key];
    const option = criterion.options.find(item => item.value === selection?.value);
    return option ? [{criterion, option, importance:selection.importance}] : [];
  });
  const {start, end, importance} = selections.date ?? {};
  if (start || end) {
    const low = start ? calendarDay(start) : -Infinity;
    const high = end ? calendarDay(end) : Infinity;
    if (low <= high) {
      const label = start && end ? dateFormatter.format(Date.parse(start)) + ' to ' + dateFormatter.format(Date.parse(end)) :
        start ? 'On or after ' + dateFormatter.format(Date.parse(start)) :
        'On or before ' + dateFormatter.format(Date.parse(end));
      selected.unshift({criterion:dateCriterion, option:{low, high, label}, importance});
    }
  }
  return races.map(race => {
    let total = 0;
    let known = 0;
    let earned = 0;
    let unmet = false;
    let unconfirmed = false;
    const details = selected.map(({criterion, option, importance}) => {
      const isDate = criterion.key === 'date';
      const field = isDate ? {value:race.date ? calendarDay(race.date) : null,
        status:race.dateStatus ?? (race.demo ? 'demo' : 'verified')} : race.attributes[criterion.key];
      const required = importance === 'required';
      const weight = required ? 0 : Number(importance);
      total += weight;
      const undocumentedScenery = criterion.key === 'scenery' && field?.coverage === 'partial' &&
        !field.value?.includes(option.value);
      const available = field?.value != null && ['demo','verified'].includes(field.status) && !undocumentedScenery;
      if (!available) {
        unconfirmed ||= required;
        const status = field?.status === 'unverified' || undocumentedScenery ? 'Unverified' : 'Missing';
        return {criterion, option, importance, status, actual:status, fraction:null};
      }
      const fraction = similarity(criterion, option, field.value);
      unmet ||= required && fraction !== 1;
      known += weight;
      earned += weight * fraction;
      const status = fraction === 1 ? 'Fit' : fraction > 0 && !required ? 'Near match' : 'Compromise';
      const actual = isDate ? dateFormatter.format(Date.parse(race.date)) :
        Array.isArray(field.value) ? field.value.join(', ') : displayValue(criterion, field.value);
      const basis = field.year ? String(field.year) : field.basis;
      return {criterion, option, importance, status, actual: basis ? actual + ' (' + basis + ')' : actual, fraction};
    });
    return {race, details, score:known ? Math.round(100 * earned / known) : null,
      coverage:total ? Math.round(100 * known / total) : null, unmet, unconfirmed};
  }).sort((left, right) =>
    Number(left.unmet) - Number(right.unmet) ||
    Number(left.unconfirmed) - Number(right.unconfirmed) ||
    (right.score ?? -1) - (left.score ?? -1) ||
    (right.coverage ?? -1) - (left.coverage ?? -1) ||
    left.race.name.localeCompare(right.race.name));
}
