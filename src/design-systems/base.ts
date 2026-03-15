import { STYLE_KEYS } from '../core/constants';

export interface FigmaTextStyle {
  id: string;
  name: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  lineHeight: number;
  letterSpacing: number;
}

export interface StyleWithMatching extends FigmaTextStyle {
  isOpen: boolean;
  mappedSystemStyle: string;
  group?: string;
  originalName?: string;
}

export interface DesignSystemHandler {
  name: string;
  
  // Detection
  detectSystem(styles: FigmaTextStyle[]): boolean;
  
  // Import screen logic
  groupStyles(styles: FigmaTextStyle[]): StyleWithMatching[];
  getSystemStyleOptions(): string[];
  
  // Generator/update flow logic  
  createBlueprint(styles: FigmaTextStyle[] | TextStyle[]): Map<string, string>;
  updateStylesFromBlueprint(
    blueprint: Map<string, string>, 
    newTypographySystem: any, 
    newFontFamily: string, 
    newFontStyle: string,
    availableFontStyles: string[]
  ): Promise<void>;
  
  // System-specific smart import (optional)
  smartImport?(availableFontStyles: string[]): Promise<{ success: boolean; message?: string }>;
  
  // Weight mapping logic (for systems like Relume that have weight variations)
  checkWeightMismatches?(
    styles: FigmaTextStyle[] | TextStyle[], 
    newFontFamily: string, 
    availableFontStyles: string[]
  ): { hasMismatches: boolean; missingWeights: string[]; availableWeights: string[] };
}

// Common system style keys (internal)
export const INTERNAL_SYSTEM_KEYS = [
  STYLE_KEYS.DISPLAY, STYLE_KEYS.H1, STYLE_KEYS.H2, STYLE_KEYS.H3, STYLE_KEYS.H4, STYLE_KEYS.H5, STYLE_KEYS.H6,
  STYLE_KEYS.TEXT_LARGE, STYLE_KEYS.TEXT_MAIN, STYLE_KEYS.TEXT_SMALL, STYLE_KEYS.MICRO
] as const;

export type InternalSystemKey = typeof INTERNAL_SYSTEM_KEYS[number];

function normalizeStyleName(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_\-\/]/g, '');
}

const SYSTEM_KEY_ALIASES: Record<InternalSystemKey, string[]> = {
  [STYLE_KEYS.DISPLAY]: [
    'display', 'h0', 'display1', 'headingh1', 'text7xl', 'displaylarge'
  ],
  [STYLE_KEYS.H1]: [
    'h1', 'display2', 'headingh2', 'text6xl', 'displaymedium'
  ],
  [STYLE_KEYS.H2]: [
    'h2', 'display3', 'headingh3', 'text5xl', 'displaysmall'
  ],
  [STYLE_KEYS.H3]: [
    'h3', 'display4', 'headingh4', 'text4xl'
  ],
  [STYLE_KEYS.H4]: [
    'h4', 'headingh5', 'text3xl'
  ],
  [STYLE_KEYS.H5]: [
    'h5', 'headingh6', 'text2xl'
  ],
  [STYLE_KEYS.H6]: [
    'h6', 'textxl'
  ],
  [STYLE_KEYS.TEXT_LARGE]: [
    'textlarge', 'lead', 'textlarge', 'large', 'subtitle', 'textlg', 'bodylarge'
  ],
  [STYLE_KEYS.TEXT_MAIN]: [
    'textmain', 'main', 'body', 'textregular', 'regular', 'paragraph', 'p', 'textbase', 'bodymedium'
  ],
  [STYLE_KEYS.TEXT_SMALL]: [
    'textsmall', 'small', 'textsmall', 'caption', 'textsm', 'bodysmall'
  ],
  [STYLE_KEYS.MICRO]: [
    'micro', 'tiny', 'texttiny', 'textmuted', 'textxs'
  ]
};

// Helper function to get display name for internal keys
export function getDisplayNameForKey(key: InternalSystemKey, systemName: string): string {
  switch (systemName) {
    case 'Lumos':
      return getLumosDisplayName(key);
    case 'Relume':
      return getRelumeDisplayName(key);
    case 'Bootstrap':
      return getBootstrapDisplayName(key);
    default:
      return getDefaultDisplayName(key);
  }
}

function getLumosDisplayName(key: InternalSystemKey): string {
  const mapping: Record<InternalSystemKey, string> = {
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
    [STYLE_KEYS.MICRO]: 'Micro'
  };
  return mapping[key] || key;
}

function getRelumeDisplayName(key: InternalSystemKey): string {
  const mapping: Record<InternalSystemKey, string> = {
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
    [STYLE_KEYS.MICRO]: 'Text Tiny'
  };
  return mapping[key] || key;
}

function getBootstrapDisplayName(key: InternalSystemKey): string {
  const mapping: Record<InternalSystemKey, string> = {
    [STYLE_KEYS.DISPLAY]: 'Display 1',
    [STYLE_KEYS.H1]: 'Display 2',
    [STYLE_KEYS.H2]: 'Display 3',
    [STYLE_KEYS.H3]: 'Display 4',
    [STYLE_KEYS.H4]: 'H4',
    [STYLE_KEYS.H5]: 'H5',
    [STYLE_KEYS.H6]: 'H6',
    [STYLE_KEYS.TEXT_LARGE]: 'Lead',
    [STYLE_KEYS.TEXT_MAIN]: 'Body',
    [STYLE_KEYS.TEXT_SMALL]: 'Small',
    [STYLE_KEYS.MICRO]: 'Tiny'
  };
  return mapping[key] || key;
}

function getDefaultDisplayName(key: InternalSystemKey): string {
  const mapping: Record<InternalSystemKey, string> = {
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
    [STYLE_KEYS.MICRO]: 'Text Tiny'
  };
  return mapping[key] || key;
} 

export function getInternalKeyForDisplayName(displayName: string, systemName: string): InternalSystemKey | null {
  if (!displayName) return null;

  const normalizedTarget = displayName.trim().toLowerCase();
  const normalizedAliasTarget = normalizeStyleName(displayName);

  // 1) Preferred system explicit display names
  for (const key of INTERNAL_SYSTEM_KEYS) {
    const systemDisplayName = getDisplayNameForKey(key, systemName);
    if (systemDisplayName.trim().toLowerCase() === normalizedTarget) {
      return key;
    }
  }

  // 2) Global aliases and flattened known labels (system-agnostic)
  for (const key of INTERNAL_SYSTEM_KEYS) {
    const aliasSet = SYSTEM_KEY_ALIASES[key];
    if (aliasSet.some(alias => normalizeStyleName(alias) === normalizedAliasTarget)) {
      return key;
    }
  }

  // 3) Default naming fallback
  for (const key of INTERNAL_SYSTEM_KEYS) {
    const defaultDisplayName = getDefaultDisplayName(key);
    if (defaultDisplayName.trim().toLowerCase() === normalizedTarget) {
      return key;
    }
  }

  return null;
}