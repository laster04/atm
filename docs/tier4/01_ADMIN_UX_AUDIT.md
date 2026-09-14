# ATM administrace – UI/UX audit a návrh refreshu

Datum kontroly: 14. 9. 2026  
Rozsah: přihlášený účet, který spravuje ligu i tým (role `USER`, oprávnění z manažerských vazeb – viz níže), desktop a mobil 390 × 844 px.  
Způsob kontroly: pouze navigace a otevírání formulářů; žádná data nebyla uložena ani změněna.

> **Závazná produktová priorita:** Team Manager musí být navržený mobile-first. Každý jeho hlavní úkol musí být pohodlně dokončitelný jednou rukou na telefonu o šířce 360–430 px. Desktopová varianta nesmí určovat mobilní workflow. Podrobná pravidla jsou v `02_TEAM_MANAGER_MOBILE_SPEC.md`.

## Shrnutí

Nové detailní obrazovky League Managera a Team Managera už mají velmi dobrý základ. Jsou čisté, rychle čitelné a na rozdíl od přihlašovací stránky působí jako moderní pracovní aplikace. Největší slabinou není samotný vizuál, ale nekonzistentní informační architektura a několik kritických funkčních problémů.

Nejprve je nutné opravit tři problémy:

1. `New season` shodí stránku do prázdného stavu (ověřeno na mobilu; příčina v kódu platí pro všechny šířky).
2. Administrace a veřejná část ukazují u stejných zápasů časy posunuté o dvě hodiny.
3. Mobilní Team Manager navigace zalomí pátou položku `Settings` pod viewport, takže se k ní uživatel běžně nedostane.

Teprve potom doporučuji sjednotit shell, kontext a pracovní postupy.

> **Model oprávnění v ATM:** `Role` má jen hodnoty `ADMIN` a `USER`. Role `LEAGUE_MANAGER`, `TEAM_MANAGER` ani `TOURNAMENT_MANAGER` neexistují. Kdo co smí, plyne z vazeb `League.managerId`, `Team.managerId` a `TournamentSeries.managerId` (`backend/src/services/access.ts`); frontend je zná z `user.manages` a zobrazuje štítky **Manažer ligy**, **Manažer týmu**, **Manažer turnaje**. Slovo „role“ v tomto dokumentu znamená právě tyto štítky, ne hodnotu na účtu.

## Ověření proti kódu (14. 9. 2026)

Audit vznikl proklikáním aplikace. Nálezy byly následně porovnány se zdrojovým kódem:

