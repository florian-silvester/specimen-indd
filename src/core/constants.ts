// src/constants.ts - Constant values for Typography Curves
import { PreviewLayoutType, ScalePoint } from './types';

// --- Preview Frame Naming & Layout ---
export const PREVIEW_FRAME_NAME = 'Typography Specimen';
export const PREVIEW_FRAME_NAME_COMPACT = 'Specimen Compact';
export const PREVIEW_FRAME_NAME_WATERFALL = 'Clean Waterfall';
export const PREVIEW_FRAME_NAME_TYPE_TOOL = "Specimen Type Tool Preview"; // Added for Type Tool

// Base names for different preview frame types
export const LAYOUT_BASE_NAMES: { [key in PreviewLayoutType]: string } = {
    specimenCompact: 'Specimen',
    cleanWaterfall: 'Waterfall',
    structuredText: 'Article'
};

// --- Dimensions & Spacing ---
export const PREVIEW_WIDTH = 1440;
export const FRAME_CORNER_RADIUS = 13;
export const FRAME_PADDING_HORIZONTAL = 64;
export const FRAME_PADDING_VERTICAL = 64;
export const MIDDLE_COLUMN_WIDTH = 656;
export const ITEM_SPACING = 24;
export const ITEM_INTERNAL_SPACING = 32;
export const SECTION_SPACING = 80;
export const HORIZONTAL_TEXT_SECTION_SPACING = 64;
export const RIGHT_COLUMN_TEXT_WIDTH = 440; // Consider removing if not used
export const SPEC_FONT_SIZE = 9;

// --- Colors ---
// Note: These are Figma API RGB values (0-1 range)
export const SPEC_COLOR: RGB = { r: 0, g: 0, b: 0 };
export const SPEC_COLOR_OPACITY: number = 0.4;
export const SPEC_COLOR_DARK: RGB = { r: 0xEE / 255, g: 0xEE / 255, b: 0xEE / 255 };
export const SPEC_COLOR_DARK_OPACITY: number = 0.5;
export const SPEC_BORDER_DARK: RGB = { r: 0xEE / 255, g: 0xEE / 255, b: 0xEE / 255 };
export const SPEC_BORDER_DARK_OPACITY: number = 0.1;
export const TEXT_COLOR_LIGHT: RGB = { r: 0x21 / 255, g: 0x21 / 255, b: 0x21 / 255 }; // #212121
export const LIGHT_MODE_BACKGROUND: RGB = { r: 1, g: 1, b: 1 }; // #FFFFFF
export const LIGHT_MODE_TEXT: RGB = TEXT_COLOR_LIGHT;

export const LIGHT_MODE_BORDER_DEFAULT: RGB = { r: 0xE6 / 255, g: 0xE6 / 255, b: 0xE6 / 255 }; // #E6E6E6

export const DARK_MODE_BACKGROUND: RGB = { r: 0x1B / 255, g: 0x1B / 255, b: 0x1B / 255 }; // #1B1B1B
export const DARK_MODE_TEXT: RGB = { r: 0xEE / 255, g: 0xEE / 255, b: 0xEE / 255 }; // #EEEEEE

export const DARK_MODE_BORDER_DEFAULT: RGB = { r: 0x44 / 255, g: 0x44 / 255, b: 0x44 / 255 }; // #444444
export const ACTIVE_FRAME_BORDER_LIGHT: RGB = { r: 0x97 / 255, g: 0x47 / 255, b: 0xFF / 255 }; // #9747FF (--border-accent-light)
export const ACTIVE_FRAME_BORDER_DARK: RGB = { r: 0xD8 / 255, g: 0xBF / 255, b: 0xFF / 255 }; // #D8BFFF (--border-accent-dark)

// export const LABEL_SPECS_BORDER_COLOR: RGBA = { r: 230 / 255, g: 230 / 255, b: 230 / 255, a: 0.2 }; // Old RGBA constant
export const LABEL_SPECS_BORDER_RGB: RGB = { r: 0, g: 0, b: 0 }; // #000000
export const LABEL_SPECS_BORDER_OPACITY: number = 0.1;

// --- Preview Theme Presets ---
export type PreviewThemeId = 'light' | 'light-faded' | 'dark' | 'sand' | 'grey' | 'green' | 'electric' | 'gold' | 'red' | 'custom';

export interface PreviewTheme {
  id: PreviewThemeId;
  label: string;
  background: RGB;
  text: RGB;
  border: RGB;
  frameBorder: RGB;
  base: 'light' | 'dark';
  specColor: RGB;
  specColorOpacity: number;
  specBorderColor: RGB;
  specBorderOpacity: number;
}

