// Страница настроек: параметры счётчика и видимость плиток.
// Порядок плиток задаётся перетаскиванием в popup.

import { getSettings, setSettings, DEFAULTS, scopeLabel } from './settings.js';
import { SERVICE_BY_ID, iconPath } from './services.js';
import { feedUrl, FEED_ENTRY_LIMIT } from './gmail.js';

const els = {
  showCounter: document.getElementById('showCounter'),
  days: document.getElementById('days'),
  label: document.getElementById('label'),
  pollMinutes: document.getElementById('pollMinutes'),
  accountIndex: document.getElementById('accountIndex'),
  feedPreview: document.getElementById('feed-preview'),
  counterNote: document.getElementById('counter-note'),
  statusLine: document.getElementById('status-line'),
  saveFlash: document.getElementById('save-flash'),
  refresh: document.getElementById('refresh'),
  showAll: document.getElementById('show-all'),
  reset: document.getElementById('reset'),
  list: document.getElementById('service-list'),
  rowTpl: document.getElementById('service-row-template'),
};

let settings = null;
let statusTimer = 0;

const send = (msg) => chrome.runtime.sendMessage(msg);

/** Пишет в отдельный элемент: строка статуса счётчика рядом и не должна затираться. */
function flash(text) {
  els.saveFlash.textContent = text;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    els.saveFlash.textContent = '';
  }, 2500);
}

// Записи выстроены в очередь: два быстрых изменения подряд не затирают друг друга
// (setSettings читает текущие настройки перед записью).
let saveQueue = Promise.resolve();

function save(patch) {
  const run = async () => {
    try {
      settings = await setSettings(patch);
      applyToForm();
      flash('Сохранено');
    } catch (err) {
      flash(`Не сохранено: ${err?.message ?? err}`);
    }
  };
  // Ошибку гасим внутри звена: отклонённый saveQueue навсегда пропускал бы все
  // последующие .then(), и страница молча переставала бы сохранять.
  saveQueue = saveQueue.then(run, run);
  return saveQueue;
}

function applyToForm() {
  els.showCounter.checked = settings.showCounter;
  els.days.value = settings.days;
  els.label.value = settings.label;
  els.pollMinutes.value = settings.pollMinutes;
  els.accountIndex.value = settings.accountIndex;
  els.feedPreview.textContent = feedUrl(settings);
  els.counterNote.textContent = settings.days > 0
    ? `Фид отдаёт максимум ${FEED_ENTRY_LIMIT} последних писем, поэтому при фильтре по дате `
      + `число сверх ${FEED_ENTRY_LIMIT} показывается как «${FEED_ENTRY_LIMIT}+».`
    : 'При периоде 0 берётся точное общее число непрочитанных из фида.';
  for (const el of [els.days, els.label, els.pollMinutes]) el.disabled = !settings.showCounter;
}

function renderStatus(state) {
  const map = {
    ok: 'Счётчик работает.',
    signed_out: 'Нет сессии Gmail — войдите в Gmail в этом браузере.',
    off: 'Счётчик выключен.',
    unknown: 'Ещё не проверялось.',
  };
  // 'unknown' + ошибка — проверка была и провалилась, «ещё не проверялось» тут врёт.
  let text = state.authState === 'unknown' && state.error
    ? 'Проверка не удалась.'
    : map[state.authState] ?? map.unknown;
  if (state.authState === 'ok') {
    text += ` Сейчас: ${state.count}${state.capped ? '+' : ''} непрочитанных`
      + ` (${scopeLabel(settings)}), всего по фиду: ${state.total}.`;
  }
  if (state.error) text += ` Последняя ошибка: ${state.error}`;
  els.statusLine.textContent = text;
}

function renderList() {
  const hidden = new Set(settings.hidden);
  const inFavorites = new Set(settings.favorites);
  els.list.textContent = '';

  for (const id of [...settings.favorites, ...settings.others]) {
    const service = SERVICE_BY_ID[id];
    if (!service) continue;

    const row = els.rowTpl.content.firstElementChild.cloneNode(true);
    const checkbox = row.querySelector('input');
    checkbox.checked = !hidden.has(id);
    checkbox.addEventListener('change', () => {
      // Список не перерисовываем: чекбокс уже в нужном состоянии, а перерисовка съела бы фокус.
      const next = checkbox.checked
        ? settings.hidden.filter((x) => x !== id)
        : settings.hidden.concat(id);
      save({ hidden: next });
    });

    row.querySelector('img').src = iconPath(id);
    row.querySelector('.service-name').textContent = service.name;
    row.querySelector('.service-zone').textContent = inFavorites.has(id) ? 'Избранное' : 'Ещё';
    els.list.append(row);
  }
}

els.showCounter.addEventListener('change', () => save({ showCounter: els.showCounter.checked }));
els.label.addEventListener('change', () => save({ label: els.label.value }));
for (const key of ['days', 'pollMinutes', 'accountIndex']) {
  els[key].addEventListener('change', () => {
    // Пустое поле — не «сбросить к умолчанию», а «ничего не менял»: возвращаем прежнее.
    if (els[key].value.trim() === '') {
      applyToForm();
      return;
    }
    save({ [key]: els[key].value });
  });
}

els.refresh.addEventListener('click', async () => {
  els.refresh.disabled = true;
  try {
    const res = await send({ type: 'refresh', force: true });
    if (res?.state) renderStatus(res.state);
    else els.statusLine.textContent = res?.error ?? 'Фоновый процесс не ответил — попробуйте ещё раз.';
  } catch (err) {
    els.statusLine.textContent = `Не удалось проверить: ${err?.message ?? err}`;
  } finally {
    // Без finally отказ sendMessage (перезапуск service worker) блокировал кнопку навсегда.
    els.refresh.disabled = false;
  }
});

els.showAll.addEventListener('click', () => save({ hidden: [] }).then(renderList));
els.reset.addEventListener('click', () => save({
  favorites: DEFAULTS.favorites.slice(),
  others: DEFAULTS.others.slice(),
  hidden: [],
}).then(renderList));

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.state?.newValue) renderStatus(changes.state.newValue);
});

(async function init() {
  settings = await getSettings();
  applyToForm();
  renderList();
  try {
    const res = await send({ type: 'getState' });
    if (res?.state) renderStatus(res.state);
  } catch (err) {
    els.statusLine.textContent = `Нет связи с фоновым процессом: ${err?.message ?? err}`;
  }
})();
