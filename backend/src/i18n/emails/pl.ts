import type { EmailTexts } from '../index.js';

/**
 * Polish texts of the e-mails and the shareable results image, translated
 * from the Czech ones (cs.ts) with the same shape.
 */
const pl: EmailTexts = {
  greeting: 'Dzień dobry, <strong>{{name}}</strong>,',
  copyLink: 'Przycisk nie działa? Wklej ten link do przeglądarki:',
  footer: 'ATM – Amateur Team Management',
  poweredBy: 'Działa na ATM',

  activation: {
    subject: 'Aktywuj swoje konto w ATM',
    header: 'Witaj w ATM!',
    intro: 'dziękujemy za rejestrację w ATM (Amateur Team Management). Aby dokończyć rejestrację i aktywować konto, kliknij przycisk poniżej:',
    button: 'Aktywuj konto',
    expiry: 'Link aktywacyjny jest ważny <strong>24 godziny</strong>.',
    ignore: 'Jeśli to nie ty zakładałeś konto, zignoruj tę wiadomość.',
  },
  passwordReset: {
    subject: 'Odnowienie hasła do ATM',
    header: 'Odnowienie hasła',
    intro: 'otrzymaliśmy prośbę o odnowienie hasła do twojego konta w ATM. Nowe hasło ustawisz przyciskiem poniżej:',
    button: 'Ustaw nowe hasło',
    expiry: 'Link jest ważny <strong>1 godzinę</strong>.',
    warningTitle: 'To nie ty?',
    warningText: 'Jeśli nie prosiłeś o odnowienie hasła, zignoruj tę wiadomość. Twoje hasło pozostanie bez zmian.',
  },
  passwordChanged: {
    subject: 'Hasło do ATM zostało zmienione',
    header: 'Hasło zmienione',
    done: 'twoje hasło zostało zmienione.',
    noAction: 'Jeśli zmieniłeś je ty, nie musisz nic robić.',
    warningTitle: 'To nie ty?',
    warningText: 'Jeśli nie zmieniałeś hasła, skontaktuj się z nami jak najszybciej – ktoś inny mógł uzyskać dostęp do twojego konta.',
  },
  welcome: {
    subject: 'Witaj w ATM – konto jest aktywne',
    header: 'Konto aktywowane!',
    intro: 'twoje konto jest aktywne. Możesz się zalogować i zacząć korzystać z ATM.',
    button: 'Zaloguj się',
    canTitle: 'W ATM możesz:',
    can: ['zarządzać drużynami i zawodnikami', 'śledzić terminarz meczów i wyniki', 'przeglądać tabele i statystyki'],
    questions: 'Jeśli masz jakiekolwiek pytania, napisz do nas.',
  },

  invite: {
    subject: {
      TEAM: { byName: '{{inviter}} zaprasza cię do zarządzania drużyną {{target}}', anonymous: 'Zaproszenie do zarządzania drużyną {{target}}' },
      LEAGUE: { byName: '{{inviter}} zaprasza cię do zarządzania ligą {{target}}', anonymous: 'Zaproszenie do zarządzania ligą {{target}}' },
      PLAYER: { byName: '{{inviter}} zaprasza cię do drużyny {{target}}', anonymous: 'Zaproszenie do drużyny {{target}}' },
    },
    header: { TEAM: 'Zaproszenie dla menedżera drużyny', LEAGUE: 'Zaproszenie dla menedżera sezonu', PLAYER: 'Zaproszenie dla zawodnika' },
    invited: {
      TEAM: {
        byName: '<strong>{{inviter}}</strong> zaprasza cię do zarządzania drużyną <strong>{{target}}</strong>{{context}} w ATM.',
        anonymous: 'Zapraszamy cię do zarządzania drużyną <strong>{{target}}</strong>{{context}} w ATM.',
      },
      LEAGUE: {
        byName: '<strong>{{inviter}}</strong> zaprasza cię do zarządzania ligą <strong>{{target}}</strong>{{context}} w ATM.',
        anonymous: 'Zapraszamy cię do zarządzania ligą <strong>{{target}}</strong>{{context}} w ATM.',
      },
      PLAYER: {
        byName: '<strong>{{inviter}}</strong> zaprasza cię do drużyny <strong>{{target}}</strong>{{context}} w ATM.',
        anonymous: 'Zapraszamy cię do drużyny <strong>{{target}}</strong>{{context}} w ATM.',
      },
    },
    context: ' ({{context}})',
    next: {
      hasAccount: 'Masz już konto w ATM. Otwórz zaproszenie, zaloguj się swoim hasłem i przyjmij zaproszenie.',
      PLAYER: 'Otwórz zaproszenie, ustaw hasło i jesteś w drużynie.',
      manager: 'Otwórz zaproszenie, ustaw hasło i od razu trafisz do swojego panelu zarządzania.',
    },
    button: 'Przyjmij zaproszenie',
    expiry: 'Link jest ważny do <strong>{{date}}</strong>.',
    canTitle: { PLAYER: 'Co zobaczysz w ATM', manager: 'Co będziesz mógł robić' },
    can: {
      PLAYER: ['kalendarz drużyny – treningi, mecze i zbiórki', 'przy każdym wydarzeniu odpowiesz, czy przyjdziesz'],
      TEAM: ['zarządzać składem i zawodnikami', 'ustawić barwy i logo drużyny', 'planować treningi i śledzić frekwencję', 'uzupełniać statystyki swoich zawodników po meczu'],
      LEAGUE: ['zakładać sezony i dodawać do nich drużyny', 'zapraszać menedżerów drużyn', 'generować terminarz i wpisywać wyniki', 'publikować sezon i rozsyłać wyniki'],
    },
    keepTitle: { byName: '{{inviter}} nadal dba o', anonymous: 'Menedżer sezonu nadal dba o' },
    keep: ['terminarz i terminy meczów', 'wyniki i tabelę', 'zatwierdzanie protokołów meczów'],
    ignore: 'Nie spodziewasz się zaproszenia? Zignoruj tę wiadomość – dopóki go nie przyjmiesz, nic się nie zmieni.',
    reply: {
      PLAYER: 'Na pytania o drużynę odpowie osoba, która cię zaprosiła – wystarczy odpowiedzieć na ten e-mail.',
      manager: 'Na pytania o rozgrywki odpowie osoba, która cię zaprosiła – wystarczy odpowiedzieć na ten e-mail.',
    },
  },

  roundSummary: {
    intro: {
      round: '{{round}}. kolejka sezonu {{season}} została rozegrana. Oto wyniki.',
      picked: 'Mamy nowe wyniki z sezonu {{season}}. Oto one.',
    },
    notConfirmed: 'niezatwierdzony',
    results: 'Wyniki',
    table: 'Tabela',
    topScorers: 'Najlepsi strzelcy',
    colTeam: 'Drużyna',
    colPlayed: 'M',
    colPoints: 'Pkt',
    colPlayer: 'Zawodnik',
    colGoalsAssists: 'G+A',
    button: 'Otwórz sezon',
    optOut: 'Te podsumowania możesz wyłączyć na swoim pulpicie w ATM.',
    header: { round: '{{league}} – {{round}}. kolejka', picked: '{{league}} – Wyniki' },
    subject: { round: '{{season}} - podsumowanie {{round}}. kolejki', picked: '{{season}} - nowe wyniki' },
  },
  resultsImage: {
    results: 'Wyniki',
    table: 'Tabela',
    topScorers: 'Najlepsi strzelcy',
    notConfirmed: 'niezatwierdzony',
    round: '{{n}}. kolejka',
    more: 'i {{n}} więcej',
    played: 'M',
    points: 'Pkt',
  },

  taxDocument: {
    subject: 'Płatność otrzymana – dokument {{number}}',
    header: 'Płatność otrzymana',
    body: 'twoja płatność <strong>{{amount}}</strong> dotarła i plan obowiązuje: {{item}}.',
    attached: 'W załączniku znajduje się dokument podatkowy nr {{number}}.',
    file: 'dokument-{{number}}.pdf',
  },

  paymentInstructions: {
    subject: 'Płatność za {{product}} – symbol zmienny {{variableSymbol}}',
    header: 'Jak zapłacić',
    intro: 'wybrałeś <strong>{{product}}</strong>. Plan zacznie obowiązywać, gdy płatność dotrze i ją potwierdzimy.',
    amount: 'Kwota',
    account: 'Konto',
    iban: 'IBAN',
    bic: 'BIC (SWIFT)',
    recipient: 'Odbiorca',
    variableSymbol: 'Symbol zmienny',
    message: 'Tytuł przelewu',
    qr: 'Kod QR znajdziesz w ATM przy planie: {{format}}.',
    formats: { SPD: 'czeska płatność QR', BYSQUARE: 'PAY by square dla banków słowackich', EPC: 'kod QR EPC dla banków strefy euro' },
    sepa: 'Wyślij przelew SEPA w euro i przepisz dokładnie tytuł przelewu; po nim dopasujemy płatność.',
    button: 'Pokaż płatność',
  },

  registrationReceived: {
    subject: 'Zgłoszenie drużyny {{team}} – {{competition}}',
    header: 'Zgłoszenie przyjęte',
    received: 'zgłoszenie drużyny <strong>{{team}}</strong> do rozgrywek <strong>{{competition}}</strong> dotarło.',
    nextWaitlisted: 'Rozgrywki są teraz pełne, dlatego jesteś na liście rezerwowej. Jeśli zwolni się miejsce, organizator może cię przyjąć – damy ci znać e-mailem.',
    next: 'Organizator je teraz rozpatrzy. O jego decyzji poinformujemy cię e-mailem.',
    button: 'Pokaż rozgrywki',
    status: 'Stan zgłoszenia',
    statusHint: 'Na stronie zgłoszenia zobaczysz decyzję organizatora i możesz tam także wycofać zgłoszenie. Nikomu nie przesyłaj tego linku.',
  },
  registrationDecision: {
    subject: {
      APPROVED: '{{team}} jest w rozgrywkach {{competition}}',
      REJECTED: 'Zgłoszenie drużyny {{team}} nie zostało przyjęte',
      WAITLISTED: '{{team}} jest na liście rezerwowej – {{competition}}',
      PROMOTED: 'Zwolniło się miejsce dla {{team}} – {{competition}}',
    },
    header: { APPROVED: 'Zgłoszenie zatwierdzone', REJECTED: 'Zgłoszenie odrzucone', WAITLISTED: 'Lista rezerwowa', PROMOTED: 'Zwolniło się miejsce' },
    text: {
      APPROVED: 'organizator zatwierdził zgłoszenie drużyny <strong>{{team}}</strong> do rozgrywek <strong>{{competition}}</strong>. Drużyna jest teraz w rozgrywkach.',
      REJECTED: 'organizator rozgrywek <strong>{{competition}}</strong> nie przyjął zgłoszenia drużyny <strong>{{team}}</strong>.',
      WAITLISTED: 'zgłoszenie drużyny <strong>{{team}}</strong> do rozgrywek <strong>{{competition}}</strong> jest na liście rezerwowej. Jeśli zwolni się miejsce, organizator może cię przyjąć.',
      PROMOTED: 'w rozgrywkach <strong>{{competition}}</strong> zwolniło się miejsce i zgłoszenie drużyny <strong>{{team}}</strong> przeszło z listy rezerwowej. Teraz czeka na decyzję organizatora.',
    },
    reason: 'Uzasadnienie: {{reason}}',
    buttonApproved: 'Otwórz ATM',
    button: 'Pokaż rozgrywki',
  },
  registrationNotice: {
    subject: 'Nowe zgłoszenie: {{team}} – {{competition}}',
    header: 'Nowe zgłoszenie drużyny',
    applied: 'Drużyna <strong>{{team}}</strong> zgłosiła się do rozgrywek <strong>{{competition}}</strong>.',
    contact: 'Kontakt: {{name}} &lt;{{email}}&gt;',
    waitlisted: 'Rozgrywki są pełne, dlatego zgłoszenie jest na liście rezerwowej.',
    button: 'Otwórz zgłoszenia',
  },
  registrationWithdrawn: {
    subject: 'Zwolniło się miejsce: {{competition}}',
    header: 'Zgłoszenie wycofane',
    withdrew: 'Drużyna <strong>{{team}}</strong> wycofała zgłoszenie do rozgrywek <strong>{{competition}}</strong> i zwolniła tym samym miejsce.',
    waiting: 'Na liście rezerwowej: {{count}}. Nikt nie awansuje automatycznie – w zgłoszeniach możesz przesunąć następną drużynę w kolejności.',
    button: 'Otwórz zgłoszenia',
  },
  places: {
    approved: 'w rozgrywkach: {{count}}',
    pending: 'czeka na decyzję: {{count}}',
    waitlisted: 'na liście rezerwowej: {{count}}',
    max: 'miejsca: {{count}}',
    noLimit: 'bez limitu miejsc',
  },
};

export default pl;
