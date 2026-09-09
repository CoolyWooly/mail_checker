// Каталог сервисов Google. `{n}` в url подставляется номером аккаунта из настроек.

export const SERVICES = [
  // Базовые
  { id: 'account', name: 'Аккаунт', group: 'base', color: '#5F6368', url: 'https://myaccount.google.com/?authuser={n}' },
  { id: 'gmail', name: 'Почта', group: 'base', color: '#EA4335', url: 'https://mail.google.com/mail/u/{n}/' },
  { id: 'calendar', name: 'Календарь', group: 'base', color: '#4285F4', url: 'https://calendar.google.com/calendar/u/{n}/r' },
  { id: 'drive', name: 'Диск', group: 'base', color: '#FBBC04', url: 'https://drive.google.com/drive/u/{n}/' },
  { id: 'docs', name: 'Документы', group: 'base', color: '#4285F4', url: 'https://docs.google.com/document/u/{n}/' },
  { id: 'sheets', name: 'Таблицы', group: 'base', color: '#34A853', url: 'https://docs.google.com/spreadsheets/u/{n}/' },
  { id: 'slides', name: 'Презентации', group: 'base', color: '#FBBC04', url: 'https://docs.google.com/presentation/u/{n}/' },
  { id: 'forms', name: 'Формы', group: 'base', color: '#7248B9', url: 'https://docs.google.com/forms/u/{n}/' },
  { id: 'keep', name: 'Keep', group: 'base', color: '#FBBC04', url: 'https://keep.google.com/u/{n}/' },
  { id: 'gemini', name: 'Gemini', group: 'base', color: '#A142F4', url: 'https://gemini.google.com/app?authuser={n}' },

  // Рабочие
  { id: 'meet', name: 'Meet', group: 'work', color: '#00832D', url: 'https://meet.google.com/?authuser={n}' },
  { id: 'chat', name: 'Chat', group: 'work', color: '#00AC47', url: 'https://mail.google.com/chat/u/{n}/' },
  { id: 'contacts', name: 'Контакты', group: 'work', color: '#4285F4', url: 'https://contacts.google.com/u/{n}/' },
  { id: 'groups', name: 'Группы', group: 'work', color: '#4285F4', url: 'https://groups.google.com/u/{n}/' },
  { id: 'tasks', name: 'Задачи', group: 'work', color: '#2684FC', url: 'https://calendar.google.com/calendar/u/{n}/r/tasks' },

  // Прочие
  { id: 'youtube', name: 'YouTube', group: 'other', color: '#FF0000', url: 'https://www.youtube.com/?authuser={n}' },
  { id: 'maps', name: 'Карты', group: 'other', color: '#34A853', url: 'https://www.google.com/maps?authuser={n}' },
  { id: 'photos', name: 'Фото', group: 'other', color: '#FBBC04', url: 'https://photos.google.com/u/{n}/' },
  { id: 'translate', name: 'Переводчик', group: 'other', color: '#4285F4', url: 'https://translate.google.com/' },
  { id: 'news', name: 'Новости', group: 'other', color: '#4285F4', url: 'https://news.google.com/?authuser={n}' },
  { id: 'search', name: 'Поиск', group: 'other', color: '#4285F4', url: 'https://www.google.com/' },
  { id: 'play', name: 'Play', group: 'other', color: '#34A853', url: 'https://play.google.com/store?authuser={n}' },

  // Облако и разработка
  { id: 'cloud', name: 'Cloud Console', group: 'dev', color: '#4285F4', url: 'https://console.cloud.google.com/?authuser={n}' },
  { id: 'colab', name: 'Colab', group: 'dev', color: '#F9AB00', url: 'https://colab.research.google.com/?authuser={n}' },
  { id: 'aistudio', name: 'AI Studio', group: 'dev', color: '#4285F4', url: 'https://aistudio.google.com/?authuser={n}' },
  { id: 'analytics', name: 'Analytics', group: 'dev', color: '#E37400', url: 'https://analytics.google.com/analytics/web/?authuser={n}' },
];

export const ALL_SERVICE_IDS = SERVICES.map((s) => s.id);

export const SERVICE_BY_ID = Object.fromEntries(SERVICES.map((s) => [s.id, s]));

export function iconPath(id) {
  return `/icons/services/${id}.png`;
}

export function serviceUrl(service, accountIndex = 0) {
  return service.url.replace('{n}', String(accountIndex));
}
