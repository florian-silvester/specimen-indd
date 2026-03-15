import { create } from 'zustand';
import { emit } from '@create-figma-plugin/utilities';
import { PreviewThemeId, resolvePreviewTheme } from '../../core/constants';

type FeatureFlags = {
  useZustandResets: boolean;
};

type UIPanelsState = {
  openSections: { [key: string]: boolean };
  toggleOne: (name: string) => void;
  collapseAll: () => void;
};

type ColorMode = 'light' | 'dark';
type ActiveFlow = 'generator' | 'structuredText' | 'frameScan';

type CustomPreviewColors = { background: { r: number; g: number; b: number }; text?: { r: number; g: number; b: number } } | null;
type CurrentView = 'landing' | 'main' | 'scanResults' | 'textInput' | 'textStyleAssignment' | 'smartMatchResults';
type GeneratorTab = 'generate' | 'styles';
export type FontSource = 'primary' | 'secondary' | 'custom';

type AppStoreState = {
  // Preview color mode (light/dark theme for generated specimens)
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
  toggleColorMode: () => void;

  // Preview theme (extends color mode with presets + custom)
  previewThemeId: PreviewThemeId;
  customPreviewColors: CustomPreviewColors;
  setPreviewTheme: (themeId: PreviewThemeId, customColors?: CustomPreviewColors) => void;
  
  // Show/hide spec labels on preview (font size, line height annotations)
  showSpecLabels: boolean;
  setShowSpecLabels: (show: boolean) => void;
  toggleShowSpecLabels: () => void;
  
  // Track if user has manually edited text in preview (affects Play text button)
  hasManualTextEdits: boolean;
  setHasManualTextEdits: (hasEdits: boolean) => void;
  
  // Track if a preview specimen exists (enables/disables various buttons)
  previewExists: boolean;
  setPreviewExists: (exists: boolean) => void;
  
  // Current workflow context (generator, frameScan, etc.)
  activeFlow: ActiveFlow;
  setActiveFlow: (flow: ActiveFlow) => void;
  
  // Show Google Fonts in font list dropdown
  showGoogleFonts: boolean;
  setShowGoogleFonts: (show: boolean) => void;
  
  // Track if user has manually edited the styles grid
  hasManualGridEdits: boolean;
  setHasManualGridEdits: (hasEdits: boolean) => void;
  
  // Line height display unit (percent, px, em, rem)
  lineHeightUnit: 'percent' | 'px' | 'em' | 'rem';
  setLineHeightUnit: (unit: 'percent' | 'px' | 'em' | 'rem') => void;
  
  // Size display unit (px, em, rem)
  sizeUnit: 'px' | 'em' | 'rem';
  setSizeUnit: (unit: 'px' | 'em' | 'rem') => void;
  
  // Letter spacing display unit (percent, px, em, rem)
  letterSpacingUnit: 'percent' | 'px' | 'em' | 'rem';
  setLetterSpacingUnit: (unit: 'percent' | 'px' | 'em' | 'rem') => void;
  
  // Rounding grid size (0, 2, or 4 - applied to font sizes/line heights)
  roundingGridSize: number;
  setRoundingGridSize: (gridSize: number) => void;
  
  // Line height curve setting (affects how line height scales across type sizes)
  lineHeightCurve: 'inverse-smooth' | 'linear' | 'flat';
  setLineHeightCurve: (curve: 'inverse-smooth' | 'linear' | 'flat') => void;
  
  // Letter spacing curve setting (affects how letter spacing scales across type sizes)
  letterSpacingCurve: 'inverse-smooth' | 'linear' | 'flat';
  setLetterSpacingCurve: (curve: 'inverse-smooth' | 'linear' | 'flat') => void;
  
  // Active mode (desktop or mobile - controls which typography settings are active)
  activeMode: 'desktop' | 'mobile';
  setActiveMode: (mode: 'desktop' | 'mobile') => void;
  
  // Naming convention for typography styles
  namingConvention: string;
  setNamingConvention: (convention: string) => void;
  
  // Current view/screen navigation
  currentView: CurrentView;
  setCurrentView: (view: CurrentView) => void;
  
  // Generator tab (generate controls vs styles grid)
  generatorTab: GeneratorTab;
  setGeneratorTab: (tab: GeneratorTab) => void;
  
  // Style visibility (which styles are shown/hidden)
  styleVisibility: { [key: string]: boolean };
  setStyleVisibility: (visibility: { [key: string]: boolean }) => void;
  updateStyleVisibility: (key: string, visible: boolean) => void;
  
  // Style font sources (which styles use primary vs secondary font, or 'custom' for free pick)
  styleFontSources: { [key: string]: FontSource };
  setStyleFontSources: (sources: { [key: string]: FontSource }) => void;
  updateStyleFontSource: (key: string, source: FontSource) => void;

  // Per-style weight lock (true = follows global weight, false = independently chosen)
  styleWeightLocked: { [key: string]: boolean };
  setStyleWeightLocked: (locked: { [key: string]: boolean }) => void;
  updateStyleWeightLocked: (key: string, locked: boolean) => void;
  
  featureFlags: FeatureFlags;
  setFeatureFlag: (key: keyof FeatureFlags, value: boolean) => void;
  resetLog: string[];
  addResetLog: (message: string) => void;
  resetOnEnterScan: () => void; // For tracing when we trigger resets
  uiPanels: UIPanelsState;
  // Simple view history for back navigation
  viewHistory: string[];
  pushView: (view: string) => void;
  popView: () => string | undefined;
  popPrevious: () => string | undefined;
};

