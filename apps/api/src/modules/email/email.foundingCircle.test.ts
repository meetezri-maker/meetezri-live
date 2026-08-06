import { EmailService } from './email.service';

/**
 * Template-only tests for the Founding Circle welcome email.
 *
 * `EmailService` builds its Nodemailer transport in the constructor but never
 * connects until `sendEmail` is called, so constructing one here sends nothing.
 */
const service = new EmailService();

const SUBJECT = 'Welcome to the SOLACE Founding Circle 💜';
const PREVIEW =
  'Thank you for joining the SOLACE Founding Circle from the very beginning.';

/** The five approved Founding Circle benefits for this email, verbatim. */
const BENEFITS = [
  '25% off your first SOLACE membership when you’re ready to upgrade.',
  '6 months of complimentary access to all SOLACE wellness features (excluding Talk It Out), including Mood Check-Ins, Journaling, Habit Tracker, Sleep Tracker, Wellness Tools, Progress Insights, and more.',
  'Early access before our public launch.',
  'Exclusive updates as we continue building and improving SOLACE.',
  'The opportunity to help shape the future of SOLACE through your feedback and ideas.',
] as const;

/** Benefits removed by the approved rewrite; none may reappear. */
const RETIRED_BENEFITS = [
  '20% Lifetime Founding Member Discount',
  '30-Day Premium Trial',
  '100 Talk It Out Minutes',
  'Direct Influence',
  'Exclusive Founder Updates',
  'Early Access to New Features',
] as const;

/** `firstName` now carries the full name submitted through the form. */
const build = (firstName?: string) =>
  service.buildFoundingCircleWelcomeEmail({ firstName });

