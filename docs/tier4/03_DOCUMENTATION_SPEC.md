# ATM – dokumentace a centrum nápovědy

## Cíl

Vytvořit veřejně dostupnou nápovědu, kde návštěvník i přihlášený manažer rychle najde vysvětlení ovládání ATM. Dokumentace má být součástí stejného světlého designu jako veřejný web (`PublicLayout`).

Dokumentace není pouze marketingový přehled. Každý článek má pomoci dokončit konkrétní úkol.

## Model oprávnění, ze kterého texty vycházejí

`Role` v aplikaci obsahuje pouze `ADMIN` a `USER`. Role `TEAM_MANAGER`, `LEAGUE_MANAGER` ani `TOURNAMENT_MANAGER` neexistují a dokumentace je nesmí popisovat jako nastavení účtu. Oprávnění plynou z vazeb `League.managerId`, `Team.managerId` a `TournamentSeries.managerId` (`backend/src/services/access.ts`). Frontend je zná z `user.manages` (`{ leagues, teams, series }`) a v rozhraní je označuje štítky **Manažer ligy**, **Manažer týmu** a **Manažer turnaje**. Jeden účet může mít více štítků současně.

## Routy

- `/docs` – výchozí článek Rychlý start.
- `/docs/:slug` – detail článku.
- Neznámý nebo nepublikovaný slug – 404 s akcí `Zpět na dokumentaci`.

## Umístění odkazu

- Veřejná desktopová i mobilní navigace (`components/public/PublicHeader.tsx`): `Nápověda`.
- Přihlášená část: uživatelské menu v `components/Navbar.tsx`. Po zavedení společného admin shellu ikona `?` a položka v nabídce `Více`; do té doby ikona `?` v hlavičce každého manažerského layoutu (`/season-management`, `/team-management`, `/tournament-management`, `/admin`).
- Footer (`components/public/PublicFooter.tsx`): skupina `Projekt`.
- Kontextové odkazy přímo z administračních obrazovek.

## Informační architektura

Pole **Publikováno** říká, zda článek smí být veřejný hned při spuštění `/docs`. Články označené „až po vydání“ popisují funkce z implementačního plánu; v datech existují s `published: false` a zveřejní se se svou funkcí.

### Začínáme

| Článek | Slug | Publikováno |
|---|---|---|
| Rychlý start | `rychly-start` | ano (text aktualizovat po zavedení context switcheru) |
| Role a oprávnění | `role-a-opravneni` | ano |
| Účet a přihlášení | `ucet-a-prihlaseni` | ano |

### Manažer ligy

| Článek | Slug | Publikováno |
|---|---|---|
| Správa sezóny | `sprava-sezony` | ano |
| Sezóny a týmy | `sezony-a-tymy` | ano |
| Rozpis zápasů | `rozpis-zapasu` | ano |
| Výsledky a statistiky | `vysledky-a-statistiky` | ano |

### Manažer týmu

| Článek | Slug | Publikováno |
|---|---|---|
| Správa týmu | `sprava-tymu` | ano |
| Profil týmu a soupiska | `profil-tymu-a-soupiska` | ano |
| Sestava před zápasem | `sestava-pred-zapasem` | až po vydání samostatné sestavy |
| Match report | `match-report` | ano pro manažera ligy; část pro manažera týmu až po rozhodnutí o jeho oprávnění |
| Kalendář a události | `kalendar-a-udalosti` | ano |
| Nastavení týmu | `nastaveni-tymu` | ano |

### Turnaje a podpora

| Článek | Slug | Publikováno |
|---|---|---|
| Turnaje, skupiny a playoff | `turnaje-skupiny-a-playoff` | ano |
| Nejčastější otázky | `nejcastejsi-otazky` | ano |
| Novinky a plán | odkaz na `/updates` | až po vydání `/updates` |
| Kontakt | odkaz na `/contact` | až po vydání `/contact` |

## Datový model článku

