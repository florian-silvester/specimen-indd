import semanticEntriesRaw from '../core/semantic-term-bank.json';
import latinEntriesRaw from '../core/latin-term-bank.json';

type TermBankEntry = {
  id: string;
  bucket: string;
  expression: string;
  description: string;
};

type ActiveTermPack = {
  id: string;
  bucket: string;
  expression: string;
  description: string;
};

export type TermBankId = 'semantic' | 'latin';

function validateEntries(raw: unknown): TermBankEntry[] {
  if (!Array.isArray(raw)) return [];
  return (raw as TermBankEntry[]).filter((entry) =>
    Boolean(entry?.id && entry?.bucket && entry?.expression && entry?.description) &&
    entry.expression.trim().split(/\s+/).length >= 2
  );
}

const banks: Record<TermBankId, TermBankEntry[]> = {
  semantic: validateEntries(semanticEntriesRaw),
  latin: validateEntries(latinEntriesRaw),
};

let activeBankId: TermBankId = 'latin';

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

let flatQueue: number[] = [];
let queueCursor = 0;
let currentPack: ActiveTermPack | null = null;

function ensureQueue() {
  const entries = banks[activeBankId];
  if (flatQueue.length === 0 || queueCursor >= flatQueue.length) {
    flatQueue = shuffle(Array.from({ length: entries.length }, (_, i) => i));
    queueCursor = 0;
  }
}

export function setActiveTermBank(bankId: TermBankId): void {
  if (bankId === activeBankId) return;
  activeBankId = bankId;
  flatQueue = [];
  queueCursor = 0;
  currentPack = null;
}

export function getActiveTermBank(): TermBankId {
  return activeBankId;
}

export function rotateTermBankPack(): ActiveTermPack {
  const termBankEntries = banks[activeBankId];

  if (termBankEntries.length === 0) {
    currentPack = {
      id: 'fallback-empty-pack',
      bucket: 'fallback',
      expression: 'Semantic fallback',
      description:
        'Semantic fallback content is active because the term bank source is empty. Add bullet terms in the term bank file, rebuild the term bank JSON, and rotate again to load rich descriptions for play mode.'
    };
    return currentPack;
  }

  ensureQueue();
  const entry = termBankEntries[flatQueue[queueCursor]];
  queueCursor += 1;

  currentPack = {
    id: entry.id,
    bucket: entry.bucket,
    expression: entry.expression,
    description: entry.description
  };
  return currentPack;
}

export function getCurrentTermBankPack(): ActiveTermPack {
  return currentPack || rotateTermBankPack();
}
