import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rankRaces} from '../assets/matcher.mjs';
import {criteria} from '../assets/criteria.mjs';

const {races} = JSON.parse(readFileSync(new URL('../data/races.json', import.meta.url)));
const pick = (value, importance = '1') => ({value, importance});

test('demo records cover the criteria and contain no invented geometry', () => {
  for (const race of races.filter(race => race.demo)) {
    assert.equal(race.demo, true);
    assert.deepEqual(race.courseVersions, []);
    assert.deepEqual(Object.keys(race.attributes), criteria.map(({key}) => key));
  }
});

test('weighted fit rewards exact and near matches and handles missing data separately', () => {
  const ranked = rankRaces(races.filter(race => race.demo), {gain:pick('At most 150 m','4'), cost:pick('At most $130 USD')});
  assert.equal(ranked[0].race.id, 'tideline');
  const estuary = ranked.find(x => x.race.id === 'blue-estuary');
  assert.equal(estuary.score, 98);
  assert.equal(estuary.details[0].status, 'Near match');
  const lowSun = ranked.find(x => x.race.id === 'low-sun');
  assert.equal(lowSun.coverage, 80);
  assert.equal(lowSun.details[1].status, 'Missing');
});

test('requirements separate known misses from unknown eligibility', () => {
  const ranked = rankRaces(races.filter(race => race.demo), {boston:pick('eligible','required'), temperature:pick('10–16 °C')});
  assert.equal(ranked[0].race.id, 'meridian-city');
  assert.equal(ranked.find(x => x.race.id === 'silver-grove').unconfirmed, true);
  const lowSun = ranked.find(x => x.race.id === 'low-sun');
  assert.equal(lowSun.unmet, true);
  assert.equal(lowSun.score, null);
  assert.equal(lowSun.details[0].status, 'Unverified');
});

test('month similarity wraps around the new year', () => {
  const [result] = rankRaces([{...races[0], attributes:{month:{status:'verified',value:'December'}}}],
    {month:pick('January')});
  assert.equal(result.score, 50);
});

test('date windows include both boundaries across years and keep near and missing dates distinct', () => {
  const base = {...races[0], demo:false};
  const examples = [
    {...base, id:'first-day', date:'2026-12-20'},
    {...base, id:'last-day', date:'2027-01-05'},
    {...base, id:'near', date:'2027-01-06'},
    {...base, id:'missing'},
  ];
  const date = {start:'2026-12-20', end:'2027-01-05', importance:'2'};
  const results = rankRaces(examples, {date});
  assert.deepEqual(results.map(item => item.score), [100, 100, 98, null]);
  assert.equal(results[2].details[0].status, 'Near match');
  assert.equal(results[3].details[0].status, 'Missing');
  const required = rankRaces(examples, {date:{...date, importance:'required'}});
  assert.equal(required.find(item => item.race.id === 'near').unmet, true);
  assert.equal(required.find(item => item.race.id === 'missing').unconfirmed, true);
  const [fromOnly] = rankRaces([examples[2]], {date:{start:'2027-01-05', importance:'1'}});
  assert.equal(fromOnly.score, 100);
});

test('mostly-loop courses are near matches for a loop preference', () => {
  const race = {...races[0], attributes:{configuration:{status:'verified', value:'Mostly loop'}}};
  const [weighted] = rankRaces([race], {configuration:pick('Loop')});
  assert.equal(weighted.score, 50);
  assert.equal(weighted.details[0].status, 'Near match');
  const [required] = rankRaces([race], {configuration:pick('Loop','required')});
  assert.equal(required.unmet, true);
});
