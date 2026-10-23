import type { EmailTexts } from '../index.js';

const sk: EmailTexts = {
  greeting: 'Dobrý deň, <strong>{{name}}</strong>,',
  copyLink: 'Tlačidlo nefunguje? Vložte do prehliadača tento odkaz:',
  footer: 'ATM – Amateur Team Management',

  activation: {
    subject: 'Aktivujte svoj účet v ATM',
    header: 'Vitajte v ATM!',
    intro: 'ďakujeme za registráciu v ATM (Amateur Team Management). Registráciu dokončíte a účet aktivujete tlačidlom nižšie:',
    button: 'Aktivovať účet',
    expiry: 'Odkaz na aktiváciu platí <strong>24 hodín</strong>.',
    ignore: 'Ak ste si účet nezakladali, tento e-mail môžete ignorovať.',
  },
  passwordReset: {
    subject: 'Obnovenie hesla do ATM',
    header: 'Obnovenie hesla',
    intro: 'dostali sme žiadosť o obnovenie hesla k vášmu účtu v ATM. Nové heslo nastavíte tlačidlom nižšie:',
    button: 'Nastaviť nové heslo',
    expiry: 'Odkaz platí <strong>1 hodinu</strong>.',
    warningTitle: 'Nežiadali ste o to?',
    warningText: 'Ak ste o obnovenie hesla nežiadali, tento e-mail ignorujte. Vaše heslo zostane bez zmeny.',
  },
  passwordChanged: {
    subject: 'Heslo do ATM bolo zmenené',
    header: 'Heslo zmenené',
    done: 'vaše heslo bolo úspešne zmenené.',
    noAction: 'Ak ste ho menili vy, nemusíte nič robiť.',
    warningTitle: 'Neboli ste to vy?',
    warningText: 'Ak ste heslo nemenili, ozvite sa nám čo najskôr – k vášmu účtu sa mohol dostať niekto iný.',
  },
  welcome: {
    subject: 'Vitajte v ATM – účet je aktívny',
    header: 'Účet aktivovaný!',
    intro: 'váš účet je aktívny. Môžete sa prihlásiť a začať ATM používať.',
    button: 'Prihlásiť sa',
    canTitle: 'V ATM môžete:',
    can: ['spravovať tímy a hráčov', 'sledovať rozpis zápasov a výsledky', 'prezerať tabuľky a štatistiky'],
    questions: 'Ak máte akékoľvek otázky, ozvite sa nám.',
  },

  invite: {
    subject: {
      TEAM: { byName: '{{inviter}} vás pozýva na správu tímu {{target}}', anonymous: 'Pozvánka na správu tímu {{target}}' },
      LEAGUE: { byName: '{{inviter}} vás pozýva na správu ligy {{target}}', anonymous: 'Pozvánka na správu ligy {{target}}' },
      PLAYER: { byName: '{{inviter}} vás pozýva do tímu {{target}}', anonymous: 'Pozvánka do tímu {{target}}' },
    },
    header: { TEAM: 'Pozvánka pre manažéra tímu', LEAGUE: 'Pozvánka pre manažéra sezóny', PLAYER: 'Pozvánka pre hráča' },
    invited: {
      TEAM: {
        byName: '<strong>{{inviter}}</strong> vás pozýva na správu tímu <strong>{{target}}</strong>{{context}} v ATM.',
        anonymous: 'Boli ste pozvaní na správu tímu <strong>{{target}}</strong>{{context}} v ATM.',
      },
      LEAGUE: {
        byName: '<strong>{{inviter}}</strong> vás pozýva na správu ligy <strong>{{target}}</strong>{{context}} v ATM.',
        anonymous: 'Boli ste pozvaní na správu ligy <strong>{{target}}</strong>{{context}} v ATM.',
      },
      PLAYER: {
        byName: '<strong>{{inviter}}</strong> vás pozýva do tímu <strong>{{target}}</strong>{{context}} v ATM.',
        anonymous: 'Boli ste pozvaní do tímu <strong>{{target}}</strong>{{context}} v ATM.',
      },
    },
    context: ' ({{context}})',
    next: {
      hasAccount: 'Účet v ATM už máte. Otvorte pozvánku, prihláste sa svojím heslom a pozvánku prijmite.',
      PLAYER: 'Otvorte pozvánku, zvoľte si heslo a ste v tíme.',
      manager: 'Otvorte pozvánku, zvoľte si heslo a rovno sa dostanete do svojej správy.',
    },
    button: 'Prijať pozvánku',
    expiry: 'Odkaz platí do <strong>{{date}}</strong>.',
    canTitle: { PLAYER: 'Čo v ATM uvidíte', manager: 'Čo budete môcť robiť' },
    can: {
      PLAYER: ['kalendár tímu – tréningy, zápasy a zrazy', 'pri každej akcii odpoviete, či prídete'],
      TEAM: ['spravovať súpisku a hráčov', 'nastaviť farby a logo tímu', 'plánovať tréningy a sledovať dochádzku', 'doplniť štatistiky svojich hráčov po zápase'],
      LEAGUE: ['zakladať sezóny a pridávať do nich tímy', 'pozývať manažérov tímov', 'generovať rozpis a zapisovať výsledky', 'zverejniť sezónu a rozosielať výsledky'],
    },
    keepTitle: { byName: '{{inviter}} sa ďalej stará o', anonymous: 'Manažér sezóny sa ďalej stará o' },
    keep: ['rozpis a termíny zápasov', 'skóre a tabuľku', 'potvrdzovanie zápisov o stretnutí'],
    ignore: 'Pozvánku nečakáte? Ignorujte tento e-mail – kým ju neprijmete, nič sa nezmení.',
    reply: {
      PLAYER: 'Na otázky k tímu vám odpovie ten, kto vás pozval – stačí odpovedať na tento e-mail.',
      manager: 'Na otázky k súťaži vám odpovie ten, kto vás pozval – stačí odpovedať na tento e-mail.',
    },
  },

  roundSummary: {
    intro: {
      round: '{{round}}. kolo sezóny {{season}} je odohrané. Takto dopadlo.',
      picked: 'Máme nové výsledky zo sezóny {{season}}. Takto dopadli.',
    },
    notConfirmed: 'nepotvrdené',
    results: 'Výsledky',
    table: 'Tabuľka',
    topScorers: 'Najlepší strelci',
    colTeam: 'Tím',
    colPlayed: 'Z',
    colPoints: 'B',
    colPlayer: 'Hráč',
    colGoalsAssists: 'G+A',
    button: 'Otvoriť sezónu',
    optOut: 'Tieto súhrny môžete vypnúť na svojej nástenke v ATM.',
    header: { round: '{{league}} – {{round}}. kolo', picked: '{{league}} – Výsledky' },
    subject: { round: '{{season}} - súhrn {{round}}. kola', picked: '{{season}} - nové výsledky' },
  },
  resultsImage: {
    results: 'Výsledky',
    table: 'Tabuľka',
    topScorers: 'Najlepší strelci',
    notConfirmed: 'nepotvrdené',
    round: '{{n}}. kolo',
    more: 'a {{n}} ďalších',
    played: 'Z',
    points: 'B',
  },

  taxDocument: {
    subject: 'Platba prijatá – doklad {{number}}',
    header: 'Platba prijatá',
    body: 'vaša platba <strong>{{amount}}</strong> prišla a plán platí: {{item}}.',
    attached: 'V prílohe je daňový doklad č. {{number}}.',
    file: 'doklad-{{number}}.pdf',
  },

  registrationReceived: {
    subject: 'Prihláška tímu {{team}} – {{competition}}',
    header: 'Prihláška prijatá',
    received: 'prihláška tímu <strong>{{team}}</strong> do súťaže <strong>{{competition}}</strong> prišla.',
    nextWaitlisted: 'Súťaž je teraz plná, preto ste na čakacej listine. Ak sa miesto uvoľní, organizátor vás môže prijať – dáme vám vedieť e-mailom.',
    next: 'Organizátor ju teraz posúdi. O jeho rozhodnutí vám dáme vedieť e-mailom.',
    button: 'Zobraziť súťaž',
    status: 'Stav prihlášky',
    statusHint: 'Na stránke prihlášky uvidíte, ako organizátor rozhodol, a prihlášku tam môžete aj stiahnuť. Odkaz nikomu nepreposielajte.',
  },
  registrationDecision: {
    subject: {
      APPROVED: '{{team}} je v súťaži {{competition}}',
      REJECTED: 'Prihláška tímu {{team}} nebola prijatá',
      WAITLISTED: '{{team}} je na čakacej listine – {{competition}}',
      PROMOTED: 'Uvoľnilo sa miesto pre {{team}} – {{competition}}',
    },
    header: { APPROVED: 'Prihláška schválená', REJECTED: 'Prihláška zamietnutá', WAITLISTED: 'Čakacia listina', PROMOTED: 'Uvoľnilo sa miesto' },
    text: {
      APPROVED: 'organizátor schválil prihlášku tímu <strong>{{team}}</strong> do súťaže <strong>{{competition}}</strong>. Tím je teraz v súťaži.',
      REJECTED: 'organizátor súťaže <strong>{{competition}}</strong> prihlášku tímu <strong>{{team}}</strong> neprijal.',
      WAITLISTED: 'prihláška tímu <strong>{{team}}</strong> do súťaže <strong>{{competition}}</strong> je na čakacej listine. Ak sa miesto uvoľní, organizátor vás môže prijať.',
      PROMOTED: 'v súťaži <strong>{{competition}}</strong> sa uvoľnilo miesto a prihláška tímu <strong>{{team}}</strong> postúpila z čakacej listiny. Teraz čaká na rozhodnutie organizátora.',
    },
    reason: 'Zdôvodnenie: {{reason}}',
    buttonApproved: 'Otvoriť ATM',
    button: 'Zobraziť súťaž',
  },
  registrationNotice: {
    subject: 'Nová prihláška: {{team}} – {{competition}}',
    header: 'Nová prihláška tímu',
    applied: 'Tím <strong>{{team}}</strong> sa prihlásil do súťaže <strong>{{competition}}</strong>.',
    contact: 'Kontakt: {{name}} &lt;{{email}}&gt;',
    waitlisted: 'Súťaž je plná, prihláška je preto na čakacej listine.',
    button: 'Otvoriť prihlášky',
  },
  registrationWithdrawn: {
    subject: 'Uvoľnilo sa miesto: {{competition}}',
    header: 'Prihláška stiahnutá',
    withdrew: 'Tím <strong>{{team}}</strong> stiahol prihlášku do súťaže <strong>{{competition}}</strong> a uvoľnil tým miesto.',
    waiting: 'Na čakacej listine je {{count}}. Nikto nepostupuje sám – v prihláškach môžete posunúť ďalšieho v poradí.',
    button: 'Otvoriť prihlášky',
  },
  places: {
    approved: '{{count}} v súťaži',
    pending: '{{count}} čaká na rozhodnutie',
    waitlisted: '{{count}} na čakacej listine',
    max: '{{count}} miest',
    noLimit: 'bez obmedzenia počtu',
  },
};

export default sk;
