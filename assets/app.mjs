import {criteria, displayValue, importance} from './criteria.mjs';
import {rankRaces} from './matcher.mjs';

const $ = id => document.getElementById(id);
const form = $('matcher');
const home = $('home');
const profile = $('profile');
const results = $('results');
let races = [];

function sourceLink(url, label) {
  const link = element('a', label);
  const source = new URL(url);
  if (source.protocol === 'https:') link.href = source.href;
  return link;
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function icon(path) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const shape = document.createElementNS(ns, 'path');
  shape.setAttribute('d', path);
  shape.setAttribute('fill', 'none');
  shape.setAttribute('stroke', 'currentColor');
  shape.setAttribute('stroke-width', '1.65');
  svg.append(shape);
  return svg;
}

function select(label, name, options, description) {
  const wrapper = element('label', label);
  const input = element('select');
  input.name = name;
  input.setAttribute('aria-label', description);
  for (const [value, text] of options) input.add(new Option(text, value));
  wrapper.append(input);
  return wrapper;
}

const startDate = $('race-start');
const endDate = $('race-end');
const dateImportance = $('date-importance');
dateImportance.append(select('Importance', 'date-weight', importance, 'Race date range importance'));
const dateWeight = dateImportance.querySelector('select');

function syncDateRange() {
  dateWeight.disabled = !(startDate.value || endDate.value);
  endDate.setCustomValidity(startDate.value && endDate.value && startDate.value > endDate.value ?
    'Choose an end date on or after the start date.' : '');
}

for (const input of [startDate, endDate]) input.addEventListener('input', syncDateRange);
syncDateRange();

const matchingCriteria = criteria.filter(item => item.key !== 'month' && item.matchable !== false);

for (const criterion of matchingCriteria) {
  const item = element('div', '', 'criterion');
  const title = element('div', '', 'criterion-title');
  title.append(icon(criterion.icon), criterion.label);
  const controls = element('div', '', 'controls');
  controls.append(
    select('Preference', criterion.key, [['','Any'], ...criterion.options.map(({value,label}) => [value,label])], criterion.label + ' preference'),
    select('Importance', criterion.key + '-weight', importance, criterion.label + ' importance'),
  );
  const [preference, weight] = controls.querySelectorAll('select');
  weight.disabled = true;
  preference.addEventListener('change', () => { weight.disabled = !preference.value; });
  item.append(title, controls);
  $('criteria').append(item);
}

function resultCard(result) {
  const {race, details, score, coverage, unconfirmed} = result;
  const card = element('article', '', 'result');
  const row = element('div', '', 'result-top');
  const title = element('h3');
  const link = element('a', race.name);
  link.href = '#race/' + race.id;
  title.append(link);
  row.append(title, element('span', score === null ? 'Unscored' : score + '% fit', 'score'));
  card.append(row, element('p', [race.setting, race.date, race.demo && 'Demo race'].filter(Boolean).join(' · '), 'meta'));
  if (coverage !== null) card.append(element('p', coverage + '% weighted data coverage', 'meta'));
  if (unconfirmed) card.append(element('p', 'One or more requirements need confirmation.'));
  if (details.length) {
    const breakdown = element('details');
    breakdown.append(element('summary', 'See fits and compromises'));
    const list = element('ul');
    for (const item of details) {
      const weightLabel = importance.find(([value]) => value === item.importance)?.[1] ?? importance[0][1];
      const points = item.importance === 'required' || item.fraction === null ? '' :
        ' · ' + Number((item.fraction * Number(item.importance)).toFixed(2)) + '/' + item.importance + ' points';
      list.append(element('li', item.status + ' · ' + item.criterion.label + ' (' + weightLabel + ')' +
        ' · Wanted ' + item.option.label + ' · ' + item.actual + points));
    }
    breakdown.append(list);
    card.append(breakdown);
  }
  return card;
}

function appendResultPages(container, matches, moveFocus = false) {
  const list = element('div');
  const button = element('button', '', 'text-button');
  button.type = 'button';
  let shown = 0;
  function showPage(focus) {
    const page = matches.slice(shown, shown + 25);
    const cards = page.map(resultCard);
    list.append(...cards);
    shown += page.length;
    button.hidden = shown >= matches.length;
    button.textContent = 'Show more races (' + (matches.length - shown) + ' remaining)';
    if (focus) cards[0]?.querySelector('a').focus();
  }
  button.addEventListener('click', () => showPage(true));
  container.append(list, button);
  if (moveFocus) container.addEventListener('toggle', () => {
    if (container.open && !shown) showPage(false);
  });
  else showPage(false);
}

form.addEventListener('submit', event => {
  event.preventDefault();
  try {
    renderMatches();
  } catch (error) {
    $('rankings').replaceChildren(element('p', 'Results could not load. Try refreshing the page.'));
    results.hidden = false;
    $('results-title').focus();
    console.error(error);
  }
});

