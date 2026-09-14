# ATM Team Manager – závazná mobile-first specifikace

## Produktové pravidlo

Správa týmu je primárně mobilní funkce. Manažer ji často používá u střídačky, v šatně, v hale nebo cestou na zápas. Musí být možné rychle:

- zkontrolovat nejbližší zápas;
- vybrat sestavu;
- najít nebo upravit hráče;
- zkontrolovat týmový rozpis;
- přidat týmovou událost;
- po zápase doplnit nebo ověřit report;
- otevřít nastavení týmu.

Žádný z těchto úkolů nesmí vyžadovat desktop, hover, přesné klikání na malý prvek ani horizontální posun celé stránky.

## Výchozí stav a omezení modelu (ověřeno 14. 9. 2026)

Specifikace popisuje cílový stav. Proti současné aplikaci platí:

- **Kdo je manažer týmu:** uživatel uvedený v `Team.managerId`. Není to role na účtu. Tým může spravovat také manažer ligy, ve které tým hraje, a administrátor (`canManageTeam`).
- **Co manažer týmu nesmí** (`canAdministerTeam`, `requireTeamAdmin`): smazat tým, pozvat nebo změnit manažera, odebrat tým ze sezóny. Termíny, skóre, rozpis, Match report a potvrzení zápisu patří manažerovi ligy (`canManageGame`, `canManageMatchEvent`).
- **Dnešní záložky:** `Přehled`, `Soupiska`, `Rozpis`, `Kalendář`, `Nastavení` (`TeamManager/Detail.tsx`, mobilní navigace je chybně `grid-cols-4`).
- **Sestava** se dnes neukládá samostatně. Hráč je „v sestavě“, pokud k zápasu existuje jeho řádek `HockeyGameStatistic` se statistikami. Po vzniku Match reportu (`eventsAuthoritative`) nebo po potvrzení zápasu API zakáže zápis, takže nejde měnit ani sestava.
- **Hráč** má pole `name`, `number`, `position` (volný text), `bornYear`, `note` a volitelné propojení s účtem (`userId`). Nemá příznak aktivity, kapitána ani brankáře a čísla nejsou unikátní.
- **Tým není vázaný na jednu sezónu** (`SeasonTeam`); „aktivní sezóna“ je sezóna, ve které tým právě hraje.
- **Kalendář a docházka už existují** (`TeamEvent`, `Attendance`: `Přijdu` / `Nepřijdu` / `Možná` / `Bez odpovědi`).
- Aplikace nemá service worker ani offline cache.

## Podporované mobilní šířky

Povinně ověřit:

- 360 px – malý Android;
- 390 px – běžný moderní telefon;
- 430 px – větší telefon;
- orientaci na výšku;
- zvětšení textu alespoň na 200 % bez ztráty hlavní funkce.

Landscape je sekundární, ale nesmí se rozpadnout nebo skrýt navigaci.

## Globální mobilní shell

### Horní lišta

Musí obsahovat:

- jednoznačný návrat;
- název aktivního týmu;
- aktivní sezónu;
- případně malé menu dalších akcí.

Tlačítko návratu musí mít přístupný název, například `Zpět na přehled týmů`. Samotná šipka bez názvu není přípustná.

### Spodní navigace

Použít maximálně pět položek v jediném řádku. Navigace se nikdy nesmí zalomit.

Doporučené položky:

1. Přehled
2. Soupiska
3. Zápasy
4. Kalendář
5. Více

Do `Více` přesunout:

- Nastavení týmu;
- pozvání manažera – **jen pro toho, kdo tým administruje** (manažer ligy týmu, administrátor); manažer týmu tuto položku nevidí;
- veřejný profil týmu;
- nápovědu;
- méně časté administrativní funkce.

Technické požadavky:

- jeden řádek `repeat(5, minmax(0, 1fr))`;
- žádné `flex-wrap`;
- minimální výška dotykového cíle 48 px;
- respektovat `env(safe-area-inset-bottom)`;
- obsah stránky musí mít spodní padding podle skutečné výšky navigace;
- aktivní položka je označená ikonou, textem i barvou;
- všechny názvy se musí vejít při šířce 360 px.

## Obecná pravidla ovládání

- Primární dotykové cíle minimálně 48 × 48 px.
- Mezi dvěma nebezpečnými nebo protichůdnými akcemi alespoň 8 px.
- Hlavní akce je ve snadno dosažitelné dolní části obrazovky.
- Maximálně jedna sticky akční lišta současně.
- Sticky akce nesmí zakrývat poslední řádek obsahu.
- Běžný text minimálně 16 px; pomocné texty minimálně 13 px s dostatečným kontrastem.
- Žádné ovládání dostupné pouze přes hover.
- Žádný horizontální scroll celé stránky.
- Horizontální scroll uvnitř tabulky použít jen tehdy, když nelze informace převést na mobilní karty.
- Uživatel musí vždy vidět, zda se změny ukládají automaticky, nebo až tlačítkem.
- Nepoužívat současně text `Vše uloženo` a samostatné tlačítko `Uložit`, pokud jejich vztah není jednoznačný.
- Po návratu z detailu zachovat předchozí filtr, pozici scrollu a rozepsaná bezpečně uložená data.