Projekt nemá Markdown ani MDX renderer. Obsah uložit jako strukturovaná data – TypeScript moduly s bloky (odstavec, nadpis, seznam, číslovaný postup, tabulka, zvýrazněný blok) – načítané až při vstupu na `/docs` (lazy import), odděleně od prezentačních komponent.

`DocsAudience` je štítek publika pro řazení a doporučení, nikoli role uživatele. Mapuje se na `user.manages`: `LEAGUE` ↔ `leagues > 0`, `TEAM` ↔ `teams > 0`, `TOURNAMENT` ↔ `series > 0`; administrátor dostane doporučené vše.

```ts
type DocsAudience = "ALL" | "LEAGUE" | "TEAM" | "TOURNAMENT";

type DocsLocale = "cs" | "en";

type DocsArticle = {
  id: string;
  slug: string;                 // jeden pro oba jazyky, bez diakritiky
  category: string;
  audiences: DocsAudience[];
  order: number;
  updatedAt: string;
  published: boolean;
  relatedSlugs: string[];
  content: Record<DocsLocale, {
    title: string;
    summary: string;
    keywords: string[];
    blocks: DocsBlock[];
  }>;
};
```

## Layout

### Desktop

- společná veřejná hlavička;
- nízký tmavě modrý hero (`PublicHero`);
- levý sticky sidebar 240–280 px;
- hlavní text maximálně 680–820 px;
- aktivní článek označený modrou plochou, textem a `aria-current="page"`.

### Mobil

- kategorie jako drawer nebo horizontální ovládání;
- žádný horizontální scroll celé stránky;
- dotykové cíle minimálně 44 × 44 px;
- název článku, publikum a datum aktualizace viditelné bez otevření navigace;
- tabulky pouze ve vlastním scroll kontejneru;
- fungovat při 360, 390 a 430 px.

## Hledání

První verze používá lokální fulltext načtený pouze na `/docs`, postavený na stávající komponentě `components/public/SearchBox.tsx`.

Prohledávat:

- název;
- perex;
- klíčová slova;
- nadpisy;
- běžný text.

Požadavky:

- prohledávat jen publikované články v aktuálním jazyce;
- ignorovat velikost písmen;
- fungovat s českou diakritikou i bez ní;
- výsledek ukáže název, kategorii, publikum a relevantní úryvek;
- prázdný výsledek nabídne `Zobrazit všechny články`;
- výsledek se na mobilu vejde do viewportu.

## Obsahové šablony

Každý článek obsahuje:

1. název;
2. krátký perex;
3. štítek publika, například `Pro manažera ligy`;
4. datum aktualizace;
5. jasné mezititulky;
6. číslované kroky konkrétního úkolu;
7. jen nezbytné bloky `Tip`, `Poznámka` nebo `Důležité`;
8. dva až tři související články;
9. odkaz `Kontaktujte nás` na `/contact` – zobrazit až po vydání kontaktního formuláře.

Názvy tlačítek a záložek psát **tučně** a přesně podle `cs.json` / `en.json`.

## Připravené textové jádro článků

Texty popisují stav aplikace ke dni 14. 9. 2026. Před publikací znovu porovnat s aplikací.

### Rychlý start

ATM slouží ke správě amatérských lig, turnajů, týmů, hráčů a zápasů. Veřejná část zpřístupňuje soutěže, rozpisy, výsledky, tabulky a statistiky bez přihlášení. Po přihlášení uživatel spravuje to, co mu bylo svěřeno – ligu, tým nebo sérii turnajů.

První kroky po přihlášení:

1. Po přihlášení se otevře **Nástěnka**.
2. V menu účtu štítky **Manažer ligy**, **Manažer týmu** a **Manažer turnaje** ukazují, co spravujete.
3. Zvolte oblast: **Moje týmy**, **Moje sezony** nebo **Správa turnajů**.
4. Před každou změnou zkontrolujte název týmu nebo sezóny v záhlaví.

