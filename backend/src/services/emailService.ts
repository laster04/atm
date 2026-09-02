import { Resend } from 'resend';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
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

  private isConfigured(): boolean {
    return !!process.env.RESEND_API_KEY;
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

  private buildEmailHtml(accent: string, icon: IconName, headerTitle: string, bodyHtml: string): string {
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
              <img src="${this.getLogoUrl()}" alt="ATM - Amateur Team Manager" style="height:34px;width:auto;">
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
              <p style="margin:0;font-size:12px;color:#a1a1aa;">ATM &mdash; Amateur Team Management</p>
            </div>

          </div>
        </div>
      </body>
      </html>
    `;
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('Email service not configured (RESEND_API_KEY missing). Skipping email send.');
      return false;
    }

    try {
      const { error } = await this.getResend().emails.send({
        from: this.getFromAddress(),
        to: options.to,
        subject: options.subject,
        html: options.html,
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
    activationToken: string
  ): Promise<boolean> {
    const activationLink = `${this.getAppUrl()}/activate/${activationToken}`;
    const accent = '#2563eb';
    const safeName = escapeHtml(name);

    const body = [
      this.p(`Hello, <strong>${safeName}</strong>,`),
      this.p('Thank you for registering at Amateur Team Management (ATM). To complete your registration and activate your account, please click the button below:', { mb: 0 }),
      this.button('Activate My Account', activationLink, accent),
      this.linkChip('Or copy and paste this link into your browser:', activationLink, accent),
      this.p('This activation link will expire in <strong>24 hours</strong>.', { mb: 8, size: 13, color: COLORS.muted }),
      this.p('If you did not create an account, you can safely ignore this email.', { mb: 0, size: 13, color: COLORS.muted }),
    ].join('');

    const html = this.buildEmailHtml(accent, 'mail-check', 'Welcome to ATM!', body);

    return this.sendEmail({
      to,
      subject: 'Activate your ATM account',
      html,
    });
  }

  async sendPasswordResetEmail(
    to: string,
    name: string,
    resetToken: string
  ): Promise<boolean> {
    const resetLink = `${this.getAppUrl()}/reset-password/${resetToken}`;
    const accent = '#d4183d';
    const safeName = escapeHtml(name);

    const body = [
      this.p(`Hello, <strong>${safeName}</strong>,`),
      this.p('We received a request to reset your password for your ATM account. Click the button below to set a new password:', { mb: 0 }),
      this.button('Reset My Password', resetLink, accent),
      this.linkChip('Or copy and paste this link into your browser:', resetLink, accent),
      this.p('This link will expire in <strong>1 hour</strong>.', { mb: 0, size: 13, color: COLORS.muted }),
      this.warningBox(
        "Didn't request this?",
        "If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged."
      ),
    ].join('');

    const html = this.buildEmailHtml(accent, 'lock', 'Password Reset Request', body);

    return this.sendEmail({
      to,
      subject: 'Reset your ATM password',
      html,
    });
  }

  async sendPasswordChangedEmail(to: string, name: string): Promise<boolean> {
    const accent = '#16a34a';
    const safeName = escapeHtml(name);

    const body = [
      this.p(`Hello, <strong>${safeName}</strong>,`),
      this.p('Your password has been successfully changed.', { mb: 8 }),
      this.p('If you made this change, no further action is needed.', { mb: 0, size: 13, color: COLORS.muted }),
      this.warningBox(
        "Wasn't you?",
        'If you didn\'t change your password, please contact us immediately as your account may be compromised.'
      ),
    ].join('');

    const html = this.buildEmailHtml(accent, 'shield-check', 'Password Changed', body);

    return this.sendEmail({
      to,
      subject: 'Your ATM password has been changed',
      html,
    });
  }

  async sendWelcomeEmail(to: string, name: string): Promise<boolean> {
    const loginLink = `${this.getAppUrl()}/login`;
    const accent = '#030213';
    const safeName = escapeHtml(name);

    const bullets = ['Manage your teams and players', 'Track game schedules and results', 'View standings and statistics']
      .map((t) => `<li style="margin:0 0 8px;">${t}</li>`)
      .join('');

    const body = [
      this.p(`Hello, <strong>${safeName}</strong>,`),
      this.p('Your account has been successfully activated. You can now log in and start using ATM.', { mb: 0 }),
      this.button('Log In Now', loginLink, accent),
      this.p('With ATM you can:', { mb: 8 }),
      `<ul style="margin:0 0 8px;padding-left:20px;font-size:15px;line-height:1.6;color:${COLORS.text};">${bullets}</ul>`,
      this.p('If you have any questions, feel free to reach out to us.', { mb: 0, size: 13, color: COLORS.muted }),
    ].join('');

    const html = this.buildEmailHtml(accent, 'badge-check', 'Account Activated!', body);

    return this.sendEmail({
      to,
      subject: 'Welcome to ATM - Account Activated',
      html,
    });
  }

  async sendManagerInviteEmail(
    to: string,
    name: string,
    teamName: string,
    resetToken: string,
    locale?: string
  ): Promise<boolean> {
    const resetLink = `${this.getAppUrl()}/reset-password/${resetToken}`;
    const accent = '#f97316';
    const isCs = locale === 'cs';
    const safeName = escapeHtml(name);
    const safeTeamName = escapeHtml(teamName);

    const texts = isCs ? {
      subject: `Byli jste pozváni ke správě týmu ${teamName} v ATM`,
      headerTitle: 'Pozvánka pro manažera týmu',
      greeting: `Dobrý den, <strong>${safeName}</strong>,`,
      invited: `Byli jste pozváni jako manažer týmu <strong>${safeTeamName}</strong> v ATM &ndash; Amateur Team Management.`,
      setPassword: 'Pro začátek si prosím nastavte heslo kliknutím na tlačítko níže:',
      buttonText: 'Nastavit heslo',
      copyLink: 'Nebo zkopírujte a vložte tento odkaz do prohlížeče:',
      expiry: 'Platnost tohoto odkazu vyprší za <strong>1 hodinu</strong>.',
      afterSetup: 'Po nastavení hesla se můžete přihlásit a začít spravovat svůj tým.',
    } : {
      subject: `You've been invited to manage ${teamName} on ATM`,
      headerTitle: 'Team Manager Invitation',
      greeting: `Hello, <strong>${safeName}</strong>,`,
      invited: `You have been invited as the manager of <strong>${safeTeamName}</strong> in ATM (Amateur Team Management).`,
      setPassword: 'To get started, please set your password by clicking the button below:',
      buttonText: 'Set My Password',
      copyLink: 'Or copy and paste this link into your browser:',
      expiry: 'This link will expire in <strong>1 hour</strong>.',
      afterSetup: 'Once you\'ve set your password, you can log in and start managing your team.',
    };

    const body = [
      this.p(texts.greeting),
      this.p(texts.invited, { mb: 8 }),
      this.p(texts.setPassword, { mb: 0, size: 13, color: COLORS.muted }),
      this.button(texts.buttonText, resetLink, accent),
      this.linkChip(texts.copyLink, resetLink, accent),
      this.p(texts.expiry, { mb: 8, size: 13, color: COLORS.muted }),
      this.p(texts.afterSetup, { mb: 0 }),
    ].join('');

    const html = this.buildEmailHtml(accent, 'user-plus', texts.headerTitle, body);

    return this.sendEmail({
      to,
      subject: texts.subject,
      html,
    });
  }

  async sendLeagueManagerInviteEmail(
    to: string,
    name: string,
    leagueName: string,
    resetToken: string,
    locale?: string
  ): Promise<boolean> {
    const resetLink = `${this.getAppUrl()}/reset-password/${resetToken}`;
    const accent = '#f97316';
    const isCs = locale === 'cs';
    const safeName = escapeHtml(name);
    const safeLeagueName = escapeHtml(leagueName);

    const texts = isCs ? {
      subject: `Byli jste pozváni ke správě ligy ${leagueName} v ATM`,
      headerTitle: 'Pozvánka pro správce ligy',
      greeting: `Dobrý den, <strong>${safeName}</strong>,`,
      invited: `Byli jste pozváni jako správce ligy <strong>${safeLeagueName}</strong> v ATM &ndash; Amateur Team Management.`,
      setPassword: 'Pro začátek si prosím nastavte heslo kliknutím na tlačítko níže:',
      buttonText: 'Nastavit heslo',
      copyLink: 'Nebo zkopírujte a vložte tento odkaz do prohlížeče:',
      expiry: 'Platnost tohoto odkazu vyprší za <strong>1 hodinu</strong>.',
      afterSetup: 'Po nastavení hesla se můžete přihlásit a začít spravovat svou ligu.',
    } : {
      subject: `You've been invited to manage ${leagueName} on ATM`,
      headerTitle: 'League Manager Invitation',
      greeting: `Hello, <strong>${safeName}</strong>,`,
      invited: `You have been invited as the manager of <strong>${safeLeagueName}</strong> in ATM (Amateur Team Management).`,
      setPassword: 'To get started, please set your password by clicking the button below:',
      buttonText: 'Set My Password',
      copyLink: 'Or copy and paste this link into your browser:',
      expiry: 'This link will expire in <strong>1 hour</strong>.',
      afterSetup: 'Once you\'ve set your password, you can log in and start managing your league.',
    };

    const body = [
      this.p(texts.greeting),
      this.p(texts.invited, { mb: 8 }),
      this.p(texts.setPassword, { mb: 0, size: 13, color: COLORS.muted }),
      this.button(texts.buttonText, resetLink, accent),
      this.linkChip(texts.copyLink, resetLink, accent),
      this.p(texts.expiry, { mb: 8, size: 13, color: COLORS.muted }),
      this.p(texts.afterSetup, { mb: 0 }),
    ].join('');

    const html = this.buildEmailHtml(accent, 'trophy', texts.headerTitle, body);

    return this.sendEmail({
      to,
      subject: texts.subject,
      html,
    });
  }
}

export const emailService = new EmailService();
export default emailService;