function renderMatches() {
  const inputs = new FormData(form);
  const selections = Object.fromEntries(matchingCriteria.map(({key}) => [
    key, {value:inputs.get(key), importance:inputs.get(key + '-weight') ?? '1'},
  ]));
  selections.date = {start:inputs.get('race-start'), end:inputs.get('race-end'),
    importance:inputs.get('date-weight') ?? '1'};
  const country = inputs.get('race-country');
  const candidates = country ? races.filter(race => race.country === country) : races;
  const ranked = rankRaces(candidates, selections);
  const matches = ranked.filter(result => !result.unmet && !result.unconfirmed);
  const pending = ranked.filter(result => !result.unmet && result.unconfirmed);
  const excluded = ranked.filter(result => result.unmet);
  const rankings = $('rankings');
  rankings.replaceChildren();
  const hasPreferences = Boolean(selections.date.start || selections.date.end) ||
    Object.values(selections).some(item => item.value);
  rankings.append(element('p', hasPreferences ?
    'Fit is the percentage of available weighted points earned. Near misses can earn partial points. Coverage shows how much weighted data is available.' :
    'Choose a preference to score races. Races are listed alphabetically.', 'muted'));
  const scope = country ? ' in ' + country : '';
  rankings.append(element('p', candidates.length + ' races searched' + scope + '.', 'meta'));
  if (!matches.length) rankings.append(element('p', 'No race confirms all your requirements.'));
  if (matches.length) appendResultPages(rankings, matches);
  for (const [title, group] of [['Requirements to confirm',pending],['Does not meet requirements',excluded]]) {
    if (!group.length) continue;
    const more = element('details', '', 'result');
    more.append(element('summary', title + ' (' + group.length + ')'));
    appendResultPages(more, group, true);
    rankings.append(more);
  }
  results.hidden = false;
  $('results-title').focus();
}

form.addEventListener('reset', () => {
  results.hidden = true;
  endDate.setCustomValidity('');
  for (const select of form.querySelectorAll('select[name$="-weight"]')) select.disabled = true;
});

function renderRoute(initial = false) {
  const raceId = location.hash.startsWith('#race/') ? location.hash.slice(6) : null;
  home.hidden = raceId !== null;
  profile.hidden = raceId === null;
  if (!raceId) {
    if (location.hash === '#results' && results.hidden) $('preferences').scrollIntoView();
    if (location.hash === '#results' && !results.hidden && !initial) $('results-title').focus();
    return;
  }
  const race = races.find(item => item.id === raceId);
  const back = element('a', '← Back to race matcher');
  back.href = results.hidden ? '#preferences' : '#results';
  const title = element('h1', race?.name ?? 'Race profile unavailable');
  title.tabIndex = -1;
  profile.replaceChildren(back, title);
  if (race) {
    profile.append(element('p', [race.setting, race.date].filter(Boolean).join(' · '), 'meta'));
    if (race.demo) {
      profile.append(element('p', 'Demo race profile · Fictional attributes for testing the matcher.', 'demo'));
    } else if (race.source) {
      const attribution = element('p');
      attribution.append(sourceLink(race.source.sourceUrl, race.source.sourceTitle),
        ' · Checked ' + race.source.verifiedOn);
      profile.append(attribution);
    }
    const facts = element('dl', '', 'facts');
    for (const criterion of criteria.filter(item => item.key !== 'travel')) {
      const field = race.attributes[criterion.key];
      const value = field?.value;
      const row = element('div');
      const actual = field?.status === 'unverified' ? 'Unverified' : value == null ? 'Missing' :
        Array.isArray(value) ? value.join(', ') : displayValue(criterion, value);
      const fact = element('dd', actual);
      if (criterion.key === 'boston' && field?.status === 'verified' && field.sourceUrl) {
        if (field.basis) fact.append(' · ' + field.basis);
        fact.append(' · ', sourceLink(field.sourceUrl, 'Source'),
          ' · ', sourceLink('https://www.baa.org/races/boston-marathon/qualify/', 'B.A.A. rules'));
      }
      if (criterion.key === 'scenery' && field?.evidence?.length) {
        const details = element('details', '', 'scenery-evidence');
        details.append(element('summary', 'Scenery sources'));
        const list = element('ul');
        for (const item of field.evidence) {
          const entry = element('li', item.tag + ' · ' + item.reason + ' ');
          entry.append(sourceLink(item.sourceUrl, item.sourceTitle));
          list.append(entry);
        }
        details.append(list);
        fact.append(details);
      }
      if (criterion.key === 'configuration' && field?.status === 'verified' && field.sourceUrl) {
        fact.append(' · ', sourceLink(field.sourceUrl, 'Course type source'));
      }
      if (criterion.key === 'field' && field?.year && field.sourceUrl) {
        fact.append(' · ', sourceLink(field.sourceUrl, field.year + ' results'));
      }
      if (criterion.key === 'field' && race.registrationCap?.sourceUrl) {
        const cap = race.registrationCap;
        fact.append(element('p', cap.value.toLocaleString('en-US') + ' runner cap · ', 'meta'));
        fact.lastElementChild.append(sourceLink(cap.sourceUrl, 'Organizer cap'));
      }
      if (criterion.key === 'airportDistance' && field?.airport) {
        fact.append(' straight-line from ' + field.location + ' · ', sourceLink(field.sourceUrl, field.airport));
      }
      if (['gain','loss','surface','season'].includes(criterion.key) && field?.sourceUrl) {
        fact.append(' · ', sourceLink(field.sourceUrl, 'Source'));
      }
      row.append(element('dt', criterion.label), fact);
      facts.append(row);
    }
    const heading = element('h2', 'Course intelligence');
    const panel = element('div', '', 'course-panel');
    const map = element('div', '', 'map-placeholder');
    map.append(icon(criteria.find(item => item.key === 'region').icon),
      element('strong', 'Course map unavailable'),
      element('p', 'A map will appear when sourced course geometry is available.'));
    if (race.courseSource) {
      map.append(sourceLink(race.courseSource.sourceUrl, 'View the organizer’s course information'));
    }
    const gpx = element('div');
    gpx.append(element('h3', 'GPX and course versions'),
      element('p', 'No GPX source, downloadable file or race-year course version is available for this edition.'),
      element('h3', 'Elevation and gradients'),
      element('p', 'Elevation profiles and significant climbs or descents require a verified course route.'));
    panel.append(map, gpx);
    profile.append(facts);
    const temperature = race.attributes.temperature;
    if (temperature?.status === 'verified' && temperature.basis) {
      profile.append(renderRaceWeather(temperature));
    }
    profile.append(heading, panel);
  }
  if (!initial) {
    title.focus({preventScroll:true});
    window.scrollTo(0, 0);
  }
}

