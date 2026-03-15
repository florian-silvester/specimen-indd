import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_PATH = path.resolve(__dirname, '..', 'src', 'core', 'semantic-lorem-wiki.json');
const CACHE_PATH = path.resolve(__dirname, '.cache', 'semantic-lorem-wiki-cache.json');
const API = 'https://en.wikipedia.org/w/api.php';

const TARGET_PER_TOPIC = Number(process.env.SEMANTIC_LOREM_TARGET_PER_TOPIC || '50');
const SEARCH_LIMIT = Number(process.env.SEMANTIC_LOREM_SEARCH_LIMIT || '10');
const SEARCH_OFFSETS = [0, 10, 20, 30, 40, 50, 60, 70];
const MIN_DELAY_MS = Number(process.env.SEMANTIC_LOREM_MIN_DELAY_MS || '380');
const FETCH_TIMEOUT_MS = Number(process.env.SEMANTIC_LOREM_FETCH_TIMEOUT_MS || '15000');
const PARAGRAPH_MIN_CHARS = Number(process.env.SEMANTIC_LOREM_PARAGRAPH_MIN_CHARS || '300');
const PARAGRAPH_MAX_CHARS = Number(process.env.SEMANTIC_LOREM_PARAGRAPH_MAX_CHARS || '420');
const USER_AGENT =
  process.env.SEMANTIC_LOREM_USER_AGENT ||
  'TraitsSpecimenBot/1.0 (contact: florian@specimen.local)';

const TOPIC_QUERIES = {
  recipes: [
    'asian dish',
    'latin american dish',
    'regional noodle dish',
    'traditional stew dish',
    'traditional soup dish'
  ],
  mathematics: [
    'mathematical theorem',
    'mathematical object',
    'number theory term',
    'topology term',
    'analysis term'
  ],
  psychology: [
    'obscure psychological concept',
    'cognitive bias psychology',
    'psychology effect',
    'social psychology concept',
    'memory psychology concept'
  ],
  computerScience: [
    'computer science term',
    'programming language theory term',
    'formal methods term',
    'program analysis term',
    'systems algorithm term'
  ],
  astronomy: [
    'astronomy term',
    'stellar phenomenon term',
    'cosmology term',
    'exoplanet detection term',
    'astrophysics term'
  ],
  latinAnimals: [
    'binomial nomenclature mammal',
    'binomial nomenclature bird',
    'binomial nomenclature reptile',
    'binomial nomenclature amphibian',
    'latin species name animal'
  ],
  instruments: [
    'obscure musical instrument',
    'folk instrument',
    'traditional string instrument',
    'traditional percussion instrument',
    'traditional wind instrument'
  ],
  mathTerms: [
    'mathematics term',
    'geometry term',
    'analysis term',
    'logic term',
    'discrete mathematics term'
  ]
};

