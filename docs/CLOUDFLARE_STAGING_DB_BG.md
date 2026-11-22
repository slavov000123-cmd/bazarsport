# Cloudflare staging D1 — подготовка (НЕ деплой)

**Състояние:** 22 ноември 2026 г. Потребителят създаде празна D1 база през собствения си Cloudflare акаунт.

- Database name: `bazarsport-staging`
- Database ID: `660089ce-a295-4f89-b863-8d335d02ac69`
- Binding name in application code: `DB`
- Test Worker name, when ready: `bazarsport-staging`
- Reference config: `wrangler.staging.jsonc` (умишлено **не** се разпознава от стандартния `npx wrangler deploy` и не е свързан с текущия Sites билд)

## Какво означава това

D1 binding `DB` сочи **само към новата празна база**. Тази конфигурация не премества данни от Sites и не сменя `bazarsport.eu`.

**Не натискай Deploy в Cloudflare все още.** Текущият код на BAZARSPORT е изграден за Sites. Разчита на gateway, който заверява `oai-authenticated-user-*` HTTP headers. При директно излагане извън Sites тези headers трябва да се считат за недоверени. Има риск от подправяне на собственик/администратор при неподходяща конфигурация.

## Блокери, преди разрешаване на staging

1. **Кодът за проверка е подготвен:** `lib/cloudflare-access.ts` проверява Cloudflare Access JWT (RS256 подпис чрез ключ от trusted Team JWKS, issuer, audience, expiry, not-before и email на собственика). `worker/index.ts` презаписва всички самоличностни хедъри след валидна проверка. Тестовете са в `tests/cloudflare-access.test.mjs`. **Остава** да се създаде и конфигурира реална Cloudflare Zero Trust Access policy за staging Worker.
2. Защита на всички частни API маршрути (включително write операции и собствени снимки), премахване на доверие в непотвърдени identity headers.
3. **Изолиран build е подготвен:** `npm run build:staging` използва `vite.config.ts` с `configPath: './wrangler.staging.jsonc'`, без Sites placeholder D1 ID, и не променя `.openai/hosting.json`. GitHub CI проверява този build. **Остава** проверка в реалния Cloudflare акаунт преди deployment.
4. Тестова и **само тестова** миграция на schema върху новата празна база, след проверка на SQL и подходящата команда; никога миграции към production Sites.
5. `npm run install:ci && npm run typecheck && npm test && npm run build`, плюс integration проверка на admin/auth/database/MCP с тестови записи.
6. Едва тогава: отделен Cloudflare Worker, без връзка с реалния домейн, безопасно през `*.workers.dev` или друго **достъпно само за екипа** тестово URL след валидна auth, и настройка на GitHub auto deploy към staging branch.
7. Финалното прехвърляне на реални данни изисква надежден експорт от съществуващия Sites D1, backup/restore проверки, нов production D1 и проверка на броя записите и статуса им. Без успешен експорт **не прехвърляй домейна**.

## Какво е безопасно сега

- Запазваме съществуващия Sites проект, `bazarsport.eu` и всички реални прогнози без промяна.
- Работим по тестова интеграция в **отделен GitHub branch/PR**.
- Текущият файл `wrangler.staging.jsonc` е конфигурация за бъдеща staging среда, **не** доказателство за успешен deploy.
- Не слагай API tokens, account secrets или лични идентификационни данни в GitHub.

Официална документация:
- https://developers.cloudflare.com/workers/wrangler/configuration/
- https://developers.cloudflare.com/workers/vite-plugin/reference/api/
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/

## Cloudflare настройка, необходима преди тестов deploy

1. В Cloudflare Zero Trust активирай **Access** за бъдещия `bazarsport-staging` Worker с политика **Allow само твоя потвърден адрес**. Не поставяй работещия `bazarsport.eu` в това приложение.
2. От Cloudflare Access application копирай **Application Audience (AUD) tag** и твоя Team Domain (`https://<team>.cloudflareaccess.com`). Това са идентификатори, а не API ключове.
3. В настройките на отделния staging Worker, като **runtime variables/secrets**, конфигурирай `TEAM_DOMAIN`, `POLICY_AUD`, `OWNER_EMAIL`. **Без тях Worker отхвърля всички заявки.** Не изпращай тайни или сесийни JWT токени и не ги слагай в GitHub.
4. Извърши първа сигурна тестова D1 миграция **само** на новата `bazarsport-staging`, след като CI и SQL схемата са прегледани.
5. Не използвай стандартния `npm run build` в Cloudflare Builds: той е за Sites. За бъдещия Cloudflare Worker използвай `npm run build:staging` и проверена конфигурация за deploy, след успешен dry run.
6. Остави `workers_dev:false` и `preview_urls:false`, докато тестването на входа не приключи; тогава осигури Access защита и контролирана test URL.