Po zavedení context switcheru nahradit kroky 2–3 popisem přepínače.

### Role a oprávnění

Na účtu se nevybírá role. Manažerem se uživatel stane tím, že ligu, tým nebo sérii turnajů spravuje; jeden účet může řídit ligu a zároveň vést tým.

- **Manažer ligy** spravuje ligu a všechny její sezóny: stav, viditelnost, bodování, týmy a skupiny, rozpis, termíny, výsledky, Match report, potvrzení zápisu, souhrn kola a pozvání manažerů týmů. Může spravovat i každý tým hrající v jeho sezóně.
- **Manažer týmu** spravuje název, logo a barvu týmu, soupisku (včetně propojení hráče s účtem), kalendář a docházku a může vyplnit góly, asistence a trestné minuty svých hráčů u zápasu bez Match reportu. Nemůže měnit termín ani skóre, generovat rozpis, potvrzovat zápisy, odebrat nebo smazat tým ani pozvat manažera.
- **Manažer turnaje** spravuje sérii turnajů a vše v ní. Sérii může založit kdokoli po přihlášení.
- **Hráč s propojeným účtem** vidí svůj tým a odpovídá na docházku; spravovat tým nemůže.

Manažera týmu zve manažer ligy nebo administrátor tlačítkem **Pozvat manažera**. Manažera ligy určuje administrátor.

Pokud uživatel očekávaný tým nebo ligu nevidí, nemá vytvářet nový záznam. Ověří, že je přihlášen e-mailem, na který přišla pozvánka, a požádá manažera ligy o novou pozvánku.

### Účet a přihlášení

Po registraci přijde e-mail s aktivačním odkazem; bez aktivace se nelze přihlásit. Přihlášení tlačítkem **Přihlásit se** e-mailem a heslem. Obnova hesla přes **Zapomenuté heslo?** a **Odeslat odkaz**. Pozvánka na existující e-mail připojí tým k existujícímu účtu. Deaktivovaný účet obnovuje administrátor. Každý manažer používá vlastní účet; po práci na sdíleném zařízení se odhlásí.

### Správa sezóny

V **Moje sezony** → sezóna. Záložky **Sezóna**, **Zápasy**, **Týmy**, **Tabulka**, **Více**. Záložka **Sezóna** ukazuje stav s akcí **Aktivovat** / **Dokončit**, počty, blok **Vyžaduje pozornost** (bez týmů, bez rozpisu, zápasy bez termínu) a **Nejbližší zápasy**. **Více** obsahuje **Vygenerovat rozpis**, **Bodování**, **Skupiny**, **Odeslat souhrn kola**, **Viditelnost** a **Zobrazit veřejnou stránku**.

Po úpravě dashboardu (karta sezóny otevírá správu, veřejná stránka jako sekundární akce) text doplnit.

### Sezóny a týmy

**Nová sezóna** jen v lize, kterou uživatel spravuje; při založení lze převzít týmy z předchozí sezóny. Stavy **Koncept**, **Aktivní**, **Dokončená** – stav neurčuje, kdo sezónu uvidí. Viditelnost **Zveřejněno** / **Zatím nezveřejněno** (výchozí pro novou sezónu) / **Skryto**; neveřejná nebo skrytá liga přebíjí nastavení sezóny. Archivaci provádí administrátor, jen u dokončené sezóny se všemi odehranými zápasy potvrzenými; po archivaci zůstane jen konečná tabulka a celkové statistiky a sezónu nelze měnit.

Týmy se přidávají na záložce **Týmy** přes **Přidat tým**. **Důležité:** odebrání týmu ze sezóny smaže všechny jeho zápasy v této sezóně včetně výsledků a statistik; tým a soupiska zůstanou.

### Rozpis zápasů

