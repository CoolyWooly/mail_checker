// Генерирует dev/preview-*.html из src/*.html.
// Раньше превью были ручными копиями разметки, и любая правка шаблона плитки требовала
// повторить её во втором файле — рано или поздно они бы разошлись.
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = new URL('../src/', import.meta.url);
const OUT = new URL('../dev/', import.meta.url);

const BANNER = '<!-- Сгенерировано scripts/build-previews.mjs из src/. Не править вручную. -->\n';

// Метка сборки в query: браузер иначе отдаёт из кэша прошлые src/*.js и chrome-stub.js,
// и правка не видна без ручного hard-reload.
const V = Date.now();

function build(page) {
  const html = readFileSync(new URL(`${page}.html`, SRC), 'utf8');
  const out = html
    // Стили и модули лежат в src/, а страница — в dev/.
    .replace(/(href|src)="(?!\.\.\/|https?:)([^"]+)"/g, `$1="../src/$2?v=${V}"`)
    // Заглушка Chrome API должна успеть выполниться до модуля страницы.
    .replace(
      /\n([ \t]*)<script type="module"/,
      `\n$1<script src="chrome-stub.js?v=${V}"></script>\n$1<script type="module"`,
    );
  writeFileSync(new URL(`preview-${page}.html`, OUT), BANNER + out);
  console.log(`dev/preview-${page}.html`);
}

for (const page of ['popup', 'options']) build(page);