| Nález | Stav | Příčina / poznámka |
|---|---|---|
| Pád `New season` | **potvrzeno, všechny šířky, i v `/admin`** | `SeasonFormModal` (`pages/Admin/components/seasons/`) začíná `DialogHeader`/`DialogTitle`, ale `pages/SeasonManager/Screen.tsx` ani `pages/Admin/pages/SeasonsPage.tsx` ho neobalí do `<Dialog><DialogContent>`. Stejně selže `Add Season` v administraci. Stejný vzor (modal z `/admin` bez obalu) mají i `TeamFormModal` v `SeasonManager/components/TeamsTab.tsx` (**Přidat tým**) a `GenerateScheduleModal` v `SeasonManager/components/MoreTab.tsx` (**Vygenerovat rozpis**) – podle kódu musí padat také; v prohlížeči neověřeno. |
| Posun času o 2 h | **potvrzeno** | V aplikaci existují dvě konvence. `utils/date.ts` (`formatGameDateTime`, `formatGameTime`, `formatDateShort` s `timeZone: 'UTC'`, `formatDateTimeForInput`) bere uložený čas jako „nástěnný čas v UTC“ – používá ho veřejná část a `/admin`. Správa sezóny (`SeasonManager/components/util.ts` – `toLocalInput`/`fromLocalInput`, `toLocaleTimeString`) ukládá skutečný okamžik z lokálního času prohlížeče. Existující data jsou tedy smíšená podle toho, kde byl termín zadán. |
| Zalomená mobilní navigace týmu | **potvrzeno** | `pages/TeamManager/Detail.tsx`: `grid grid-cols-4` pro pět záložek. |
| Karta sezóny vede na veřejný detail | **potvrzeno** | `Home/components/ActiveSeasonsSection.tsx` odkazuje na `/season-detail/:id`. |
| Dva nezávislé zdroje skóre | **částečně neplatí** | Model je už event-first: jakmile má zápas zápis o utkání, `Game.eventsAuthoritative` zamkne ruční skóre (API vrací 409) a `ResultSheet` zobrazí dopočtené skóre. Zbývá mezera u zápasů **bez** zápisu: ruční skóre manažera ligy a statistiky od manažera týmu (`HockeyGameStatistic`) se proti sobě nevalidují. |
| `common.name` | **potvrzeno** | Klíč chybí v `en.json` i `cs.json`; použit v `TeamManager/components/RosterTab.tsx`. |
| Sestava smíchaná se statistikami | **potvrzeno** | Sestava není samostatná data: „hráč v sestavě“ = existence řádku `HockeyGameStatistic` (`GameStatsPage.tsx`). Jakmile zápas dostane zápis o utkání nebo je potvrzen, API zakáže i změnu sestavy. |
| Týmová barva jako pozadí shellu | **potvrzeno** | `TeamManager/Detail.tsx` – `backgroundColor: localColor`. |
| Potvrzení `Send round summary` | **již vyřešeno** | `RoundSummarySheet` ukazuje náhled, počet příjemců a opakované odeslání vyžaduje výslovné potvrzení. |
| Riziko `Generate schedule` | **potvrzeno, upřesněno** | Generovat lze jen v sezóně ve stavu `DRAFT`; opakované generování smaže **všechny** zápasy sezóny. Počet dotčených zápasů se neukazuje. |
| Pozvání manažera | **nový nález** | Tlačítko v `TeamManager/components/SettingsTab.tsx` se zobrazí každému manažerovi jakékoli ligy (`isSeasonManager()`), ale API (`requireTeamAdmin`) pustí jen manažera ligy, ve které tým hraje. Manažer týmu sám pozvat nemůže. |
| Error boundary | **potvrzeno** | Ve frontendu žádná error boundary neexistuje. |

## Auditovaný rozsah

### Společné obrazovky

- `/dashboard`
- přihlášené uživatelské menu
- přechod mezi veřejnou částí a administrací

### League Manager

- `/season-management/my-seasons`
- `/season-management/:seasonId`
- Season
- Games
- Teams
- Table
- More
- hromadné nastavení termínů kola
- formulář výsledku
- Match report

### Team Manager

- `/team-management/:teamId`
- Overview
- Roster
- detail hráče
- Add Player
- Schedule
- Calendar a New event
- Settings
- Set line-up

## Prioritizovaný backlog

