/**
 * Baseline grid calculator — pure math, no InDesign API dependency.
 *
 * Core principle: the entire page is divided into grid rows.
 * Margins are specified in mm. The bottom margin auto-adjusts upward
 * so the text area height is ALWAYS an exact multiple of the grid increment.
 * There is NEVER a remainder.
 */

import { MM_TO_PT, PT_TO_MM } from './constants';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GridInput {
  /** Page width in mm */
  pageWidth: number;
  /** Page height in mm */
  pageHeight: number;
  /** Body text leading in pt (= baseline grid increment) */
  bodyLeading: number;
  /** Top margin in mm */
  marginTopMm: number;
  /** Bottom margin minimum in mm — actual may be larger to fill whole rows */
  marginBottomMinMm: number;
  /** Inner (binding side) margin in mm */
  marginInnerMm: number;
  /** Outer margin in mm */
  marginOuterMm: number;
  /** Half-grid: if true, visual grid lines at half the increment */
  halfGrid: boolean;
  /** When true, bottom margin auto-adjusts so text area = exact rows × increment */
  autoMatchBottom: boolean;
}

export interface GridResult {
  /** The baseline increment in pt (= body leading) */
  baselineIncrement: number;
  /** Baseline increment in mm */
  baselineIncrementMm: number;
  /** Visual grid line spacing in pt (= increment, or increment/2 if half-grid) */
  gridLineSpacing: number;
  /** Visual grid line spacing in mm */
  gridLineSpacingMm: number;
  /** Whether half-grid is active */
  halfGrid: boolean;

  /** Number of text rows that fit in the text area */
  rowCount: number;

  /** Margins in mm */
  marginTopMm: number;
  marginBottomMm: number;  // actual (auto-adjusted, >= marginBottomMinMm)
  marginInnerMm: number;
  marginOuterMm: number;
  /** Margins in pt */
  marginTopPt: number;
  marginBottomPt: number;
  marginInnerPt: number;
  marginOuterPt: number;

  /** Usable text area dimensions */
  textAreaWidthPt: number;
  textAreaHeightPt: number;
  textAreaWidthMm: number;
  textAreaHeightMm: number;

  /** Number of visible grid lines in text area */
  gridLineCount: number;

  /** Page dimensions in pt */
  pageWidthPt: number;
  pageHeightPt: number;
}

// ── Calculator ────────────────────────────────────────────────────────────────

export function calculateGrid(input: GridInput): GridResult {
  const {
    pageWidth, pageHeight,
    bodyLeading,
    marginTopMm, marginBottomMinMm,
    marginInnerMm, marginOuterMm,
    halfGrid, autoMatchBottom,
  } = input;

  const baselineIncrement = bodyLeading;
  const baselineIncrementMm = baselineIncrement * PT_TO_MM;

  const gridLineSpacing = halfGrid ? baselineIncrement / 2 : baselineIncrement;
  const gridLineSpacingMm = gridLineSpacing * PT_TO_MM;

  const pageWidthPt = pageWidth * MM_TO_PT;
  const pageHeightPt = pageHeight * MM_TO_PT;

  // Convert margins from mm to pt
  const marginTopPt = marginTopMm * MM_TO_PT;
  const marginBottomMinPt = marginBottomMinMm * MM_TO_PT;
  const marginInnerPt = marginInnerMm * MM_TO_PT;
  const marginOuterPt = marginOuterMm * MM_TO_PT;

  // Available vertical space for text
  const availableHeightPt = pageHeightPt - marginTopPt - marginBottomMinPt;

  let rowCount: number;
  let textAreaHeightPt: number;
  let marginBottomPt: number;

  if (autoMatchBottom) {
    // Snap: text area = exact multiple of increment, bottom margin auto-adjusts
    rowCount = Math.max(1, Math.floor(availableHeightPt / baselineIncrement));
    textAreaHeightPt = rowCount * baselineIncrement;
    marginBottomPt = pageHeightPt - marginTopPt - textAreaHeightPt;
  } else {
    // No snap: use exact bottom margin, rows is just informational
    marginBottomPt = marginBottomMinPt;
    textAreaHeightPt = pageHeightPt - marginTopPt - marginBottomPt;
    rowCount = Math.max(1, Math.floor(textAreaHeightPt / baselineIncrement));
  }

  // Text area width
  const textAreaWidthPt = pageWidthPt - marginInnerPt - marginOuterPt;

  // Grid line count in text area (visual lines, not including top edge)
  const gridLineCount = halfGrid ? rowCount * 2 : rowCount;

  return {
    baselineIncrement,
    baselineIncrementMm: round1(baselineIncrementMm),
    gridLineSpacing,
    gridLineSpacingMm: round1(gridLineSpacingMm),
    halfGrid,

    rowCount,

    marginTopMm,
    marginBottomMm: round1(marginBottomPt * PT_TO_MM),
    marginInnerMm,
    marginOuterMm,
    marginTopPt,
    marginBottomPt,
    marginInnerPt,
    marginOuterPt,

    textAreaWidthPt, textAreaHeightPt,
    textAreaWidthMm: round1(textAreaWidthPt * PT_TO_MM),
    textAreaHeightMm: round1(textAreaHeightPt * PT_TO_MM),

    gridLineCount,

    pageWidthPt, pageHeightPt,
  };
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

// ── Snap font size to grid ────────────────────────────────────────────────────

/**
 * For a given font size, find the smallest multiple of baselineIncrement >= fontSize.
 * The grid decides the leading — 1 row, 2 rows, etc.
 */
export function snapLeadingToGrid(
  fontSize: number,
  baselineIncrement: number,
): { leadingPt: number; gridRows: number; lineHeightPercent: number } {
  const gridRows = Math.max(1, Math.ceil(fontSize / baselineIncrement));
  const leadingPt = gridRows * baselineIncrement;
  return {
    leadingPt,
    gridRows,
    lineHeightPercent: Math.round((leadingPt / fontSize) * 100),
  };
}
