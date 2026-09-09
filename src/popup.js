// Popup-лаунчер: «Избранное» и остальные сервисы, перетаскивание и скрытие плиток
// в режиме правки.

import { SERVICE_BY_ID, iconPath, serviceUrl } from './services.js';
import { getSettings, setSettings, scopeLabel, DEFAULTS } from './settings.js';

const els = {
  scroller: document.getElementById('scroller'),
  favorites: document.getElementById('favorites'),
  others: document.getElementById('others'),
  hiddenSection: document.getElementById('hidden-section'),
  hidden: document.getElementById('hidden'),
  edit: document.getElementById('edit'),
  hint: document.getElementById('edit-hint'),
  status: document.getElementById('status'),
  options: document.getElementById('options'),
  tpl: document.getElementById('tile-template'),
};

const DRAG_THRESHOLD_PX = 5;
const AUTOSCROLL_EDGE_PX = 36;
const AUTOSCROLL_STEP_PX = 10;

let settings = null;
let state = null;
let editing = false;
let drag = null;

const send = (msg) => chrome.runtime.sendMessage(msg);

/** Сообщение в футере, которое не переживёт следующий renderStatus() — и не должно. */
function showError(text) {
  els.status.hidden = false;
  els.status.classList.remove('actionable');
  els.status.onclick = null;
  els.status.textContent = text;
}

// Записи выстроены в очередь: setSettings делает read-modify-write, и «скрыть плитку»
// одновременно с сохранением порядка иначе теряло одну из двух записей.
let saveQueue = Promise.resolve();

function saveSettings(patch) {
  const run = async () => {
    try {
      settings = await setSettings(patch);
    } catch (err) {
      showError(`Не сохранено: ${err?.message ?? err}`);
    }
  };
  saveQueue = saveQueue.then(run, run);
  return saveQueue;
}

/* ---------- отрисовка ---------- */

function badgeFor(id) {
  if (id !== 'gmail' || state?.authState !== 'ok' || !state.count) return '';
  if (state.count > 99) return '99+';
  return state.capped ? `${state.count}+` : String(state.count);
}

function makeTile(id, { isHidden = false } = {}) {
  const service = SERVICE_BY_ID[id];
  if (!service) return null;

  const tile = els.tpl.content.firstElementChild.cloneNode(true);
  tile.dataset.id = id;
  tile.classList.toggle('is-hidden', isHidden);

  const openButton = tile.querySelector('.tile-open');
  openButton.title = service.name;
  tile.querySelector('img').src = iconPath(id);
  tile.querySelector('.tile-label').textContent = service.name;

  const badge = badgeFor(id);
  if (badge && !isHidden) {
    const node = tile.querySelector('.tile-badge');
    node.hidden = false;
    node.textContent = badge;
  }

  const action = tile.querySelector('.tile-action');
  action.textContent = isHidden ? '+' : '×';
  action.title = isHidden ? `Вернуть «${service.name}»` : `Скрыть «${service.name}»`;
  // Кнопка не должна начинать перетаскивание.
  action.addEventListener('pointerdown', (event) => event.stopPropagation());
  action.addEventListener('click', () => toggleHidden(id, !isHidden));

  if (isHidden) {
    // Скрытую плитку нельзя ни открыть, ни тащить — и в табуляцию она попадать не должна.
    openButton.disabled = true;
  } else {
    tile.addEventListener('pointerdown', onPointerDown);
    // Нативная кнопка сама отрабатывает Enter и Пробел — свой keydown больше не нужен.
    openButton.addEventListener('click', (event) => open(service, event.ctrlKey || event.metaKey));
  }
  return tile;
}

function open(service, background) {
  if (editing) return; // в режиме правки плитка только перетаскивается
  // Ctrl/Cmd — открыть в фоновой вкладке и не закрывать popup.
  chrome.tabs.create({ url: serviceUrl(service, settings.accountIndex), active: !background });
  if (!background) window.close();
}

function renderZones() {
  const hidden = new Set(settings.hidden);

  for (const [zone, ids] of [[els.favorites, settings.favorites], [els.others, settings.others]]) {
    zone.textContent = '';
    for (const id of ids) {
      if (hidden.has(id)) continue;
      const tile = makeTile(id);
      if (tile) zone.append(tile);
    }
  }

  // Скрытые плитки показываем только в режиме правки — иначе их не вернуть.
  els.hidden.textContent = '';
  const hiddenIds = [...settings.favorites, ...settings.others].filter((id) => hidden.has(id));
  for (const id of hiddenIds) {
    const tile = makeTile(id, { isHidden: true });
    if (tile) els.hidden.append(tile);
  }
  els.hiddenSection.hidden = !editing || hiddenIds.length === 0;

  if (!els.favorites.children.length && !els.others.children.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = editing
      ? 'Все плитки скрыты — верните нужные кнопкой «+».'
      : 'Все плитки скрыты — нажмите карандаш, чтобы вернуть.';
    els.others.append(empty);
  }
}

