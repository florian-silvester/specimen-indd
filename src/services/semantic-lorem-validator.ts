export const SEMANTIC_TOPICS = [
  'recipes',
  'mathematics',
  'psychology',
  'computerScience',
  'astronomy',
  'latinAnimals',
  'instruments',
  'mathTerms'
] as const;

export type SemanticTopic = (typeof SEMANTIC_TOPICS)[number];

export interface SemanticLoremEntry {
  id: string;
  topic: SemanticTopic;
  expression: string;
  blurb: string;
  paragraphs?: string[];
}

export interface SemanticValidationResult {
  isValid: boolean;
  entries: SemanticLoremEntry[];
  errors: string[];
}

const TOPIC_SET = new Set<string>(SEMANTIC_TOPICS);
const PARAGRAPH_MIN_CHARS = 300;
const PARAGRAPH_MAX_CHARS = 420;

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeForCompare(value: string): string {
  return normalizeSpaces(value).toLowerCase().replace(/[^a-z0-9\s]/g, '');
}

function hasAdjacentDuplicateWord(value: string): boolean {
  const words = normalizeForCompare(value).split(/\s+/).filter(Boolean);
  for (let i = 1; i < words.length; i += 1) {
    if (words[i] === words[i - 1]) return true;
  }
  return false;
}

function hasAbbreviationToken(value: string): boolean {
  const tokens = value.split(/\s+/).filter(Boolean);
  return tokens.some((token) => /[.]/.test(token) || /^[A-Z]{2,}$/.test(token));
}

