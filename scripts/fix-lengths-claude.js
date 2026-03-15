import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_PATH = path.resolve(__dirname, '..', 'src', 'core', 'semantic-term-bank.json');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const BATCH_SIZE = 10;
const DELAY_MS = 2000;
const MIN_CHARS = 300;
const MAX_CHARS = 400;

function normalizeSpaces(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeKey(value) {
  return normalizeSpaces(value).toLowerCase().replace(/[^a-z0-9\s]/g, '');
}

async function fetchClaudeDescriptions(terms) {
  const prompt = `You are an expert encyclopedic writer producing JSON output only.

For each term below, write a factual description that is EXACTLY between ${MIN_CHARS} and ${MAX_CHARS} characters long (including spaces). This is critical.

RULES:
- Each description must start with the exact term name
- Exactly 2-3 sentences
- Factual, encyclopedic, objective tone
- Count your characters carefully. Every description MUST be ${MIN_CHARS}-${MAX_CHARS} chars.

I will show you the current description and its character count. Rewrite it to fit within ${MIN_CHARS}-${MAX_CHARS} characters.

Return ONLY a JSON array of {"expression": "...", "description": "..."} objects.

Terms to fix:
${terms.map((t) => `- "${t.expression}" (${t.bucket}) — current: ${t.description.length} chars`).join('\n')}
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
      system: "You are a JSON-only API. Return ONLY valid JSON, no other text.",
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  let text = data.content?.[0]?.text || '';
  text = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  try { return JSON.parse(text); } catch { return []; }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const raw = await fs.readFile(OUTPUT_PATH, 'utf8');
  const data = JSON.parse(raw);

  const badIndices = [];
  for (let i = 0; i < data.length; i++) {
    const len = data[i].description.length;
    if (len < MIN_CHARS || len > MAX_CHARS) {
      badIndices.push(i);
    }
  }

  console.log(`[fix-lengths] ${badIndices.length} descriptions out of range. Fixing...`);

  let fixed = 0;
  for (let b = 0; b < badIndices.length; b += BATCH_SIZE) {
    const batchIndices = badIndices.slice(b, b + BATCH_SIZE);
    const batchTerms = batchIndices.map((i) => data[i]);

    let success = false;
    let retries = 0;
    while (!success && retries < 3) {
      try {
        const results = await fetchClaudeDescriptions(batchTerms);
        for (const idx of batchIndices) {
          const entry = data[idx];
          const match = results.find((r) => normalizeKey(r.expression) === normalizeKey(entry.expression));
          if (match?.description) {
            const newDesc = normalizeSpaces(match.description);
            if (newDesc.length >= MIN_CHARS && newDesc.length <= MAX_CHARS) {
              entry.description = newDesc;
              fixed++;
            }
          }
        }
        success = true;
        const done = Math.min(b + BATCH_SIZE, badIndices.length);
        console.log(`[fix-lengths] Processed ${done}/${badIndices.length} (fixed ${fixed} so far)...`);
        await sleep(DELAY_MS);
      } catch (err) {
        retries++;
        console.error(`[fix-lengths] Batch failed (attempt ${retries}):`, err.message.substring(0, 120));
        await sleep(DELAY_MS * 2);
      }
    }
  }

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');

  // Final count
  let stillBad = 0;
  for (const item of data) {
    const len = item.description.length;
    if (len < MIN_CHARS || len > MAX_CHARS) stillBad++;
  }

  console.log(`[fix-lengths] Done. Fixed ${fixed}. Still out of range: ${stillBad}.`);
}

run().catch(console.error);