export const PREVIEW_THEMES: PreviewTheme[] = [
  {
    id: 'light',
    label: 'Light',
    background: { r: 1, g: 1, b: 1 },
    text: { r: 0x21 / 255, g: 0x21 / 255, b: 0x21 / 255 },
    border: { r: 0xE6 / 255, g: 0xE6 / 255, b: 0xE6 / 255 },
    frameBorder: ACTIVE_FRAME_BORDER_LIGHT,
    base: 'light',
    specColor: SPEC_COLOR,
    specColorOpacity: SPEC_COLOR_OPACITY,
    specBorderColor: LABEL_SPECS_BORDER_RGB,
    specBorderOpacity: LABEL_SPECS_BORDER_OPACITY,
  },
  {
    id: 'light-faded',
    label: 'Faded',
    background: { r: 1, g: 1, b: 1 },
    text: { r: 0x53 / 255, g: 0x53 / 255, b: 0x53 / 255 },
    border: { r: 0, g: 0, b: 0 },
    frameBorder: ACTIVE_FRAME_BORDER_LIGHT,
    base: 'light',
    specColor: { r: 0, g: 0, b: 0 },
    specColorOpacity: 0.4,
    specBorderColor: { r: 0, g: 0, b: 0 },
    specBorderOpacity: 0.1,
  },
  {
    id: 'dark',
    label: 'Dark',
    background: { r: 0x12 / 255, g: 0x12 / 255, b: 0x12 / 255 },
    text: { r: 0xEE / 255, g: 0xEE / 255, b: 0xEE / 255 },
    border: { r: 0x44 / 255, g: 0x44 / 255, b: 0x44 / 255 },
    frameBorder: ACTIVE_FRAME_BORDER_DARK,
    base: 'dark',
    specColor: SPEC_COLOR_DARK,
    specColorOpacity: SPEC_COLOR_DARK_OPACITY,
    specBorderColor: SPEC_BORDER_DARK,
    specBorderOpacity: SPEC_BORDER_DARK_OPACITY,
  },
  {
    id: 'sand',
    label: 'Sand',
    background: { r: 0xF2 / 255, g: 0xF0 / 255, b: 0xE7 / 255 },
    text: { r: 0x1B / 255, g: 0x1B / 255, b: 0x1B / 255 },
    border: { r: 0xE6 / 255, g: 0xE6 / 255, b: 0xE6 / 255 },
    frameBorder: ACTIVE_FRAME_BORDER_LIGHT,
    base: 'light',
    specColor: SPEC_COLOR,
    specColorOpacity: SPEC_COLOR_OPACITY,
    specBorderColor: LABEL_SPECS_BORDER_RGB,
    specBorderOpacity: LABEL_SPECS_BORDER_OPACITY,
  },
  {
    id: 'grey',
    label: 'Grey',
    background: { r: 0xDF / 255, g: 0xDF / 255, b: 0xDF / 255 },
    text: { r: 0x1B / 255, g: 0x1B / 255, b: 0x1B / 255 },
    border: { r: 0xE6 / 255, g: 0xE6 / 255, b: 0xE6 / 255 },
    frameBorder: ACTIVE_FRAME_BORDER_LIGHT,
    base: 'light',
    specColor: SPEC_COLOR,
    specColorOpacity: SPEC_COLOR_OPACITY,
    specBorderColor: LABEL_SPECS_BORDER_RGB,
    specBorderOpacity: LABEL_SPECS_BORDER_OPACITY,
  },
  {
    id: 'green',
    label: 'Green',
    background: { r: 0xF1 / 255, g: 0xFF / 255, b: 0xEE / 255 },
    text: { r: 0x03 / 255, g: 0x4B / 255, b: 0x0A / 255 },
    border: { r: 0xE6 / 255, g: 0xE6 / 255, b: 0xE6 / 255 },
    frameBorder: ACTIVE_FRAME_BORDER_LIGHT,
    base: 'light',
    specColor: { r: 0x03 / 255, g: 0x4B / 255, b: 0x0A / 255 },
    specColorOpacity: 0.6,
    specBorderColor: { r: 0x03 / 255, g: 0x4B / 255, b: 0x0A / 255 },
    specBorderOpacity: 0.15,
  },
  {
    id: 'electric',
    label: 'Electric',
    background: { r: 1, g: 1, b: 1 },
    text: { r: 0x15 / 255, g: 0x2C / 255, b: 0xAE / 255 },
    border: { r: 0xE6 / 255, g: 0xE6 / 255, b: 0xE6 / 255 },
    frameBorder: ACTIVE_FRAME_BORDER_LIGHT,
    base: 'light',
    specColor: { r: 0x15 / 255, g: 0x2C / 255, b: 0xAE / 255 },
    specColorOpacity: 0.6,
    specBorderColor: { r: 0x15 / 255, g: 0x2C / 255, b: 0xAE / 255 },
    specBorderOpacity: 0.15,
  },
  {
    id: 'gold',
    label: 'Gold',
    background: { r: 1, g: 1, b: 1 },
    text: { r: 0x68 / 255, g: 0x48 / 255, b: 0x10 / 255 },
    border: { r: 0xE6 / 255, g: 0xE6 / 255, b: 0xE6 / 255 },
    frameBorder: ACTIVE_FRAME_BORDER_LIGHT,
    base: 'light',
    specColor: { r: 0x68 / 255, g: 0x48 / 255, b: 0x10 / 255 },
    specColorOpacity: 0.6,
    specBorderColor: { r: 0x68 / 255, g: 0x48 / 255, b: 0x10 / 255 },
    specBorderOpacity: 0.15,
  },
  {
    id: 'red',
    label: 'Red',
    background: { r: 1, g: 1, b: 1 },
    text: { r: 0xB2 / 255, g: 0x12 / 255, b: 0x12 / 255 },
    border: { r: 0xE6 / 255, g: 0xE6 / 255, b: 0xE6 / 255 },
    frameBorder: ACTIVE_FRAME_BORDER_LIGHT,
    base: 'light',
    specColor: { r: 0xB2 / 255, g: 0x12 / 255, b: 0x12 / 255 },
    specColorOpacity: 0.6,
    specBorderColor: { r: 0xB2 / 255, g: 0x12 / 255, b: 0x12 / 255 },
    specBorderOpacity: 0.15,
  },
];

