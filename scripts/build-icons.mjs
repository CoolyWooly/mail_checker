// Растеризует иконку расширения (сетка 3x3) в PNG 16/32/48/128.
// Без внешних зависимостей: рисуем круги сами, кодируем PNG через zlib.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = new URL('../icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const SS = 4; // суперсэмплинг для сглаживания краёв
const GRID = [
  [34, 34, '#4285F4'], [64, 34, '#EA4335'], [94, 34, '#FBBC04'],
  [34, 64, '#34A853'], [64, 64, '#4285F4'], [94, 64, '#EA4335'],
  [34, 94, '#FBBC04'], [64, 94, '#34A853'], [94, 94, '#4285F4'],
];
const R = 11;      // радиус кружка в координатах 128x128
const RADIUS = 26; // скругление подложки

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));

function insideRoundedRect(x, y, size, radius) {
  if (x < 0 || y < 0 || x > size || y > size) return false;
  const cx = Math.min(Math.max(x, radius), size - radius);
  const cy = Math.min(Math.max(y, radius), size - radius);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function renderRGBA(size) {
  const scale = size / 128;
  const w = size * SS;
  const pixels = new Uint8Array(w * w * 4);
  const dots = GRID.map(([cx, cy, color]) => ({
    cx: cx * scale,
    cy: cy * scale,
    r: R * scale,
    rgb: hex(color),
  }));
  const radius = RADIUS * scale;

  for (let py = 0; py < w; py += 1) {
    for (let px = 0; px < w; px += 1) {
      const x = (px + 0.5) / SS;
      const y = (py + 0.5) / SS;
      const i = (py * w + px) * 4;

      if (!insideRoundedRect(x, y, size, radius)) continue;

      // подложка — белая
      let [r, g, b] = [255, 255, 255];
      for (const dot of dots) {
        const dx = x - dot.cx;
        const dy = y - dot.cy;
        if (dx * dx + dy * dy <= dot.r * dot.r) {
          [r, g, b] = dot.rgb;
          break;
        }
      }
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = 255;
    }
  }
  return downsample(pixels, w, size);
}

/** Усредняет SS*SS блок в один пиксель — даёт сглаженные края. */
function downsample(src, srcSize, size) {
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const i = ((y * SS + sy) * srcSize + (x * SS + sx)) * 4;
          const alpha = src[i + 3] / 255;
          r += src[i] * alpha;
          g += src[i + 1] * alpha;
          b += src[i + 2] * alpha;
          a += alpha;
        }
      }
      const o = (y * size + x) * 4;
      if (a > 0) {
        out[o] = Math.round(r / a);
        out[o + 1] = Math.round(g / a);
        out[o + 2] = Math.round(b / a);
      }
      out[o + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  return out;
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(rgba, size) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: None
    Buffer.from(rgba.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [16, 32, 48, 128]) {
  const png = encodePNG(renderRGBA(size), size);
  writeFileSync(new URL(`icon${size}.png`, OUT), png);
  console.log(`icon${size}.png — ${png.length} байт`);
}