const TOPIC_SEED_TITLES = {
  recipes: [
    'Biang biang noodles',
    'Cacio e pepe',
    'Pasta e ceci',
    'Pasta e fagioli',
    'Ajo blanco',
    'Sopa tarasca',
    'Sopa de ajo',
    'Migas manchegas',
    'Shakshouka',
    'Kuku sabzi',
    'Ash reshteh',
    'Fesenjan',
    'Tahchin',
    'Moqueca',
    'Ceviche',
    'Tamal',
    'Adobo',
    'Sinigang',
    'Kare-kare',
    'Laab',
    'Khao soi',
    'Som tam',
    'Larb',
    'Bun cha',
    'Com tam',
    'Goi cuon',
    'Canh chua',
    'Hainanese chicken rice',
    'Claypot rice',
    'Bak kut teh',
    'Roti canai',
    'Kottu',
    'Aushak',
    'Mantu'
  ],
  mathematics: [
    'Banach-Tarski paradox',
    'Berry paradox',
    'Buffon needle',
    'Cantor set',
    'Cauchy sequence',
    'Dirichlet kernel',
    'Fermat point',
    'Fibonacci sequence',
    'Gaussian prime',
    'Haar measure',
    'Heine-Borel theorem',
    'Hilbert curve',
    'Jordan curve theorem',
    'Klein bottle',
    'Lebesgue measure',
    'Liouville number',
    'Markov chain',
    'Mobius strip',
    'Noether theorem',
    'Pell equation',
    'Pigeonhole principle',
    'Prime number',
    'Riemann sphere',
    'Riemann sum',
    'Sierpinski carpet',
    'Sierpinski triangle',
    'Spectral theorem',
    'Taylor series',
    'Turing machine',
    'Zorn lemma'
  ],
  psychology: [
    'Abilene paradox',
    'Affect heuristic',
    'Ambiguity effect',
    'Attentional blink',
    'Backfire effect',
    'Ben Franklin effect',
    'Benign violation theory',
    'Boundary extension',
    'Cheerleader effect',
    'Choice blindness',
    'Contrast effect',
    'Decoy effect',
    'Default effect',
    'Dunning-Kruger effect',
    'Endowment effect',
    'False consensus effect',
    'Focusing illusion',
    'Forer effect',
    'Framing effect',
    'Gambler\'s fallacy',
    'Halo effect',
    'Illusory truth effect',
    'Implicit bias',
    'Information bias',
    'Just-world hypothesis',
    'Mere-exposure effect',
    'Misinformation effect',
    'Naive realism',
    'Negativity bias',
    'Observer-expectancy effect',
    'Ostrich effect',
    'Overjustification effect',
    'Planning fallacy',
    'Reactance theory',
    'Recency bias',
    'Risk compensation',
    'Self-serving bias',
    'Social loafing',
    'Spotlight effect',
    'Status quo bias',
    'Sunk cost fallacy',
    'Third-person effect',
    'Von Restorff effect',
    'Zeigarnik effect'
  ],
  computerScience: [
    'Hoare logic',
    'Curry-Howard correspondence',
    'Kleene star',
    'Kripke model',
    'Scott domain',
    'Game semantics',
    'Process calculus',
    'Parity game',
    'Trace semantics',
    'Fixed point',
    'Term rewriting',
    'Tree decomposition',
    'Constraint logic programming',
    'Abstract machine',
    'Continuation-passing style',
    'Partial evaluation',
    'Alias analysis',
    'Escape analysis',
    'Program slicing',
    'Symbolic execution',
    'Concolic testing',
    'Invariant inference',
    'Refinement type',
    'Dependent type',
    'Linear type',
    'Session type',
    'Effect system',
    'Gradual typing',
    'Denotational semantics',
    'Operational semantics',
    'Abstract interpretation',
    'Data-flow analysis',
    'Memory model',
    'Cache-oblivious algorithm',
    'Content-addressable storage',
    'Merkle tree',
    'Skip list',
    'Bloom filter',
    'Cuckoo hashing',
    'Consistent hashing',
    'Persistent vector',
    'Lazy evaluation',
    'Graph reduction',
    'Supercompilation',
    'Structural recursion',
    'Model checking',
    'Pi calculus',
    'Buchi automaton'
  ],
  astronomy: [
    'Oort cloud',
    'Kuiper belt',
    'Asteroid belt',
    'Solar wind',
    'Cosmic rays',
    'Dark matter',
    'Dark energy',
    'Neutron star',
    'Pulsar wind',
    'Binary star',
    'White dwarf',
    'Red giant',
    'Blue straggler',
    'Brown dwarf',
    'Accretion disk',
    'Debris disk',
    'Protoplanetary disk',
    'Planetary nebula',
    'Emission nebula',
    'Reflection nebula',
    'Molecular cloud',
    'Interstellar medium',
    'Cosmic microwave background',
    'Stellar nursery',
    'Tidal locking',
    'Roche limit',
    'Gravitational lensing',
    'Microlensing event',
    'Einstein ring',
    'Transit method',
    'Radial velocity',
    'Doppler shift',
    'Proper motion',
    'Escape velocity',
    'Event horizon',
    'Hawking radiation',
    'Spectral class',
    'Luminosity class',
    'Habitable zone'
  ],
  latinAnimals: [
    'Ailurus fulgens',
    'Aotus nigriceps',
    'Bassariscus astutus',
    'Cebus capucinus',
    'Civettictis civetta',
    'Cricetomys gambianus',
    'Dipodomys deserti',
    'Eira barbara',
    'Eudyptes chrysocome',
    'Galidia elegans',
    'Galeopterus variegatus',
    'Giraffa camelopardalis',
    'Hyaena brunnea',
    'Ichneumia albicauda',
    'Indri indri',
    'Lagothrix lagotricha',
    'Lepilemur mustelinus',
    'Loris tardigradus',
    'Lycaon pictus',
    'Macropus giganteus',
    'Manis javanica',
    'Mellivora capensis',
    'Mungos mungo',
    'Nandinia binotata',
    'Nanger granti',
    'Odobenus rosmarus',
    'Okapia johnstoni',
    'Potos flavus',
    'Prionailurus viverrinus',
    'Pteropus vampyrus',
    'Rhinopithecus roxellana',
    'Saimiri sciureus',
    'Saiga tatarica',
    'Smutsia gigantea',
    'Suricata suricatta',
    'Tapirus indicus',
    'Tarsius syrichta',
    'Ursus maritimus',
    'Varecia variegata',
    'Xerus inauris'
  ],
  instruments: [
    'Glass harmonica',
    'Musical saw',
    'Jaw harp',
    'Handpan',
    'Tongue drum',
    'Frame drum',
    'Barrel drum',
    'Slit drum',
    'Talking drum',
    'Steelpan',
    'Nose flute',
    'End-blown flute',
    'Pan flute',
    'Reed organ',
    'Pipe organ',
    'Pump organ',
    'Hammered dulcimer',
    'Bowed psaltery',
    'Hurdy-gurdy',
    'Wheel fiddle',
    'Keyed fiddle',
    'Spike fiddle',
    'Box zither',
    'Stick zither',
    'Bamboo zither',
    'Tube zither',
    'Lap steel guitar',
    'Pedal steel guitar',
    'Slide guitar',
    'Resonator guitar',
    'Bowed lyre',
    'Bridge lyre',
    'Bowl lyre',
    'Harp lute',
    'Lute guitar',
    'Bass clarinet',
    'Contrabass clarinet',
    'Octave mandolin',
    'Tenor guitar',
    'Bass trumpet',
    'Valve trombone',
    'Soprano saxophone',
    'Baritone saxophone',
    'Bass recorder',
    'Tenor recorder',
    'Alto recorder'
  ],
  mathTerms: [
    'Cantor set',
    'Cauchy sequence',
    'Dirichlet kernel',
    'Fermat point',
    'Fibonacci sequence',
    'Haar measure',
    'Hilbert curve',
    'Klein bottle',
    'Lebesgue measure',
    'Liouville number',
    'Markov chain',
    'Mobius strip',
    'Noether theorem',
    'Pell equation',
    'Prime number',
    'Riemann sphere',
    'Riemann sum',
    'Spectral theorem',
    'Taylor series',
    'Turing machine',
    'Zorn lemma',
    'Jordan curve',
    'Gaussian prime',
    'Fermat spiral',
    'Heine theorem',
    'Bernoulli number',
    'Catalan number',
    'Euler characteristic',
    'Morse theory',
    'Manifold theory',
    'Measure space',
    'Limit point',
    'Residue theorem',
    'Poisson kernel',
    'Borel set',
    'Sigma algebra',
    'Metric space',
    'Vector space',
    'Affine space',
    'Projective space',
    'Simplex method',
    'Lagrange multiplier',
    'Eigenvalue problem',
    'Convex hull',
    'Graph coloring',
    'Random walk',
    'Generating function',
    'Modular form',
    'Elliptic curve',
    'Normal subgroup',
    'Group action',
    'Ring homomorphism',
    'Field extension'
  ]
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeSpaces(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeForCompare(value) {
  return normalizeSpaces(value).toLowerCase().replace(/[^a-z0-9\s]/g, '');
}

function toAscii(value) {
  return value.normalize('NFKD').replace(/[^\x00-\x7F]/g, '');
}

function countWords(value) {
  return normalizeSpaces(value).split(/\s+/).filter(Boolean).length;
}

function hasAdjacentDuplicateWord(value) {
  const words = normalizeForCompare(value).split(/\s+/).filter(Boolean);
  for (let i = 1; i < words.length; i += 1) {
    if (words[i] === words[i - 1]) return true;
  }
  return false;
}

function hasAbbreviationToken(value) {
  const tokens = value.split(/\s+/).filter(Boolean);
  return tokens.some((token) => token.includes('.') || /^[A-Z]{2,}$/.test(token));
}

function topicStopwords(topic) {
  switch (topic) {
    case 'recipes':
      return ['cuisine', 'foods', 'food', 'gastronomy', 'list of', 'history of'];
    case 'latinAnimals':
      return ['family', 'order', 'genus', 'species'];
    case 'computerScience':
      return ['programming language', 'list of', 'history of'];
    case 'astronomy':
      return ['list of', 'history of', 'astronomy'];
    case 'mathTerms':
      return ['list of', 'history of', 'mathematics'];
    default:
      return ['list of', 'history of'];
  }
}

function isBlockedTitleForTopic(title, topic) {
  const normalized = normalizeForCompare(title);
  return topicStopwords(topic).some((word) => normalized.includes(word));
}

function isStrictLatinBinomial(tokens) {
  return (
    tokens.length >= 2 &&
    /^[A-Z][a-z]+$/.test(tokens[0]) &&
    /^[a-z]+$/.test(tokens[1])
  );
}

function isValidExpression(expression) {
  if (!/^[\x20-\x7E]+$/.test(expression)) return false;
  const chars = expression.length;
  const words = countWords(expression);
  if (chars > 25) return false;
  if (words < 2 || words > 4) return false;
  if (hasAbbreviationToken(expression)) return false;
  if (hasAdjacentDuplicateWord(expression)) return false;
  return true;
}

function isValidBlurb(blurb) {
  if (!/^[\x20-\x7E]+$/.test(blurb)) return false;
  if (blurb.length < PARAGRAPH_MIN_CHARS || blurb.length > PARAGRAPH_MAX_CHARS) return false;
  const words = countWords(blurb);
  if (words < 45 || words > 120) return false;
  if (hasAdjacentDuplicateWord(blurb)) return false;
  return true;
}

function fitExpression(title, topic) {
  if (isBlockedTitleForTopic(title, topic)) return null;
  const cleaned = normalizeSpaces(
    toAscii(title)
      .replace(/\([^)]*\)/g, '')
      .replace(/[^A-Za-z\s-]/g, ' ')
      .replace(/-/g, ' ')
  );
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  if (words.length < 2 || words.length > 4) return null;
  const fullExpression = words.join(' ');
  if (!isValidExpression(fullExpression)) return null;

  if (topic === 'latinAnimals' && !isStrictLatinBinomial(words)) {
    return null;
  }
  if (topic === 'recipes') {
    const lower = fullExpression.toLowerCase();
    if (lower.includes('cuisine')) return null;
    const dishSignals = [
      'noodle',
      'stew',
      'soup',
      'dumpling',
      'curry',
      'taco',
      'tamal',
      'ceviche',
      'arepa',
      'adobo',
      'ramen',
      'pho',
      'kimchi',
      'pasta',
      'rice',
      'teh',
      'laksa',
      'rendang',
      'moqueca',
      'fesenjan',
      'kottu',
      'aushak',
      'mantu',
      'tam',
      'cha'
    ];
    const hasDishSignal = dishSignals.some((signal) => lower.includes(signal));
    if (!hasDishSignal) return null;
  }
  if (topic === 'astronomy') {
    const lower = fullExpression.toLowerCase();
    const astronomySignals = [
      'cloud',
      'belt',
      'wind',
      'star',
      'dwarf',
      'disk',
      'nebula',
      'medium',
      'locking',
      'limit',
      'lensing',
      'event',
      'ring',
      'method',
      'velocity',
      'shift',
      'motion',
      'horizon',
      'radiation',
      'zone',
      'class'
    ];
    if (!astronomySignals.some((signal) => lower.includes(signal))) return null;
  }
  if (topic === 'computerScience') {
    const lower = fullExpression.toLowerCase();
    const csSignals = [
      'type',
      'semantics',
      'calculus',
      'analysis',
      'execution',
      'checking',
      'filter',
      'hash',
      'tree',
      'model',
      'machine',
      'interpretation',
      'evaluation',
      'recursion',
      'logic',
      'domain',
      'proof',
      'point'
    ];
    if (!csSignals.some((signal) => lower.includes(signal))) return null;
  }
  if (topic === 'mathematics' || topic === 'mathTerms') {
    const lower = fullExpression.toLowerCase();
    const mathSignals = [
      'paradox',
      'sequence',
      'kernel',
      'point',
      'curve',
      'measure',
      'number',
      'chain',
      'strip',
      'theorem',
      'equation',
      'principle',
      'sum',
      'series',
      'lemma',
      'set',
      'bottle',
      'sphere'
    ];
    if (!mathSignals.some((signal) => lower.includes(signal))) return null;
  }
  return fullExpression;
}

function cleanExtract(extract) {
  return normalizeSpaces(
    toAscii(extract || '')
      .replace(/\[[^\]]*\]/g, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/[^A-Za-z0-9,.;:!?'"()\s-]/g, ' ')
  );
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => normalizeSpaces(sentence))
    .filter((sentence) => countWords(sentence) >= 6);
}

function paragraphStats(text) {
  return {
    words: countWords(text),
    hasDigit: /\d/.test(text)
  };
}

function buildParagraphCandidates(sentences) {
  const candidates = [];
  for (let start = 0; start < sentences.length; start += 1) {
    for (let take = 2; take <= 8; take += 1) {
      if (start + take > sentences.length) continue;
      const chunk = sentences.slice(start, start + take).join(' ');
      const normalized = normalizeSpaces(chunk);
      const { words } = paragraphStats(normalized);
      if (words >= 45 && words <= 120 && isValidBlurb(normalized)) {
        candidates.push({
          text: normalized,
          start,
          end: start + take - 1,
          hasDigit: /\d/.test(normalized)
        });
      }
    }
  }
  return candidates;
}

function overlaps(left, right) {
  return !(left.end < right.start || right.end < left.start);
}

function pickFourDistinctParagraphs(candidates) {
  if (candidates.length < 4) return null;
  const sorted = [...candidates].sort((a, b) => {
    const byDigit = Number(b.hasDigit) - Number(a.hasDigit);
    if (byDigit !== 0) return byDigit;
    const byLength = countWords(a.text) - countWords(b.text);
    return byLength;
  });

  const selected = [];
  for (const candidate of sorted) {
    if (selected.length >= 4) break;
    if (selected.some((existing) => overlaps(existing, candidate))) continue;
    selected.push(candidate);
  }

  if (selected.length < 4) {
    for (const candidate of sorted) {
      if (selected.length >= 4) break;
      if (selected.some((existing) => normalizeForCompare(existing.text) === normalizeForCompare(candidate.text))) {
        continue;
      }
      selected.push(candidate);
    }
  }

  if (selected.length < 4) return null;
  const paragraphs = selected.slice(0, 4).map((item) => item.text);
  const uniqueCount = new Set(paragraphs.map((paragraph) => normalizeForCompare(paragraph))).size;
  if (uniqueCount !== 4) return null;
  return paragraphs;
}

function buildParagraphs(extract) {
  const cleaned = cleanExtract(extract);
  if (!cleaned) return null;
  const sentences = splitSentences(cleaned);
  if (sentences.length < 6) return null;
  const candidates = buildParagraphCandidates(sentences);
  return pickFourDistinctParagraphs(candidates);
}

function slugify(value) {
  return normalizeForCompare(value).replace(/\s+/g, '-');
}

async function loadCache() {
  try {
    const raw = await fs.readFile(CACHE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      searchResults: parsed.searchResults || {},
      extractByTitle: parsed.extractByTitle || {}
    };
  } catch {
    return { searchResults: {}, extractByTitle: {} };
  }
}

async function saveCache(cache) {
  await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await fs.writeFile(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
}

let lastRequestAt = 0;
async function pace() {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_DELAY_MS) {
    await sleep(MIN_DELAY_MS - elapsed);
  }
  lastRequestAt = Date.now();
}

async function fetchJson(url, { retries = 6 } = {}) {
  let attempt = 0;
  while (true) {
    await pace();
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json'
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });

    if (res.ok) {
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('json')) return null;
      return res.json();
    }

    if ([429, 503, 502, 504].includes(res.status) && attempt < retries) {
      const ra = res.headers.get('retry-after');
      const retryAfterMs = ra && Number(ra) > 0 ? Number(ra) * 1000 : 0;
      const backoff = Math.min(30000, 750 * 2 ** attempt);
      const jitter = Math.floor(Math.random() * 300);
      const waitMs = Math.max(retryAfterMs, backoff + jitter);
      await sleep(waitMs);
      attempt += 1;
      continue;
    }

    return null;
  }
}