| Priorita | Problém | Dopad | Doporučení |
|---|---|---|---|
| P0 | `New season`, `Add Season`, `Přidat tým` a `Vygenerovat rozpis` vykreslí prázdnou stránku (poslední dvě zjištěno z kódu) | Manažer ligy nemůže založit sezónu, přidat tým ani vygenerovat rozpis | Opravit strukturu dialogu a přidat error boundary/test otevření formuláře |
| P0 | Veřejná část ukazuje 18:00/19:30, administrace 20:00/21:30 | Riziko chybného času zápasu | Sjednotit ukládání a renderování časové zóny; přidat integrační test stejného zápasu na obou površích |
| P0 | Team Manager mobilní navigace zalomí `Settings` do skrytého druhého řádku | Nastavení týmu je na mobilu nedostupné | Vynutit jeden řádek pěti položek nebo přesunout Settings do `More` |
| P1 | Dashboard posílá sezónu do veřejného detailu, tým do administrace | Stejné typy karet se chovají rozdílně | Sezónní karta má otevírat správu; `Veřejná stránka` má být sekundární akce |
| P1 | Spravované oblasti (liga, tým, turnaj) jsou jen štítky uvnitř menu | Uživatel neví, nad čím právě pracuje | Zavést trvalý přepínač kontextu (liga / tým / série) |
| P1 | `Set line-up` kombinuje sestavu se statistikami zápasu | Před zápasem se nabízí góly, asistence a tresty; stránka je příliš dlouhá | Rozdělit na předzápasovou sestavu a pozápasový Match report |
| P1 | U zápasu bez Match reportu se ruční skóre nevaliduje proti statistikám hráčů | Možnost rozporu mezi skóre a součtem gólů | Zdroj pravdy už je event-first (`eventsAuthoritative`); doplnit validaci pro zápasy bez reportu |
| P1 | `common.name` se zobrazuje jako název řazení soupisky | Viditelná lokalizační chyba | Doplnit překlad a test chybějících překladových klíčů |
| P1 | Část datumových a číselných polí nemá přístupný název | Slabá použitelnost pro asistivní technologie | Doplnit skutečné labely nebo `aria-label` včetně kontextu zápasu/období |
| P1 | Mobilní tlačítka Zpět jsou bez přístupného názvu | Screen reader oznámí pouze nepojmenované tlačítko | Zachovat `aria-label="Zpět"` i po skrytí textu |
| P2 | Dashboard, My Seasons a detailní správa používají různé shelly | Administrace působí jako několik slepených aplikací | Zavést jeden společný admin shell |
| P2 | Výchozí dashboard je generický a velmi řídký | Nevede manažera k dalšímu úkolu | Zobrazit role-specific úkoly, upozornění a rychlé akce |
| P2 | Některé overlaye nemají sémantiku dialogu | Horší fokus, Escape a screen reader navigace | Použít jednotnou dialog/drawer komponentu s titulkem a focus trapem |
| P2 | Games vypisuje desítky téměř stejných karet | Dlouhé skenování a vysoká interakční zátěž | Seskupit podle kol, přidat kompaktní režim a sticky filtry |
| P2 | Team color ovládá velkou plochu sidebaru | Libovolná barva může porušit kontrast a vizuálně rozbít shell | Sidebar nechat neutrální; týmovou barvu používat jako akcent, nebo automaticky hlídat kontrast |
| P2 | Add Player používá volný text pro Position a nenabízí kontrolu duplicity | Nekonzistentní data a duplicitní hráči | Sportovní pozici vybírat ze seznamu; před založením vyhledat existující hráče |
| P2 | `Pozvat manažera` je v nastavení týmu vidět i manažerům jiných lig | Akce skončí chybou 403 | Zobrazit jen tomu, kdo tým administruje (manažer ligy týmu, admin) |
| P3 | Dokumentace není dostupná kontextově z administrace | Uživatel musí opustit aktuální úkol a hledat návod | Přidat odkaz `?` směrující na odpovídající článek `/docs` |

## Kritické nálezy

### 1. Pád formuláře New season

Na stránce `My Seasons` bylo při mobilním viewportu otevřeno tlačítko `New season` (chyba ale nastane na jakékoli šířce). Obsah aplikace okamžitě zmizel a zůstala prázdná světlá plocha na stejné URL.

Konzole hlásí:

```text
Error: DialogTitle must be used within Dialog
```

Příčina: `SeasonFormModal` počítá s obalem `Dialog`, ale `pages/SeasonManager/Screen.tsx` i `pages/Admin/pages/SeasonsPage.tsx` ho vykreslují napřímo – chyba se týká i `Add Season` v administraci. Oprava musí zahrnovat:

- správné vložení titulku do kořenové komponenty dialogu;
- zachycení renderovací chyby pomocí error boundary;
- komponentový test otevření a zavření dialogu;
- end-to-end test vytvoření sezóny alespoň do kroku před finálním uložením;
- kontrolu desktopu i mobilu.