function jaccardSimilarity(left: string, right: string): number {
  const leftSet = new Set(normalizeForCompare(left).split(/\s+/).filter(Boolean));
  const rightSet = new Set(normalizeForCompare(right).split(/\s+/).filter(Boolean));
  if (leftSet.size === 0 || rightSet.size === 0) return 0;

  let intersection = 0;
  leftSet.forEach((word) => {
    if (rightSet.has(word)) intersection += 1;
  });

  const union = leftSet.size + rightSet.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function validateSemanticLoremEntries(
  rawEntries: unknown,
  opts?: { requireAllTopics?: boolean; context?: string }
): SemanticValidationResult {
  const requireAllTopics = opts?.requireAllTopics ?? false;
  const context = opts?.context ?? 'semantic-lorem';
  const enforceCharWindow = context.includes('wiki');
  const minBlurbWords = context.includes('wiki') ? 45 : 30;
  const maxBlurbWords = 120;
  const errors: string[] = [];
  const entries: SemanticLoremEntry[] = [];

  if (!Array.isArray(rawEntries)) {
    return {
      isValid: false,
      entries,
      errors: [`[${context}] Dataset must be an array.`]
    };
  }

  rawEntries.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      errors.push(`[${context}] Entry ${index} is not an object.`);
      return;
    }

    const maybe = entry as Partial<SemanticLoremEntry>;
    const id = normalizeSpaces(String(maybe.id ?? ''));
    const topic = String(maybe.topic ?? '');
    const expression = normalizeSpaces(String(maybe.expression ?? ''));
    const blurb = normalizeSpaces(String(maybe.blurb ?? ''));
    const paragraphsRaw = Array.isArray((entry as any).paragraphs) ? (entry as any).paragraphs : undefined;
    const paragraphs: string[] | undefined =
      paragraphsRaw?.map((paragraph: unknown) => normalizeSpaces(String(paragraph ?? ''))) ?? undefined;

    if (!id) errors.push(`[${context}] Entry ${index} has empty id.`);
    if (!TOPIC_SET.has(topic)) {
      errors.push(`[${context}] Entry ${id || index} has invalid topic "${topic}".`);
    }

    if (!/^[\x20-\x7E]+$/.test(expression)) {
      errors.push(`[${context}] Entry ${id || index} expression must be ASCII only.`);
    }
    if (expression.length > 25) {
      errors.push(`[${context}] Entry ${id || index} expression must be <= 25 chars (got ${expression.length}).`);
    }
    const expressionWords = countWords(expression);
    if (expressionWords < 2 || expressionWords > 4) {
      errors.push(`[${context}] Entry ${id || index} expression must have 2-4 words (got ${expressionWords}).`);
    }
    if (hasAbbreviationToken(expression)) {
      errors.push(`[${context}] Entry ${id || index} expression contains abbreviation-like tokens.`);
    }
    if (hasAdjacentDuplicateWord(expression)) {
      errors.push(`[${context}] Entry ${id || index} expression has adjacent repeated words.`);
    }
    if (topic === 'latinAnimals') {
      const latinTokens = expression.split(/\s+/).filter(Boolean);
      const hasValidBinomial =
        latinTokens.length >= 2 &&
        /^[A-Z][a-z]+$/.test(latinTokens[0]) &&
        /^[a-z]+$/.test(latinTokens[1]);
      if (!hasValidBinomial) {
        errors.push(
          `[${context}] Entry ${id || index} latinAnimals expression must start with strict binomial name (Genus species).`
        );
      }
    }
    if (topic === 'recipes') {
      if (/\bcuisine\b/i.test(expression)) {
        errors.push(`[${context}] Entry ${id || index} recipes expression must be explicit dish, not cuisine label.`);
      }
    }

    if (!/^[\x20-\x7E]+$/.test(blurb)) {
      errors.push(`[${context}] Entry ${id || index} blurb must be ASCII only.`);
    }
    if (enforceCharWindow && (blurb.length < PARAGRAPH_MIN_CHARS || blurb.length > PARAGRAPH_MAX_CHARS)) {
      errors.push(
        `[${context}] Entry ${id || index} blurb must be ${PARAGRAPH_MIN_CHARS}-${PARAGRAPH_MAX_CHARS} chars (got ${blurb.length}).`
      );
    }
    const blurbWords = countWords(blurb);
    if (blurbWords < minBlurbWords || blurbWords > maxBlurbWords) {
      errors.push(
        `[${context}] Entry ${id || index} blurb must have ${minBlurbWords}-${maxBlurbWords} words (got ${blurbWords}).`
      );
    }
    if (hasAdjacentDuplicateWord(blurb)) {
      errors.push(`[${context}] Entry ${id || index} blurb has adjacent repeated words.`);
    }

    if (paragraphs) {
      if (paragraphs.length !== 4) {
        errors.push(`[${context}] Entry ${id || index} must have exactly 4 paragraphs when provided (got ${paragraphs.length}).`);
      }
      paragraphs.forEach((paragraph: string, paragraphIndex: number) => {
        if (!/^[\x20-\x7E]+$/.test(paragraph)) {
          errors.push(`[${context}] Entry ${id || index} paragraph ${paragraphIndex} must be ASCII only.`);
        }
        if (enforceCharWindow && (paragraph.length < PARAGRAPH_MIN_CHARS || paragraph.length > PARAGRAPH_MAX_CHARS)) {
          errors.push(
            `[${context}] Entry ${id || index} paragraph ${paragraphIndex} must be ${PARAGRAPH_MIN_CHARS}-${PARAGRAPH_MAX_CHARS} chars (got ${paragraph.length}).`
          );
        }
        const paragraphWords = countWords(paragraph);
        if (paragraphWords < 45 || paragraphWords > 120) {
          errors.push(
            `[${context}] Entry ${id || index} paragraph ${paragraphIndex} must have 45-120 words (got ${paragraphWords}).`
          );
        }
        if (hasAdjacentDuplicateWord(paragraph)) {
          errors.push(`[${context}] Entry ${id || index} paragraph ${paragraphIndex} has adjacent repeated words.`);
        }
      });

      const paragraphUniqueCount = new Set(paragraphs.map((paragraph: string) => normalizeForCompare(paragraph))).size;
      if (paragraphUniqueCount !== paragraphs.length) {
        errors.push(`[${context}] Entry ${id || index} paragraphs must be unique.`);
      }
    }

    entries.push({
      id,
      topic: topic as SemanticTopic,
      expression,
      blurb,
      paragraphs
    });
  });

  const byId = new Map<string, number>();
  const byExpression = new Map<string, number>();
  const byBlurb = new Map<string, number>();

  entries.forEach((entry, index) => {
    const expressionKey = normalizeForCompare(entry.expression);
    const blurbKey = normalizeForCompare(entry.blurb);

    if (byId.has(entry.id)) {
      errors.push(`[${context}] Duplicate id "${entry.id}" at entries ${byId.get(entry.id)} and ${index}.`);
    } else {
      byId.set(entry.id, index);
    }

    if (byExpression.has(expressionKey)) {
      errors.push(
        `[${context}] Duplicate expression "${entry.expression}" at entries ${byExpression.get(expressionKey)} and ${index}.`
      );
    } else {
      byExpression.set(expressionKey, index);
    }

    if (byBlurb.has(blurbKey)) {
      errors.push(`[${context}] Duplicate blurb detected at entries ${byBlurb.get(blurbKey)} and ${index}.`);
    } else {
      byBlurb.set(blurbKey, index);
    }
  });

  // Light near-duplicate check to keep blurbs diverse.
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const similarity = jaccardSimilarity(entries[i].blurb, entries[j].blurb);
      if (similarity >= 0.72) {
        errors.push(
          `[${context}] Blurblexical overlap too high between "${entries[i].id}" and "${entries[j].id}" (${similarity.toFixed(2)}).`
        );
      }
    }
  }

  if (requireAllTopics) {
    SEMANTIC_TOPICS.forEach((topic) => {
      const count = entries.filter((entry) => entry.topic === topic).length;
      if (count === 0) {
        errors.push(`[${context}] Missing required topic "${topic}".`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    entries,
    errors
  };
}
