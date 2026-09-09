// Схема настроек, значения по умолчанию и доступ к chrome.storage.sync.

import { ALL_SERVICE_IDS } from './services.js';

/** Стартовое «Избранное» — ровно 3 ряда по 3 плитки. */
export const DEFAULT_FAVORITES = [
  'account', 'gmail', 'drive',
  'calendar', 'docs', 'sheets',
  'gemini', 'youtube', 'maps',
];

export const DEFAULTS = {
  showCounter: true,
  days: 2,
  label: '',
  pollMinutes: 5,
  accountIndex: 0,
  favorites: DEFAULT_FAVORITES.slice(),
  others: ALL_SERVICE_IDS.filter((id) => !DEFAULT_FAVORITES.includes(id)),
  hidden: [],
};

export const LIMITS = {
  days: { min: 0, max: 30 },
  pollMinutes: { min: 1, max: 240 },
  accountIndex: { min: 0, max: 9 },
};

function clampInt(value, fallback, { min, max }) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Оставляет только известные id, без повторов и в исходном порядке. */
function cleanIds(list) {
  if (!Array.isArray(list)) return null;
  const seen = new Set();
  return list.filter((id) => {
    if (!ALL_SERVICE_IDS.includes(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/** Приводит произвольный объект из storage к валидным настройкам. */
export function normalize(raw = {}) {
  const favorites = cleanIds(raw.favorites) ?? DEFAULTS.favorites.slice();
  const inFavorites = new Set(favorites);

  // Остальные плитки: сохранённый порядок + всё, что появилось в новых версиях.
  const saved = (cleanIds(raw.others) ?? []).filter((id) => !inFavorites.has(id));
  const known = new Set([...favorites, ...saved]);
  const others = saved.concat(ALL_SERVICE_IDS.filter((id) => !known.has(id)));

  return {
    showCounter: raw.showCounter !== false,
    days: clampInt(raw.days, DEFAULTS.days, LIMITS.days),
    label: typeof raw.label === 'string' ? raw.label.trim().slice(0, 64) : '',
    pollMinutes: clampInt(raw.pollMinutes, DEFAULTS.pollMinutes, LIMITS.pollMinutes),
    accountIndex: clampInt(raw.accountIndex, DEFAULTS.accountIndex, LIMITS.accountIndex),
    favorites,
    others,
    hidden: cleanIds(raw.hidden) ?? [],
  };
}

export async function getSettings() {
  const raw = await chrome.storage.sync.get(DEFAULTS);
  return normalize(raw);
}

export async function setSettings(patch) {
  const current = await getSettings();
  const next = normalize({ ...current, ...patch });
  await chrome.storage.sync.set(next);
  return next;
}

/** Описание того, что именно считает счётчик — для подсказок в интерфейсе. */
export function scopeLabel({ days, label }) {
  const where = label ? `метка «${label}»` : 'Входящие';
  return days > 0 ? `${where} · за ${days} дн.` : `${where} · все непрочитанные`;
}