### 2. Dvouhodinový rozdíl v časech zápasů

U totožných zápasů byly ověřeny tyto hodnoty:

| Zápas | Veřejný rozpis | Administrace |
|---|---:|---:|
| Cannoners – SK Kámen | 18:00 | 20:00 |
| AC Buk – HC Roso | 19:30 | 21:30 |

Rozdíl přesně odpovídá letnímu posunu časové zóny Europe/Prague. Příčina je potvrzená v kódu (viz tabulka Ověření proti kódu): veřejná část a `/admin` formátují s `timeZone: 'UTC'`, správa sezóny s lokální zónou prohlížeče.

Doporučené pravidlo:

- v databázi ukládat okamžik v UTC;
- zónu zobrazení určit explicitně – v první verzi jedna zóna aplikace `Europe/Prague`, případně později pole časové zóny u ligy (dnes neexistuje);
- jednorázově převést existující zápasy zadané přes `/admin` (uložené jako nástěnný čas), jinak se po sjednocení posunou;
- při editaci převést hodnotu do lokální zóny soutěže;
- při uložení převést zpět do UTC;
- veřejná část i administrace musí používat stejnou funkci pro formátování;
- testovat zimní i letní čas.

### 3. Nedostupné Settings na mobilu

Team Manager má pět položek spodní navigace. Při šířce 390 px má každá položka šířku přibližně 98 px. První čtyři položky zaplní celý řádek a `Settings` se zalomí do druhého řádku pod spodní hranici viewportu.

Výsledek:

- `Settings` je jen částečně vidět;
- nelze jej běžně stisknout;
- stránku kvůli fixní navigaci nelze doscrollovat tak, aby byla položka dostupná.

Doporučené řešení:

- grid o pěti stejných sloupcích `repeat(5, minmax(0, 1fr))`;
- kratší labely a menší horizontální padding;
- alternativně čtyři hlavní položky a `More`, které obsahuje Settings;
- přidat `padding-bottom` hlavnímu obsahu podle výšky navigace a safe-area insetu.

## Společný dashboard

### Co funguje

- Dobře čitelná karta vlastního týmu.
- Nejbližší soupeř a datum jsou viditelné bez dalšího kliknutí.
- Aktivní sezóna je zobrazena samostatně.
- Mobilní rozložení samotného obsahu nepřetéká horizontálně.

### Co upravit

- H1 `Amateur Team Manager` je příliš obecný. V přihlášené části má být například `Přehled` nebo osobní pozdrav.
- Popis opakuje marketingový obsah veřejného webu místo pracovního kontextu.
- Účet spravuje ligu i tým, ale dashboard obě oblasti pouze smíchá bez vysvětlení.
- Karta týmu otevře administraci, karta sezóny otevře veřejný detail. Toto chování není předvídatelné.
- `View all seasons` také vede do veřejného seznamu, zatímco správa je schovaná v menu `My Seasons`.
- Modrý CTA přes téměř celou šířku desktopu je vizuálně nepřiměřený jeho významu.
- Ovládání souhrnných e-mailů je globální nastavení účtu, ale vypadá jako součást sezónního obsahu.

### Cílový dashboard

Pro uživatele, který spravuje více oblastí, zobrazit nahoře přepínač:

```text
Manažer ligy | Okresni přebor JH | 2026–2027
Manažer týmu | HC Roso            | 2026–2027
```

Pod ním má být obsah pro zvolenou oblast. Nabídka se sestaví z `user.manages`; nejde o volbu role na účtu.

#### Dashboard manažera ligy

- 43 zápasů bez termínu;
- nejbližší zápasy;
- výsledky čekající na zápis nebo kontrolu;
- průběh sezóny;
- rychlé akce `Nastavit termíny`, `Zadat výsledek`, `Spravovat týmy`;
- sekundární odkaz `Zobrazit veřejnou stránku`.

#### Dashboard manažera týmu

