// Счётчик непрочитанных писем через Atom-фид Gmail.
// Работает на сессии браузера (куки Google), без OAuth и без Cloud Console.
// Фид отдаёт точное общее число (<fullcount>) и максимум 20 последних писем,
// поэтому фильтр по дате точен, только пока непрочитанных не больше 20.

export const FEED_ENTRY_LIMIT = 20;
const FETCH_TIMEOUT_MS = 15_000;
const DAY_MS = 86_400_000;

export class GmailError extends Error {
  constructor(message, { status = 0, retryable = false, needsLogin = false } = {}) {
    super(message);
    this.name = 'GmailError';
    this.status = status;
    this.retryable = retryable;
    this.needsLogin = needsLogin;
  }
}

export function feedUrl({ accountIndex = 0, label = '' } = {}) {
  // Значение приходит из настроек уже зажатым, но функция экспортирована — подстраховываемся,
  // чтобы в путь URL нельзя было подставить произвольную строку.
  const account = Math.max(0, Number(accountIndex) | 0);
  const base = `https://mail.google.com/mail/u/${account}/feed/atom`;
  return label ? `${base}/${encodeURIComponent(label)}` : base;
}

/**
 * Дата каждого письма: <issued> есть всегда, <modified> — запасной вариант.
 * Ищем строго внутри <entry>: у самого фида тоже есть <modified>, и он всегда свежий —
 * из-за него счётчик за любой период показывал минимум одно «письмо».
 */
export function entryDates(xml) {
  return [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/g)]
    .map(([, entry]) => {
      const date = entry.match(/<issued>([^<]+)<\/issued>/)
        ?? entry.match(/<modified>([^<]+)<\/modified>/);
      return date ? Date.parse(date[1]) : NaN;
    })
    .filter((ts) => Number.isFinite(ts));
}

/**
 * Загружает фид. Без таймаута зависшее соединение не reject-ится никогда, а вызывающий
 * background держит на нём защёлку `refreshing` — счётчик замирал навсегда.
 */
async function loadFeed(url) {
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, { credentials: 'include', cache: 'no-store', signal });
  } catch (err) {
    throw networkError(err);
  }

  if (res.status === 401 || res.status === 403) {
    throw new GmailError('Нет активной сессии Gmail', { status: res.status, needsLogin: true });
  }
  if (!res.ok) {
    throw new GmailError(`HTTP ${res.status}`, {
      status: res.status,
      retryable: res.status === 429 || res.status >= 500,
    });
  }

  try {
    return await res.text();
  } catch (err) {
    // Таймаут может сработать и на чтении тела — оно тоже под тем же signal.
    throw networkError(err);
  }
}

function networkError(err) {
  const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
  const message = timedOut
    ? `Gmail не ответил за ${FETCH_TIMEOUT_MS / 1000} с`
    : `Сеть недоступна: ${err?.message ?? err}`;
  return new GmailError(message, { retryable: true });
}

/**
 * Возвращает { count, capped, total }.
 * `capped` — писем могло быть больше, чем видно в фиде (показываем «N+»).
 */
export async function fetchUnread(settings) {
  const xml = await loadFeed(feedUrl(settings));

  // Разлогиненному пользователю Gmail отдаёт HTML страницы входа со статусом 200.
  if (!xml.includes('<feed')) {
    throw new GmailError('Нужно войти в Gmail в этом браузере', { needsLogin: true });
  }

  const totalMatch = xml.match(/<fullcount>(\d+)<\/fullcount>/);
  const total = totalMatch ? Number(totalMatch[1]) : 0;

  if (settings.days <= 0) {
    return { count: total, capped: false, total };
  }

  const cutoff = Date.now() - settings.days * DAY_MS;
  const dates = entryDates(xml);
  const fresh = dates.filter((ts) => ts >= cutoff).length;

  // Все видимые письма попали в окно, а всего их больше — точное число неизвестно.
  // Без проверки на непустой список нераспарсенные даты давали «0+»: capped при count 0.
  const capped = dates.length > 0
    && fresh >= Math.min(dates.length, FEED_ENTRY_LIMIT)
    && total > dates.length;

  return { count: fresh, capped, total };
}
