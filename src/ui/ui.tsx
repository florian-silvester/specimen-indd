// ui.ts - Typography Scale Generator
import { h, render, Fragment, RefObject } from "preact";
import { useState, useEffect, useCallback, useMemo, useRef } from "preact/hooks";
import { emit, on } from "@create-figma-plugin/utilities";
import { TargetedEvent } from 'preact/compat'; // ADDED for event types

// import "./ui/ui.css"; // Removed direct CSS import
import { embeddedStyles } from "./generated-styles"; // Import embedded styles
import { iconSvgs } from "./generated-icons"; // Import generated icons
import { Icon } from "./components/Icon"; // IMPORT Icon component
import { SegmentedInput } from "./components/SegmentedInput"; // IMPORT SegmentedInput
import { LandingScreen } from "./screens/LandingScreen"; // <<< ADDED: Import LandingScreen
import { ScanResultsScreen } from "./screens/ScanResultsScreen"; // <<< ADDED: Import ScanResultsScreen - Removed FoundStyleData import as it's not directly used here
import { TextInputScreen } from "./screens/TextInputScreen"; // <<< ADDED: New screen
import { TextStyleAssignmentScreen } from "./screens/TextStyleAssignmentScreen"; // <<< ADDED: New screen
import { RangeSlider } from "./components/RangeSlider"; // <<< ADDED: New range slider component
import { CustomSingleSlider } from "./components/CustomSingleSlider"; // <<< ADDED: New single slider component
import { BaseSizeControlSection } from "./components/BaseSizeControlSection"; // ADDED IMPORT
import { ScaleRatioControlSection } from "./components/ScaleRatioControlSection"; // ADDED IMPORT
import { LineHeightControlSection } from "./components/LineHeightControlSection"; // ADDED IMPORT
import { LetterSpacingControlSection } from "./components/LetterSpacingControlSection"; // ADDED IMPORT
import { StylesGridSection } from "./components/StylesGridSection"; // <<< ADDED IMPORT FOR NEW COMPONENT
import { FontControlSection } from "./components/FontControlSection"; // <<< ADDED IMPORT
import { FooterSection } from "./components/FooterSection"; // <<< ADDED IMPORT
import { HeaderTabsSection } from "./components/HeaderTabsSection"; // <<< ADDED IMPORT
import { useClickOutside } from "./hooks/useClickOutside"; // <<< IMPORT CUSTOM HOOK
import { calculateInitialManualSizes, getDisplayUIName } from "./ui-utils"; // <<< IMPORT UTILS
import { useFontState } from "./hooks/useFontState"; // <<< IMPORT CUSTOM HOOK
import { useTypographyState } from "./hooks/useTypographyState"; // <<< IMPORT NEW HOOK
import { TypographyModeSettings, TypographySettings } from "./state";
import { calculateStyles } from "./logic/typography-calculator"; // <<< IMPORT NEW CALCULATOR
import { GeneratorScreen } from "./screens/GeneratorScreen"; // <<< IMPORT NEW SCREEN
import { SmartMatchResultsScreen } from "./screens/SmartMatchResultsScreen"; // <<< ADDED: New screen
import { WeightMappingScreen } from "./screens/WeightMappingScreen"; // <<< ADDED: New weight mapping screen
import { VariableMappingScreen } from "./screens/VariableMappingScreen"; // <<< ADDED: New variable mapping screen
import { UnifiedUpdateScreen } from "./screens/UnifiedUpdateScreen"; // <<< ADDED: New unified update screen
// LibraryScreen removed - replaced by specimen sampling
import { LlmStructuredContent } from "../api/llm-prompts";
import { useAppStore } from "./store/appStore";
import { genericArticleContent } from "../services/placeholder-data";
import { getConventionName } from "./naming-conventions";
import { getInternalKeyForDisplayName } from "../design-systems/base";


import {
  CalculateStylesRequest,
  CreateStylesRequest,
  CreatePreviewRequest,
  CreateWaterfallRequest, // Added
  CreateSpecimenCompactPreviewRequest, // Renamed from CreateTypeToolPreviewRequest
  FontInfo,
  InitialFontsMessage,
  StylesForFamilyMessage,
  TypographyStyle,
  TypographySystem,
  UpdatePreviewRequest,
  PreviewLayoutType, // Ensure this is imported if the local alias is removed
  PreviewTextAlignMode,
  DetectedTextStyle, 
  AvailableFontsListUpdateEvent, // <<< ADDED IMPORT
  ProcessUnformattedTextResponseEvent, // <<< ADDED IMPORT
  CreatePreviewEvent,
  ProcessUnformattedTextRequestEvent,
  ManualTextEditsDetectedEvent, // <<< ADDED IMPORT
  SpecimenSnapshot, // Specimen sampling
  SpecimenSampledEvent, // Specimen sampling
} from "../core/types"; // Corrected path back to ./types
import { DEFAULT_TYPE_SYSTEM } from "../services/default-styles"; // <<< IMPORT DEFAULT SYSTEM
import { 
    LIGHT_MODE_BACKGROUND, 
    DARK_MODE_BACKGROUND, 
    LAYOUT_BASE_NAMES,
    STYLE_KEYS,
    TYPOGRAPHY_SCALE_ORDER,
    TYPOGRAPHY_SCALE_POINTS,
    PRESET_RATIOS_MAP,
    SCALE_RATIO_MAX,
    SCALE_RATIO_MIN,
    SYSTEM_PRESETS,
    SystemPresetKey,
    TEXT_CASE_OPTIONS
} from '../core/constants';

// DELETED local PreviewLayoutType alias to use the imported one.
// type PreviewLayoutType = "specimen" | "typeTool" | "cleanWaterfall"; 

// Define scale points outside for reuse // <<< REMOVE OLD DEFINITION
// const scalePoints = { ... };

const DESIGN_SYSTEM_PRESET_OPTIONS: { id: SystemPresetKey; label: string }[] = [
  { id: "material3", label: "Material Design 3" },
  { id: "tailwind", label: "Tailwind CSS" },
  { id: "carbon", label: "IBM Carbon" },
  { id: "lumos", label: "Lumos" },
];

type PresetProfileId = 'desktop' | 'mobile' | 'social' | 'presentation' | 'product' | 'focus';

const PRESET_PROFILE_OPTIONS: { id: PresetProfileId; label: string }[] = [
  { id: 'desktop', label: 'Desktop' },
  { id: 'mobile', label: 'Mobile' },
  { id: 'social', label: 'Social' },
  { id: 'presentation', label: 'Deck' },
  { id: 'product', label: 'Product' },
  { id: 'focus', label: 'Focus' },
];

const PRESET_PROFILE_DEFAULTS: Record<PresetProfileId, { baseSize: number; scaleRatio: number }> = {
  desktop: { baseSize: 16, scaleRatio: PRESET_RATIOS_MAP["Perfect Fourth"] },
  mobile: { baseSize: 16, scaleRatio: 1.2 },
  social: { baseSize: 20, scaleRatio: PRESET_RATIOS_MAP["Major Third"] },
  presentation: { baseSize: 24, scaleRatio: 1.25 },
  product: { baseSize: 14, scaleRatio: 1.2 },
  focus: { baseSize: 16, scaleRatio: PRESET_RATIOS_MAP["Perfect Fourth"] },
};

const PRESET_PROFILE_VISIBLE_KEYS: Record<PresetProfileId, string[]> = {
  desktop: [...TYPOGRAPHY_SCALE_ORDER.ALL_STYLES],
  mobile: [...TYPOGRAPHY_SCALE_ORDER.ALL_STYLES],
  social: ['display', 'h1', 'h2', 'h3', 'h4', 'textLarge', 'textMain', 'textSmall'],
  presentation: ['display', 'h1', 'h2', 'h3', 'h4', 'textLarge', 'textMain'],
  product: [...TYPOGRAPHY_SCALE_ORDER.ALL_STYLES],
  focus: ['h1', 'textMain'],
};

const DEFAULT_STYLE_FONT_SOURCES: { [key: string]: 'primary' | 'secondary' } = {
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
};

const NAMING_CONVENTION_OPTIONS = ['Default Naming', 'Lumos', 'Tailwind', 'Bootstrap', 'Relume'];
const DEBUG_UI_HOTPATH = false;
const debugUiHotpath = (...args: unknown[]) => {
  if (DEBUG_UI_HOTPATH) {
    console.log(...args);
  }
};