export function resolvePreviewTheme(
  themeId: PreviewThemeId,
  customColors?: { background: { r: number; g: number; b: number }; text?: { r: number; g: number; b: number } } | null,
): PreviewTheme {
  if (themeId === 'custom' && customColors) {
    const bg = customColors.background;
    const lum = bg.r * 0.299 + bg.g * 0.587 + bg.b * 0.114;
    const isDark = lum < 0.5;

    const text: RGB = customColors.text
      ? (customColors.text as RGB)
      : isDark
        ? { r: 0xEE / 255, g: 0xEE / 255, b: 0xEE / 255 }
        : { r: 0x21 / 255, g: 0x21 / 255, b: 0x21 / 255 };

    const hasCustomText = !!customColors.text;

    return {
      id: 'custom',
      label: 'Custom',
      background: bg as RGB,
      text,
      border: isDark
        ? { r: 0x44 / 255, g: 0x44 / 255, b: 0x44 / 255 }
        : { r: 0xE6 / 255, g: 0xE6 / 255, b: 0xE6 / 255 },
      frameBorder: isDark ? ACTIVE_FRAME_BORDER_DARK : ACTIVE_FRAME_BORDER_LIGHT,
      base: isDark ? 'dark' : 'light',
      specColor: hasCustomText ? text : (isDark ? SPEC_COLOR_DARK : SPEC_COLOR),
      specColorOpacity: hasCustomText ? 0.6 : (isDark ? SPEC_COLOR_DARK_OPACITY : SPEC_COLOR_OPACITY),
      specBorderColor: hasCustomText ? text : (isDark ? SPEC_BORDER_DARK : LABEL_SPECS_BORDER_RGB),
      specBorderOpacity: hasCustomText ? 0.15 : (isDark ? SPEC_BORDER_DARK_OPACITY : LABEL_SPECS_BORDER_OPACITY),
    };
  }
  return PREVIEW_THEMES.find(t => t.id === themeId) || PREVIEW_THEMES[0];
}

// --- Default Fonts ---
// Note: These require figma.loadFontAsync before use
export const INTER_REGULAR: FontName = { family: "Inter", style: "Regular" };
export const INTER_BOLD: FontName = { family: "Inter", style: "Bold" };

// --- Style Grouping & Naming ---
// MIDDLE_COLUMN_STYLE_NAMES and HORIZONTAL_TEXT_STYLE_NAMES removed as they were specific to the 'specimen' layout
// export const MIDDLE_COLUMN_STYLE_NAMES = new Set([
//     'display', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
// ]);