function renderRaceWeather(temperature) {
  const section = element('section', '', 'weather');
  section.setAttribute('aria-labelledby', 'weather-title');
  const heading = element('h2', 'Historical race weather');
  heading.id = 'weather-title';
  const pastEditions = temperature.basis === 'past editions';
  const basis = pastEditions ? 'Median of the morning averages from the editions below.' :
    'Seasonal estimate based on ' + temperature.sampleDays + ' mornings within three days of the scheduled month and day, ' +
      temperature.years[0] + '–' + temperature.years[temperature.years.length - 1] + ', at 7–11 a.m. local time.';
  section.append(heading, element('p', 'Typical morning near ' + temperature.location + ' · ' +
    formatWeatherTemperature(temperature.value)), element('p', basis, 'meta'));

  if (pastEditions) {
    const list = element('ul', '', 'weather-history');
    for (const edition of temperature.editions) {
      const date = sourceLink(edition.dateSource, edition.date);
      const entry = element('li');
      const start = String(edition.startHour).padStart(2, '0') + ':00';
      const end = String(edition.startHour + 4).padStart(2, '0') + ':00';
      entry.append(date, element('span', formatWeatherTemperature(edition.low) + ' to ' +
        formatWeatherTemperature(edition.high) + ' · ' + start + '–' + end + ' local'));
      list.append(entry);
    }
    section.append(list);
  }

  const source = element('p', 'Modeled local air temperatures, for planning ahead. ', 'meta');
  source.append(sourceLink(temperature.sourceUrl, 'Open-Meteo / ERA5'), ' · ',
    sourceLink('https://creativecommons.org/licenses/by/4.0/', 'CC BY 4.0'));
  if (temperature.locationSource) {
    source.append(' · ', sourceLink(temperature.locationSource, 'GeoNames location'));
  }
  section.append(source);
  return section;
}

function formatWeatherTemperature(celsius) {
  return celsius + ' °C / ' + Math.round(celsius * 9 / 5 + 32) + ' °F';
}

async function start() {
  try {
    const response = await fetch(new URL('../data/races.json', import.meta.url));
    if (!response.ok) throw new Error('Race data request failed');
    const data = await response.json();
    const realRaces = data.races.filter(race => !race.demo);
    races = realRaces.length ? realRaces : data.races;
    if (realRaces.length) {
      $('catalog-note').textContent = realRaces.length +
        ' sourced races. Check with organizers before booking. Missing and unverified details are shown separately.';
      const countries = [...new Set(realRaces.map(race => race.country).filter(Boolean))]
        .sort((left, right) => left.localeCompare(right));
      if (countries.length) {
        const countryFilter = $('country-filter');
        countryFilter.append(select('Race country', 'race-country',
          [['', 'All countries'], ...countries.map(country => [country, country])], 'Race country'));
        countryFilter.append(element('p', 'Choose your home country to see domestic races only.', 'meta'));
        countryFilter.hidden = false;
      }
      $('footer-note').textContent = 'Prototype · Sourced race listings';
    }
    $('submit').disabled = false;
    renderRoute(true);
    window.addEventListener('hashchange', () => renderRoute());
  } catch (error) {
    $('load-status').textContent = 'Race data could not load. Reload the page to try again.';
    console.error(error);
  }
}
start();
