import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

class EmailService {
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
    return this.transporter;
  }

  private isConfigured(): boolean {
    return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('Email service not configured. Skipping email send.');
      return false;
    }

    try {
      await this.getTransporter().sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });
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
    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    const activationLink = `${appUrl}/activate/${activationToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ATM!</h1>
          </div>
          <div class="content">
            <h2>Hello ${name},</h2>
            <p>Thank you for registering at Amateur Team Management (ATM). To complete your registration and activate your account, please click the button below:</p>
            <p style="text-align: center;">
              <a href="${activationLink}" class="button">Activate My Account</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #2563eb;">${activationLink}</p>
            <p>This activation link will expire in 24 hours.</p>
            <p>If you did not create an account, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>ATM - Amateur Team Management</p>
          </div>
        </div>
      </body>
      </html>
    `;

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
    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    const resetLink = `${appUrl}/reset-password/${resetToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 12px; border-radius: 6px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
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
          </div>
          <div class="footer">
            <p>ATM - Amateur Team Management</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject: 'Reset your ATM password',
      html,
    });
  }

  async sendPasswordChangedEmail(to: string, name: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #16a34a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 12px; border-radius: 6px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Changed</h1>
          </div>
          <div class="content">
            <h2>Hello ${name},</h2>
            <p>Your password has been successfully changed.</p>
            <p>If you made this change, no further action is needed.</p>
            <div class="warning">
              <strong>Wasn't you?</strong><br>
              If you didn't change your password, please contact us immediately as your account may be compromised.
            </div>
          </div>
          <div class="footer">
            <p>ATM - Amateur Team Management</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject: 'Your ATM password has been changed',
      html,
    });
  }

  async sendWelcomeEmail(to: string, name: string): Promise<boolean> {
    const appUrl = process.env.APP_URL || 'http://localhost:5173';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Account Activated!</h1>
          </div>
          <div class="content">
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
          </div>
          <div class="footer">
            <p>ATM - Amateur Team Management</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject: 'Welcome to ATM - Account Activated',
      html,
    });
  }
}

export const emailService = new EmailService();
export default emailService;