// Main UI component
function TypographyUI() {
  const clampScaleRatio = useCallback((ratio: number) => {
    if (typeof ratio !== 'number' || isNaN(ratio)) return 1.333;
    return Math.max(SCALE_RATIO_MIN, Math.min(ratio, SCALE_RATIO_MAX));
  }, []);

  // --- Inject Embedded CSS --- 
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.innerHTML = embeddedStyles;
    document.head.appendChild(styleElement);
    console.log('[ui.tsx] Injected embedded CSS.');

    // Optional cleanup function (might not be necessary for styles)
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  // --- Theme Handling Effect --- 
  useEffect(() => {
    // Function to apply theme class to body
    const applyTheme = (theme: 'light' | 'dark') => {
      console.log(`[ui.tsx] Applying theme: ${theme}`);
      if (theme === 'dark') {
        document.body.classList.add('dark-theme');
      } else {
        document.body.classList.remove('dark-theme');
      }
      // REMOVE: setColorMode(theme); // Do not update the toggle state based on system preference
    };

    // Function to check and apply the current theme based on media query
    const checkAndApplyTheme = () => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(prefersDark ? 'dark' : 'light');
    };

    // Listener for messages from the plugin code
    const messageListener = (event: MessageEvent) => {
      if (!event.data.pluginMessage) return;
      // Handle CHECK_THEME request from main
      if (event.data.pluginMessage.type === 'CHECK_THEME') {
        checkAndApplyTheme();
      }
    };

    window.addEventListener('message', messageListener);

    // Listener for system theme changes
    const mediaQueryListener = (event: MediaQueryListEvent) => {
      applyTheme(event.matches ? 'dark' : 'light');
    };
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    darkModeMediaQuery.addEventListener('change', mediaQueryListener);

    // Initial theme check on mount (in case main thread doesn't send CHECK_THEME fast enough)
    checkAndApplyTheme(); 

    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener('message', messageListener);
      darkModeMediaQuery.removeEventListener('change', mediaQueryListener);
    };
  }, []); // Empty dependency array: run only once on mount
  // --- END Theme Handling Effect --- 

  // --- activeMode and currentView are managed by Zustand store ---
  // NOTE: This must be early in the component to be available for useEffects below
  const { colorMode, setColorMode, previewThemeId, customPreviewColors, setPreviewTheme, showSpecLabels, setShowSpecLabels, hasManualTextEdits, setHasManualTextEdits, previewExists, setPreviewExists, activeFlow, setActiveFlow, showGoogleFonts, setShowGoogleFonts, hasManualGridEdits, setHasManualGridEdits, lineHeightUnit, setLineHeightUnit, sizeUnit, letterSpacingUnit, roundingGridSize, setRoundingGridSize, lineHeightCurve, setLineHeightCurve, letterSpacingCurve, setLetterSpacingCurve, activeMode, setActiveMode, namingConvention, setNamingConvention, currentView, setCurrentView, styleVisibility, setStyleVisibility, styleFontSources, setStyleFontSources, updateStyleFontSource, styleWeightLocked, setStyleWeightLocked, updateStyleWeightLocked, generatorTab, setGeneratorTab } = useAppStore();

  // Track simple view history for intuitive back navigation
  useEffect(() => {
    // Push every view change except the initial mount
    useAppStore.getState().pushView(currentView);
  }, [currentView]);
  // --- Run resets when entering Scan ---
  useEffect(() => {
    const { resetOnEnterScan, addResetLog } = useAppStore.getState();
    if (currentView === 'scanResults') {
      resetOnEnterScan();
      addResetLog('[ui.tsx] currentView changed to scanResults → reset hooks invoked');
      // Future: preview.resetAll(), uiPanels.collapseAll(), scan.reset()
    }
  }, [currentView]);

  // Listen for manual text edits detection
  useEffect(() => {
    const unsubscribe = on('MANUAL_TEXT_EDITS_DETECTED', (data: ManualTextEditsDetectedEvent) => {
      console.log('[ui.tsx] Manual text edits detected:', data.hasEdits);
      setHasManualTextEdits(data.hasEdits);
    });
    return unsubscribe;
  }, []);

  // --- NEW: Centralized Typography State ---
  const { settings, setSettings } = useTypographyState();
  const { desktop, mobile } = settings;
  const initialSettingsRef = useRef<TypographySettings | null>(null);
  if (initialSettingsRef.current === null) {
    initialSettingsRef.current = JSON.parse(JSON.stringify(settings)) as TypographySettings;
  }

  const presetBaselineSnapshotRef = useRef<TypographyModeSettings | null>(null);
  const [userChangedSincePreset, setUserChangedSincePreset] = useState(false);

  const numericDiffers = useCallback((a: number, b: number, tolerance = 0.0001) => {
    return Math.abs(a - b) > tolerance;
  }, []);

  const normalizeModeSettings = useCallback((modeSettings: TypographyModeSettings): TypographyModeSettings => {
    return {
      ...modeSettings,
      headingLetterSpacing: typeof modeSettings.headingLetterSpacing === 'number' ? modeSettings.headingLetterSpacing : modeSettings.letterSpacing,
      headingMaxLetterSpacing: typeof modeSettings.headingMaxLetterSpacing === 'number' ? modeSettings.headingMaxLetterSpacing : modeSettings.maxLetterSpacing,
      textLetterSpacing: typeof modeSettings.textLetterSpacing === 'number' ? modeSettings.textLetterSpacing : modeSettings.letterSpacing,
      textMaxLetterSpacing: typeof modeSettings.textMaxLetterSpacing === 'number' ? modeSettings.textMaxLetterSpacing : modeSettings.maxLetterSpacing,
    };
  }, []);

  const getPresetBaselineModeSettings = useCallback((mode: 'desktop' | 'mobile', presetId: PresetProfileId): TypographyModeSettings => {
    const initialSettings = initialSettingsRef.current ?? settings;
    const initialModeSettings = initialSettings[mode];
    const profileDefaults = PRESET_PROFILE_DEFAULTS[presetId];
    const profileTargetMode: 'desktop' | 'mobile' = presetId === 'mobile' ? 'mobile' : 'desktop';

    const baseline = normalizeModeSettings({ ...initialModeSettings });
    if (presetId === 'desktop' || presetId === 'mobile') {
      if (profileTargetMode === mode) {
        baseline.baseSize = profileDefaults.baseSize;
        baseline.scaleRatio = clampScaleRatio(profileDefaults.scaleRatio);
      }
      return baseline;
    }

    baseline.baseSize = profileDefaults.baseSize;
    baseline.scaleRatio = clampScaleRatio(profileDefaults.scaleRatio);
    return baseline;
  }, [settings, clampScaleRatio, normalizeModeSettings]);

  // --- Basic parameters (Now Mode-Specific) --- 
  // Desktop - REMOVED
  // const [desktopBaseSize, setDesktopBaseSize] = useState(16);
  // ... (and all other desktop/mobile useState hooks are removed) ...
  // Mobile - REMOVED

  // --- Text Size Options (Min/Max - Now Mode-Specific) ---
  // Desktop - REMOVED
  // Mobile - REMOVED

  
  // --- Refs to track previous slider values (Keep using single name for now, will adapt in Step 3/4) ---
  const prevBaseSizeRef = useRef(desktop.baseSize); // Init with desktop for now
  const prevScaleRatioRef = useRef(desktop.scaleRatio);
  const prevLetterSpacingRef = useRef(desktop.letterSpacing);
  // Min/Max states are still single, keep refs as is for now
  // Duplicated parameter refs
  const prevMaxLetterSpacingRef = useRef(desktop.maxLetterSpacing);
  // const prevSizeOptionRef = useRef(sizeOption); // REMOVE THIS LINE

  // Flag to prevent recalculation useEffect from overwriting restored snapshot styles
  const isRestoringSnapshotRef = useRef(false);
  const [preserveImportedNumericAxes, setPreserveImportedNumericAxes] = useState<{
    size: boolean;
    lineHeight: boolean;
    letterSpacing: boolean;
  }>({
    size: false,
    lineHeight: false,
    letterSpacing: false,
  });

  // State managed by Zustand store (destructured earlier at top of component)
  const [fineTunedStyles, setFineTunedStyles] = useState<TypographySystem>(DEFAULT_TYPE_SYSTEM); // <<< INITIALIZE WITH DEFAULT

  // Generator-level text case (set via global controls on Generate tab, NOT per-style overrides)
  const [generatorHeadingCase, setGeneratorHeadingCase] = useState('Original');
  const [generatorTextCase, setGeneratorTextCase] = useState('Original');
  
  // styleVisibility is now managed by Zustand store

  // Debounce timer state
  const [debounceTimer, setDebounceTimer] = useState<number | null>(null);

  // Legacy compatibility: sampled frames may still carry this text, but current UI
  // does not expose an editable text-preset control.
  const [waterfallText, setWaterfallText] = useState(
    "abcdefghijklmnopqrstuvwxyz1234567",
  );

  // Legacy compatibility: sampled frames may still carry this layout key.
  // Presets now drive the main generation behavior.
  const [selectedLayout, setSelectedLayout] =
    useState<PreviewLayoutType>("specimenCompact"); // This should now use the imported PreviewLayoutType
  const [previewTextAlign, setPreviewTextAlign] = useState<PreviewTextAlignMode>('left');

  // --- roundingGridSize is now managed by Zustand store ---

  // --- NEW: State for the "Select/Reset" button ---
  const [textSelectionButtonMode, setTextSelectionButtonMode] = useState<'select' | 'reset'>('select');
  // --- END NEW State ---

  // --- NEW: State for workflow context ---
  // activeFlow is now managed by Zustand store
  const [structuredTextPayload, setStructuredTextPayload] = useState<LlmStructuredContent | null>(null);
  // --- END NEW State ---

  // --- NEW: State for Google Fonts ---
  // showGoogleFonts is now managed by Zustand store
  const [googleFontsList, setGoogleFontsList] = useState<string[]>([]);
  // --- END NEW State ---

  // --- lineHeightUnit is now managed by Zustand store ---

  // --- Footer preset state ---
  // Legacy compatibility note: these footer controls still exist because older specimen
  // frames and UI wiring read/write them, even though the specimen option list is reduced.
  const [selectedSpecimenPreset, setSelectedSpecimenPreset] = useState<string>("Specimen"); // Default to Compact
  const specimenPresetOptions: string[] = ["Specimen"]; // Waterfall and Article removed - Specimen is the primary layout
  
  const [selectedTextPreset, setSelectedTextPreset] = useState<string>("Default Text");
  const textPresetOptions = [ // Example options
    { label: "Default Text", value: "abcdefghijklmnopqrstuvwxyz1234567" },
    { label: "Alphabet (Caps)", value: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" },
    { label: "Alphabet (Mixed)", value: "Abcdefghijklmnopqrstuvwxyz" },
    { label: "Pangram 1", value: "The quick brown fox jumps over the lazy dog." },
    { label: "Pangram 2", value: "Waltz, bad nymph, for quick jigs vex." },
  ];
  // --- END NEW State for Footer Dropdowns ---

  // --- NEW: State for Scale Ratio Preset Popover ---
  const [isScaleRatioPresetListOpen, setIsScaleRatioPresetListOpen] = useState(false);
  const scaleRatioInputContainerRef = useRef<HTMLDivElement>(null); // Ref for popover positioning/outside click
  // --- END NEW State ---

  // Use the custom hook for the scale ratio preset dropdown
  useClickOutside(scaleRatioInputContainerRef, () => {
    if (isScaleRatioPresetListOpen) {
      setIsScaleRatioPresetListOpen(false);
    }
  }, isScaleRatioPresetListOpen);

  // --- NEW: State for Footer Custom Dropdowns ---
  const [isSpecimenLayoutListOpen, setIsSpecimenLayoutListOpen] = useState(false);
  const specimenLayoutDropdownContainerRef = useRef<HTMLDivElement>(null);
  // We will use selectedSpecimenPreset and specimenPresetOptions for the first footer dropdown's actual value management
  // selectedLayout will still be used internally for logic, but the UI for this dropdown will reflect selectedSpecimenPreset

  const [isTextPresetListOpen, setIsTextPresetListOpen] = useState(false); // New state for Text Preset dropdown
  const textPresetDropdownContainerRef = useRef<HTMLDivElement>(null); // New ref for Text Preset dropdown
  const [selectedPresetProfile, setSelectedPresetProfile] = useState<PresetProfileId>('desktop');


  // --- State for Styles action dropdown ---
  const [isStylesDropdownOpen, setIsStylesDropdownOpen] = useState(false);
  const [selectedStylesAction, setSelectedStylesAction] = useState<'Generate Styles' | 'Create Styles' | 'Update Styles'>("Generate Styles");
  const stylesDropdownContainerRef = useRef<HTMLDivElement>(null);

  // --- State for Export dropdown ---
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const exportDropdownContainerRef = useRef<HTMLDivElement>(null);

  // --- NEW: State for Grid Font Style Dropdowns ---
  const [openGridFontStyleDropdownKey, setOpenGridFontStyleDropdownKey] = useState<string | null>(null);
  const gridDropdownsRef = useRef<HTMLDivElement>(null); // A single ref for the grid container for outside click detection
  const {
    // Primary font state
    fontFamily,
    setFontFamily,
    availableFonts,
    selectedStyle,
    setSelectedStyle,
    availableStyles,
    actualAvailableFontsList,
    pendingStyleSelection,
    setPendingStyleSelection,
    
    // Secondary font state
    secondaryFontEnabled,
    setSecondaryFontEnabled,
    secondaryFontLinked,
    setSecondaryFontLinked,
    toggleSecondaryFontLinked,
    secondaryWeightLinked,
    setSecondaryWeightLinked,
    toggleSecondaryWeightLinked,
    secondaryFontFamily,
    setSecondaryFontFamily,
    secondarySelectedStyle,
    setSecondarySelectedStyle,
    secondaryAvailableStyles,
    pendingSecondaryStyleSelection,
    setPendingSecondaryStyleSelection,
    
    // Preview functionality
    previewFontFamily,
    isPreviewMode,
    startFontPreview,
    stopFontPreview,
    commitPreviewFont,
    getEffectiveFontFamily,
    
    // Weight preview functionality
    previewWeight,
    isWeightPreviewMode,
    startWeightPreview,
    stopWeightPreview,
    commitPreviewWeight,
    getEffectiveWeight,
    
    // Secondary preview functionality
    previewSecondaryFontFamily,
    isSecondaryPreviewMode,
    startSecondaryFontPreview,
    stopSecondaryFontPreview,
    commitSecondaryPreviewFont,
    getEffectiveSecondaryFontFamily,
    
    // Secondary weight preview functionality
    previewSecondaryWeight,
    isSecondaryWeightPreviewMode,
    startSecondaryWeightPreview,
    stopSecondaryWeightPreview,
    commitSecondaryPreviewWeight,
    getEffectiveSecondaryWeight,
  } = useFontState(fineTunedStyles, setFineTunedStyles, emit);
  const effectivePrimaryFontFamily = getEffectiveFontFamily();
  const effectivePrimaryWeight = getEffectiveWeight();
  const effectiveSecondaryFontFamily = secondaryFontEnabled
    ? (secondaryFontLinked ? effectivePrimaryFontFamily : getEffectiveSecondaryFontFamily())
    : effectivePrimaryFontFamily;
  const effectiveSecondaryWeight = secondaryFontEnabled
    ? (secondaryWeightLinked ? effectivePrimaryWeight : getEffectiveSecondaryWeight())
    : effectivePrimaryWeight;
  const hasFontDivergence =
    secondaryFontEnabled &&
    (effectiveSecondaryFontFamily !== effectivePrimaryFontFamily ||
      effectiveSecondaryWeight !== effectivePrimaryWeight);
  const isLetterSpacingSplit = hasFontDivergence || generatorHeadingCase !== generatorTextCase;
  const prevLetterSpacingSplitRef = useRef(isLetterSpacingSplit);
  // --- END NEW State ---

  // --- namingConvention is now managed by Zustand store ---
  const namingConventionRef = useRef(namingConvention);
  useEffect(() => {
    namingConventionRef.current = namingConvention;
  }, [namingConvention]);

  // --- styleFontSources is now managed by Zustand store ---

  // --- hasManualGridEdits is now managed by Zustand store ---

  // --- lineHeightCurve and letterSpacingCurve are now managed by Zustand store ---
  const [isLineHeightHeadlinesCurveOpen, setIsLineHeightHeadlinesCurveOpen] = useState(false);
  const [isLineHeightTextCurveOpen, setIsLineHeightTextCurveOpen] = useState(false);
  const [isLetterSpacingCurveOpen, setIsLetterSpacingCurveOpen] = useState(false);
  const lineHeightHeadlinesCurveRef = useRef<HTMLDivElement>(null);
  const lineHeightTextCurveRef = useRef<HTMLDivElement>(null);
  const letterSpacingCurveRef = useRef<HTMLDivElement>(null);

  // Use the custom hook for the Line Height Headlines Curve dropdown
  useClickOutside(lineHeightHeadlinesCurveRef, () => {
    if (isLineHeightHeadlinesCurveOpen) {
      setIsLineHeightHeadlinesCurveOpen(false);
    }
  }, isLineHeightHeadlinesCurveOpen);

  // Use the custom hook for the Line Height Text Curve dropdown
  useClickOutside(lineHeightTextCurveRef, () => {
    if (isLineHeightTextCurveOpen) {
      setIsLineHeightTextCurveOpen(false);
    }
  }, isLineHeightTextCurveOpen);

  // Use the custom hook for the Letter Spacing Curve dropdown
  useClickOutside(letterSpacingCurveRef, () => {
    if (isLetterSpacingCurveOpen) {
      setIsLetterSpacingCurveOpen(false);
    }
  }, isLetterSpacingCurveOpen);

  // Auto-snap sliders to same value when switching to "Flat" mode
  // AND separate them when switching AWAY from Flat
  useEffect(() => {
    const currentSettings = settings[activeMode];
    
    if (lineHeightCurve === 'flat') {
      // SNAP TO FLAT: Only snap if they're not already equal
      if (currentSettings.headlineMinLineHeight !== currentSettings.headlineMaxLineHeight ||
          currentSettings.textMinLineHeight !== currentSettings.textMaxLineHeight) {
        
        const avgHeadline = Math.round((currentSettings.headlineMinLineHeight + currentSettings.headlineMaxLineHeight) / 2);
        const avgText = Math.round((currentSettings.textMinLineHeight + currentSettings.textMaxLineHeight) / 2);
        
        console.log('[Flat mode] Snapping sliders:', {
          headlineBefore: [currentSettings.headlineMinLineHeight, currentSettings.headlineMaxLineHeight],
          headlineAfter: [avgHeadline, avgHeadline],
          textBefore: [currentSettings.textMinLineHeight, currentSettings.textMaxLineHeight],
          textAfter: [avgText, avgText]
        });
        
        setSettings({
          ...settings,
          [activeMode]: {
            ...settings[activeMode],
            headlineMinLineHeight: avgHeadline,
            headlineMaxLineHeight: avgHeadline,
            textMinLineHeight: avgText,
            textMaxLineHeight: avgText
          }
        });
      }
    } else {
      // UNSNAP FROM FLAT: If values are equal but we're NOT in flat mode, separate them
      if (currentSettings.headlineMinLineHeight === currentSettings.headlineMaxLineHeight &&
          currentSettings.textMinLineHeight === currentSettings.textMaxLineHeight) {
        
        // Spread them slightly (e.g., ±2%)
        const headlineSpread = Math.max(1, Math.round(currentSettings.headlineMinLineHeight * 0.02));
        const textSpread = Math.max(1, Math.round(currentSettings.textMinLineHeight * 0.02));
        
        console.log('[Non-flat mode] Separating sliders:', {
          headlineBefore: [currentSettings.headlineMinLineHeight, currentSettings.headlineMaxLineHeight],
          headlineAfter: [currentSettings.headlineMinLineHeight - headlineSpread, currentSettings.headlineMaxLineHeight + headlineSpread],
          textBefore: [currentSettings.textMinLineHeight, currentSettings.textMaxLineHeight],
          textAfter: [currentSettings.textMinLineHeight - textSpread, currentSettings.textMaxLineHeight + textSpread]
        });
        
        setSettings({
          ...settings,
          [activeMode]: {
            ...settings[activeMode],
            headlineMinLineHeight: currentSettings.headlineMinLineHeight - headlineSpread,
            headlineMaxLineHeight: currentSettings.headlineMaxLineHeight + headlineSpread,
            textMinLineHeight: currentSettings.textMinLineHeight - textSpread,
            textMaxLineHeight: currentSettings.textMaxLineHeight + textSpread
          }
        });
      }
    }
  }, [lineHeightCurve, activeMode]); // Run when curve or mode changes
  
  useEffect(() => {
    const currentSettings = settings[activeMode];
    
    if (letterSpacingCurve === 'flat') {
      // SNAP TO FLAT: Snap active letter spacing sliders to their average
      const nextModeSettings = { ...currentSettings };
      if (isLetterSpacingSplit) {
        const headingAvg = parseFloat(((currentSettings.headingLetterSpacing + currentSettings.headingMaxLetterSpacing) / 2).toFixed(2));
        const textAvg = parseFloat(((currentSettings.textLetterSpacing + currentSettings.textMaxLetterSpacing) / 2).toFixed(2));
        nextModeSettings.headingLetterSpacing = headingAvg;
        nextModeSettings.headingMaxLetterSpacing = headingAvg;
        nextModeSettings.textLetterSpacing = textAvg;
        nextModeSettings.textMaxLetterSpacing = textAvg;
      } else {
        const avg = parseFloat(((currentSettings.letterSpacing + currentSettings.maxLetterSpacing) / 2).toFixed(2));
        nextModeSettings.letterSpacing = avg;
        nextModeSettings.maxLetterSpacing = avg;
      }
      
      setSettings({
        ...settings,
        [activeMode]: nextModeSettings
      });
    } else {
      // UNSNAP FROM FLAT: if active values are equal but curve is not flat, separate them slightly.
      if (isLetterSpacingSplit) {
        const headingLocked = currentSettings.headingLetterSpacing === currentSettings.headingMaxLetterSpacing;
        const textLocked = currentSettings.textLetterSpacing === currentSettings.textMaxLetterSpacing;
        if (headingLocked || textLocked) {
          const nextModeSettings = { ...currentSettings };
          if (headingLocked) {
            const headingSpread = Math.max(0.01, parseFloat((Math.abs(currentSettings.headingLetterSpacing) * 0.05).toFixed(2)));
            nextModeSettings.headingLetterSpacing = parseFloat((currentSettings.headingLetterSpacing - headingSpread).toFixed(2));
            nextModeSettings.headingMaxLetterSpacing = parseFloat((currentSettings.headingMaxLetterSpacing + headingSpread).toFixed(2));
          }
          if (textLocked) {
            const textSpread = Math.max(0.01, parseFloat((Math.abs(currentSettings.textLetterSpacing) * 0.05).toFixed(2)));
            nextModeSettings.textLetterSpacing = parseFloat((currentSettings.textLetterSpacing - textSpread).toFixed(2));
            nextModeSettings.textMaxLetterSpacing = parseFloat((currentSettings.textMaxLetterSpacing + textSpread).toFixed(2));
          }

          setSettings({
            ...settings,
            [activeMode]: nextModeSettings
          });
        }
      } else if (currentSettings.letterSpacing === currentSettings.maxLetterSpacing) {
        const spread = Math.max(0.01, parseFloat((Math.abs(currentSettings.letterSpacing) * 0.05).toFixed(2)));
        setSettings({
          ...settings,
          [activeMode]: {
            ...settings[activeMode],
            letterSpacing: parseFloat((currentSettings.letterSpacing - spread).toFixed(2)),
            maxLetterSpacing: parseFloat((currentSettings.maxLetterSpacing + spread).toFixed(2))
          }
        });
      }
    }
  }, [letterSpacingCurve, activeMode, isLetterSpacingSplit]); // Only run when curve changes

  // --- NEW: State for Rounding Dropdown in Styles Header ---
  const [isRoundingDropdownOpen, setIsRoundingDropdownOpen] = useState(false);
  const roundingDropdownRef = useRef<HTMLDivElement>(null);
  // --- END NEW State ---

  // Use the custom hook for the rounding dropdown
  useClickOutside(roundingDropdownRef, () => {
    if (isRoundingDropdownOpen) {
      setIsRoundingDropdownOpen(false);
    }
  }, isRoundingDropdownOpen);

  // --- NEW: State for Base Size Preset Dropdown in Base Size Header ---
  const [isBaseSizePresetOpen, setIsBaseSizePresetOpen] = useState(false);
  const baseSizePresetDropdownRef = useRef<HTMLDivElement>(null);
  const baseSizePresetOptions = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26];
  // --- END NEW State ---

  // Use the custom hook for the base size preset dropdown
  useClickOutside(baseSizePresetDropdownRef, () => {
    if (isBaseSizePresetOpen) {
      setIsBaseSizePresetOpen(false);
    }
  }, isBaseSizePresetOpen);

  // --- NEW: State to track dragging of individual CustomSingleSliders ---
  // const [isBaseSizeSliderDragging, setIsBaseSizeSliderDragging] = useState(false); // Intentionally leaving as manually removable for now
  // const [isScaleRatioSliderDragging, setIsScaleRatioSliderDragging] = useState(false); // Intentionally leaving as manually removable for now
  // --- END NEW State ---

  // --- ADDED: State for scanned text styles from a frame ---
  const [scannedFrameTextStyles, setScannedFrameTextStyles] = useState<DetectedTextStyle[] | null>(null);
  // --- END ADDED State ---

  // --- ADDED: State for loaded API key from storage ---
  const [loadedApiKey, setLoadedApiKey] = useState<string | null>(null);
  // --- END ADDED State ---

  // --- ADDED: State for explicitly calculated target system for ScanResultsScreen ---
  const [explicitTargetSystemForScan, setExplicitTargetSystemForScan] = useState<TypographySystem | null>(null);
  // --- END ADDED State ---
  const [autoScanOnMatchOpen, setAutoScanOnMatchOpen] = useState(false);
  const [useSampledStyleVisibility, setUseSampledStyleVisibility] = useState(false);

  // --- ADDED: State for unformatted text flow ---
  const [unformattedTextToStyle, setUnformattedTextToStyle] = useState<string>("");
  const [unformattedTextContentType, setUnformattedTextContentType] = useState<string>(""); // ADDED: For new text input flow
  const [smartMatchResults, setSmartMatchResults] = useState<any[] | null>(null);
  // --- END ADDED State ---



  // --- NEW: State for Weight Mapping Dialog ---
  const [weightMappingDialog, setWeightMappingDialog] = useState<{
    isOpen: boolean;
    data: any;
    originalRequest: any;
  }>({
    isOpen: false,
    data: null,
    originalRequest: null
  });

  // --- NEW: State for Variable Mapping Dialog ---
  const [variableMappingDialog, setVariableMappingDialog] = useState<{
    isOpen: boolean;
    data: any;
  }>({
    isOpen: false,
    data: null,
  });
  // --- END NEW State ---

  // --- NEW: State for Unified Update Dialog ---
  const [unifiedUpdateDialog, setUnifiedUpdateDialog] = useState<{
    isOpen: boolean;
    data: any;
  }>({
    isOpen: false,
    data: null,
  });
  // --- END NEW State ---

  // --- Specimen import confirmation modal state ---
  const [pendingSpecimenSnapshot, setPendingSpecimenSnapshot] = useState<SpecimenSnapshot | null>(null);

  // Shared restoration logic for specimen snapshots (used by both event listener and confirmation modal)
  const restoreSpecimenSnapshot = useCallback((data: SpecimenSampledEvent) => {
    const { snapshot } = data;
    console.log('[ui.tsx] Restoring specimen:', snapshot.fonts.primaryFontFamily, snapshot.fonts.primaryFontStyle);
    
    isRestoringSnapshotRef.current = true;
    
    setSettings({
      desktop: normalizeModeSettings({
        ...(snapshot.typography.desktop as TypographyModeSettings),
        scaleRatio: clampScaleRatio(snapshot.typography.desktop.scaleRatio),
      }),
      mobile: normalizeModeSettings({
        ...(snapshot.typography.mobile as TypographyModeSettings),
        scaleRatio: clampScaleRatio(snapshot.typography.mobile.scaleRatio),
      }),
    });
    
    setSecondaryFontLinked(snapshot.fonts.secondaryFontLinked ?? true);
    setSecondaryWeightLinked(snapshot.fonts.secondaryWeightLinked ?? true);
    
    setFontFamily(snapshot.fonts.primaryFontFamily);
    if (snapshot.fonts.primaryFontStyle) {
      setPendingStyleSelection(snapshot.fonts.primaryFontStyle);
    }
    emit("GET_STYLES_FOR_FAMILY", snapshot.fonts.primaryFontFamily);
    
    if (snapshot.fonts.secondaryFontEnabled && snapshot.fonts.secondaryFontFamily) {
      setSecondaryFontEnabled(true);
      setSecondaryFontFamily(snapshot.fonts.secondaryFontFamily);
      if (snapshot.fonts.secondaryFontStyle) {
        setPendingSecondaryStyleSelection(snapshot.fonts.secondaryFontStyle);
      }
      emit("GET_STYLES_FOR_FAMILY", snapshot.fonts.secondaryFontFamily);
    } else {
      setSecondaryFontEnabled(false);
    }
    
    if (snapshot.ui.previewThemeId) {
      setPreviewTheme(
        snapshot.ui.previewThemeId as any,
        snapshot.ui.customPreviewColors ?? undefined
      );
    } else {
      setColorMode(snapshot.ui.colorMode);
    }
    setShowSpecLabels(snapshot.ui.showSpecLabels);
    setNamingConvention(snapshot.ui.namingConvention);
    setLineHeightUnit(snapshot.ui.lineHeightUnit);
    setRoundingGridSize(snapshot.ui.roundingGridSize);
    setActiveMode(snapshot.ui.activeMode);
    setSelectedLayout(snapshot.ui.selectedLayout || 'specimenCompact');
    setPreviewTextAlign(snapshot.ui.previewTextAlign || 'left');
    if (snapshot.ui.waterfallText) {
      setWaterfallText(snapshot.ui.waterfallText);
    }
    setSelectedPresetProfile(
      snapshot.ui.selectedPresetProfile
      || (snapshot.ui.activeMode === 'mobile' ? 'mobile' : 'desktop')
    );
    setLineHeightCurve(snapshot.ui.lineHeightCurve as any);
    setLetterSpacingCurve(snapshot.ui.letterSpacingCurve as any);
    
    const hasSampledVisibility = !!snapshot.styleVisibility && Object.keys(snapshot.styleVisibility).length > 0;
    if (hasSampledVisibility) {
      setStyleVisibility(snapshot.styleVisibility);
    }
    setStyleFontSources(snapshot.styleFontSources);
    setUseSampledStyleVisibility(hasSampledVisibility);
    
    const hasSnapshotStyles = !!snapshot.styles && Object.keys(snapshot.styles).length > 0;
    let hasOverrides = false;
    if (hasSnapshotStyles) {
      setFineTunedStyles(snapshot.styles);

      // Infer generator-level case from snapshot styles.
      // If all styles in a group share the same case, treat it as generator-level.
      const inferGroupCase = (keys: readonly string[]): string => {
        const cases = keys
          .filter(k => snapshot.styles[k])
          .map(k => (snapshot.styles[k] as any).textCase || 'Original');
        if (cases.length === 0) return 'Original';
        return cases.every((c: string) => c === cases[0]) ? cases[0] : 'Original';
      };
      const inferredHeadingCase = inferGroupCase(TYPOGRAPHY_SCALE_ORDER.HEADINGS as readonly string[]);
      const inferredTextCase = inferGroupCase(TYPOGRAPHY_SCALE_ORDER.TEXT_STYLES as readonly string[]);
      setGeneratorHeadingCase(inferredHeadingCase);
      setGeneratorTextCase(inferredTextCase);

      const headingKeysRestore = new Set<string>(TYPOGRAPHY_SCALE_ORDER.HEADINGS as readonly string[]);
      hasOverrides = Object.entries(snapshot.styles).some(([key, style]: [string, any]) => {
        if (style.customName) return true;
        const expectedCase = headingKeysRestore.has(key) ? inferredHeadingCase : inferredTextCase;
        return style.textCase && style.textCase !== expectedCase && style.textCase !== 'none';
      });
    }

    const hasCustomFontSources = snapshot.styleFontSources
      ? Object.values(snapshot.styleFontSources).some(s => s === 'custom')
      : false;
    
    setPreviewExists(data.previewExists ?? false);
    setActiveFlow('generator');
    setCurrentView('main');
    
    // Preserve imported numeric values so follow-up recalculations do not overwrite
    // restored snapshot values (size/lineHeight/letterSpacing).
    if (hasSnapshotStyles) {
      setPreserveImportedNumericAxes({
        size: true,
        lineHeight: true,
        letterSpacing: true,
      });
    } else {
      setPreserveImportedNumericAxes({
        size: false,
        lineHeight: false,
        letterSpacing: false,
      });
    }

    // Only flag manual grid edits for actual per-style overrides (custom names,
    // per-style case deviations, custom font sources), NOT merely because the
    // snapshot contains styles with calculated values.
    setHasManualGridEdits(hasOverrides || hasCustomFontSources);

    if (hasOverrides || hasCustomFontSources) {
      setGeneratorTab('styles');
    }
    
    console.log('[ui.tsx] Specimen settings restored');
  }, [
    setSettings, setFontFamily, setSelectedStyle, 
    setSecondaryFontEnabled, setSecondaryFontFamily, setSecondarySelectedStyle,
    setSecondaryFontLinked, setSecondaryWeightLinked,
    setColorMode, setPreviewTheme, setShowSpecLabels, setNamingConvention, 
    setLineHeightUnit, setRoundingGridSize, setActiveMode,
    setSelectedLayout, setWaterfallText,
    setSelectedPresetProfile,
    setLineHeightCurve, setLetterSpacingCurve,
    setStyleVisibility, setStyleFontSources,
    setHasManualGridEdits, setPreviewExists, setActiveFlow, setCurrentView,
    setGeneratorTab, setFineTunedStyles, clampScaleRatio, normalizeModeSettings
  ]);

  // --- Specimen Sampling: Listen for SPECIMEN_SAMPLED from backend ---
  useEffect(() => {
    const handler = on('SPECIMEN_SAMPLED', (data: SpecimenSampledEvent) => {
      restoreSpecimenSnapshot(data);
    });
    return () => handler();
  }, [restoreSpecimenSnapshot]);
  // --- END Specimen Sampling ---

  // --- Smart Import: SPECIMEN_DETECTED shows confirmation modal ---
  useEffect(() => {
    const handler = on('SPECIMEN_DETECTED', (data: SpecimenSampledEvent) => {
      setPendingSpecimenSnapshot(data.snapshot);
    });
    return () => handler();
  }, []);

  // --- Smart Import: NO_SPECIMEN_START_SCAN triggers scan flow ---
  useEffect(() => {
    const handler = on('NO_SPECIMEN_START_SCAN', () => {
      setAutoScanOnMatchOpen(true);
      setCurrentView('scanResults');
    });
    return () => handler();
  }, [setCurrentView]);

  // --- Smart Import: User confirms specimen load ---
  const handleConfirmSpecimenLoad = useCallback(() => {
    if (!pendingSpecimenSnapshot) return;
    setPendingSpecimenSnapshot(null);
    restoreSpecimenSnapshot({ snapshot: pendingSpecimenSnapshot, previewExists: true });
  }, [pendingSpecimenSnapshot, restoreSpecimenSnapshot]);

  const handleCancelSpecimenLoad = useCallback(() => {
    setPendingSpecimenSnapshot(null);
  }, []);

  // --- ADDED: Callback to handle Apply Complete for navigation AND state update ---
  const handleApplyCompleteAndNavigate = useCallback((data: { 
    nodesChanged?: number;
    appliedToFrame?: boolean;
    estimatedRatio?: number; 
    baseSizeInPx?: number; 
    largeSizeInPx?: number; 
    primaryScannedFontFamily?: string;
    primaryScannedFontStyle?: string;
    secondaryScannedFontFamily?: string;
    secondaryScannedFontStyle?: string;
    detectedNamingConvention?: string;
    mappedStyleNames?: string[];
    mappedSystemName?: string;
  }) => {
    console.log('[ui.tsx] handleApplyCompleteAndNavigate called with:', data);

    // When scanning a non-specimen frame while an existing specimen is active,
    // disconnect the old preview FIRST so that state changes (font, visibility)
    // don't cascade to the existing specimen on canvas.
    const isNonSpecimenScan = data.appliedToFrame === true;
    if (isNonSpecimenScan && previewExists) {
      console.log('[ui.tsx] Disconnecting active specimen before applying scan results');
      setPreviewExists(false);
    }

    if (currentView === 'scanResults') {
      setActiveFlow('frameScan');
    }

    let newSettings = { ...settings };
    let modeSettingsChanged = false;

    if (data.estimatedRatio !== undefined) {
      newSettings[activeMode].scaleRatio = clampScaleRatio(data.estimatedRatio);
      modeSettingsChanged = true;
      console.log(`[ui.tsx] Updated scale ratio for ${activeMode} mode to:`, newSettings[activeMode].scaleRatio);
    }

    if (data.baseSizeInPx !== undefined) {
      newSettings[activeMode].baseSize = data.baseSizeInPx;
      modeSettingsChanged = true;
      console.log(`[ui.tsx] Updated base size for ${activeMode} mode to:`, data.baseSizeInPx);
    }

    if (data.largeSizeInPx !== undefined) {
      newSettings[activeMode].maxSize = data.largeSizeInPx;
      modeSettingsChanged = true;
      console.log(`[ui.tsx] Updated max size for ${activeMode} mode to:`, data.largeSizeInPx);
    }

    if (modeSettingsChanged) {
      setSettings(newSettings);
    }

    const isNonSpecimenFrameApply = data.appliedToFrame === true;
    if (isNonSpecimenFrameApply) {
      // Non-specimen scan/apply is not a manual grid override import.
      setHasManualGridEdits(false);
      setPreserveImportedNumericAxes({
        size: false,
        lineHeight: false,
        letterSpacing: false,
      });
    } else {
      // Specimen/UI-import flow preserves imported style values as overrides.
      setHasManualGridEdits(true);
      setPreserveImportedNumericAxes({
        size: true,
        lineHeight: true,
        letterSpacing: true,
      });
    }

    // Keep global font controls aligned with scanned frame metadata.
    if (data.primaryScannedFontFamily) {
      setFontFamily(data.primaryScannedFontFamily);
      if (data.primaryScannedFontStyle) {
        setPendingStyleSelection(data.primaryScannedFontStyle);
      }
      emit("GET_STYLES_FOR_FAMILY", data.primaryScannedFontFamily);
    }

    if (data.secondaryScannedFontFamily) {
      const primaryFamily = data.primaryScannedFontFamily || fontFamily;
      const primaryStyle = data.primaryScannedFontStyle || selectedStyle;
      const shouldUnlinkSecondary =
        data.secondaryScannedFontFamily !== primaryFamily
        || !!(data.secondaryScannedFontStyle && data.secondaryScannedFontStyle !== primaryStyle);

      setSecondaryFontEnabled(true);
      setSecondaryFontFamily(data.secondaryScannedFontFamily);
      if (data.secondaryScannedFontStyle) {
        setPendingSecondaryStyleSelection(data.secondaryScannedFontStyle);
      }

      if (shouldUnlinkSecondary) {
        setSecondaryFontLinked(false);
        setSecondaryWeightLinked(false);
      }

      emit("GET_STYLES_FOR_FAMILY", data.secondaryScannedFontFamily);
    }

    // Handle detected naming convention
    if (data.detectedNamingConvention) {
      console.log(`[ui.tsx] Setting naming convention to detected system: ${data.detectedNamingConvention}`);
      setNamingConvention(data.detectedNamingConvention);
    }

    // Preserve "few styles visible" from scan/match results.
    if (data.mappedStyleNames && data.mappedStyleNames.length > 0) {
      const systemForMapping = data.mappedSystemName || data.detectedNamingConvention || namingConvention;
      const visibleInternalKeys = new Set<string>();
      data.mappedStyleNames.forEach((displayName) => {
        const internalKey = getInternalKeyForDisplayName(displayName, systemForMapping || 'Default Naming');
        if (internalKey) visibleInternalKeys.add(internalKey);
      });

      if (visibleInternalKeys.size > 0) {
        const nextVisibility: Record<string, boolean> = {};
        const keysToMap = Object.keys(fineTunedStyles).length > 0
          ? Object.keys(fineTunedStyles)
          : [...TYPOGRAPHY_SCALE_ORDER.ALL_STYLES];
        keysToMap.forEach((key) => {
          nextVisibility[key] = visibleInternalKeys.has(key);
        });
        setStyleVisibility(nextVisibility);
        setUseSampledStyleVisibility(true);
      }
    }

    setCurrentView('main');
    setGeneratorTab(isNonSpecimenFrameApply ? 'generate' : 'styles');
    setPreviewExists(true);
  }, [activeMode, settings, setSettings, setFontFamily, setPendingStyleSelection, fontFamily, selectedStyle, setSecondaryFontEnabled, setSecondaryFontFamily, setPendingSecondaryStyleSelection, setSecondaryFontLinked, setSecondaryWeightLinked, currentView, setActiveFlow, setNamingConvention, clampScaleRatio, namingConvention, fineTunedStyles, setStyleVisibility, setHasManualGridEdits, setGeneratorTab, previewExists]);
  // --- END ADDED Callback ---

  // --- SYSTEM-AWARE Dot Values for Sliders ---
  const allTextMainTicks = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26];
  const textMainSliderDotValues = allTextMainTicks.filter(val => val > 12 && val < 26); // Remove ticks at slider min (12) and max (26)
  const ratioSliderDotValues = Object.values(PRESET_RATIOS_MAP).filter(val => val > SCALE_RATIO_MIN && val < SCALE_RATIO_MAX); // Remove ticks at slider min/max

  // NEW: System-aware slider dot values that adapt to available styles
  const getAvailableStylesForSlider = useCallback((styleKeys: string[]) => {
    const availableStyles: string[] = [];
    for (const key of styleKeys) {
      const conventionName = getConventionName(key, namingConvention);
      // Only include styles that have a valid convention name AND are visible
      if (conventionName && conventionName !== '' && styleVisibility[key] === true) {
        availableStyles.push(key);
      }
    }
    return availableStyles;
  }, [namingConvention, styleVisibility]);

  // Get ALL styles for a category (ignoring visibility) - used for anchor calculations and labels
  const getAllStylesForSlider = useCallback((styleKeys: string[]) => {
    const allStyles: string[] = [];
    for (const key of styleKeys) {
      const conventionName = getConventionName(key, namingConvention);
      // Only check for valid convention name, ignore visibility
      if (conventionName && conventionName !== '') {
        allStyles.push(key);
      }
    }
    return allStyles;
  }, [namingConvention]);

  const getNamingVisibilityMap = useCallback(() => {
    const newVisibility: { [key: string]: boolean } = {};
    const usedNames = new Set<string>();
    const sortedKeys = [...TYPOGRAPHY_SCALE_ORDER.ALL_STYLES].sort(
      (a, b) => (TYPOGRAPHY_SCALE_POINTS[b] ?? 0) - (TYPOGRAPHY_SCALE_POINTS[a] ?? 0)
    );

    for (const key of sortedKeys) {
      const conventionName = getConventionName(key, namingConvention);
      if (conventionName && !usedNames.has(conventionName)) {
        usedNames.add(conventionName);
        newVisibility[key] = true;
      } else {
        newVisibility[key] = false;
      }
    }
    return newVisibility;
  }, [namingConvention]);

  const getVisibilityForPreset = useCallback((presetId: PresetProfileId) => {
    const namingVisibility = getNamingVisibilityMap();
    const visibleKeys = new Set(PRESET_PROFILE_VISIBLE_KEYS[presetId]);
    const nextVisibility: { [key: string]: boolean } = {};
    Object.keys(namingVisibility).forEach((key) => {
      nextVisibility[key] = namingVisibility[key] && visibleKeys.has(key);
    });
    return nextVisibility;
  }, [getNamingVisibilityMap]);

  const applyPresetProfile = useCallback((presetId: PresetProfileId) => {
    const targetMode: 'desktop' | 'mobile' =
      presetId === 'mobile' ? 'mobile' : presetId === 'desktop' ? 'desktop' : activeMode;
    const fullBaseline = getPresetBaselineModeSettings(targetMode, presetId);

    setSelectedPresetProfile(presetId);
    setUseSampledStyleVisibility(false);
    setHasManualGridEdits(false);
    setPreserveImportedNumericAxes({
      size: false,
      lineHeight: false,
      letterSpacing: false,
    });
    setUserChangedSincePreset(false);

    setSettings((prevSettings) => {
      const applied: TypographyModeSettings = {
        ...prevSettings[targetMode],
        baseSize: fullBaseline.baseSize,
        scaleRatio: fullBaseline.scaleRatio,
        letterSpacing: fullBaseline.letterSpacing,
        maxLetterSpacing: fullBaseline.maxLetterSpacing,
        headingLetterSpacing: fullBaseline.headingLetterSpacing,
        headingMaxLetterSpacing: fullBaseline.headingMaxLetterSpacing,
        textLetterSpacing: fullBaseline.textLetterSpacing,
        textMaxLetterSpacing: fullBaseline.textMaxLetterSpacing,
        headlineMinLineHeight: fullBaseline.headlineMinLineHeight,
        headlineMaxLineHeight: fullBaseline.headlineMaxLineHeight,
        textMinLineHeight: fullBaseline.textMinLineHeight,
        textMaxLineHeight: fullBaseline.textMaxLineHeight,
        maxSize: fullBaseline.maxSize,
        minSize: fullBaseline.minSize,
      };
      presetBaselineSnapshotRef.current = { ...applied };
      return { ...prevSettings, [targetMode]: applied };
    });

    if (presetId === 'mobile' || presetId === 'desktop') {
      setActiveMode(targetMode);
    }
  }, [activeMode, getPresetBaselineModeSettings, setSettings, setHasManualGridEdits, setActiveMode]);

  const getTickNormalizedSystem = useCallback(() => {
    // Always use FULL style range for anchor computation (ignoring visibility).
    // Visibility only affects grid display/export, not the interpolation range.
    const headlineStyles = [...TYPOGRAPHY_SCALE_ORDER.HEADINGS];
    const textStyles = [...TYPOGRAPHY_SCALE_ORDER.TEXT_STYLES];
    const allHeadlines = getAllStylesForSlider(headlineStyles);
    const allTextStyles = getAllStylesForSlider(textStyles);

    const availableStyleAnchors =
      allHeadlines.length > 0 && allTextStyles.length > 0
        ? {
            headlineMax: [...allHeadlines].sort(
              (a, b) => (TYPOGRAPHY_SCALE_POINTS[b] ?? 0) - (TYPOGRAPHY_SCALE_POINTS[a] ?? 0),
            )[0],
            headlineMin: [...allHeadlines].sort(
              (a, b) => (TYPOGRAPHY_SCALE_POINTS[b] ?? 0) - (TYPOGRAPHY_SCALE_POINTS[a] ?? 0),
            )[allHeadlines.length - 1],
            textMax: [...allTextStyles].sort(
              (a, b) => (TYPOGRAPHY_SCALE_POINTS[b] ?? 0) - (TYPOGRAPHY_SCALE_POINTS[a] ?? 0),
            )[0],
            textMin: [...allTextStyles].sort(
              (a, b) => (TYPOGRAPHY_SCALE_POINTS[b] ?? 0) - (TYPOGRAPHY_SCALE_POINTS[a] ?? 0),
            )[allTextStyles.length - 1],
          }
        : undefined;

    return calculateStyles({
      modeSettings: settings[activeMode],
      fontFamily: getEffectiveFontFamily(),
      fontStyle: getEffectiveWeight(),
      lineHeightCurve,
      letterSpacingCurve,
      letterSpacingSplit: isLetterSpacingSplit,
      availableStyleAnchors,
      secondaryFontFamily: secondaryFontEnabled ? getEffectiveSecondaryFontFamily() : undefined,
      secondaryFontStyle: secondaryFontEnabled ? getEffectiveSecondaryWeight() : undefined,
    });
  }, [
    settings,
    activeMode,
    lineHeightCurve,
    letterSpacingCurve,
    isLetterSpacingSplit,
    getAllStylesForSlider,
    TYPOGRAPHY_SCALE_POINTS,
    getEffectiveFontFamily,
    getEffectiveWeight,
    secondaryFontEnabled,
    getEffectiveSecondaryFontFamily,
    getEffectiveSecondaryWeight,
  ]);

  // Calculate dot values for headline line heights - system aware
  const headlineDotValues = useMemo(() => {
    const headlineStyles = [...TYPOGRAPHY_SCALE_ORDER.HEADINGS];
    const availableHeadlines = getAvailableStylesForSlider(headlineStyles);
    
    if (availableHeadlines.length < 1) {
      return []; // Need at least 1 point for meaningful dots
    }

    const normalizedStyles = getTickNormalizedSystem();
    const dotValues: number[] = [];
    for (const styleKey of availableHeadlines) {
      const style = normalizedStyles[styleKey];
      if (style && style.lineHeight) {
        const lineHeightPercent = style.lineHeight * 100;
        if (lineHeightPercent >= 80 && lineHeightPercent <= 200) {
          dotValues.push(lineHeightPercent);
        }
      }
    }
    
    return Array.from(new Set(dotValues)).sort((a, b) => a - b);
  }, [getAvailableStylesForSlider, getTickNormalizedSystem]);

  // Calculate dot values for text line heights - system aware
  const textLineHeightDotValues = useMemo(() => {
    const textStyles = [...TYPOGRAPHY_SCALE_ORDER.TEXT_STYLES];
    const availableTextStyles = getAvailableStylesForSlider(textStyles);
    
    if (availableTextStyles.length < 1) {
      return [];
    }

    const normalizedStyles = getTickNormalizedSystem();
    const dotValues: number[] = [];
    for (const styleKey of availableTextStyles) {
      const style = normalizedStyles[styleKey];
      if (style && style.lineHeight) {
        const lineHeightPercent = style.lineHeight * 100;
        if (lineHeightPercent >= 80 && lineHeightPercent <= 200) {
          dotValues.push(lineHeightPercent);
        }
      }
    }
    
    return Array.from(new Set(dotValues)).sort((a, b) => a - b);
  }, [getAvailableStylesForSlider, getTickNormalizedSystem]);

  // Calculate dot values for letter spacing - system aware
  const letterSpacingDotValues = useMemo(() => {
    const allStyles = [...TYPOGRAPHY_SCALE_ORDER.ALL_STYLES];
    const availableStyles = getAvailableStylesForSlider(allStyles);
    
    if (availableStyles.length < 1) {
      return [];
    }

    const normalizedStyles = getTickNormalizedSystem();
    const dotValues: number[] = [];
    for (const styleKey of availableStyles) {
      const style = normalizedStyles[styleKey];
      if (style && typeof style.letterSpacing === 'number') {
        dotValues.push(style.letterSpacing);
      }
    }
    
    return Array.from(new Set(dotValues)).sort((a, b) => a - b);
  }, [getAvailableStylesForSlider, getTickNormalizedSystem]);

  const headingLetterSpacingDotValues = useMemo(() => {
    const headlineStyles = [...TYPOGRAPHY_SCALE_ORDER.HEADINGS];
    const availableHeadlines = getAvailableStylesForSlider(headlineStyles);
    if (availableHeadlines.length < 1) {
      return [];
    }
    const normalizedStyles = getTickNormalizedSystem();
    const dotValues: number[] = [];
    for (const styleKey of availableHeadlines) {
      const style = normalizedStyles[styleKey];
      if (style && typeof style.letterSpacing === 'number') {
        dotValues.push(style.letterSpacing);
      }
    }
    return Array.from(new Set(dotValues)).sort((a, b) => a - b);
  }, [getAvailableStylesForSlider, getTickNormalizedSystem]);

  const textLetterSpacingDotValues = useMemo(() => {
    const textStyles = [...TYPOGRAPHY_SCALE_ORDER.TEXT_STYLES];
    const availableTextStyles = getAvailableStylesForSlider(textStyles);
    if (availableTextStyles.length < 1) {
      return [];
    }
    const normalizedStyles = getTickNormalizedSystem();
    const dotValues: number[] = [];
    for (const styleKey of availableTextStyles) {
      const style = normalizedStyles[styleKey];
      if (style && typeof style.letterSpacing === 'number') {
        dotValues.push(style.letterSpacing);
      }
    }
    return Array.from(new Set(dotValues)).sort((a, b) => a - b);
  }, [getAvailableStylesForSlider, getTickNormalizedSystem]);

  // Get dynamic anchor labels for sliders from currently visible styles.
  const getSliderAnchorLabels = useCallback((type: 'headline' | 'text') => {
    const styleKeys = type === 'headline'
      ? [...TYPOGRAPHY_SCALE_ORDER.HEADINGS]
      : [...TYPOGRAPHY_SCALE_ORDER.TEXT_STYLES];

    const stylesForAnchors = getAvailableStylesForSlider(styleKeys);

    if (stylesForAnchors.length === 0) {
      return { min: '', max: '' };
    }

    // Sort by scale points to get proper min/max
    const sortedStyles = stylesForAnchors.sort((a, b) =>
      (TYPOGRAPHY_SCALE_POINTS[b] ?? 0) - (TYPOGRAPHY_SCALE_POINTS[a] ?? 0)
    );

    const maxStyle = sortedStyles[0]; // Largest (highest scale point)
    const minStyle = sortedStyles[sortedStyles.length - 1]; // Smallest (lowest scale point)

    const getDisplayLabel = (styleKey: string) => {
      const conventionName = getConventionName(styleKey, namingConvention);
      return conventionName || getDisplayUIName(styleKey);
    };

    return {
      min: getDisplayLabel(minStyle),
      max: getDisplayLabel(maxStyle)
    };
  }, [getAvailableStylesForSlider, namingConvention, TYPOGRAPHY_SCALE_POINTS, getDisplayUIName]);

  // Get dynamic anchor styles for the typography calculator.
  // Always uses FULL style range (ignoring visibility) so the interpolation
  // range stays stable when the user hides/shows styles.
  const getDynamicAnchors = useCallback(() => {
    const headlineStyles = [...TYPOGRAPHY_SCALE_ORDER.HEADINGS];
    const textStyles = [...TYPOGRAPHY_SCALE_ORDER.TEXT_STYLES];

    const allHeadlines = getAllStylesForSlider(headlineStyles);
    const allTextStyles = getAllStylesForSlider(textStyles);

    // If no styles available, return undefined to use default anchors
    if (allHeadlines.length === 0 || allTextStyles.length === 0) {
      return undefined;
    }

    // Sort by scale points to get proper min/max
    const sortedHeadlines = allHeadlines.sort((a, b) =>
      (TYPOGRAPHY_SCALE_POINTS[b] ?? 0) - (TYPOGRAPHY_SCALE_POINTS[a] ?? 0)
    );
    const sortedTextStyles = allTextStyles.sort((a, b) =>
      (TYPOGRAPHY_SCALE_POINTS[b] ?? 0) - (TYPOGRAPHY_SCALE_POINTS[a] ?? 0)
    );

    return {
      headlineMax: sortedHeadlines[0], // Largest headline
      headlineMin: sortedHeadlines[sortedHeadlines.length - 1], // Smallest headline
      textMax: sortedTextStyles[0], // Largest text
      textMin: sortedTextStyles[sortedTextStyles.length - 1], // Smallest text
    };
  }, [getAllStylesForSlider, TYPOGRAPHY_SCALE_POINTS]);

  const baselineModeSettings = useMemo(
    () => presetBaselineSnapshotRef.current ?? getPresetBaselineModeSettings(activeMode, selectedPresetProfile),
    [getPresetBaselineModeSettings, activeMode, selectedPresetProfile, settings]
  );

  const hasModeSettingsDeviation = useMemo(() => {
    const current = settings[activeMode];
    return (
      numericDiffers(current.baseSize, baselineModeSettings.baseSize, 0.0001) ||
      numericDiffers(current.scaleRatio, baselineModeSettings.scaleRatio, 0.0001) ||
      numericDiffers(current.letterSpacing, baselineModeSettings.letterSpacing, 0.0001) ||
      numericDiffers(current.maxLetterSpacing, baselineModeSettings.maxLetterSpacing, 0.0001) ||
      numericDiffers(current.headingLetterSpacing, baselineModeSettings.headingLetterSpacing, 0.0001) ||
      numericDiffers(current.headingMaxLetterSpacing, baselineModeSettings.headingMaxLetterSpacing, 0.0001) ||
      numericDiffers(current.textLetterSpacing, baselineModeSettings.textLetterSpacing, 0.0001) ||
      numericDiffers(current.textMaxLetterSpacing, baselineModeSettings.textMaxLetterSpacing, 0.0001) ||
      numericDiffers(current.headlineMinLineHeight, baselineModeSettings.headlineMinLineHeight, 0.0001) ||
      numericDiffers(current.headlineMaxLineHeight, baselineModeSettings.headlineMaxLineHeight, 0.0001) ||
      numericDiffers(current.textMinLineHeight, baselineModeSettings.textMinLineHeight, 0.0001) ||
      numericDiffers(current.textMaxLineHeight, baselineModeSettings.textMaxLineHeight, 0.0001) ||
      numericDiffers(current.maxSize, baselineModeSettings.maxSize, 0.0001) ||
      numericDiffers(current.minSize, baselineModeSettings.minSize, 0.0001)
    );
  }, [settings, activeMode, baselineModeSettings, numericDiffers]);

  const headingKeysSet = useMemo(() => new Set<string>(TYPOGRAPHY_SCALE_ORDER.HEADINGS as readonly string[]), []);

  const getGeneratorCaseForStyle = useCallback((styleKey: string): string => {
    return headingKeysSet.has(styleKey) ? generatorHeadingCase : generatorTextCase;
  }, [headingKeysSet, generatorHeadingCase, generatorTextCase]);

  const hasStyleLevelOverrideDeviation = useMemo(() => {
    return [...TYPOGRAPHY_SCALE_ORDER.ALL_STYLES].some((key) => {
      const style = fineTunedStyles[key];
      if (!style) {
        return false;
      }
      const generatorCase = getGeneratorCaseForStyle(key);
      const hasCustomNaming = Boolean(style.customName) || (style.textCase ?? 'Original') !== generatorCase;
      const hasFontSourceOverride = (styleFontSources[key] ?? DEFAULT_STYLE_FONT_SOURCES[key]) !== DEFAULT_STYLE_FONT_SOURCES[key];
      const hasLockedWeight = Boolean(styleWeightLocked[key]);
      return hasCustomNaming || hasFontSourceOverride || hasLockedWeight;
    });
  }, [fineTunedStyles, styleFontSources, styleWeightLocked, getGeneratorCaseForStyle]);

  const setSettingsFromUI = useCallback((updater: any) => {
    setUserChangedSincePreset(true);
    setSettings(updater);
  }, [setSettings]);

  const hasGeneratorDeviationFromPreset = hasModeSettingsDeviation && userChangedSincePreset;
  // Shared signal used by both:
  // 1) Styles header reset CTA visibility
  // 2) Generate-tab overwrite modal when leaving Styles
  // Note: visibility changes are NOT overrides — hiding rows is a lightweight
  // UI preference (easy to spot, easy to undo), not a value-level tweak.
  const hasManualStyleTweaks = (
    hasManualGridEdits ||
    hasStyleLevelOverrideDeviation
  );

  // NEW: Handle dynamic anchor adjustment when sliders change
  const handleSliderAnchorAdjustment = useCallback((
    sliderType: 'headlineLineHeight' | 'textLineHeight' | 'letterSpacing' | 'headingLetterSpacing' | 'textLetterSpacing',
    newValues: [number, number]
  ) => {
    console.log(`[ui.tsx] handleSliderAnchorAdjustment called for ${sliderType} with values:`, newValues);
    
    const [minValue, maxValue] = newValues;
    let newSettings = { ...settings };
    let modeSettings = newSettings[activeMode];

    if (sliderType === 'headlineLineHeight') {
      // User touched line-height anchor slider: release imported line-height lock.
      setPreserveImportedNumericAxes((prev) => ({
        ...prev,
        lineHeight: false,
      }));
      // For headline line height: min is for largest style, max is for smallest style
      const headlineStyles = [...TYPOGRAPHY_SCALE_ORDER.HEADINGS];
      const availableHeadlines = getAvailableStylesForSlider(headlineStyles);
      
      console.log(`[ui.tsx] Available headlines for ${namingConvention}:`, availableHeadlines);
      
      // FIXED: Allow slider updates even with single style for user control
      if (availableHeadlines.length >= 1) {
        // Update the anchor values that control headline line height calculation
        modeSettings.headlineMinLineHeight = minValue; // Controls largest headlines
        modeSettings.headlineMaxLineHeight = maxValue; // Controls smallest headlines
      }
    } else if (sliderType === 'textLineHeight') {
      // User touched line-height anchor slider: release imported line-height lock.
      setPreserveImportedNumericAxes((prev) => ({
        ...prev,
        lineHeight: false,
      }));
      // For text line height: min is for largest text, max is for smallest text
      const textStyles = [...TYPOGRAPHY_SCALE_ORDER.TEXT_STYLES];
      const availableTextStyles = getAvailableStylesForSlider(textStyles);
      
      console.log(`[ui.tsx] Available text styles for ${namingConvention}:`, availableTextStyles);
      
      // FIXED: Allow slider updates even with single style for user control
      if (availableTextStyles.length >= 1) {
        // Update the anchor values that control text line height calculation
        modeSettings.textMinLineHeight = minValue; // Controls largest text styles
        modeSettings.textMaxLineHeight = maxValue; // Controls smallest text styles
      }
    } else if (sliderType === 'letterSpacing') {
      // User touched letter-spacing anchor slider: release imported letter-spacing lock.
      setPreserveImportedNumericAxes((prev) => ({
        ...prev,
        letterSpacing: false,
      }));
      // For letter spacing: first value is max spacing (large styles), second is min spacing (small styles)
      const allStyles = [...TYPOGRAPHY_SCALE_ORDER.ALL_STYLES];
      const availableStyles = getAvailableStylesForSlider(allStyles);
      
      console.log(`[ui.tsx] Available styles for letter spacing in ${namingConvention}:`, availableStyles);
      
      // FIXED: Allow slider updates even with single style for user control
      if (availableStyles.length >= 1) {
        // Update the anchor values that control letter spacing calculation
        modeSettings.maxLetterSpacing = minValue; // Controls largest styles (first slider handle)
        modeSettings.letterSpacing = maxValue; // Controls smallest styles (second slider handle)
      }
    } else if (sliderType === 'headingLetterSpacing') {
      setPreserveImportedNumericAxes((prev) => ({
        ...prev,
        letterSpacing: false,
      }));
      modeSettings.headingMaxLetterSpacing = minValue;
      modeSettings.headingLetterSpacing = maxValue;
    } else if (sliderType === 'textLetterSpacing') {
      setPreserveImportedNumericAxes((prev) => ({
        ...prev,
        letterSpacing: false,
      }));
      modeSettings.textMaxLetterSpacing = minValue;
      modeSettings.textLetterSpacing = maxValue;
    }

    setUserChangedSincePreset(true);
    setSettings(newSettings);
    console.log(`[ui.tsx] Updated ${activeMode} settings for ${sliderType}:`, modeSettings);
  }, [settings, setSettings, activeMode, getAvailableStylesForSlider, namingConvention]);

  useEffect(() => {
    if (!hasManualGridEdits) {
      setPreserveImportedNumericAxes({
        size: false,
        lineHeight: false,
        letterSpacing: false,
      });
    }
  }, [hasManualGridEdits]);

  useEffect(() => {
    const wasSplit = prevLetterSpacingSplitRef.current;
    if (wasSplit === isLetterSpacingSplit) {
      return;
    }

    const currentModeSettings = settings[activeMode];
    if (isLetterSpacingSplit) {
      // Entering split mode: seed heading/text sliders from current generated anchor values.
      const anchors = getDynamicAnchors();
      const headingMaxFromStyles = anchors ? fineTunedStyles[anchors.headlineMax]?.letterSpacing : undefined;
      const headingMinFromStyles = anchors ? fineTunedStyles[anchors.headlineMin]?.letterSpacing : undefined;
      const textMaxFromStyles = anchors ? fineTunedStyles[anchors.textMax]?.letterSpacing : undefined;
      const textMinFromStyles = anchors ? fineTunedStyles[anchors.textMin]?.letterSpacing : undefined;
      // Round to nearest 0.25 to match slider step
      const snapLS = (v: number) => Math.round(v / 0.25) * 0.25;
      const seededHeadingLS = snapLS(typeof headingMinFromStyles === 'number' ? headingMinFromStyles : currentModeSettings.letterSpacing);
      const seededHeadingMaxLS = snapLS(typeof headingMaxFromStyles === 'number' ? headingMaxFromStyles : currentModeSettings.maxLetterSpacing);
      const seededTextLS = snapLS(typeof textMinFromStyles === 'number' ? textMinFromStyles : currentModeSettings.letterSpacing);
      const seededTextMaxLS = snapLS(typeof textMaxFromStyles === 'number' ? textMaxFromStyles : currentModeSettings.maxLetterSpacing);
      const nextModeSettings = {
        ...currentModeSettings,
        headingLetterSpacing: seededHeadingLS,
        headingMaxLetterSpacing: seededHeadingMaxLS,
        textLetterSpacing: seededTextLS,
        textMaxLetterSpacing: seededTextMaxLS,
      };
      setSettings({
        ...settings,
        [activeMode]: nextModeSettings,
      });
      // Update baseline so split-seeded values become the reset target
      const existingBaseline = presetBaselineSnapshotRef.current ?? getPresetBaselineModeSettings(activeMode, selectedPresetProfile);
      presetBaselineSnapshotRef.current = {
        ...existingBaseline,
        headingLetterSpacing: seededHeadingLS,
        headingMaxLetterSpacing: seededHeadingMaxLS,
        textLetterSpacing: seededTextLS,
        textMaxLetterSpacing: seededTextMaxLS,
      };
    } else {
      // Leaving split mode: merge back to a shared slider value, snapped to 0.25 step.
      const snapLS = (v: number) => Math.round(v / 0.25) * 0.25;
      const mergedMin = snapLS((currentModeSettings.headingLetterSpacing + currentModeSettings.textLetterSpacing) / 2);
      const mergedMax = snapLS((currentModeSettings.headingMaxLetterSpacing + currentModeSettings.textMaxLetterSpacing) / 2);
      setSettings({
        ...settings,
        [activeMode]: {
          ...currentModeSettings,
          letterSpacing: mergedMin,
          maxLetterSpacing: mergedMax,
        },
      });
      // Update baseline so merged values become the reset target
      const existingBaseline = presetBaselineSnapshotRef.current ?? getPresetBaselineModeSettings(activeMode, selectedPresetProfile);
      presetBaselineSnapshotRef.current = {
        ...existingBaseline,
        letterSpacing: mergedMin,
        maxLetterSpacing: mergedMax,
      };
    }

    prevLetterSpacingSplitRef.current = isLetterSpacingSplit;
  }, [isLetterSpacingSplit, settings, activeMode, setSettings, fineTunedStyles, getDynamicAnchors, getPresetBaselineModeSettings, selectedPresetProfile]);

  // Visibility changes are purely cosmetic (grid display / export).
  // Slider range values are NEVER modified by hiding/showing styles.
  // The calculator always interpolates across the full style range
  // via getDynamicAnchors / getAllStylesForSlider.

  // --- END SYSTEM-AWARE Dot Values ---

  // --- ADDED: State for active loading CTA ---
  const [activeLoadingCTA, setActiveLoadingCTA] = useState<string | null>(null);
  const activeLoadingCtaRef = useRef<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalMessage, setSuccessModalMessage] = useState('');
  const [hasActiveSpecimenContext, setHasActiveSpecimenContext] = useState(false);
  // --- END ADDED State ---

  useEffect(() => {
    activeLoadingCtaRef.current = activeLoadingCTA;
  }, [activeLoadingCTA]);

  // --- ADDED: Listener for OPERATION_COMPLETE ---
  useEffect(() => {
    const operationCompleteListener = on('OPERATION_COMPLETE', () => {
      const completedAction = activeLoadingCtaRef.current;
      console.log('[ui.tsx] Received OPERATION_COMPLETE. Clearing loading CTA.');
      setActiveLoadingCTA(null);
      if (completedAction === 'update') {
        setUnifiedUpdateDialog({ isOpen: false, data: null });
        setSuccessModalMessage('Styles updated successfully.');
        setShowSuccessModal(true);
      }
    });
    return () => {
      operationCompleteListener();
    };
  }, []); // Empty dependency array, runs once on mount
  // --- END ADDED Listener ---

  useEffect(() => {
    const activeSpecimenContextListener = on('ACTIVE_SPECIMEN_CONTEXT', (data: { hasActiveSpecimenContext: boolean }) => {
      setHasActiveSpecimenContext(!!data.hasActiveSpecimenContext);
    });
    return () => {
      activeSpecimenContextListener();
    };
  }, []);

  // --- Ref for main content and its original padding (for scroll locking) ---
  const mainContentRef = useRef<HTMLDivElement>(null);
  const originalPaddingRightRef = useRef<string>("");
  // --- END Ref ---

  // --- Refs to track previous slider values --- Moved here after ALL useState declarations ---
  const prevDesktopBaseSizeRef = useRef(desktop.baseSize);
  const prevDesktopScaleRatioRef = useRef(desktop.scaleRatio);
  // Line height split refs
  const prevDesktopHeadlineMinLineHeightRef = useRef(desktop.headlineMinLineHeight);
  const prevDesktopHeadlineMaxLineHeightRef = useRef(desktop.headlineMaxLineHeight);
  const prevDesktopTextMinLineHeightRef = useRef(desktop.textMinLineHeight);
  const prevDesktopTextMaxLineHeightRef = useRef(desktop.textMaxLineHeight);
  const prevDesktopLetterSpacingRef = useRef(desktop.letterSpacing);
  const prevDesktopMaxLetterSpacingRef = useRef(desktop.maxLetterSpacing);
  const prevDesktopMaxSizeRef = useRef(desktop.maxSize); // Correct name
  const prevDesktopMinSizeRef = useRef(desktop.minSize); // Correct name
  const prevDesktopInterpolationTypeRef = useRef(desktop.interpolationType); // Correct name
  // Mobile Refs
  const prevMobileBaseSizeRef = useRef(mobile.baseSize);
  const prevMobileScaleRatioRef = useRef(mobile.scaleRatio);
  // Line height split refs
  const prevMobileHeadlineMinLineHeightRef = useRef(mobile.headlineMinLineHeight);
  const prevMobileHeadlineMaxLineHeightRef = useRef(mobile.headlineMaxLineHeight);
  const prevMobileTextMinLineHeightRef = useRef(mobile.textMinLineHeight);
  const prevMobileTextMaxLineHeightRef = useRef(mobile.textMaxLineHeight);
  const prevMobileLetterSpacingRef = useRef(mobile.letterSpacing);
  const prevMobileMaxLetterSpacingRef = useRef(mobile.maxLetterSpacing);
  const prevMobileMaxSizeRef = useRef(mobile.maxSize); // Correct name
  const prevMobileMinSizeRef = useRef(mobile.minSize); // Correct name
  const prevMobileInterpolationTypeRef = useRef(mobile.interpolationType); // Correct name
  // Refs for shared state
  // REMOVE: const prevSizeOptionRef = useRef(sizeOption); // Keep this ref if sizeOption logic is still somewhere else?
  const prevFontFamilyRef = useRef(fontFamily); // <<< ADD Ref for font family
  // --- End Refs ---

  // --- Effect to reset layout if invalid for mode --- Add this ---
  useEffect(() => {
    if (activeMode === 'mobile' && selectedLayout === 'cleanWaterfall') { 
        console.log(`[ui.tsx] Mobile mode activated with invalid layout (${selectedLayout}). Resetting to specimenCompact.`);
      setSelectedLayout('specimenCompact'); // Reset to a valid mobile layout
    }
    // No need to reset for desktop as all layouts are valid
  }, [activeMode, selectedLayout]);
  // --- End Effect ---

  // --- Style Calculation Logic (Updated) ---
  // REMOVED the entire `calculateStyles` useCallback block. It is now imported.
  
  // --- Lifecycle Effects ---

  // Signal UI readiness on mount.
  // IMPORTANT: Register INITIAL_FONTS listener first so we never miss googleFonts payload.
  useEffect(() => {
    const handleInitialFonts = on('INITIAL_FONTS', (data: InitialFontsMessage) => {
      if (data.googleFonts) {
        setGoogleFontsList(data.googleFonts);
        console.log(`[ui.tsx] Received ${data.googleFonts.length} Google Font family names.`);
      }
    });

    console.log("[ui.tsx] UI Mounted. Emitting UI_READY.");
    emit("UI_READY");

    return () => {
      handleInitialFonts();
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  // --- NEW: Handle KeyDown for Grid Inputs ---
  const handleGridKeyDown = (event: KeyboardEvent, styleName: string, property: keyof TypographyStyle) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
      return; // Only handle arrow keys
    }

    event.preventDefault(); // Prevent default arrow key behavior

    const currentValueStyle = fineTunedStyles[styleName];
    if (!currentValueStyle) return; // Should not happen if rendered

    let step = 0;
    let shiftMultiplier: number | false = false; // Match slider settings per property
    let currentValue = 0;
    let precision = 0; // For floating point steps

    if (property === 'size') {
        step = 1; // Always use 1px increments for size input, regardless of baseline grid
        shiftMultiplier = false; // Disabled — steps are already big enough (matches base size slider)
        currentValue = currentValueStyle.size ?? 0;
        precision = 0;
    } else if (property === 'lineHeight') {
        if (lineHeightUnit === 'px') {
            step = 1; // Always use 1px increments for line height, regardless of baseline grid
            shiftMultiplier = 10; // Shift+Arrow = +10px
            const currentSize = currentValueStyle.size ?? 16;
            currentValue = (currentValueStyle.lineHeight ?? 1.2) * currentSize;
            precision = 0;
        } else {
            step = 5; 
            shiftMultiplier = 2; // Shift+Arrow = +10% (5 * 2)
            currentValue = (currentValueStyle.lineHeight ?? 1.3) * 100;
            precision = 0;
        }
    } else if (property === 'letterSpacing') {
        step = 0.25; // 0.25% per arrow
        shiftMultiplier = 4; // Shift+Arrow = +1.00% (matches letter spacing slider)
        currentValue = currentValueStyle.letterSpacing ?? 0;
        precision = 2; // Precision should be 2 for 0.25 steps
    } else {
        return; // Only handle specific numeric properties
    }

    const effectiveStep = (shiftMultiplier !== false && event.shiftKey) ? step * shiftMultiplier : step;
    const delta = event.key === 'ArrowUp' ? effectiveStep : -effectiveStep;
    let newValue = currentValue + delta;
    
    if (property === 'size' && newValue < 1) newValue = 1;
    if (property === 'lineHeight' && newValue < 1) newValue = 1; 

    const newValueString = newValue.toFixed(precision);

    debugUiHotpath(`[handleGridKeyDown] Rounded step. Property: ${property}, New Value: ${newValueString}, Shift: ${event.shiftKey}`);
    handleFineTuneChange(styleName, property, newValueString);
  };
  // --- End NEW KeyDown Handler ---

  // Track previous naming convention to detect changes
  const prevNamingConventionRef = useRef<string>(namingConvention);

  // Main effect: Calculates and RESETS fineTuneStyles on ANY change (sliders, family, style)
  useEffect(() => {
    // Skip recalculation when restoring from a specimen snapshot (preserves per-style overrides)
    // The flag is consumed here so subsequent recalculations work normally
    if (isRestoringSnapshotRef.current) {
      console.log("[ui.tsx] Skipping main useEffect — snapshot restoration in progress.");
      isRestoringSnapshotRef.current = false;
      return;
    }
    console.log(`[ui.tsx] Main useEffect TRIGGERED. currentView: ${currentView}`);
    // This condition now correctly allows calculations if not on landing/setup screens,
    // and fineTunedStyles would have been initialized by the effect above.
    if (currentView === 'landing' || currentView === 'scanResults' || currentView === 'textInput' || currentView === 'textStyleAssignment') {
      console.log("[ui.tsx] On non-main screen, skipping main useEffect calculations related to UI changes.");
      return; 
    }
    console.log(`[ui.tsx] Main useEffect RUNNING for UI updates. Mode: ${activeMode}`);
    
    // Store existing overrides before recalculation
    const existingOverrides: { [key: string]: Partial<TypographyStyle> } = {};
    Object.keys(fineTunedStyles).forEach(key => {
      const style = fineTunedStyles[key];
      if (!style) return;
      const overrides: Partial<TypographyStyle> = {};
      const fontSource = styleFontSources[key];
      if (style.customName) overrides.customName = style.customName;
      if (style.textCase && style.textCase !== 'Original') overrides.textCase = style.textCase;
      if (preserveImportedNumericAxes.size) {
        overrides.size = style.size;
      }
      if (preserveImportedNumericAxes.lineHeight) {
        overrides.lineHeight = style.lineHeight;
      }
      if (preserveImportedNumericAxes.letterSpacing) {
        overrides.letterSpacing = style.letterSpacing;
      }
      if (fontSource === 'custom') {
        if (style.fontFamily) overrides.fontFamily = style.fontFamily;
        if (style.fontStyle) overrides.fontStyle = style.fontStyle;
      }
      if (Object.keys(overrides).length > 0) existingOverrides[key] = overrides;
    });
    
    // Detect if naming convention changed (should clear custom names)
    const namingConventionChanged = prevNamingConventionRef.current !== namingConvention;
    if (namingConventionChanged) {
      console.log(`[ui.tsx] 🏷️ Naming convention changed: "${prevNamingConventionRef.current}" -> "${namingConvention}". Custom names will be cleared.`);
      prevNamingConventionRef.current = namingConvention;
    } else {
      console.log(`[ui.tsx] 🎯 Preserving overrides for ${Object.keys(existingOverrides).length} styles`);
    }
    
    const dynamicAnchors = getDynamicAnchors();
    console.log(`[ui.tsx] Dynamic anchors for ${namingConvention}:`, dynamicAnchors);
    const effectivePrimaryFont = getEffectiveFontFamily();
    const effectiveSecondaryFont = secondaryFontEnabled ? getEffectiveSecondaryFontFamily() : undefined;
    
    console.log(`[ui.tsx] 🧮 calculateStyles called with:`);
    console.log(`[ui.tsx] 🧮   Primary font: ${effectivePrimaryFont}`);
    console.log(`[ui.tsx] 🧮   Secondary font: ${effectiveSecondaryFont} (enabled: ${secondaryFontEnabled})`);
    
    const newTypeSystem = calculateStyles({
      modeSettings: settings[activeMode],
      fontFamily: effectivePrimaryFont,
      fontStyle: getEffectiveWeight(), // Use effective weight (includes preview)
      lineHeightCurve,
      letterSpacingCurve,
      letterSpacingSplit: isLetterSpacingSplit,
      availableStyleAnchors: dynamicAnchors,
      secondaryFontFamily: effectiveSecondaryFont,
      secondaryFontStyle: secondaryFontEnabled ? getEffectiveSecondaryWeight() : undefined, // Use effective secondary weight
    });
    
    // Merge back preserved overrides unless naming convention changed (which clears custom names)
    if (!namingConventionChanged && Object.keys(existingOverrides).length > 0) {
      Object.keys(existingOverrides).forEach(key => {
        if (newTypeSystem[key]) {
          newTypeSystem[key] = { ...newTypeSystem[key], ...existingOverrides[key] };
        }
      });
      console.log(`[ui.tsx] ✅ Restored overrides for ${Object.keys(existingOverrides).length} styles`);
    }
    
    // 🔧 CRITICAL FIX: Apply font source mappings after system recalculation
    // BUT ONLY if we're NOT in preview mode (preview should only affect canvas, not state)
    const systemWithFontSources = { ...newTypeSystem };
    
    // Check if we're in preview mode (any preview active)
    const isInPreviewMode = isPreviewMode || isSecondaryPreviewMode || isWeightPreviewMode || isSecondaryWeightPreviewMode;
    
    if (!isInPreviewMode && Object.keys(styleFontSources).length > 0) {
      console.log(`[ui.tsx] 🔧 Applying font source mappings (not in preview mode)`);
      Object.keys(styleFontSources).forEach(styleKey => {
        if (systemWithFontSources[styleKey]) {
          const source = styleFontSources[styleKey];
          
          if (source === 'custom') {
            // Preserve fontFamily and fontStyle from fineTunedStyles for custom sources
            const existingStyleFromGrid = fineTunedStyles[styleKey];
            if (existingStyleFromGrid?.fontFamily) {
              systemWithFontSources[styleKey] = {
                ...systemWithFontSources[styleKey],
                fontFamily: existingStyleFromGrid.fontFamily,
                fontStyle: existingStyleFromGrid.fontStyle || 'Regular',
                ...(existingStyleFromGrid?.textCase && { textCase: existingStyleFromGrid.textCase }),
                ...(existingStyleFromGrid?.customName && { customName: existingStyleFromGrid.customName })
              };
            }
            return;
          }
          
          const targetFontFamily = source === 'primary' ? fontFamily : secondaryFontFamily;
          if (targetFontFamily) {
            const currentWeight = systemWithFontSources[styleKey].fontStyle;
            
            const availableWeights = actualAvailableFontsList
              .filter((f: any) => f.family === targetFontFamily)
              .map((f: any) => f.style);
            
            let weightToUse = currentWeight;
            if (!availableWeights.includes(currentWeight)) {
              const mainWeight = source === 'primary' ? selectedStyle : secondarySelectedStyle;
              if (availableWeights.includes(mainWeight)) {
                weightToUse = mainWeight;
              } else {
                weightToUse = availableWeights.includes('Regular') ? 'Regular' : (availableWeights[0] || 'Regular');
              }
            }
            
            const existingStyleFromGrid = fineTunedStyles[styleKey];
            
            systemWithFontSources[styleKey] = {
              ...systemWithFontSources[styleKey],
              fontFamily: targetFontFamily,
              fontStyle: weightToUse,
              ...(existingStyleFromGrid?.textCase && { textCase: existingStyleFromGrid.textCase }),
              ...(existingStyleFromGrid?.customName && { customName: existingStyleFromGrid.customName })
            };
            if (existingStyleFromGrid?.textCase) {
              console.log(`[ui.tsx] 🎯 Preserved textCase override: ${styleKey} → ${existingStyleFromGrid.textCase}`);
            }
          }
        }
      });
    } else if (isInPreviewMode) {
      console.log(`[ui.tsx] 🔄 Skipping font source mapping preservation (in preview mode)`);
    }
    
    setFineTunedStyles(systemWithFontSources);
    
    // Only clear manual edits flag if we weren't preserving overrides
    if (!hasManualGridEdits) {
      setHasManualGridEdits(false);
    }
    
    console.log("[ui.tsx] Reset/Updated fineTunedStyles in main useEffect with overrides preserved.");
  }, [
    currentView, getEffectiveFontFamily, getEffectiveWeight,
    settings,
    lineHeightCurve, letterSpacingCurve,
    isLetterSpacingSplit,
    previewExists, showSpecLabels, roundingGridSize, activeMode,
    namingConvention,
    secondaryFontEnabled, getEffectiveSecondaryFontFamily, getEffectiveSecondaryWeight,
    // styleFontSources removed — font source changes handled directly by onStyleFontSourceChange
    isPreviewMode, isSecondaryPreviewMode, isWeightPreviewMode, isSecondaryWeightPreviewMode,
    preserveImportedNumericAxes,
    // styleVisibility intentionally excluded — visibility toggles should not trigger type system recalc
    // (custom font overrides would be lost). The preview update effect handles visibility separately.
  ]);

  // --- Effect to update previous value refs --- Update ALL refs ---
  useEffect(() => {
    // Desktop refs
    prevDesktopBaseSizeRef.current = desktop.baseSize;
    prevDesktopScaleRatioRef.current = desktop.scaleRatio;
    prevDesktopHeadlineMinLineHeightRef.current = desktop.headlineMinLineHeight;
    prevDesktopHeadlineMaxLineHeightRef.current = desktop.headlineMaxLineHeight;
    prevDesktopTextMinLineHeightRef.current = desktop.textMinLineHeight;
    prevDesktopTextMaxLineHeightRef.current = desktop.textMaxLineHeight;
    prevDesktopLetterSpacingRef.current = desktop.letterSpacing;
    prevDesktopMaxLetterSpacingRef.current = desktop.maxLetterSpacing;
    // Mobile refs 
    prevMobileBaseSizeRef.current = mobile.baseSize;
    prevMobileScaleRatioRef.current = mobile.scaleRatio;
    prevMobileHeadlineMinLineHeightRef.current = mobile.headlineMinLineHeight;
    prevMobileHeadlineMaxLineHeightRef.current = mobile.headlineMaxLineHeight;
    prevMobileTextMinLineHeightRef.current = mobile.textMinLineHeight;
    prevMobileTextMaxLineHeightRef.current = mobile.textMaxLineHeight;
    prevMobileLetterSpacingRef.current = mobile.letterSpacing;
    prevMobileMaxLetterSpacingRef.current = mobile.maxLetterSpacing;
    prevMobileInterpolationTypeRef.current = mobile.interpolationType;
    prevFontFamilyRef.current = fontFamily; // <<< Update font family ref
  }); // Run on every render to capture the latest state for the next comparison
  // --- End Update Refs Effect ---

  // Cleanup debounce timer on unmount
  useEffect(() => {
      return () => {
          if (debounceTimer) {
              clearTimeout(debounceTimer);
          }
      };
  }, [debounceTimer]);

  // Handle the Generate button click
  const handleGenerateSpecimen = useCallback(() => {
    // Renamed handler
    console.log(
      "[ui.tsx] Emitting GENERATE_PREVIEW with showSpecLabels:",
      showSpecLabels,
    );
    setActiveLoadingCTA('generate'); // Set loading state
    emit("GENERATE_PREVIEW", { typeSystem: fineTunedStyles, selectedStyle, showSpecLabels }); // Include showSpecLabels
    setPreviewExists(true);
  }, [fineTunedStyles, selectedStyle, showSpecLabels]);

  // Helper function to apply grid font source mappings to a typography system
  const applyGridFontSourceMappings = useCallback((system: TypographySystem): TypographySystem => {
    if (Object.keys(styleFontSources).length === 0) return system;
    
    const systemWithMappings = { ...system };
    Object.keys(styleFontSources).forEach(styleKey => {
      if (systemWithMappings[styleKey]) {
        const source = styleFontSources[styleKey];
        
        if (source === 'custom') {
          // For custom sources, preserve fontFamily/fontStyle from input system (preview changes)
          // Only merge textCase and customName from fineTunedStyles
          const existingStyleFromGrid = fineTunedStyles[styleKey];
          systemWithMappings[styleKey] = {
            ...systemWithMappings[styleKey],
            ...(existingStyleFromGrid?.textCase && { textCase: existingStyleFromGrid.textCase }),
            ...(existingStyleFromGrid?.customName && { customName: existingStyleFromGrid.customName })
          };
          return;
        }
        
        const targetFontFamily = source === 'primary' ? getEffectiveFontFamily() : getEffectiveSecondaryFontFamily();
        if (targetFontFamily) {
          const currentWeight = systemWithMappings[styleKey].fontStyle;
          
          const availableWeights = actualAvailableFontsList
            .filter((f: any) => f.family === targetFontFamily)
            .map((f: any) => f.style);
          
          let weightToUse = currentWeight;
          if (!availableWeights.includes(currentWeight)) {
            const mainWeight = source === 'primary' ? getEffectiveWeight() : getEffectiveSecondaryWeight();
            if (availableWeights.includes(mainWeight)) {
              weightToUse = mainWeight;
            } else {
              weightToUse = availableWeights.includes('Regular') ? 'Regular' : (availableWeights[0] || 'Regular');
            }
          }
          
          const existingStyleFromGrid = fineTunedStyles[styleKey];
          
          systemWithMappings[styleKey] = {
            ...systemWithMappings[styleKey],
            fontFamily: targetFontFamily,
            fontStyle: weightToUse,
            ...(existingStyleFromGrid?.textCase && { textCase: existingStyleFromGrid.textCase }),
            ...(existingStyleFromGrid?.customName && { customName: existingStyleFromGrid.customName })
          };
        }
      }
    });
    return systemWithMappings;
  }, [styleFontSources, getEffectiveFontFamily, getEffectiveSecondaryFontFamily, getEffectiveWeight, getEffectiveSecondaryWeight, actualAvailableFontsList, fontFamily, secondaryFontFamily, fineTunedStyles]);

  // Handle Create Styles button click
  const handleCreateStyles = useCallback(() => {
    console.log(`[ui.tsx] Emitting CREATE_STYLES for mode: ${activeMode}. Baseline grid enabled: ${roundingGridSize > 0}`);
    setActiveLoadingCTA('create');

    // Resolve final per-style font families/styles from current grid source settings
    // so CREATE_STYLES respects custom overrides at export time.
    let systemToModify = applyGridFontSourceMappings({ ...fineTunedStyles });

    // 🔍 FILTER: Exclude hidden styles from export
    const filteredSystem: TypographySystem = {};
    Object.keys(systemToModify).forEach(key => {
      // Only include styles that are visible (not hidden with eye toggle)
      if (styleVisibility[key] !== false) {
        filteredSystem[key] = systemToModify[key];
      } else {
        console.log(`[ui.tsx] 🚫 Excluding hidden style from CREATE_STYLES: ${key}`);
      }
    });

    // Apply baseline grid if enabled
    if (roundingGridSize > 0) {
      const filteredKeys = Object.keys(filteredSystem);
      systemToModify = applyRoundingToSystem(filteredSystem, roundingGridSize);
    } else {
      systemToModify = filteredSystem;
    }

    console.log(`[ui.tsx] CREATE_STYLES: Exporting ${Object.keys(systemToModify).length} visible styles`);

    // Emit with original system keys — naming is handled downstream by createFigmaTextStyles
    emit("CREATE_STYLES", { 
        typeSystem: systemToModify,
        selectedStyle, 
        activeMode,
        selectedPresetProfile,
        namingConvention: namingConventionRef.current,
        roundingGridSize,
        lineHeightUnit
    }); 
  }, [fineTunedStyles, selectedStyle, activeMode, selectedPresetProfile, roundingGridSize, namingConvention, getDisplayUIName, applyRoundingToSystem, styleVisibility, applyGridFontSourceMappings]);

  const handleUpdateStyles = useCallback(() => {
    console.log(`[ui.tsx] Emitting UPDATE_STYLES for mode: ${activeMode}. Baseline grid enabled: ${roundingGridSize > 0}`);
    setActiveLoadingCTA('update');

    // Resolve final per-style font families/styles from current grid source settings
    // so UPDATE_STYLES respects custom overrides at update time.
    let systemToModify = applyGridFontSourceMappings({ ...fineTunedStyles });

    const filteredSystem: TypographySystem = {};
    Object.keys(systemToModify).forEach(key => {
      if (styleVisibility[key] !== false) {
        filteredSystem[key] = systemToModify[key];
      } else {
        console.log(`[ui.tsx] 🚫 Excluding hidden style from UPDATE_STYLES: ${key}`);
      }
    });

    if (roundingGridSize > 0) {
      systemToModify = applyRoundingToSystem(filteredSystem, roundingGridSize);
    } else {
      systemToModify = filteredSystem;
    }

    const systemToSend: TypographySystem = { ...systemToModify };

    console.log(`[ui.tsx] UPDATE_STYLES: Updating ${Object.keys(systemToSend).length} visible styles`);

    emit("UPDATE_STYLES", { 
        typeSystem: systemToSend,
        selectedStyle, 
        activeMode,
        namingConvention: namingConventionRef.current,
        roundingGridSize,
        lineHeightUnit
    }); 
  }, [fineTunedStyles, selectedStyle, activeMode, roundingGridSize, applyRoundingToSystem, styleVisibility, applyGridFontSourceMappings]);

  // Handler for the NEW Generate Waterfall button
  const handleGenerateWaterfallPreview = useCallback(() => {
    console.log("[ui.tsx] Emitting CREATE_WATERFALL for inline preview");
    // Include the current waterfall text
    emit("CREATE_WATERFALL", {
      typeSystem: fineTunedStyles,
      selectedStyle,
      sampleText: waterfallText,
    });
  }, [fineTunedStyles, selectedStyle, waterfallText]);

  // Update function for fine-tune inputs

  const handleFineTuneChange = (
    styleName: string,
    property: keyof TypographyStyle,
    value: string,
  ) => {
    let updatedStyles: TypographySystem | null = null;
    let preciseValue: number | string = value;

    const currentStyle = fineTunedStyles[styleName];
    if (!currentStyle) return;

    const normalizedValue = value.trim();
    const conventionLabel = getConventionName(styleName, namingConvention) || getDisplayUIName(styleName);
    const isCustomNameOverride =
      property === 'customName' &&
      normalizedValue !== '' &&
      normalizedValue !== conventionLabel;

    // --- Track manual edits for reset button & generator-tab warning ---
    if (
      property === 'size' ||
      property === 'lineHeight' ||
      property === 'letterSpacing' ||
      property === 'fontStyle' ||
      property === 'fontFamily' ||
      property === 'textCase' ||
      isCustomNameOverride
    ) {
      setHasManualGridEdits(true);
      debugUiHotpath(`[ui.tsx] 🔧 Manual grid edit detected: ${styleName}.${property} = ${value}`);
    }
    // --- END ---

    if (property === "size") {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        let newSizePx = num;
        if (sizeUnit === 'em') {
          const baseSizeInPx = activeMode === 'desktop' ? desktop.baseSize : mobile.baseSize;
          newSizePx = num * baseSizeInPx;
        } else if (sizeUnit === 'rem') {
          newSizePx = num * 16;
        }
        const oldLineHeightInPx = (currentStyle.lineHeight ?? 0) * (currentStyle.size ?? 0);
        const newLineHeightMultiplier = newSizePx > 0 ? oldLineHeightInPx / newSizePx : 0;

        updatedStyles = {
          ...fineTunedStyles,
          [styleName]: {
            ...(currentStyle || {}),
            size: newSizePx,
            lineHeight: lineHeightUnit === 'px' ? newLineHeightMultiplier : currentStyle.lineHeight,
          } as TypographyStyle,
        };
      }
    } else if (property === "lineHeight") {
      const numericValue = parseFloat(value);
      if (!isNaN(numericValue)) {
        let newMultiplier = 0;
        if (lineHeightUnit === 'px') {
          const currentSize = currentStyle.size ?? 16;
          newMultiplier = currentSize > 0 ? numericValue / currentSize : 0;
        } else if (lineHeightUnit === 'em' || lineHeightUnit === 'rem') {
          newMultiplier = numericValue;
        } else {
          newMultiplier = numericValue / 100;
        }
        updatedStyles = {
          ...fineTunedStyles,
          [styleName]: { ...(currentStyle || {}), lineHeight: newMultiplier } as TypographyStyle,
        };
      }
    } else if (property === "letterSpacing") {
      const numericValue = parseFloat(value);
      if (!isNaN(numericValue)) {
        let percentValue = numericValue;
        if (letterSpacingUnit === 'em' || letterSpacingUnit === 'rem') {
          percentValue = numericValue * 100;
        } else if (letterSpacingUnit === 'px') {
          const currentSize = currentStyle.size ?? 16;
          percentValue = currentSize > 0 ? (numericValue / currentSize) * 100 : 0;
        }
        updatedStyles = {
          ...fineTunedStyles,
          [styleName]: { ...(currentStyle || {}), letterSpacing: percentValue } as TypographyStyle,
        };
      }
    } else if (property === "fontStyle" || property === "textCase" || property === "customName" || property === "fontFamily") {
      const customNameValue =
        property === 'customName'
          ? (isCustomNameOverride ? normalizedValue : '')
          : value;
      const newStyle = {
        ...(currentStyle || {}),
        [property]: customNameValue,
      };

      if (property === 'customName' && customNameValue === '') {
        delete newStyle.customName;
      }
      
      // 🔍 DEBUG: Log textCase changes specifically
      if (property === 'textCase') {
        console.log(`[ui.tsx] 🎯 DEBUG handleFineTuneChange textCase: "${styleName}" changing from "${currentStyle?.textCase || 'undefined'}" to "${value}"`);
        console.log(`[ui.tsx] 🎯 DEBUG newStyle after change:`, newStyle);
      }
      
      updatedStyles = {
        ...fineTunedStyles,
        [styleName]: newStyle as TypographyStyle,
      };
    }

    if (updatedStyles) {
      // Single source of preview updates: the debounced fineTunedStyles effect.
      // Avoid emitting here to prevent duplicate UPDATE_PREVIEW events per grid edit.
      setFineTunedStyles(updatedStyles);
    }
  };

  const handleGlobalTextCaseChange = useCallback((group: 'headings' | 'text', caseValue: string) => {
    const keys = group === 'headings'
      ? TYPOGRAPHY_SCALE_ORDER.HEADINGS as readonly string[]
      : TYPOGRAPHY_SCALE_ORDER.TEXT_STYLES as readonly string[];
    setFineTunedStyles((prev: TypographySystem) => {
      const next = { ...prev };
      for (const key of keys) {
        if (next[key]) {
          next[key] = { ...next[key], textCase: caseValue };
        }
      }
      return next;
    });
    if (group === 'headings') {
      setGeneratorHeadingCase(caseValue);
    } else {
      setGeneratorTextCase(caseValue);
    }
  }, []);

  const getGlobalTextCase = useCallback((group: 'headings' | 'text'): string => {
    const keys = group === 'headings'
      ? TYPOGRAPHY_SCALE_ORDER.HEADINGS as readonly string[]
      : TYPOGRAPHY_SCALE_ORDER.TEXT_STYLES as readonly string[];
    const cases = keys
      .filter(k => fineTunedStyles[k])
      .map(k => fineTunedStyles[k].textCase || 'Original');
    if (cases.length === 0) return 'Original';
    return cases.every(c => c === cases[0]) ? cases[0] : 'Mixed';
  }, [fineTunedStyles]);

  // Handler for font source changes (moved here after handleFineTuneChange declaration)
  const onStyleFontSourceChange = useCallback((styleName: string, source: 'primary' | 'secondary') => {
    updateStyleFontSource(styleName, source);
    const fontFamily = source === 'primary' ? getEffectiveFontFamily() : getEffectiveSecondaryFontFamily();
    handleFineTuneChange(styleName, 'fontFamily', fontFamily);
  }, [getEffectiveFontFamily, getEffectiveSecondaryFontFamily, handleFineTuneChange, updateStyleFontSource]);

  // Handler for weight changes (moved here after handleFineTuneChange declaration)
  const onStyleWeightChange = useCallback((styleName: string, weight: string) => {
    const currentSource = styleFontSources[styleName] || (styleName.startsWith('h') || styleName === 'display' ? 'secondary' : 'primary');
    
    if (currentSource === 'custom') {
      handleFineTuneChange(styleName, 'fontStyle', weight);
      return;
    }
    
    const fontFamily = currentSource === 'primary' ? getEffectiveFontFamily() : getEffectiveSecondaryFontFamily();
    handleFineTuneChange(styleName, 'fontFamily', fontFamily);
    handleFineTuneChange(styleName, 'fontStyle', weight);
  }, [styleFontSources, getEffectiveFontFamily, getEffectiveSecondaryFontFamily, handleFineTuneChange]);

  const buildSpecimenSnapshot = useCallback((
    typeSystem: TypographySystem,
    overrides: Partial<UpdatePreviewRequest> = {}
  ): SpecimenSnapshot => ({
    version: 1,
    typography: {
      desktop: { ...desktop, systemPreset: desktop.systemPreset as string | undefined },
      mobile: { ...mobile, systemPreset: mobile.systemPreset as string | undefined },
    },
    fonts: {
      primaryFontFamily: getEffectiveFontFamily(),
      primaryFontStyle: getEffectiveWeight(),
      secondaryFontFamily: secondaryFontEnabled ? getEffectiveSecondaryFontFamily() : undefined,
      secondaryFontStyle: secondaryFontEnabled ? getEffectiveSecondaryWeight() : undefined,
      secondaryFontEnabled,
      secondaryFontLinked,
      secondaryWeightLinked,
    },
    ui: {
      namingConvention: overrides.namingConvention ?? namingConvention,
      lineHeightUnit: (overrides.lineHeightUnit as 'percent' | 'px' | 'em' | 'rem') ?? lineHeightUnit,
      roundingGridSize: overrides.roundingGridSize ?? roundingGridSize,
      colorMode,
      previewThemeId,
      customPreviewColors: customPreviewColors ?? undefined,
      showSpecLabels: overrides.showSpecLabels ?? showSpecLabels,
      activeMode: overrides.activeMode ?? activeMode,
      selectedLayout,
      previewTextAlign: overrides.previewTextAlign ?? previewTextAlign,
      waterfallText,
      selectedPresetProfile,
      lineHeightCurve,
      letterSpacingCurve,
    },
    styles: typeSystem,
    styleVisibility: { ...(overrides.styleVisibility ?? styleVisibility) },
    styleFontSources: { ...styleFontSources },
  }), [
    desktop,
    mobile,
    getEffectiveFontFamily,
    getEffectiveWeight,
    secondaryFontEnabled,
    getEffectiveSecondaryFontFamily,
    getEffectiveSecondaryWeight,
    secondaryFontLinked,
    secondaryWeightLinked,
    namingConvention,
    lineHeightUnit,
    roundingGridSize,
    colorMode,
    previewThemeId,
    customPreviewColors,
    showSpecLabels,
    activeMode,
    selectedLayout,
    previewTextAlign,
    waterfallText,
    selectedPresetProfile,
    lineHeightCurve,
    letterSpacingCurve,
    styleVisibility,
    styleFontSources,
  ]);

  // Handler for custom font selection (unlocked font picker in styles grid)
  const onStyleCustomFontChange = useCallback((styleName: string, fontFamily: string) => {
    // Single atomic update: set both fontFamily and fontStyle, then emit preview
    const availableWeights = actualAvailableFontsList
      .filter((f: any) => f.family === fontFamily)
      .map((f: any) => f.style);
    const currentWeight = fineTunedStyles[styleName]?.fontStyle || 'Regular';
    const fontStyle = availableWeights.includes(currentWeight)
      ? currentWeight
      : (availableWeights.includes('Regular') ? 'Regular' : (availableWeights[0] || 'Regular'));

    const updatedStyles = {
      ...fineTunedStyles,
      [styleName]: {
        ...fineTunedStyles[styleName],
        fontFamily,
        fontStyle,
      }
    };
    setFineTunedStyles(updatedStyles);
    updateStyleFontSource(styleName, 'custom');

    if (previewExists) {
      const systemWithMappings = applyGridFontSourceMappings(updatedStyles);
      // Override with our known-correct values (avoids stale closure in mapping)
      systemWithMappings[styleName] = { ...systemWithMappings[styleName], fontFamily, fontStyle };
      const systemToSend = roundingGridSize > 0 ? applyRoundingToSystem(systemWithMappings, roundingGridSize) : systemWithMappings;
      emit("UPDATE_PREVIEW", {
        typeSystem: systemToSend,
        selectedStyle,
        showSpecLabels,
        availableStyles,
        activeMode,
        activeScaleRatio: activeMode === 'desktop' ? desktop.scaleRatio : mobile.scaleRatio,
        styleVisibility,
        namingConvention,
        showGrid: roundingGridSize > 0,
        roundingGridSize,
        lineHeightUnit,
        previewTextAlign,
        baseFontFamily: getEffectiveFontFamily(),
        baseFontStyle: getEffectiveWeight(),
        secondaryFontFamily: secondaryFontEnabled ? getEffectiveSecondaryFontFamily() : undefined,
        secondaryFontStyle: secondaryFontEnabled ? getEffectiveSecondaryWeight() : undefined,
        specimenSnapshot: buildSpecimenSnapshot(systemToSend),
      } as UpdatePreviewRequest);
    }
  }, [fineTunedStyles, actualAvailableFontsList, previewExists, applyGridFontSourceMappings,
      roundingGridSize, applyRoundingToSystem, selectedStyle, showSpecLabels, availableStyles,
      activeMode, desktop, mobile, styleVisibility, namingConvention, lineHeightUnit, previewTextAlign,
      getEffectiveFontFamily, getEffectiveWeight, getEffectiveSecondaryFontFamily,
      getEffectiveSecondaryWeight, secondaryFontEnabled, updateStyleFontSource, buildSpecimenSnapshot]);

  // Handler for re-locking font (reverting from custom back to primary/secondary)
  const onStyleFontRelock = useCallback((styleName: string) => {
    const defaultSource = (styleName.startsWith('h') || styleName === 'display') ? 'secondary' : 'primary';
    const globalFont = defaultSource === 'primary' ? getEffectiveFontFamily() : getEffectiveSecondaryFontFamily();
    const globalWeight = defaultSource === 'primary' ? getEffectiveWeight() : getEffectiveSecondaryWeight();

    const updatedStyles = {
      ...fineTunedStyles,
      [styleName]: {
        ...fineTunedStyles[styleName],
        fontFamily: globalFont,
        fontStyle: globalWeight,
      }
    };
    setFineTunedStyles(updatedStyles);
    updateStyleFontSource(styleName, defaultSource);

    if (previewExists) {
      const systemWithMappings = applyGridFontSourceMappings(updatedStyles);
      const systemToSend = roundingGridSize > 0 ? applyRoundingToSystem(systemWithMappings, roundingGridSize) : systemWithMappings;
      emit("UPDATE_PREVIEW", {
        typeSystem: systemToSend,
        selectedStyle,
        showSpecLabels,
        availableStyles,
        activeMode,
        activeScaleRatio: activeMode === 'desktop' ? desktop.scaleRatio : mobile.scaleRatio,
        styleVisibility,
        namingConvention,
        showGrid: roundingGridSize > 0,
        roundingGridSize,
        lineHeightUnit,
        previewTextAlign,
        baseFontFamily: getEffectiveFontFamily(),
        baseFontStyle: getEffectiveWeight(),
        secondaryFontFamily: secondaryFontEnabled ? getEffectiveSecondaryFontFamily() : undefined,
        secondaryFontStyle: secondaryFontEnabled ? getEffectiveSecondaryWeight() : undefined,
        specimenSnapshot: buildSpecimenSnapshot(systemToSend),
      } as UpdatePreviewRequest);
    }
  }, [fineTunedStyles, previewExists, applyGridFontSourceMappings,
      roundingGridSize, applyRoundingToSystem, selectedStyle, showSpecLabels, availableStyles,
      activeMode, desktop, mobile, styleVisibility, namingConvention, lineHeightUnit, previewTextAlign,
      getEffectiveFontFamily, getEffectiveWeight, getEffectiveSecondaryFontFamily,
      getEffectiveSecondaryWeight, secondaryFontEnabled, updateStyleFontSource, buildSpecimenSnapshot]);

  // --- Calculate selected preset value for dropdown ---
  const tolerance = 0.001;
  const currentRatioToCompare = activeMode === 'desktop' ? desktop.scaleRatio : mobile.scaleRatio;
  const matchedRatioEntry = Object.entries(PRESET_RATIOS_MAP).find(([_, value]) => Math.abs(currentRatioToCompare - value) < tolerance);
  const matchedRatioName = matchedRatioEntry ? matchedRatioEntry[0] : "";
  const activeModeSystemPreset = activeMode === 'desktop' ? desktop.systemPreset : mobile.systemPreset;
  const selectedSystemPresetLabel = activeModeSystemPreset
    ? DESIGN_SYSTEM_PRESET_OPTIONS.find((preset) => preset.id === activeModeSystemPreset)?.label
    : undefined;
  
  // Function to format the scale ratio display text
  const getScaleRatioDisplayText = () => {
    if (selectedSystemPresetLabel) {
      return selectedSystemPresetLabel;
    }
    if (matchedRatioName) {
      // Format: "Perfect Fourth" (title case, no hyphen)
      const formattedName = matchedRatioName.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
      return formattedName; // MODIFIED: Only return the formatted name
    }
    // If no preset matches, show "Custom" instead of the raw number
    return "Custom";
  };

  // NEW: Combined handler for the main Generate Preview button
  const handleGeneratePreview = useCallback((layoutOverride?: PreviewLayoutType) => {
    const layoutToUse = layoutOverride || selectedLayout;
    console.log(
      `[ui.tsx] handleGeneratePreview (Footer) called for layout: ${layoutToUse}, mode: ${activeMode}`,
    );
    
    setActiveFlow('generator');
    setStructuredTextPayload(null);
    setTextSelectionButtonMode('select');
    setActiveLoadingCTA('generate');
    
    // 🎯 FIX: Use fineTunedStyles (preserves textCase overrides) instead of fresh calculateStyles
    // Apply font source mappings to the current fineTunedStyles which includes all grid overrides
    const systemWithMappings = applyGridFontSourceMappings(fineTunedStyles);
    const currentSystemForPreview = roundingGridSize > 0 ? applyRoundingToSystem(systemWithMappings, roundingGridSize) : systemWithMappings;

    let eventData: Partial<CreatePreviewEvent> = { 
        typeSystem: currentSystemForPreview, 
        selectedStyle,
        showSpecLabels,
        activeMode, 
        activeScaleRatio: activeMode === 'desktop' ? desktop.scaleRatio : mobile.scaleRatio,
        baseFontFamily: getEffectiveFontFamily(),
        baseFontStyle: getEffectiveWeight(),
        secondaryFontFamily: secondaryFontEnabled ? getEffectiveSecondaryFontFamily() : undefined,
        secondaryFontStyle: secondaryFontEnabled ? getEffectiveSecondaryWeight() : undefined,
    };

    if (layoutToUse === 'structuredText') {
      eventData.llmOutput = genericArticleContent;
    }

    // Build specimen snapshot: complete settings DNA stored on each specimen frame
    const specimenSnapshot: SpecimenSnapshot = {
      version: 1,
      typography: {
        desktop: { ...desktop, systemPreset: desktop.systemPreset as string | undefined },
        mobile: { ...mobile, systemPreset: mobile.systemPreset as string | undefined },
      },
      fonts: {
        primaryFontFamily: getEffectiveFontFamily(),
        primaryFontStyle: getEffectiveWeight(),
        secondaryFontFamily: secondaryFontEnabled ? getEffectiveSecondaryFontFamily() : undefined,
        secondaryFontStyle: secondaryFontEnabled ? getEffectiveSecondaryWeight() : undefined,
        secondaryFontEnabled,
        secondaryFontLinked,
        secondaryWeightLinked,
      },
      ui: {
        namingConvention,
        lineHeightUnit,
        roundingGridSize,
        colorMode,
        previewThemeId,
        showSpecLabels,
        activeMode,
        selectedLayout: layoutToUse,
        previewTextAlign,
        waterfallText,
        selectedPresetProfile,
        lineHeightCurve,
        letterSpacingCurve,
      },
      styles: currentSystemForPreview, // Full fine-tuned styles with all overrides
      styleVisibility: { ...styleVisibility },
      styleFontSources: { ...styleFontSources },
    };

    emit('CREATE_PREVIEW', {
      action: 'create',
      layoutType: layoutToUse,
      namingConvention,
      showGrid: roundingGridSize > 0,
      roundingGridSize,
      lineHeightUnit,
      previewTextAlign,
      styleVisibility,
      specimenSnapshot, // Attach full settings snapshot for specimen sampling
      ...eventData
    });
    console.log(`[ui.tsx] CREATE_PREVIEW emitted with specimen snapshot and naming convention: ${namingConvention}`);
    setPreviewExists(true);
    setScannedFrameTextStyles(null); // Clear scanned frame state - enables Dark/Light, Show specs buttons

  }, [
    fineTunedStyles,
    applyGridFontSourceMappings,
    roundingGridSize,
    applyRoundingToSystem,
    showSpecLabels, 
    selectedLayout,
    previewTextAlign,
    waterfallText,
    activeMode, 
    desktop, mobile, // Needed for snapshot
    namingConvention,
    lineHeightUnit,
    colorMode, lineHeightCurve, letterSpacingCurve, // Needed for snapshot
    styleVisibility, styleFontSources, // Needed for snapshot
    selectedPresetProfile, // Needed for snapshot
    getEffectiveFontFamily, getEffectiveWeight,
    secondaryFontEnabled, getEffectiveSecondaryFontFamily, getEffectiveSecondaryWeight,
    secondaryFontLinked, secondaryWeightLinked,
  ]);

  // NEW: Context-aware handler for the "Reset" button logic
  const handleContextualGenerate = useCallback(() => {
    console.log(
      `[ui.tsx] handleContextualGenerate (Reset) called. Flow: ${activeFlow}`
    );
    setTextSelectionButtonMode('select');
    
    // 🎯 FIX: Use fineTunedStyles (preserves textCase overrides) instead of fresh calculateStyles
    // Apply font source mappings to the current fineTunedStyles which includes all grid overrides
    const systemWithMappings = applyGridFontSourceMappings(fineTunedStyles);
    const currentSystemForPreview = roundingGridSize > 0 ? applyRoundingToSystem(systemWithMappings, roundingGridSize) : systemWithMappings;

    let eventData: Partial<CreatePreviewEvent> = {
      typeSystem: currentSystemForPreview,
      selectedStyle,
      showSpecLabels,
      activeMode,
      activeScaleRatio: activeMode === 'desktop' ? desktop.scaleRatio : mobile.scaleRatio,
      baseFontFamily: getEffectiveFontFamily(),
      baseFontStyle: getEffectiveWeight(),
      secondaryFontFamily: secondaryFontEnabled ? getEffectiveSecondaryFontFamily() : undefined,
      secondaryFontStyle: secondaryFontEnabled ? getEffectiveSecondaryWeight() : undefined,
    };

    // Build specimen snapshot for the reset frame too
    const specimenSnapshot: SpecimenSnapshot = {
      version: 1,
      typography: {
        desktop: { ...desktop, systemPreset: desktop.systemPreset as string | undefined },
        mobile: { ...mobile, systemPreset: mobile.systemPreset as string | undefined },
      },
      fonts: {
        primaryFontFamily: getEffectiveFontFamily(),
        primaryFontStyle: getEffectiveWeight(),
        secondaryFontFamily: secondaryFontEnabled ? getEffectiveSecondaryFontFamily() : undefined,
        secondaryFontStyle: secondaryFontEnabled ? getEffectiveSecondaryWeight() : undefined,
        secondaryFontEnabled,
        secondaryFontLinked,
        secondaryWeightLinked,
      },
      ui: {
        namingConvention,
        lineHeightUnit,
        roundingGridSize,
        colorMode,
        previewThemeId,
        showSpecLabels,
        activeMode,
        selectedLayout: activeFlow === 'structuredText' ? 'structuredText' : selectedLayout,
        previewTextAlign,
        waterfallText,
        selectedPresetProfile,
        lineHeightCurve,
        letterSpacingCurve,
      },
      styles: currentSystemForPreview,
      styleVisibility: { ...styleVisibility },
      styleFontSources: { ...styleFontSources },
    };

    let layoutType: PreviewLayoutType = selectedLayout;
    if (activeFlow === 'structuredText') {
      layoutType = 'structuredText';
      eventData.llmOutput = structuredTextPayload || undefined;
    }
    
    emit('CREATE_PREVIEW', {
      action: 'reset',
      layoutType: layoutType,
      namingConvention, // ADDED: Include naming convention
      showGrid: roundingGridSize > 0,
      roundingGridSize,
      lineHeightUnit, // FIXED: Include line height unit for reset frames
      previewTextAlign,
      specimenSnapshot, // Include snapshot for specimen sampling
      ...eventData
    } as CreatePreviewEvent);
    setPreviewExists(true);

  }, [
    fineTunedStyles, // 🎯 CRITICAL: Use fineTunedStyles as dependency instead of settings/fonts
    applyGridFontSourceMappings,
    roundingGridSize,
    applyRoundingToSystem,
    showSpecLabels,
    activeFlow,
    structuredTextPayload,
    selectedLayout,
    previewTextAlign,
    waterfallText,
    activeMode,
    desktop, mobile, // Needed for snapshot
    namingConvention,
    lineHeightUnit, // FIXED: Added missing dependency for line height unit
    colorMode, lineHeightCurve, letterSpacingCurve, // Needed for snapshot
    styleVisibility, styleFontSources, // Needed for snapshot
    selectedPresetProfile, // Needed for snapshot
    getEffectiveFontFamily, getEffectiveWeight,
    secondaryFontEnabled, getEffectiveSecondaryFontFamily, getEffectiveSecondaryWeight,
    secondaryFontLinked, secondaryWeightLinked,
  ]);
  // --- END Combined handler ---

  // --- NEW: Handler for the dynamic Select/Reset button ---
  const handleSelectOrResetClick = useCallback(() => {
    if (textSelectionButtonMode === 'select') {
      emit('SELECT_PREVIEW_TEXT_NODES');
      setTextSelectionButtonMode('reset');
    } else {
      // This is the 'reset' action, which now calls the new context-aware function.
      handleContextualGenerate();
    }
  }, [textSelectionButtonMode, handleContextualGenerate, emit, setTextSelectionButtonMode]);
  // --- END NEW ---

  // --- NEW: UI panels state via store ---
  // Subscribe to panel openness to keep UI reactive
  const [openSections, setOpenSectionsLocal] = useState(useAppStore.getState().uiPanels.openSections);
  useEffect(() => {
    const unsub = useAppStore.subscribe((state) => {
      setOpenSectionsLocal(state.uiPanels.openSections);
    });
    return () => { unsub(); };
  }, []);
  const toggleSection = useCallback((name: string) => useAppStore.getState().uiPanels.toggleOne(name), []);

  // --- NEW: useEffect for Base Size Preset Dropdown Outside Click ---
  useEffect(() => {
    if (!isBaseSizePresetOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (baseSizePresetDropdownRef.current && !baseSizePresetDropdownRef.current.contains(event.target as Node)) {
        setIsBaseSizePresetOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isBaseSizePresetOpen]);
  // --- END NEW useEffect ---


  // <<< ADD UseEffect to Lock/Unlock Main Content Scroll >>>
  useEffect(() => {
    const mainEl = mainContentRef.current;
    if (!mainEl) return;

    const isAnyDropdownOpen =
      isScaleRatioPresetListOpen ||
      isSpecimenLayoutListOpen ||
      isTextPresetListOpen ||
      isStylesDropdownOpen ||
      isLineHeightHeadlinesCurveOpen ||
      isLineHeightTextCurveOpen ||
      isLetterSpacingCurveOpen ||
      isRoundingDropdownOpen || 
      isBaseSizePresetOpen || 
      (openGridFontStyleDropdownKey !== null);

    if (isAnyDropdownOpen) {
      const scrollbarVisible = mainEl.scrollHeight > mainEl.clientHeight;
      if (scrollbarVisible && !mainEl.classList.contains('main-content-scroll-locked')) {
        originalPaddingRightRef.current = mainEl.style.paddingRight || getComputedStyle(mainEl).paddingRight || "0px";
        const scrollbarWidth = mainEl.offsetWidth - mainEl.clientWidth;
        const currentPaddingStr = originalPaddingRightRef.current.replace('px', '');
        const currentPaddingNum = parseFloat(currentPaddingStr) || 0;
        mainEl.style.paddingRight = `${currentPaddingNum + scrollbarWidth}px`;
      }
      mainEl.classList.add('main-content-scroll-locked');
    } else {
      if (mainEl.classList.contains('main-content-scroll-locked')) {
        mainEl.classList.remove('main-content-scroll-locked');
        mainEl.style.paddingRight = originalPaddingRightRef.current;
      }
    }
  }, [
    isScaleRatioPresetListOpen, 
    isSpecimenLayoutListOpen, isTextPresetListOpen, 
    isStylesDropdownOpen,
    isLineHeightHeadlinesCurveOpen, isLineHeightTextCurveOpen,
    isLetterSpacingCurveOpen,
    isRoundingDropdownOpen, 
    isBaseSizePresetOpen, 
    openGridFontStyleDropdownKey
  ]);
  // <<< END ADD >>>

  // --- NEW: State for current view and selected flow ---
  // const [currentView, setCurrentView] = useState<'landing' | 'main' | 'frame' | 'scanResults' | 'textInput' | 'textStyleAssignment'>('landing'); // MODIFIED to include new views // MOVED EARLIER
  // --- END NEW State ---

  // --- Callback for FrameFlowScreen to pass scanned styles and trigger navigation ---
  const handleFrameScanComplete = (data: {
    success: boolean; 
    detectedStyles: DetectedTextStyle[]; 
    message?: string; 
    primaryScannedFontFamily?: string; 
    primaryScannedFontStyle?: string;
    primaryScannedBaseSize?: number; // ADDED
  }) => {
    console.log('[ui.tsx] handleFrameScanComplete called with primary base size:', data.primaryScannedBaseSize);
    if (data.success && data.detectedStyles.length > 0) {
      // Pre-calculate a target type system based on the *current* main UI settings,
      // but override the base size with the one detected from the scan.
      // This gives the "Apply Matches" screen a relevant system to work with.
      const newTargetSystem = calculateStyles({
        modeSettings: settings[activeMode], // Use current mode's settings
        fontFamily: getEffectiveFontFamily(), // Use effective font (preview or committed)
        fontStyle: getEffectiveWeight(), // Use effective weight (includes preview)
        lineHeightCurve, // Pass current curve
        letterSpacingCurve, // Pass current curve
        letterSpacingSplit: isLetterSpacingSplit,
        explicitBaseSize: data.primaryScannedBaseSize, // IMPORTANT: Override with detected base size
        secondaryFontFamily: secondaryFontEnabled ? getEffectiveSecondaryFontFamily() : undefined,
        secondaryFontStyle: secondaryFontEnabled ? getEffectiveSecondaryWeight() : undefined, // Use effective secondary weight
    });
    setExplicitTargetSystemForScan(newTargetSystem);

    setScannedFrameTextStyles(data.detectedStyles);
    // setCurrentView('scanResults'); // This is now the default view after landing
    } else {
      // Handle error case - maybe show a toast or alert in the UI
      console.error("Frame scan failed or returned no styles:", data.message);
      // If the scan fails, we might want to stay on the scan results screen but show an empty state or message.
      // For now, we clear the existing styles to indicate nothing was found.
      setScannedFrameTextStyles([]);
    }
  };
  // --- END ADDED HANDLER ---

  // --- ADDED: Listener for LOADED_SETTINGS in TypographyUI ---
  useEffect(() => {
    const handleLoadedSettings = on('LOADED_SETTINGS', (settings: { apiKey?: string | null }) => {
      console.log('[TypographyUI] Received LOADED_SETTINGS:', settings);
      if (settings.apiKey) {
        setLoadedApiKey(settings.apiKey);
      }
    });
    // Request settings when TypographyUI mounts, in case main.ts already loaded them
    // before this specific listener was attached (e.g., if UI_READY was handled quickly).
    // This ensures we try to get the key if it's already available in main.ts.
    // However, main.ts currently only sends LOADED_SETTINGS in response to UI_READY.
    // For a more robust fetch, main.ts could handle a direct request if needed,
    // but for now, this listener will catch the one after UI_READY.

    return () => {
      handleLoadedSettings(); // Cleanup listener
    };
  }, []);
  // --- END ADDED Listener ---

  // --- ADDED: Listener for NAVIGATE_TO_MAIN_VIEW --- 
  useEffect(() => {
    const handleNavigate = on('NAVIGATE_TO_MAIN_VIEW', () => {
      console.log('[TypographyUI] Received NAVIGATE_TO_MAIN_VIEW. Setting currentView to main.');
      setCurrentView('main');
      setPreviewExists(true); // <<< ADD THIS LINE to enable tweaking updates
    });
    return () => {
      handleNavigate(); // Cleanup listener
    };
  // Ensure all dependencies of this effect are listed if setCurrentView or setPreviewExists are props or complex
  // For useState setters, they are stable and don't strictly need to be in deps, but including them is safer practice.
  }, [setCurrentView, setPreviewExists]); 
  // --- END ADDED Listener ---

  // --- ADDED: Listener for structured text processing response ---
  useEffect(() => {
    const handleProcessResponse = on('PROCESS_UNFORMATTED_TEXT_RESPONSE', (data: ProcessUnformattedTextResponseEvent) => {
      if (data.success && data.llmOutput) {
        console.log('[ui.tsx] Received successful structured text response. Setting active flow.');
        setActiveFlow('structuredText');
        setStructuredTextPayload(data.llmOutput);
      }
    });

    return () => {
      handleProcessResponse();
    };
  }, []);
  // --- END ADDED Listener ---

  // --- ADDED: Listener for smart match results ---
  useEffect(() => {
    const handleSmartMatchResults = on('SMART_MATCH_RESULTS', (data: { mappedStyles: any[] }) => {
      console.log('[ui.tsx] Received SMART_MATCH_RESULTS:', data);
      setSmartMatchResults(data.mappedStyles);
      setCurrentView('smartMatchResults');
    });

    return () => {
      handleSmartMatchResults();
    };
  }, []);

  useEffect(() => {
    const handleApplyRelumePreset = on('APPLY_RELUME_PRESET', (data: any) => {
      console.log('[ui.tsx] Received APPLY_RELUME_PRESET:', data);
      const { desktop, mobile, fontFamily, namingConvention } = data;
      setSettings({ desktop, mobile });
      setFontFamily(fontFamily);
      if (namingConvention) {
        setNamingConvention(namingConvention);
      }
      setCurrentView('main');
    });

    return () => {
      handleApplyRelumePreset();
    };
  }, [setSettings, setFontFamily, setNamingConvention, setCurrentView]);

  // --- NEW: Listener for weight mapping requirement ---
  useEffect(() => {
    const handleWeightMappingRequired = on('TEXT_STYLE_WEIGHT_MAPPING_REQUIRED', (data: any) => {
      console.log('[ui.tsx] Received TEXT_STYLE_WEIGHT_MAPPING_REQUIRED:', data);
      // Store the current UPDATE_STYLES request data for later use
      setWeightMappingDialog({
        isOpen: true,
        data: data,
        originalRequest: {
          typeSystem: fineTunedStyles,
          selectedStyle,
          activeMode,
          namingConvention: namingConventionRef.current
        }
      });
    });

    return () => {
      handleWeightMappingRequired();
    };
  }, [fineTunedStyles, selectedStyle, activeMode]); // Include dependencies that are captured
  // --- END NEW Listener ---

  // --- NEW: Listener for variable mapping requirement ---
  useEffect(() => {
    const handleVariableMappingRequired = on('TYPOGRAPHY_VARIABLE_MAPPING_REQUIRED', (data: any) => {
      console.log('[ui.tsx] Received TYPOGRAPHY_VARIABLE_MAPPING_REQUIRED:', data);
      setVariableMappingDialog({
        isOpen: true,
        data: {
          detectedVariables: data.detectedVariables,
          typeSystemKeys: data.typeSystemKeys,
          originalRequest: data.originalRequest
        }
      });
    });

    return () => {
      handleVariableMappingRequired();
    };
  }, []); // No dependencies needed for this listener
  // --- END NEW Listener ---

  // --- NEW: Memoized and Filtered Font List ---
  const googleFontsSet = useMemo(() => new Set(googleFontsList.map(f => f.toLowerCase())), [googleFontsList]);

  const filteredAvailableFonts = useMemo(() => {
    if (showGoogleFonts) {
      return availableFonts;
    }
    if (googleFontsSet.size === 0) {
      console.warn('[ui.tsx] Google Fonts filter active but googleFontsSet is empty — list not loaded yet');
      return availableFonts;
    }
    const filtered = availableFonts.filter(font => {
      const lowerCaseFont = font.toLowerCase();
      return lowerCaseFont === 'inter' || !googleFontsSet.has(lowerCaseFont);
    });
    console.log(`[ui.tsx] Google Fonts filter: ${availableFonts.length} → ${filtered.length} (removed ${availableFonts.length - filtered.length} Google Fonts)`);
    return filtered;
  }, [availableFonts, showGoogleFonts, googleFontsSet]);
  // --- END NEW ---

  // INITIAL_FONTS listener is registered in the mount effect before UI_READY emit.

  // Recalculate preview after manual in-canvas text edits.
  // Backend requests this to reuse the same UPDATE_PREVIEW pipeline as regular UI controls.
  useEffect(() => {
    const handleRecalculatePreviewFromState = on('RECALCULATE_PREVIEW_FROM_STATE', () => {
      if (!previewExists || currentView !== 'main') {
        return;
      }

      const systemWithMappings = applyGridFontSourceMappings(fineTunedStyles);
      const systemToSend = roundingGridSize > 0
        ? applyRoundingToSystem(systemWithMappings, roundingGridSize)
        : systemWithMappings;

      emit("UPDATE_PREVIEW", {
        typeSystem: systemToSend,
        selectedStyle,
        showSpecLabels,
        styleVisibility,
        availableStyles,
        activeMode,
        activeScaleRatio: activeMode === 'desktop' ? desktop.scaleRatio : mobile.scaleRatio,
        namingConvention,
        showGrid: roundingGridSize > 0,
        roundingGridSize,
        lineHeightUnit,
        previewTextAlign,
        baseFontFamily: getEffectiveFontFamily(),
        baseFontStyle: getEffectiveWeight(),
        secondaryFontFamily: secondaryFontEnabled ? getEffectiveSecondaryFontFamily() : undefined,
        secondaryFontStyle: secondaryFontEnabled ? getEffectiveSecondaryWeight() : undefined,
        specimenSnapshot: buildSpecimenSnapshot(systemToSend),
      } as UpdatePreviewRequest);
    });

    return () => {
      handleRecalculatePreviewFromState();
    };
  }, [
    previewExists,
    currentView,
    applyGridFontSourceMappings,
    fineTunedStyles,
    roundingGridSize,
    applyRoundingToSystem,
    selectedStyle,
    showSpecLabels,
    styleVisibility,
    availableStyles,
    activeMode,
    desktop.scaleRatio,
    mobile.scaleRatio,
    namingConvention,
    lineHeightUnit,
    previewTextAlign,
    getEffectiveFontFamily,
    getEffectiveWeight,
    secondaryFontEnabled,
    getEffectiveSecondaryFontFamily,
    getEffectiveSecondaryWeight,
    buildSpecimenSnapshot,
  ]);

  // --- Conditional Rendering Logic ---
  if (currentView === 'landing') {
    return <LandingScreen setCurrentView={(view: 'landing' | 'main' | 'scanResults' | 'textInput' | 'textStyleAssignment') => setCurrentView(view)} />;
  }
  /*
  if (currentView === 'frame') {
    return <FrameFlowScreen 
            setCurrentView={setCurrentView} 
            onScanComplete={handleFrameScanComplete} // Signature already updated
            apiKeyFromStorage={loadedApiKey} // <<< ADDED: Pass loaded API key
           />;
  }
  */
  // <<< ADDED: Conditional rendering for ScanResultsScreen >>>
  if (currentView === 'scanResults') {
    return <ScanResultsScreen 
            setCurrentView={(view: 'landing' | 'main' | 'scanResults') => setCurrentView(view)} 
            initialDetectedStyles={scannedFrameTextStyles || []} 
            targetSystemDefinition={explicitTargetSystemForScan || {}} // MODIFIED: Pass the explicit system
            apiKeyFromStorage={loadedApiKey} // <<< ADDED: Pass loaded API key
            onApplyCompleteAndNavigating={handleApplyCompleteAndNavigate} // <<< ADDED: Pass callback
            onScanComplete={handleFrameScanComplete} // <<< ADDED: Pass scan handler
            autoScanOnMount={autoScanOnMatchOpen}
            onAutoScanHandled={() => setAutoScanOnMatchOpen(false)}
           />;
  }
  // <<< ADDED: Conditional rendering for new text input flow >>>
  if (currentView === 'textInput') {
    return <TextInputScreen 
            setCurrentView={(view: 'landing' | 'main' | 'scanResults' | 'textInput' | 'textStyleAssignment') => setCurrentView(view)} 
            // REMOVE: setUnformattedText={setUnformattedTextToStyle} 
            // REMOVE: setSelectedContentType={setUnformattedTextContentType}
            apiKeyFromStorage={loadedApiKey}
            // Props for ProcessUnformattedTextRequestEvent
            typeSystem={fineTunedStyles} 
            currentSelectedStyle={selectedStyle}
            currentShowSpecLabels={showSpecLabels}
            currentColorMode={colorMode} 
            currentAvailableFontsList={actualAvailableFontsList}
            currentBaseFontFamily={fontFamily}
            currentActiveScaleRatio={activeMode === 'desktop' ? desktop.scaleRatio : mobile.scaleRatio}
           />;
  }
  if (currentView === 'textStyleAssignment') {
    // Log the content type when navigating to the assignment screen
    console.log('[TypographyUI] Navigating to TextStyleAssignmentScreen with content type:', unformattedTextContentType);
    return <TextStyleAssignmentScreen 
            setCurrentView={(view: 'landing' | 'main' | 'scanResults' | 'textInput' | 'textStyleAssignment') => setCurrentView(view)} 
            unformattedText={unformattedTextToStyle}
            // typographySystem={fineTunedStyles} // Pass the current system for styling options
            // For now, let's use a simplified typography system or mock, as fineTunedStyles might be complex
            // We need to ensure typographySystem prop is correctly handled by TextStyleAssignmentScreen
            // For the POC, we can pass an empty object or a minimal one.
            typographySystem={fineTunedStyles || {}} // Or pass a more appropriate initial/default value
            contentType={unformattedTextContentType} // <<< ADDED: Pass content type
            // Pass other necessary props from TypographyUI if needed later
           />;
  }
  if (currentView === 'smartMatchResults') {
    return <SmartMatchResultsScreen
            mappedStyles={smartMatchResults}
            onApply={(headlineWeight: string) => {
              console.log('Applying styles with headline weight:', headlineWeight);
              emit('APPLY_SMART_MATCH_STYLES', {
                mappedStyles: smartMatchResults,
                headlineWeight: headlineWeight
              });
              setCurrentView('main');
            }}
           />;
  }
  // Library view removed - replaced by specimen sampling
  // --- End Conditional Rendering Logic ---

  // Legacy migration bridge:
  // Some older snapshots used deprecated preset labels ("Specimen Compact/Waterfall").
  // We normalize them once here to the current single preset value.
  useEffect(() => {
    if (selectedSpecimenPreset === "Specimen Compact" || selectedSpecimenPreset === "Specimen Waterfall") {
      setSelectedSpecimenPreset("Specimen");
      // Also update the internal selectedLayout if it was linked to "Specimen Full"
      // This logic might already be handled by the dropdown onClick, but good to be safe.
      setSelectedLayout("specimenCompact"); 
    }
  }, [selectedSpecimenPreset, setSelectedLayout]); // Add setSelectedLayout to dependencies

  // --- ADDED: Dedicated useEffect for clearing custom names ONLY when naming convention changes ---
  useEffect(() => {
    if (currentView !== 'main') return;
    
    // This effect should ONLY run when namingConvention changes
    console.log(`[ui.tsx] 🏷️ Naming convention changed to: ${namingConvention}, clearing custom names`);
    
    // Clear all custom names when switching naming conventions
    const clearedStyles: TypographySystem = {};
    Object.keys(fineTunedStyles).forEach(key => {
      const style = fineTunedStyles[key];
      if (style) {
        clearedStyles[key] = {
          ...style,
          customName: undefined // Clear custom name
        };
      }
    });
    
    setFineTunedStyles(clearedStyles);
  }, [namingConvention, currentView]); // ONLY triggered by naming convention changes
  // --- END ADDED ---

  // Recalculate and reset the entire type system when primary controls change.
  useEffect(() => {
    if (isRestoringSnapshotRef.current) return; // Skip during snapshot restoration
    if (currentView !== 'main') {
      return; 
    }
    console.log(`[ui.tsx] Controls changed, recalculating styles. Mode: ${activeMode}`);
    
    // Preserve overrides before recalculation
    const existingOverrides: { [key: string]: Partial<TypographyStyle> } = {};
    Object.keys(fineTunedStyles).forEach(key => {
      const style = fineTunedStyles[key];
      if (!style) return;
      const overrides: Partial<TypographyStyle> = {};
      const fontSource = styleFontSources[key];
      if (style.customName) overrides.customName = style.customName;
      if (style.textCase && style.textCase !== 'Original') overrides.textCase = style.textCase;
      if (preserveImportedNumericAxes.size) {
        overrides.size = style.size;
      }
      if (preserveImportedNumericAxes.lineHeight) {
        overrides.lineHeight = style.lineHeight;
      }
      if (preserveImportedNumericAxes.letterSpacing) {
        overrides.letterSpacing = style.letterSpacing;
      }
      if (fontSource === 'custom') {
        if (style.fontFamily) overrides.fontFamily = style.fontFamily;
        if (style.fontStyle) overrides.fontStyle = style.fontStyle;
      }
      if (Object.keys(overrides).length > 0) existingOverrides[key] = overrides;
    });
    
    console.log(`[ui.tsx] Recalculation: Preserving overrides for ${Object.keys(existingOverrides).length} styles`);
    
    const dynamicAnchors = getDynamicAnchors();
    const newTypeSystem = calculateStyles({
      modeSettings: settings[activeMode],
      fontFamily: getEffectiveFontFamily(),
      fontStyle: selectedStyle,
      lineHeightCurve,
      letterSpacingCurve,
      letterSpacingSplit: isLetterSpacingSplit,
      availableStyleAnchors: dynamicAnchors,
      secondaryFontFamily: secondaryFontEnabled ? getEffectiveSecondaryFontFamily() : undefined,
      secondaryFontStyle: secondaryFontEnabled ? secondarySelectedStyle : undefined,
    });
    
    // Merge back preserved overrides
    if (Object.keys(existingOverrides).length > 0) {
      Object.keys(existingOverrides).forEach(key => {
        if (newTypeSystem[key]) {
          newTypeSystem[key] = { ...newTypeSystem[key], ...existingOverrides[key] };
        }
      });
      console.log(`[ui.tsx] Recalculation: Restored overrides for ${Object.keys(existingOverrides).length} styles`);
    }
    
    setFineTunedStyles(newTypeSystem);
  }, [
    // Dependencies that should trigger a full recalculation (REMOVED namingConvention)
    settings,
    getEffectiveFontFamily, // Use effective font instead of just fontFamily
    selectedStyle,
    lineHeightCurve,
    letterSpacingCurve,
    isLetterSpacingSplit,
    currentView,
    activeMode,
    secondaryFontEnabled, getEffectiveSecondaryFontFamily, secondarySelectedStyle,
    styleFontSources,
    preserveImportedNumericAxes
    // NOTE: namingConvention removed from dependencies - handled by dedicated useEffect above
  ]);

  // This effect updates the preview when styles change.
  useEffect(() => {
    if (!previewExists || currentView !== 'main') {
      return;
    }

    if (debounceTimer) clearTimeout(debounceTimer);

    const newTimer = window.setTimeout(() => {
        debugUiHotpath(`[ui.tsx] Styles changed, updating preview. Baseline grid applied: ${roundingGridSize > 0}`);
        // CRITICAL: Apply grid font source mappings before sending to canvas
        const systemWithMappings = applyGridFontSourceMappings(fineTunedStyles);
        const systemToSend = roundingGridSize > 0 ? applyRoundingToSystem(systemWithMappings, roundingGridSize) : systemWithMappings;
        
        emit("UPDATE_PREVIEW", {
            typeSystem: systemToSend,
            selectedStyle,
            showSpecLabels,
            styleVisibility,
            availableStyles,
            activeMode,
            activeScaleRatio: activeMode === 'desktop' ? desktop.scaleRatio : mobile.scaleRatio,
            namingConvention,
            showGrid: roundingGridSize > 0,
            roundingGridSize,
            lineHeightUnit,
            previewTextAlign,
            baseFontFamily: getEffectiveFontFamily(),
            baseFontStyle: getEffectiveWeight(),
            secondaryFontFamily: secondaryFontEnabled ? getEffectiveSecondaryFontFamily() : undefined,
            secondaryFontStyle: secondaryFontEnabled ? getEffectiveSecondaryWeight() : undefined,
            specimenSnapshot: buildSpecimenSnapshot(systemToSend),
        } as UpdatePreviewRequest);
    }, 0); // A small debounce
    
    setDebounceTimer(newTimer as any as number);

  }, [
    fineTunedStyles, // Main trigger
    // Other dependencies for the emit payload
    previewExists,
    currentView,
    roundingGridSize,
    selectedStyle,
    showSpecLabels,
    styleVisibility, // <<< ADDED: Add visibility to dependency array
    availableStyles,
    activeMode,
    desktop.scaleRatio,
    mobile.scaleRatio,
    applyRoundingToSystem,
    applyGridFontSourceMappings,
    buildSpecimenSnapshot
  ]);

  // Effect to apply naming dedupe + selected preset visibility.
  useEffect(() => {
    if (currentView !== 'main') return;
    if (useSampledStyleVisibility) return;
    setStyleVisibility(getVisibilityForPreset(selectedPresetProfile));
  }, [namingConvention, currentView, selectedPresetProfile, getVisibilityForPreset, setStyleVisibility, useSampledStyleVisibility]);

  // --- NEW: Weight Mapping Dialog Handler ---
  const handleWeightMappingSubmit = useCallback((mapping: { weightMapping: { [key: string]: string }; selectedSizeGroups: string[] }) => {
    console.log('[ui.tsx] Submitting weight mapping:', mapping);
    emit('APPLY_TEXT_STYLE_WEIGHT_MAPPING', {
      weightMapping: mapping.weightMapping,
      selectedSizeGroups: mapping.selectedSizeGroups,
      originalRequest: weightMappingDialog.originalRequest
    });
    setWeightMappingDialog({ isOpen: false, data: null, originalRequest: null });
    setActiveLoadingCTA('update'); // Show loading state
  }, [weightMappingDialog.originalRequest]);

  const handleWeightMappingCancel = useCallback(() => {
    setWeightMappingDialog({ isOpen: false, data: null, originalRequest: null });
    setActiveLoadingCTA(null); // Clear loading state
  }, []);
  // --- END NEW Handler ---

  // --- NEW: Reset Grid Overrides Function ---
  const handleResetGridOverrides = useCallback(() => {
    console.log('[ui.tsx] Resetting all grid overrides to calculated values');

    // 1. Reset style font source mappings to default
    setStyleFontSources(DEFAULT_STYLE_FONT_SOURCES);
    console.log('[ui.tsx] 🔧 Reset: Restored default font source mappings');
    
    // 2. Recalculate clean typography system (this will restore calculated values)
    const dynamicAnchors = getDynamicAnchors();
    const effectivePrimaryFont = getEffectiveFontFamily();
    const effectiveSecondaryFont = secondaryFontEnabled ? getEffectiveSecondaryFontFamily() : undefined;
    
    const freshTypeSystem = calculateStyles({
      modeSettings: settings[activeMode],
      fontFamily: effectivePrimaryFont,
      fontStyle: getEffectiveWeight(),
      lineHeightCurve,
      letterSpacingCurve,
      letterSpacingSplit: isLetterSpacingSplit,
      availableStyleAnchors: dynamicAnchors,
      secondaryFontFamily: effectiveSecondaryFont,
      secondaryFontStyle: secondaryFontEnabled ? getEffectiveSecondaryWeight() : undefined,
    });
    
    // 3. Apply default font source mappings to the fresh system
    Object.keys(DEFAULT_STYLE_FONT_SOURCES).forEach(styleKey => {
      if (freshTypeSystem[styleKey]) {
        const source = DEFAULT_STYLE_FONT_SOURCES[styleKey] as 'primary' | 'secondary';
        const targetFontFamily = source === 'primary' ? effectivePrimaryFont : effectiveSecondaryFont;
        if (targetFontFamily) {
          const mainWeight = source === 'primary' ? getEffectiveWeight() : getEffectiveSecondaryWeight();
          freshTypeSystem[styleKey] = {
            ...freshTypeSystem[styleKey],
            fontFamily: targetFontFamily,
            fontStyle: mainWeight
          };
        }
      }
    });
    
    console.log('[ui.tsx] 🔧 Reset: Generated fresh typography system with default font mappings');

    // 4. Re-apply generator-level text case (these are global settings, not overrides)
    const headingKeys = TYPOGRAPHY_SCALE_ORDER.HEADINGS as readonly string[];
    const textKeys = TYPOGRAPHY_SCALE_ORDER.TEXT_STYLES as readonly string[];
    for (const key of headingKeys) {
      if (freshTypeSystem[key]) {
        freshTypeSystem[key] = { ...freshTypeSystem[key], textCase: generatorHeadingCase };
      }
    }
    for (const key of textKeys) {
      if (freshTypeSystem[key]) {
        freshTypeSystem[key] = { ...freshTypeSystem[key], textCase: generatorTextCase };
      }
    }

    setFineTunedStyles(freshTypeSystem);
    
    // 5. Clear manual edits flag and weight locks.
    // Keep current styleVisibility untouched: hide/show is a UI preference, not an override.
    setHasManualGridEdits(false);
    setStyleWeightLocked({});
   }, [
     setStyleFontSources,
     getDynamicAnchors,
     getEffectiveFontFamily,
     getEffectiveSecondaryFontFamily,
     getEffectiveWeight,
     getEffectiveSecondaryWeight,
     settings,
     activeMode,
     lineHeightCurve,
     letterSpacingCurve,
     isLetterSpacingSplit,
     secondaryFontEnabled,
     generatorHeadingCase,
     generatorTextCase,
   ]);

  const handleResetGeneratorDefaults = useCallback(() => {
    console.log('[ui.tsx] Resetting generator controls to active preset defaults');
    const presetBaselineForMode = presetBaselineSnapshotRef.current ?? getPresetBaselineModeSettings(activeMode, selectedPresetProfile);

    setSettings((prev) => ({
      ...prev,
      [activeMode]: {
        ...prev[activeMode],
        baseSize: presetBaselineForMode.baseSize,
        scaleRatio: presetBaselineForMode.scaleRatio,
        letterSpacing: presetBaselineForMode.letterSpacing,
        maxLetterSpacing: presetBaselineForMode.maxLetterSpacing,
        headingLetterSpacing: presetBaselineForMode.headingLetterSpacing,
        headingMaxLetterSpacing: presetBaselineForMode.headingMaxLetterSpacing,
        textLetterSpacing: presetBaselineForMode.textLetterSpacing,
        textMaxLetterSpacing: presetBaselineForMode.textMaxLetterSpacing,
        headlineMinLineHeight: presetBaselineForMode.headlineMinLineHeight,
        headlineMaxLineHeight: presetBaselineForMode.headlineMaxLineHeight,
        textMinLineHeight: presetBaselineForMode.textMinLineHeight,
        textMaxLineHeight: presetBaselineForMode.textMaxLineHeight,
        maxSize: presetBaselineForMode.maxSize,
        minSize: presetBaselineForMode.minSize,
      },
    }));

    setHasManualGridEdits(false);
    setPreserveImportedNumericAxes({
      size: false,
      lineHeight: false,
      letterSpacing: false,
    });
    // Do NOT reset useSampledStyleVisibility here — resetting generator
    // sliders/values should never touch style visibility.  Visibility is
    // a lightweight user preference, not a value-level override.
  }, [
    activeMode,
    selectedPresetProfile,
    getPresetBaselineModeSettings,
    setSettings,
    setHasManualGridEdits,
  ]);

  const releaseImportedNumericAxis = useCallback((axis: 'size' | 'lineHeight' | 'letterSpacing') => {
    setPreserveImportedNumericAxes((prev) => {
      if (!prev[axis]) return prev;
      return {
        ...prev,
        [axis]: false,
      };
    });
  }, []);

  // --- NEW: Variable Mapping Dialog Handler ---
  const handleVariableMappingSubmit = useCallback((mapping: { variableMapping: any; originalRequest: any }) => {
    console.log('[ui.tsx] Submitting variable mapping:', mapping);
    emit('APPLY_TYPOGRAPHY_VARIABLE_MAPPING', {
      variableMapping: mapping.variableMapping,
      originalRequest: mapping.originalRequest
    });
    setVariableMappingDialog({ isOpen: false, data: null });
    setActiveLoadingCTA('update'); // Show loading state
  }, []);

  const handleVariableMappingCancel = useCallback(() => {
    setVariableMappingDialog({ isOpen: false, data: null });
    setActiveLoadingCTA(null); // Clear loading state
  }, []);
  // --- END NEW Handler ---

  // --- NEW: Unified Update Dialog Handler ---
  const handleUnifiedUpdateSubmit = useCallback((mapping: { [systemKey: string]: string }) => {
    console.log('[ui.tsx] Submitting style mapping:', mapping);
    emit('APPLY_STYLE_MAPPING', {
      mapping,
      originalRequest: unifiedUpdateDialog.data.originalRequest,
      variableHandlingMode: 'disconnect',
    });
    setActiveLoadingCTA('update');
  }, [unifiedUpdateDialog.data]);

  const handleUnifiedUpdateCancel = useCallback(() => {
    setUnifiedUpdateDialog({ isOpen: false, data: null });
    setActiveLoadingCTA(null); // Clear loading state
  }, []);
  // --- END NEW Handler ---

  // --- NEW: Unified Update Event Listener ---
  useEffect(() => {
    const handleUnifiedUpdateRequired = on('STYLE_MAPPING_REQUIRED', (data: any) => {
      console.log('[ui.tsx] Received STYLE_MAPPING_REQUIRED:', data);
      setActiveLoadingCTA(null);
      setUnifiedUpdateDialog({
        isOpen: true,
        data: data
      });
    });

    return () => {
      handleUnifiedUpdateRequired();
    };
  }, []); // No dependencies needed for this listener
  // --- END NEW Listener ---

  // --- NEW: Weight Mapping Dialog Component ---
  if (weightMappingDialog.isOpen && weightMappingDialog.data) {
    return (
      <WeightMappingScreen 
        data={weightMappingDialog.data}
        onSubmit={handleWeightMappingSubmit}
        onCancel={handleWeightMappingCancel}
      />
    );
  }

  // --- NEW: Variable Mapping Dialog Component ---
  if (variableMappingDialog.isOpen && variableMappingDialog.data) {
    return (
      <VariableMappingScreen 
        data={variableMappingDialog.data}
        onSubmit={handleVariableMappingSubmit}
        onCancel={handleVariableMappingCancel}
      />
    );
  }
  // --- END NEW Component ---

  if (unifiedUpdateDialog.isOpen && unifiedUpdateDialog.data) {
    return (
      <UnifiedUpdateScreen 
        data={unifiedUpdateDialog.data}
        onSubmit={handleUnifiedUpdateSubmit}
        onCancel={handleUnifiedUpdateCancel}
      />
    );
  }

  return (
    <Fragment>
    {pendingSpecimenSnapshot && (
      <div className="override-modal-backdrop" onClick={handleCancelSpecimenLoad}>
        <div className="override-modal" onClick={(e: any) => e.stopPropagation()}>
          <span>Specimen detected.<br />Selected frame will become active.</span>
          <div className="override-modal-actions">
            <button className="button-secondary-new" onClick={handleCancelSpecimenLoad}>Cancel</button>
            <button className="button-secondary-new active" onClick={handleConfirmSpecimenLoad}>Load</button>
          </div>
        </div>
      </div>
    )}
    {showSuccessModal && (
      <div className="modal-overlay" onClick={() => setShowSuccessModal(false)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="control-row-label-group" style={{ marginBottom: 'var(--sizing-default-spacers-spacer-2)' }}>
            <span className="control-label">{successModalMessage}</span>
          </div>
          <div className="footer-button-group" style={{ justifyContent: 'flex-end' }}>
            <button className="button-secondary-new active" onClick={() => setShowSuccessModal(false)}>
              OK
            </button>
          </div>
        </div>
      </div>
    )}
    <GeneratorScreen
      {...{
        // currentView and activeMode are now from Zustand store
        setPreviewExists,
        mainContentRef,
        openSections,
        toggleSection,
        fontFamily,
        setFontFamily,
        availableFonts: filteredAvailableFonts, // <<< UPDATED: Pass filtered list
        availableStyles,
        selectedStyle,
        setSelectedStyle,
        actualAvailableFontsList,
        
        // Secondary font props
        secondaryFontEnabled,
        setSecondaryFontEnabled,
        isLetterSpacingSplit,
        secondaryFontLinked,
        setSecondaryFontLinked,
        toggleSecondaryFontLinked,
        secondaryWeightLinked,
        setSecondaryWeightLinked,
        toggleSecondaryWeightLinked,
        secondaryFontFamily,
        setSecondaryFontFamily,
        secondarySelectedStyle,
        setSecondarySelectedStyle,
        secondaryAvailableStyles,
        
        // Preview functionality
        previewFontFamily,
        isPreviewMode,
        startFontPreview,
        stopFontPreview,
        commitPreviewFont,
        getEffectiveFontFamily,
        
        // Weight preview functionality
        previewWeight,
        isWeightPreviewMode,
        startWeightPreview,
        stopWeightPreview,
        commitPreviewWeight,
        getEffectiveWeight,
        
        // Secondary preview functionality
        previewSecondaryFontFamily,
        isSecondaryPreviewMode,
        startSecondaryFontPreview,
        stopSecondaryFontPreview,
        commitSecondaryPreviewFont,
        getEffectiveSecondaryFontFamily,
        
        // Secondary weight preview functionality
        previewSecondaryWeight,
        isSecondaryWeightPreviewMode,
        startSecondaryWeightPreview,
        stopSecondaryWeightPreview,
        commitSecondaryPreviewWeight,
        getEffectiveSecondaryWeight,
        
        // Pass the grid font source mapping helper
        applyGridFontSourceMappings,
        
        emit,
        // showGoogleFonts is now in Zustand store
        googleFontsList, // Pass Google Fonts list for smart filtering
        desktop: settings.desktop,
        mobile: settings.mobile,
        setSettings: setSettingsFromUI,
        setSettingsInternal: setSettings,
        textMainSliderDotValues,
        ratioSliderDotValues,
        designSystemPresets: DESIGN_SYSTEM_PRESET_OPTIONS,
        getScaleRatioDisplayText,
        // lineHeightCurve is now from Zustand store
        headlineDotValues,
        textLineHeightDotValues,
        // letterSpacingCurve is now from Zustand store
        letterSpacingDotValues,
        headingLetterSpacingDotValues,
        textLetterSpacingDotValues,
        fineTunedStyles,
        // roundingGridSize is now from Zustand store
        TYPOGRAPHY_SCALE_POINTS,
        getDisplayUIName,
        handleFineTuneChange,
        handleGridKeyDown,
        handleSelectOrResetClick, // <<< ADDED
        openGridFontStyleDropdownKey,
        setOpenGridFontStyleDropdownKey,
        gridDropdownsRef,
        // styleVisibility is now from Zustand store
        textSelectionButtonMode, // <<< ADDED
        setTextSelectionButtonMode, // <<< ADDED
        isRoundingDropdownOpen,
        setIsRoundingDropdownOpen,
        roundingDropdownRef,
        activeLoadingCTA,
        isSpecimenLayoutListOpen,
        setIsSpecimenLayoutListOpen,
        selectedSpecimenPreset,
        setSelectedSpecimenPreset,
        specimenPresetOptions,
        selectedLayout,
        setSelectedLayout,
        previewTextAlign,
        setPreviewTextAlign,
        isTextPresetListOpen,
        setIsTextPresetListOpen,
        textPresetDropdownContainerRef,
        selectedTextPreset,
        setSelectedTextPreset,
        textPresetOptions,
        waterfallText,
        setWaterfallText,
        // colorMode, showSpecLabels, previewExists, hasManualTextEdits are now from Zustand store
        applyRoundingToSystem,
        handleGeneratePreview,
        handleCreateStyles,
        handleUpdateStyles,
        handleGenerateSpecimen,
        specimenLayoutDropdownContainerRef,
        IconComponent: Icon,
        RangeSliderComponent: RangeSlider,
        CustomSingleSliderComponent: CustomSingleSlider,
        isStylesDropdownOpen,
        setIsStylesDropdownOpen,
        selectedStylesAction,
        setSelectedStylesAction,
        stylesDropdownContainerRef,
        isExportDropdownOpen,
        setIsExportDropdownOpen,
        exportDropdownContainerRef,
        // namingConvention is now from Zustand store
        namingConventionOptions: NAMING_CONVENTION_OPTIONS,
        getSliderAnchorLabels,
        handleSliderAnchorAdjustment,
        selectedPresetProfile,
        presetProfileOptions: PRESET_PROFILE_OPTIONS,
        onPresetProfileSelect: applyPresetProfile,
        // styleFontSources is now from Zustand store
        onStyleFontSourceChange,
        onStyleWeightChange,
        onStyleCustomFontChange,
        onStyleFontRelock,
        handleGlobalTextCaseChange,
        getGlobalTextCase,
        handleResetGridOverrides,
        handleResetGeneratorDefaults,
        hasGeneratorDeviationFromPreset,
        hasManualStyleTweaks,
        releaseImportedNumericAxis,
        hasActiveSpecimenContext,
        hasScannedFrameOnly: scannedFrameTextStyles !== null && scannedFrameTextStyles.length > 0,
        suppressCtaHighlight: !!pendingSpecimenSnapshot,
      }}
    />
    </Fragment>
  );
}

  // *** Apply baseline grid to line heights only (preserve calculated font sizes and letter spacing) ***
  const applyRoundingToSystem = (system: TypographySystem, gridSize: number = 4): TypographySystem => {
      const roundedSystem: TypographySystem = {};
      for (const [key, style] of Object.entries(system)) {
          if (!style) continue;
          
          // Keep original calculated font size (DO NOT round)
          const originalSize = style.size ?? 0;
          
          // Round line height to baseline grid (pixel-based, not percentage-based)
          const lineHeightInPixels = originalSize * (style.lineHeight ?? 1.2);
          const roundedLineHeightPixels = Math.round(lineHeightInPixels / gridSize) * gridSize;
          const roundedLineHeight = roundedLineHeightPixels / originalSize;
          
          // Preserve letterSpacing exactly as set (no rounding in baseline mode)
          const preservedLetterSpacing = style.letterSpacing ?? 0;

          roundedSystem[key] = {
              ...style,
              size: originalSize, // Keep original calculated size
              lineHeight: roundedLineHeight, // Only round line height for baseline grid
              letterSpacing: preservedLetterSpacing,
          };
      }
      return roundedSystem;
  };

  // Initialize UI
  export default function () {
    document.body.innerHTML = '<div id="app"></div>';
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.height = "100vh";
    document.body.style.overflow = "hidden"; // Ensure this is UNCOMMENTED

    const app = document.getElementById("app");
    if (app) {
      render(<TypographyUI />, app);
    }
  }
  // Force update
  console.log("test")