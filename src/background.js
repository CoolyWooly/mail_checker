// Service worker: опрос Atom-фида Gmail по таймеру, состояние в storage.local, бейдж.

import { getSettings, scopeLabel } from './settings.js';
import { fetchUnread, GmailError } from './gmail.js';

const ALARM = 'poll';
const STATE_KEY = 'state';
const SOFT_REFRESH_MS = 20_000; // троттлинг для открытия popup
const RETRY_DELAYS_MS = [1000, 3000];

const BADGE_COLORS = {
  ok: '#D93025',
  error: '#F29900',
  signed_out: '#9AA0A6',
};

const DEFAULT_STATE = {
  count: 0,
  capped: false,
  total: 0,
  lastSync: 0,
  error: null,
  authState: 'unknown', // unknown | ok | signed_out | off
};

let refreshing = null;
let rerunRequested = false;

async function getState() {
  const stored = await chrome.storage.local.get(STATE_KEY);
  return { ...DEFAULT_STATE, ...(stored[STATE_KEY] ?? {}) };
}

async function setState(patch) {
  const next = { ...(await getState()), ...patch };
  await chrome.storage.local.set({ [STATE_KEY]: next });
  return next;
}

export function badgeText(state) {
  if (state.authState === 'off') return '';
  if (state.authState === 'signed_out') return '?';
  if (state.count === 0) return '';
  if (state.count > 99) return '99+';
  return state.capped ? `${state.count}+` : String(state.count);
}

async function paintBadge(state, settings) {
  let color = BADGE_COLORS.ok;
  if (state.authState === 'signed_out') color = BADGE_COLORS.signed_out;
  else if (state.error) color = BADGE_COLORS.error;

  await chrome.action.setBadgeText({ text: badgeText(state) });
  await chrome.action.setBadgeBackgroundColor({ color });

  let title = 'Google Apps';
  if (state.authState === 'off') {
    // счётчик выключен в настройках — заголовок без цифр
  } else if (state.authState === 'signed_out') {
    title += '\nВойдите в Gmail в этом браузере';
  } else {
    title += `\n${state.count}${state.capped ? '+' : ''} непрочитанных · ${scopeLabel(settings)}`;
    if (state.error) title += `\nОшибка обновления: ${state.error}`;
  }
  await chrome.action.setTitle({ title });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function doRefresh() {
  const settings = await getSettings();

  if (!settings.showCounter) {
    const state = await setState({ authState: 'off', count: 0, capped: false, error: null });
    await paintBadge(state, settings);
    return state;
  }

  for (let attempt = 0; ; attempt += 1) {
    try {
      const { count, capped, total } = await fetchUnread(settings);
      const state = await setState({
        count, capped, total, lastSync: Date.now(), error: null, authState: 'ok',
      });
      await paintBadge(state, settings);
      return state;
    } catch (err) {
      const retryable = err instanceof GmailError && err.retryable;
      if (retryable && attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      // Прошлый count сохраняем: лучше слегка устаревшее число, чем пустота.
      const patch = { error: String(err?.message ?? err) };
      if (err instanceof GmailError && err.needsLogin) {
        patch.authState = 'signed_out';
        patch.count = 0;
        patch.capped = false;
      }
      const state = await setState(patch);
      await paintBadge(state, settings);
      return state;
    }
  }
}

/**
 * Гарантирует, что параллельно крутится не больше одного опроса. Форсированный запрос,
 * пришедший во время работы, не отбрасывается: опрос уже начат со старыми настройками,
 * поэтому после него делаем ещё один проход — иначе смена периода или метки во время
 * опроса (а он длится до fetch + 4 с ретраев) молча терялась.
 */
function refresh({ force = true } = {}) {
  if (refreshing) {
    if (force) rerunRequested = true;
    return refreshing;
  }
  refreshing = (async () => {
    if (!force) {
      const state = await getState();
      if (Date.now() - state.lastSync < SOFT_REFRESH_MS && !state.error && !rerunRequested) {
        return state;
      }
    }
    let state = await doRefresh();
    while (rerunRequested) {
      rerunRequested = false;
      state = await doRefresh();
    }
    return state;
  })().finally(() => {
    refreshing = null;
    rerunRequested = false;
  });
  return refreshing;
}

async function scheduleAlarm() {
  const { pollMinutes, showCounter } = await getSettings();
  await chrome.alarms.clear(ALARM);
  if (!showCounter) return;
  await chrome.alarms.create(ALARM, {
    periodInMinutes: pollMinutes,
    delayInMinutes: pollMinutes,
  });
}

/**
 * Промис возвращается из каждого слушателя: синхронный слушатель не даёт Chrome повода
 * продлить жизнь service worker'у, и длинный опрос мог обрываться на середине.
 * Отказ гасим здесь же — необработанный reject в service worker'е валит весь worker.
 */
const task = (run) => Promise.resolve().then(run).catch((err) => {
  console.error('[mail-checker]', err);
});

chrome.runtime.onInstalled.addListener(() => task(async () => {
  await scheduleAlarm();
  await refresh();
}));

chrome.runtime.onStartup.addListener(() => task(async () => {
  await scheduleAlarm();
  await refresh();
}));

chrome.alarms.onAlarm.addListener((alarm) => (
  alarm.name === ALARM ? task(() => refresh()) : undefined
));

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return undefined;
  return task(async () => {
    if (changes.pollMinutes || changes.showCounter) await scheduleAlarm();
    if (changes.days || changes.label || changes.accountIndex || changes.showCounter) {
      await refresh();
    }
  });
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      switch (msg?.type) {
        case 'getState':
          sendResponse({ state: await getState(), settings: await getSettings() });
          return;
        case 'refresh':
          sendResponse({ state: await refresh({ force: msg.force !== false }) });
          return;
        default:
          sendResponse({ error: `Неизвестное сообщение: ${msg?.type}` });
      }
    } catch (err) {
      // Без ответа страница висела бы на await sendMessage до самого закрытия popup.
      sendResponse({ error: String(err?.message ?? err) });
    }
  })();
  return true; // ответ асинхронный
});
