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

1. Разработване и тест на нов, **криптографски проверяван**, независим от Sites администраторски вход (например Cloudflare Access JWT с проверка на подпис, issuer, audience, expiry и policy от Worker-а, или подходящ OAuth session).
2. Защита на всички частни API маршрути (включително write операции и собствени снимки), премахване на доверие в непотвърдени identity headers.
3. Настройка и проверка на Vite Cloudflare build да използва отделния staging Worker + D1 binding (настоящата `vite.config.ts` използва placeholder D1 ID за Sites); не променяй съществуващия `.openai/hosting.json`.
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
