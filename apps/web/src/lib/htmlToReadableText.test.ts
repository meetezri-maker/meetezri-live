import { describe, it, expect } from 'vitest';
import { htmlToReadableText } from './htmlToReadableText';
import { htmlToPlainText } from './htmlPlainText';

describe('htmlToReadableText', () => {
  it('keeps paragraphs, line breaks and lists readable', () => {
    const html =
      '<p>First <strong>bold</strong> and <em>italic</em>.</p><p>Second paragraph.</p>' +
      '<ul><li>One</li><li>Two</li></ul><ol><li>Alpha</li><li>Beta</li></ol>' +
      '<p>Line one<br>Line two</p>';
    expect(htmlToReadableText(html)).toBe(
      'First bold and italic.\n\nSecond paragraph.\n\n- One\n- Two\n\n1. Alpha\n2. Beta\n\nLine one\nLine two'
    );
  });

  it('decodes entities and drops script/style content', () => {
    const html = '<style>p{color:red}</style><p>Tom &amp; Jerry&nbsp;&lt;3 &quot;hi&quot;</p><script>alert(1)</script>';
    expect(htmlToReadableText(html)).toBe('Tom & Jerry <3 "hi"');
  });

  it('collapses source whitespace but keeps Urdu and plain text', () => {
    expect(htmlToReadableText('<p>  آج میں   نے\n سکون </p>')).toBe('آج میں نے سکون');
    expect(htmlToReadableText('just text, no tags')).toBe('just text, no tags');
    expect(htmlToReadableText('')).toBe('');
    expect(htmlToReadableText(null)).toBe('');
  });

  it('does not change the shared preview helper', () => {
    expect(htmlToPlainText('<p>a</p><p>b</p>')).toBe('ab');
  });
});
