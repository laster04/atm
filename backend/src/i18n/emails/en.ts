import type { EmailTexts } from '../index.js';

const en: EmailTexts = {
  greeting: 'Hello <strong>{{name}}</strong>,',
  copyLink: 'Button not working? Paste this link into your browser:',
  footer: 'ATM – Amateur Team Management',

  activation: {
    subject: 'Activate your ATM account',
    header: 'Welcome to ATM!',
    intro: 'thank you for registering at Amateur Team Management (ATM). To complete your registration and activate your account, please click the button below:',
    button: 'Activate My Account',
    expiry: 'This activation link will expire in <strong>24 hours</strong>.',
    ignore: 'If you did not create an account, you can safely ignore this email.',
  },
  passwordReset: {
    subject: 'Reset your ATM password',
    header: 'Password Reset Request',
    intro: 'we received a request to reset your password for your ATM account. Click the button below to set a new password:',
    button: 'Reset My Password',
    expiry: 'This link will expire in <strong>1 hour</strong>.',
    warningTitle: "Didn't request this?",
    warningText: "If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.",
  },
  passwordChanged: {
    subject: 'Your ATM password has been changed',
    header: 'Password Changed',
    done: 'your password has been successfully changed.',
    noAction: 'If you made this change, no further action is needed.',
    warningTitle: "Wasn't you?",
    warningText: "If you didn't change your password, please contact us immediately as your account may be compromised.",
  },
  welcome: {
    subject: 'Welcome to ATM - Account Activated',
    header: 'Account Activated!',
    intro: 'your account has been successfully activated. You can now log in and start using ATM.',
    button: 'Log In Now',
    canTitle: 'With ATM you can:',
    can: ['Manage your teams and players', 'Track game schedules and results', 'View standings and statistics'],
    questions: 'If you have any questions, feel free to reach out to us.',
  },

  invite: {
    subject: {
      TEAM: { byName: '{{inviter}} invited you to manage {{target}}', anonymous: "You're invited to manage {{target}}" },
      LEAGUE: { byName: '{{inviter}} invited you to manage {{target}}', anonymous: "You're invited to manage {{target}}" },
      PLAYER: { byName: '{{inviter}} invited you to join {{target}}', anonymous: "You're invited to join {{target}}" },
    },
    header: { TEAM: 'Team manager invitation', LEAGUE: 'Season manager invitation', PLAYER: 'Player invitation' },
    invited: {
      TEAM: {
        byName: '<strong>{{inviter}}</strong> has invited you to manage <strong>{{target}}</strong>{{context}} in ATM.',
        anonymous: 'You have been invited to manage <strong>{{target}}</strong>{{context}} in ATM.',
      },
      LEAGUE: {
        byName: '<strong>{{inviter}}</strong> has invited you to manage <strong>{{target}}</strong>{{context}} in ATM.',
        anonymous: 'You have been invited to manage <strong>{{target}}</strong>{{context}} in ATM.',
      },
      PLAYER: {
        byName: '<strong>{{inviter}}</strong> has invited you to join <strong>{{target}}</strong>{{context}} in ATM.',
        anonymous: 'You have been invited to join <strong>{{target}}</strong>{{context}} in ATM.',
      },
    },
    context: ' ({{context}})',
    next: {
      hasAccount: 'You already have an ATM account. Open the invitation, sign in with your usual password and accept it.',
      PLAYER: "Open the invitation, choose a password and you're on the team.",
      manager: 'Open the invitation, choose a password and you go straight to your team or league.',
    },
    button: 'Accept invitation',
    expiry: 'The link works until <strong>{{date}}</strong>.',
    canTitle: { PLAYER: "In ATM you'll", manager: "You'll be able to" },
    can: {
      PLAYER: ['see the team calendar: trainings, games and meetings', "say for each one whether you're coming"],
      TEAM: ['keep the roster up to date', 'set the team colours and logo', 'plan training and see who is coming', "add your players' stats after a game"],
      LEAGUE: ['create seasons and add teams to them', 'invite team managers', 'generate the schedule and record results', 'publish the season and email the results'],
    },
    keepTitle: { byName: '{{inviter}} takes care of', anonymous: 'The season manager takes care of' },
    keep: ['the schedule and game dates', 'scores and the table', 'confirming match reports'],
    ignore: 'Not expecting this? Ignore this email. Nothing changes until you accept.',
    reply: {
      PLAYER: 'Questions about the team? Reply to this email to reach the person who invited you.',
      manager: 'Questions about the competition? Reply to this email to reach the person who invited you.',
    },
  },

  roundSummary: {
    intro: {
      round: 'Round {{round}} of {{season}} is in. Here is how it went.',
      picked: 'New results from {{season}} are in. Here is how it went.',
    },
    notConfirmed: 'not confirmed',
    results: 'Results',
    table: 'Table',
    topScorers: 'Top scorers',
    colTeam: 'Team',
    colPlayed: 'P',
    colPoints: 'Pts',
    colPlayer: 'Player',
    colGoalsAssists: 'G+A',
    button: 'Open the season',
    optOut: 'You can turn these summaries off from your ATM dashboard.',
    header: { round: '{{league}} – Round {{round}}', picked: '{{league}} – Results' },
    subject: { round: '{{season}} - round {{round}} summary', picked: '{{season}} - latest results' },
  },
  resultsImage: {
    results: 'Results',
    table: 'Table',
    topScorers: 'Top scorers',
    notConfirmed: 'not confirmed',
    round: 'Round {{n}}',
    more: 'and {{n}} more',
    played: 'P',
    points: 'Pts',
  },

  taxDocument: {
    subject: 'Payment received – document {{number}}',
    header: 'Payment received',
    body: 'your payment of <strong>{{amount}}</strong> has arrived and the plan is active: {{item}}.',
    attached: 'Tax document no. {{number}} is attached.',
    file: 'document-{{number}}.pdf',
  },

  registrationReceived: {
    subject: 'Application for {{team}} – {{competition}}',
    header: 'Application received',
    received: 'the application of <strong>{{team}}</strong> to <strong>{{competition}}</strong> has arrived.',
    nextWaitlisted: "The competition is full right now, so you are on the waiting list. If a place frees up the organiser can accept you – we'll let you know by email.",
    next: "The organiser will now review it. We'll email you their decision.",
    button: 'View the competition',
    status: 'Check application status',
    statusHint: "The application page shows the organiser's decision, and you can withdraw the application there. Keep the link to yourself.",
  },
  registrationDecision: {
    subject: {
      APPROVED: '{{team}} is in {{competition}}',
      REJECTED: 'The application of {{team}} was not accepted',
      WAITLISTED: '{{team}} is on the waiting list – {{competition}}',
      PROMOTED: 'A place opened for {{team}} – {{competition}}',
    },
    header: { APPROVED: 'Application approved', REJECTED: 'Application declined', WAITLISTED: 'Waiting list', PROMOTED: 'A place opened' },
    text: {
      APPROVED: 'the organiser approved the application of <strong>{{team}}</strong> to <strong>{{competition}}</strong>. The team is now in the competition.',
      REJECTED: 'the organiser of <strong>{{competition}}</strong> did not accept the application of <strong>{{team}}</strong>.',
      WAITLISTED: 'the application of <strong>{{team}}</strong> to <strong>{{competition}}</strong> is on the waiting list. If a place frees up the organiser can accept you.',
      PROMOTED: "a place opened in <strong>{{competition}}</strong> and the application of <strong>{{team}}</strong> has moved up from the waiting list. It now waits for the organiser's decision.",
    },
    reason: 'Reason: {{reason}}',
    buttonApproved: 'Open ATM',
    button: 'View the competition',
  },
  registrationNotice: {
    subject: 'New application: {{team}} – {{competition}}',
    header: 'New team application',
    applied: 'The team <strong>{{team}}</strong> applied to <strong>{{competition}}</strong>.',
    contact: 'Contact: {{name}} &lt;{{email}}&gt;',
    waitlisted: 'The competition is full, so the application is on the waiting list.',
    button: 'Open applications',
  },
  registrationWithdrawn: {
    subject: 'A place opened: {{competition}}',
    header: 'Application withdrawn',
    withdrew: 'The team <strong>{{team}}</strong> withdrew its application to <strong>{{competition}}</strong>, which frees a place.',
    waiting: 'There are {{count}} on the waiting list. Nobody moves up by themselves – you can move up the next one in the applications.',
    button: 'Open applications',
  },
  places: {
    approved: '{{count}} in the competition',
    pending: '{{count}} waiting for a decision',
    waitlisted: '{{count}} on the waiting list',
    max: '{{count}} places',
    noLimit: 'no limit on places',
  },
};

export default en;