// export const HORIZONTAL_TEXT_STYLE_NAMES = ['textLarge', 'textMain', 'textSmall', 'micro'];

// --- Character Sets ---
export const NUMBERS_SET = "1234567890";
export const UPPERCASE_SET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const LOWERCASE_SET = "abcdefghijklmnopqrstuvwxyz";
export const SPECIAL_SET = "(+,.*?-{ })"; 

// --- Typographic Ratios ---
export const PRESET_RATIOS_MAP: { [key: string]: number } = {
  "Minor Second": 1.067,
  "Major Second": 1.125,
  "Minor Third": 1.200,
  "Major Third": 1.250,
  "Perfect Fourth": 1.333,
  "Augmented Fourth": 1.414,
  "Perfect Fifth": 1.500,
  "Golden Ratio": 1.618,
  "Minor Seventh": 1.778,
  "Double": 2.000,
};

export const SCALE_RATIO_MIN = PRESET_RATIOS_MAP["Minor Second"];
export const SCALE_RATIO_MAX = PRESET_RATIOS_MAP["Golden Ratio"];

// <<< ADDED scalePoints definition >>>
export const TYPOGRAPHY_SCALE_POINTS: ScalePoint = {
  display: 6,
  h1: 5,
  h2: 4,
  h3: 3,
  h4: 2,
  h5: 1,
  h6: 0,
  textMain: 0,
  textLarge: 1,
  textSmall: -1,
  micro: -2,
}; 

// --- Typography Style Keys (Individual Constants) ---
export const STYLE_KEYS = {
  DISPLAY: 'display',
  H1: 'h1', 
  H2: 'h2',
  H3: 'h3',
  H4: 'h4',
  H5: 'h5',
  H6: 'h6',
  TEXT_LARGE: 'textLarge',
  TEXT_MAIN: 'textMain', 
  TEXT_SMALL: 'textSmall',
  MICRO: 'micro'
} as const;

export type StyleName = typeof STYLE_KEYS[keyof typeof STYLE_KEYS];

export const SYSTEM_PRESETS: {
  readonly [key: string]: { readonly [K in StyleName]: number }
} = {
  material3: {
    [STYLE_KEYS.DISPLAY]: 57 / 16,
    [STYLE_KEYS.H1]: 45 / 16,
    [STYLE_KEYS.H2]: 36 / 16,
    [STYLE_KEYS.H3]: 32 / 16,
    [STYLE_KEYS.H4]: 28 / 16,
    [STYLE_KEYS.H5]: 24 / 16,
    [STYLE_KEYS.H6]: 20 / 16,
    [STYLE_KEYS.TEXT_LARGE]: 18 / 16,
    [STYLE_KEYS.TEXT_MAIN]: 1,
    [STYLE_KEYS.TEXT_SMALL]: 14 / 16,
    [STYLE_KEYS.MICRO]: 12 / 16,
  },
  tailwind: {
    [STYLE_KEYS.DISPLAY]: 128 / 16,
    [STYLE_KEYS.H1]: 60 / 16,
    [STYLE_KEYS.H2]: 48 / 16,
    [STYLE_KEYS.H3]: 36 / 16,
    [STYLE_KEYS.H4]: 30 / 16,
    [STYLE_KEYS.H5]: 24 / 16,
    [STYLE_KEYS.H6]: 20 / 16,
    [STYLE_KEYS.TEXT_LARGE]: 18 / 16,
    [STYLE_KEYS.TEXT_MAIN]: 1,
    [STYLE_KEYS.TEXT_SMALL]: 14 / 16,
    [STYLE_KEYS.MICRO]: 12 / 16,
  },
  carbon: {
    [STYLE_KEYS.DISPLAY]: 54 / 16,
    [STYLE_KEYS.H1]: 42 / 16,
    [STYLE_KEYS.H2]: 32 / 16,
    [STYLE_KEYS.H3]: 28 / 16,
    [STYLE_KEYS.H4]: 20 / 16,
    [STYLE_KEYS.H5]: 16 / 16,
    [STYLE_KEYS.H6]: 14 / 16,
    [STYLE_KEYS.TEXT_LARGE]: 16 / 16,
    [STYLE_KEYS.TEXT_MAIN]: 1,
    [STYLE_KEYS.TEXT_SMALL]: 14 / 16,
    [STYLE_KEYS.MICRO]: 12 / 16,
  },
  lumos: {
    [STYLE_KEYS.DISPLAY]: 128 / 18,
    [STYLE_KEYS.H1]: 80 / 18,
    [STYLE_KEYS.H2]: 64 / 18,
    [STYLE_KEYS.H3]: 48 / 18,
    [STYLE_KEYS.H4]: 32 / 18,
    [STYLE_KEYS.H5]: 24 / 18,
    [STYLE_KEYS.H6]: 20 / 18,
    [STYLE_KEYS.TEXT_LARGE]: 20 / 18,
    [STYLE_KEYS.TEXT_MAIN]: 1,
    [STYLE_KEYS.TEXT_SMALL]: 16 / 18,
    [STYLE_KEYS.MICRO]: 14 / 18,
  },
} as const;

