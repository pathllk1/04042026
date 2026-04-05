// server/utils/emailService.ts
import nodemailer from 'nodemailer';
import { createError } from 'h3';
import { useRuntimeConfig } from '#imports';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface PasswordResetEmailData {
  fullname: string;
  resetUrl: string;
  expiresIn: string;
}

interface AccountLockoutEmailData {
  fullname: string;
  lockoutDuration: string;
  unlockTime: string;
}

class EmailService {
  private transporter: any;

  constructor() {
    try {
      const config = useRuntimeConfig();
      // Check if email credentials are available
      if (!config.emailUser || !config.emailPass) {
        console.warn('Email credentials not configured. Email service will be disabled.');
        this.transporter = null;
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: 'smtp.mail.yahoo.com',
        port: 465,
        service: 'smtp.mail.yahoo.com',
        secure: true,
        auth: {
          user: config.emailUser,
          pass: config.emailPass
        }
      });

      console.log('Email service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize email transporter:', error);
      this.transporter = null;
    }
  }

  private async sendEmail(options: EmailOptions): Promise<void> {
    const config = useRuntimeConfig();
    if (!this.transporter) {
      console.warn('Email service not configured. Email would be sent to:', options.to);
      console.warn('Email subject:', options.subject);
      // In development, just log the email instead of failing
      if (config.public.nodeEnv === 'development') {
        console.log('Email content (development mode):', options.html);
        return;
      }

      throw createError({
        statusCode: 500,
        statusMessage: 'Email service not configured'
      });
    }

    const mailOptions = {
      from: config.emailFrom || 'paul.anjan3@yahoo.in',
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text
    };

    try {
      await new Promise((resolve, reject) => {
        this.transporter.sendMail(mailOptions, (err: any, info: any) => {
          if (err) {
            console.error('Error sending email:', err);
            reject(err);
          } else {
            console.log('Email sent successfully:', info.messageId);
            resolve(info);
          }
        });
      });
    } catch (error) {
      console.error('Email service error:', error);
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to send email'
      });
    }
  }

  async sendPasswordResetEmail(email: string, data: PasswordResetEmailData): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Password Reset Request</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 30px; background-color: #ffffff; border: 1px solid #e9ecef; }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #007bff; 
            color: white; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 20px 0;
          }
          .footer { 
            font-size: 12px; 
            text-align: center; 
            margin-top: 30px; 
            color: #777; 
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 0 0 8px 8px;
          }
          .warning { 
            background-color: #fff3cd; 
            border: 1px solid #ffeaa7; 
            padding: 15px; 
            border-radius: 5px; 
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; color: #007bff;">Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hello ${data.fullname},</p>
            
            <p>We received a request to reset your password for your BusinessPro Suite account.</p>
            
            <p>Click the button below to reset your password:</p>
            
            <div style="text-align: center;">
              <a href="${data.resetUrl}" class="button">Reset Password</a>
            </div>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 5px;">
              ${data.resetUrl}
            </p>
            
            <div class="warning">
              <strong>Important:</strong>
              <ul>
                <li>This link will expire in ${data.expiresIn}</li>
                <li>If you didn't request this password reset, please ignore this email</li>
                <li>For security reasons, never share this link with anyone</li>
              </ul>
            </div>
            
            <p>If you continue to have problems, please contact our support team.</p>
            
            <p>Best regards,<br>BusinessPro Suite Security Team</p>
          </div>
          <div class="footer">
            <p>This is an automated security message. Please do not reply to this email.</p>
            <p>If you didn't request this password reset, your account is still secure.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Password Reset Request
      
      Hello ${data.fullname},
      
      We received a request to reset your password for your BusinessPro Suite account.
      
      Please visit the following link to reset your password:
      ${data.resetUrl}
      
      This link will expire in ${data.expiresIn}.
      
      If you didn't request this password reset, please ignore this email.
      
      Best regards,
      BusinessPro Suite Security Team
    `;

    await this.sendEmail({
      to: email,
      subject: 'Password Reset Request - BusinessPro Suite',
      html,
      text
    });
  }

  async sendAccountLockoutEmail(email: string, data: AccountLockoutEmailData): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Account Security Alert</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #dc3545; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 30px; background-color: #ffffff; border: 1px solid #e9ecef; }
          .footer { 
            font-size: 12px; 
            text-align: center; 
            margin-top: 30px; 
            color: #777; 
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 0 0 8px 8px;
          }
          .alert { 
            background-color: #f8d7da; 
            border: 1px solid #f5c6cb; 
            padding: 15px; 
            border-radius: 5px; 
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; color: white;">Account Security Alert</h1>
          </div>
          <div class="content">
            <p>Hello ${data.fullname},</p>
            
            <div class="alert">
              <strong>Your account has been temporarily locked due to multiple failed login attempts.</strong>
            </div>
            
            <p><strong>Lockout Details:</strong></p>
            <ul>
              <li>Duration: ${data.lockoutDuration}</li>
              <li>Account will be unlocked at: ${data.unlockTime}</li>
              <li>Reason: Multiple failed login attempts detected</li>
            </ul>
            
            <p><strong>What you can do:</strong></p>
            <ul>
              <li>Wait for the lockout period to expire</li>
              <li>If you forgot your password, use the password reset feature after the lockout expires</li>
              <li>Contact support if you believe this is an error</li>
            </ul>
            
            <p><strong>Security Tips:</strong></p>
            <ul>
              <li>Ensure you're using the correct username and password</li>
              <li>Check if Caps Lock is enabled</li>
              <li>Consider using a password manager</li>
            </ul>
            
            <p>If you didn't attempt to log in, please contact our security team immediately.</p>
            
            <p>Best regards,<br>BusinessPro Suite Security Team</p>
          </div>
          <div class="footer">
            <p>This is an automated security alert. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: 'Security Alert: Account Temporarily Locked - BusinessPro Suite',
      html
    });
  }

  async sendPasswordChangeNotification(email: string, fullname: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Password Changed Successfully</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #28a745; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 30px; background-color: #ffffff; border: 1px solid #e9ecef; }
          .footer { 
            font-size: 12px; 
            text-align: center; 
            margin-top: 30px; 
            color: #777; 
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 0 0 8px 8px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; color: white;">Password Changed Successfully</h1>
          </div>
          <div class="content">
            <p>Hello ${fullname},</p>
            
            <p>Your password has been successfully changed for your BusinessPro Suite account.</p>
            
            <p><strong>Change Details:</strong></p>
            <ul>
              <li>Date: ${new Date().toLocaleString()}</li>
              <li>Action: Password updated</li>
            </ul>
            
            <p>If you didn't make this change, please contact our security team immediately.</p>
            
            <p>Best regards,<br>BusinessPro Suite Security Team</p>
          </div>
          <div class="footer">
            <p>This is an automated security notification.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: 'Password Changed Successfully - BusinessPro Suite',
      html
    });
  }
}

export const emailService = new EmailService();