function formatAgo(ts) {
  if (!ts) return 'нет данных';
  const sec = Math.round((Date.now() - ts) / 1000);
  if (sec < 60) return 'только что';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} мин назад`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours} ч назад`;
  return `${Math.round(hours / 24)} дн назад`;
}

function plural(n, one, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  return mod10 === 1 && mod100 !== 11 ? one : many;
}

function renderStatus() {
  els.status.classList.remove('actionable');
  els.status.onclick = null;

  if (!settings.showCounter || state.authState === 'off') {
    els.status.hidden = true;
    return;
  }
  els.status.hidden = false;

  if (state.authState === 'signed_out') {
    els.status.textContent = 'Войдите в Gmail в этом браузере';
    els.status.classList.add('actionable');
    els.status.onclick = () => {
      chrome.tabs.create({ url: `https://mail.google.com/mail/u/${settings.accountIndex}/` });
      window.close();
    };
    return;
  }

  if (state.error) {
    els.status.textContent = 'Не удалось обновить · повторить';
    els.status.classList.add('actionable');
    els.status.onclick = () => refresh(true);
    return;
  }

  const suffix = state.capped ? '+' : '';
  const word = plural(state.count, 'непрочитанное', 'непрочитанных');
  els.status.textContent = state.count === 0
    ? `Непрочитанных нет · ${formatAgo(state.lastSync)}`
    : `${state.count}${suffix} ${word} · ${scopeLabel(settings)} · ${formatAgo(state.lastSync)}`;
}

function render() {
  renderZones();
  renderStatus();
}

/* ---------- скрытие плиток ---------- */

async function toggleHidden(id, hide) {
  const next = hide
    ? settings.hidden.concat(id)
    : settings.hidden.filter((x) => x !== id);
  await saveSettings({ hidden: next });
  renderZones();
}

/* ---------- перетаскивание ---------- */

function onPointerDown(event) {
  if (!editing || event.button !== 0) return;
  if (drag) endDrag(); // второй палец/кнопка не должен оставить предыдущий перенос висеть
  const tile = event.currentTarget;
  const rect = tile.getBoundingClientRect();
  drag = {
    tile,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    grabX: event.clientX - rect.left,
    grabY: event.clientY - rect.top,
    width: rect.width,
    height: rect.height,
    x: event.clientX,
    y: event.clientY,
    clone: null,
    frame: 0,
    layout: null,
  };
  // Слушаем на window, а не на плитке: перестановка переносит плитку в DOM, а перенос
  // снимает pointer capture и уводит дальнейшие pointermove/pointerup на элемент под
  // курсором. На самой плитке события после первой перестановки просто переставали
  // приходить — перенос замирал и не завершался.
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
}

function startDrag() {
  const clone = drag.tile.cloneNode(true);
  clone.classList.add('floating');
  clone.style.width = `${drag.width}px`;
  clone.style.height = `${drag.height}px`;
  document.body.append(clone);
  drag.clone = clone;
  drag.tile.classList.add('source');
}

/**
 * Замеряем не плитки, а занятые ими ячейки сетки: пока число плиток в зоне не менялось,
 * ячейки стоят на месте, сколько бы перестановок ни случилось. Замер по самим плиткам
 * приходилось сбрасывать после каждой перестановки, и следующий кадр видел уже сдвинутых
 * соседей — ближайшая цель менялась обратно, и плитка дёргалась между двумя местами.
 */
function layout() {
  if (drag.layout) return drag.layout;
  drag.layout = [els.favorites, els.others].map((zone) => ({
    zone,
    rect: zone.getBoundingClientRect(),
    cells: [...zone.children].filter((el) => el.dataset.id).map((el) => el.getBoundingClientRect()),
  }));
  return drag.layout;
}

/** Зона под курсором; если курсор вне обеих — ближайшая по вертикали. */
function zoneAt(y) {
  const zones = layout();
  let nearest = zones[0];
  let nearestGap = Infinity;

  for (const entry of zones) {
    if (y >= entry.rect.top && y <= entry.rect.bottom) return entry;
    const gap = y < entry.rect.top ? entry.rect.top - y : y - entry.rect.bottom;
    if (gap < nearestGap) {
      nearestGap = gap;
      nearest = entry;
    }
  }
  return nearest;
}

/**
 * Переставляет исходную плитку в DOM. Цель считается по замеренным ячейкам, а не через
 * elementFromPoint: попадание в зазор между плитками тоже должно срабатывать.
 * Возвращает true, если плитка сменила зону — только тогда замер ячеек устаревает.
 */
function reorderTo(x, y) {
  const entry = zoneAt(y);
  const sameZone = drag.tile.parentElement === entry.zone;
  const rest = [...entry.zone.children].filter((el) => el.dataset.id && el !== drag.tile);

  if (sameZone && !rest.length) return false;

  let index = 0;
  if (entry.cells.length) {
    let nearest = 0;
    let best = Infinity;
    for (let i = 0; i < entry.cells.length; i++) {
      const rect = entry.cells[i];
      const distance = Math.hypot(x - (rect.left + rect.width / 2), y - (rect.top + rect.height / 2));
      if (distance < best) {
        best = distance;
        nearest = i;
      }
    }
    // Своя ячейка уже занята плиткой; в чужой зоне она добавится — решаем, до или после.
    const rect = entry.cells[nearest];
    index = sameZone ? nearest : nearest + (x > rect.left + rect.width / 2 ? 1 : 0);
  }

  const ref = rest[index] ?? null;
  // Плитка уже стоит на этом месте — DOM не трогаем, иначе кадр уходит в перерасчёт.
  if (sameZone && drag.tile.nextSibling === ref) return false;

  entry.zone.insertBefore(drag.tile, ref);
  return !sameZone;
}

