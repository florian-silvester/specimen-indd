import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API = 'https://en.wikipedia.org/w/api.php';
const INPUT_PATH = path.resolve(__dirname, '..', 'SEMANTIC_TERM_BANK.md');
const OUTPUT_PATH = path.resolve(__dirname, '..', 'src', 'core', 'semantic-term-bank-wiki.json');
const CACHE_PATH = path.resolve(__dirname, '.cache', 'semantic-term-bank-wiki-cache.json');

const USER_AGENT =
  process.env.SEMANTIC_TERM_BANK_USER_AGENT ||
  'SpecimenTermBankBot/1.0 (contact: florian@specimen.local)';
const FETCH_TIMEOUT_MS = Number(process.env.SEMANTIC_TERM_BANK_FETCH_TIMEOUT_MS || '15000');
const REQUEST_DELAY_MS = Number(process.env.SEMANTIC_TERM_BANK_REQUEST_DELAY_MS || '50');
const MAX_RETRIES = Number(process.env.SEMANTIC_TERM_BANK_MAX_RETRIES || '6');
const TERM_LIMIT = Number(process.env.SEMANTIC_TERM_BANK_LIMIT || '0'); // 0 = all
const PROGRESS_EVERY = Number(process.env.SEMANTIC_TERM_BANK_PROGRESS_EVERY || '10');
const VERBOSE = String(process.env.SEMANTIC_TERM_BANK_VERBOSE || '1') !== '0';
const ENABLE_WEBSTER_FALLBACK = false;
const MIN_CHARS = 300;
const MAX_CHARS = 420;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeSpaces(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeKey(value) {
  return normalizeSpaces(value).toLowerCase().replace(/[^a-z0-9\s]/g, '');
}

function toAscii(value) {
  return value.normalize('NFKD').replace(/[^\x00-\x7F]/g, '');
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
    terms.push({
      bucket: currentBucket,
      expression
    });
  }

  return terms;
}

let lastRequestAt = 0;
async function pace() {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < REQUEST_DELAY_MS) {
    await sleep(REQUEST_DELAY_MS - elapsed);
  }
  lastRequestAt = Date.now();
}

async function fetchJson(url, retries = MAX_RETRIES) {
  let attempt = 0;
  while (true) {
    await pace();
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json'
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
      });

      if (res.ok) {
        const type = res.headers.get('content-type') || '';
        if (!type.includes('json')) return null;
        return res.json();
      }

      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        const retryAfter = res.headers.get('retry-after');
        const waitMs = retryAfter && Number(retryAfter) > 0
          ? Number(retryAfter) * 1000
          : Math.min(30000, 700 * 2 ** attempt + Math.floor(Math.random() * 250));
        await sleep(waitMs);
        attempt += 1;
        continue;
      }
      return null;
    } catch {
      if (attempt >= retries) return null;
      await sleep(Math.min(20000, 600 * 2 ** attempt));
      attempt += 1;
    }
  }
}

async function fetchText(url, retries = MAX_RETRIES) {
  let attempt = 0;
  while (true) {
    await pace();
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html, text/plain;q=0.9'
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
      });

      if (res.ok) {
        return res.text();
      }

      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        const retryAfter = res.headers.get('retry-after');
        const waitMs = retryAfter && Number(retryAfter) > 0
          ? Number(retryAfter) * 1000
          : Math.min(30000, 700 * 2 ** attempt + Math.floor(Math.random() * 250));
        await sleep(waitMs);
        attempt += 1;
        continue;
      }
      return null;
    } catch {
      if (attempt >= retries) return null;
      await sleep(Math.min(20000, 600 * 2 ** attempt));
      attempt += 1;
    }
  }
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
      return true;
    });
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
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

  // fallback: use longest sentence window under hard max
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

function toDescriptionLength(value) {
  const text = normalizeSpaces(value);
  if (text.length >= MIN_CHARS && text.length <= MAX_CHARS) return text;
  if (text.length > MAX_CHARS) {
    return text.slice(0, MAX_CHARS - 1).replace(/\s+\S*$/, '') + '.';
  }
  return null;
}

