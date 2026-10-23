# Languages

Registered in `src/i18n/languages.ts`. Each entry has a `live` flag:

- **live** – offered in the language menu and picked from the browser's language.
- **not live** – loadable only with `?lang=xx` (remembered after that), so the
  owner can check it in the real app before launch. The menu lists it only to
  someone already using it.

| Language | File      | State                                      |
|----------|-----------|--------------------------------------------|
| Czech    | `cs.json` | live, bundled                              |
| English  | `en.json` | live, bundled                              |
| Slovak   | `sk.json` | translated, waiting for the owner's check  |
| Polish   | `pl.json` | English placeholder draft, not registered  |
| German   | `de.json` | English placeholder draft, not registered  |

Languages other than Czech and English load on demand (`LOADERS` in
`src/i18n/index.ts`). A missing key falls back along the entry's `fallback`
list (Slovak → Czech → English).

The e-mails the server sends are translated separately, in
`backend/src/i18n/emails/`; the server's `LOCALES` list must contain the
language too. Help articles and What's new are Czech and English only; a
language reads the ones named by its `content` field.

## Adding a language

1. Translate every value of `cs.json`, keeping `{{placeholders}}`, `<tags>`,
   `{ui:…}` markers, `$t(…)` references and product names. Add the plural
   forms the language needs (`_one`, `_few`, `_many`, `_other`).
2. Add the entry to `LANGUAGES` with `live: false` and a loader to `LOADERS`.
3. Add `backend/src/i18n/emails/xx.ts` and the code to `LOCALES`.
4. Check it with `?lang=xx`, then set `live: true`.
