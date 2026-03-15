import { STYLE_KEYS } from '../core/constants';

const tailwindConventionMap: { [key: string]: string } = {
  [STYLE_KEYS.DISPLAY]: 'text-7xl',
  [STYLE_KEYS.H1]: 'text-6xl',
  [STYLE_KEYS.H2]: 'text-5xl',
  [STYLE_KEYS.H3]: 'text-4xl',
  [STYLE_KEYS.H4]: 'text-3xl',
  [STYLE_KEYS.H5]: 'text-2xl',
  [STYLE_KEYS.H6]: 'text-xl',
  [STYLE_KEYS.TEXT_LARGE]: 'text-lg',
  [STYLE_KEYS.TEXT_MAIN]: 'text-base',
  [STYLE_KEYS.TEXT_SMALL]: 'text-sm',
  [STYLE_KEYS.MICRO]: 'text-xs'
};

const defaultNamingMap: { [key: string]: string } = {
  [STYLE_KEYS.DISPLAY]: 'H0',
  [STYLE_KEYS.H1]: 'H1',
  [STYLE_KEYS.H2]: 'H2',
  [STYLE_KEYS.H3]: 'H3',
  [STYLE_KEYS.H4]: 'H4',
  [STYLE_KEYS.H5]: 'H5',
  [STYLE_KEYS.H6]: 'H6',
  [STYLE_KEYS.TEXT_LARGE]: 'Text Large',
  [STYLE_KEYS.TEXT_MAIN]: 'Text Main',
  [STYLE_KEYS.TEXT_SMALL]: 'Text Small',
  [STYLE_KEYS.MICRO]: 'Text Tiny',
};

const bootstrapConventionMap: { [key: string]: string } = {
  [STYLE_KEYS.DISPLAY]: 'display-1',
  [STYLE_KEYS.H1]: 'h1',
  [STYLE_KEYS.H2]: 'h2',
  [STYLE_KEYS.H3]: 'h3',
  [STYLE_KEYS.H4]: 'h4',
  [STYLE_KEYS.H5]: 'h5',
  [STYLE_KEYS.H6]: 'h6',
  [STYLE_KEYS.TEXT_LARGE]: 'lead',
  [STYLE_KEYS.TEXT_MAIN]: 'p',
  [STYLE_KEYS.TEXT_SMALL]: 'small',
  [STYLE_KEYS.MICRO]: 'text-muted',
};

const relumeConventionMap: { [key:string]: string } = {
    [STYLE_KEYS.DISPLAY]: 'Display',
    [STYLE_KEYS.H1]: 'H1',
    [STYLE_KEYS.H2]: 'H2',
    [STYLE_KEYS.H3]: 'H3',
    [STYLE_KEYS.H4]: 'H4',
    [STYLE_KEYS.H5]: 'H5',
    [STYLE_KEYS.H6]: 'H6',
    [STYLE_KEYS.TEXT_LARGE]: 'Large',
    [STYLE_KEYS.TEXT_MAIN]: 'Regular',
    [STYLE_KEYS.TEXT_SMALL]: 'Small',
    [STYLE_KEYS.MICRO]: 'Tiny',
};

const lumosConventionMap: { [key:string]: string } = {
    [STYLE_KEYS.DISPLAY]: 'Display',
    [STYLE_KEYS.H1]: 'H1',
    [STYLE_KEYS.H2]: 'H2',
    [STYLE_KEYS.H3]: 'H3',
    [STYLE_KEYS.H4]: 'H4',
    [STYLE_KEYS.H5]: 'H5',
    [STYLE_KEYS.H6]: 'H6',
    [STYLE_KEYS.TEXT_LARGE]: 'Text Large',
    [STYLE_KEYS.TEXT_MAIN]: 'Text Main',
    [STYLE_KEYS.TEXT_SMALL]: 'Text Small',
    [STYLE_KEYS.MICRO]: 'Micro',
};

const conventionMaps: { [key: string]: { [key: string]: string } } = {
  'Default Naming': defaultNamingMap,
  'Lumos': lumosConventionMap,
  'Tailwind': tailwindConventionMap,
  'Bootstrap': bootstrapConventionMap,
  'Relume': relumeConventionMap,
};

export function getConventionName(styleName: string, convention: string): string | null {
  const map = conventionMaps[convention];
  if (map && map[styleName]) {
    return map[styleName];
  }
  return null;
}

/* ── Reverse lookup: display name → internal key ─────────────── */

const HEADING_INTERNAL_KEYS = new Set([
  STYLE_KEYS.DISPLAY,
  STYLE_KEYS.H1,
  STYLE_KEYS.H2,
  STYLE_KEYS.H3,
  STYLE_KEYS.H4,
  STYLE_KEYS.H5,
  STYLE_KEYS.H6,
]);

const TEXT_INTERNAL_KEYS = new Set([
  STYLE_KEYS.TEXT_LARGE,
  STYLE_KEYS.TEXT_MAIN,
  STYLE_KEYS.TEXT_SMALL,
  STYLE_KEYS.MICRO,
]);

/**
 * Build a lowercase set of ALL possible display names for heading styles
 * across every naming convention.
 */
function buildDisplayNameSet(internalKeys: Set<string>): Set<string> {
  const names = new Set<string>();
  for (const map of Object.values(conventionMaps)) {
    for (const [key, displayName] of Object.entries(map)) {
      if (internalKeys.has(key)) {
        names.add(displayName.toLowerCase());
      }
    }
  }
  return names;
}

const ALL_HEADING_DISPLAY_NAMES = buildDisplayNameSet(HEADING_INTERNAL_KEYS);
const ALL_TEXT_DISPLAY_NAMES = buildDisplayNameSet(TEXT_INTERNAL_KEYS);

/**
 * Given a suffix from "Example Text - <suffix>", classify it as
 * 'headline' | 'text' | 'none'. Works with ANY naming convention.
 */
export function classifyDisplayName(suffix: string): 'headline' | 'text' | 'none' {
  const lower = suffix.trim().toLowerCase();
  if (ALL_HEADING_DISPLAY_NAMES.has(lower)) return 'headline';
  if (ALL_TEXT_DISPLAY_NAMES.has(lower)) return 'text';
  return 'none';
}