function extractWebsterSnippets(html) {
  const snippets = [];
  if (!html) return snippets;

  const metaMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
  if (metaMatch?.[1]) {
    snippets.push(decodeHtml(metaMatch[1]));
  }

  const dtMatches = [...html.matchAll(/<span class="dtText">([\s\S]*?)<\/span>/gi)];
  for (const match of dtMatches.slice(0, 8)) {
    const text = decodeHtml(match[1].replace(/<[^>]+>/g, ' ')).replace(/^:\s*/, '');
    const cleaned = normalizeSpaces(text);
    if (cleaned) snippets.push(cleaned);
  }

  const uniq = [];
  const seen = new Set();
  for (const s of snippets) {
    const k = normalizeKey(s);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    uniq.push(s);
  }
  return uniq;
}

function composeWebsterDescription(expression, snippets) {
  const usable = snippets.filter((s) => s.length >= 40);
  if (usable.length === 0) return null;

  let combined = `${expression} relates to ${usable[0]}`;
  let idx = 1;
  while (combined.length < MIN_CHARS && idx < usable.length) {
    combined += ` ${usable[idx]}`;
    idx += 1;
  }
  return toDescriptionLength(combined);
}

async function resolveFromWebster(term) {
  const candidates = [term];
  const words = normalizeSpaces(term).split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    candidates.push(words[0], words[words.length - 1], words.slice(0, 2).join(' '));
  }

  const allSnippets = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const url = `https://www.merriam-webster.com/dictionary/${encodeURIComponent(candidate)}`;
    const html = await fetchText(url);
    if (!html) continue;
    const snippets = extractWebsterSnippets(html);
    for (const snippet of snippets) {
      const key = normalizeKey(snippet);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      allSnippets.push(snippet);
    }
    if (allSnippets.length >= 6) break;
  }

  const description = composeWebsterDescription(term, allSnippets);
  if (!description) return null;
  return {
    title: term,
    description
  };
}

async function wikiExtractByTitle(title) {
  const url = new URL(API);
  url.searchParams.set('action', 'query');
  url.searchParams.set('prop', 'extracts');
  url.searchParams.set('explaintext', '1');
  url.searchParams.set('redirects', '1');
  url.searchParams.set('titles', title);
  url.searchParams.set('format', 'json');
  url.searchParams.set('utf8', '1');
  url.searchParams.set('origin', '*');

  const json = await fetchJson(url.toString());
  if (!json?.query?.pages) return null;
  const page = Object.values(json.query.pages)[0];
  if (!page || page.missing !== undefined) return null;
  const pageTitle = normalizeSpaces(String(page.title || title));
  const extract = normalizeSpaces(String(page.extract || ''));
  if (!extract) return null;
  return { title: pageTitle, extract };
}

async function wikiSearch(query) {
  const url = new URL(API);
  url.searchParams.set('action', 'query');
  url.searchParams.set('list', 'search');
  url.searchParams.set('srsearch', query);
  url.searchParams.set('srlimit', '6');
  url.searchParams.set('format', 'json');
  url.searchParams.set('utf8', '1');
  url.searchParams.set('origin', '*');

  const json = await fetchJson(url.toString());
  const hits = json?.query?.search || [];
  return hits.map((hit) => String(hit.title || '').trim()).filter(Boolean);
}

function tokenOverlap(term, title) {
  const termTokens = normalizeKey(term).split(/\s+/).filter(Boolean);
  const titleTokens = new Set(normalizeKey(title).split(/\s+/).filter(Boolean));
  if (termTokens.length === 0) return 0;
  let hits = 0;
  for (const token of termTokens) {
    if (titleTokens.has(token)) hits += 1;
  }
  return hits / termTokens.length;
}

function isEntityMismatch(title) {
  const lower = title.toLowerCase();
  const banned = [
    'album',
    'song',
    'film',
    'tv series',
    'episode',
    'play',
    'theatre',
    'theater',
    'restaurant',
    'cafe',
    'bar',
    'district',
    'neighborhood',
    'fringe'
  ];
  return banned.some((word) => lower.includes(`(${word})`) || lower.includes(` ${word}`));
}

