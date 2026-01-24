// apps/client-api/src/email/email.service.ts

import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    // Configuration du transporteur email
    // En dev, on utilise un service de test ou on log simplement
    if (process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      // Mode développement - utilise Ethereal (email de test)
      this.logger.warn('SMTP not configured, emails will be logged only');
    }
  }

  async sendPasswordResetEmail(
    to: string,
    username: string,
    resetToken: string,
  ): Promise<boolean> {
    const resetUrl = `${process.env.PASSWORD_RESET_URL || 'http://localhost:8081'}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: process.env.SMTP_FROM || 'Blackout <noreply@blackout.app>',
      to,
      subject: 'Réinitialisation de votre mot de passe Blackout',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #f97316;">Blackout</h1>
          <h2>Réinitialisation de mot de passe</h2>
          <p>Bonjour ${username},</p>
          <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
          <p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}"
               style="background-color: #f97316; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Réinitialiser mon mot de passe
            </a>
          </p>
          <p>Ou copiez ce lien dans votre navigateur :</p>
          <p style="word-break: break-all; color: #666;">${resetUrl}</p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            Ce lien expire dans 1 heure. Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
          </p>
        </div>
      `,
      text: `
        Bonjour ${username},

        Vous avez demandé la réinitialisation de votre mot de passe Blackout.

        Cliquez sur ce lien pour créer un nouveau mot de passe :
        ${resetUrl}

        Ce lien expire dans 1 heure.

        Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
      `,
    };

    try {
      if (this.transporter) {
        await this.transporter.sendMail(mailOptions);
        this.logger.log(`Password reset email sent to ${to}`);
      } else {
        // En dev, on log l'email
        this.logger.log('='.repeat(50));
        this.logger.log('📧 EMAIL DE RESET PASSWORD (dev mode)');
        this.logger.log(`To: ${to}`);
        this.logger.log(`Subject: ${mailOptions.subject}`);
        this.logger.log(`Reset URL: ${resetUrl}`);
        this.logger.log('='.repeat(50));
      }
      return true;
    } catch (error) {
      this.logger.error(`Failed to send password reset email: ${error.message}`);
      return false;
    }
  }
}
