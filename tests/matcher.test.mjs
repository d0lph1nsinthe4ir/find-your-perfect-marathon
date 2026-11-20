import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rankRaces} from '../assets/matcher.mjs';
import {criteria} from '../assets/criteria.mjs';

const {races} = JSON.parse(readFileSync(new URL('../data/races.json', import.meta.url)));
const pick = (value, importance = '1') => ({value, importance});

test('demo records cover the criteria and contain no invented geometry', () => {
  for (const race of races) {
    assert.equal(race.demo, true);
    assert.deepEqual(race.courseVersions, []);
    assert.deepEqual(Object.keys(race.attributes), criteria.map(({key}) => key));
  }
});

test('weighted fit rewards exact and near matches and handles missing data separately', () => {
  const ranked = rankRaces(races, {gain:pick('At most 150 m','4'), cost:pick('At most $130 USD')});
  assert.equal(ranked[0].race.id, 'tideline');
  const estuary = ranked.find(x => x.race.id === 'blue-estuary');
  assert.equal(estuary.score, 98);
  assert.equal(estuary.details[0].status, 'Near match');
  const lowSun = ranked.find(x => x.race.id === 'low-sun');
  assert.equal(lowSun.coverage, 80);
  assert.equal(lowSun.details[1].status, 'Missing');
});

test('requirements separate known misses from unknown eligibility', () => {
  const ranked = rankRaces(races, {boston:pick('eligible','required'), temperature:pick('10–16 °C')});
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
