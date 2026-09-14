# ATM – changelog, roadmapa a kontaktní formulář

## Cíl

Uživatelé mají na jednom místě vidět:

- co se v ATM skutečně změnilo;
- co se právě připravuje;
- které nápady se teprve zvažují;
- kam poslat dotaz, problém, stížnost nebo nápad.

Changelog nesmí být marketingová stránka bez konkrétních informací. Roadmapa nesmí vytvářet falešný závazek termínu.

## Výchozí stav (ověřeno 14. 9. 2026)

Nic z této specifikace dnes neexistuje a několik předpokladů původního návrhu v projektu chybí:

- **Verzování:** aplikace nemá verze vydání (`frontend/package.json` má `0.0.0`). Vydání se dnes rozlišují jen commity a PR.
- **Kanál podpory:** neexistuje žádný interní kanál ani adresa podpory. K dispozici je `backend/src/services/emailService.ts` pro odesílání e-mailů.
- **Analytika:** aplikace žádnou nepoužívá.
- **Rate limiting a nahrávání souborů:** backend nemá `express-rate-limit`, `helmet` ani `multer`.
- **Oprávnění:** `Role` je jen `ADMIN` / `USER`; oblasti se určují z `user.manages`. Filtry a štítky „Team Manager“ / „League Manager“ znamenají oblast aplikace, ne roli.
- **Už vydané funkce**, které nesmí být na roadmapě jako plán: týmový kalendář s docházkou, potvrzení zápisu s historií, skupiny v sezóně, viditelnost, bodování, archivace sezóny.

## Routy

- `/updates` – changelog a veřejná roadmapa.
- `/contact` – kontaktní formulář.

Lze použít jeden společný layout se záložkami `Novinky a plán` a `Kontakt`, ale každá část musí mít vlastní stabilní URL.

## Navigace

- Footer (`components/public/PublicFooter.tsx`): `Novinky` a `Kontakt` ve skupině Projekt.
- Uživatelské menu (`components/Navbar.tsx`, později společný admin shell): `Co je nového` s nenápadným indikátorem nepřečtených vydání.
- Admin nápověda: odkazy na dokumentaci a kontakt.
- Dashboard může po vydání zobrazit jeden kompaktní banner; uživatel jej může zavřít.

## Changelog

### Záložky

- `Vydané`
- `Připravujeme`

### Filtry

- Vše
- Správa týmu
- Správa ligy
- Turnaje
- Veřejný web
- Opravy

Na mobilu jsou filtry horizontálně posuvné uvnitř vlastní oblasti. Stránka samotná horizontálně nepřetéká.

### Vydaná změna

Každý záznam obsahuje:

- datum skutečného nasazení;
- verzi jen tehdy, pokud se zavede verzování (dnes neexistuje; v první verzi pole nezobrazovat);
- stručný název;
- jedno až tři uživatelsky formulované body;
- štítky dotčených rolí a částí aplikace;
- volitelný odkaz na dokumentaci.

Nepopisovat interní refaktoring bez uživatelského dopadu. Nepublikovat citlivé bezpečnostní detaily.

Příklad struktury. Záznamy se udržují jako data v repozitáři (TypeScript modul vedle obsahu dokumentace), česky i anglicky, a přidávají se ve stejném PR jako vydaná změna. Databáze ani administrace changelogu se v první verzi nezavádí.

```ts
type UpdatesAudience = "ALL" | "LEAGUE" | "TEAM" | "TOURNAMENT";

type ReleaseNote = {
  id: string;
  slug: string;
  releasedAt: string;         // datum merge do main
  version?: string;           // nepoužívat, dokud neexistuje verzování
  audiences: UpdatesAudience[];
  areas: string[];
  docsSlugs: string[];        // jen publikované články
  published: boolean;
  content: Record<"cs" | "en", {
    title: string;
    summary: string;
    items: string[];
  }>;
};
```

### Stav přečtení

Pokud je uživatel přihlášený, uloží se datum posledního zobrazeného vydání do nového pole `User.updatesSeenAt` (`DateTime?`) přes endpoint `POST /api/auth/updates-seen`. Indikátor nepřečtených = existuje publikované vydání s `releasedAt > updatesSeenAt`. Nepotřebujeme sledovat každý otevřený článek. Nepřihlášený uživatel uvidí chronologický seznam bez stavu přečtení.

