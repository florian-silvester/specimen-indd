/**
 * InDesign-specific constants: page sizes, baseline grid presets, margin presets
 */

// ── Page Size Presets ─────────────────────────────────────────────────────────

export interface PageSizePreset {
  id: string;
  label: string;
  width: number;  // mm
  height: number; // mm
  category: 'iso' | 'us' | 'book' | 'screen';
}

export const PAGE_SIZE_PRESETS: PageSizePreset[] = [
  // ISO A series
  { id: 'a3', label: 'A3', width: 297, height: 420, category: 'iso' },
  { id: 'a4', label: 'A4', width: 210, height: 297, category: 'iso' },
  { id: 'a5', label: 'A5', width: 148, height: 210, category: 'iso' },
  { id: 'a6', label: 'A6', width: 105, height: 148, category: 'iso' },
  // ISO B series
  { id: 'b4', label: 'B4', width: 250, height: 353, category: 'iso' },
  { id: 'b5', label: 'B5', width: 176, height: 250, category: 'iso' },
  // US sizes (in mm for consistency)
  { id: 'letter', label: 'US Letter', width: 215.9, height: 279.4, category: 'us' },
  { id: 'legal', label: 'US Legal', width: 215.9, height: 355.6, category: 'us' },
  { id: 'tabloid', label: 'Tabloid', width: 279.4, height: 431.8, category: 'us' },
  // Common book sizes
  { id: 'pocket', label: 'Pocket (110×178)', width: 110, height: 178, category: 'book' },
  { id: 'novel', label: 'Novel (127×203)', width: 127, height: 203, category: 'book' },
  { id: 'trade', label: 'Trade (152×229)', width: 152, height: 229, category: 'book' },
  { id: 'royal', label: 'Royal (156×234)', width: 156, height: 234, category: 'book' },
  { id: 'crown', label: 'Crown Quarto (189×246)', width: 189, height: 246, category: 'book' },
  // Screen / digital
  { id: 'screen-16-9', label: 'Screen 16:9 (1920×1080)', width: 508, height: 285.75, category: 'screen' },
  { id: 'ipad', label: 'iPad (210×280)', width: 210, height: 280, category: 'screen' },
];

export const PAGE_SIZE_CATEGORIES: { id: string; label: string }[] = [
  { id: 'iso', label: 'ISO' },
  { id: 'us', label: 'US' },
  { id: 'book', label: 'Book' },
  { id: 'screen', label: 'Screen' },
];

// ── Unit Conversion ───────────────────────────────────────────────────────────

export const MM_TO_PT = 2.834645669;
export const PT_TO_MM = 1 / MM_TO_PT;

// ── Baseline Grid Presets ─────────────────────────────────────────────────────

export interface BaselineGridPreset {
  id: string;
  label: string;
  /** Grid increment in pt */
  increment: number;
}

export const BASELINE_GRID_PRESETS: BaselineGridPreset[] = [
  { id: 'grid-4', label: '4 pt', increment: 4 },
  { id: 'grid-5', label: '5 pt', increment: 5 },
  { id: 'grid-6', label: '6 pt', increment: 6 },
  { id: 'grid-7', label: '7 pt', increment: 7 },
  { id: 'grid-8', label: '8 pt', increment: 8 },
  { id: 'grid-9', label: '9 pt', increment: 9 },
  { id: 'grid-10', label: '10 pt', increment: 10 },
  { id: 'grid-11', label: '11 pt', increment: 11 },
  { id: 'grid-12', label: '12 pt', increment: 12 },
  { id: 'grid-13', label: '13 pt', increment: 13 },
  { id: 'grid-14', label: '14 pt', increment: 14 },
  { id: 'grid-15', label: '15 pt', increment: 15 },
  { id: 'grid-16', label: '16 pt', increment: 16 },
  { id: 'grid-18', label: '18 pt', increment: 18 },
];

// ── Margin Presets (in mm) ────────────────────────────────────────────────────

export interface MarginPreset {
  id: string;
  label: string;
  /** Top margin in mm */
  topMm: number;
  /** Bottom margin (minimum) in mm — actual may be larger */
  bottomMm: number;
  /** Inner (binding) margin in mm */
  innerMm: number;
  /** Outer margin in mm */
  outerMm: number;
}

export const MARGIN_PRESETS: MarginPreset[] = [
  { id: 'narrow', label: 'Narrow', topMm: 15, bottomMm: 15, innerMm: 12, outerMm: 15 },
  { id: 'standard', label: 'Standard', topMm: 20, bottomMm: 20, innerMm: 15, outerMm: 20 },
  { id: 'generous', label: 'Generous', topMm: 25, bottomMm: 25, innerMm: 20, outerMm: 25 },
  { id: 'golden', label: 'Golden Section', topMm: 18, bottomMm: 27, innerMm: 15, outerMm: 22 },
  { id: 'custom', label: 'Custom', topMm: 20, bottomMm: 20, innerMm: 15, outerMm: 20 },
];

// ── Paragraph Style Defaults ──────────────────────────────────────────────────

export type GridAlignMode = 'none' | 'allLines' | 'firstLineOnly';

export const GRID_ALIGN_OPTIONS: { value: GridAlignMode; label: string }[] = [
  { value: 'allLines', label: 'All Lines' },
  { value: 'firstLineOnly', label: 'First Line Only' },
  { value: 'none', label: 'None' },
];
