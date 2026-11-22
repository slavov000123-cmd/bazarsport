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