## 1. Přehled týmu

### Pořadí obsahu

1. Nejbližší zápas.
2. Stav sestavy.
3. Nejbližší týmová událost.
4. Upozornění na neúplné hráče nebo údaje.
5. Další zápasy.
6. Sezónní bilance.

Nejbližší zápas má být dominantní karta s těmito údaji:

- soupeř;
- doma/venku;
- datum a lokální čas;
- místo, pokud je známé;
- stav sestavy, například `Sestava 12/17`;
- primární akce `Nastavit sestavu`.

Metriky výher, remíz, proher a bodů mohou být kompaktní, ale nesmějí vytlačit nejbližší zápas pod první obrazovku.

### Rychlé akce

Na přehledu zobrazit nejvýše tři:

- Nastavit sestavu;
- Upravit soupisku;
- Přidat událost.

Další akce patří do `Více`.

## 2. Soupiska

### Seznam

Každý hráč je jeden kompaktní řádek nebo karta:

- číslo;
- jméno;
- pozice;
- stav profilu;
- chevron do detailu.

Body a trestné minuty nejsou pro správu soupisky hlavní informace. Mohou být sekundární nebo dostupné v detailu, aby řádek nebyl přeplněný.

### Ovládání

- vyhledávání zůstává nahoře při scrollu;
- řazení otevřít v jednoduchém bottom sheetu;
- nabídnout filtr `Neúplné údaje`;
- `Přidat hráče` jako jasná sticky nebo plovoucí akce, která nezakrývá posledního hráče;
- před založením nového hráče vyhledat existující profily;
- upozornit na stejné číslo v soupisce (hráč nemá příznak aktivity; pokud má upozornění brát v úvahu jen aktivní hráče, je nutné pole doplnit – viz implementační plán);
- pozici vybírat ze sportovně definovaného seznamu, ne jako volný text (dnes `Player.position` je volný text; seznam pozic podle `SportType` je nový konfigurační číselník a existující hodnoty je nutné namapovat).

### Detail hráče

Na první obrazovce zobrazit:

- jméno a číslo;
- pozici;
- stav propojení účtu;
- hlavní akci `Upravit hráče`;
- až poté statistiky a historii.

Propojení účtu e-mailem umístit do jasně označené samostatné sekce. Před odesláním musí být vidět, jaký přístup hráč získá: uvidí svůj tým a sám odpovídá na docházku, spravovat tým ale nemůže. Propojit lze jen existující účet.

## 3. Sestava před zápasem

Aktuální kombinace sestavy, gólů, asistencí a trestů se musí rozdělit.

### Povolený obsah obrazovky Line-up

- zápas a lokální čas;
- vyhledávání hráčů;
- počet `Vybráno X z Y`;
- přepínač `Všichni / Vybraní`;
- seznam hráčů s jedním velkým checkboxem;
- označení kapitána nebo brankáře až po doplnění dat (dnes neexistuje; mimo první verzi);
- sticky tlačítko `Uložit sestavu`.

### Co na Line-up nepatří

- góly;
- asistence;
- trestné minuty;
- konečné skóre;
- skóre třetin.

### Rychlost práce

Manažer musí být schopen vybrat dvanáct hráčů a uložit sestavu bez otevření jednotlivých profilů. Doporučené doplňkové akce:

- `Vybrat poslední sestavu` (odvodit ze sestavy posledního odehraného zápasu);
- `Vybrat všechny`;
- `Zrušit výběr`.

Hromadná akce musí mít možnost jednoduché opravy před uložením.

### Uložení sestavy

Sestavu je nutné oddělit od statistik i v datech. Pokud by dál znamenala „existuje řádek `HockeyGameStatistic`“, zamkla by se v okamžiku, kdy manažer ligy začne vést Match report. Návrh modelu je v implementačním plánu (samostatná tabulka sestavy).

## 4. Match report po zápase

Match report je samostatný pozápasový workflow.

> **Oprávnění (rozhodnuto 14. 9. 2026, D3):** manažer týmu zapisuje jen události **svého** týmu – kdo hrál (sestava), góly, asistence a tresty – u nepotvrzeného zápasu. Oba týmy vyplní svou část, manažer ligy zápis potvrdí a teprve potom se výsledek počítá do tabulky. Dnes to API ještě neumí (`canManageMatchEvent` pouští jen manažera ligy); změna je ve fázi 2.5 implementačního plánu.

