# ATM – kompletní UX/UI návrhový balíček

Datum sestavení: 14. 9. 2026

Balíček slučuje audit současné administrace, mobile-first specifikaci Team Managera, návrh dokumentace, návrh changelogu a kontaktního formuláře a tři samostatně otevíratelné interaktivní návrhy obrazovek.

## Stav ověření – 14. 9. 2026

Balíček byl porovnán se zdrojovým kódem (Prisma schéma, `backend/src/services/access.ts`, routy, frontend komponenty, `cs.json`) a upraven:

- Role `LEAGUE_MANAGER` / `TEAM_MANAGER` / `TOURNAMENT_MANAGER` nahrazeny modelem manažerských vazeb ve všech specifikacích i obrazovkách.
- Audit doplněn o tabulku *Ověření proti kódu* s příčinami: pád formulářů je v kódu širší (i `Add Season`, `Přidat tým`, `Vygenerovat rozpis`), posun času má dvě konvence v kódu, „dva zdroje skóre“ už z velké části vyřešeny, potvrzení souhrnu kola už existuje, nový nález u `Pozvat manažera`.
- Specifikace Team Managera doplněna o skutečná oprávnění (manažer týmu nevede Match report ani nezve manažery), uložení sestavy a chybějící data hráče.
- Dokumentace: publikum místo rolí, texty podle skutečného UI, články pro nevydané funkce jako nepublikované, obsah v obou jazycích, bez sitemap a analytiky.
- Novinky a kontakt: bez neexistujícího kanálu podpory, verzí, analytiky; nový model ticketů; obrazovka ukazuje skutečná vydání z gitu a roadmapa neobsahuje už vydanou docházku.

## Doporučené pořadí čtení

1. [Audit administrace](01_ADMIN_UX_AUDIT.md)
2. [Mobile-first specifikace Team Managera](02_TEAM_MANAGER_MOBILE_SPEC.md)
3. [Dokumentace a centrum nápovědy](03_DOCUMENTATION_SPEC.md)
4. [Changelog, roadmapa a kontakt](04_UPDATES_CONTACT_SPEC.md)
5. [Implementační plán](05_IMPLEMENTATION_PLAN.md) – anglicky, ve stejném formátu jako `docs/tier3`: fáze, soubory, schéma, rozhodnutí

## Interaktivní návrhy obrazovek

- [Nová administrace](screens/admin-refresh.html) – mobilní Team Manager, mobilní sestava a desktopové pohledy Team/League Managera.
- [Dokumentace ATM](screens/documentation.html) – centrum nápovědy s navigací podle spravované oblasti.
- [Novinky, roadmapa a kontakt](screens/updates-contact.html) – vydané změny, připravované funkce a kontaktní formulář.

HTML návrhy lze otevřít samostatně v běžném prohlížeči. Jsou určené jako produktový a implementační referenční návrh, nikoli jako hotové produkční komponenty. Při rozporu mezi obrazovkou a specifikací platí specifikace (např. členění článků dokumentace je na obrazovce zjednodušené).

## Závazné produktové priority

- Správa týmu je mobile-first a musí být pohodlně ovladatelná při šířkách 360–430 px.
- Veřejná část a administrace musí u stejného zápasu zobrazit stejný lokální čas.
- Uživatel, který spravuje více oblastí, vždy vidí aktivní kontext – ligu nebo tým a sezónu.
- Line-up a pozápasový Match report jsou dvě oddělené činnosti i v datech.
- Jeden workflow používá jeden jasný způsob ukládání.
- Oprávnění plynou z manažerských vazeb, ne z role na účtu (`Role` je jen `ADMIN` / `USER`).
- Každý nový text rozhraní je současně v `en.json` i `cs.json`.
- Changelog odděluje skutečně vydané změny od plánů.
- Roadmapa neslibuje datum, dokud není vydání potvrzené.
- Kontaktní formulář sbírá pouze údaje potřebné k vyřízení zprávy.
- Dokumentace nesmí popisovat funkce, které nejsou dostupné v produkci.

## Rozsah první implementační vlny

1. Opravit kritické chyby z auditu.
2. Opravit mobilní Team Manager navigaci.
3. Zavést společný admin shell a context switcher (liga / tým / série).
4. Rozdělit Line-up a Match report.
5. Přidat `/docs`, `/updates` a `/contact`.
6. Provést mobilní, přístupnostní a regresní testy.

