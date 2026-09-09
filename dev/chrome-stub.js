// Только для локального просмотра верстки вне Chrome-расширения.
(function () {
  // В скрытой вкладке requestAnimationFrame не срабатывает, и превью «замирает».
  // Для расширения это неважно (popup всегда виден), но локальный просмотр чинит таймер.
  if (document.visibilityState === 'hidden') {
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
  }

  const store = {
    sync: {},
    local: {
      state: {
        count: 7, capped: false, total: 7, lastSync: Date.now() - 120000,
        error: (location.hash === '#error' ? 'HTTP 503' : null),
        authState: (location.hash.slice(1) || 'ok').replace('error', 'ok'),
      },
    },
  };
  const area = (name) => ({
    async get(defaults) {
      if (typeof defaults === 'string') return { [defaults]: store[name][defaults] };
      return { ...(defaults ?? {}), ...store[name] };
    },
    async set(obj) { Object.assign(store[name], obj); },
  });
  window.chrome = {
    runtime: {
      getManifest: () => ({ version: '1.0.0' }),
      openOptionsPage: () => console.log('openOptionsPage'),
      async sendMessage(msg) {
        // #nobg — service worker «не поднялся»: проверка запасного пути страниц.
        if (location.hash === '#nobg') throw new Error('Could not establish connection');
        const { getSettings } = await import('../src/settings.js');
        const settings = await getSettings();
        if (msg.type === 'getState') return { state: store.local.state, settings };
        return { state: store.local.state };
      },
    },
    storage: { sync: area('sync'), local: area('local'), onChanged: { addListener() {} } },
    tabs: { create: (o) => console.log('tabs.create', o) },
  };
})();