### Doporučený model

- nahoře sticky skóre;
- primární akce `Přidat událost`;
- volba `Gól` nebo `Trest` v bottom sheetu;
- výběr hráče primárně ze sestavy;
- u gólu možnost vybrat asistence;
- chronologický seznam zadaných událostí;
- jednoduchá oprava nebo odstranění události;
- kontrola, že součet gólů odpovídá konečnému skóre.

Na jedné obrazovce nezobrazovat pro každého hráče tři samostatné plus/minus ovladače. U sedmnáctičlenné soupisky by vzniklo 51 dvojic tlačítek a nepřiměřeně dlouhá stránka.

### Zdroj pravdy

Rozhodnuto a implementováno: jakmile má zápas Match report, skóre, skóre třetin i statistiky hráčů se počítají z událostí a ruční skóre je zamčené (`Game.eventsAuthoritative`). Zbývá validovat zápasy **bez** Match reportu, kde ruční skóre a součet gólů ze statistik hráčů mohou nesouhlasit.

## 5. Týmový rozpis

- Výchozí filtr: nadcházející zápasy.
- Přepínače `Nadcházející / Odehrané / Ostatní` musí zůstat viditelné.
- Zápasy seskupit podle měsíce.
- Každý řádek obsahuje soupeře, datum, čas, doma/venku a stav.
- `TBD` doplnit srozumitelným textem `Termín neurčen` alespoň v detailu nebo přístupném názvu (dnes `Zatím bez termínu`).
- Klepnutí na zápas otevře detail; nemá okamžitě spustit editaci.
- Veřejný a administrační povrch musí zobrazit identický lokální čas.

## 6. Kalendář a týmové události

Empty state obsahuje jednu jasnou akci `Přidat událost`.

Formulář události (odpovídá `TeamEvent`):

- typ události – `Zápas`, `Trénink`, `Schůzka`, `Jiné`; zápasy ze soutěže se do kalendáře propisují samy a ručně se nezakládají;
- název;
- začátek s viditelným labelem, volitelně konec;
- místo;
- volitelný popis;
- primární akce `Vytvořit událost`.

Na telefonu použít celostránkový formulář nebo správně implementovaný bottom sheet. V obou případech musí fungovat:

- Back;
- Escape při připojené klávesnici;
- zachování rozepsaných dat při nechtěném zavření nebo varování před jejich ztrátou;
- nativní mobilní výběr data a času.

## 7. Nastavení týmu

Nastavení musí být dostupné přes položku `Více`; nesmí být zalomené mimo viewport.

Sekce:

1. Informace o týmu (název).
2. Logo a barvy.
3. Manažer týmu – pro manažera týmu jen pro čtení; pozvání vidí jen manažer ligy týmu a administrátor.
4. Veřejný profil.
5. Nebezpečné nebo nevratné akce úplně dole – smazání týmu vidí jen manažer ligy týmu a administrátor.

### Týmová barva

- Nemá vybarvovat celý mobilní shell bez kontroly kontrastu.
- Doporučený je neutrální shell a týmová barva jako akcent.
- Pokud se použije jako pozadí, systém automaticky zvolí černý nebo bílý text podle kontrastu.
- Live Preview má ukázat reálné použití v kartě zápasu a řádku tabulky.
- Uživatel musí vědět, zda se barva ukládá automaticky, nebo tlačítkem.

### Pozvání manažera

Před odesláním musí být zřejmé:

- do jakého týmu je člověk zván;
- co bude smět (spravovat tento tým – soupisku, kalendář, nastavení; ne rozpis ani výsledky);
- na jakou e-mailovou adresu pozvánka odejde;
- že existující účet se stejnou adresou se k týmu připojí bez nové registrace.

Pozvat může jen manažer ligy, ve které tým hraje, nebo administrátor.

## 8. Loading, ukládání a chyby

### Loading

- Použít skeleton odpovídající cílovému obsahu.
- Nikdy během načítání nezobrazit falešný empty state.
- Nechat viditelný shell a navigaci.

### Ukládání

Použít právě jeden srozumitelný model:

1. **Explicitní uložení:** sticky tlačítko `Uložit`, stav změn a varování při odchodu.
2. **Automatické uložení:** text `Ukládám…` a následně `Uloženo`; bez druhého Save tlačítka.

Na stejné obrazovce tyto modely nekombinovat.

### Chyba

- Zachovat zadané hodnoty, pokud je to bezpečně možné.
- Popsat, co se nepodařilo uložit.
- Nabídnout `Zkusit znovu`.
- Nezobrazit prázdnou stránku.
- Renderovací chyba jedné části nesmí shodit celý admin shell.

