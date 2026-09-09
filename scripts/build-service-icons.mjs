// Генерирует icons/services/*.svg — упрощённые фирменные глифы, по одному на сервис.
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = new URL('../icons/services/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const doc = (id) => `<path fill="${id}" d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path fill="#fff" fill-opacity=".45" d="M14 2l5 5h-5z"/>`;

const ICONS = {
  account:
    '<circle cx="12" cy="12" r="9.5" fill="#5F6368"/>' +
    '<circle cx="12" cy="9.6" r="3.4" fill="#fff"/>' +
    '<path fill="#fff" d="M12 14c-3 0-5.6 1.6-6.6 3.9a9.5 9.5 0 0 0 13.2 0C17.6 15.6 15 14 12 14z"/>',

  gemini:
    '<defs><linearGradient id="gem" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#4285F4"/><stop offset=".5" stop-color="#9B72CB"/>' +
    '<stop offset="1" stop-color="#D96570"/></linearGradient></defs>' +
    '<path fill="url(#gem)" d="M12 2.2c.5 4.6 3.2 7.3 7.8 7.8-4.6.5-7.3 3.2-7.8 7.8-.5-4.6-3.2-7.3-7.8-7.8C8.8 9.5 11.5 6.8 12 2.2z" transform="translate(0 2)"/>',

  gmail:
    '<path fill="#EA4335" d="M2.5 6.4c0-1 .8-1.9 1.9-1.9.4 0 .8.1 1.1.4L12 9.9l6.5-5c.3-.3.7-.4 1.1-.4 1 0 1.9.8 1.9 1.9v11.2c0 .8-.6 1.4-1.4 1.4h-2.3V9.6L12 13.4 6.2 9.6v9.4H3.9c-.8 0-1.4-.6-1.4-1.4z"/>',

  calendar:
    '<rect x="3" y="3.5" width="18" height="17" rx="2.6" fill="#4285F4"/>' +
    '<rect x="5.2" y="7.6" width="13.6" height="10.8" rx="1.2" fill="#fff"/>' +
    '<text x="12" y="16.4" font-family="Arial, Helvetica, sans-serif" font-size="8" font-weight="700" fill="#4285F4" text-anchor="middle">31</text>',

  drive:
    '<path fill="#FBBC04" d="M12 3 4 16.6h8z"/>' +
    '<path fill="#34A853" d="M12 3l8 13.6h-8z"/>' +
    '<path fill="#4285F4" d="M4 16.6h16l-2 3.6H6z"/>',

  docs:
    doc('#4285F4') +
    '<g fill="#fff"><rect x="7.2" y="11" width="9.6" height="1.4" rx=".7"/><rect x="7.2" y="14" width="9.6" height="1.4" rx=".7"/><rect x="7.2" y="17" width="6.4" height="1.4" rx=".7"/></g>',

  sheets:
    doc('#34A853') +
    '<rect x="7.2" y="11" width="9.6" height="7.8" rx=".8" fill="#fff"/>' +
    '<g fill="#34A853"><rect x="7.2" y="13.4" width="9.6" height="1"/><rect x="7.2" y="15.9" width="9.6" height="1"/><rect x="11.5" y="11" width="1" height="7.8"/></g>',

  slides:
    doc('#FBBC04') +
    '<rect x="7.2" y="11.4" width="9.6" height="6.8" rx=".8" fill="#fff"/>',

  forms:
    doc('#7248B9') +
    '<path d="M8.2 14.9l2.4 2.4 5-5.2" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',

  keep:
    '<rect x="3" y="3" width="18" height="18" rx="4.2" fill="#FBBC04"/>' +
    '<path fill="#fff" d="M12 6a4.3 4.3 0 0 0-2.6 7.7c.4.3.7.8.7 1.3v.5h3.8V15c0-.5.3-1 .7-1.3A4.3 4.3 0 0 0 12 6z"/>' +
    '<rect x="10.1" y="16.4" width="3.8" height="1.6" rx=".8" fill="#fff"/>',

  meet:
    '<rect x="2.5" y="6.6" width="12.6" height="10.8" rx="2.4" fill="#00832D"/>' +
    '<path fill="#00AC47" d="M15.1 10.4l4.9-3.3c.6-.4 1.5 0 1.5.8v8.2c0 .8-.9 1.2-1.5.8l-4.9-3.3z"/>',

  chat:
    '<path fill="#00AC47" d="M3.5 4h17c.8 0 1.5.7 1.5 1.5v9c0 .8-.7 1.5-1.5 1.5H9.6L5 20.2V16H3.5c-.8 0-1.5-.7-1.5-1.5v-9C2 4.7 2.7 4 3.5 4z"/>',

  contacts:
    '<circle cx="12" cy="8.4" r="3.9" fill="#4285F4"/>' +
    '<path fill="#4285F4" d="M12 13.4c-3.9 0-7.1 2.1-7.1 4.8V20h14.2v-1.8c0-2.7-3.2-4.8-7.1-4.8z"/>',

  groups:
    '<circle cx="8.4" cy="8.8" r="3.2" fill="#4285F4"/>' +
    '<circle cx="16.1" cy="9.9" r="2.6" fill="#8AB4F8"/>' +
    '<path fill="#4285F4" d="M8.4 13.5c-3.4 0-6.1 1.8-6.1 4.1V19h12.2v-1.4c0-2.3-2.7-4.1-6.1-4.1z"/>' +
    '<path fill="#8AB4F8" d="M16.1 13.8c-1 0-2 .2-2.9.5 1.2.9 2 2.1 2 3.3V19h6.5v-1.2c0-2-2.5-4-5.6-4z"/>',

  tasks:
    '<circle cx="12" cy="12" r="9" fill="#2684FC"/>' +
    '<path d="M7.9 12.2l2.8 2.8 5.4-5.6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',

  youtube:
    '<rect x="2" y="5" width="20" height="14" rx="4.2" fill="#FF0000"/>' +
    '<path fill="#fff" d="M10 8.7l6.1 3.3L10 15.3z"/>',

  maps:
    '<path fill="#EA4335" d="M12 2a7.1 7.1 0 0 0-7.1 7.1C4.9 14.4 12 22 12 22s7.1-7.6 7.1-12.9A7.1 7.1 0 0 0 12 2z"/>' +
    '<circle cx="12" cy="9.1" r="2.8" fill="#fff"/>',

  photos:
    '<path fill="#FBBC04" d="M12 12V3.5c2.5 0 4.5 2 4.5 4.5S14.5 12 12 12z"/>' +
    '<path fill="#EA4335" d="M12 12h8.5c0 2.5-2 4.5-4.5 4.5S12 14.5 12 12z"/>' +
    '<path fill="#4285F4" d="M12 12v8.5c-2.5 0-4.5-2-4.5-4.5S9.5 12 12 12z"/>' +
    '<path fill="#34A853" d="M12 12H3.5c0-2.5 2-4.5 4.5-4.5S12 9.5 12 12z"/>',

  translate:
    '<rect x="2" y="2" width="20" height="20" rx="4.2" fill="#4285F4"/>' +
    '<text x="8" y="12.4" font-family="Arial, Helvetica, sans-serif" font-size="9" font-weight="700" fill="#fff" text-anchor="middle">A</text>' +
    '<text x="15.6" y="20" font-family="Arial, Helvetica, sans-serif" font-size="9" font-weight="700" fill="#fff" text-anchor="middle">文</text>',

  news:
    '<rect x="2.5" y="4.5" width="19" height="15" rx="2.2" fill="#4285F4"/>' +
    '<rect x="4.6" y="6.6" width="7.4" height="6.4" rx="1" fill="#fff"/>' +
    '<g fill="#fff"><rect x="13.4" y="6.6" width="6" height="1.4" rx=".7"/><rect x="13.4" y="9.4" width="6" height="1.4" rx=".7"/><rect x="13.4" y="12.2" width="6" height="1.4" rx=".7"/><rect x="4.6" y="15" width="14.8" height="1.4" rx=".7"/></g>',

  search:
    '<g fill="none" stroke-width="2.6" stroke-linecap="round">' +
    '<path stroke="#EA4335" d="M10.5 4.5a6 6 0 0 1 6 6"/>' +
    '<path stroke="#FBBC04" d="M16.5 10.5a6 6 0 0 1-6 6"/>' +
    '<path stroke="#34A853" d="M10.5 16.5a6 6 0 0 1-6-6"/>' +
    '<path stroke="#4285F4" d="M4.5 10.5a6 6 0 0 1 6-6"/>' +
    '<path stroke="#5F6368" d="M15.2 15.2l4.6 4.6"/></g>',

  play:
    '<path fill="#34A853" d="M4.5 2.8L16.4 12H4.5z"/>' +
    '<path fill="#EA4335" d="M4.5 12h11.9L4.5 21.2z"/>' +
    '<path fill="#FBBC04" d="M16.4 12l3.5-2.1v4.2z"/>',

  cloud:
    '<path fill="#4285F4" d="M17.9 10.2a6.1 6.1 0 0 0-11.8-1.3A4.6 4.6 0 0 0 7 18.1h10.6a4 4 0 0 0 .3-7.9z"/>',

  colab:
    '<g fill="none" stroke="#F9AB00" stroke-width="3">' +
    '<circle cx="8.3" cy="12" r="4.6"/><circle cx="15.7" cy="12" r="4.6"/></g>',

  aistudio:
    '<path fill="#4285F4" d="M12 3l2.4 6.1 6.1 2.4-6.1 2.4L12 20l-2.4-6.1-6.1-2.4 6.1-2.4z"/>',

  analytics:
    '<g><rect x="4" y="13" width="3.6" height="7" rx="1.8" fill="#F9AB00"/>' +
    '<rect x="10.2" y="9" width="3.6" height="11" rx="1.8" fill="#E8710A"/>' +
    '<rect x="16.4" y="4" width="3.6" height="16" rx="1.8" fill="#E37400"/></g>',
};

for (const [id, body] of Object.entries(ICONS)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">${body}</svg>\n`;
  writeFileSync(new URL(`${id}.svg`, OUT), svg);
}

console.log(`Готово: ${Object.keys(ICONS).length} иконок`);
