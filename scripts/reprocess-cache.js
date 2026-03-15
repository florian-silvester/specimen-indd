import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_PATH = path.resolve(__dirname, '..', 'SEMANTIC_TERM_BANK.md');
const OUTPUT_PATH = path.resolve(__dirname, '..', 'src', 'core', 'semantic-term-bank-wiki.json');
const CACHE_PATH = path.resolve(__dirname, '.cache', 'semantic-term-bank-wiki-cache.json');

const MIN_CHARS = 300;
const MAX_CHARS = 420;

function normalizeSpaces(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeKey(value) {
  return normalizeSpaces(value).toLowerCase().replace(/[^a-z0-9\s]/g, '');
}

function toAscii(value) {
  return value.normalize('NFKD').replace(/[^\x00-\x7F]/g, '');
}

function cleanExtract(text) {
  return normalizeSpaces(
    toAscii(text || '')
      .replace(/\[[^\]]*\]/g, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/[^A-Za-z0-9,.;:!?'"()\s\-+=*/%&@#$]/g, ' ')
  );
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => normalizeSpaces(sentence))
    .filter((sentence) => {
      if (sentence.length < 30) return false;
      if (sentence.includes('displaystyle')) return false;
      if (sentence.includes('Notes References')) return false;
      if (sentence.includes('Further reading')) return false;
      if (sentence.includes('See also')) return false;
      if (sentence.includes('==')) return false;
      if (sentence.includes('How to use')) return false;
      if (sentence.includes('Synonym Discussion')) return false;
      if (sentence.includes('The meaning of')) return false;
      return true;
    });
}

function pickBestParagraph(extract, expression) {
  const cleaned = cleanExtract(extract);
  if (!cleaned) return null;
  const sentences = splitSentences(cleaned);
  if (sentences.length === 0) return null;

  const expressionKey = normalizeKey(expression);
  let best = null;

  for (let start = 0; start < sentences.length; start += 1) {
    for (let take = 2; take <= 8; take += 1) {
      if (start + take > sentences.length) continue;
      const chunk = normalizeSpaces(sentences.slice(start, start + take).join(' '));
      const len = chunk.length;
      if (len < MIN_CHARS || len > MAX_CHARS) continue;
      const chunkKey = normalizeKey(chunk);
      const hasTerm = chunkKey.includes(expressionKey);
      const targetDistance = Math.abs(350 - len);
      const score = targetDistance + (hasTerm ? 0 : 40);
      if (!best || score < best.score) {
        best = { text: chunk, score };
      }
    }
  }

  if (best) return best.text;

  for (let take = 8; take >= 2; take -= 1) {
    for (let start = 0; start < sentences.length; start += 1) {
      if (start + take > sentences.length) continue;
      const chunk = normalizeSpaces(sentences.slice(start, start + take).join(' '));
      if (chunk.length <= MAX_CHARS && chunk.length >= 260) {
        return chunk;
      }
    }
  }
  return null;
}

function parseTermBank(markdown) {
  const lines = markdown.split('\n');
  let currentBucket = 'General';
  const seen = new Set();
  const terms = [];

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

    const key = normalizeKey(expression);
    if (seen.has(key)) continue;
    seen.add(key);
    terms.push({ bucket: currentBucket, expression });
  }
  return terms;
}

async function run() {
  const markdown = await fs.readFile(INPUT_PATH, 'utf8');
  const terms = parseTermBank(markdown);
  const cacheRaw = await fs.readFile(CACHE_PATH, 'utf8');
  const cache = JSON.parse(cacheRaw);
  
  const results = [];
  
  for (const term of terms) {
    const termKey = normalizeKey(term.expression);
    const title = cache.titleByTerm[termKey];
    if (!title) continue;
    
    const extract = cache.extractByTitle[normalizeKey(title)];
    if (!extract) continue;
    
    const paragraph = pickBestParagraph(extract, term.expression);
    if (paragraph) {
      results.push({
        bucket: term.bucket,
        expression: term.expression,
        title,
        description: paragraph,
        source: 'wiki'
      });
    }
  }
  
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
  console.log(`Reprocessed ${results.length} terms from cache without typos.`);
}

run().catch(console.error);