# Политика конфиденциальности

Расширение **Apps Launcher & Mail Checker for Google**. Редакция от 22 сентября 2026 г.

*English version below.*

Коротко: чтобы посчитать непрочитанные письма, расширение читает фид Gmail, то есть
получает доступ к вашей переписке. Эти данные обрабатываются только в вашем браузере:
расширение не передаёт и не продаёт их.

## К каким данным есть доступ

Чтобы показать число непрочитанных писем, расширение с заданной в настройках частотой
запрашивает Atom-фид Gmail (`https://mail.google.com/mail/u/N/feed/atom`) в сессии
Google, уже открытой в браузере. Из ответа используются только общее число непрочитанных
писем и даты писем: по датам считаются письма за выбранный период. Темы, отправители,
фрагменты текста и остальное содержимое фида не извлекаются, не сохраняются и никуда
не передаются.

Расширение не видит ваш пароль и не получает OAuth-доступа к аккаунту Google.

## Что хранится

- **Настройки** (период подсчёта, метка Gmail, частота проверки, номер аккаунта,
  раскладка плиток) хранятся в `chrome.storage.sync`. Если в Chrome включена
  синхронизация, Chrome переносит их между вашими устройствами через ваш аккаунт Google.
  У разработчика доступа к ним нет.
- **Последний результат проверки** (число писем, время проверки, текст ошибки) хранится
  в `chrome.storage.local`, только на этом устройстве.

При удалении расширения Chrome удаляет эти данные.

## Сетевые запросы

Само расширение обращается только к `mail.google.com` за фидом, описанным выше. Логотипы
сервисов входят в состав расширения и не загружаются из сети. Нажатие на плитку открывает
страницу выбранного сервиса Google в новой вкладке, как обычная ссылка.

Аналитики, рекламы, трекеров, собственных серверов и сторонних сервисов нет.

## Передача третьим лицам

Данные не передаются и не продаются третьим лицам и не используются ни для чего, кроме
работы расширения: подсчёта писем и открытия сервисов. Обработка данных соответствует
политике Chrome Web Store в отношении пользовательских данных, включая требования
Limited Use.

## Изменения и контакты

Новые редакции публикуются в этом файле, история изменений есть в git. Вопросы можно
задать в [issues на GitHub](https://github.com/CoolyWooly/mail_checker/issues).

---

# Privacy Policy

**Apps Launcher & Mail Checker for Google**. Effective September 22, 2026.

In short: to count unread mail, the extension reads the Gmail feed, which means it has
access to your personal communications. That data is processed only inside your browser;
the extension never transmits or sells it.

## Data the extension accesses

To show the unread count, the extension periodically (at the interval set in its options)
requests the Gmail Atom feed (`https://mail.google.com/mail/u/N/feed/atom`) using the
Google session already signed in to the browser. It uses only the total unread count and
the message dates from the response; the dates are used to count messages within the chosen
period. Subjects, senders, snippets and any other feed content are not extracted, stored or
transmitted.

The extension never sees your password and has no OAuth access to your Google account.

## What is stored

- **Settings** (counting period, Gmail label, check interval, account index, tile layout)
  are stored in `chrome.storage.sync`. If Chrome Sync is on, Chrome syncs them across your
  devices through your Google account. The developer has no access to them.
- **The last check result** (count, check time, error text) is stored in
  `chrome.storage.local`, on this device only.

Chrome deletes this data when the extension is removed.

## Network requests

The only host the extension contacts on its own is `mail.google.com`, for the feed described
above. Service logos are bundled with the extension. Clicking a tile opens the chosen Google
service in a new tab, like a regular link.

There is no analytics, advertising, tracking, developer-operated server or third-party service.

## Sharing

Data is not shared with or sold to third parties and is not used for anything other than
the extension's function: counting unread mail and opening services. Data handling complies
with the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Changes and contact

New versions are published in this file, with history in git. Questions go to
[GitHub issues](https://github.com/CoolyWooly/mail_checker/issues).