- nejbližší zápas;
- připravenost sestavy;
- hráči s neúplnými údaji;
- nejbližší týmové události;
- rychlé akce `Nastavit sestavu`, `Upravit soupisku`, `Přidat událost`.

## League Manager

### Co funguje

- Desktopový tmavě modrý sidebar je klidný, čitelný a odpovídá pracovnímu nástroji.
- Mobilní navigace se správně převádí na jeden spodní řádek pěti položek.
- Úvod sezóny dobře zobrazuje tři základní metriky.
- Blok `Needs your attention` překládá problém do konkrétní akce.
- Visibility a Next up jsou stručné a dobře skenovatelné.
- Games má smysluplné filtry `No date`, `Dated`, `Played` a filtr kol.
- Table transparentně vysvětluje abecední pořadí před prvním výsledkem.
- More sdružuje méně časté a rizikovější operace.

### Co upravit

- `My Seasons` používá jinou hlavičku než detail sezóny a na desktopu schovává navigaci do hamburgeru.
- Návratové tlačítko neříká, kam uživatel půjde; lepší je breadcrumb nebo `Všechny sezóny`.
- Seznam 43 zápasů bez data je dlouhý. Defaultně seskupit podle kola a umožnit sbalit dokončená nebo nepoužívaná kola.
- `Generate schedule` jasně říká, že nahradí fixtures, ale riziko musí být popsáno ještě před potvrzením včetně počtu dotčených zápasů a výsledků.
- `Send round summary` je skutečné odeslání e-mailů. Potvrzení musí uvést příjemce a obsah.
- Formulář hromadných termínů nemá přístupné názvy u date/time polí.
- Mobilní hromadné termíny jsou použitelné, ale 15 velkých karet v jednom draweru je dlouhých. Pomohlo by vyplnění výchozího data/času a potvrzení jen změněných zápasů.

### Výsledek a Match report

Formulář `Record result` umožňuje:

- upravit konečné skóre pomocí plus/minus;
- doplnit skóre třetin;
- změnit stav zápasu;
- otevřít samostatný Match report s góly a tresty.

Match report současně tvrdí, že skóre, třetiny a hráčské statistiky se počítají z událostí. Produkt proto musí jasně určit zdroj pravdy.

Doporučení:

1. **Event-first varianta:** skóre a statistiky se počítají z gólových událostí. Ruční skóre je dostupné pouze jako jednoduchý režim bez detailního reportu.
2. **Score-first varianta:** skóre je primární a Match report se validuje proti němu. Při nesouladu nelze zápas potvrdit bez vysvětlení.

Nedoporučuje se ponechat dvě nezávislá editovatelná skóre bez validace.

## Team Manager

### Co funguje

- Přehled má jasnou prioritu nejbližšího zápasu.
- Týmová barva dává prostředí identitu.
- Statistiky výher, remíz, proher a bodů jsou stručné.
- Soupiska podporuje hledání a řazení.
- Schedule rozlišuje nadcházející, odehrané a ostatní zápasy.
- Calendar má jednoduchý empty state a rychlé založení události.
- Settings obsahuje náhled týmové barvy před použitím.
- Detail hráče ukazuje souhrn statistik a umožňuje propojení s účtem.

### Co upravit

- Týmová barva nemá řídit celou navigační plochu bez automatické kontroly kontrastu. U některých barev mohou zmizet texty a ikony.
- V soupisce se místo přeloženého názvu zobrazuje `common.name`.
- Většina hráčů má `No position set`; rozhraní nenabízí hromadné doplnění nebo filtr neúplných profilů.
- Dva hráči mohou mít stejné číslo bez viditelného upozornění.
- Position je volný text, což může vytvořit několik názvů stejné pozice.
- Add Player začíná nadpisem úrovně H4 bez hlavního nadpisu stránky.
- Formulář události nemá přístupný label u data a času.
- Settings je na mobilu kvůli zalomení navigace nedostupné.
- Pozvání manažera je důležitá bezpečnostní akce a má jasně ukázat, k jakému týmu a oprávnění bude uživatel pozván.

