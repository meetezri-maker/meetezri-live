import nodemailer from 'nodemailer';

type EmailTemplatePayload = {
  subject: string;
  html: string;
  text: string;
};

type TemplateAudience = 'trial' | 'plan';

type TemplateLayoutOptions = {
  preheader: string;
  eyebrow: string;
  title: string;
  greeting?: string;
  intro: string;
  highlights?: string[];
  details?: Array<{ label: string; value: string }>;
  ctaLabel?: string;
  ctaUrl?: string;
  ctaHint?: string;
  supportingText?: string;
  footerNote: string;
  audience?: TemplateAudience;
  spotlight?: string;
};

type DefaultTemplateRecord = {
  name: string;
  subject: string;
  body: string;
  variables: string[];
};

type TemplateTheme = {
  bodyBackground: string;
  shellBackground: string;
  heroBackground: string;
  panelBackground: string;
  panelBorder: string;
  heroBorder: string;
  badgeBackground: string;
  badgeText: string;
  accentGradient: string;
  headline: string;
  bodyText: string;
  mutedText: string;
  detailBackground: string;
  detailBorder: string;
  highlightBackground: string;
  highlightBorder: string;
  highlightText: string;
  ctaGradient: string;
  ctaShadow: string;
  artworkGlow: string;
  logoCore: string;
  logoRing: string;
};

