// Test delle funzioni pure (npm test dentro functions/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isoWeek, validateScore, sortKeyOf } from './validate';
import { maxPlausibleAvgW, GAMES } from './games';

const base = { game: 'mattoni', score: 12000, durationSec: 600, avgW: 200, maxW: 600, runId: 'abcdef1234' };

test('punteggio valido', () => {
  const r = validateScore(base);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.boardId, 'mattoni');
});

test('punteggi e potenze impossibili rifiutati', () => {
  assert.equal(validateScore({ ...base, game: 'tetris' }).ok, false);
  assert.equal(validateScore({ ...base, score: 9_999_999 }).ok, false);
  assert.equal(validateScore({ ...base, score: 400_000, durationSec: 60 }).ok, false); // ritmo
  assert.equal(validateScore({ ...base, avgW: 1500, durationSec: 1200, maxW: 2000 }).ok, false);
  assert.equal(validateScore({ ...base, avgW: 700, maxW: 600 }).ok, false);
  assert.equal(validateScore({ ...base, durationSec: 5 }).ok, false);
  assert.equal(validateScore({ ...base, extra: 1 }).ok, false);
  assert.equal(validateScore({ ...base, runId: 'x' }).ok, false);
  assert.equal(validateScore({ ...base, score: 1.5 }).ok, false);
});

test('gara a tempo: tappa obbligatoria, tempo coerente con la durata', () => {
  const race = { game: 'racer', stage: 3, score: 245.37, durationSec: 260, avgW: 230, maxW: 700, runId: 'run_000001' };
  const r = validateScore(race);
  assert.equal(r.ok, true);
  if (r.ok) { assert.equal(r.boardId, 'racer-s3'); assert.equal(r.value.score, 245.4); assert.equal(sortKeyOf(GAMES.racer, 245.4), -245.4); }
  assert.equal(validateScore({ ...race, stage: undefined }).ok, false);
  assert.equal(validateScore({ ...race, score: 400 }).ok, false); // più lungo della partita
});

test('curva della potenza plausibile', () => {
  assert.ok(maxPlausibleAvgW(5) > 1800);
  assert.ok(maxPlausibleAvgW(60) > 900 && maxPlausibleAvgW(60) < 1100);
  assert.ok(maxPlausibleAvgW(1200) < 560);
  assert.ok(maxPlausibleAvgW(3600) < 470);
});

test('settimana ISO', () => {
  assert.equal(isoWeek(new Date('2026-11-07T12:00:00Z')), '2026-W45');
  assert.equal(isoWeek(new Date('2027-01-01T00:00:00Z')), '2026-W53');
  assert.equal(isoWeek(new Date('2024-12-30T00:00:00Z')), '2025-W01');
});