### Refresh Set line-up

Aktuální obrazovka zobrazuje pro všech 17 hráčů současně:

- checkbox sestavy;
- počet gólů;
- počet asistencí;
- počet trestů;
- tři páry tlačítek plus/minus.

To znamená 51 číselných ovladačů i před začátkem zápasu. Na mobilu je stránka přes 2 200 px vysoká. Text `All changes saved` a současně viditelné neaktivní tlačítko `Save` navíc působí rozporně.

Doporučený nový postup:

#### Před zápasem – Line-up

- seznam hráčů s checkboxem;
- vyhledávání;
- `Vybrat všechny aktivní`;
- počet `Vybráno 0 z 17`;
- volitelně brankář/kapitán podle pravidel sportu;
- jediná akce `Uložit sestavu`;
- žádné góly, asistence ani tresty.

#### Po zápase – Match report

- pracovat primárně jen s hráči ze sestavy;
- přidávat jednotlivé události `Gól`, `Asistence`, `Trest`;
- možnost vybrat hráče mimo sestavu pouze s upozorněním;
- průběžně ukazovat skóre a kontrolu součtů;
- historie změn.

## Responzivita

### Dobré

- League Manager detail používá na desktopu sidebar a na mobilu spodní navigaci.
- Obsah sezónního přehledu se při 390 px vejde bez horizontálního scrollu.
- Týmový overview se dobře skládá do jedné mobilní osy.
- Dlouhé formuláře mají sticky spodní akční lištu.

### Nutné opravy

- Team Manager spodní navigace musí zůstat v jednom řádku.
- Sticky lišty musí počítat se `safe-area-inset-bottom`.
- Obsah nesmí být zakrytý spodní navigací nebo Save lištou.
- Dialogy a drawery musí mít jasný titul, pojmenované tlačítko zavření a vlastní scroll.
- Na 360 px zkontrolovat zejména časové formuláře, plus/minus ovladače a dlouhé české názvy týmů.

## Přístupnost

Konkrétní nálezy:

- mobilní tlačítko Zpět je v DOM bez názvu;
- date/time vstupy v hromadném plánování nemají label ani `aria-label`;
- period score spinbuttony nemají název typu `1. třetina – domácí`;
- plus/minus u výsledku nerozlišuje tým v přístupném názvu;
- některé overlaye nejsou označené jako dialog;
- Add Player používá nesprávnou hierarchii nadpisů;
- neaktivní Save používá velmi světlou barvu a je potřeba ověřit kontrast;
- dynamické změny článku, tabulky nebo výsledku musí být vhodně oznámené.

Doporučené názvy ovladačů:

```text
Zvýšit skóre týmu Cannoners
Snížit skóre týmu SK Kámen
1. třetina – Cannoners
Datum a čas zápasu HC Roso – Jiskra Třeboň
Zavřít nastavení termínů
Zpět na přehled týmu
```

## Společný cílový admin shell

### Desktop

- neutrální tmavě modrý sidebar;
- logo a návrat na dashboard nahoře;
- trvalý context switcher pod logem;
- barevný akcent týmu pouze na ikoně, levém proužku nebo aktivní položce;
- hlavní navigace podle zvoleného kontextu;
- uživatelské menu a nápověda v pravé části horní lišty.

### Mobil

- kompaktní horní lišta s názvem kontextu a přepínačem;
- maximálně pět položek v jednom řádku spodní navigace;
- méně časté funkce pod `Více`;
- žádné skryté nebo zalomené položky;
- respektovat safe area.

### Context switcher

Přepínač má řešit tři úrovně bez zbytečného kroku:

```text
Oblast (liga / tým / série turnajů) → konkrétní liga, tým nebo série → sezóna
```

Příklad:

```text
Manažer ligy / Okresni přebor JH / 2026–2027
Manažer týmu / HC Roso / 2026–2027
```

