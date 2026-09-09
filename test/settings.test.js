import test from 'node:test';
import assert from 'node:assert/strict';

import { normalize, scopeLabel, DEFAULTS, LIMITS } from '../src/settings.js';
import { ALL_SERVICE_IDS } from '../src/services.js';

test('normalize: пустой ввод даёт значения по умолчанию', () => {
  const s = normalize({});
  assert.equal(s.showCounter, true);
  assert.equal(s.days, DEFAULTS.days);
  assert.equal(s.label, '');
  assert.deepEqual(s.favorites, DEFAULTS.favorites);
  assert.deepEqual([...s.favorites, ...s.others].sort(), [...ALL_SERVICE_IDS].sort());
});

test('normalize: числа зажимаются в границы', () => {
  assert.equal(normalize({ days: 999 }).days, LIMITS.days.max);
  assert.equal(normalize({ days: -5 }).days, LIMITS.days.min);
  assert.equal(normalize({ pollMinutes: 0 }).pollMinutes, LIMITS.pollMinutes.min);
  assert.equal(normalize({ accountIndex: 42 }).accountIndex, LIMITS.accountIndex.max);
  assert.equal(normalize({ days: 'мусор' }).days, DEFAULTS.days);
});

test('normalize: неизвестные и повторяющиеся id отбрасываются', () => {
  const s = normalize({ favorites: ['gmail', 'gmail', 'нетакого', 'drive'] });
  assert.deepEqual(s.favorites, ['gmail', 'drive']);
  assert.ok(!s.others.includes('gmail'));
});

test('normalize: сервисы из новых версий дописываются в конец «Ещё»', () => {
  const s = normalize({ favorites: ['gmail'], others: ['drive'] });
  assert.equal(s.others[0], 'drive');
  assert.deepEqual([...s.favorites, ...s.others].sort(), [...ALL_SERVICE_IDS].sort());
});

test('normalize: метка обрезается до 64 символов', () => {
  assert.equal(normalize({ label: `  ${'x'.repeat(80)}  ` }).label.length, 64);
  assert.equal(normalize({ label: 42 }).label, '');
});

test('scopeLabel', () => {
  assert.equal(scopeLabel({ days: 2, label: '' }), 'Входящие · за 2 дн.');
  assert.equal(scopeLabel({ days: 0, label: '' }), 'Входящие · все непрочитанные');
  assert.equal(scopeLabel({ days: 3, label: 'Primary' }), 'метка «Primary» · за 3 дн.');
});
