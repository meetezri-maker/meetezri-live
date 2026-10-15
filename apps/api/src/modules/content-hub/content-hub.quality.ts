export const EDITORIAL_RESIDUE_TERMS = [
  'AI knowledge systems',
  'AEO knowledge base',
  'SOLACE MONTH 1 • WEEK 4 OPERATIONAL WORKBOOK',
  'knowledge signals in Week 2',
  'This is a key Week 3 idea',
  'Week 3 Connection',
  'aligns directly with R004',
  'This connects directly to Week 3’s strongest theme',
] as const;

export interface MetadataRecord {
  slug: string;
  seoTitle: string;
  metaDescription: string | null;
}

export interface QualityFinding {
  rule: string;
  slugs: string[];
  value?: string;
}

function normalise(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
}

/** Deterministic publishing diagnostics. Similarity remains report-only by design. */
export function auditResourceMetadata(records: MetadataRecord[]): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const groups = (pick: (record: MetadataRecord) => string | null) => {
    const map = new Map<string, string[]>();
    for (const record of records) {
      const raw = pick(record);
      if (!raw?.trim()) continue;
      const key = normalise(raw);
      map.set(key, [...(map.get(key) ?? []), record.slug]);
    }
    return map;
  };

  for (const record of records) {
    if (!record.metaDescription?.trim()) {
      findings.push({ rule: 'missing-meta-description', slugs: [record.slug] });
    } else if (normalise(record.metaDescription) === normalise(record.seoTitle)) {
      findings.push({ rule: 'title-only-meta-description', slugs: [record.slug] });
    }
  }

  for (const [value, slugs] of groups((record) => record.seoTitle)) {
    if (slugs.length > 1) findings.push({ rule: 'duplicate-seo-title', slugs, value });
  }
  for (const [value, slugs] of groups((record) => record.metaDescription)) {
    if (slugs.length > 1) findings.push({ rule: 'duplicate-meta-description', slugs, value });
  }

  return findings.sort((a, b) => a.rule.localeCompare(b.rule) || a.slugs[0].localeCompare(b.slugs[0]));
}

export function findEditorialResidue(value: unknown): string[] {
  const serialized = JSON.stringify(value);
  return EDITORIAL_RESIDUE_TERMS.filter((term) => serialized.includes(term));
}

export function validatePublicReview(input: {
  reviewerName: string | null;
  reviewedAt: Date | string | null;
  reviewerApproved: boolean;
  credentials?: string | null;
}): string[] {
  const errors: string[] = [];
  if (input.reviewerName && (!input.reviewerApproved || !input.reviewedAt)) {
    errors.push('reviewer-requires-approved-identity-and-date');
  }
  if (input.credentials?.trim()) errors.push('unsupported-reviewer-credentials');
  return errors;
}