Poznámky k datovému modelu:

- Oblasti se neberou z `Role`, ale z manažerských vazeb (`user.manages`, seznamy spravovaných lig, týmů a sérií). Administrátor vidí vše.
- Sezóna je vlastnost ligy. Tým není vázaný na jednu sezónu (`SeasonTeam`), proto se u týmu zobrazuje sezóna, ve které právě hraje, a volba sezóny je jen filtr.
- Přepínač nemění oprávnění – server dál ověřuje každý požadavek sám.

Po přepnutí kontextu se mění navigace i dashboard. Uživatel musí vždy vidět, zda právě upravuje ligu nebo tým.

## Napojení nové dokumentace

Do admin shellu přidat ikonu `?` a z jednotlivých obrazovek směrovat na konkrétní návody:

| Obrazovka | Dokumentace |
|---|---|
| Dashboard | `/docs/rychly-start` |
| Context switcher | `/docs/role-a-opravneni` |
| Season overview | `/docs/sprava-sezony` |
| Games | `/docs/rozpis-zapasu` |
| Record result / Match report | `/docs/vysledky-a-statistiky` |
| Team overview | `/docs/sprava-tymu` |
| Roster / Add Player | `/docs/profil-tymu-a-soupiska` |
| Set line-up | `/docs/sestava-pred-zapasem` |
| Match report | `/docs/match-report` |
| Tournament administration | `/docs/turnaje-skupiny-a-playoff` |

Kontextový odkaz může obsahovat kotvu, například `/docs/vysledky-a-statistiky#zapis-vysledku`.

## Doporučené pořadí realizace

### Fáze 1 – stabilita

1. Opravit pád New season.
2. Opravit časové zóny.
3. Opravit Team Manager mobilní navigaci.
4. Doplnit chybějící překlad `common.name`.
5. Doplnit přístupné názvy kritických ovladačů.

### Fáze 2 – informační architektura

1. Zavést společný admin shell.
2. Přidat context switcher.
3. Upravit dashboard podle spravované oblasti.
4. Sjednotit směrování karet do administrace a na veřejný detail.

### Fáze 3 – klíčové workflow

1. Rozdělit Line-up a Match report.
2. Doplnit validaci skóre u zápasů bez Match reportu (event-first model už existuje).
3. Zjednodušit dlouhý seznam zápasů a hromadné termíny.
4. Přidat prevenci duplicit hráčů a strukturované pozice.

### Fáze 4 – nápověda a polish

1. Implementovat `/docs` podle připraveného briefu.
2. Přidat kontextovou nápovědu do adminu.
3. Dokončit lokalizaci – každý text v `en.json` i `cs.json`.
4. Projít kontrast všech týmových barev.
5. Doplnit regresní testy desktopu a mobilu.

## Definition of Done pro refresh

- Veřejný a administrační detail stejného zápasu ukazuje identický lokální čas.
- Uživatel, který spravuje více oblastí, vždy vidí aktivní kontext – ligu nebo tým a sezónu.
- Každá dashboardová karta jasně rozlišuje `Spravovat` a `Veřejná stránka`.
- Všechny položky mobilní navigace jsou viditelné a dosažitelné při 360 a 390 px.
- New season, Add Player, New event, Record result a Match report lze otevřít i zavřít bez prázdné stránky.
- Line-up neobsahuje pozápasové statistiky.
- Výsledek a Match report nemohou vytvořit dvě rozdílná skóre.
- Kritická pole a tlačítka mají kontextové přístupné názvy.
- Administrace používá jeden společný shell a konzistentní loading, empty a error stavy.
- Každá hlavní administrační obrazovka nabízí odkaz na odpovídající dokumentaci.
- Všechny hlavní úkoly Team Managera projdou mobilním scénářem z `02_TEAM_MANAGER_MOBILE_SPEC.md` při šířkách 360, 390 a 430 px.
