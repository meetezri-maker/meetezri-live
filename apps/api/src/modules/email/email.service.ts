import nodemailer from 'nodemailer';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    const port = parseInt(process.env.SMTP_PORT || '465');
    // If port is 465, we must use secure connection.
    // If env var is set, respect it.
    const isSecure = port === 465 || process.env.SMTP_SECURE === 'true';

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'mail.marqnetworks.com',
      port: port,
      secure: isSecure, // true for 465, false for other ports
      // name: process.env.SMTP_EHLO_DOMAIN, // Removed to avoid "Greeting never received"
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        // Do not fail on invalid certs
        rejectUnauthorized: false
      },
      // Add timeouts to prevent hanging
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,   // 10 seconds
      socketTimeout: 10000,     // 10 seconds
    } as nodemailer.TransportOptions);

    console.log(`EmailService initialized: Host=${process.env.SMTP_HOST} Port=${port} Secure=${isSecure}`);
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
