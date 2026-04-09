import Document from '../../models/Document'
import User from '../../models/User';
import nodemailer from 'nodemailer'
import { createError } from 'h3'
import mongoose from 'mongoose';
import { useRuntimeConfig } from '#imports';

export default defineEventHandler(async (event) => {
  try {
    const userId = event.context.userId;
    const firmId = event.context.user.firmId;

    const user = await User.findById(userId); // Find the user by userId
    if (!user) {
      throw createError({
        statusCode: 404,
        message: 'User not found'
      });
    }

    const today = new Date();

    const td = new Date();
    td.setHours(0, 0, 0, 0);

    const lasttmailsent = user.lastmailsent;

    if (lasttmailsent > td) {
      throw createError({
        statusCode: 400,
        message: 'Email notification already sent today. You can only send one notification per day.'
      });
    }

    // Filter expired and expiring soon documents

    const data = await Document.find({
      firmId: firmId,
      status: { $ne: 'CLOSED' }
    });


    if (!data || data.length <= 0) {
      throw createError({
        statusCode: 404,
        message: 'No data to send email.'
      });
    }

    const todayPlus30Days = new Date();
    todayPlus30Days.setDate(today.getDate() + 30);

    // Filter expired and expiring soon documents
    const expiredDocs = data.filter(document => new Date(document.expiryDate) < today);
    const expiringDocs = data.filter(document =>
      new Date(document.expiryDate) >= today &&
      new Date(document.expiryDate) < todayPlus30Days
    );



    // Skip if no documents to notify about
    if (expiredDocs.length === 0 && expiringDocs.length === 0) {
      return { message: 'No documents to notify about' };
    }

    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    // Generate table rows for expiring documents
    const expiringDocsRows = expiringDocs.length > 0 ? expiringDocs.map(doc => `
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;">${doc.name}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${doc.ref_no}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${formatDate(doc.expiryDate)}</td>
            </tr>
          `).join('') : "";

    // Generate table rows for expired documents
    const expiredDocsRows = expiredDocs.length > 0
      ? expiredDocs.map(doc => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${doc.name}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${doc.ref_no}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${formatDate(doc.expiryDate)}</td>
      </tr>
    `).join('')
      : "";

    const table = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <title>Document Expiry Notification</title>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #f8f9fa; padding: 20px; text-align: center; }
                .content { padding: 20px; }
                table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
                th { background-color: #f2f2f2; text-align: left; padding: 12px 8px; border: 1px solid #ddd; }
                .footer { font-size: 12px; text-align: center; margin-top: 30px; color: #777; }
                .expiring { background-color: #fff3cd; }
                .expired { background-color: #f8d7da; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h2>Document Expiry Notification</h2>
                </div>
                <div class="content">
                  <p>Hello ${user.fullname || user.username},</p>

                  <p>This is an automated notification about your documents in the Document Manager system.</p>

                  ${expiringDocs.length > 0 ? `
                    <h3 class="expiring">Documents Expiring Soon (Next 30 Days)</h3>
                    <table>
                      <thead>
                        <tr>
                          <th>Document Name</th>
                          <th>Reference Number</th>
                          <th>Expiry Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${expiringDocsRows}
                      </tbody>
                    </table>
                  ` : ''}

                  ${expiredDocs.length > 0 ? `
                    <h3 class="expired">Expired Documents</h3>
                    <table>
                      <thead>
                        <tr>
                          <th>Document Name</th>
                          <th>Reference Number</th>
                          <th>Expiry Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${expiredDocsRows}
                      </tbody>
                    </table>
                  ` : ''}

                  <p>Please log in to your account to review and update these documents.</p>

                  <p>Thank you,<br>Document Manager System</p>
                </div>
                <div class="footer">
                  <p>This is an automated message. Please do not reply to this email.</p>
                </div>
              </div>
            </body>
            </html>
          `

    const config = useRuntimeConfig();

    // Check if email configuration is available
    if (!config.emailUser || !config.emailPass) {
      console.warn('Email configuration not found. Skipping email notification.');
      // Update lastmailsent even if email is not configured
      user.lastmailsent = new Date();
      await user.save();
      return {
        message: 'Notification processed (email service not configured)',
        warning: 'Email notifications are not configured. Please contact administrator.'
      };
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.mail.yahoo.com',
      port: 465,
      service: 'smtp.mail.yahoo.com',
      secure: true,
      auth: {
        user: config.emailUser,
        pass: config.emailPass
      }
    });

    const mailOptions = {
      from: config.emailUser || 'noreply@system.com',
      to: user.email,
      subject: 'DOCUMENT EXPIRY NOTIFICATION',
      html: table
    };

    // Convert sendMail to Promise-based approach
    await new Promise((resolve, reject) => {
      transporter.sendMail(mailOptions, async (err, info) => {
        if (err) {
          console.error('Error sending email:', err);
          reject(err);
        } else {
          user.lastmailsent = new Date();
          await user.save();
          resolve(info);
        }
      });
    });

    return {
      message: 'Notifications sent successfully',
      emailsSent: 1
    };
  } catch (error) {
    console.error('Error in sending notifications:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to send notifications'
    });
  }
})