export type SystemPresetKey = keyof typeof SYSTEM_PRESETS;

// --- Typography Scale Order ---
export const TYPOGRAPHY_SCALE_ORDER = {
  ALL_STYLES: [
    STYLE_KEYS.DISPLAY, 
    STYLE_KEYS.H1, 
    STYLE_KEYS.H2, 
    STYLE_KEYS.H3, 
    STYLE_KEYS.H4, 
    STYLE_KEYS.H5, 
    STYLE_KEYS.H6, 
    STYLE_KEYS.TEXT_LARGE, 
    STYLE_KEYS.TEXT_MAIN, 
    STYLE_KEYS.TEXT_SMALL, 
    STYLE_KEYS.MICRO
  ] as const,
  HEADINGS: [
    STYLE_KEYS.DISPLAY, 
    STYLE_KEYS.H1, 
    STYLE_KEYS.H2, 
    STYLE_KEYS.H3, 
    STYLE_KEYS.H4, 
    STYLE_KEYS.H5, 
    STYLE_KEYS.H6
  ] as const,
  TEXT_STYLES: [
    STYLE_KEYS.TEXT_LARGE, 
    STYLE_KEYS.TEXT_MAIN, 
    STYLE_KEYS.TEXT_SMALL, 
    STYLE_KEYS.MICRO
  ] as const
} as const;

// --- Text Case Options (shared by grid rows and global section controls) ---
export const TEXT_CASE_OPTIONS = [
  { value: 'Original', label: '\u2014' },
  { value: 'Uppercase', label: 'AG' },
  { value: 'Lowercase', label: 'ag' },
  { value: 'Title Case', label: 'Ag' },
] as const;

// --- Figma Node Naming Patterns ---
export const FIGMA_NODE_NAMES = {
  // Simple naming functions (take display name directly)
  EXAMPLE_TEXT: (displayName: string) => `Example Text - ${displayName}`,
  ITEM_CONTAINER: (displayName: string) => `Item - ${displayName}`,
  LABEL_SPECS_ROW: (displayName: string) => `LabelSpecs - ${displayName}`,
  
  // Fixed names (no convention dependency)
  FONT_DISPLAY_NAME: "Font Display Name",
  DECORATIVE_AA_TEXT: "Decorative Aa Text", 
  CHARACTER_SET_DISPLAY: "Character Set Display",
  
  // Search patterns (for finding nodes)
  EXAMPLE_TEXT_PREFIX: "Example Text -",
  ITEM_PREFIX: "Item -",
  LABELSPECS_PREFIX: "LabelSpecs",
  SPEC_SUFFIX: " Spec -"
} as const;

/**
 * All possible HEADING display names across every naming convention (lowercase).
 * Used by play text / text-mirror to classify "Example Text - <suffix>" nodes.
 */
export const ALL_HEADING_DISPLAY_NAMES: ReadonlySet<string> = new Set([
  // Default: H0, H1–H6
  'h0', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  // Tailwind
  'text-7xl', 'text-6xl', 'text-5xl', 'text-4xl', 'text-3xl', 'text-2xl', 'text-xl',
  // Bootstrap
  'display-1',
  // Relume / Lumos
  'display',
  // Bootstrap h1–h6 already covered above (lowercase matches)
]);

/**
 * All possible BODY/TEXT display names across every naming convention (lowercase).
 */
export const ALL_TEXT_DISPLAY_NAMES: ReadonlySet<string> = new Set([
  // Default
  'text large', 'text main', 'text small', 'text tiny',
  // Tailwind
  'text-lg', 'text-base', 'text-sm', 'text-xs',
  // Bootstrap
  'lead', 'p', 'small', 'text-muted',
  // Relume
  'large', 'regular', 'tiny',
  // Lumos
  'micro',
]);