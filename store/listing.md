# Публикация в Chrome Web Store

Шпаргалка для [Developer Dashboard](https://chrome.google.com/webstore/devconsole): что
вставлять в каждую вкладку. Тексты для покупателей написаны по-русски. Поля вкладки
Privacy читают только проверяющие, поэтому они на английском.

## Перед первой загрузкой

1. Зарегистрируйте аккаунт разработчика. Взнос разовый, $5. На Google-аккаунте должна
   быть включена двухэтапная аутентификация.
2. Во вкладке **Account** подтвердите контактный email и укажите статус торговца: для
   бесплатного расширения частного лица подходит **non-trader**.
3. Запушьте `PRIVACY.md` в `main`: ссылка на него понадобится во вкладке Privacy.
4. Соберите архив: `npm run pack:store` → `dist/extension-store.zip`. От
   `npm run pack` он отличается только тем, что в манифесте нет поля `key`.

**Items → New item** → загрузить `dist/extension-store.zip`.

## Store listing

**Title** и **Summary** подставляются из манифеста:

- Apps Launcher & Mail Checker for Google
- Сетка сервисов Google в один клик и счётчик непрочитанных писем Gmail за настраиваемый период.

**Description:**

```text
Сетка сервисов Google в один клик и счётчик непрочитанных писем Gmail на иконке расширения.

ЧТО УМЕЕТ
• 26 сервисов в одном окне: Почта, Диск, Календарь, Документы, Таблицы, Gemini, YouTube, Карты, Meet, Переводчик и другие.
• «Избранное» и порядок плиток настраиваются перетаскиванием, ненужные сервисы можно скрыть.
• Число непрочитанных писем на иконке расширения и на плитке «Почта».
• Счётчик за выбранный период: например, только письма за последние 2 дня. 0 — все непрочитанные во «Входящих».
• Фильтр по метке Gmail и выбор аккаунта, если вы вошли в несколько.
• Светлая и тёмная тема по настройкам системы.

КАК РАБОТАЕТ СЧЁТЧИК
Расширение читает фид Gmail в сессии, уже открытой в браузере. OAuth, пароли и доступ к аккаунту не нужны: достаточно войти в Gmail в этом браузере. Из фида берутся только число непрочитанных писем и их даты.

Фид Gmail содержит не больше 20 последних писем. Если за выбранный период непрочитанных больше, счётчик покажет «20+».

КОНФИДЕНЦИАЛЬНОСТЬ
Никакой аналитики, рекламы и сторонних серверов. Настройки хранятся в Chrome, данные писем не покидают ваш компьютер.

Исходный код открыт: https://github.com/CoolyWooly/mail_checker

Расширение не связано с Google LLC и не одобрено ею. Google, Gmail и названия и логотипы сервисов — товарные знаки Google LLC.
```

**Category:** Productivity → Tools.
**Language:** Русский.

**Graphic assets.** Картинки пересобираются командой `npm run build:store-assets`.

| Поле                 | Файл                                  | Размер   |
| -------------------- | ------------------------------------- | -------- |
| Store icon           | `icons/icon128.png`                   | 128×128  |
| Screenshots          | `store/images/screenshot-1-popup.png` | 1280×800 |
|                      | `store/images/screenshot-2-edit.png`  | 1280×800 |
|                      | `store/images/screenshot-3-options.png` | 1280×800 |
|                      | `store/images/screenshot-4-dark.png`  | 1280×800 |
| Small promo tile     | `store/images/promo-small.png`        | 440×280  |
| Marquee promo tile   | не нужен, поле необязательное         | —        |

**Additional fields:**

- Homepage URL: `https://github.com/CoolyWooly/mail_checker`
- Support URL: `https://github.com/CoolyWooly/mail_checker/issues`

## Privacy

**Single purpose description:**

```text
Quick access to Google services from the browser toolbar: a grid of links to Google services plus the number of unread Gmail messages shown on the extension icon.
```

**Permission justification:**

- `storage`:

  ```text
  Stores the user's settings (counting period, Gmail label, check interval, account index, tile layout) in chrome.storage.sync and the last unread count in chrome.storage.local.
  ```

- `alarms`:

  ```text
  Schedules the periodic unread-mail check at the interval chosen by the user (1–240 minutes, 5 by default).
  ```

- Host permission `https://mail.google.com/*`:

  ```text
  Required to fetch the Gmail Atom feed (https://mail.google.com/mail/u/N/feed/atom) with the browser's existing Google session in order to count unread messages. Only the unread count and message dates are read from the response; nothing is stored or sent anywhere else. No other hosts are accessed.
  ```

**Remote code:** *No, I am not using remote code.*

**Data usage.** Отметьте **Personal communications**. Расширение получает фид почты, и
хотя из него берутся только число и даты писем, доступ к переписке у него есть. Если не
отметить категорию, это частая причина отказа. То, что обработка идёт только локально,
объяснено в политике конфиденциальности. Остальные категории не отмечайте.

Поставьте все три галочки:

- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** `https://github.com/CoolyWooly/mail_checker/blob/main/PRIVACY.md`

## Distribution

- Payments: **Free**.
- Visibility: **Public**. Если хотите сначала проверить установку из магазина, выберите
  **Unlisted**: расширение будет доступно только по ссылке.
- Regions: все.

## Test instructions (необязательно)

```text
No test account is needed: sign in to any Gmail account in the browser and the unread count appears on the toolbar icon within a minute. Options: right-click the icon → Options.
```

## После отправки

Проверка обычно занимает от нескольких дней до пары недель. Доступ к `mail.google.com`
почти наверняка отправит расширение на углублённую проверку. Отключите «Publish
automatically», если хотите выбрать момент публикации сами.

Когда расширение опубликуют, у него будет новый ID: версия из GitHub Releases и версия из
магазина — два разных расширения. Все кнопки и ссылки на магазин в README берут адрес из
одной ссылки `[webstore]` в самом конце файла: замените её на
`https://chromewebstore.google.com/detail/<ID>`. После этого бейджи в шапке можно
заменить на живые: `https://img.shields.io/chrome-web-store/v/<ID>`, `/users/<ID>`,
`/rating/<ID>`.

## Обновления

1. Поднимите версию в `manifest.json` и `package.json`.
2. Выполните `npm run pack:store`.
3. В дашборде: **Package → Upload new package** → **Submit for review**.
