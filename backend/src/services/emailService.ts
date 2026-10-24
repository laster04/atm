import { Resend } from 'resend';
import { emailTexts, fill, fillText, intlLocale, type Locale } from '../i18n/index.js';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: { filename: string; content: Buffer }[];
}

const COLORS = {
  text: '#030213',
  muted: '#717182',
  inputBg: '#f3f3f5',
  canvasBg: '#f0f0f2',
  border: 'rgba(0,0,0,0.08)',
};

type IconName = 'user-plus' | 'trophy' | 'mail-check' | 'lock' | 'shield-check' | 'badge-check';

const ICON_PATHS: Record<IconName, string> = {
  'user-plus': '<circle cx="9" cy="8.2" r="3.2"/><path d="M3.5 20c0-3.6 2.6-6.2 5.8-6.2 1.4 0 2.7.5 3.7 1.3"/><path d="M19 6v6"/><path d="M16 9h6"/>',
  trophy: '<path d="M7.5 4h9v3.2a4.5 4.5 0 0 1-9 0V4z"/><path d="M7.5 5H4.8A2.3 2.3 0 0 0 7.5 8.6"/><path d="M16.5 5h2.7A2.3 2.3 0 0 1 16.5 8.6"/><path d="M12 11.2v2.8"/><path d="M9.3 19h5.4"/><path d="M10.6 14h2.8l.6 5h-4l.6-5z"/>',
  'mail-check': '<rect x="3" y="5.5" width="18" height="13" rx="2.2"/><path d="M3.3 7l8.7 5.8L20.7 7"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2.2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
  'shield-check': '<path d="M12 3.2l6.8 2.8v5.6c0 4.7-3.2 7.2-6.8 8.4-3.6-1.2-6.8-3.7-6.8-8.4V6l6.8-2.8z"/><path d="M8.9 12l2.1 2.1 4.1-4.1"/>',
  'badge-check': '<circle cx="12" cy="12" r="8.2"/><path d="M8.6 12.2l2.3 2.3 4.5-4.5"/>',
};

