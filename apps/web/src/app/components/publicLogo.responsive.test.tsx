import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import {
  buildSolaceOrganization,
  PUBLIC_BRAND_LOGO_WEBP_SRCSET,
  PUBLIC_FIXED_FOOTER_LOGO_SIZES,
  PUBLIC_FIXED_HEADER_LOGO_SIZES,
} from '@meetezri/public-content';
import { PublicFooter } from './PublicFooter';
import { PublicNav } from './PublicNav';

const FALLBACK = '/logos/logo black.png';
const ORIGINAL_SHA256 = 'fad7dbefb0197e4ebc64aec306cb81df18fc222a949ff94858e764a6fc7d2fac';
const ASSETS = [
  {
    file: 'solace-logo-black-192.webp',
    width: 192,
    height: 77,
    sha256: 'cfad4f46e7d57dbb4e848ad012dd8bb08e86309567435cce63fb6a86655a97dc',
  },
  {
    file: 'solace-logo-black-384.webp',
    width: 384,
    height: 155,
    sha256: '16f422dbeee6300b820846666a526a05fe29657150355e0ca1b4f7c13a4cb445',
  },
] as const;

function renderAt(pathname: string, node: React.ReactNode) {
  return render(<MemoryRouter initialEntries={[pathname]}>{node}</MemoryRouter>);
}

function expectResponsiveLogo(
  root: ParentNode,
  expectedSizes: string,
  expectedAlt: string,
) {
  const pictures = root.querySelectorAll('picture');
  expect(pictures).toHaveLength(1);
  const source = pictures[0]?.querySelector('source');
  const image = pictures[0]?.querySelector('img');
  expect(source).toHaveAttribute('type', 'image/webp');
  expect(source).toHaveAttribute('srcset', PUBLIC_BRAND_LOGO_WEBP_SRCSET);
  expect(source).toHaveAttribute('sizes', expectedSizes);
  expect(image).toHaveAttribute('src', FALLBACK);
  expect(image).toHaveAttribute('width', '651');
  expect(image).toHaveAttribute('height', '262');
  expect(image).toHaveAttribute('alt', expectedAlt);
  expect(image).toHaveStyle({ aspectRatio: '651 / 262' });
  expect(image).not.toHaveAttribute('loading');
  expect(image).not.toHaveAttribute('decoding');
  expect(image).not.toHaveAttribute('fetchpriority');
}

function parseLosslessWebP(buffer: Buffer) {
  expect(buffer.toString('ascii', 0, 4)).toBe('RIFF');
  expect(buffer.toString('ascii', 8, 12)).toBe('WEBP');
  expect(buffer.toString('ascii', 12, 16)).toBe('VP8L');
  expect(buffer[20]).toBe(0x2f);
  const bits = buffer.readUInt32LE(21);
  return {
    width: (bits & 0x3fff) + 1,
    height: ((bits >>> 14) & 0x3fff) + 1,
    alpha: Boolean(bits & 0x10000000),
  };
}

describe('responsive public Solace logo delivery', () => {
  it('uses one responsive picture in the fixed public header and footer', () => {
    const { container } = renderAt(
      '/',
      <>
        <PublicNav variant="cinematic" />
        <PublicFooter />
      </>,
    );
    const header = container.querySelector('header') as HTMLElement;
    const footer = container.querySelector('footer') as HTMLElement;
    expectResponsiveLogo(header, PUBLIC_FIXED_HEADER_LOGO_SIZES, '');
    expectResponsiveLogo(footer, PUBLIC_FIXED_FOOTER_LOGO_SIZES, '');
    expect(header.querySelector('a[href="/"]')).toContainElement(header.querySelector('picture'));
    expect(header.querySelector('[role="img"]')).toHaveAccessibleName('Solace');
    expect(footer.querySelector('[role="img"]')).toHaveAccessibleName('Solace');
    expect(container.querySelectorAll(`img[src="${FALLBACK}"]`)).toHaveLength(2);
    expect(document.head.querySelectorAll('link[rel="preload"][href*="/logos/"]')).toHaveLength(0);
  });

  it('leaves authentication-route logo markup on the existing direct image path', () => {
    const { container } = renderAt('/login', <PublicNav variant="cinematic" />);
    const header = container.querySelector('header') as HTMLElement;
    expect(header.querySelector('picture')).toBeNull();
    expect(header.querySelector('img')).toHaveAttribute('src', FALLBACK);
    expect(header.querySelector('img')).toHaveAttribute('width', '651');
    expect(header.querySelector('img')).toHaveAttribute('height', '262');
  });

  it('preserves the original PNG and validates every lossless transparent WebP', () => {
    const logoDirectory = resolve(process.cwd(), 'public/logos');
    const original = readFileSync(resolve(logoDirectory, 'logo black.png'));
    expect(createHash('sha256').update(original).digest('hex')).toBe(ORIGINAL_SHA256);
    expect(original.subarray(0, 16).toString('hex')).toBe('89504e470d0a1a0a0000000d49484452');
    for (const asset of ASSETS) {
      const buffer = readFileSync(resolve(logoDirectory, asset.file));
      expect(parseLosslessWebP(buffer)).toEqual({
        width: asset.width,
        height: asset.height,
        alpha: true,
      });
      expect(createHash('sha256').update(buffer).digest('hex')).toBe(asset.sha256);
    }
  });

  it('keeps Organization identity on the stable original PNG URL', () => {
    const organization = buildSolaceOrganization() as { logo: string; '@id': string; name: string };
    expect(organization.logo).toBe('https://www.talktosolace2.ai/logos/logo%20black.png');
    expect(organization['@id']).toBe('https://www.talktosolace2.ai/#organization');
    expect(organization.name).toBe('Solace');
  });
});
