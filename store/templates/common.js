// Помощники шаблонов: ждут, пока превью из dev/ отрисуется в iframe, и сообщают
// scripts/build-store-assets.mjs о готовности через data-ready на <html>.

const ICONS = {
  back: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
  forward: 'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z',
  reload: 'M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
  puzzle: 'M20.5 11H19V7a2 2 0 0 0-2-2h-4V3.5a2.5 2.5 0 0 0-5 0V5H4a2 2 0 0 0-2 2v3.8h1.5a2.7 2.7 0 0 1 0 5.4H2V20a2 2 0 0 0 2 2h3.8v-1.5a2.7 2.7 0 0 1 5.4 0V22H17a2 2 0 0 0 2-2v-4h1.5a2.5 2.5 0 0 0 0-5z',
};
const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;

// Рамка окна браузера одна на все шаблоны: <div class="window" data-tab="…" data-badge="7">
// получает полоску вкладок и тулбар с иконкой расширения. data-pressed — popup открыт.
for (const win of document.querySelectorAll('.window')) {
  const { tab = 'Новая вкладка', badge = '' } = win.dataset;
  win.insertAdjacentHTML('afterbegin', `
    <div class="tabstrip"><span class="lights"><i></i><i></i><i></i></span><span class="tab">${tab}</span></div>
    <div class="toolbar">
      <span class="nav">${svg('back')}${svg('forward')}${svg('reload')}</span>
      <span class="omnibox"></span>
      <span class="ext${'pressed' in win.dataset ? ' pressed' : ''}">
        <img src="../../icons/icon32.png" alt="">${badge ? `<b class="badge">${badge}</b>` : ''}
      </span>
      ${svg('puzzle')}
      <span class="avatar"></span>
    </div>`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

async function until(check, what, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`не дождались: ${what}`);
    await sleep(50);
  }
}

/** Ждёт загрузки превью и его отрисовки (включая картинки), возвращает document. */
async function framed(frame, rendered) {
  // Пока iframe не начал грузиться, в нём лежит пустой about:blank со статусом complete.
  await until(
    () => frame.contentDocument?.readyState === 'complete' && frame.contentDocument.URL !== 'about:blank',
    `загрузка ${frame.src}`,
  );
  const doc = frame.contentDocument;
  await until(() => rendered(doc) && [...doc.images].every((img) => img.complete), `отрисовка ${frame.src}`);
  return doc;
}

/**
 * Включает тему превью независимо от системы: медиазапрос prefers-color-scheme: dark
 * из src/*.css включается или выключается целиком — цвета темы здесь не дублируются.
 */
function setTheme(doc, theme) {
  for (const sheet of doc.styleSheets) {
    for (const rule of sheet.cssRules) {
      if (rule.media && rule.conditionText?.includes('prefers-color-scheme: dark')) {
        rule.media.mediaText = theme === 'dark' ? 'all' : 'not all';
      }
    }
  }
  doc.documentElement.style.colorScheme = theme;
}

export async function mountPopup(frame, { theme = 'light', edit = false } = {}) {
  const doc = await framed(
    frame,
    (d) => d.querySelector('#favorites .tile') && d.getElementById('status')?.textContent.trim(),
  );
  setTheme(doc, theme);
  if (edit) doc.getElementById('edit').click();
  await nextFrame();
  // Высота popup — по содержимому, как её выставит Chrome.
  frame.style.height = `${Math.ceil(doc.body.getBoundingClientRect().height)}px`;
  return doc;
}

export async function mountOptions(frame, { theme = 'light' } = {}) {
  const doc = await framed(
    frame,
    (d) => d.querySelector('.service-row') && d.getElementById('status-line')?.textContent.trim(),
  );
  setTheme(doc, theme);
  return doc;
}

/** Отмечает страницу готовой к снимку — или пишет, что пошло не так. */
export function report(task) {
  task
    .then(nextFrame)
    .then(nextFrame)
    .then(
      () => { document.documentElement.dataset.ready = 'ok'; },
      (err) => {
        console.error(err);
        document.documentElement.dataset.ready = `error: ${err.message}`;
      },
    );
}