function autoScroll(y) {
  const rect = els.scroller.getBoundingClientRect();
  const before = els.scroller.scrollTop;
  if (y < rect.top + AUTOSCROLL_EDGE_PX) els.scroller.scrollTop -= AUTOSCROLL_STEP_PX;
  else if (y > rect.bottom - AUTOSCROLL_EDGE_PX) els.scroller.scrollTop += AUTOSCROLL_STEP_PX;
  return els.scroller.scrollTop !== before;
}

/** Вся визуальная работа — один раз за кадр, сколько бы ни пришло pointermove. */
function onFrame() {
  if (!drag) return;
  drag.frame = 0;
  if (!drag.clone) return;

  const { x, y } = drag;
  drag.clone.style.translate = `${x - drag.grabX}px ${y - drag.grabY}px`;

  const scrolled = autoScroll(y);
  if (scrolled) drag.layout = null;
  if (reorderTo(x, y)) drag.layout = null; // зона сменилась — ячейки пересчитаются заново
  if (scrolled) scheduleFrame(); // прокрутка продолжается, пока курсор у края
}

function scheduleFrame() {
  if (drag.frame) return;
  drag.frame = requestAnimationFrame(onFrame);
}

function onPointerMove(event) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  drag.x = event.clientX;
  drag.y = event.clientY;

  if (!drag.clone) {
    const moved = Math.hypot(drag.x - drag.startX, drag.y - drag.startY);
    if (moved < DRAG_THRESHOLD_PX) return;
    startDrag();
  }

  event.preventDefault();
  scheduleFrame();
}

/** Снимает слушатели и следы переноса. Возвращает true, если плитку действительно тащили. */
function endDrag() {
  const { tile, clone, frame } = drag;

  if (frame) cancelAnimationFrame(frame);
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerUp);

  drag = null;
  if (!clone) return false; // обычный клик, не перетаскивание

  clone.remove();
  tile.classList.remove('source');
  return true;
}

function onPointerUp(event) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  if (endDrag()) persistOrder();
}

/** Скрытые плитки в DOM не попадают — дописываем их в конец своих списков. */
function zoneIds(zone) {
  return [...zone.children].map((el) => el.dataset.id).filter(Boolean);
}

function persistOrder() {
  const hidden = new Set(settings.hidden);
  return saveSettings({
    favorites: zoneIds(els.favorites).concat(settings.favorites.filter((id) => hidden.has(id))),
    others: zoneIds(els.others).concat(settings.others.filter((id) => hidden.has(id))),
  });
}

/* ---------- режим правки и обновление ---------- */

function setEditing(on) {
  editing = on;
  document.body.classList.toggle('editing', on);
  els.hint.hidden = !on;
  els.edit.title = on ? 'Готово' : 'Изменить порядок';
  renderZones();
}

async function refresh(force) {
  try {
    const res = await send({ type: 'refresh', force });
    if (res?.error) throw new Error(res.error);
    if (res?.state) {
      state = res.state;
      render();
    }
  } catch (err) {
    // Через state, а не showError: renderStatus вернёт кликабельное «повторить»,
    // а в узкой строке футера оно полезнее текста ошибки.
    state = { ...state, error: String(err?.message ?? err) };
    render();
  }
}

els.edit.addEventListener('click', () => setEditing(!editing));
els.options.addEventListener('click', () => chrome.runtime.openOptionsPage());

// Живое обновление, если фоновый опрос отработал при открытом popup.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.state?.newValue) {
    state = changes.state.newValue;
    if (drag) renderStatus(); // не перерисовываем сетку под перетаскиванием
    else render();
  }
});

/** Сетка важнее счётчика: popup должен открыться, даже если service worker не ответил. */
async function loadInitial() {
  try {
    const res = await send({ type: 'getState' });
    if (res?.settings && res?.state) return res;
  } catch (err) {
    return { settings: await settingsFallback(), state: failedState(err) };
  }
  return { settings: await settingsFallback(), state: failedState(new Error('нет ответа')) };
}

async function settingsFallback() {
  try {
    return await getSettings();
  } catch {
    return { ...DEFAULTS, favorites: DEFAULTS.favorites.slice(), others: DEFAULTS.others.slice() };
  }
}

const failedState = (err) => ({
  count: 0,
  capped: false,
  total: 0,
  lastSync: 0,
  error: String(err?.message ?? err),
  authState: 'unknown',
});

(async function init() {
  const res = await loadInitial();
  settings = res.settings;
  state = res.state;
  render();
  if (settings.showCounter) await refresh(false); // троттлится в background
})();