async function wikiSearch(query, offset) {
  const url = new URL(API);
  url.searchParams.set('action', 'query');
  url.searchParams.set('list', 'search');
  url.searchParams.set('srsearch', query);
  url.searchParams.set('srlimit', String(SEARCH_LIMIT));
  url.searchParams.set('sroffset', String(offset));
  url.searchParams.set('format', 'json');
  url.searchParams.set('utf8', '1');
  url.searchParams.set('origin', '*');
  const json = await fetchJson(url.toString());
  const hits = json?.query?.search || [];
  return hits.map((hit) => hit.title).filter(Boolean);
}

async function wikiExtract(title) {
  const url = new URL(API);
  url.searchParams.set('action', 'query');
  url.searchParams.set('prop', 'extracts');
  url.searchParams.set('explaintext', '1');
  url.searchParams.set('titles', title);
  url.searchParams.set('format', 'json');
  url.searchParams.set('utf8', '1');
  url.searchParams.set('origin', '*');
  const json = await fetchJson(url.toString());
  const pages = json?.query?.pages || {};
  const page = Object.values(pages)[0];
  return page?.extract || '';
}

async function buildEntries() {
  const cache = await loadCache();
  const entries = [];
  const seenExpressionsByTopic = new Map();
  const seenParagraphsByTopic = new Map();

  for (const [topic, queries] of Object.entries(TOPIC_QUERIES)) {
    const topicEntries = [];
    const candidateTitles = new Set();
    const seenExpressions = seenExpressionsByTopic.get(topic) || new Set();
    const seenParagraphs = seenParagraphsByTopic.get(topic) || new Set();
    seenExpressionsByTopic.set(topic, seenExpressions);
    seenParagraphsByTopic.set(topic, seenParagraphs);
    const seedTitles = TOPIC_SEED_TITLES[topic] || [];
    seedTitles.forEach((title) => candidateTitles.add(title));

    for (const query of queries) {
      for (const offset of SEARCH_OFFSETS) {
        const cacheKey = `${query}::${offset}`;
        let titles = cache.searchResults[cacheKey];
        if (!titles) {
          titles = await wikiSearch(query, offset);
          cache.searchResults[cacheKey] = titles;
        }
        titles.forEach((title) => candidateTitles.add(title));
      }
    }

    const titles = [...candidateTitles];
    console.log(
      `[semantic-lorem] Topic "${topic}" has ${titles.length} candidate titles (target ${TARGET_PER_TOPIC})`
    );

    for (const title of titles) {
      if (topicEntries.length >= TARGET_PER_TOPIC) break;

      const expression = fitExpression(title, topic);
      if (!expression) continue;
      const expressionKey = normalizeForCompare(expression);
      if (seenExpressions.has(expressionKey)) continue;

      let extract = cache.extractByTitle[title];
      if (!extract) {
        extract = await wikiExtract(title);
        cache.extractByTitle[title] = extract || '';
      }
      if (!extract) continue;

      const paragraphs = buildParagraphs(extract);
      if (!paragraphs) continue;

      const paragraphKeys = paragraphs.map((p) => normalizeForCompare(p));
      if (paragraphKeys.some((key) => seenParagraphs.has(key))) continue;

      paragraphKeys.forEach((key) => seenParagraphs.add(key));
      seenExpressions.add(expressionKey);

      const entry = {
        id: `${topic}-${slugify(title)}`,
        topic,
        expression,
        blurb: paragraphs[0],
        paragraphs
      };
      topicEntries.push(entry);
      entries.push(entry);

      if (topicEntries.length % 10 === 0) {
        console.log(`[semantic-lorem] Topic "${topic}" progress ${topicEntries.length}/${TARGET_PER_TOPIC}`);
      }
    }

    if (topicEntries.length < TARGET_PER_TOPIC) {
      await saveCache(cache);
      throw new Error(
        `[semantic-lorem] Topic "${topic}" produced ${topicEntries.length}/${TARGET_PER_TOPIC} entries.`
      );
    }
  }

  await saveCache(cache);
  return entries;
}

async function run() {
  console.log('[semantic-lorem] Refreshing Wikipedia semantic dataset...');
  const entries = await buildEntries();
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
  console.log(`[semantic-lorem] Wrote ${entries.length} wiki entries to ${OUTPUT_PATH}`);
}

run().catch((error) => {
  console.error('[semantic-lorem] Refresh failed:', error);
  process.exit(1);
});