## 9. Přístupnost mobilního rozhraní

- Každé ikonové tlačítko má přístupný název.
- Každý input má viditelný label a programové propojení.
- Plus/minus ovladače uvádějí hráče nebo tým a veličinu.
- Dialog/drawer má roli, titulek, focus trap a návrat fokusu.
- Focus není skrytý za spodní navigací.
- Stav aktivní položky není vyjádřen pouze barvou.
- Dynamické uložení a chyba jsou oznámené přes vhodný live region.
- Ovládání funguje s externí klávesnicí i screen readerem.

## 10. Výkonnost a horší připojení

Správa týmu může probíhat v hale se slabým signálem. Aplikace dnes nemá service worker ani offline režim; první verze řeší pouze ochranu proti dvojímu odeslání a zachování rozepsaných dat v paměti stránky. Offline cache je samostatná pozdější práce.

- Shell a poslední bezpečně dostupná data se zobrazí rychle.
- Seznam soupisky nevykresluje zbytečně těžké komponenty.
- Dvojí klepnutí nevytvoří duplicitní událost nebo hráče.
- Při pomalém uložení je akce vizuálně uzamčená a má stav `Ukládám…`.
- Síťová chyba nesmí ztratit rozpracovanou sestavu nebo report bez upozornění.
- Po obnovení spojení nabídnout bezpečné opakování požadavku.

## 11. Povinné mobilní scénáře

Každý scénář otestovat při 360, 390 a 430 px.

### Scénář A – nejbližší zápas

1. Otevřít dashboard účtem, který spravuje jen tým.
2. Rozpoznat aktivní tým a sezónu.
3. Otevřít nejbližší zápas.
4. Vrátit se bez ztráty pozice.

### Scénář B – sestava

1. Otevřít Team Manager přehled.
2. Otevřít Line-up.
3. Vybrat dvanáct hráčů.
4. Zobrazit jen vybrané.
5. Jednoho hráče odebrat.
6. Uložit.
7. Ověřit potvrzení a zachování sestavy po reloadu.

### Scénář C – hráč

1. Otevřít soupisku.
2. Vyhledat hráče bez diakritiky.
3. Otevřít detail.
4. Upravit podporovaný údaj.
5. Uložit a vrátit se na původní pozici v seznamu.

### Scénář D – událost

1. Otevřít kalendář.
2. Přidat trénink.
3. Vybrat datum a čas nativním ovladačem.
4. Uložit.
5. Ověřit zobrazení nové události.

### Scénář E – pozápasový report

Účet: manažer týmu; potvrzení ověřit účtem manažera ligy.

1. Otevřít zápas.
2. Přidat gól a asistenci.
3. Přidat trest.
4. Opravit chybnou událost.
5. Ověřit skóre.
6. Uložit report bez konfliktu s konečným výsledkem.

### Scénář F – nastavení

1. Otevřít `Více`.
2. Otevřít Settings.
3. Zkontrolovat náhled týmové barvy.
4. Vrátit se bez nechtěné změny nastavení.

## 12. Akceptační kritéria

- [ ] Pět položek spodní navigace je v jednom řádku při 360 px.
- [ ] Manažer týmu nevidí akce, které mu API zakáže (pozvání manažera, smazání týmu, zápis Match reportu, pokud nebylo rozhodnuto jinak).
- [ ] Sestava zůstane upravitelná i poté, co manažer ligy začne Match report.
- [ ] Settings je dosažitelné bez změny orientace nebo zvětšení viewportu.
- [ ] Hlavní úkoly nevyžadují horizontální scroll stránky.
- [ ] Line-up neobsahuje góly, asistence ani tresty.
- [ ] Výběr dvanácti hráčů nevyžaduje otevřít detail hráče.
- [ ] Sticky Save nikdy nezakrývá poslední ovládací prvek.
- [ ] Veřejný i administrační detail ukazují shodný čas zápasu.
- [ ] Všechny datumové a časové vstupy mají viditelný i přístupný název.
- [ ] Všechny ikonové Back/Close akce mají přístupný název.
- [ ] Formulářová chyba zachová uživatelská data.
- [ ] Žádná renderovací chyba nezpůsobí prázdnou stránku.
- [ ] Týmová barva nikdy nesníží kontrast navigace pod WCAG AA.
- [ ] V rozhraní není viditelný nepřeložený klíč, například `common.name`; všechny nové texty jsou v `en.json` i `cs.json`.
- [ ] Explicitní a automatické ukládání nejsou na jedné obrazovce smíchané.
- [ ] Všechny povinné scénáře byly ručně dokončeny při 360, 390 a 430 px.