Generovat lze jen v sezóně ve stavu **Koncept** s alespoň dvěma týmy. Manažer ligy zadá počet kol (každé kolo = každý s každým, v sudých kolech se prohodí domácí a hosté) a u rozdělené sezóny volbu hrát jen v rámci skupin. **Důležité:** opakované generování smaže všechny zápasy sezóny včetně termínů a případných výsledků. Vygenerované zápasy nemají termín – nastaví se přes **Nastavit termíny po kolech** nebo u zápasu **Nastavit termín** / **Upravit**. Zápasy bez termínu týmy ve svém rozpisu neuvidí.

### Výsledky a statistiky

Manažer ligy zapíše skóre v **Zapsat výsledek** nebo vede **Zápis o utkání** (**Gól** se střelcem a asistencemi, **Trest** s minutami). Jakmile má zápas zápis o utkání, skóre i statistiky se počítají z něj a ručně je přepsat nelze. Do tabulky se počítá jen potvrzený zápas (**Potvrdit zápis**); do té doby je v tabulce označen **Odehráno, čeká na potvrzení**. Oprava potvrzeného zápasu vyžaduje **Znovu otevřít** s důvodem a zapíše se do historie. Statistiky hráčů se opravují v původním zápase, nikoli ručním přepsáním souhrnu.

### Správa týmu

V **Moje týmy** → tým. Dnes záložky **Přehled**, **Soupiska**, **Rozpis**, **Kalendář**, **Nastavení**; po mobilním refreshi **Přehled**, **Soupiska**, **Zápasy**, **Kalendář**, **Více** – text aktualizovat s vydáním. Termíny, skóre, rozpis a potvrzování řeší manažer ligy.

### Profil týmu a soupiska

Manažer udržuje **Název týmu**, logo a barvu (**Značka a barvy týmu**) a soupisku. Hráč má jméno, číslo dresu, pozici, rok narození a poznámku; patří k týmu, ne k sezóně. Před vytvořením hráče vyhledat existující záznam přes **Hledat hráče**; změna čísla není důvodem k založení duplicity. ATM nemá nástroj na sloučení hráčů. Hráče lze propojit s existujícím účtem.

Po zavedení výběru pozice ze seznamu a upozornění na duplicitní číslo text doplnit.

### Sestava před zápasem

*Nepublikovat před vydáním samostatné sestavy.* Sestava obsahuje pouze výběr hráčů, počet vybraných, filtrování a uložení. Góly, asistence, tresty a skóre patří až do pozápasového Match reportu.

### Match report

Po zápase se přidávají jednotlivé události **Gól** a **Trest**. Skóre a statistiky se z nich počítají automaticky. Dnes report vede manažer ligy; manažer týmu může u zápasu bez reportu vyplnit statistiky svých hráčů. Pokud bude rozhodnuto, že události zapisuje i manažer týmu, doplnit jeho postup. Po zavedení výběru hráčů ze sestavy doplnit.

### Kalendář a události

Zápasy s termínem se v **Kalendáři** objeví samy. Manažer přidá **Trénink**, **Schůzku** nebo **Jiné** s názvem, začátkem, případně koncem, místem a popisem. Hráči odpovídají **Přijdu**, **Nepřijdu** nebo **Možná**; za hráče bez účtu odpovídá manažer.

### Nastavení týmu

Název, logo a barva týmu. Pozvání manažera a smazání týmu vidí jen manažer ligy týmu a administrátor. Týmová barva se používá jako akcent nebo automaticky hlídá kontrast (po vydání refreshe).

### Turnaje

**Správa turnajů** → **Série turnajů** → turnaj. Stavy **Koncept**, **Registrace**, **Skupinová fáze**, **Playoff**, **Dokončeno**. Záložky **Týmy** (u tenisu **Hráči**), **Skupiny**, **Výsledky**, **Playoff**. Týmy a hráči turnaje jsou samostatné a nesouvisí s ligou. Před **Vygenerovat playoff** zkontrolovat pořadí ve skupinách; smazání rozpisu skupin nebo pavouka nelze vrátit.

