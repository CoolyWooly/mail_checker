// Рендерит картинки для страницы в Chrome Web Store: store/templates/*.html → store/images/*.png.
// Шаблоны встраивают превью из dev/, поэтому перед запуском их нужно пересобрать
// (`npm run build:store-assets` делает это сам).
// Без зависимостей: свой статический сервер и Chrome в headless-режиме через DevTools Protocol.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = new URL('../store/images/', import.meta.url);

// Холст в CSS-пикселях и плотность: файл выходит (width × scale) на (height × scale).
// Скриншоты рисуются на 1024×640 с плотностью 1.25 — popup получается крупнее и остаётся
// чётким, а магазин получает ровно 1280×800.
const ASSETS = [
  { page: 'screenshot-1-popup', width: 1024, height: 640, scale: 1.25 },
  { page: 'screenshot-2-edit', width: 1024, height: 640, scale: 1.25 },
  { page: 'screenshot-3-options', width: 1024, height: 640, scale: 1.25 },
  { page: 'screenshot-4-dark', width: 1024, height: 640, scale: 1.25 },
  { page: 'promo-small', width: 440, height: 280, scale: 1 },
];

const READY_TIMEOUT_MS = 15_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function serve() {
  const server = createServer(async (req, res) => {
    // normalize схлопывает «..», поэтому путь не выйдет за корень репозитория.
    const file = join(ROOT, normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const found = candidates.find((path) => existsSync(path));
  if (!found) throw new Error('Chrome не найден — укажите путь к нему в CHROME_PATH');
  return found;
}

async function launchChrome() {
  const profile = await mkdtemp(join(tmpdir(), 'store-assets-'));
  const proc = spawn(findChrome(), [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--force-color-profile=srgb', // иначе цвета зависят от профиля монитора
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  const wsUrl = await new Promise((resolve, reject) => {
    let log = '';
    proc.stderr.on('data', (chunk) => {
      log += chunk;
      const match = log.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) resolve(match[1]);
    });
    proc.on('exit', (code) => reject(new Error(`Chrome завершился с кодом ${code}:\n${log}`)));
  });
  return { proc, profile, wsUrl };
}

/** Минимальный клиент DevTools Protocol: команда → промис с ответом. */
async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error(`нет соединения с ${wsUrl}`));
  });
  const pending = new Map();
  let seq = 0;
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    const call = pending.get(msg.id);
    if (!call) return; // события не нужны
    pending.delete(msg.id);
    if (msg.error) call.reject(new Error(`${call.method}: ${msg.error.message}`));
    else call.resolve(msg.result);
  };
  const send = (method, params = {}, sessionId = undefined) => new Promise((resolve, reject) => {
    seq += 1;
    pending.set(seq, { resolve, reject, method });
    ws.send(JSON.stringify({ id: seq, method, params, sessionId }));
  });
  return { send, close: () => ws.close() };
}

/** Ждёт data-ready от common.js именно на этой странице, а не на предыдущей. */
async function waitReady(page, name) {
  const expression = `location.pathname.endsWith('/${name}.html') ? (document.documentElement.dataset.ready ?? '') : ''`;
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    // Пока идёт навигация, контекст страницы может смениться прямо во время вызова.
    const value = await page('Runtime.evaluate', { expression, returnByValue: true })
      .then(({ result }) => result.value, () => '');
    if (value === 'ok') return;
    if (value) throw new Error(`${name}: ${value}`);
    await sleep(100);
  }
  throw new Error(`${name}: страница не сообщила о готовности за ${READY_TIMEOUT_MS / 1000} с`);
}

const server = await serve();
const origin = `http://127.0.0.1:${server.address().port}`;
const chrome = await launchChrome();

try {
  const cdp = await connect(chrome.wsUrl);
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const page = (method, params) => cdp.send(method, params, sessionId);

  await mkdir(OUT, { recursive: true });
  for (const { page: name, width, height, scale } of ASSETS) {
    await page('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
    await page('Page.navigate', { url: `${origin}/store/templates/${name}.html` });
    await waitReady(page, name);
    const { data } = await page('Page.captureScreenshot', { format: 'png' });
    await writeFile(new URL(`${name}.png`, OUT), Buffer.from(data, 'base64'));
    console.log(`store/images/${name}.png — ${width * scale}×${height * scale}`);
  }

  cdp.close();
} finally {
  // Профиль удаляем только после выхода Chrome, иначе он допишет туда файлы.
  const exited = new Promise((resolve) => chrome.proc.once('exit', resolve));
  if (chrome.proc.exitCode === null) {
    chrome.proc.kill();
    await exited;
  }
  server.close();
  await rm(chrome.profile, { recursive: true, force: true });
}
