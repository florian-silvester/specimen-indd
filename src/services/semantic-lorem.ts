import { STYLE_KEYS } from '../core/constants';
import fallbackEntriesRaw from '../core/semantic-lorem-fallback.json';
import wikiEntriesRaw from '../core/semantic-lorem-wiki.json';
import {
  SemanticLoremEntry,
  SemanticTopic,
  SEMANTIC_TOPICS,
  validateSemanticLoremEntries
} from './semantic-lorem-validator';

type TextStyleKey = typeof STYLE_KEYS.TEXT_LARGE | typeof STYLE_KEYS.TEXT_MAIN | typeof STYLE_KEYS.TEXT_SMALL | typeof STYLE_KEYS.MICRO;

const STYLE_TOPIC_MAP: Record<TextStyleKey, SemanticTopic> = {
  [STYLE_KEYS.TEXT_LARGE]: 'mathematics',
  [STYLE_KEYS.TEXT_MAIN]: 'psychology',
  [STYLE_KEYS.TEXT_SMALL]: 'computerScience',
  [STYLE_KEYS.MICRO]: 'latinAnimals'
};

const TOPIC_SEQUENCE: SemanticTopic[] = [...SEMANTIC_TOPICS];
let topicCycleOrder: SemanticTopic[] = [];
let topicCursor = 0;
const TEXT_STYLE_ORDER: TextStyleKey[] = [
  STYLE_KEYS.TEXT_LARGE,
  STYLE_KEYS.TEXT_MAIN,
  STYLE_KEYS.TEXT_SMALL,
  STYLE_KEYS.MICRO
];
const RECENT_TERM_COOLDOWN = 16;
const recentTermIds: string[] = [];

type TopicState = {
  order: number[];
  cursor: number;
  lastId?: string;
};

