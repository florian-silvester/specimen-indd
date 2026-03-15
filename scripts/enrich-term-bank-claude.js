import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_PATH = path.resolve(__dirname, '..', 'SEMANTIC_TERM_BANK.md');
const OUTPUT_PATH = path.resolve(__dirname, '..', 'src', 'core', 'semantic-term-bank.json');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const BATCH_SIZE = 20;
const DELAY_MS = 2000;

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

async function fetchClaudeDescriptions(terms) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
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

Return ONLY a valid JSON array of objects with "expression" and "description" keys. No other text.

Terms:
${terms.map((t) => `- ${t.expression} (Category: ${t.bucket})`).join('\n')}
`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      temperature: 0.2,
      system: "You are a JSON-only API. You must return ONLY valid JSON and absolutely no other text.",
      messages: [
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  let text = data.content?.[0]?.text || '';
  
  // Clean up any potential markdown formatting Claude might sneak in
  text = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse Claude JSON:", text.substring(0, 100));
    return [];
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const markdown = await fs.readFile(INPUT_PATH, 'utf8');
  const terms = parseTermBank(markdown);
  const existingMap = await loadExistingBank();
  
  const finalEntries = [];
  const missingTerms = [];

  for (const term of terms) {
    const key = normalizeKey(term.expression);
    
    if (existingMap.has(key)) {
      const existing = existingMap.get(key);
      if (existing.source === 'claude') {
        finalEntries.push(existing);
        continue;
      }
    }

    missingTerms.push(term);
  }

  console.log(`[enrich-claude] ${finalEntries.length} terms already resolved by Claude.`);
  console.log(`[enrich-claude] ${missingTerms.length} terms need Claude enrichment.`);

  if (missingTerms.length === 0) {
    console.log('[enrich-claude] All terms resolved. Saving and exiting.');
    await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(finalEntries, null, 2)}\n`, 'utf8');
    return;
  }

  if (!ANTHROPIC_API_KEY) {
    console.warn('[enrich-claude] No ANTHROPIC_API_KEY found. Skipping AI enrichment.');
    return;
  }

  let processed = 0;
  for (let i = 0; i < missingTerms.length; i += BATCH_SIZE) {
    const batch = missingTerms.slice(i, i + BATCH_SIZE);
    let success = false;
    let retries = 0;

    while (!success && retries < 3) {
      try {
        const results = await fetchClaudeDescriptions(batch);
        
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
              source: 'claude'
            });
          } else {
            // Keep whatever was there before if Claude failed for this specific term
            const oldKey = normalizeKey(term.expression);
            if (existingMap.has(oldKey)) {
              finalEntries.push(existingMap.get(oldKey));
            }
          }
        }
        
        processed += batch.length;
        console.log(`[enrich-claude] Processed ${processed}/${missingTerms.length} via Claude...`);
        
        await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(finalEntries, null, 2)}\n`, 'utf8');
        
        success = true;
        await sleep(DELAY_MS);
      } catch (err) {
        retries++;
        console.error(`[enrich-claude] Batch failed (attempt ${retries}):`, err.message.substring(0, 150) + '...');
        await sleep(DELAY_MS * 2);
      }
    }
  }

  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(finalEntries, null, 2)}\n`, 'utf8');
  console.log(`[enrich-claude] Done. Wrote ${finalEntries.length} total entries to ${OUTPUT_PATH}`);
}

run().catch((error) => {
  console.error('[enrich-claude] Fatal error:', error);
  process.exit(1);
});
