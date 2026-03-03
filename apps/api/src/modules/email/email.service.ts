import nodemailer from 'nodemailer';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Force correct settings for debugging - STRICTLY HARDCODED
    const port = 587; 
    const isSecure = false;

    console.log(`[DEBUG] EmailService Config: Host=${process.env.SMTP_HOST} Port=${port} Secure=${isSecure} User=${process.env.SMTP_USER}`);

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'mail.marqnetworks.com',
      port: port,
      secure: isSecure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
      debug: true, // Enable debug
      logger: true // Enable logger
    } as nodemailer.TransportOptions);
  }

  async sendEmail(to: string, subject: string, html: string, text?: string) {
    console.log(`Attempting to send email to ${to}...`);
    try {
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || '"MeetEzri" <noreply@meetezri.com>',
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>?/gm, ''), // fallback text generation
      });
      console.log(`Email sent successfully: ${info.messageId}`);
      return info;
    } catch (error) {
      console.error('Email sending failed:', error);
      throw error;
    }
  }
}

export const emailService = new EmailService();