function isTitleAllowed(term, bucket, title) {
  if (isEntityMismatch(title)) return false;
  const overlap = tokenOverlap(term, title);
  const bucketKey = normalizeKey(bucket);

  if (bucketKey.includes('recipes') && overlap < 0.34) return false;
  if (bucketKey.includes('cultural') && overlap < 0.75) return false;
  if (bucketKey.includes('slang') && overlap < 0.75) return false;
  if (bucketKey.includes('discourse') && overlap < 0.75) return false;
  if (bucketKey.includes('landscape') && overlap < 0.34) return false;
  if (bucketKey.includes('ecology') && overlap < 0.34) return false;

  return overlap >= 0.34;
}

function rankCandidateTitles(term, bucket, titles) {
  if (titles.length === 0) return null;
  const termKey = normalizeKey(term);
  const nonDisambig = titles.filter((title) => !/\(disambiguation\)$/i.test(title));
  const pool = nonDisambig.length > 0 ? nonDisambig : titles;

  const termTokens = new Set(termKey.split(/\s+/).filter(Boolean));
  const scoreTitle = (title) => {
    const key = normalizeKey(title);
    const tokens = key.split(/\s+/).filter(Boolean);
    let score = 0;

    if (key === termKey) score += 1000;
    if (key.startsWith(termKey)) score += 250;

    let overlap = 0;
    for (const token of tokens) {
      if (termTokens.has(token)) overlap += 1;
    }
    score += overlap * 80;
    score -= Math.max(0, tokens.length - termTokens.size) * 10;

    if (isEntityMismatch(title)) {
      score -= 300;
    }

    // Prefer conceptual pages over named entities with commas.
    if (title.includes(',')) score -= 60;

    return score;
  };

  const ranked = [...pool]
    .map((title) => ({ title, score: scoreTitle(title) }))
    .sort((a, b) => b.score - a.score)
    .filter((row) => isTitleAllowed(term, bucket, row.title));

  return ranked.map((row) => row.title);
}

function isExtractAllowed(bucket, title, extract) {
  const text = `${title} ${extract}`.toLowerCase();
  const bucketKey = normalizeKey(bucket);
  const bannedByBucket = [];

  if (bucketKey.includes('recipes')) {
    bannedByBucket.push('restaurant', 'cafe', 'bar', 'opened in', 'neighborhood', 'lombard street');
  }
  if (bucketKey.includes('cultural') || bucketKey.includes('slang') || bucketKey.includes('discourse')) {
    bannedByBucket.push('playwright', 'theatre', 'theater', 'festival fringe', 'sitcom', 'album', 'film');
  }

  return !bannedByBucket.some((word) => text.includes(word));
}

async function loadCache() {
  try {
    const raw = await fs.readFile(CACHE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      titleByTerm: parsed.titleByTerm || {},
      extractByTitle: parsed.extractByTitle || {},
      paragraphByTerm: parsed.paragraphByTerm || {}
    };
  } catch {
    return {
      titleByTerm: {},
      extractByTitle: {},
      paragraphByTerm: {}
    };
  }
}

