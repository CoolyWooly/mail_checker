// Скачивает официальные иконки сервисов Google в icons/services/*.png.
//
// Источники закреплены явно: у большинства продуктов это логотипы с gstatic
// (192×192 после ретины), у Colab и AI Studio своих записей там нет, поэтому
// берутся их собственные фавиконки. Запускать нужно вручную и редко —
// иконки лежат в репозитории, расширение ничего не тянет из сети.
import { writeFile, mkdir } from 'node:fs/promises';

const OUT = new URL('../icons/services/', import.meta.url);

// gstatic отдаёт логотипы продуктов по предсказуемому пути; 2x/96dp = 192×192.
const product = (name) => `https://www.gstatic.com/images/branding/product/2x/${name}.png`;

const SOURCES = {
  account: product('avatar_circle_grey_96dp'),
  gmail: product('gmail_2020q4_96dp'),
  calendar: product('calendar_2020q4_96dp'),
  drive: product('drive_2020q4_96dp'),
  docs: product('docs_2020q4_96dp'),
  sheets: product('sheets_2020q4_96dp'),
  slides: product('slides_2020q4_96dp'),
  forms: product('forms_2020q4_96dp'),
  keep: product('keep_2020q4_96dp'),
  gemini: product('gemini_96dp'),

  meet: product('meet_2020q4_96dp'),
  chat: product('chat_2020q4_96dp'),
  contacts: product('contacts_96dp'),
  groups: product('groups_96dp'),
  tasks: product('tasks_96dp'),

  youtube: product('youtube_96dp'),
  maps: product('maps_96dp'),
  photos: product('photos_96dp'),
  translate: product('translate_96dp'),
  news: product('news_96dp'),
  search: 'https://www.gstatic.com/images/branding/googleg/2x/googleg_standard_color_128dp.png',
  play: product('play_96dp'),

  cloud: product('cloud_96dp'),
  colab: 'https://colab.research.google.com/img/colab_favicon_256px.png',
  aistudio: 'https://www.google.com/s2/favicons?domain=aistudio.google.com&sz=128',
  analytics: product('analytics_96dp'),
};

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

async function fetchIcon(id, url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (!bytes.subarray(0, 4).equals(PNG_MAGIC)) throw new Error('ответ не PNG');
  await writeFile(new URL(`${id}.png`, OUT), bytes);
  return bytes.length;
}

await mkdir(OUT, { recursive: true });

const failed = [];
for (const [id, url] of Object.entries(SOURCES)) {
  try {
    const size = await fetchIcon(id, url);
    console.log(`${id.padEnd(10)} ${String(size).padStart(6)} B  ${url}`);
  } catch (err) {
    failed.push(id);
    console.error(`${id.padEnd(10)} ОШИБКА: ${err.message}  ${url}`);
  }
}

if (failed.length) {
  console.error(`\nНе скачано: ${failed.join(', ')}`);
  process.exit(1);
}
console.log(`\nГотово: ${Object.keys(SOURCES).length} иконок в icons/services/`);