function getTheme(audience: TemplateAudience = 'trial'): TemplateTheme {
  if (audience === 'plan') {
    return {
      bodyBackground: '#09090f',
      shellBackground: '#111827',
      heroBackground: 'linear-gradient(145deg,#0f172a 0%,#1f1147 52%,#3b0764 100%)',
      panelBackground: 'linear-gradient(180deg,#161b33 0%,#0f172a 100%)',
      panelBorder: '#312e81',
      heroBorder: '#4c1d95',
      badgeBackground: 'rgba(192,132,252,0.18)',
      badgeText: '#f5d0fe',
      accentGradient: 'linear-gradient(135deg,#c084fc 0%,#f472b6 100%)',
      headline: '#f8fafc',
      bodyText: '#e2e8f0',
      mutedText: '#cbd5e1',
      detailBackground: 'rgba(15,23,42,0.55)',
      detailBorder: '#334155',
      highlightBackground: 'rgba(76,29,149,0.42)',
      highlightBorder: '#7c3aed',
      highlightText: '#f5d0fe',
      ctaGradient: 'linear-gradient(135deg,#a855f7 0%,#ec4899 100%)',
      ctaShadow: '0 14px 36px rgba(236,72,153,0.32)',
      artworkGlow: 'rgba(236,72,153,0.28)',
      logoCore: 'linear-gradient(135deg,#c084fc 0%,#f472b6 100%)',
      logoRing: 'rgba(248,250,252,0.18)',
    };
  }

  return {
    bodyBackground: '#f5f3ff',
    shellBackground: '#f8fafc',
    heroBackground: 'linear-gradient(145deg,#ffffff 0%,#faf5ff 48%,#fdf2f8 100%)',
    panelBackground: 'linear-gradient(180deg,#ffffff 0%,#fcfaff 100%)',
    panelBorder: '#e9d5ff',
    heroBorder: '#f5d0fe',
    badgeBackground: '#ede9fe',
    badgeText: '#6d28d9',
    accentGradient: 'linear-gradient(135deg,#8b5cf6 0%,#ec4899 100%)',
    headline: '#111827',
    bodyText: '#334155',
    mutedText: '#64748b',
    detailBackground: '#f8fafc',
    detailBorder: '#e2e8f0',
    highlightBackground: '#f5f3ff',
    highlightBorder: '#ddd6fe',
    highlightText: '#4c1d95',
    ctaGradient: 'linear-gradient(135deg,#7c3aed 0%,#a855f7 100%)',
    ctaShadow: '0 12px 30px rgba(124,58,237,0.28)',
    artworkGlow: 'rgba(168,85,247,0.16)',
    logoCore: 'linear-gradient(135deg,#8b5cf6 0%,#ec4899 100%)',
    logoRing: 'rgba(139,92,246,0.12)',
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string) {
  return escapeHtml(value);
}

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

  private renderTemplate({
    preheader,
    eyebrow,
    title,
    greeting,
    intro,
    highlights = [],
    details = [],
    ctaLabel,
    ctaUrl,
    ctaHint,
    supportingText,
    footerNote,
    audience = 'trial',
    spotlight,
  }: TemplateLayoutOptions) {
    const theme = getTheme(audience);
    const greetingHtml = greeting
      ? `<p class="body-copy" style="margin:0 0 16px;font-size:16px;line-height:28px;color:${theme.bodyText};">${escapeHtml(greeting)}</p>`
      : '';
    const spotlightHtml = spotlight
      ? `
        <div class="spotlight" style="margin:24px 0 0;padding:18px 20px;border-radius:20px;background:${theme.detailBackground};border:1px solid ${theme.detailBorder};">
          <div class="spotlight-label" style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${theme.mutedText};font-weight:700;">Designed for your next step</div>
          <div class="spotlight-copy" style="margin-top:8px;font-size:16px;line-height:26px;color:${theme.headline};font-weight:600;">${escapeHtml(spotlight)}</div>
        </div>
      `
      : '';
    const highlightsHtml = highlights.length
      ? `
        <div style="margin:24px 0 0;padding:0;">
          ${highlights
            .map(
              (item) => `
                <div class="highlight-card" style="margin:0 0 12px;padding:16px 18px;border-radius:16px;background:${theme.highlightBackground};border:1px solid ${theme.highlightBorder};font-size:15px;line-height:24px;color:${theme.highlightText};">
                  ${escapeHtml(item)}
                </div>
              `
            )
            .join('')}
        </div>
      `
      : '';
    const detailsHtml = details.length
      ? `
        <div class="details-panel" style="margin:24px 0 0;padding:20px;border-radius:18px;background:${theme.detailBackground};border:1px solid ${theme.detailBorder};">
          ${details
            .map(
              ({ label, value }) => `
                <div style="margin:0 0 12px;">
                  <div class="detail-label" style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${theme.mutedText};font-weight:700;">${escapeHtml(label)}</div>
                  <div class="detail-value" style="font-size:16px;line-height:26px;color:${theme.headline};font-weight:600;">${escapeHtml(value)}</div>
                </div>
              `
            )
            .join('')}
        </div>
      `
      : '';
    const ctaHtml = ctaLabel && ctaUrl
      ? `
        <div style="margin:32px 0 24px;text-align:center;">
          <a href="${escapeAttribute(
            ctaUrl
          )}" target="_blank" rel="noopener noreferrer" class="cta-button" style="display:inline-block;padding:16px 28px;border-radius:999px;background:${theme.ctaGradient};color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;box-shadow:${theme.ctaShadow};">
            ${escapeHtml(ctaLabel)}
          </a>
        </div>
      `
      : '';
    const ctaHintHtml = ctaHint
      ? `<p class="helper-copy" style="margin:0 0 8px;font-size:13px;line-height:22px;color:${theme.mutedText};text-align:center;">${escapeHtml(ctaHint)}</p>`
      : '';
    const supportingTextHtml = supportingText
      ? `<p class="supporting-copy" style="margin:0;font-size:14px;line-height:24px;color:${theme.mutedText};">${escapeHtml(supportingText)}</p>`
      : '';

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta name="color-scheme" content="light dark" />
          <meta name="supported-color-schemes" content="light dark" />
          <title>${escapeHtml(title)}</title>
          <style>
            body, table, td, a {
              font-family: Arial, Helvetica, sans-serif !important;
            }
            @media (max-width: 640px) {
              .shell {
                padding: 18px !important;
              }
              .hero-card {
                padding: 28px 20px !important;
                border-radius: 24px !important;
              }
              .hero-title {
                font-size: 28px !important;
                line-height: 36px !important;
              }
            }
            @media (prefers-color-scheme: dark) {
              body {
                background: #09090f !important;
              }
              .shell {
                background: #09090f !important;
              }
              .hero-card {
                background: linear-gradient(145deg,#0f172a 0%,#1f1147 52%,#3b0764 100%) !important;
                border-color: #4c1d95 !important;
              }
              .body-copy, .detail-value, .supporting-copy, .spotlight-copy {
                color: #e2e8f0 !important;
              }
              .hero-title {
                color: #f8fafc !important;
              }
              .helper-copy, .detail-label, .spotlight-label, .footer-copy {
                color: #cbd5e1 !important;
              }
              .details-panel, .spotlight {
                background: rgba(15,23,42,0.55) !important;
                border-color: #334155 !important;
              }
              .highlight-card {
                background: rgba(76,29,149,0.42) !important;
                border-color: #7c3aed !important;
                color: #f5d0fe !important;
              }
            }
          </style>
        </head>
        <body style="margin:0;padding:0;background:${theme.bodyBackground};font-family:Arial,Helvetica,sans-serif;color:${theme.headline};">
          <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="shell" style="background:${theme.shellBackground};padding:32px 16px;">
            <tr>
              <td align="center">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;">
                  <tr>
                    <td style="padding:0 0 20px;text-align:center;">
                      <div style="display:inline-block;padding:10px 18px;border-radius:999px;background:${theme.badgeBackground};color:${theme.badgeText};font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
                        ${escapeHtml(eyebrow)}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td class="hero-card" style="background:${theme.heroBackground};border-radius:28px;padding:40px 32px;border:1px solid ${theme.heroBorder};box-shadow:0 24px 60px rgba(15,23,42,0.18);">
                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px;">
                        <tr>
                          <td align="left" valign="middle">
                            <table role="presentation" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="height:52px;width:52px;border-radius:18px;background:${theme.logoCore};box-shadow:0 0 0 10px ${theme.logoRing};text-align:center;font-size:22px;font-weight:700;color:#ffffff;">
                                  E
                                </td>
                                <td style="padding-left:16px;">
                                  <div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${theme.mutedText};font-weight:700;">MeetEzri</div>
                                  <div style="margin-top:4px;font-size:18px;line-height:24px;color:${theme.headline};font-weight:700;">Calm support for every step</div>
                                </td>
                              </tr>
                            </table>
                          </td>
                          <td align="right" valign="middle">
                            <div style="display:inline-block;height:72px;width:72px;border-radius:24px;background:${theme.accentGradient};opacity:0.94;box-shadow:0 14px 36px ${theme.artworkGlow};"></div>
                          </td>
                        </tr>
                      </table>
                      <div style="height:8px;width:96px;border-radius:999px;background:${theme.accentGradient};margin:0 auto 28px;"></div>
                      <h1 class="hero-title" style="margin:0 0 18px;font-size:34px;line-height:42px;text-align:center;color:${theme.headline};">${escapeHtml(title)}</h1>
                      ${greetingHtml}
                      <p class="body-copy" style="margin:0;font-size:16px;line-height:28px;color:${theme.bodyText};">${escapeHtml(intro)}</p>
                      ${spotlightHtml}
                      ${highlightsHtml}
                      ${detailsHtml}
                      ${ctaHtml}
                      ${ctaHintHtml}
                      ${supportingTextHtml}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:18px 18px 0;text-align:center;">
                      <p class="footer-copy" style="margin:0;font-size:13px;line-height:22px;color:${theme.mutedText};">${escapeHtml(
                        footerNote
                      )}</p>
                      <p class="footer-copy" style="margin:12px 0 0;font-size:12px;line-height:20px;color:${theme.mutedText};opacity:0.82;">MeetEzri · Calm support, beautifully delivered</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
  }

  buildWelcomeVerificationEmail({
    firstName,
    verificationLink,
    audience = 'trial',
  }: {
    firstName?: string;
    verificationLink: string;
    audience?: TemplateAudience;
  }): EmailTemplatePayload {
    const safeFirstName = firstName?.trim() || 'there';
    const subject =
      audience === 'plan'
        ? 'Confirm your email to start your MeetEzri plan'
        : 'Confirm your email - MeetEzri';
    return {
      subject,
      html: this.renderTemplate({
        preheader:
          audience === 'plan'
            ? 'Confirm your email to unlock your paid MeetEzri experience.'
            : 'Confirm your email to unlock your MeetEzri experience.',
        eyebrow: audience === 'plan' ? 'Premium Access' : 'Welcome to MeetEzri',
        title: 'Let’s confirm your email',
        greeting: `Hi ${safeFirstName},`,
        intro:
          audience === 'plan'
            ? 'Your plan is almost ready. Confirm your email address so we can securely activate your premium access, onboarding, and personalized support.'
            : 'You are one step away from starting your calm, supportive MeetEzri experience. Confirm your email address so we can securely activate your account.',
        audience,
        spotlight:
          audience === 'plan'
            ? 'Your paid plan unlocks a smoother onboarding path and a more guided support experience.'
            : 'Your free trial is ready as soon as your email is confirmed.',
        highlights: [
          audience === 'plan'
            ? 'Secure your account and activate your premium plan access'
            : 'Secure your account and verify your identity',
          audience === 'plan'
            ? 'Start onboarding with the benefits linked to your subscription'
            : 'Unlock onboarding and personalized wellness support',
          'Keep your updates, reminders, and recovery links protected',
        ],
        ctaLabel: 'Confirm Email',
        ctaUrl: verificationLink,
        ctaHint: 'This link opens in a new tab for a smoother signup flow.',
        supportingText:
          'If you did not create a MeetEzri account, you can safely ignore this message.',
        footerNote:
          'For your security, only use links from official MeetEzri emails.',
      }),
      text: [
        `Hi ${safeFirstName},`,
        '',
        audience === 'plan' ? 'Welcome to your MeetEzri plan.' : 'Welcome to MeetEzri.',
        audience === 'plan'
          ? 'Please confirm your email address to activate your plan and continue onboarding.'
          : 'Please confirm your email address to activate your account and continue onboarding.',
        '',
        `Confirm your email: ${verificationLink}`,
        '',
        'If you did not create a MeetEzri account, you can ignore this email.',
      ].join('\n'),
    };
  }

  buildVerificationReminderEmail({
    verificationLink,
    audience = 'trial',
  }: {
    verificationLink: string;
    audience?: TemplateAudience;
  }): EmailTemplatePayload {
    const subject =
      audience === 'plan'
        ? 'Verify your email to continue your MeetEzri plan'
        : 'Verify your email - MeetEzri';
    return {
      subject,
      html: this.renderTemplate({
        preheader:
          audience === 'plan'
            ? 'Finish verifying your email to continue your MeetEzri plan.'
            : 'Finish verifying your email to keep your MeetEzri access secure.',
        eyebrow: audience === 'plan' ? 'Plan Activation' : 'Account Security',
        title: 'Verify your email',
        greeting: 'Hi there,',
        intro:
          audience === 'plan'
            ? 'We received a request to resend your verification email. Confirm your address below so your MeetEzri plan stays ready for onboarding and secure account access.'
            : 'We received a request to resend your verification email. Use the button below to confirm your address and keep your MeetEzri account secure.',
        audience,
        spotlight:
          audience === 'plan'
            ? 'Once verified, you can move straight into your paid onboarding journey.'
            : 'Verification keeps your trial experience secure and uninterrupted.',
        highlights: [
          audience === 'plan'
            ? 'Complete verification to continue with your plan without friction'
            : 'Complete verification to continue using your account smoothly',
          audience === 'plan'
            ? 'Protect access to plan updates, receipts, and support emails'
            : 'Protect access to your recovery and support emails',
          'Finish setup with a single tap',
        ],
        ctaLabel: 'Verify My Email',
        ctaUrl: verificationLink,
        ctaHint: 'If the button does not work, copy and paste the link into your browser.',
        supportingText:
          'If you did not request this email, no action is needed and your account remains safe.',
        footerNote:
          'Verification links are sent only when requested from your MeetEzri account.',
      }),
      text: [
        'Hi there,',
        '',
        audience === 'plan'
          ? 'Please verify your MeetEzri email address to continue your plan.'
          : 'Please verify your MeetEzri email address using the secure link below.',
        '',
        `Verify your email: ${verificationLink}`,
        '',
        'If you did not request this, you can ignore this email.',
      ].join('\n'),
    };
  }

  buildPasswordResetEmail({
    resetLink,
  }: {
    resetLink: string;
  }): EmailTemplatePayload {
    const subject = 'Reset Your Password - MeetEzri';
    return {
      subject,
      html: this.renderTemplate({
        preheader: 'Use this secure link to reset your MeetEzri password.',
        eyebrow: 'Password Reset',
        title: 'Create a new password',
        intro:
          'We received a request to reset the password for your MeetEzri account. Use the secure button below to choose a new password and get back in quickly.',
        audience: 'plan',
        spotlight: 'A secure reset flow helps protect your private conversations and account access.',
        highlights: [
          'This reset link is intended only for you',
          'Choose a strong password you have not used before',
          'The link expires in about one hour for your safety',
        ],
        ctaLabel: 'Reset Password',
        ctaUrl: resetLink,
        ctaHint: 'For the best experience, open the link on the device where you use MeetEzri.',
        supportingText:
          'If you did not request a password reset, you can ignore this email and your existing password will stay the same.',
        footerNote:
          'Never share password reset links with anyone, including support staff.',
      }),
      text: [
        'Reset your MeetEzri password.',
        '',
        `Reset link: ${resetLink}`,
        '',
        'This link expires in about one hour.',
        'If you did not request a reset, you can ignore this email.',
      ].join('\n'),
    };
  }

  buildSessionScheduledEmail({
    sessionTitle,
    formattedDateTime,
  }: {
    sessionTitle: string;
    formattedDateTime: string;
  }): EmailTemplatePayload {
    const subject = 'Your Ezri session is scheduled';
    return {
      subject,
      html: this.renderTemplate({
        preheader: 'Your next MeetEzri session is on the calendar.',
        eyebrow: 'Session Scheduled',
        title: 'Your session is booked',
        greeting: 'Hi there,',
        intro:
          'Your next MeetEzri session is officially scheduled. We saved the details below so you know exactly when to return.',
        audience: 'trial',
        spotlight: 'A calm moment is reserved for you. Everything you need is already set.',
        details: [
          { label: 'Session', value: sessionTitle },
          { label: 'Starts', value: formattedDateTime },
        ],
        highlights: [
          'Come back a few minutes early so you can settle in',
          'You can manage or reschedule from your MeetEzri dashboard',
        ],
        supportingText:
          'If this change was not made by you, please sign in and review your account activity.',
        footerNote:
          'We will keep sending thoughtful reminders so you never miss a session.',
      }),
      text: [
        'Your MeetEzri session is scheduled.',
        '',
        `Session: ${sessionTitle}`,
        `Starts: ${formattedDateTime}`,
        '',
        'If you need to make changes, visit your MeetEzri dashboard.',
      ].join('\n'),
    };
  }

  buildSessionReminderEmail({
    sessionTitle,
    formattedDateTime,
  }: {
    sessionTitle: string;
    formattedDateTime: string;
  }): EmailTemplatePayload {
    const subject = 'Reminder: Your Ezri session is coming up';
    return {
      subject,
      html: this.renderTemplate({
        preheader: 'Your MeetEzri session starts in about one hour.',
        eyebrow: 'Friendly Reminder',
        title: 'Your session starts soon',
        greeting: 'Hi there,',
        intro:
          'Just a gentle reminder that your upcoming MeetEzri session begins in about one hour. We are sharing the timing below so you can arrive calm and ready.',
        audience: 'trial',
        spotlight: 'Take a breath, settle in, and come back when you are ready.',
        details: [
          { label: 'Session', value: sessionTitle },
          { label: 'Starts', value: formattedDateTime },
        ],
        highlights: [
          'Find a quiet, comfortable space before your session begins',
          'Open your dashboard a few minutes early to join without stress',
        ],
        supportingText:
          'If your plans changed, visit MeetEzri as soon as possible to review your session details.',
        footerNote:
          'Small reminders can make a big difference in showing up for yourself.',
      }),
      text: [
        'Reminder: your MeetEzri session is coming up.',
        '',
        `Session: ${sessionTitle}`,
        `Starts: ${formattedDateTime}`,
        '',
        'Open your MeetEzri dashboard a few minutes early to join.',
      ].join('\n'),
    };
  }

  getDefaultTemplateRecords(): DefaultTemplateRecord[] {
    return [
      {
        name: 'welcome_verification_trial',
        subject: 'Confirm your email - MeetEzri',
        body: this.buildWelcomeVerificationEmail({
          firstName: '{{first_name}}',
          verificationLink: '{{verification_link}}',
          audience: 'trial',
        }).html,
        variables: ['{{first_name}}', '{{verification_link}}'],
      },
      {
        name: 'welcome_verification_plan',
        subject: 'Confirm your email to start your MeetEzri plan',
        body: this.buildWelcomeVerificationEmail({
          firstName: '{{first_name}}',
          verificationLink: '{{verification_link}}',
          audience: 'plan',
        }).html,
        variables: ['{{first_name}}', '{{verification_link}}'],
      },
      {
        name: 'verification_reminder_trial',
        subject: 'Verify your email - MeetEzri',
        body: this.buildVerificationReminderEmail({
          verificationLink: '{{verification_link}}',
          audience: 'trial',
        }).html,
        variables: ['{{verification_link}}'],
      },
      {
        name: 'verification_reminder_plan',
        subject: 'Verify your email to continue your MeetEzri plan',
        body: this.buildVerificationReminderEmail({
          verificationLink: '{{verification_link}}',
          audience: 'plan',
        }).html,
        variables: ['{{verification_link}}'],
      },
      {
        name: 'password_reset',
        subject: 'Reset Your Password - MeetEzri',
        body: this.buildPasswordResetEmail({
          resetLink: '{{reset_link}}',
        }).html,
        variables: ['{{reset_link}}'],
      },
      {
        name: 'session_scheduled',
        subject: 'Your Ezri session is scheduled',
        body: this.buildSessionScheduledEmail({
          sessionTitle: '{{session_title}}',
          formattedDateTime: '{{session_time}}',
        }).html,
        variables: ['{{session_title}}', '{{session_time}}'],
      },
      {
        name: 'session_reminder',
        subject: 'Reminder: Your Ezri session is coming up',
        body: this.buildSessionReminderEmail({
          sessionTitle: '{{session_title}}',
          formattedDateTime: '{{session_time}}',
        }).html,
        variables: ['{{session_title}}', '{{session_time}}'],
      },
    ];
  }
}

export const emailService = new EmailService();