async function saveCache(cache) {
  await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await fs.writeFile(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
}

async function resolveTerm(term, cache) {
  const termKey = normalizeKey(term.expression);

  const cachedParagraph = cache.paragraphByTerm[termKey];
  if (cachedParagraph?.text) {
    const cachedTitle = cachedParagraph.title || term.expression;
    const text = normalizeSpaces(String(cachedParagraph.text || ''));
    const cachedLooksValid =
      text.length >= 260 &&
      text.length <= MAX_CHARS &&
      isTitleAllowed(term.expression, term.bucket, cachedTitle) &&
      isExtractAllowed(term.bucket, cachedTitle, text);

    if (cachedLooksValid) {
      return {
        bucket: term.bucket,
        expression: term.expression,
        title: cachedTitle,
        description: text,
        source: 'wiki'
      };
    }

    delete cache.paragraphByTerm[termKey];
  }

  let title = cache.titleByTerm[termKey] || null;
  let extract = null;

  if (title) {
    const titleKey = normalizeKey(title);
    extract = cache.extractByTitle[titleKey] || null;
    if (!extract) {
      const resolved = await wikiExtractByTitle(title);
      if (resolved) {
        extract = resolved.extract;
        cache.extractByTitle[titleKey] = extract;
      }
    }
    if (extract && !isExtractAllowed(term.bucket, title, extract)) {
      title = null;
      extract = null;
      delete cache.titleByTerm[termKey];
    }
  }

  if (!title || !extract) {
    const candidates = [];
    const exact = await wikiExtractByTitle(term.expression);
    if (exact && isTitleAllowed(term.expression, term.bucket, exact.title)) {
      candidates.push(exact.title);
      cache.extractByTitle[normalizeKey(exact.title)] = exact.extract;
    }

    const searchTitles = await wikiSearch(term.expression);
    const rankedTitles = rankCandidateTitles(term.expression, term.bucket, searchTitles) || [];
    for (const candidate of rankedTitles) {
      if (!candidates.includes(candidate)) candidates.push(candidate);
    }

    for (const candidateTitle of candidates) {
      const candidateKey = normalizeKey(candidateTitle);
      let candidateExtract = cache.extractByTitle[candidateKey];
      if (!candidateExtract) {
        const resolved = await wikiExtractByTitle(candidateTitle);
        if (!resolved) continue;
        candidateExtract = resolved.extract;
        cache.extractByTitle[candidateKey] = candidateExtract;
      }
      if (!isExtractAllowed(term.bucket, candidateTitle, candidateExtract)) continue;
      title = candidateTitle;
      extract = candidateExtract;
      break;
    }
  }

  if (!title || !extract) return null;
  cache.titleByTerm[termKey] = title;

  const paragraph = pickBestParagraph(extract, term.expression);
  if (!paragraph) return null;

  cache.paragraphByTerm[termKey] = {
    title,
    text: paragraph
  };

  return {
    bucket: term.bucket,
    expression: term.expression,
    title,
    description: paragraph,
    source: 'wiki'
  };
}

async function run() {
  const markdown = await fs.readFile(INPUT_PATH, 'utf8');
  const terms = parseTermBank(markdown);
  const selectedTerms = TERM_LIMIT > 0 ? terms.slice(0, TERM_LIMIT) : terms;
  const cache = await loadCache();
  const results = [];
  const startedAt = Date.now();

  console.log(
    `[term-bank-wiki] Start | terms=${selectedTerms.length} | delayMs=${REQUEST_DELAY_MS} | timeoutMs=${FETCH_TIMEOUT_MS} | retries=${MAX_RETRIES}`
  );

  let successCount = 0;
  let missCount = 0;
  for (let i = 0; i < selectedTerms.length; i += 1) {
    const term = selectedTerms[i];
    let result = await resolveTerm(term, cache);
    if (!result && ENABLE_WEBSTER_FALLBACK) {
      const webster = await resolveFromWebster(term.expression);
      if (webster) {
        result = {
          bucket: term.bucket,
          expression: term.expression,
          title: webster.title,
          description: webster.description,
          source: 'webster'
        };
      }
    }
    if (result) {
      results.push(result);
      successCount += 1;
    } else {
      missCount += 1;
    }

    if (VERBOSE && ((i + 1) % PROGRESS_EVERY === 0 || i === 0 || i + 1 === selectedTerms.length)) {
      const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
      const done = i + 1;
      const pct = ((done / selectedTerms.length) * 100).toFixed(1);
      const rate = done / Math.max(elapsedSec, 1);
      const remaining = selectedTerms.length - done;
      const etaSec = Math.round(remaining / Math.max(rate, 0.001));
      console.log(
        `[term-bank-wiki] ${done}/${selectedTerms.length} (${pct}%) | resolved=${successCount} | missing=${missCount} | elapsed=${elapsedSec}s | eta=${etaSec}s | term="${term.expression}"`
      );
    }

    if ((i + 1) % 50 === 0) {
      await saveCache(cache);
    }
  }

  await saveCache(cache);
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
  const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
  console.log(
    `[term-bank-wiki] Done | wrote=${results.length}/${selectedTerms.length} | missing=${missCount} | elapsed=${elapsedSec}s | output=${OUTPUT_PATH}`
  );
}

run().catch((error) => {
  console.error('[term-bank-wiki] Update failed:', error);
  process.exit(1);
});
