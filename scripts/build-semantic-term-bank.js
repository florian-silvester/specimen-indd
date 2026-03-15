import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_PATH = path.resolve(__dirname, '..', 'SEMANTIC_TERM_BANK.md');
const OUTPUT_PATH = path.resolve(__dirname, '..', 'src', 'core', 'semantic-term-bank.json');
const WIKI_PATH = path.resolve(__dirname, '..', 'src', 'core', 'semantic-lorem-wiki.json');
const TERM_BANK_WIKI_PATH = path.resolve(__dirname, '..', 'src', 'core', 'semantic-term-bank-wiki.json');

function normalizeSpaces(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function slugify(value) {
  return normalizeSpaces(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
}

function normalizeKey(value) {
  return normalizeSpaces(value).toLowerCase().replace(/[^a-z0-9\s]/g, '');
}

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function makeSyntheticDescription(expression, bucket, seed) {
  const intros = [
    `${expression} is grouped in the ${bucket} bucket for rotation across play cycles, where its wording anchors a specific semantic tone.`,
    `Within the ${bucket} bucket, ${expression} is used as a reference term to keep headline focus and body copy direction aligned.`,
    `${expression} sits inside the ${bucket} set and is surfaced during randomized bucket passes to preserve variety without losing intent.`,
    `For the ${bucket} category, ${expression} acts as a stable semantic cue that can be compared against neighboring entries during preview cycles.`
  ];
  const middles = [
    `The attached paragraph is tuned for readability checks across different sizes, tracking how spacing, rhythm, and density feel when the same concept appears in multiple typographic contexts.`,
    `Its companion text is intentionally long enough for contrast testing, so line wraps, cadence, and emphasis can be judged while designers switch weights, scaling rules, and visual hierarchy.`,
    `The description is structured for side-by-side specimen review, giving enough length to test legibility shifts under varying line heights, widths, and alignment constraints.`,
    `This long-form block supports practical evaluation in the canvas workflow by exposing wrap behavior, scanning speed, and text texture under repeated updates.`
  ];
  const closers = [
    `Use it to compare consistency across generated states and verify that content changes remain meaningful instead of decorative noise.`,
    `It helps reveal whether style adjustments improve clarity, reading flow, and information hierarchy under realistic content pressure.`,
    `This keeps each rotation pass useful for decision-making, with content that stays specific while still behaving like natural editorial copy.`,
    `The result is a durable test paragraph that stays on-topic and supports repeatable typographic decisions over time.`
  ];

  const intro = intros[seed % intros.length];
  const middle = middles[(seed >> 3) % middles.length];
  const closer = closers[(seed >> 5) % closers.length];
  const full = normalizeSpaces(`${intro} ${middle} ${closer}`);

  if (full.length >= 300 && full.length <= 420) return full;
  if (full.length > 420) return full.slice(0, 418).replace(/\s+\S*$/, '') + '.';
  return `${full} This additional sentence preserves target length for robust preview behavior in dense and sparse layout regions.`;
}

function buildDescription(expression, bucket, seed, wikiByExpression) {
  const wikiParagraphs = wikiByExpression.get(normalizeKey(expression));
  if (wikiParagraphs && wikiParagraphs.length > 0) {
    const paragraph = wikiParagraphs[seed % wikiParagraphs.length];
    if (paragraph.length >= 300 && paragraph.length <= 420) return paragraph;
  }
  return makeSyntheticDescription(expression, bucket, seed);
}

function parseTermBank(markdown, wikiByExpression) {
  const lines = markdown.split('\n');
  let currentBucket = 'General';
  const entries = [];
  const seen = new Set();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('## ')) {
      currentBucket = normalizeSpaces(line.slice(3));
      continue;
    }

    if (!line.startsWith('- ')) continue;
    const expression = normalizeSpaces(line.slice(2));
    if (!expression) continue;

    const key = `${currentBucket}::${expression.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const seed = hashString(`${currentBucket}::${expression}`);
    entries.push({
      id: `${slugify(currentBucket)}-${slugify(expression)}`,
      bucket: currentBucket,
      expression,
      description: buildDescription(expression, currentBucket, seed, wikiByExpression)
    });
  }

  return entries;
}

async function loadWikiParagraphMap() {
  const map = new Map();
  try {
    const raw = await fs.readFile(TERM_BANK_WIKI_PATH, 'utf8');
    const termBankWikiEntries = JSON.parse(raw);
    if (Array.isArray(termBankWikiEntries)) {
      for (const entry of termBankWikiEntries) {
        const expression = normalizeSpaces(String(entry?.expression || ''));
        const description = normalizeSpaces(String(entry?.description || ''));
        if (!expression || !description) continue;
        map.set(normalizeKey(expression), [description]);
      }
    }
  } catch {
    // Optional enrichment file; ignore when absent.
  }

  try {
    const raw = await fs.readFile(WIKI_PATH, 'utf8');
    const wikiEntries = JSON.parse(raw);
    if (!Array.isArray(wikiEntries)) return map;
    for (const entry of wikiEntries) {
      const expression = normalizeSpaces(String(entry?.expression || ''));
      const paragraphs = Array.isArray(entry?.paragraphs)
        ? entry.paragraphs.map((p) => normalizeSpaces(String(p || ''))).filter(Boolean)
        : [];
      if (!expression || paragraphs.length === 0) continue;
      const key = normalizeKey(expression);
      if (!map.has(key)) {
        map.set(key, paragraphs);
      }
    }
    return map;
  } catch {
    return map;
  }
}

async function run() {
  const markdown = await fs.readFile(INPUT_PATH, 'utf8');
  const wikiByExpression = await loadWikiParagraphMap();
  const entries = parseTermBank(markdown, wikiByExpression);
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
  console.log(`[term-bank] Wrote ${entries.length} entries to ${OUTPUT_PATH}`);
}

run().catch((error) => {
  console.error('[term-bank] Build failed:', error);
  process.exit(1);
});
