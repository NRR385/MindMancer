import crypto from 'crypto';

/**
 * Converts natural language question text into a normalized snake_case slug key
 * satisfying the Feature model constraint: ^[a-z0-9_]{3,50}$
 */
export function generateFeatureSlug(questionText: string): string {
  // 1. Remove punctuation
  let clean = questionText.replace(/[?.,!;:'"()]/g, '').trim().toLowerCase();

  // Detect semantic prefix intent
  const isIsQuestion = /^(is your character|is this character|is the character|is)\s+/i.test(clean);
  const isCanQuestion = /^(can your character|can this character|can the character|can)\s+/i.test(clean);
  const isHasQuestion = /^(has your character|has this character|has the character|has)\s+/i.test(clean);

  // 2. Remove common interrogative prefixes to emphasize core semantic trait
  clean = clean.replace(
    /^(is your character|does your character|can your character|is this character|does this character|can this character|is the character|has this character|has your character|is|does|can|has)\s+/i,
    ''
  );

  // Strip leading articles
  clean = clean.replace(/^(a|an|the)\s+/i, '');

  // 3. Replace non-alphanumeric characters with underscores
  let slug = clean.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

  // 4. Attach appropriate semantic prefix if helpful
  if (isCanQuestion && !slug.startsWith('can_')) {
    slug = 'can_' + slug;
  } else if (isHasQuestion && !slug.startsWith('has_')) {
    slug = 'has_' + slug;
  } else if (isIsQuestion && !slug.startsWith('is_')) {
    slug = 'is_' + slug;
  }

  // Ensure prefix if starts with number or too short
  if (/^[0-9]/.test(slug)) {
    slug = 'has_' + slug;
  }
  if (slug.length < 3) {
    slug = 'trait_' + slug;
  }

  // Truncate to max 45 chars (leaves room for disambiguation suffix)
  slug = slug.substring(0, 45).replace(/_+$/, '');

  return slug;
}

/**
 * Disambiguates an existing slug by appending a deterministic 4-character MD5 hash of the question text.
 */
export function disambiguateSlug(slug: string, questionText: string): string {
  const hash = crypto.createHash('md5').update(questionText.trim()).digest('hex').substring(0, 4);
  const base = slug.substring(0, 45).replace(/_+$/, '');
  return `${base}_${hash}`;
}
