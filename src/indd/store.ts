/**
 * InDesign Specimen — Zustand store
 * Standalone (no Figma plugin dependencies)
 */

import { create } from 'zustand';
import { GridAlignMode } from './constants';

// ── Types ─────────────────────────────────────────────────────────────────────

type ColorMode = 'light' | 'dark';

export interface InddStore {
  // ── UI chrome ───────────────────────────────────────────────────────────────
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
  toggleColorMode: () => void;

  activeTab: 'setup' | 'type' | 'styles';
  setActiveTab: (tab: 'setup' | 'type' | 'styles') => void;

  openSections: Record<string, boolean>;
  toggleSection: (name: string) => void;

  // ── Page setup ──────────────────────────────────────────────────────────────
  pagePresetId: string;
  setPagePresetId: (id: string) => void;
  pageWidth: number;   // mm
  setPageWidth: (w: number) => void;
  pageHeight: number;  // mm
  setPageHeight: (h: number) => void;
  facingPages: boolean;
  setFacingPages: (v: boolean) => void;

  // ── Baseline grid ───────────────────────────────────────────────────────────
  bodyLeading: number; // pt (= grid increment)
  setBodyLeading: (v: number) => void;
  baselineGridPresetId: string;
  setBaselineGridPresetId: (id: string) => void;
  halfGrid: boolean;
  setHalfGrid: (v: boolean) => void;

  // ── Margins (in mm) ─────────────────────────────────────────────────────────
  marginPresetId: string;
  setMarginPresetId: (id: string) => void;
  marginTopMm: number;
  setMarginTopMm: (v: number) => void;
  marginBottomMinMm: number;
  setMarginBottomMinMm: (v: number) => void;
  marginInnerMm: number;
  setMarginInnerMm: (v: number) => void;
  marginOuterMm: number;
  setMarginOuterMm: (v: number) => void;
  autoMatchBottom: boolean;
  setAutoMatchBottom: (v: boolean) => void;

  // ── Typography scale ─────────────────────────────────────────────────────────
  baseSize: number;
  setBaseSize: (v: number) => void;
  scaleRatio: number;
  setScaleRatio: (v: number) => void;

  headlineMinLineHeight: number;
  setHeadlineMinLineHeight: (v: number) => void;
  headlineMaxLineHeight: number;
  setHeadlineMaxLineHeight: (v: number) => void;
  textMinLineHeight: number;
  setTextMinLineHeight: (v: number) => void;
  textMaxLineHeight: number;
  setTextMaxLineHeight: (v: number) => void;

  letterSpacing: number;
  setLetterSpacing: (v: number) => void;
  maxLetterSpacing: number;
  setMaxLetterSpacing: (v: number) => void;

  lineHeightCurve: 'inverse-smooth' | 'linear' | 'flat';
  setLineHeightCurve: (v: 'inverse-smooth' | 'linear' | 'flat') => void;
  letterSpacingCurve: 'inverse-smooth' | 'linear' | 'flat';
  setLetterSpacingCurve: (v: 'inverse-smooth' | 'linear' | 'flat') => void;

  // ── Paragraph styles ────────────────────────────────────────────────────────
  gridAlignMode: GridAlignMode;
  setGridAlignMode: (v: GridAlignMode) => void;
  snapToGrid: boolean;
  setSnapToGrid: (v: boolean) => void;
  /** Per-style grid row overrides (e.g., { display: 5, h1: 4 }) */
  gridRowOverrides: Record<string, number>;
  setGridRowOverride: (styleKey: string, rows: number) => void;
  clearGridRowOverride: (styleKey: string) => void;
  /** Per-style visibility (false = hidden). Missing key = visible. */
  styleVisibility: Record<string, boolean>;
  toggleStyleVisibility: (styleKey: string) => void;
  /** Space before/after per style, in grid rows (0 = none) */
  spaceBefore: Record<string, number>;
  spaceAfter: Record<string, number>;
  setSpaceBefore: (styleKey: string, rows: number) => void;
  setSpaceAfter: (styleKey: string, rows: number) => void;
  /** Per-style size overrides in pt (missing = use computed from scale) */
  sizeOverrides: Record<string, number>;
  setSizeOverride: (styleKey: string, size: number) => void;
  /** Per-style tracking overrides in InDesign units (missing = use computed) */
  trackingOverrides: Record<string, number>;
  setTrackingOverride: (styleKey: string, tracking: number) => void;

  // ── Font ────────────────────────────────────────────────────────────────────
  fontFamily: string;
  setFontFamily: (v: string) => void;
  fontStyle: string;
  setFontStyle: (v: string) => void;
  secondaryFontFamily: string;
  setSecondaryFontFamily: (v: string) => void;
  secondaryFontStyle: string;
  setSecondaryFontStyle: (v: string) => void;