## Veřejná roadmapa

### Povolené stavy

- `Ve vývoji` – funkce se aktivně implementuje.
- `Navrhujeme` – existuje schválený produktový návrh, ale práce nemusí být zahájena.
- `Zvažujeme` – nápad se vyhodnocuje a není slíbený.

### Co nezobrazovat

- procenta dokončení bez spolehlivého zdroje;
- přesné datum bez potvrzeného releasu;
- interní technické úkoly bez uživatelského dopadu;
- bezpečnostní nebo infrastrukturní detaily;
- automaticky každý ticket z interního backlogu.

### Text pod roadmapou

`Pořadí a rozsah se mohou změnit. Datum zveřejníme až ve chvíli, kdy je funkce připravená k vydání.`

### Datový model

```ts
type RoadmapStatus = "IN_DEVELOPMENT" | "DESIGNING" | "CONSIDERING";

type RoadmapItem = {
  id: string;
  status: RoadmapStatus;
  audiences: UpdatesAudience[];
  areas: string[];
  docsSlugs: string[];
  public: boolean;
  order: number;
  content: Record<"cs" | "en", { title: string; summary: string }>;
};
```

Zdroj položek: `docs/tier3/README.md` a tento balíček. Na roadmapu nepatří nic, co je už vydané (viz Výchozí stav), a nic, co bylo výslovně odloženo (např. billing, importy, plánované úlohy), pokud to není vědomé rozhodnutí.

Roadmapu spravovat odděleně od changelogu. Při vydání lze položku převést na release note, ale neupravovat zpětně historii publikovaných vydání.

## Kontaktní formulář

### Kategorie

- Dotaz
- Nahlásit problém
- Stížnost
- Nápad

Kategorie je povinná a ovlivní pomocný text, ne však jinou složitou větev formuláře.

### Pole

- Kategorie – povinná.
- Předmět – povinný.
- Popis – povinný.
- E-mail pro odpověď – volitelný pro anonymní podnět; povinný pouze tehdy, pokud uživatel požaduje odpověď.
- Příloha – volitelný screenshot, až ve druhé fázi.
- Technický kontext – volitelný explicitní checkbox.

### Technický kontext

Při zaškrtnutí lze přiložit pouze údaje potřebné pro řešení problému:

- aktuální interní route bez citlivých query parametrů;
- typ zařízení a rozměr viewportu;
- identifikátor buildu, pokud se zavede (dnes neexistuje – vynechat);
- které oblasti uživatel spravuje (`user.manages` – počty, ne ID) a zda je přihlášen.

Nepřikládat automaticky hesla, tokeny, obsah local storage, úplnou historii prohlížení ani jiné nesouvisející údaje.

### Pomocný text

`Neposílejte heslo ani jiné přihlašovací údaje.`

U technického problému požádat o:

1. co chtěl uživatel udělat;
2. co se skutečně stalo;
3. kde se problém objevil;
4. zda lze problém zopakovat.

### Odeslání

Po úspěchu zobrazit potvrzení na stejné stránce. Backend v první verzi číslo případu negeneruje; potvrzení proto žádné číslo neuvádí. Nevymýšlet číslo na klientovi.

Pokud byl zadán e-mail, může potvrzení říct: `Potvrzení jsme poslali na uvedený e-mail.` Použít tento text pouze po skutečném odeslání.

### Chyba

- zachovat vyplněný text;
- popsat, že zpráva nebyla odeslána;
- nabídnout `Zkusit znovu`;
- neodeslat dvojí ticket při opakovaném klepnutí;
- po síťové chybě neukázat falešné potvrzení.

## Mobilní formulář

- všechny dotykové cíle minimálně 48 × 48 px;
- kategorie jako mřížka 2 × 2;
- běžný text vstupů minimálně 16 px;
- nativní klávesnice pro e-mail;
- primární tlačítko přes dostupnou šířku;
- sticky tlačítko jen u dlouhého formuláře a pouze pokud nezakrývá pole;
- žádný horizontální scroll;
- fungovat při 360, 390 a 430 px.

## Dostupnost z aplikace

