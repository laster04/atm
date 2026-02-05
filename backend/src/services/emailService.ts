import { Resend } from 'resend';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
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

  private buildEmailHtml(headerColor: string, headerTitle: string, bodyContent: string, extraStyles = ''): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .logo { background: #ffffff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .logo img { max-width: 220px; height: auto; }
          .header { background: ${headerColor}; color: white; padding: 16px 20px; text-align: center; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: ${headerColor}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 12px; border-radius: 6px; margin-top: 20px; }
          ${extraStyles}
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <img src="${this.getLogoUrl()}" alt="ATM - Amateur Team Manager" />
          </div>
          <div class="header">
            <h1 style="margin: 0;">${headerTitle}</h1>
          </div>
          <div class="content">
            ${bodyContent}
          </div>
          <div class="footer">
            <p>ATM - Amateur Team Management</p>
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

    const html = this.buildEmailHtml('#2563eb', 'Welcome to ATM!', `
      <h2>Hello ${name},</h2>
      <p>Thank you for registering at Amateur Team Management (ATM). To complete your registration and activate your account, please click the button below:</p>
      <p style="text-align: center;">
        <a href="${activationLink}" class="button">Activate My Account</a>
      </p>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #2563eb;">${activationLink}</p>
      <p>This activation link will expire in 24 hours.</p>
      <p>If you did not create an account, you can safely ignore this email.</p>
    `);

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

    const html = this.buildEmailHtml('#dc2626', 'Password Reset Request', `
      <h2>Hello ${name},</h2>
      <p>We received a request to reset your password for your ATM account. Click the button below to set a new password:</p>
      <p style="text-align: center;">
        <a href="${resetLink}" class="button">Reset My Password</a>
      </p>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #dc2626;">${resetLink}</p>
      <p>This link will expire in 1 hour.</p>
      <div class="warning">
        <strong>Didn't request this?</strong><br>
        If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
      </div>
    `);

    return this.sendEmail({
      to,
      subject: 'Reset your ATM password',
      html,
    });
  }

  async sendPasswordChangedEmail(to: string, name: string): Promise<boolean> {
    const html = this.buildEmailHtml('#16a34a', 'Password Changed', `
      <h2>Hello ${name},</h2>
      <p>Your password has been successfully changed.</p>
      <p>If you made this change, no further action is needed.</p>
      <div class="warning">
        <strong>Wasn't you?</strong><br>
        If you didn't change your password, please contact us immediately as your account may be compromised.
      </div>
    `);

    return this.sendEmail({
      to,
      subject: 'Your ATM password has been changed',
      html,
    });
  }

  async sendWelcomeEmail(to: string, name: string): Promise<boolean> {
    const appUrl = this.getAppUrl();

    const html = this.buildEmailHtml('#2563eb', 'Account Activated!', `
      <h2>Hello ${name},</h2>
      <p>Your account has been successfully activated. You can now log in and start using ATM.</p>
      <p style="text-align: center;">
        <a href="${appUrl}/login" class="button">Log In Now</a>
      </p>
      <p>With ATM you can:</p>
      <ul>
        <li>Manage your teams and players</li>
        <li>Track game schedules and results</li>
        <li>View standings and statistics</li>
      </ul>
      <p>If you have any questions, feel free to reach out to us.</p>
    `);

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
    const isCs = locale === 'cs';

    const texts = isCs ? {
      subject: `Byli jste pozváni ke správě týmu ${teamName} v ATM`,
      headerTitle: 'Pozvánka pro manažera týmu',
      greeting: `Dobrý den, ${name},`,
      invited: `Byli jste pozváni jako manažer týmu <strong>${teamName}</strong> v ATM (Amateur Team Management).`,
      setPassword: 'Pro začátek si prosím nastavte heslo kliknutím na tlačítko níže:',
      buttonText: 'Nastavit heslo',
      copyLink: 'Nebo zkopírujte a vložte tento odkaz do prohlížeče:',
      expiry: 'Platnost tohoto odkazu vyprší za 1 hodinu.',
      afterSetup: 'Po nastavení hesla se můžete přihlásit a začít spravovat svůj tým.',
    } : {
      subject: `You've been invited to manage ${teamName} on ATM`,
      headerTitle: 'Team Manager Invitation',
      greeting: `Hello ${name},`,
      invited: `You have been invited as the manager of <strong>${teamName}</strong> in ATM (Amateur Team Management).`,
      setPassword: 'To get started, please set your password by clicking the button below:',
      buttonText: 'Set My Password',
      copyLink: 'Or copy and paste this link into your browser:',
      expiry: 'This link will expire in 1 hour.',
      afterSetup: 'Once you\'ve set your password, you can log in and start managing your team.',
    };

    const html = this.buildEmailHtml('#f97316', texts.headerTitle, `
      <h2>${texts.greeting}</h2>
      <p>${texts.invited}</p>
      <p>${texts.setPassword}</p>
      <p style="text-align: center;">
        <a href="${resetLink}" class="button">${texts.buttonText}</a>
      </p>
      <p>${texts.copyLink}</p>
      <p style="word-break: break-all; color: #f97316;">${resetLink}</p>
      <p>${texts.expiry}</p>
      <p>${texts.afterSetup}</p>
    `);

    return this.sendEmail({
      to,
      subject: texts.subject,
      html,
    });
  }
}

export const emailService = new EmailService();
export default emailService;