  // ── Story (editable text content) ──────────────────────────────────────────
  /** Array of {styleKey, text} — the document story. null = use default sample. */
  storyBlocks: { styleKey: string; text: string }[] | null;
  setStoryBlocks: (blocks: { styleKey: string; text: string }[]) => void;
  updateStoryBlockText: (index: number, text: string) => void;
  updateStoryBlockStyle: (index: number, styleKey: string) => void;
  /** Batch-update multiple story block texts at once */
  updateStoryBlockTexts: (updates: { index: number; text: string }[]) => void;
  /** Insert a new story block at the given index */
  insertStoryBlock: (index: number, styleKey: string, text: string) => void;
  /** Remove a story block (merge with adjacent) */
  removeStoryBlock: (index: number) => void;
  /** Currently focused story block index (-1 = none) */
  activeBlockIndex: number;
  setActiveBlockIndex: (index: number) => void;

  // ── Canvas ─────────────────────────────────────────────────────────────────
  zoom: number;
  setZoom: (v: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomFit: () => void;
  lastFitScale: number;
  setLastFitScale: (v: number) => void;
  pageCount: number;
  setPageCount: (v: number) => void;
  showBaselines: boolean;
  setShowBaselines: (v: boolean) => void;
  fitSignal: number;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useInddStore = create<InddStore>((set, get) => ({
  colorMode: 'dark',
  setColorMode: (mode) => {
    set({ colorMode: mode });
    document.body.classList.toggle('dark-theme', mode === 'dark');
  },
  toggleColorMode: () => {
    const next = get().colorMode === 'dark' ? 'light' : 'dark';
    set({ colorMode: next });
    document.body.classList.toggle('dark-theme', next === 'dark');
  },

  activeTab: 'setup',
  setActiveTab: (tab) => set({ activeTab: tab }),

  openSections: {
    pageSize: true,
    baselineGrid: false,
    margins: false,
    baseSize: false,
    scaleRatio: false,
    lineHeight: true,
    letterSpacing: true,
  },
  toggleSection: (name) => {
    const { openSections } = get();
    // Setup tab sections use accordion (only one open at a time)
    const setupSections = ['pageSize', 'baselineGrid', 'margins'];
    const isSetupSection = setupSections.includes(name);
    const isOpen = !!openSections[name];
    const next = { ...openSections };
    if (isSetupSection) {
      // Accordion: close other setup sections
      setupSections.forEach(k => (next[k] = false));
    }
    next[name] = !isOpen;
    set({ openSections: next });
  },

  // Page setup — A4
  pagePresetId: 'a4',
  setPagePresetId: (id) => set({ pagePresetId: id }),
  pageWidth: 210,
  setPageWidth: (w) => set({ pageWidth: w, pagePresetId: 'custom' }),
  pageHeight: 297,
  setPageHeight: (h) => set({ pageHeight: h, pagePresetId: 'custom' }),
  facingPages: true,
  setFacingPages: (v) => set({ facingPages: v }),

  // Baseline grid — leading = grid increment
  bodyLeading: 14,
  setBodyLeading: (v) => set({ bodyLeading: v }),
  baselineGridPresetId: 'grid-14',
  setBaselineGridPresetId: (id) => set({ baselineGridPresetId: id }),
  halfGrid: false,
  setHalfGrid: (v) => set({ halfGrid: v }),

  // Margins in mm (bottom is a minimum — actual auto-adjusts to fill rows)
  marginPresetId: 'standard',
  setMarginPresetId: (id) => set({ marginPresetId: id }),
  marginTopMm: 20,
  setMarginTopMm: (v) => set({ marginTopMm: v, marginPresetId: 'custom' }),
  marginBottomMinMm: 20,
  setMarginBottomMinMm: (v) => set({ marginBottomMinMm: v, marginPresetId: 'custom' }),
  marginInnerMm: 15,
  setMarginInnerMm: (v) => set({ marginInnerMm: v, marginPresetId: 'custom' }),
  marginOuterMm: 20,
  setMarginOuterMm: (v) => set({ marginOuterMm: v, marginPresetId: 'custom' }),
  autoMatchBottom: true,
  setAutoMatchBottom: (v) => set({ autoMatchBottom: v }),

  // Typography scale
  baseSize: 12,
  setBaseSize: (v) => set({ baseSize: v }),
  scaleRatio: 1.250,
  setScaleRatio: (v) => set({ scaleRatio: v }),

  headlineMinLineHeight: 100,
  setHeadlineMinLineHeight: (v) => set({ headlineMinLineHeight: v }),
  headlineMaxLineHeight: 125,
  setHeadlineMaxLineHeight: (v) => set({ headlineMaxLineHeight: v }),
  textMinLineHeight: 135,
  setTextMinLineHeight: (v) => set({ textMinLineHeight: v }),
  textMaxLineHeight: 150,
  setTextMaxLineHeight: (v) => set({ textMaxLineHeight: v }),

  letterSpacing: 2.75,
  setLetterSpacing: (v) => set({ letterSpacing: v }),
  maxLetterSpacing: -2.25,
  setMaxLetterSpacing: (v) => set({ maxLetterSpacing: v }),

  lineHeightCurve: 'inverse-smooth',
  setLineHeightCurve: (v) => set({ lineHeightCurve: v }),
  letterSpacingCurve: 'inverse-smooth',
  setLetterSpacingCurve: (v) => set({ letterSpacingCurve: v }),

  // Paragraph styles
  gridAlignMode: 'allLines',
  setGridAlignMode: (v) => set({ gridAlignMode: v }),
  snapToGrid: true,
  setSnapToGrid: (v) => set({ snapToGrid: v }),
  gridRowOverrides: {},
  setGridRowOverride: (styleKey, rows) => set((s) => ({
    gridRowOverrides: { ...s.gridRowOverrides, [styleKey]: rows },
  })),
  clearGridRowOverride: (styleKey) => set((s) => {
    const next = { ...s.gridRowOverrides };
    delete next[styleKey];
    return { gridRowOverrides: next };
  }),
  styleVisibility: {},  // all visible by default (missing = visible)
  toggleStyleVisibility: (styleKey) => set((s) => {
    const current = s.styleVisibility[styleKey] !== false;  // default visible
    return { styleVisibility: { ...s.styleVisibility, [styleKey]: !current } };
  }),
  spaceBefore: {},
  spaceAfter: {},
  setSpaceBefore: (styleKey, rows) => set((s) => ({
    spaceBefore: { ...s.spaceBefore, [styleKey]: Math.max(0, rows) },
  })),
  setSpaceAfter: (styleKey, rows) => set((s) => ({
    spaceAfter: { ...s.spaceAfter, [styleKey]: Math.max(0, rows) },
  })),
  sizeOverrides: {},
  setSizeOverride: (styleKey, size) => set((s) => ({
    sizeOverrides: { ...s.sizeOverrides, [styleKey]: Math.max(4, size) },
  })),
  trackingOverrides: {},
  setTrackingOverride: (styleKey, tracking) => set((s) => ({
    trackingOverrides: { ...s.trackingOverrides, [styleKey]: tracking },
  })),

  // Story
  storyBlocks: null,  // null = use default sample text
  setStoryBlocks: (blocks) => set({ storyBlocks: blocks }),
  updateStoryBlockText: (index, text) => set((s) => {
    if (!s.storyBlocks) return {};
    const next = [...s.storyBlocks];
    next[index] = { ...next[index], text };
    return { storyBlocks: next };
  }),
  updateStoryBlockStyle: (index, styleKey) => set((s) => {
    if (!s.storyBlocks) return {};  // caller must initialize first
    const next = [...s.storyBlocks];
    next[index] = { ...next[index], styleKey };
    return { storyBlocks: next };
  }),
  updateStoryBlockTexts: (updates) => set((s) => {
    if (!s.storyBlocks) return {};
    const next = [...s.storyBlocks];
    for (const { index, text } of updates) {
      if (next[index]) next[index] = { ...next[index], text };
    }
    return { storyBlocks: next };
  }),
  insertStoryBlock: (index, styleKey, text) => set((s) => {
    if (!s.storyBlocks) return {};
    const next = [...s.storyBlocks];
    next.splice(index, 0, { styleKey, text });
    return { storyBlocks: next };
  }),
  removeStoryBlock: (index) => set((s) => {
    if (!s.storyBlocks) return {};
    if (s.storyBlocks.length <= 1) return {};
    const next = [...s.storyBlocks];
    next.splice(index, 1);
    return { storyBlocks: next };
  }),
  activeBlockIndex: -1,
  setActiveBlockIndex: (index) => set({ activeBlockIndex: index }),

  // Font
  fontFamily: 'Georgia',
  setFontFamily: (v) => set({ fontFamily: v }),
  fontStyle: 'Regular',
  setFontStyle: (v) => set({ fontStyle: v }),
  secondaryFontFamily: '',
  setSecondaryFontFamily: (v) => set({ secondaryFontFamily: v }),
  secondaryFontStyle: '',
  setSecondaryFontStyle: (v) => set({ secondaryFontStyle: v }),

  // Canvas
  zoom: 0,
  setZoom: (v) => set({ zoom: v }),
  zoomIn: () => set((s) => ({ zoom: Math.min(15, (s.zoom || s.lastFitScale) * 1.25) })),
  zoomOut: () => set((s) => ({ zoom: Math.max(0.1, (s.zoom || s.lastFitScale) / 1.25) })),
  zoomFit: () => set({ zoom: 0, fitSignal: get().fitSignal + 1 }),
  lastFitScale: 1,
  setLastFitScale: (v) => set({ lastFitScale: v }),
  pageCount: 4,
  setPageCount: (v) => set({ pageCount: Math.max(1, Math.min(20, v)) }),
  showBaselines: true,
  setShowBaselines: (v) => set({ showBaselines: v }),
  fitSignal: 0,
}));