Přihlášený uživatel přicházející z administrace může dostat předvyplněnou kategorii a bezpečný kontext:

```text
/contact?type=problem&from=team-roster
```

Query parametr nesmí obsahovat e-mail, token ani celý uživatelský text. Formulář stále jasně ukáže, co bude odesláno.

## Správa podnětů

Nový model v Prisma schématu (`SupportTicket`, tabulka `support_tickets`), nový route soubor `backend/src/routes/contact.ts` a stránka v administraci `/admin` (seznam, detail, změna stavu). Odeslání je veřejné (`optionalAuth`); přihlášenému uživateli se uloží `userId`.

Minimální backendový stav:

- `NEW`
- `IN_PROGRESS`
- `WAITING_FOR_USER`
- `RESOLVED`
- `CLOSED`

Uživateli není nutné v první verzi stav zobrazovat v účtu, ale musí existovat interní způsob, jak zprávy neztratit a rozlišit.

Každý ticket obsahuje:

- kategorii;
- předmět;
- zprávu;
- kontaktní e-mail, pokud byl poskytnut;
- čas vytvoření;
- bezpečný technický kontext, pokud s ním uživatel souhlasil;
- stav;
- interní historii zpracování.

## Ochrana proti zneužití

- serverová validace;
- rate limiting – v projektu zatím není; buď přidat `express-rate-limit` jen na `POST /api/contact`, nebo jednoduchý limit v paměti procesu (rozhodnutí v implementačním plánu);
- honeypot pro běžné roboty;
- CAPTCHA v první verzi nezavádět;
- limit délky a velikosti přílohy;
- kontrola typu souboru;
- ochrana před HTML/script injection;
- e-mailové potvrzení nesmí obsahovat nebezpečně vykreslený vstup uživatele.

## Oznámení

- Nový ticket odešle e-mail přes `emailService` na adresu z nové proměnné prostředí `SUPPORT_EMAIL`; pokud není nastavená, na všechny aktivní účty s rolí `ADMIN`. Jiný interní kanál podpory neexistuje.
- Potvrzení uživateli pouze při zadaném e-mailu.
- Changelog notifikace jsou dobrovolné a vypnutelné.
- Neposílat oznámení ke každé roadmapové úpravě.

## Přístupnost

- jeden H1;
- logická hierarchie H2/H3;
- fieldset a legend pro kategorii;
- každý input má label;
- chyby jsou propojené s konkrétními poli;
- souhrn chyby má `role="alert"`;
- potvrzení o úspěchu je oznámeno vhodným live regionem;
- formulář lze vyplnit klávesnicí i screen readerem;
- fokus po chybě přejde na první chybné pole nebo souhrn.

## Analytika

Aplikace analytiku nepoužívá, proto se v této vlně nic neměří a žádný nástroj se nezavádí. Pokud se analytika později zavede, nikdy jí neposílat předmět, popis, e-mail ani přílohu.

## Akceptační kritéria

- [ ] Vydané a Připravujeme mají samostatný stav a stabilní URL.
- [ ] Changelog obsahuje pouze skutečně nasazené změny.
- [ ] Roadmapa nerozepisuje neověřené datum ani procento dokončení.
- [ ] Filtry fungují i na mobilu bez globálního horizontálního scrollu.
- [ ] Formulář podporuje čtyři požadované kategorie.
- [ ] E-mail je jasně označený jako volitelný nebo povinný podle skutečného chování.
- [ ] Technický kontext se přikládá pouze po explicitním souhlasu.
- [ ] Dvojí klepnutí nevytvoří dva tickety.
- [ ] Chyba zachová rozepsanou zprávu.
- [ ] Úspěšné potvrzení se zobrazí jen po potvrzení backendu.
- [ ] Formulář je použitelný při 360, 390 a 430 px.
- [ ] Na roadmapě není žádná už vydaná funkce.
- [ ] Changelog nezobrazuje čísla verzí, dokud neexistuje verzování.
- [ ] Nový ticket dorazí e-mailem na `SUPPORT_EMAIL` nebo administrátorům a je vidět v `/admin`.
- [ ] Všechny texty rozhraní jsou v `en.json` i `cs.json`; záznamy changelogu a roadmapy existují česky i anglicky.