function shuffleIndices(count: number): number[] {
  const arr = Array.from({ length: count }, (_, idx) => idx);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function hasAtLeastOnePerTopic(entries: SemanticLoremEntry[]): boolean {
  return SEMANTIC_TOPICS.every((topic) => entries.some((entry) => entry.topic === topic));
}

function isOverlapOnlyValidationFailure(errors: string[]): boolean {
  return errors.length > 0 && errors.every((error) => error.includes('Blurblexical overlap too high'));
}

function chooseActiveEntries(): SemanticLoremEntry[] {
  const fallbackValidation = validateSemanticLoremEntries(fallbackEntriesRaw, {
    requireAllTopics: false,
    context: 'semantic-lorem-fallback'
  });

  if (!fallbackValidation.isValid) {
    console.warn(
      `[semantic-lorem] Fallback dataset has validation warnings:\n${fallbackValidation.errors.join('\n')}`
    );
  }

  const wikiValidation = validateSemanticLoremEntries(wikiEntriesRaw, {
    requireAllTopics: false,
    context: 'semantic-lorem-wiki'
  });

  if (wikiValidation.isValid && wikiValidation.entries.length > 0 && hasAtLeastOnePerTopic(wikiValidation.entries)) {
    console.log(`[semantic-lorem] Using wiki dataset (${wikiValidation.entries.length} entries).`);
    return wikiValidation.entries;
  }

  if (
    wikiValidation.entries.length > 0 &&
    hasAtLeastOnePerTopic(wikiValidation.entries) &&
    isOverlapOnlyValidationFailure(wikiValidation.errors)
  ) {
    console.warn(
      `[semantic-lorem] Using wiki dataset (${wikiValidation.entries.length} entries) with overlap warnings (${wikiValidation.errors.length}).`
    );
    return wikiValidation.entries;
  }

  if (wikiValidation.entries.length > 0 && !wikiValidation.isValid) {
    console.warn('[semantic-lorem] Wiki dataset rejected due to non-overlap validation errors, falling back to curated dataset.');
    console.warn(`[semantic-lorem] Wiki validation errors (${wikiValidation.errors.length}):\n${wikiValidation.errors.join('\n')}`);
  }

  console.log(`[semantic-lorem] Using curated fallback dataset (${fallbackValidation.entries.length} entries).`);
  return fallbackValidation.entries;
}

const ACTIVE_ENTRIES = chooseActiveEntries();
const ENTRIES_BY_TOPIC = new Map<SemanticTopic, SemanticLoremEntry[]>();
const TOPIC_STATE = new Map<SemanticTopic, TopicState>();

SEMANTIC_TOPICS.forEach((topic) => {
  const topicEntries = ACTIVE_ENTRIES.filter((entry) => entry.topic === topic);
  ENTRIES_BY_TOPIC.set(topic, topicEntries);
  TOPIC_STATE.set(topic, {
    order: shuffleIndices(topicEntries.length),
    cursor: 0
  });
});

function ensureTopicState(topic: SemanticTopic, entries: SemanticLoremEntry[]): TopicState {
  const existing = TOPIC_STATE.get(topic);
  if (existing && existing.order.length === entries.length) {
    return existing;
  }

  const state: TopicState = {
    order: shuffleIndices(entries.length),
    cursor: 0
  };
  TOPIC_STATE.set(topic, state);
  return state;
}

function nextTopic(): SemanticTopic {
  if (topicCycleOrder.length === 0 || topicCursor >= topicCycleOrder.length) {
    topicCycleOrder = [...TOPIC_SEQUENCE];
    for (let i = topicCycleOrder.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = topicCycleOrder[i];
      topicCycleOrder[i] = topicCycleOrder[j];
      topicCycleOrder[j] = tmp;
    }
    topicCursor = 0;
  }
  const topic = topicCycleOrder[topicCursor];
  topicCursor += 1;
  return topic;
}

function buildParagraphSet(entry: SemanticLoremEntry): Record<TextStyleKey, string> {
  const provided = Array.isArray(entry.paragraphs) ? entry.paragraphs.filter(Boolean) : [];
  if (provided.length >= 4) {
    return {
      [STYLE_KEYS.TEXT_LARGE]: provided[0],
      [STYLE_KEYS.TEXT_MAIN]: provided[1],
      [STYLE_KEYS.TEXT_SMALL]: provided[2],
      [STYLE_KEYS.MICRO]: provided[3]
    };
  }

  // Fallback dataset compatibility path: keep full sentence text and avoid injected prefixes.
  const base = entry.blurb;
  return {
    [STYLE_KEYS.TEXT_LARGE]: base,
    [STYLE_KEYS.TEXT_MAIN]: base,
    [STYLE_KEYS.TEXT_SMALL]: base,
    [STYLE_KEYS.MICRO]: base
  };
}

function pickEntryForTopic(topic: SemanticTopic): SemanticLoremEntry {
  const entries = ENTRIES_BY_TOPIC.get(topic) || [];
  if (entries.length === 0) {
    const fallback = ACTIVE_ENTRIES[Math.floor(Math.random() * ACTIVE_ENTRIES.length)];
    return fallback;
  }

  const state = ensureTopicState(topic, entries);
  if (state.cursor >= state.order.length) {
    state.order = shuffleIndices(entries.length);
    state.cursor = 0;
  }

  let selected: SemanticLoremEntry | undefined;
  const maxAttempts = Math.max(entries.length * 2, 8);
  let attempts = 0;
  while (!selected && attempts < maxAttempts) {
    if (state.cursor >= state.order.length) {
      state.order = shuffleIndices(entries.length);
      state.cursor = 0;
    }
    const candidate = entries[state.order[state.cursor]];
    state.cursor += 1;
    attempts += 1;
    const blockedByLast = Boolean(state.lastId && candidate.id === state.lastId);
    const blockedByRecent = recentTermIds.includes(candidate.id);
    if (!blockedByLast && !blockedByRecent) {
      selected = candidate;
    }
  }

  if (!selected) {
    selected = entries.find((entry) => entry.id !== state.lastId) || entries[0];
  }

  state.lastId = selected.id;
  recentTermIds.push(selected.id);
  while (recentTermIds.length > Math.min(RECENT_TERM_COOLDOWN, ACTIVE_ENTRIES.length - 1)) {
    recentTermIds.shift();
  }
  return selected;
}

type ActivePack = {
  entryId: string;
  topic: SemanticTopic;
  expression: string;
  paragraphs: Record<TextStyleKey, string>;
  sentenceCursor: number;
};

let activePack: ActivePack | null = null;

function buildPack(topic?: SemanticTopic): ActivePack {
  const selectedTopic = topic || nextTopic();
  const entry = pickEntryForTopic(selectedTopic);
  return {
    entryId: entry.id,
    topic: selectedTopic,
    expression: entry.expression,
    paragraphs: buildParagraphSet(entry),
    sentenceCursor: 0
  };
}

function ensurePack(topic?: SemanticTopic): ActivePack {
  if (!activePack) {
    activePack = buildPack(topic);
  }
  return activePack;
}

export function rotateSemanticTermPack(topic?: SemanticTopic): string {
  activePack = buildPack(topic);
  return activePack.expression;
}

export function getSemanticHeadingTerm(): string {
  return ensurePack().expression;
}

export function getSemanticParagraphForStyle(styleKey: string): string {
  const pack = ensurePack();
  const typedKey = styleKey as TextStyleKey;
  if (TEXT_STYLE_ORDER.includes(typedKey)) {
    return pack.paragraphs[typedKey];
  }
  return pack.paragraphs[TEXT_STYLE_ORDER[pack.sentenceCursor % TEXT_STYLE_ORDER.length]];
}

export function getSemanticParagraphForCurrentPack(): string {
  const pack = ensurePack();
  const key = TEXT_STYLE_ORDER[pack.sentenceCursor % TEXT_STYLE_ORDER.length];
  pack.sentenceCursor += 1;
  return pack.paragraphs[key];
}

export function getSemanticExpressionForTopic(topic?: SemanticTopic): string {
  return rotateSemanticTermPack(topic);
}

export function getSemanticBlurbForTopic(topic?: SemanticTopic): string {
  const selectedTopic = topic || nextTopic();
  activePack = buildPack(selectedTopic);
  return getSemanticParagraphForCurrentPack();
}

export function getSemanticBlurbForTextStyle(styleKey: string): string {
  const key = styleKey as TextStyleKey;
  const topic = STYLE_TOPIC_MAP[key];
  const pack = ensurePack(topic);
  return pack.paragraphs[key] || getSemanticParagraphForCurrentPack();
}

export function getSemanticExpressionForTextStyle(styleKey: string): string {
  const topic = STYLE_TOPIC_MAP[styleKey as TextStyleKey];
  return rotateSemanticTermPack(topic || nextTopic());
}