**Сигурност:** Не включвай автоматичен deploy от `main` или от staging клона, преди да са преминали интеграционните тестове и да е проверен пътят за backup/restore. Production остава в Sites.

## Без карта: вход с GitHub OAuth (предпочитан за новата staging среда)

Кодът е добавен в `lib/github-owner-auth.ts`, с тестове в `tests/github-owner-auth.test.mjs`. Използва GitHub OAuth Authorization Code + PKCE + random state и подписана с HMAC, HttpOnly+Secure+SameSite=Lax сесия с продължителност 12 часа. Сървърът проверява **числовия GitHub User ID `334568071`**, а не само имейл/име, след `GET https://api.github.com/user`. Няма нужда от GitHub достъп до репото от страна на сайта; OAuth scope е `read:user`.

**Настройката НЕ е готова за публичен deployment.** За да работи, собственикът трябва:

1. Да избере защитен тестов URL на отделен Workers.dev Worker `bazarsport-staging` и да потвърди точния `https://...workers.dev` origin. `workers_dev` трябва временно да се включи едва след тест на auth и целия staging build (в момента е изключен).
2. В GitHub → Settings → Developer settings → OAuth Apps → New OAuth App да регистрира `BAZARSPORT Staging` със **Homepage URL** равен на тестовия origin и **Authorization callback URL** точно `https://<test-origin>/auth/github/callback`.
3. Да конфигурира Cloudflare Worker runtime настройките:
    - `GITHUB_AUTH_ORIGIN`: публичният HTTPS origin на staging сайта (без slash в края);
    - `GITHUB_CLIENT_ID`: публичният идентификатор на GitHub OAuth приложението;
    - `GITHUB_CLIENT_SECRET`: **Secret**, който не се записва в GitHub и не се изпраща в чат;
    - `AUTH_SESSION_KEY`: **Secret** — независим, случаен 32+ байтов ключ/низ; не в GitHub/чат;
    - `OWNER_EMAIL`: имейл на администратора, като runtime secret/настройка;
    - `GITHUB_OWNER_ID`: `334568071` (GitHub публичен numeric user ID от свързаното хранилище).
4. `BAZARSPORT_AUTH_MODE=github-oauth` се използва в отделната staging конфигурация. При непълни тайни/конфигурация Worker връща 503 вместо да позволява неоторизиран достъп.
5. Да тества login, logout, anonymous browsing, подправени identity headers, CSRF защита, timeout на сесия, и одобряване само от собственика.
6. Да приложи D1 schema само към празната staging база, да провери графично и API, и после да разгледа GitHub auto deploy само в staging.
7. **НЕ сменяй** production домейна `bazarsport.eu`, докато не е проверена експорт/възстановяване на всички исторически данни от Sites DB.

Сегашният `cloudflare-access` режим остава като алтернативен, но в `wrangler.staging.jsonc` е избран `github-oauth`. Zero Trust акаунт и банкова карта не са нужни за OAuth в GitHub, но съответните лимити и billing на Cloudflare Workers Free трябва да се проверят отделно.


## Нов безопасен първи релийз (само след преглед от собственика)

След успешни `npm test`, `npm run typecheck`, `npm run build:staging` и `npm run deploy:staging -- --dry-run`, кодът допуска **само изрично разрешено** създаване на **непубличен staging Worker**. Командата проверява името `bazarsport-staging`, точния staging DB ID, GitHub OAuth auth mode и забранява `workers_dev`, `preview_urls`, маршрути и custom domains. В нея няма DNS действия и няма промяна на основния Sites проект.

- Cloudflare Workers Builds Git repository: `slavov000123-cmd/bazarsport`
- **Production branch на този staging Worker:** `setup/cloudflare-staging-db-binding` (**НЕ `main`**)
- Worker / project name: `bazarsport-staging`
- Build command: `npm run install:ci && npm test && npm run typecheck && npm run build:staging`
- Deploy command за **първи безопасен upload**: `BAZARSPORT_STAGING_RELEASE=1 npm run deploy:staging -- --release`
- Preview builds: **off**
- GitHub repository code review: `https://github.com/slavov000123-cmd/bazarsport/pull/8`

Задаването на тази deploy команда само по себе си **не** прави тестовия Worker публичен: `workers_dev=false`, `preview_urls=false` и няма routes. Ако проектът вече съществува в акаунта под друго име, не продължавайте до разрешаване на конфликта.

**Важно:** Този първи релийз създава само затворен, неизползваем отвън Worker. След като го има, задайте секретите в Cloudflare Dashboard и проверете отделно D1 schema, GitHub OAuth callback и защитите. Публичен тестов адрес може да се разреши чак след изрична security проверка. Не включвайте `workers_dev` преди това. Няма гаранция, че Cloudflare Workers Free покрива всички бъдещи потребности; следете квотите.

За всеки следващ commit към посочения branch Workers Builds ще опитва същия защитен staging deploy. Това е **само staging**, не production `bazarsport.eu`.

