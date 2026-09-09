import test from 'node:test';
import assert from 'node:assert/strict';

import { feedUrl, entryDates, fetchUnread, GmailError, FEED_ENTRY_LIMIT } from '../src/gmail.js';

const entry = (issued) => `<entry><title>t</title><issued>${issued}</issued></entry>`;
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString();

const feed = (fullcount, issued) => `<?xml version="1.0"?><feed>`
  + `<title>Gmail</title><modified>${new Date().toISOString()}</modified>`
  + `<fullcount>${fullcount}</fullcount>${issued.map(entry).join('')}</feed>`;

function withFetch(impl, run) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return run().finally(() => { globalThis.fetch = original; });
}

const ok = (body) => async () => new Response(body, { status: 200 });

test('feedUrl: номер аккаунта и метка', () => {
  assert.equal(feedUrl({}), 'https://mail.google.com/mail/u/0/feed/atom');
  assert.equal(feedUrl({ accountIndex: 3 }), 'https://mail.google.com/mail/u/3/feed/atom');
  assert.equal(
    feedUrl({ accountIndex: 1, label: 'Мои письма/важное' }),
    'https://mail.google.com/mail/u/1/feed/atom/%D0%9C%D0%BE%D0%B8%20%D0%BF%D0%B8%D1%81%D1%8C%D0%BC%D0%B0%2F%D0%B2%D0%B0%D0%B6%D0%BD%D0%BE%D0%B5',
  );
});

test('feedUrl: мусорный accountIndex не попадает в путь', () => {
  assert.equal(feedUrl({ accountIndex: '0/../evil' }), 'https://mail.google.com/mail/u/0/feed/atom');
  assert.equal(feedUrl({ accountIndex: -7 }), 'https://mail.google.com/mail/u/0/feed/atom');
});

test('entryDates: <modified> самого фида не считается письмом', () => {
  const xml = feed(0, []);
  assert.deepEqual(entryDates(xml), []);
});

test('entryDates: берёт <issued> каждого письма', () => {
  const xml = feed(2, ['2026-09-01T10:00:00Z', '2026-08-30T10:00:00Z']);
  assert.deepEqual(entryDates(xml), [
    Date.parse('2026-09-01T10:00:00Z'),
    Date.parse('2026-08-30T10:00:00Z'),
  ]);
});

test('fetchUnread: период 0 отдаёт точный fullcount', () => withFetch(
  ok(feed(43, [daysAgo(0)])),
  async () => {
    assert.deepEqual(await fetchUnread({ days: 0 }), { count: 43, capped: false, total: 43 });
  },
));

test('fetchUnread: фильтр по дате отбрасывает старые письма', () => withFetch(
  ok(feed(3, [daysAgo(0), daysAgo(1), daysAgo(9)])),
  async () => {
    const res = await fetchUnread({ days: 2 });
    assert.deepEqual(res, { count: 2, capped: false, total: 3 });
  },
));

test('fetchUnread: capped, когда все видимые письма в окне, а всего их больше', () => withFetch(
  ok(feed(50, Array.from({ length: FEED_ENTRY_LIMIT }, () => daysAgo(0)))),
  async () => {
    const res = await fetchUnread({ days: 2 });
    assert.deepEqual(res, { count: FEED_ENTRY_LIMIT, capped: true, total: 50 });
  },
));

test('fetchUnread: нераспарсенные даты не дают capped при count 0', () => withFetch(
  ok(`<feed><fullcount>30</fullcount><entry><title>t</title></entry></feed>`),
  async () => {
    const res = await fetchUnread({ days: 2 });
    assert.deepEqual(res, { count: 0, capped: false, total: 30 });
  },
));

test('fetchUnread: HTML страницы входа вместо фида — needsLogin', () => withFetch(
  ok('<html><body>Sign in</body></html>'),
  async () => {
    await assert.rejects(fetchUnread({ days: 0 }), (err) => {
      assert.ok(err instanceof GmailError);
      assert.equal(err.needsLogin, true);
      return true;
    });
  },
));

test('fetchUnread: 401 — needsLogin, 503 — retryable', async () => {
  await withFetch(async () => new Response('', { status: 401 }), async () => {
    await assert.rejects(fetchUnread({ days: 0 }), (err) => err.needsLogin === true);
  });
  await withFetch(async () => new Response('', { status: 503 }), async () => {
    await assert.rejects(fetchUnread({ days: 0 }), (err) => err.retryable === true);
  });
  await withFetch(async () => new Response('', { status: 404 }), async () => {
    await assert.rejects(fetchUnread({ days: 0 }), (err) => err.retryable === false);
  });
});

test('fetchUnread: обрыв сети — retryable GmailError', () => withFetch(
  async () => { throw new TypeError('Failed to fetch'); },
  async () => {
    await assert.rejects(fetchUnread({ days: 0 }), (err) => {
      assert.ok(err instanceof GmailError);
      assert.equal(err.retryable, true);
      return true;
    });
  },
));

test('fetchUnread: таймаут — retryable GmailError, а не зависание', () => withFetch(
  async (_url, { signal }) => {
    const err = new Error('timed out');
    err.name = 'TimeoutError';
    assert.ok(signal, 'fetch должен вызываться с AbortSignal');
    throw err;
  },
  async () => {
    await assert.rejects(fetchUnread({ days: 0 }), (err) => {
      assert.ok(err instanceof GmailError);
      assert.equal(err.retryable, true);
      assert.match(err.message, /не ответил/);
      return true;
    });
  },
));
