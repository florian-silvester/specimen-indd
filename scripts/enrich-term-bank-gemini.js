import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_PATH = path.resolve(__dirname, '..', 'SEMANTIC_TERM_BANK.md');
const WIKI_PATH = path.resolve(__dirname, '..', 'src', 'core', 'semantic-term-bank-wiki.json');
const OUTPUT_PATH = path.resolve(__dirname, '..', 'src', 'core', 'semantic-term-bank.json');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const BATCH_SIZE = 15;
const DELAY_MS = 6000; // 6 seconds between requests to stay under free tier limit (15 RPM)

function normalizeSpaces(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeKey(value) {
  return normalizeSpaces(value).toLowerCase().replace(/[^a-z0-9\s]/g, '');
}

function slugify(value) {
  return normalizeSpaces(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
}

function parseTermBank(markdown) {
  const lines = markdown.split('\n');
  let currentBucket = 'General';
  const terms = [];
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

    const key = normalizeKey(expression);
    if (seen.has(key)) continue;
    seen.add(key);
    terms.push({ bucket: currentBucket, expression });
  }
  return terms;
}

async function loadWikiEnrichment() {
  try {
    const raw = await fs.readFile(WIKI_PATH, 'utf8');
    const data = JSON.parse(raw);
    const map = new Map();
    for (const item of data) {
      if (item.expression && item.description) {
        map.set(normalizeKey(item.expression), item.description);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

async function loadExistingBank() {
  try {
    const raw = await fs.readFile(OUTPUT_PATH, 'utf8');
    const data = JSON.parse(raw);
    const map = new Map();
    for (const item of data) {
      if (item.expression && item.description) {
        map.set(normalizeKey(item.expression), item);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

async function fetchGeminiDescriptions(terms) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  const prompt = `
You are an expert encyclopedic writer. I will give you a list of terms and their categories.
For each term, write a precise, factual, encyclopedic description.

CRITICAL CONSTRAINTS FOR EVERY DESCRIPTION:
1. Must be exactly 2 to 3 sentences.
2. Must be between 300 and 400 characters total (including spaces).
3. Must start with the exact term.
4. Must be factual and objective (like Wikipedia or a dictionary).
5. Do not use conversational filler, markdown, or bullet points.

Return ONLY a valid JSON array of objects with "expression" and "description" keys.

Terms:
${terms.map((t) => `- ${t.expression} (Category: ${t.bucket})`).join('\n')}
`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json'
      }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`429: ${err}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return [];
  
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const markdown = await fs.readFile(INPUT_PATH, 'utf8');
  const terms = parseTermBank(markdown);
  const wikiMap = await loadWikiEnrichment();
  const existingMap = await loadExistingBank();
  
  const finalEntries = [];
  const missingTerms = [];

  // First pass: use existing data ONLY if it's already from Gemini
  for (const term of terms) {
    const key = normalizeKey(term.expression);
    
    // Check if already processed in a previous run with gemini source
    if (existingMap.has(key)) {
      const existing = existingMap.get(key);
      if (existing.source === 'gemini') {
        finalEntries.push(existing);
        continue;
      }
    }

    missingTerms.push(term);
  }

  console.log(`[enrich-gemini] ${finalEntries.length} terms already resolved (Wiki or previous run).`);
  console.log(`[enrich-gemini] ${missingTerms.length} terms need Gemini enrichment.`);

  if (missingTerms.length === 0) {
    console.log('[enrich-gemini] All terms resolved. Saving and exiting.');
    await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(finalEntries, null, 2)}\n`, 'utf8');
    return;
  }

  if (!GEMINI_API_KEY) {
    console.warn('[enrich-gemini] No GEMINI_API_KEY found. Skipping AI enrichment and saving partial bank.');
    await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(finalEntries, null, 2)}\n`, 'utf8');
    return;
  }

  // Second pass: Gemini for missing terms
  let processed = 0;
  for (let i = 0; i < missingTerms.length; i += BATCH_SIZE) {
    const batch = missingTerms.slice(i, i + BATCH_SIZE);
    let success = false;
    let retries = 0;

    while (!success && retries < 5) {
      try {
        const results = await fetchGeminiDescriptions(batch);
        
        for (const term of batch) {
          const match = results.find((r) => normalizeKey(r.expression) === normalizeKey(term.expression));
          let description = match?.description;
          
          if (description) {
            description = normalizeSpaces(description);
            finalEntries.push({
              id: `${slugify(term.bucket)}-${slugify(term.expression)}`,
              bucket: term.bucket,
              expression: term.expression,
              description,
              source: 'gemini'
            });
          } else {
            // Fallback so we don't get stuck forever if Gemini skips a term
            finalEntries.push({
              id: `${slugify(term.bucket)}-${slugify(term.expression)}`,
              bucket: term.bucket,
              expression: term.expression,
              description: `${term.expression} is a concept related to ${term.bucket}.`,
              source: 'fallback'
            });
          }
        }
        
        processed += batch.length;
        console.log(`[enrich-gemini] Processed ${processed}/${missingTerms.length} via Gemini...`);
        
        // Save incrementally
        await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(finalEntries, null, 2)}\n`, 'utf8');
        
        success = true;
        await sleep(DELAY_MS);
      } catch (err) {
        retries++;
        console.error(`[enrich-gemini] Batch failed (attempt ${retries}):`, err.message.substring(0, 150) + '...');
        
        if (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED') || err.message.includes('Quota')) {
          console.log('[enrich-gemini] Rate limited. Waiting 20 seconds before retry...');
          await sleep(20000); // Wait 20 seconds on rate limit
        } else {
          await sleep(DELAY_MS * 2);
        }
      }
    }
  }

  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(finalEntries, null, 2)}\n`, 'utf8');
  console.log(`[enrich-gemini] Done. Wrote ${finalEntries.length} total entries to ${OUTPUT_PATH}`);
}

run().catch((error) => {
  console.error('[enrich-gemini] Fatal error:', error);
  process.exit(1);
});