describe('buildFoundingCircleWelcomeEmail', () => {
  it('uses the approved subject line, including the heart', () => {
    expect(build('Alex').subject).toBe(SUBJECT);
    expect(build('Alex').subject).toContain('💜');
  });

  it('puts the preview text in a hidden preheader ahead of the content', () => {
    const { html } = build('Alex');

    // The copy uses typographic apostrophes, which `escapeHtml` leaves intact —
    // only the straight `'` is escaped — so this matches verbatim.
    expect(html).toContain(PREVIEW);

    // It must be visually hidden, and must precede the visible body.
    expect(html).toMatch(/display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;/);
    expect(html.indexOf(PREVIEW)).toBeLessThan(html.indexOf('Founding Circle</div>'));
  });

  it('greets the member with the whole submitted name, not just the first word', () => {
    const { html, text } = build('Alex Morgan');
    expect(html).toContain('Hi Alex Morgan,');
    expect(text).toContain('Hi Alex Morgan,');
    // The full name is used verbatim; it is never reduced to its first token.
    expect(html).not.toContain('Hi Alex,');
  });

  it('trims surrounding whitespace from the submitted name', () => {
    expect(build('  Alex Morgan  ').text).toContain('Hi Alex Morgan,');
  });

  it.each([
    ['undefined', undefined],
    ['an empty string', ''],
    ['whitespace only', '   '],
  ])('falls back to "Hi there," when the name is %s', (_label, firstName) => {
    const { html, text } = build(firstName);
    expect(html).toContain('Hi there,');
    expect(text).toContain('Hi there,');
    expect(html).not.toContain('Hi ,');
  });

  it('renders the HTML version with every approved content block', () => {
    const { html } = build('Alex');

    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('Welcome to the SOLACE Founding Circle');
    expect(html).toContain(
      'Welcome to the SOLACE Founding Circle, and thank you for joining us from the very beginning.'
    );
    expect(html).toContain('We’re truly grateful to have you with us.');
    expect(html).toContain(
      'SOLACE was created to be a place where people can pause, reflect, celebrate life’s wins, work through challenges, and better understand themselves through meaningful conversations. As one of our Founding Members, you’ll help shape the future of SOLACE while being among the first to experience everything we’re building.'
    );
    expect(html).toContain('As a Founding Member, you’ll receive:');

    for (const benefit of BENEFITS) {
      expect(html).toContain(benefit);
    }

    expect(html).toContain(
      'Over the coming weeks, we’ll share behind-the-scenes updates, important milestones, and everything you need to know before launch.'
    );
    expect(html).toContain(
      'Thank you for believing in our vision and becoming part of the SOLACE story from the very beginning.'
    );
    expect(html).toContain('We can’t wait to welcome you.');
    expect(html).toContain('Warm regards,');
    expect(html).toContain('The SOLACE Team');
  });

  it('renders a plain-text version carrying the same content', () => {
    const { text } = build('Alex Morgan');

    expect(text).not.toContain('<');
    expect(text).toContain(
      'Welcome to the SOLACE Founding Circle, and thank you for joining us from the very beginning.'
    );
    expect(text).toContain('As a Founding Member, you’ll receive:');
    for (const benefit of BENEFITS) {
      expect(text).toContain(`✨ ${benefit}`);
    }
    expect(text).toContain(
      'Over the coming weeks, we’ll share behind-the-scenes updates, important milestones, and everything you need to know before launch.'
    );
    expect(text).toContain('We can’t wait to welcome you.');
    expect(text).toContain('Warm regards,');
    expect(text).toContain('The SOLACE Team');
    expect(text).toContain(
      'You received this email because you joined the SOLACE Founding Circle.'
    );
  });

  it('lists exactly the five approved benefits, in the approved order', () => {
    const { html, text } = build('Alex Morgan');

    expect(BENEFITS).toHaveLength(5);

    for (const body of [html, text]) {
      const positions = BENEFITS.map((benefit) => body.indexOf(benefit));
      expect(positions.every((index) => index !== -1)).toBe(true);
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    }
  });

  it('states the 25% first-membership offer with the exact approved wording', () => {
    const { html, text } = build('Alex Morgan');

    for (const body of [html, text]) {
      expect(body).toContain(
        '25% off your first SOLACE membership when you’re ready to upgrade.'
      );
      // No competing offer figure. Checked against `%` immediately followed by
      // a space or word, so table widths like `width:100%` are not swept in.
      expect(body).not.toMatch(/\b(?!25\b)\d+%(?=[\s<]|&nbsp;)/);
    }

    // The plain-text body carries no markup, so it can be checked exhaustively.
    expect(text.match(/\d+%/g)).toEqual(['25%']);
  });

  it('carries an identical benefit set in the HTML and plain-text versions', () => {
    const { html, text } = build('Alex Morgan');

    for (const benefit of BENEFITS) {
      expect(html).toContain(benefit);
      expect(text).toContain(benefit);
    }
  });

  it('no longer carries any of the retired benefits', () => {
    const { html, text } = build('Alex Morgan');

    for (const body of [html, text]) {
      for (const retired of RETIRED_BENEFITS) {
        expect(body).not.toContain(retired);
      }
      // The old timeline block is gone with them.
      expect(body).not.toContain('What happens next');
      expect(body).not.toContain('Launch Day');
    }
  });

  it('adds no scarcity, expiry, pricing, or launch date to the benefits', () => {
    const { html, text } = build('Alex Morgan');

    for (const body of [html, text]) {
      expect(body).not.toMatch(/expires?|limited time|only \d+ (spots?|places?)|hurry|act now/i);
      expect(body).not.toMatch(/\$\d|\d+ ?(usd|eur|gbp)|per month|\/mo\b|billed/i);
      expect(body).not.toMatch(
        /launch(es|ing)? (on|in) |january|february|march|april|june|july|august|september|october|november|december/i
      );
      // No payment is requested, and none is implied.
      expect(body).not.toMatch(/enter your card|payment (details|method|required)|checkout/i);
    }
  });

  it('includes the footer note and both legal links', () => {
    const { html, text } = build();

    expect(html).toContain(
      'You received this email because you joined the SOLACE Founding Circle.'
    );
    expect(html).toMatch(/href="https?:\/\/[^"]+\/privacy"/);
    expect(html).toMatch(/href="https?:\/\/[^"]+\/terms"/);
    expect(html).toContain('Privacy Policy');
    expect(html).toContain('Terms of Service');

    expect(text).toMatch(/Privacy Policy: https?:\/\/\S+\/privacy/);
    expect(text).toMatch(/Terms of Service: https?:\/\/\S+\/terms/);
  });

  it('uses one absolute sanctuary hero image and no product imagery', () => {
    const { html } = build();

    const imgSrcs = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]);
    // Logo plus exactly one hero plate — nothing else.
    expect(imgSrcs).toHaveLength(2);
    expect(imgSrcs.every((src) => /^https?:\/\//.test(src))).toBe(true);

    const hero = imgSrcs[1];
    expect(hero).toContain('/solace/onboarding-complete-twilight-lake.jpg');

    // The hero carries no information the copy does not, so it is decorative.
    expect(html).toMatch(/<img[^>]+alt=""[^>]*role="presentation"/);
  });

  it('stays inside email-client constraints', () => {
    const { html } = build('Alex');

    // Single 600px column.
    expect(html).toContain('width:600px;max-width:600px;');

    // Layout is tables only — no modern CSS that Outlook cannot render.
    expect(html).not.toMatch(/display:\s*(flex|grid)/);
    expect(html).not.toMatch(/\bposition:\s*(absolute|fixed)/);
    expect(html).not.toContain('linear-gradient');
    expect(html).not.toMatch(/rgba\(/);

    // Responsive, and declared for dark rendering.
    expect(html).toContain('@media only screen and (max-width: 620px)');
    expect(html).toContain('name="viewport"');
    expect(html).toContain('name="color-scheme"');
    expect(html).toContain('lang="en"');
  });

  it('escapes a name that contains HTML rather than injecting it', () => {
    const { html } = build('<script>alert(1)</script>');

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('makes no claim of immediate access before launch', () => {
    const { html, text } = build('Alex');

    for (const body of [html, text]) {
      expect(body).not.toMatch(/log ?in|sign ?in|get started now|start your first conversation/i);
      expect(body).not.toMatch(/available now|instant access|immediate access/i);
    }
  });
});
