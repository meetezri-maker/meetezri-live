import nodemailer from 'nodemailer';

type EmailTemplatePayload = {
  subject: string;
  html: string;
  text: string;
};

type TemplateAudience = 'trial' | 'plan';

const SOLACE_EMAIL_BRAND = {
  brandName: 'Solace',
  logoLetter: 'S',
} as const;

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
  brandName?: string;
  logoLetter?: string;
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

function getEmailAssetBaseUrl(): string {
  return (
    process.env.EMAIL_ASSET_BASE_URL ||
    process.env.CLIENT_URL ||
    process.env.WEB_BASE_URL ||
    process.env.APP_URL ||
    'https://sub.talktosolace2.ai'
  ).replace(/\/$/, '');
}

function getEmailLogoUrls() {
  const base = getEmailAssetBaseUrl();
  return {
    onDark: `${base}/logos/logo%20black.png`,
    onLight: `${base}/logos/logo%20white.png`,
  };
}

/**
 * Founding Circle palette, mirroring the pre-launch landing page rather than the
 * light `trial` theme the account-lifecycle emails use.
 *
 * Every value is a solid hex on purpose: Outlook renders through Word, which
 * drops `rgba()` and gradients entirely. The "glass" look is therefore built
 * from flat panel fills plus a one-pixel border, so it survives everywhere.
 */
const FOUNDING_CIRCLE_THEME = {
  canvas: '#050816',
  panel: '#0b1023',
  panelBorder: '#1d2344',
  card: '#111633',
  cardBorder: '#2b3057',
  heading: '#ffffff',
  body: '#c9cce4',
  muted: '#8b90b0',
  accent: '#c084fc',
  accentPanel: '#1a1136',
  accentBorder: '#4c2a80',
} as const;

/**
 * Sanctuary plate for the Founding Circle hero — the same twilight lake the
 * landing page uses behind its Founding Circle section, so the email and the
 * page a member just left read as one piece. Scenery only: no product UI, no
 * avatar render, no stock photography.
 */
