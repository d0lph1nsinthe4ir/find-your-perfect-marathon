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

for (const criterion of criteria) {
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
      const weightLabel = importance.find(([value]) => value === item.importance)[1];
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

form.addEventListener('submit', event => {
  event.preventDefault();
  const inputs = new FormData(form);
  const selections = Object.fromEntries(criteria.map(({key}) => [
    key, {value:inputs.get(key), importance:inputs.get(key + '-weight')},
  ]));
  const ranked = rankRaces(races, selections);
  const matches = ranked.filter(result => !result.unmet && !result.unconfirmed);
  const pending = ranked.filter(result => !result.unmet && result.unconfirmed);
  const excluded = ranked.filter(result => result.unmet);
  const rankings = $('rankings');
  rankings.replaceChildren();
  const hasPreferences = [...Object.values(selections)].some(item => item.value);
  rankings.append(element('p', hasPreferences ?
    'Fit is the percentage of available weighted points earned. Near misses can earn partial points. Coverage shows how much weighted data is available.' :
    'Choose a preference to score races. Races are listed alphabetically.', 'muted'));
  if (!matches.length) rankings.append(element('p', 'No race confirms all your requirements.'));
  for (const match of matches) rankings.append(resultCard(match));
  for (const [title, group] of [['Requirements to confirm',pending],['Does not meet requirements',excluded]]) {
    if (!group.length) continue;
    const more = element('details', '', 'result');
    more.append(element('summary', title + ' (' + group.length + ')'));
    for (const result of group) more.append(resultCard(result));
    rankings.append(more);
  }
  results.hidden = false;
  $('results-title').focus();
});

form.addEventListener('reset', () => {
  results.hidden = true;
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
    for (const criterion of criteria) {
      const field = race.attributes[criterion.key];
      const value = field?.value;
      const row = element('div');
      const actual = field?.status === 'unverified' ? 'Unverified' : value == null ? 'Missing' :
        Array.isArray(value) ? value.join(', ') : displayValue(criterion, value);
      row.append(element('dt', criterion.label), element('dd', actual));
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
    profile.append(facts, heading, panel);
  }
  if (!initial) {
    title.focus({preventScroll:true});
    window.scrollTo(0, 0);
  }
}

async function start() {
  try {
    const response = await fetch(new URL('../data/races.json', import.meta.url));
    if (!response.ok) throw new Error('Race data request failed');
    const data = await response.json();
    const realRaces = data.races.filter(race => !race.demo);
    races = realRaces.length ? realRaces : data.races;
    if (realRaces.length) {
      $('catalog-note').textContent = 'Course details vary by race. Missing and unverified details are shown separately.';
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
