/**
 * Czech texts of the e-mails and the shareable results image. {{name}} marks
 * a value the server fills in (escaped for HTML); <strong> is markup of the
 * template itself. Every other language file has exactly this shape.
 */
const cs = {
  greeting: 'Dobrý den, <strong>{{name}}</strong>,',
  copyLink: 'Tlačítko nefunguje? Vložte do prohlížeče tento odkaz:',
  footer: 'ATM – Amateur Team Management',

  activation: {
    subject: 'Aktivujte svůj účet v ATM',
    header: 'Vítejte v ATM!',
    intro: 'děkujeme za registraci v ATM (Amateur Team Management). Registraci dokončíte a účet aktivujete tlačítkem níže:',
    button: 'Aktivovat účet',
    expiry: 'Odkaz pro aktivaci platí <strong>24 hodin</strong>.',
    ignore: 'Pokud jste si účet nezakládali, tento e-mail můžete ignorovat.',
  },
  passwordReset: {
    subject: 'Obnovení hesla k ATM',
    header: 'Obnovení hesla',
    intro: 'dostali jsme žádost o obnovení hesla k vašemu účtu v ATM. Nové heslo nastavíte tlačítkem níže:',
    button: 'Nastavit nové heslo',
    expiry: 'Odkaz platí <strong>1 hodinu</strong>.',
    warningTitle: 'Nežádali jste o to?',
    warningText: 'Pokud jste o obnovení hesla nežádali, tento e-mail ignorujte. Vaše heslo zůstane beze změny.',
  },
  passwordChanged: {
    subject: 'Heslo k ATM bylo změněno',
    header: 'Heslo změněno',
    done: 'vaše heslo bylo úspěšně změněno.',
    noAction: 'Pokud jste ho měnili vy, nemusíte nic dělat.',
    warningTitle: 'Nebyli jste to vy?',
    warningText: 'Pokud jste heslo neměnili, ozvěte se nám co nejdřív – k vašemu účtu se mohl dostat někdo jiný.',
  },
  welcome: {
    subject: 'Vítejte v ATM – účet je aktivní',
    header: 'Účet aktivován!',
    intro: 'váš účet je aktivní. Můžete se přihlásit a začít ATM používat.',
    button: 'Přihlásit se',
    canTitle: 'V ATM můžete:',
    can: ['spravovat týmy a hráče', 'sledovat rozpis zápasů a výsledky', 'prohlížet tabulky a statistiky'],
    questions: 'Pokud máte jakékoli otázky, ozvěte se nám.',
  },

  invite: {
    subject: {
      TEAM: { byName: '{{inviter}} vás zve ke správě týmu {{target}}', anonymous: 'Pozvánka ke správě týmu {{target}}' },
      LEAGUE: { byName: '{{inviter}} vás zve ke správě ligy {{target}}', anonymous: 'Pozvánka ke správě ligy {{target}}' },
      PLAYER: { byName: '{{inviter}} vás zve do týmu {{target}}', anonymous: 'Pozvánka do týmu {{target}}' },
    },
    header: { TEAM: 'Pozvánka pro manažera týmu', LEAGUE: 'Pozvánka pro manažera sezóny', PLAYER: 'Pozvánka pro hráče' },
    invited: {
      TEAM: {
        byName: '<strong>{{inviter}}</strong> vás zve ke správě týmu <strong>{{target}}</strong>{{context}} v ATM.',
        anonymous: 'Jste zváni ke správě týmu <strong>{{target}}</strong>{{context}} v ATM.',
      },
      LEAGUE: {
        byName: '<strong>{{inviter}}</strong> vás zve ke správě ligy <strong>{{target}}</strong>{{context}} v ATM.',
        anonymous: 'Jste zváni ke správě ligy <strong>{{target}}</strong>{{context}} v ATM.',
      },
      PLAYER: {
        byName: '<strong>{{inviter}}</strong> vás zve do týmu <strong>{{target}}</strong>{{context}} v ATM.',
        anonymous: 'Jste zváni do týmu <strong>{{target}}</strong>{{context}} v ATM.',
      },
    },
    context: ' ({{context}})',
    next: {
      hasAccount: 'Účet v ATM už máte. Otevřete pozvánku, přihlaste se svým heslem a pozvánku přijměte.',
      PLAYER: 'Otevřete pozvánku, zvolte si heslo a jste v týmu.',
      manager: 'Otevřete pozvánku, zvolte si heslo a rovnou se dostanete do své správy.',
    },
    button: 'Přijmout pozvánku',
    expiry: 'Odkaz platí do <strong>{{date}}</strong>.',
    canTitle: { PLAYER: 'Co v ATM uvidíte', manager: 'Co budete moci dělat' },
    can: {
      PLAYER: ['kalendář týmu – tréninky, zápasy a srazy', 'u každé akce odpovíte, zda přijdete'],
      TEAM: ['spravovat soupisku a hráče', 'nastavit barvy a logo týmu', 'plánovat tréninky a sledovat docházku', 'doplnit statistiky svých hráčů po zápase'],
      LEAGUE: ['zakládat sezóny a přidávat do nich týmy', 'zvát manažery týmů', 'generovat rozpis a zapisovat výsledky', 'zveřejnit sezónu a rozesílat výsledky'],
    },
    keepTitle: { byName: '{{inviter}} se dál stará o', anonymous: 'Manažer sezóny se dál stará o' },
    keep: ['rozpis a termíny zápasů', 'skóre a tabulku', 'potvrzování zápisů o utkání'],
    ignore: 'Pozvánku nečekáte? Ignorujte tento e-mail – dokud ji nepřijmete, nic se nezmění.',
    reply: {
      PLAYER: 'Na otázky k týmu vám odpoví ten, kdo vás pozval – stačí odpovědět na tento e-mail.',
      manager: 'Na otázky k soutěži vám odpoví ten, kdo vás pozval – stačí odpovědět na tento e-mail.',
    },
  },

  roundSummary: {
    intro: {
      round: '{{round}}. kolo sezóny {{season}} je odehrané. Takhle dopadlo.',
      picked: 'Máme nové výsledky ze sezóny {{season}}. Takhle dopadly.',
    },
    notConfirmed: 'nepotvrzeno',
    results: 'Výsledky',
    table: 'Tabulka',
    topScorers: 'Nejlepší střelci',
    colTeam: 'Tým',
    colPlayed: 'Z',
    colPoints: 'B',
    colPlayer: 'Hráč',
    colGoalsAssists: 'G+A',
    button: 'Otevřít sezónu',
    optOut: 'Tyto souhrny můžete vypnout na své nástěnce v ATM.',
    header: { round: '{{league}} – {{round}}. kolo', picked: '{{league}} – Výsledky' },
    subject: { round: '{{season}} - souhrn {{round}}. kola', picked: '{{season}} - nové výsledky' },
  },
  resultsImage: {
    results: 'Výsledky',
    table: 'Tabulka',
    topScorers: 'Nejlepší střelci',
    notConfirmed: 'nepotvrzeno',
    round: '{{n}}. kolo',
    more: 'a {{n}} dalších',
    played: 'Z',
    points: 'B',
  },

  taxDocument: {
    subject: 'Platba přijata – doklad {{number}}',
    header: 'Platba přijata',
    body: 'vaše platba <strong>{{amount}}</strong> dorazila a plán platí: {{item}}.',
    attached: 'V příloze je daňový doklad č. {{number}}.',
    file: 'doklad-{{number}}.pdf',
  },

  registrationReceived: {
    subject: 'Přihláška týmu {{team}} – {{competition}}',
    header: 'Přihláška přijata',
    received: 'přihláška týmu <strong>{{team}}</strong> do soutěže <strong>{{competition}}</strong> dorazila.',
    nextWaitlisted: 'Soutěž je teď plná, proto jste na čekací listině. Pokud se místo uvolní, organizátor vás může přijmout – dáme vám vědět e-mailem.',
    next: 'Organizátor ji teď posoudí. O jeho rozhodnutí vám dáme vědět e-mailem.',
    button: 'Zobrazit soutěž',
    status: 'Stav přihlášky',
    statusHint: 'Na stránce přihlášky uvidíte, jak organizátor rozhodl, a přihlášku tam můžete i stáhnout. Odkaz nikomu nepřeposílejte.',
  },
  registrationDecision: {
    subject: {
      APPROVED: '{{team}} je v soutěži {{competition}}',
      REJECTED: 'Přihláška týmu {{team}} nebyla přijata',
      WAITLISTED: '{{team}} je na čekací listině – {{competition}}',
      PROMOTED: 'Uvolnilo se místo pro {{team}} – {{competition}}',
    },
    header: { APPROVED: 'Přihláška schválena', REJECTED: 'Přihláška zamítnuta', WAITLISTED: 'Čekací listina', PROMOTED: 'Uvolnilo se místo' },
    text: {
      APPROVED: 'organizátor schválil přihlášku týmu <strong>{{team}}</strong> do soutěže <strong>{{competition}}</strong>. Tým je teď v soutěži.',
      REJECTED: 'organizátor soutěže <strong>{{competition}}</strong> přihlášku týmu <strong>{{team}}</strong> nepřijal.',
      WAITLISTED: 'přihláška týmu <strong>{{team}}</strong> do soutěže <strong>{{competition}}</strong> je na čekací listině. Pokud se místo uvolní, organizátor vás může přijmout.',
      PROMOTED: 'v soutěži <strong>{{competition}}</strong> se uvolnilo místo a přihláška týmu <strong>{{team}}</strong> postoupila z čekací listiny. Teď čeká na rozhodnutí organizátora.',
    },
    reason: 'Zdůvodnění: {{reason}}',
    buttonApproved: 'Otevřít ATM',
    button: 'Zobrazit soutěž',
  },
  registrationNotice: {
    subject: 'Nová přihláška: {{team}} – {{competition}}',
    header: 'Nová přihláška týmu',
    applied: 'Tým <strong>{{team}}</strong> se přihlásil do soutěže <strong>{{competition}}</strong>.',
    contact: 'Kontakt: {{name}} &lt;{{email}}&gt;',
    waitlisted: 'Soutěž je plná, přihláška je proto na čekací listině.',
    button: 'Otevřít přihlášky',
  },
  registrationWithdrawn: {
    subject: 'Uvolnilo se místo: {{competition}}',
    header: 'Přihláška stažena',
    withdrew: 'Tým <strong>{{team}}</strong> stáhl přihlášku do soutěže <strong>{{competition}}</strong> a uvolnil tím místo.',
    waiting: 'Na čekací listině je {{count}}. Nikdo nepostupuje sám – v přihláškách můžete posunout dalšího v pořadí.',
    button: 'Otevřít přihlášky',
  },
  places: {
    approved: '{{count}} v soutěži',
    pending: '{{count}} čeká na rozhodnutí',
    waitlisted: '{{count}} na čekací listině',
    max: '{{count}} míst',
    noLimit: 'bez omezení počtu',
  },
};

export default cs;