export const useAppStore = create<AppStoreState>((set, get) => ({
  // Color mode state
  colorMode: 'light',
  setColorMode: (mode: ColorMode) => {
    const themeId = mode as PreviewThemeId;
    const theme = resolvePreviewTheme(themeId);
    set({ colorMode: theme.base, previewThemeId: themeId });
    emit('COLOR_MODE_CHANGED', {
      mode: theme.base,
      themeId: theme.id,
      background: theme.background,
      text: theme.text,
      border: theme.border,
      frameBorder: theme.frameBorder,
    });
  },
  toggleColorMode: () => {
    const current = get().previewThemeId;
    const newId: PreviewThemeId = current === 'dark' ? 'light' : 'dark';
    const theme = resolvePreviewTheme(newId);
    set({ colorMode: theme.base, previewThemeId: newId });
    emit('COLOR_MODE_CHANGED', {
      mode: theme.base,
      themeId: theme.id,
      background: theme.background,
      text: theme.text,
      border: theme.border,
      frameBorder: theme.frameBorder,
    });
  },

  // Preview theme
  previewThemeId: 'light' as PreviewThemeId,
  customPreviewColors: null as CustomPreviewColors,
  setPreviewTheme: (themeId: PreviewThemeId, customColors?: CustomPreviewColors) => {
    const theme = resolvePreviewTheme(themeId, customColors);
    set({
      previewThemeId: themeId,
      customPreviewColors: customColors ?? null,
      colorMode: theme.base,
    });
    emit('COLOR_MODE_CHANGED', {
      mode: theme.base,
      themeId: theme.id,
      background: theme.background,
      text: theme.text,
      border: theme.border,
      frameBorder: theme.frameBorder,
    });
  },
  
  // Show spec labels state (no event emit - UPDATE_PREVIEW handles this)
  showSpecLabels: true,
  setShowSpecLabels: (show: boolean) => set({ showSpecLabels: show }),
  toggleShowSpecLabels: () => set((state) => ({ showSpecLabels: !state.showSpecLabels })),
  
  // Manual text edits tracking (affects Play text / Reset button)
  hasManualTextEdits: false,
  setHasManualTextEdits: (hasEdits: boolean) => set({ hasManualTextEdits: hasEdits }),
  
  // Preview exists tracking (enables various UI buttons)
  previewExists: false,
  setPreviewExists: (exists: boolean) => set({ previewExists: exists }),
  
  // Active workflow context
  activeFlow: 'generator',
  setActiveFlow: (flow: ActiveFlow) => set({ activeFlow: flow }),
  
  // Show Google Fonts toggle (default: false — hide Google Fonts by default)
  showGoogleFonts: false,
  setShowGoogleFonts: (show: boolean) => set({ showGoogleFonts: show }),
  
  // Manual grid edits tracking (affects Reset button in styles grid)
  hasManualGridEdits: false,
  setHasManualGridEdits: (hasEdits: boolean) => set({ hasManualGridEdits: hasEdits }),
  
  // Line height unit (default: percent)
  lineHeightUnit: 'percent',
  setLineHeightUnit: (unit: 'percent' | 'px' | 'em' | 'rem') => set({ lineHeightUnit: unit }),
  
  // Size unit (default: px)
  sizeUnit: 'px',
  setSizeUnit: (unit: 'px' | 'em' | 'rem') => set({ sizeUnit: unit }),
  
  // Letter spacing unit (default: percent)
  letterSpacingUnit: 'percent',
  setLetterSpacingUnit: (unit: 'percent' | 'px' | 'em' | 'rem') => set({ letterSpacingUnit: unit }),
  
  // Rounding grid size (default: 0 - no rounding)
  roundingGridSize: 0,
  setRoundingGridSize: (gridSize: number) => set({ roundingGridSize: gridSize }),
  
  // Line height curve (default: inverse-smooth)
  lineHeightCurve: 'inverse-smooth',
  setLineHeightCurve: (curve: 'inverse-smooth' | 'linear' | 'flat') => set({ lineHeightCurve: curve }),
  
  // Letter spacing curve (default: inverse-smooth)
  letterSpacingCurve: 'inverse-smooth',
  setLetterSpacingCurve: (curve: 'inverse-smooth' | 'linear' | 'flat') => set({ letterSpacingCurve: curve }),
  
  // Active mode (default: desktop)
  activeMode: 'desktop',
  setActiveMode: (mode: 'desktop' | 'mobile') => set({ activeMode: mode }),
  
  // Naming convention (default: 'Default Naming')
  namingConvention: 'Default Naming',
  setNamingConvention: (convention: string) => set({ namingConvention: convention }),
  
  // Current view (default: main - open generator directly)
  currentView: 'main',
  setCurrentView: (view: CurrentView) => set({ currentView: view }),
  
  // Generator tab (default: generate)
  generatorTab: 'generate',
  setGeneratorTab: (tab: GeneratorTab) => set({ generatorTab: tab }),
  
  // Style visibility (default: empty object - all visible)
  styleVisibility: {},
  setStyleVisibility: (visibility: { [key: string]: boolean }) => set({ styleVisibility: visibility }),
  updateStyleVisibility: (key: string, visible: boolean) => set((state) => ({
    styleVisibility: { ...state.styleVisibility, [key]: visible }
  })),
  
  // Style font sources (default: headings=secondary, text=primary)
  styleFontSources: {
    display: 'secondary',
    h1: 'secondary',
    h2: 'secondary',
    h3: 'secondary',
    h4: 'secondary',
    h5: 'secondary',
    h6: 'secondary',
    textLarge: 'primary',
    textMain: 'primary',
    textSmall: 'primary',
    micro: 'primary',
  },
  setStyleFontSources: (sources: { [key: string]: FontSource }) => set({ styleFontSources: sources }),
  updateStyleFontSource: (key: string, source: FontSource) => set((state) => ({
    styleFontSources: { ...state.styleFontSources, [key]: source }
  })),

  styleWeightLocked: {},
  setStyleWeightLocked: (locked: { [key: string]: boolean }) => set({ styleWeightLocked: locked }),
  updateStyleWeightLocked: (key: string, locked: boolean) => set((state) => ({
    styleWeightLocked: { ...state.styleWeightLocked, [key]: locked }
  })),
  
  featureFlags: {
    useZustandResets: false,
  },
  setFeatureFlag: (key, value) =>
    set((state) => ({ featureFlags: { ...state.featureFlags, [key]: value } })),
  resetLog: [],
  addResetLog: (message: string) =>
    set((state) => ({ resetLog: [...state.resetLog, message] })),
  resetOnEnterScan: () => {
    const ts = new Date().toISOString();
    // Collapse UI panels and log
    set((state) => {
      const collapsed: { [key: string]: boolean } = {};
      Object.keys(state.uiPanels.openSections).forEach((k) => (collapsed[k] = false));
      return {
        resetLog: [...state.resetLog, `[${ts}] enter-scan reset triggered`],
        uiPanels: { ...state.uiPanels, openSections: collapsed },
      } as AppStoreState;
    });
  },
  uiPanels: {
    openSections: {
      font: false,
      secondaryFont: false,
      baseSize: false,
      scaleRatio: false,
      lineHeight: false,
      letterSpacing: false,
      rounding: false,
      styles: false,
    },
    toggleOne: (name: string) => {
      const { openSections } = get().uiPanels;
      const isOpen = !!openSections[name];
      const next: { [key: string]: boolean } = {};
      Object.keys(openSections).forEach((k) => (next[k] = false));
      if (!isOpen) next[name] = true;
      set((state) => ({ uiPanels: { ...state.uiPanels, openSections: next } }));
    },
    collapseAll: () => {
      const { openSections } = get().uiPanels;
      const next: { [key: string]: boolean } = {};
      Object.keys(openSections).forEach((k) => (next[k] = false));
      set((state) => ({ uiPanels: { ...state.uiPanels, openSections: next } }));
    },
  },
  viewHistory: [],
  pushView: (view: string) => set((state) => {
    const history = state.viewHistory;
    if (history.length > 0 && history[history.length - 1] === view) {
      return {};
    }
    return { viewHistory: [...history, view] };
  }),
  popView: () => {
    const history = get().viewHistory;
    if (history.length === 0) return undefined;
    const next = history[history.length - 1];
    set({ viewHistory: history.slice(0, -1) });
    return next;
  },
  popPrevious: () => {
    const history = get().viewHistory;
    if (history.length === 0) return undefined;
    // Remove current view (top of stack) and return the new top as previous
    const withoutCurrent = history.slice(0, -1);
    const prev = withoutCurrent[withoutCurrent.length - 1];
    set({ viewHistory: withoutCurrent });
    return prev;
  },
}));

// Debug helper for quick inspection from the console
// window.__sg.dumpState()
declare global {
  interface Window {
    __sg?: any;
  }
}

if (typeof window !== 'undefined') {
  window.__sg = window.__sg || {};
  window.__sg.dumpState = () => {
    const state = useAppStore.getState();
    // eslint-disable-next-line no-console
    console.log('[appStore] dump', {
      colorMode: state.colorMode,
      showSpecLabels: state.showSpecLabels,
      hasManualTextEdits: state.hasManualTextEdits,
      hasManualGridEdits: state.hasManualGridEdits,
      previewExists: state.previewExists,
      activeFlow: state.activeFlow,
      showGoogleFonts: state.showGoogleFonts,
      lineHeightUnit: state.lineHeightUnit,
      roundingGridSize: state.roundingGridSize,
      lineHeightCurve: state.lineHeightCurve,
      letterSpacingCurve: state.letterSpacingCurve,
      activeMode: state.activeMode,
      namingConvention: state.namingConvention,
      currentView: state.currentView,
      featureFlags: state.featureFlags,
      resetLog: state.resetLog,
    });
    return state;
  };
}


