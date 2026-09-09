import test from 'node:test';
import assert from 'node:assert/strict';

// background.js вешает слушатели на верхнем уровне — chrome должен существовать до импорта.
const listeners = {};
const capture = (name) => ({ addListener: (fn) => { listeners[name] = fn; } });

const local = {};
let sync = {};

globalThis.chrome = {
  runtime: {
    onInstalled: capture('installed'),
    onStartup: capture('startup'),
    onMessage: capture('message'),
  },
  alarms: {
    onAlarm: capture('alarm'),
    async clear() {},
    async create() {},
  },
  storage: {
    onChanged: capture('changed'),
    local: {
      async get(key) { return key in local ? { [key]: local[key] } : {}; },
      async set(obj) { Object.assign(local, obj); },
    },
    sync: {
      async get(defaults) { return { ...defaults, ...sync }; },
      async set(obj) { sync = { ...sync, ...obj }; },
    },
  },
  action: {
    async setBadgeText() {},
    async setBadgeBackgroundColor() {},
    async setTitle() {},
  },
};

const { badgeText } = await import('../src/background.js');

test('badgeText', () => {
  assert.equal(badgeText({ authState: 'off', count: 5 }), '');
  assert.equal(badgeText({ authState: 'signed_out', count: 5 }), '?');
  assert.equal(badgeText({ authState: 'ok', count: 0 }), '');
  assert.equal(badgeText({ authState: 'ok', count: 7, capped: false }), '7');
  assert.equal(badgeText({ authState: 'ok', count: 7, capped: true }), '7+');
  assert.equal(badgeText({ authState: 'ok', count: 150, capped: false }), '99+');
});

/** Прогоняет сообщение через реальный слушатель onMessage. */
const send = (msg) => new Promise((resolve) => listeners.message(msg, null, resolve));

test('смена настроек во время опроса приводит к повторному опросу', async () => {
  let calls = 0;
  let releaseFirst;
  const firstInFlight = new Promise((r) => { releaseFirst = r; });

  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) await firstInFlight; // держим первый опрос открытым
    return new Response('<feed><fullcount>4</fullcount></feed>', { status: 200 });
  };

  try {
    const inFlight = send({ type: 'refresh' });
    // Ждём, пока первый fetch реально начнётся.
    while (calls === 0) await new Promise((r) => setImmediate(r));

    // Пользователь меняет период — опрос уже идёт со старым значением.
    // Ждать здесь нельзя: слушатель повиснет на том же незавершённом опросе.
    const changed = listeners.changed({ days: { newValue: 5 } }, 'sync');
    await new Promise((r) => setImmediate(r));

    releaseFirst();
    await inFlight;
    await changed;

    assert.equal(calls, 2, 'изменение настроек во время опроса не должно теряться');
  } finally {
    globalThis.fetch = original;
  }
});