### Nejčastější otázky

- Proč nevidím svůj tým nebo ligu? – přihlášení jiným e-mailem než pozvánka.
- Proč se výsledek neprojevil v tabulce? – zápas není potvrzený.
- Proč se hráči nezapočítala událost? – oprava v zápase / Match reportu.
- Proč nemohu změnit statistiky zápasu? – zápas je potvrzený nebo má Match report.
- Proč tým nevidí zápas v rozpisu? – zápas nemá termín.
- Proč nemohu vygenerovat rozpis? – sezóna není v konceptu nebo má méně než dva týmy.
- Mohu spravovat více týmů nebo lig? – ano, pokud jste uvedeni jako manažer každého z nich.
- Co uvést při hlášení problému? – *až po vydání `/contact`*.

## Kontextové mapování

| Obrazovka | Článek |
|---|---|
| Dashboard | `/docs/rychly-start` |
| Context switcher | `/docs/role-a-opravneni` |
| Season overview | `/docs/sprava-sezony` |
| Games | `/docs/rozpis-zapasu` |
| Record result | `/docs/vysledky-a-statistiky` |
| Team overview | `/docs/sprava-tymu` |
| Roster | `/docs/profil-tymu-a-soupiska` |
| Line-up | `/docs/sestava-pred-zapasem` |
| Match report | `/docs/match-report` |
| Calendar | `/docs/kalendar-a-udalosti` |
| Settings | `/docs/nastaveni-tymu` |

Kontextový odkaz na nepublikovaný článek nezobrazovat.

## Stavy

### Loading

Zobrazit skeleton navigace a článku. Během načítání neproblikne falešný empty state.

### Prázdné hledání

`Pro tento výraz jsme nenašli žádný návod. Zkuste obecnější pojem nebo zobrazte všechny články.`

### Chyba

`Dokumentaci se nepodařilo načíst. Zkuste stránku obnovit.`

## Lokalizace a SEO

- Projektové pravidlo (`CLAUDE.md`): každý text rozhraní dokumentace – navigace, hledání, štítky, stavy, breadcrumb, title – musí být současně v `en.json` i `cs.json`.
- Obsah článků existuje česky i anglicky (`content.cs`, `content.en`) a vybírá se podle `i18n.language`. Do vydání musí být hotové obě verze.
- Slug bez diakritiky, společný pro oba jazyky.
- Title rootu: `Nápověda a dokumentace | ATM` (`Help and documentation | ATM`).
- Title článku: `{Název} | Nápověda ATM`.
- Title a meta description nastavovat přes `document` v efektu stránky – projekt nemá správu `<head>` a nová knihovna se nezavádí.
- Canonical URL a sitemap nejsou součástí první verze: ATM je SPA bez SSR, bez sitemap a bez rozhodnuté produkční domény.
- Analytika se nezavádí – aplikace žádnou nepoužívá.

## Akceptační kritéria

- [ ] `/docs` i přímé URL článků fungují po reloadu.
- [ ] Back/Forward zachovává očekávanou navigaci.
- [ ] Hledání funguje s diakritikou i bez ní.
- [ ] Nepublikované články nejsou viditelné, dohledatelné ani kontextově odkazované.
- [ ] Mobil nemá globální horizontální scroll.
- [ ] Aktivní článek používá `aria-current="page"`.
- [ ] Stránka funguje při 360, 390 a 430 px.
- [ ] Texty odpovídají skutečnému produkčnímu UI a oprávněním v `backend/src/services/access.ts`.
- [ ] Texty nepopisují `TEAM_MANAGER`, `LEAGUE_MANAGER` ani `TOURNAMENT_MANAGER` jako role na účtu.
- [ ] Doporučené články se řídí `user.manages`, ne `Role`.
- [ ] Každý publikovaný článek existuje česky i anglicky; všechny texty rozhraní jsou v obou locale souborech.