const FOUNDING_CIRCLE_HERO_IMAGE = '/solace/onboarding-complete-twilight-lake.jpg';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    const port = Number.parseInt(process.env.SMTP_PORT || '587', 10);
    const isSecure =
      process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === '1' || port === 465;

    console.log(
      `[DEBUG] EmailService Config: Host=${process.env.SMTP_HOST} Port=${port} Secure=${isSecure} User=${process.env.SMTP_USER}`
    );

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.resend.com',
      port,
      secure: isSecure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
      debug: true,
      logger: true,
    } as nodemailer.TransportOptions);
  }

  async sendEmail(to: string, subject: string, html: string, text?: string) {
    console.log(`Attempting to send email to ${to}...`);
    try {
      const info = await this.transporter.sendMail({
        // Brand as Solace; override with SMTP_FROM if your mail host requires a specific envelope.
        from: process.env.SMTP_FROM || '"Solace" <noreply@Solace.com>',
        to,
        subject,
        html, // HTML email content
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
    brandName = 'Solace',
    logoLetter = 'S',
  }: TemplateLayoutOptions) {
    const theme = getTheme(audience);
    const { onDark: logoOnDarkUrl, onLight: logoOnLightUrl } = getEmailLogoUrls();
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
              .brand-tagline {
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
                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 28px;">
                        <tr>
                          <td align="center" style="padding:0 0 8px;">
                            <img
                              src="${escapeAttribute(logoOnDarkUrl)}"
                              alt="${escapeAttribute(brandName)}"
                              width="200"
                              height="60"
                              style="display:block;max-width:200px;width:200px;height:auto;border:0;margin:0 auto;"
                            />
                            <div class="brand-tagline" style="margin-top:12px;font-size:16px;line-height:24px;color:${theme.headline};font-weight:600;text-align:center;">Calm support for every step</div>
                          </td>
                        </tr>
                      </table>
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
                      <p class="footer-copy" style="margin:12px 0 0;font-size:12px;line-height:20px;color:${theme.mutedText};opacity:0.82;">${escapeHtml(brandName)} · Your AI-Powered Wellness Companion</p>
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
        ? 'Confirm your email to start your Solace plan'
        : 'Confirm your email - Solace';
    return {
      subject,
      html: this.renderTemplate({
        ...SOLACE_EMAIL_BRAND,
        preheader:
          audience === 'plan'
            ? 'Confirm your email to unlock your paid Solace experience.'
            : 'Confirm your email to unlock your Solace experience.',
        eyebrow: audience === 'plan' ? 'Premium Access' : 'Welcome to Solace',
        title: 'Let’s confirm your email',
        greeting: `Hi ${safeFirstName},`,
        intro:
          audience === 'plan'
            ? 'Your plan is almost ready. Confirm your email address so we can securely activate your premium access, onboarding, and personalized support.'
            : 'You are one step away from starting your calm, supportive Solace experience. Confirm your email address so we can securely activate your account.',
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
          'If you did not create a Solace account, you can safely ignore this message.',
        footerNote:
          'For your security, only use links from official Solace emails.',
      }),
      text: [
        `Hi ${safeFirstName},`,
        '',
        audience === 'plan' ? 'Welcome to your Solace plan.' : 'Welcome to Solace.',
        audience === 'plan'
          ? 'Please confirm your email address to activate your plan and continue onboarding.'
          : 'Please confirm your email address to activate your account and continue onboarding.',
        '',
        `Confirm your email: ${verificationLink}`,
        '',
        'If you did not create a Solace account, you can ignore this email.',
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
        ? 'Verify your email to continue your Solace plan'
        : 'Verify your email - Solace';
    return {
      subject,
      html: this.renderTemplate({
        ...SOLACE_EMAIL_BRAND,
        preheader:
          audience === 'plan'
            ? 'Finish verifying your email to continue your Solace plan.'
            : 'Finish verifying your email to keep your Solace access secure.',
        eyebrow: audience === 'plan' ? 'Plan Activation' : 'Account Security',
        title: 'Verify your email',
        greeting: 'Hi there,',
        intro:
          audience === 'plan'
            ? 'We received a request to resend your verification email. Confirm your address below so your Solace plan stays ready for onboarding and secure account access.'
            : 'We received a request to resend your verification email. Use the button below to confirm your address and keep your Solace account secure.',
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
          'Verification links are sent only when requested from your Solace account.',
      }),
      text: [
        'Hi there,',
        '',
        audience === 'plan'
          ? 'Please verify your Solace email address to continue your plan.'
          : 'Please verify your Solace email address using the secure link below.',
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
    const subject = 'Reset Your Password - Solace';
    return {
      subject,
      html: this.renderTemplate({
        ...SOLACE_EMAIL_BRAND,
        preheader: 'Use this secure link to reset your Solace password.',
        eyebrow: 'Password Reset',
        title: 'Create a new password',
        intro:
          'We received a request to reset the password for your Solace account. Use the secure button below to choose a new password and get back in quickly.',
        audience: 'plan',
        spotlight: 'A secure reset flow helps protect your private conversations and account access.',
        highlights: [
          'This reset link is intended only for you',
          'Choose a strong password you have not used before',
          'The link expires in about one hour for your safety',
        ],
        ctaLabel: 'Reset Password',
        ctaUrl: resetLink,
        ctaHint: 'For the best experience, open the link on the device where you use Solace.',
        supportingText:
          'If you did not request a password reset, you can ignore this email and your existing password will stay the same.',
        footerNote:
          'Never share password reset links with anyone, including support staff.',
      }),
      text: [
        'Reset your Solace password.',
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
    const subject = 'Your Solace session is scheduled';
    return {
      subject,
      html: this.renderTemplate({
        ...SOLACE_EMAIL_BRAND,
        preheader: 'Your next Solace session is on the calendar.',
        eyebrow: 'Session Scheduled',
        title: 'Your session is booked',
        greeting: 'Hi there,',
        intro:
          'Your next Solace session is officially scheduled. We saved the details below so you know exactly when to return.',
        audience: 'trial',
        spotlight: 'A calm moment is reserved for you. Everything you need is already set.',
        details: [
          { label: 'Session', value: sessionTitle },
          { label: 'Starts', value: formattedDateTime },
        ],
        highlights: [
          'Come back a few minutes early so you can settle in',
          'You can manage or reschedule from your Solace dashboard',
        ],
        supportingText:
          'If this change was not made by you, please sign in and review your account activity.',
        footerNote:
          'We will keep sending thoughtful reminders so you never miss a session.',
      }),
      text: [
        'Your Solace session is scheduled.',
        '',
        `Session: ${sessionTitle}`,
        `Starts: ${formattedDateTime}`,
        '',
        'If you need to make changes, visit your Solace dashboard.',
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
    const subject = 'Reminder: Your Solace session is coming up';
    return {
      subject,
      html: this.renderTemplate({
        ...SOLACE_EMAIL_BRAND,
        preheader: 'Your Solace session starts in about one hour.',
        eyebrow: 'Friendly Reminder',
        title: 'Your session starts soon',
        greeting: 'Hi there,',
        intro:
          'Just a gentle reminder that your upcoming Solace session begins in about one hour. We are sharing the timing below so you can arrive calm and ready.',
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
          'If your plans changed, visit Solace as soon as possible to review your session details.',
        footerNote:
          'Small reminders can make a big difference in showing up for yourself.',
      }),
      text: [
        'Reminder: your Solace session is coming up.',
        '',
        `Session: ${sessionTitle}`,
        `Starts: ${formattedDateTime}`,
        '',
        'Open your Solace dashboard a few minutes early to join.',
      ].join('\n'),
    };
  }

  buildStreakReminderEmail({
    firstName,
    title,
    message,
    streakType,
    appBaseUrl,
  }: {
    firstName: string;
    title: string;
    message: string;
    streakType: 'mood' | 'journal';
    appBaseUrl: string;
  }): EmailTemplatePayload {
    const base = appBaseUrl.replace(/\/$/, '');
    const path = streakType === 'mood' ? '/app/mood-checkin' : '/app/journal';
    const ctaUrl = `${base}${path}`;
    const subject =
      streakType === 'mood'
        ? 'Reminder: Your mood check-in is waiting'
        : 'Reminder: Your journal streak needs you';
    return {
      subject,
      html: this.renderTemplate({
        ...SOLACE_EMAIL_BRAND,
        preheader: message,
        eyebrow: 'Streak reminder',
        title,
        greeting: `Hi ${firstName.trim() || 'there'},`,
        intro: message,
        audience: 'trial',
        spotlight:
          streakType === 'mood'
            ? 'A quick mood check-in keeps your streak and insights on track.'
            : 'A short journal entry helps you stay consistent with your wellness goals.',
        highlights: [
          'It only takes a minute to keep your progress going',
          'Open Solace on web or your device to continue',
        ],
        ctaLabel: streakType === 'mood' ? 'Mood check-in' : 'Open journal',
        ctaUrl,
        ctaHint: 'If the button does not work, copy the link into your browser.',
        supportingText:
          'You are receiving this because streak reminders are enabled in your notification settings.',
        footerNote:
          'Manage email and push preferences anytime in Solace notification settings.',
      }),
      text: [
        `Hi ${firstName.trim() || 'there'},`,
        '',
        title,
        '',
        message,
        '',
        `Open Solace: ${ctaUrl}`,
        '',
        'You can change reminder settings in the app under Notification settings.',
      ].join('\n'),
    };
  }

  /**
   * Dedicated dark layout for the Founding Circle welcome.
   *
   * This deliberately does not go through `renderTemplate`. That renderer backs
   * seven live account-lifecycle emails, and reshaping it into a dark,
   * hero-image layout would silently restyle all of them.
   *
   * Client constraints this is built around:
   *  - tables for every layout decision (no flex, no grid, no float)
   *  - inline styles on every element that matters (Gmail strips <head><style>)
   *  - solid hex fills only (Word/Outlook drops rgba and gradients)
   *  - one 600px single column, so no client has to reflow anything
   *  - the media query is a progressive enhancement, never load-bearing
   */
  private renderFoundingCircleTemplate({
    preheader,
    greeting,
    bodyParagraphs,
    cardTitle,
    cardItems,
    postCardParagraphs,
    closingParagraphs,
    signOff,
    signature,
    footerNote,
    footerLinks,
  }: {
    preheader: string;
    greeting: string;
    bodyParagraphs: string[];
    cardTitle: string;
    /** One approved benefit sentence per entry; the sparkle is the list marker. */
    cardItems: string[];
    postCardParagraphs: string[];
    closingParagraphs: string[];
    signOff: string;
    signature: string;
    footerNote: string;
    footerLinks: Array<{ label: string; url: string }>;
  }) {
    const t = FOUNDING_CIRCLE_THEME;
    const base = getEmailAssetBaseUrl();
    // `onLight` is the white wordmark — the one that belongs on a dark canvas.
    const logoUrl = getEmailLogoUrls().onLight;
    const heroUrl = `${base}${FOUNDING_CIRCLE_HERO_IMAGE}`;
    const fontStack =
      "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

    const paragraph = (copy: string, marginBottom = 18) =>
      `<p style="margin:0 0 ${marginBottom}px;font-family:${fontStack};font-size:16px;line-height:26px;color:${t.body};">${escapeHtml(
        copy
      )}</p>`;

    const bodyHtml = bodyParagraphs.map((copy) => paragraph(copy)).join('');
    const postCardHtml = postCardParagraphs.map((copy) => paragraph(copy)).join('');
    const closingHtml = closingParagraphs.map((copy) => paragraph(copy)).join('');

    // Bullets are table rows, not <ul>: Outlook adds its own indentation and
    // marker spacing to lists that no amount of CSS reliably removes.
    const cardItemsHtml = cardItems
      .map((item, index) => {
        const gap = index === cardItems.length - 1 ? 0 : 16;
        return `
          <tr>
            <td width="26" valign="top" style="padding:0 0 ${gap}px;font-family:${fontStack};font-size:15px;line-height:24px;">&#10024;</td>
            <td valign="top" style="padding:0 0 ${gap}px;font-family:${fontStack};font-size:15px;line-height:24px;color:${t.body};">${escapeHtml(
              item
            )}</td>
          </tr>`;
      })
      .join('');

    const footerLinksHtml = footerLinks
      .map(
        ({ label, url }) =>
          `<a href="${escapeAttribute(
            url
          )}" target="_blank" rel="noopener noreferrer" style="font-family:${fontStack};font-size:12px;line-height:20px;color:${t.accent};text-decoration:underline;">${escapeHtml(
            label
          )}</a>`
      )
      .join(
        `<span style="font-family:${fontStack};font-size:12px;line-height:20px;color:${t.muted};"> &nbsp;·&nbsp; </span>`
      );

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>Welcome to the SOLACE Founding Circle</title>
    <style>
      body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
      table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
      img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
      a { text-decoration: underline; }
      @media only screen and (max-width: 620px) {
        .fc-shell { padding: 16px 12px !important; }
        .fc-pad { padding-left: 24px !important; padding-right: 24px !important; }
        .fc-title { font-size: 26px !important; line-height: 34px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;width:100%;background-color:${t.canvas};font-family:${fontStack};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(
      preheader
    )}</div>
    <!-- Some clients ignore body background; the outer table carries it too. -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${t.canvas};">
      <tr>
        <td align="center" class="fc-shell" style="padding:32px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;">

            <tr>
              <td align="center" style="padding:0 0 24px;">
                <img src="${escapeAttribute(
                  logoUrl
                )}" alt="SOLACE" width="150" height="45" style="display:block;width:150px;max-width:150px;height:auto;border:0;" />
              </td>
            </tr>

            <tr>
              <td style="background-color:${t.panel};border:1px solid ${t.panelBorder};border-radius:20px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">

                  <tr>
                    <td style="padding:0;font-size:0;line-height:0;">
                      <img src="${escapeAttribute(
                        heroUrl
                      )}" alt="" role="presentation" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:20px 20px 0 0;" />
                    </td>
                  </tr>

                  <tr>
                    <td class="fc-pad" style="padding:36px 40px 8px;">
                      <div style="font-family:${fontStack};font-size:12px;line-height:18px;letter-spacing:0.14em;text-transform:uppercase;font-weight:700;color:${t.accent};">Founding Circle</div>
                      <h1 class="fc-title" style="margin:14px 0 24px;font-family:${fontStack};font-size:30px;line-height:40px;font-weight:700;color:${t.heading};">Welcome to the SOLACE Founding Circle</h1>
                      ${paragraph(greeting, 18)}
                      ${bodyHtml}
                    </td>
                  </tr>

                  <tr>
                    <td class="fc-pad" style="padding:10px 40px 0;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${t.card};border:1px solid ${t.cardBorder};border-radius:16px;">
                        <tr>
                          <td style="padding:26px 26px 18px;">
                            <div style="font-family:${fontStack};font-size:16px;line-height:24px;font-weight:700;color:${t.heading};padding-bottom:16px;">${escapeHtml(
                              cardTitle
                            )}</div>
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                              ${cardItemsHtml}
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td class="fc-pad" style="padding:28px 40px 0;">
                      ${postCardHtml}
                    </td>
                  </tr>

                  <tr>
                    <td class="fc-pad" style="padding:14px 40px 36px;">
                      ${closingHtml}
                      <p style="margin:24px 0 0;font-family:${fontStack};font-size:16px;line-height:26px;color:${t.body};">${escapeHtml(
                        signOff
                      )}</p>
                      <p style="margin:4px 0 0;font-family:${fontStack};font-size:16px;line-height:26px;font-weight:700;color:${t.heading};">${escapeHtml(
                        signature
                      )}</p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:24px 24px 8px;">
                <p style="margin:0;font-family:${fontStack};font-size:12px;line-height:20px;color:${t.muted};">${escapeHtml(
                  footerNote
                )}</p>
                <p style="margin:10px 0 0;font-family:${fontStack};font-size:12px;line-height:20px;">${footerLinksHtml}</p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }

  /**
   * Pre-launch Founding Circle welcome.
   *
   * No account exists at this point, so there is deliberately no CTA into the
   * app and nothing here promises access before launch — the page that captures
   * this address only reserves a place.
   */
  buildFoundingCircleWelcomeEmail({
    firstName,
  }: {
    /**
     * The full name submitted through the Founding Circle form. The parameter
     * keeps the `firstName` name for compatibility with the stored
     * `first_name` column and the API field, but the value is a full name and
     * is used whole in the greeting — never reduced to its first word.
     */
    firstName?: string;
  }): EmailTemplatePayload {
    const greeting = firstName?.trim() ? `Hi ${firstName.trim()},` : 'Hi there,';
    const base = getEmailAssetBaseUrl();

    const preheader =
      'Thank you for joining the SOLACE Founding Circle from the very beginning.';
    const bodyParagraphs = [
      'Welcome to the SOLACE Founding Circle, and thank you for joining us from the very beginning.',
      'We’re truly grateful to have you with us.',
      'SOLACE was created to be a place where people can pause, reflect, celebrate life’s wins, work through challenges, and better understand themselves through meaningful conversations. As one of our Founding Members, you’ll help shape the future of SOLACE while being among the first to experience everything we’re building.',
    ];
    const cardTitle = 'As a Founding Member, you’ll receive:';
    /*
     * The five approved Founding Circle benefits for this email, verbatim.
     *
     * NOTE — these deliberately differ from the landing page and from the
     * `discount_percentage` stored on the lead. The page advertises a 20%
     * *lifetime* discount and every row is written with `discount_percentage:
     * 20`; this email offers 25% off the *first* membership. That divergence is
     * an approved, knowingly unreconciled business-policy decision for this
     * change, not an oversight. Do not "fix" one side to match the other
     * without a policy decision covering billing and entitlements too.
     */
    const cardItems = [
      '25% off your first SOLACE membership when you’re ready to upgrade.',
      '6 months of complimentary access to all SOLACE wellness features (excluding Talk It Out), including Mood Check-Ins, Journaling, Habit Tracker, Sleep Tracker, Wellness Tools, Progress Insights, and more.',
      'Early access before our public launch.',
      'Exclusive updates as we continue building and improving SOLACE.',
      'The opportunity to help shape the future of SOLACE through your feedback and ideas.',
    ];
    const postCardParagraphs = [
      'Over the coming weeks, we’ll share behind-the-scenes updates, important milestones, and everything you need to know before launch.',
    ];
    const closingParagraphs = [
      'Thank you for believing in our vision and becoming part of the SOLACE story from the very beginning.',
      'We can’t wait to welcome you.',
    ];
    const signOff = 'Warm regards,';
    const signature = 'The SOLACE Team';
    const footerNote =
      'You received this email because you joined the SOLACE Founding Circle.';
    const footerLinks = [
      { label: 'Privacy Policy', url: `${base}/privacy` },
      { label: 'Terms of Service', url: `${base}/terms` },
    ];

    return {
      subject: 'Welcome to the SOLACE Founding Circle 💜',
      html: this.renderFoundingCircleTemplate({
        preheader,
        greeting,
        bodyParagraphs,
        cardTitle,
        cardItems,
        postCardParagraphs,
        closingParagraphs,
        signOff,
        signature,
        footerNote,
        footerLinks,
      }),
      text: [
        greeting,
        '',
        ...bodyParagraphs,
        '',
        cardTitle,
        // The same five benefits, in the same order, as the HTML version.
        ...cardItems.map((item) => `✨ ${item}`),
        '',
        ...postCardParagraphs,
        '',
        ...closingParagraphs,
        '',
        signOff,
        signature,
        '',
        footerNote,
        ...footerLinks.map(({ label, url }) => `${label}: ${url}`),
      ].join('\n'),
    };
  }

  getDefaultTemplateRecords(): DefaultTemplateRecord[] {
    return [
      {
        name: 'welcome_verification_trial',
        subject: 'Confirm your email - Solace',
        body: this.buildWelcomeVerificationEmail({
          firstName: '{{first_name}}',
          verificationLink: '{{verification_link}}',
          audience: 'trial',
        }).html,
        variables: ['{{first_name}}', '{{verification_link}}'],
      },
      {
        name: 'welcome_verification_plan',
        subject: 'Confirm your email to start your Solace plan',
        body: this.buildWelcomeVerificationEmail({
          firstName: '{{first_name}}',
          verificationLink: '{{verification_link}}',
          audience: 'plan',
        }).html,
        variables: ['{{first_name}}', '{{verification_link}}'],
      },
      {
        name: 'verification_reminder_trial',
        subject: 'Verify your email - Solace',
        body: this.buildVerificationReminderEmail({
          verificationLink: '{{verification_link}}',
          audience: 'trial',
        }).html,
        variables: ['{{verification_link}}'],
      },
      {
        name: 'verification_reminder_plan',
        subject: 'Verify your email to continue your Solace plan',
        body: this.buildVerificationReminderEmail({
          verificationLink: '{{verification_link}}',
          audience: 'plan',
        }).html,
        variables: ['{{verification_link}}'],
      },
      {
        name: 'password_reset',
        subject: 'Reset Your Password - Solace',
        body: this.buildPasswordResetEmail({
          resetLink: '{{reset_link}}',
        }).html,
        variables: ['{{reset_link}}'],
      },
      {
        name: 'session_scheduled',
        subject: 'Your Solace session is scheduled',
        body: this.buildSessionScheduledEmail({
          sessionTitle: '{{session_title}}',
          formattedDateTime: '{{session_time}}',
        }).html,
        variables: ['{{session_title}}', '{{session_time}}'],
      },
      {
        name: 'session_reminder',
        subject: 'Reminder: Your Solace session is coming up',
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