function iconSvg(name: IconName): string {
  return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name]}</svg>`;
}

/** Where a competition's places stand, as the registration emails tell it. */
interface PlacesSummary {
  approved: number;
  pending: number;
  waitlisted: number;
  max: number | null;
}

/** "6 v soutěži · 2 čeká na rozhodnutí · 3 na čekací listině · 8 míst" for the organiser. */
const placesLine = (places: PlacesSummary, locale: Locale): string => {
  const t = emailTexts(locale).places;
  return [
    fill(t.approved, { count: places.approved }),
    fill(t.pending, { count: places.pending }),
    fill(t.waitlisted, { count: places.waitlisted }),
    places.max != null ? fill(t.max, { count: places.max }) : t.noLimit,
  ].join(' · ');
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

class EmailService {
  private resend: Resend | null = null;

  private getResend(): Resend {
    if (!this.resend) {
      this.resend = new Resend(process.env.RESEND_API_KEY);
    }
    return this.resend;
  }

  /** Tests never send, whatever key the environment happens to carry. */
  private isConfigured(): boolean {
    return process.env.NODE_ENV !== 'test' && !!process.env.RESEND_API_KEY;
  }

  private getFromAddress(): string {
    return process.env.EMAIL_FROM || 'ATM <onboarding@resend.dev>';
  }

  private getAppUrl(): string {
    return process.env.APP_URL || 'http://localhost:5173';
  }

  private getLogoUrl(): string {
    return `${this.getAppUrl()}/assets/logo-full-CODeYc4u.png`;
  }

  private p(text: string, opts: { mb?: number; size?: number; color?: string; weight?: number } = {}): string {
    const { mb = 16, size = 15, color = COLORS.text, weight = 400 } = opts;
    return `<p style="margin:0 0 ${mb}px;font-size:${size}px;line-height:1.6;color:${color};font-weight:${weight};">${text}</p>`;
  }

  private button(label: string, url: string, accent: string): string {
    return `
      <div style="text-align:center;margin:28px 0;">
        <a href="${url}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 34px;border-radius:9px;">${label}</a>
      </div>`;
  }

  private linkChip(copyLabel: string, url: string, accent: string): string {
    return `
      ${this.p(copyLabel, { mb: 8, size: 13, color: COLORS.muted })}
      <div style="background:${COLORS.inputBg};border-radius:8px;padding:11px 14px;font-size:12px;color:${accent};word-break:break-all;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;">${url}</div>`;
  }

  private warningBox(title: string, text: string): string {
    return `
      <div style="background:#fef2f2;border:1px solid #fbc7ce;border-radius:10px;padding:14px 16px;margin-top:24px;">
        <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${COLORS.text};">${title}</p>
        <p style="margin:0;font-size:13px;line-height:1.55;color:${COLORS.text};">${text}</p>
      </div>`;
  }

  /**
   * The page every e-mail sits in. A Turnaj Plus tournament's e-mails carry its
   * series' mark at the top (logo, else name) and only a small ATM credit below.
   */
  private buildEmailHtml(
    accent: string,
    icon: IconName,
    headerTitle: string,
    bodyHtml: string,
    brand?: { mark: EmailBrand; locale: Locale } | null
  ): string {
    const top = brand
      ? brand.mark.logo
        ? `<img src="${escapeHtml(brand.mark.logo)}" alt="${escapeHtml(brand.mark.name)}" style="max-height:56px;max-width:240px;width:auto;">`
        : `<span style="font-size:20px;font-weight:800;color:${COLORS.text};">${escapeHtml(brand.mark.name)}</span>`
      : `<img src="${this.getLogoUrl()}" alt="ATM - Amateur Team Manager" style="height:34px;width:auto;">`;
    const bottom = brand
      ? `<a href="${this.getAppUrl()}" style="font-size:12px;color:#a1a1aa;text-decoration:none;">${emailTexts(brand.locale).poweredBy}</a>`
      : `<p style="margin:0;font-size:12px;color:#a1a1aa;">ATM &ndash; Amateur Team Management</p>`;
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
      </head>
      <body style="margin:0;">
        <div style="background:${COLORS.canvasBg};font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;padding:40px 20px;box-sizing:border-box;">
          <div style="max-width:600px;margin:0 auto;">

            <div style="text-align:center;padding-bottom:28px;">
              ${top}
            </div>

            <div style="background:#ffffff;border-radius:14px;border:1px solid ${COLORS.border};box-shadow:0 1px 3px rgba(0,0,0,0.05);overflow:hidden;">
              <div style="background:${accent};padding:36px 32px 32px;text-align:center;">
                <div style="display:inline-flex;width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,0.18);align-items:center;justify-content:center;margin-bottom:16px;">
                  ${iconSvg(icon)}
                </div>
                <div style="color:#ffffff;font-size:21px;font-weight:700;letter-spacing:-0.01em;line-height:1.3;">${headerTitle}</div>
              </div>

              <div style="padding:36px 32px 32px;">
                ${bodyHtml}
              </div>
            </div>

            <div style="text-align:center;padding-top:28px;">
              ${bottom}
            </div>

          </div>
        </div>
      </body>
      </html>
    `;
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.isConfigured()) {
      if (process.env.NODE_ENV === 'test') return false;
      // In development the mail is logged instead, so the links in it
      // (activation, application status) can be followed by hand.
      if (process.env.NODE_ENV !== 'production') {
        const links = [...options.html.matchAll(/href="([^"]+)"/g)].map((match) => match[1].replace(/&amp;/g, '&'));
        console.info(`[email:dev] to=${options.to} subject="${options.subject}"${links.length ? `\n  ${links.join('\n  ')}` : ''}`);
        return false;
      }
      console.warn('Email service not configured (RESEND_API_KEY missing). Skipping email send.');
      return false;
    }

    try {
      const { error } = await this.getResend().emails.send({
        from: this.getFromAddress(),
        to: options.to,
        subject: options.subject,
        html: options.html,
        ...(options.replyTo ? { replyTo: options.replyTo } : {}),
        ...(options.attachments ? { attachments: options.attachments } : {}),
      });

      if (error) {
        console.error('Failed to send email:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  async sendActivationEmail(
    to: string,
    name: string,
    activationToken: string,
    /** A path in the app the activation page sends the user on to. */
    next?: string | null,
    locale: Locale = 'cs'
  ): Promise<boolean> {
    const activationLink = `${this.getAppUrl()}/activate/${activationToken}${next ? `?next=${encodeURIComponent(next)}` : ''}`;
    const accent = '#2563eb';
    const all = emailTexts(locale);
    const t = all.activation;

    const body = [
      this.p(fill(all.greeting, { name })),
      this.p(t.intro, { mb: 0 }),
      this.button(t.button, activationLink, accent),
      this.linkChip(all.copyLink, activationLink, accent),
      this.p(t.expiry, { mb: 8, size: 13, color: COLORS.muted }),
      this.p(t.ignore, { mb: 0, size: 13, color: COLORS.muted }),
    ].join('');

    return this.sendEmail({ to, subject: t.subject, html: this.buildEmailHtml(accent, 'mail-check', t.header, body) });
  }

  async sendPasswordResetEmail(to: string, name: string, resetToken: string, locale: Locale = 'cs'): Promise<boolean> {
    const resetLink = `${this.getAppUrl()}/reset-password/${resetToken}`;
    const accent = '#d4183d';
    const all = emailTexts(locale);
    const t = all.passwordReset;

    const body = [
      this.p(fill(all.greeting, { name })),
      this.p(t.intro, { mb: 0 }),
      this.button(t.button, resetLink, accent),
      this.linkChip(all.copyLink, resetLink, accent),
      this.p(t.expiry, { mb: 0, size: 13, color: COLORS.muted }),
      this.warningBox(t.warningTitle, t.warningText),
    ].join('');

    return this.sendEmail({ to, subject: t.subject, html: this.buildEmailHtml(accent, 'lock', t.header, body) });
  }

  async sendPasswordChangedEmail(to: string, name: string, locale: Locale = 'cs'): Promise<boolean> {
    const accent = '#16a34a';
    const all = emailTexts(locale);
    const t = all.passwordChanged;

    const body = [
      this.p(fill(all.greeting, { name })),
      this.p(t.done, { mb: 8 }),
      this.p(t.noAction, { mb: 0, size: 13, color: COLORS.muted }),
      this.warningBox(t.warningTitle, t.warningText),
    ].join('');

    return this.sendEmail({ to, subject: t.subject, html: this.buildEmailHtml(accent, 'shield-check', t.header, body) });
  }

  async sendWelcomeEmail(to: string, name: string, locale: Locale = 'cs'): Promise<boolean> {
    const loginLink = `${this.getAppUrl()}/login`;
    const accent = '#030213';
    const all = emailTexts(locale);
    const t = all.welcome;

    const bullets = t.can.map((item) => `<li style="margin:0 0 8px;">${item}</li>`).join('');

    const body = [
      this.p(fill(all.greeting, { name })),
      this.p(t.intro, { mb: 0 }),
      this.button(t.button, loginLink, accent),
      this.p(t.canTitle, { mb: 8 }),
      `<ul style="margin:0 0 8px;padding-left:20px;font-size:15px;line-height:1.6;color:${COLORS.text};">${bullets}</ul>`,
      this.p(t.questions, { mb: 0, size: 13, color: COLORS.muted }),
    ].join('');

    return this.sendEmail({ to, subject: t.subject, html: this.buildEmailHtml(accent, 'badge-check', t.header, body) });
  }

  /**
   * The invitation to manage a team or a league. Someone new to ATM is asked to
   * choose a password; someone who already has an account signs in. Either way
   * nothing is granted until they open the link and accept.
   */
  async sendManagerInvitationEmail(params: {
    to: string;
    inviteeName: string;
    /** PLAYER: joining a roster, with the team as the target. */
    kind: 'TEAM' | 'LEAGUE' | 'PLAYER';
    targetName: string;
    /** "League · Season" the team plays in, when there is one. */
    contextName: string | null;
    inviterName: string | null;
    inviterEmail: string | null;
    link: string;
    expiresAt: Date;
    hasAccount: boolean;
    locale: Locale;
  }): Promise<boolean> {
    const accent = '#0F172A';
    const all = emailTexts(params.locale);
    const t = all.invite;
    const { kind } = params;
    const isTeam = kind === 'TEAM';
    const isPlayer = kind === 'PLAYER';
    const by = params.inviterName ? 'byName' : 'anonymous';
    const vars = {
      inviter: params.inviterName,
      target: params.targetName,
      context: params.contextName ? fillText(t.context, { context: params.contextName }) : '',
      date: params.expiresAt.toLocaleDateString(intlLocale(params.locale), {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Europe/Prague',
      }),
    };
    const role = isPlayer ? 'PLAYER' : 'manager';
    const reply = params.inviterEmail ? t.reply[role] : '';

    const list = (title: string, items: string[]) => `
      <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:${COLORS.text};">${title}</p>
      <ul style="margin:0 0 18px;padding-left:20px;font-size:14px;line-height:1.6;color:${COLORS.text};">
        ${items.map((item) => `<li>${item}</li>`).join('')}
      </ul>`;

    const body = [
      this.p(fill(all.greeting, { name: params.inviteeName })),
      this.p(fill(t.invited[kind][by], vars)),
      this.p(params.hasAccount ? t.next.hasAccount : t.next[role], { mb: 0 }),
      this.button(t.button, params.link, accent),
      this.p(fill(t.expiry, vars), { mb: 24, size: 13, color: COLORS.muted }),
      list(t.canTitle[role], t.can[kind]),
      // A season manager answers to an administrator, not to another season
      // manager, and a player keeps nothing, so the "who keeps what" split only
      // makes sense for a team manager.
      isTeam ? list(fill(t.keepTitle[by], vars), t.keep) : '',
      this.linkChip(all.copyLink, params.link, accent),
      `<div style="height:20px"></div>`,
      this.p(t.ignore, { mb: reply ? 8 : 0, size: 13, color: COLORS.muted }),
      reply ? this.p(reply, { mb: 0, size: 13, color: COLORS.muted }) : '',
    ].join('');

    return this.sendEmail({
      to: params.to,
      subject: fillText(t.subject[kind][by], vars),
      html: this.buildEmailHtml(accent, isTeam || isPlayer ? 'user-plus' : 'trophy', t.header[kind], body),
      replyTo: params.inviterEmail ?? undefined,
    });
  }

  /**
   * The round summary: what was played, the table it leaves behind, and who is
   * leading the scoring. Sent to everyone involved in a season who has not
   * turned it off, each in their own language.
   */
  async sendRoundSummaryEmail(
    to: string,
    name: string,
    summary: {
      seasonId: string;
      seasonName: string;
      leagueName: string;
      round: number | null;
      results: {
        homeTeam: string;
        awayTeam: string;
        homeScore: number | null;
        awayScore: number | null;
        confirmed: boolean;
      }[];
      standings: { rank: number; team: string; played: number; points: number }[];
      topScorers: { name: string; team: string; goals: number; assists: number; points: number; detail: string | null }[];
    },
    locale: Locale = 'cs'
  ): Promise<boolean> {
    const accent = '#003E7E';
    const seasonLink = `${this.getAppUrl()}/season-detail/${summary.seasonId}`;
    const all = emailTexts(locale);
    const texts = all.roundSummary;
    // An email of hand-picked games has no round to name.
    const which = summary.round !== null ? 'round' : 'picked';
    const vars = { round: summary.round, season: summary.seasonName, league: summary.leagueName };

    const cell = (content: string, opts: { align?: string; bold?: boolean; muted?: boolean } = {}) =>
      `<td style="padding:7px 8px;font-size:14px;text-align:${opts.align ?? 'left'};` +
      `font-weight:${opts.bold ? 700 : 400};color:${opts.muted ? COLORS.muted : COLORS.text};` +
      `border-bottom:1px solid ${COLORS.border};">${content}</td>`;

    const table = (head: string, rows: string) =>
      `<table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 24px;">` +
      `<thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;

    const th = (content: string, align = 'left') =>
      `<th style="padding:0 8px 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;` +
      `text-align:${align};color:${COLORS.muted};font-weight:600;">${content}</th>`;

    const resultRows = summary.results
      .map((game) => {
        const score =
          game.homeScore != null && game.awayScore != null
            ? `${game.homeScore} : ${game.awayScore}`
            : '&mdash;';
        // A result still open to correction has not moved the table below, so
        // it is marked rather than shown as if it had.
        const pending = game.confirmed
          ? ''
          : ` <span style="font-size:11px;color:${COLORS.muted};">(${texts.notConfirmed})</span>`;
        return `<tr>${cell(escapeHtml(game.homeTeam), { align: 'right' })}` +
          `${cell(score, { align: 'center', bold: true })}` +
          `${cell(escapeHtml(game.awayTeam) + pending)}</tr>`;
      })
      .join('');

    const standingRows = summary.standings
      .map(
        (row) =>
          `<tr>${cell(String(row.rank), { align: 'right', muted: true })}` +
          `${cell(escapeHtml(row.team))}` +
          `${cell(String(row.played), { align: 'center', muted: true })}` +
          `${cell(String(row.points), { align: 'right', bold: true })}</tr>`
      )
      .join('');

    const scorerRows = summary.topScorers
      .map(
        (scorer) =>
          `<tr>${cell(escapeHtml(scorer.name))}` +
          `${cell(escapeHtml(scorer.team), { muted: true })}` +
          `${cell(scorer.detail ?? '', { align: 'center', muted: true })}` +
          `${cell(String(scorer.points), { align: 'right', bold: true })}</tr>`
      )
      .join('');

    const body = [
      this.p(fill(all.greeting, { name })),
      this.p(fill(texts.intro[which], vars), { mb: 24 }),
      `<p style="margin:0 0 10px;font-size:13px;font-weight:700;color:${COLORS.text};">${texts.results}</p>`,
      table('', resultRows),
      `<p style="margin:0 0 10px;font-size:13px;font-weight:700;color:${COLORS.text};">${texts.table}</p>`,
      table(
        `${th('#', 'right')}${th(texts.colTeam)}${th(texts.colPlayed, 'center')}${th(texts.colPoints, 'right')}`,
        standingRows
      ),
      summary.topScorers.length > 0
        ? `<p style="margin:0 0 10px;font-size:13px;font-weight:700;color:${COLORS.text};">${texts.topScorers}</p>` +
          table(
            `${th(texts.colPlayer)}${th(texts.colTeam)}${th(texts.colGoalsAssists, 'center')}${th(texts.colPoints, 'right')}`,
            scorerRows
          )
        : '',
      this.button(texts.button, seasonLink, accent),
      this.p(texts.optOut, { mb: 0, size: 13, color: COLORS.muted }),
    ].join('');

    return this.sendEmail({
      to,
      subject: fillText(texts.subject[which], vars),
      html: this.buildEmailHtml(accent, 'trophy', fill(texts.header[which], vars), body),
    });
  }

  /** Tells whoever handles support that a message came in through /contact. */
  async sendSupportTicketEmail(
    to: string,
    ticket: { id: string; category: string; subject: string; message: string; email: string | null; senderName: string | null }
  ): Promise<boolean> {
    const accent = '#0B63F6';
    const from = ticket.senderName
      ? `${escapeHtml(ticket.senderName)}${ticket.email ? ` &lt;${escapeHtml(ticket.email)}&gt;` : ''}`
      : ticket.email
        ? escapeHtml(ticket.email)
        : 'anonymous, no reply address';

    const body = [
      this.p(`<strong>${escapeHtml(ticket.category)}</strong> &middot; from ${from}`, { mb: 12, size: 13, color: COLORS.muted }),
      this.p(`<strong>${escapeHtml(ticket.subject)}</strong>`, { mb: 12 }),
      `<div style="white-space:pre-wrap;font-size:14px;line-height:1.6;color:${COLORS.text};background:${COLORS.inputBg};border-radius:10px;padding:16px;margin-bottom:24px;">${escapeHtml(ticket.message)}</div>`,
      this.button('Open in admin', `${this.getAppUrl()}/admin/support`, accent),
    ].join('');

    return this.sendEmail({
      to,
      subject: `[ATM support] ${ticket.subject.slice(0, 120)}`,
      html: this.buildEmailHtml(accent, 'mail-check', 'New support message', body),
    });
  }

  /** Tells the payer their transfer arrived, with the tax document attached. */
  async sendTaxDocumentEmail(params: {
    to: string;
    name: string;
    locale: Locale;
    number: string;
    /** The document's line; it exists in Czech and English, a Slovak payer reads the Czech one. */
    item: { cs: string; en: string };
    amount: string;
    pdf: Buffer;
  }): Promise<boolean> {
    const accent = '#0F172A';
    const all = emailTexts(params.locale);
    const t = all.taxDocument;
    const vars = { number: params.number, amount: params.amount, item: params.locale === 'en' ? params.item.en : params.item.cs };
    const body = [
      this.p(fill(all.greeting, { name: params.name })),
      this.p(fill(t.body, vars)),
      this.p(fill(t.attached, vars), { mb: 0, size: 14, color: COLORS.muted }),
    ].join('');
    return this.sendEmail({
      to: params.to,
      subject: fillText(t.subject, vars),
      html: this.buildEmailHtml(accent, 'badge-check', t.header, body),
      attachments: [{ filename: fillText(t.file, vars), content: params.pdf }],
    });
  }

  /** Tells an admin a plan payment was started, so they watch the account for the transfer. */
  async sendPaymentNoticeEmail(params: {
    to: string;
    variableSymbol: number;
    productName: string;
    tournamentName: string | null;
    payerEmail: string | null;
    amount: number;
    currency: string;
  }): Promise<boolean> {
    const accent = '#0F172A';
    const amount = `${(params.amount / 100).toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${params.currency === 'CZK' ? 'Kč' : '€'}`;
    const body = [
      this.p(`Organizátor zvolil plán <strong>${escapeHtml(params.productName)}</strong>${params.tournamentName ? ` pro turnaj <strong>${escapeHtml(params.tournamentName)}</strong>` : ''} a dostal QR platbu.`),
      this.p(`Částka: <strong>${amount}</strong> &middot; variabilní symbol <strong>${params.variableSymbol}</strong>`, { size: 14 }),
      params.payerEmail ? this.p(`Plátce: ${escapeHtml(params.payerEmail)}`, { size: 14, color: COLORS.muted }) : '',
      this.p('Až platba dorazí na účet, potvrďte ji v administraci; plán se tím odemkne.', { size: 14, color: COLORS.muted }),
      this.button('Otevřít platby', `${this.getAppUrl()}/admin/payments?status=PENDING`, accent),
    ].join('');
    return this.sendEmail({
      to: params.to,
      subject: `Čeká platba ${params.variableSymbol}: ${params.productName}`,
      html: this.buildEmailHtml(accent, 'badge-check', 'Nová platba k potvrzení', body),
    });
  }

  /** Tells an applicant their application arrived, and whether it is waiting for a place. */
  async sendRegistrationReceivedEmail(params: {
    to: string;
    contactName: string;
    teamName: string;
    competitionName: string;
    waitlisted: boolean;
    link: string;
    /** A tournament applicant without an account follows this to see and withdraw the application. */
    statusLink?: string | null;
    locale: Locale;
    /** A Turnaj Plus tournament's mark; the full ATM brand when absent. */
    brand?: EmailBrand | null;
  }): Promise<boolean> {
    const accent = '#0F172A';
    const all = emailTexts(params.locale);
    const t = all.registrationReceived;
    const vars = { team: params.teamName, competition: params.competitionName };
    const body = [
      this.p(fill(all.greeting, { name: params.contactName })),
      this.p(fill(t.received, vars)),
      this.p(params.waitlisted ? t.nextWaitlisted : t.next, { mb: 0 }),
      params.statusLink
        ? this.button(t.status, params.statusLink, accent) + this.p(t.statusHint, { mb: 0, size: 14, color: COLORS.muted })
        : this.button(t.button, params.link, accent),
    ].join('');
    return this.sendEmail({ to: params.to, subject: fillText(t.subject, vars), html: this.buildEmailHtml(accent, 'mail-check', t.header, body, params.brand ? { mark: params.brand, locale: params.locale } : null) });
  }

  /** Tells the organiser a team applied, with what they need to decide. */
  async sendRegistrationNoticeEmail(params: {
    to: string;
    teamName: string;
    contactName: string;
    contactEmail: string;
    competitionName: string;
    waitlisted: boolean;
    capacity: PlacesSummary;
    link: string;
    locale: Locale;
    /** A Turnaj Plus tournament's mark; the full ATM brand when absent. */
    brand?: EmailBrand | null;
  }): Promise<boolean> {
    const accent = '#0F172A';
    const t = emailTexts(params.locale).registrationNotice;
    const vars = { team: params.teamName, competition: params.competitionName, name: params.contactName, email: params.contactEmail };
    const body = [
      this.p(fill(t.applied, vars)),
      this.p(fill(t.contact, vars), { size: 14, color: COLORS.muted }),
      params.waitlisted ? this.p(t.waitlisted, { size: 14 }) : '',
      this.p(placesLine(params.capacity, params.locale), { size: 14, color: COLORS.muted }),
      this.button(t.button, params.link, accent),
    ].join('');
    return this.sendEmail({
      to: params.to,
      subject: fillText(t.subject, vars),
      html: this.buildEmailHtml(accent, 'user-plus', t.header, body, params.brand ? { mark: params.brand, locale: params.locale } : null),
      replyTo: params.contactEmail,
    });
  }

  /** The organiser's decision on an application, with the reason when they gave one. */
  async sendRegistrationDecisionEmail(params: {
    to: string;
    contactName: string;
    teamName: string;
    competitionName: string;
    decision: 'APPROVED' | 'REJECTED' | 'WAITLISTED' | 'PROMOTED';
    reason: string | null;
    link: string;
    locale: Locale;
    /** A Turnaj Plus tournament's mark; the full ATM brand when absent. */
    brand?: EmailBrand | null;
  }): Promise<boolean> {
    const accent = params.decision === 'APPROVED' ? '#15803D' : '#0F172A';
    const all = emailTexts(params.locale);
    const t = all.registrationDecision;
    const vars = { team: params.teamName, competition: params.competitionName, reason: params.reason };
    const body = [
      this.p(fill(all.greeting, { name: params.contactName })),
      this.p(fill(t.text[params.decision], vars), { mb: params.reason ? 16 : 0 }),
      params.reason ? this.p(fill(t.reason, vars), { mb: 0, size: 14, color: COLORS.muted }) : '',
      this.button(params.decision === 'APPROVED' ? t.buttonApproved : t.button, params.link, accent),
    ].join('');
    return this.sendEmail({
      to: params.to,
      subject: fillText(t.subject[params.decision], vars),
      html: this.buildEmailHtml(accent, params.decision === 'APPROVED' ? 'badge-check' : 'mail-check', t.header[params.decision], body, params.brand ? { mark: params.brand, locale: params.locale } : null),
    });
  }

  /** Tells the organiser a pending application was withdrawn while teams wait for its place. */
  async sendRegistrationWithdrawnEmail(params: {
    to: string;
    teamName: string;
    competitionName: string;
    capacity: PlacesSummary;
    link: string;
    locale: Locale;
    /** A Turnaj Plus tournament's mark; the full ATM brand when absent. */
    brand?: EmailBrand | null;
  }): Promise<boolean> {
    const accent = '#0F172A';
    const t = emailTexts(params.locale).registrationWithdrawn;
    const vars = { team: params.teamName, competition: params.competitionName, count: params.capacity.waitlisted };
    const body = [
      this.p(fill(t.withdrew, vars)),
      this.p(fill(t.waiting, vars)),
      this.p(placesLine(params.capacity, params.locale), { size: 14, color: COLORS.muted }),
      this.button(t.button, params.link, accent),
    ].join('');
    return this.sendEmail({
      to: params.to,
      subject: fillText(t.subject, vars),
      html: this.buildEmailHtml(accent, 'user-plus', t.header, body, params.brand ? { mark: params.brand, locale: params.locale } : null),
    });
  }
}

/** A tournament series' own mark, shown on a Turnaj Plus tournament's e-mails. */
export interface EmailBrand {
  name: string;
  logo: string | null;
}

export const emailService = new EmailService();
export default emailService;
