import { h, Fragment, ComponentType } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
// import { StateUpdater } from "preact/hooks"; // No longer directly using StateUpdater type here
import { TargetedEvent } from 'preact/compat';
import { TypographyStyle, TypographySystem, PreviewLayoutType, PreviewTextAlignMode, UpdatePreviewRequest } from "../../core/types"; // Assuming types.ts is in the parent directory
import { on } from "@create-figma-plugin/utilities";
import { useAppStore } from '../store/appStore';
import { getConventionName } from "../naming-conventions";
import { PREVIEW_THEMES, PreviewThemeId, resolvePreviewTheme } from "../../core/constants";
// import { useClickOutside } from '../hooks/useClickOutside'; // <<< REMOVING THIS HOOK

// Assuming IconProps is defined elsewhere (e.g., in ui.tsx or a shared types file)
// For now, a basic placeholder if not imported directly.
// It's better if Icon component and its props are centrally defined and imported.
interface IconProps { name: string; size: number; className?: string; }

interface TextPresetOption {
  label: string;
  value: string;
}

interface ExportStyleEntry {
  styleKey: string;
  tokenKey: string;
  label: string;
  style: TypographyStyle;
}

interface DerivedTypographyFields {
  fontFamily: string;
  fontStyleName: string;
  fontWeight: string;
  fontStyle: 'normal' | 'italic';
  textCase: string;
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
}

interface AliasMaps {
  family: Record<string, string>;
  styleName: Record<string, string>;
  weight: Record<string, string>;
  style: Record<string, string>;
  textTransform: Record<string, string>;
  textCase: Record<string, string>;
}

const DEFAULT_EXPORT_FONT_SOURCES: { [key: string]: 'primary' | 'secondary' } = {
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

// Define more explicit function types for state setters
type BooleanSetter = (value: boolean | ((prevState: boolean) => boolean)) => void;
type StringSetter = (value: string | ((prevState: string) => string)) => void;
type PreviewLayoutTypeSetter = (value: PreviewLayoutType | ((prevState: PreviewLayoutType) => PreviewLayoutType)) => void;
type PreviewTextAlignModeSetter = (value: PreviewTextAlignMode | ((prevState: PreviewTextAlignMode) => PreviewTextAlignMode)) => void;

export interface FooterSectionProps {
  // currentView is now managed by Zustand store
  activeLoadingCTA: string | null;
  isSpecimenLayoutListOpen: boolean;
  setIsSpecimenLayoutListOpen: BooleanSetter;
  selectedSpecimenPreset: string;
  setSelectedSpecimenPreset: StringSetter;
  specimenPresetOptions: string[];
  // activeMode is now managed by Zustand store
  selectedLayout: PreviewLayoutType;
  setSelectedLayout: PreviewLayoutTypeSetter;
  previewTextAlign: PreviewTextAlignMode;
  setPreviewTextAlign: PreviewTextAlignModeSetter;
  isTextPresetListOpen: boolean;
  setIsTextPresetListOpen: BooleanSetter;
  textPresetDropdownContainerRef: any; // Consider more specific type if possible h.RefObject<HTMLDivElement>
  selectedTextPreset: string;
  setSelectedTextPreset: StringSetter;
  textPresetOptions: TextPresetOption[];
  setWaterfallText: StringSetter;
  // colorMode, showSpecLabels, hasManualTextEdits, previewExists, roundingGridSize are now managed by Zustand store
  fineTunedStyles: TypographySystem;
  selectedStyle: string;
  availableStyles: string[];
  desktopScaleRatio: number;
  mobileScaleRatio: number;
  applyRoundingToSystem: (system: TypographySystem, gridSize?: number) => TypographySystem;
  handleGeneratePreview: (layoutType?: PreviewLayoutType) => void;
  handleCreateStyles: () => void;
  handleUpdateStyles: () => void;
  handleGenerateSpecimen: () => void;
  emit: (name: string, ...args: any[]) => void;
  emitUpdatePreview: (typeSystem: TypographySystem, overrides?: Partial<UpdatePreviewRequest>) => void;
  IconComponent: ComponentType<IconProps>;
  specimenLayoutDropdownContainerRef: any;
  showGrid: boolean;
  // Styles action dropdown
  isStylesDropdownOpen: boolean;
  setIsStylesDropdownOpen: BooleanSetter;
  selectedStylesAction: 'Generate Styles' | 'Create Styles' | 'Update Styles';
  setSelectedStylesAction: (action: 'Generate Styles' | 'Create Styles' | 'Update Styles') => void;
  stylesDropdownContainerRef: any;
  // Export dropdown state
  isExportDropdownOpen: boolean;
  setIsExportDropdownOpen: BooleanSetter;
  exportDropdownContainerRef: any;
  // hasManualTextEdits is now managed by Zustand store
  hasActiveSpecimenContext?: boolean;
  hasScannedFrameOnly: boolean; // True when scanned frame active but no specimen generated
  suppressCtaHighlight?: boolean;
}

export function FooterSection({
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
  setWaterfallText,
  // previewExists, roundingGridSize are now from Zustand store
  fineTunedStyles,
  selectedStyle,
  availableStyles,
  desktopScaleRatio,
  mobileScaleRatio,
  applyRoundingToSystem,
  handleGeneratePreview,
  handleCreateStyles,
  handleUpdateStyles,
  handleGenerateSpecimen,
  emit,
  emitUpdatePreview,
  IconComponent,
  specimenLayoutDropdownContainerRef,
  showGrid,
  // Styles action dropdown props
  isStylesDropdownOpen,
  setIsStylesDropdownOpen,
  selectedStylesAction,
  setSelectedStylesAction,
  stylesDropdownContainerRef,
  // Export dropdown props
  isExportDropdownOpen,
  setIsExportDropdownOpen,
  exportDropdownContainerRef,
  hasActiveSpecimenContext = false,
  hasScannedFrameOnly,
  suppressCtaHighlight = false,
}: FooterSectionProps) {
  // Get state from Zustand store
  const { showSpecLabels, setShowSpecLabels, hasManualTextEdits, previewExists, lineHeightUnit, roundingGridSize, activeMode, currentView, styleVisibility, styleFontSources, namingConvention, previewThemeId, customPreviewColors, setPreviewTheme } = useAppStore();

  // --- NEW: Text generation loading state ---
  // Debug log
  console.log('[FooterSection] hasManualTextEdits:', hasManualTextEdits);
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  const [isPlayCycleVisualActive, setIsPlayCycleVisualActive] = useState(false);
  
  // --- Theme dropdown state ---
  const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);
  const [customBgHex, setCustomBgHex] = useState('');
  const [customTextHex, setCustomTextHex] = useState('');
  const themeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isThemeDropdownOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (themeDropdownRef.current && !themeDropdownRef.current.contains(event.target as Node)) {
        setIsThemeDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isThemeDropdownOpen]);

  const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    const clean = hex.replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(clean)) return null;
    const n = parseInt(clean, 16);
    return { r: ((n >> 16) & 0xFF) / 255, g: ((n >> 8) & 0xFF) / 255, b: (n & 0xFF) / 255 };
  };

  const rgbToHex = (c: { r: number; g: number; b: number }): string => {
    const to8 = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
    return `${to8(c.r)}${to8(c.g)}${to8(c.b)}`.toUpperCase();
  };

  const activeTheme = resolvePreviewTheme(previewThemeId, customPreviewColors);
  const currentBgHex = rgbToHex(activeTheme.background);
  const currentTextHex = rgbToHex(activeTheme.text);

  const handleThemeSelect = (themeId: PreviewThemeId) => {
    setPreviewTheme(themeId);
    setIsThemeDropdownOpen(false);
  };

  const handleCustomColorSubmit = () => {
    const bg = hexToRgb(customBgHex);
    if (!bg) return;
    const text = customTextHex ? hexToRgb(customTextHex) : undefined;
    setPreviewTheme('custom', { background: bg, text: text || undefined });
    setIsThemeDropdownOpen(false);
  };

  // --- Auto-play state ---
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const autoPlayTimerRef = useRef<number | null>(null);
  const playCycleVisualTimerRef = useRef<number | null>(null);
  const AUTO_PLAY_INTERVAL = 2520;

  // Listen for text generation events
  useEffect(() => {
    const startListener = on('TEXT_GENERATION_START', () => {
      console.log('[FooterSection] Text generation started');
      setIsGeneratingText(true);
      setIsPlayCycleVisualActive(true);
      if (playCycleVisualTimerRef.current) {
        clearTimeout(playCycleVisualTimerRef.current);
      }
      playCycleVisualTimerRef.current = window.setTimeout(() => {
        setIsPlayCycleVisualActive(false);
        playCycleVisualTimerRef.current = null;
      }, AUTO_PLAY_INTERVAL);
    });
    const completeListener = on('TEXT_GENERATION_COMPLETE', () => {
      console.log('[FooterSection] Text generation completed');
      setIsGeneratingText(false);
    });
    
    return () => {
      startListener();
      completeListener();
    };
  }, [AUTO_PLAY_INTERVAL]);

  // Auto-play effect
  useEffect(() => {
    if (isAutoPlaying && !isGeneratingText) {
      console.log('[FooterSection] Starting auto-play timer');
      autoPlayTimerRef.current = window.setTimeout(() => {
        console.log('[FooterSection] Auto-play: generating text');
        emit('UPDATE_SPECIMEN_HEADING');
      }, AUTO_PLAY_INTERVAL);
    } else {
      // Clear timer when paused or generating
      if (autoPlayTimerRef.current) {
        console.log('[FooterSection] Clearing auto-play timer');
        clearTimeout(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
    }

    // Cleanup on unmount
    return () => {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
    };
  }, [isAutoPlaying, isGeneratingText, emit]);

  // Clean up timer when component unmounts
  useEffect(() => {
    return () => {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
      if (playCycleVisualTimerRef.current) {
        clearTimeout(playCycleVisualTimerRef.current);
        playCycleVisualTimerRef.current = null;
      }
    };
  }, []);
  // --- END NEW ---

  const pauseAutoPlay = () => {
    setIsAutoPlaying(false);
    setIsPlayCycleVisualActive(false);
    if (autoPlayTimerRef.current) {
      clearTimeout(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    if (playCycleVisualTimerRef.current) {
      clearTimeout(playCycleVisualTimerRef.current);
      playCycleVisualTimerRef.current = null;
    }
  };

  const handlePreviewTextAlignChange = (nextAlign: PreviewTextAlignMode) => {
    if (nextAlign === previewTextAlign) {
      return;
    }
    setPreviewTextAlign(nextAlign);
    if (!previewExists) {
      return;
    }
    const systemToUpdate = roundingGridSize > 0 ? applyRoundingToSystem(fineTunedStyles, roundingGridSize) : fineTunedStyles;
    emitUpdatePreview(systemToUpdate, { previewTextAlign: nextAlign });
  };

  // --- NEW: More robust outside click handling for Specimen Layout dropdown ---
  const specimenTriggerRef = useRef<HTMLDivElement>(null); // Ref for the trigger

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        isSpecimenLayoutListOpen &&
        specimenLayoutDropdownContainerRef.current &&
        !specimenLayoutDropdownContainerRef.current.contains(event.target as Node) &&
        specimenTriggerRef.current &&
        !specimenTriggerRef.current.contains(event.target as Node)
      ) {
        setIsSpecimenLayoutListOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSpecimenLayoutListOpen, specimenLayoutDropdownContainerRef, setIsSpecimenLayoutListOpen]);
  // --- END NEW ---


  // --- NEW: Outside click handling for Export dropdown ---
  const exportTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        isExportDropdownOpen &&
        exportDropdownContainerRef.current &&
        !exportDropdownContainerRef.current.contains(event.target as Node) &&
        exportTriggerRef.current &&
        !exportTriggerRef.current.contains(event.target as Node)
      ) {
        setIsExportDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isExportDropdownOpen, exportDropdownContainerRef, setIsExportDropdownOpen]);
  // --- END NEW ---

  const generateButtonText = selectedLayout === 'cleanWaterfall' ? 'Create Waterfall'
                          : selectedLayout === 'structuredText' ? 'Create Article'
                          : hasActiveSpecimenContext ? 'Create New Specimen' : 'Create Specimen';

  const stylesTriggerRef = useRef<HTMLDivElement>(null);
  const normalizedStylesAction = selectedStylesAction === 'Create Styles' ? 'Generate Styles' : selectedStylesAction;
  const stylesActionHandler = normalizedStylesAction === "Update Styles" ? handleUpdateStyles : handleCreateStyles;
  const stylesLoadingCTA = normalizedStylesAction === "Update Styles" ? 'update' : 'create';
  const stylesActionDisplayLabel = normalizedStylesAction === "Update Styles" ? "Update Styles" : "Generate Styles";
  const shouldHighlightGenerateCTA = !suppressCtaHighlight && !previewExists && !hasScannedFrameOnly;
  const shouldHighlightStylesCTA = !suppressCtaHighlight && previewExists;

  // Close styles action dropdown when clicking outside trigger/list.
  useEffect(() => {
    function handleStylesClickOutside(event: MouseEvent) {
      if (
        isStylesDropdownOpen &&
        stylesDropdownContainerRef.current &&
        !stylesDropdownContainerRef.current.contains(event.target as Node) &&
        stylesTriggerRef.current &&
        !stylesTriggerRef.current.contains(event.target as Node)
      ) {
        setIsStylesDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleStylesClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleStylesClickOutside);
    };
  }, [isStylesDropdownOpen, stylesDropdownContainerRef, setIsStylesDropdownOpen]);

  // Export functions
  const downloadBlob = (filename: string, blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    downloadBlob(filename, blob);
  };

  const roundValue = (value: number, decimals: number): number => {
    const multiplier = 10 ** decimals;
    return Math.round(value * multiplier) / multiplier;
  };

  const roundToStep = (value: number, step: number): number => {
    const inv = 1 / step;
    return Math.round(value * inv) / inv;
  };

  const formatNumber = (value: number, decimals: number): string => {
    const rounded = roundValue(value, decimals);
    return rounded.toString();
  };

  const toKebabCase = (value: string): string => {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const escapeCssString = (value: string): string => {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  };

  const getTextTransform = (textCase?: string): 'none' | 'uppercase' | 'lowercase' | 'capitalize' => {
    switch ((textCase || "Original").toLowerCase()) {
      case "uppercase":
        return "uppercase";
      case "lowercase":
        return "lowercase";
      case "title case":
        return "capitalize";
      default:
        return "none";
    }
  };

  const inferFontWeight = (fontStyleName: string): string => {
    const normalized = fontStyleName.toLowerCase().trim();
    if (!normalized || normalized === "regular" || normalized === "normal") return "400";
    if (/(thin|hairline)\b/.test(normalized)) return "100";
    if (/(extra[\s-]?light|ultra[\s-]?light)\b/.test(normalized)) return "200";
    if (/\blight\b/.test(normalized)) return "300";
    if (/\bmedium\b/.test(normalized)) return "500";
    if (/(semi[\s-]?bold|demi[\s-]?bold)\b/.test(normalized)) return "600";
    if (/\bbold\b/.test(normalized) && !/(extra[\s-]?bold|ultra[\s-]?bold)/.test(normalized)) return "700";
    if (/(extra[\s-]?bold|ultra[\s-]?bold)\b/.test(normalized)) return "800";
    if (/(black|heavy)\b/.test(normalized)) return "900";
    const numeric = normalized.match(/\b([1-9]00)\b/);
    return numeric ? numeric[1] : "400";
  };

  const getDerivedTypographyFields = (style: TypographyStyle): DerivedTypographyFields => {
    const fontFamily = style.fontFamily?.trim() || "inherit";
    const fontStyleName = style.fontStyle?.trim() || "Regular";
    const fontStyle = fontStyleName.toLowerCase().includes("italic") ? "italic" : "normal";
    const textCase = style.textCase || "Original";
    return {
      fontFamily,
      fontStyleName,
      fontWeight: inferFontWeight(fontStyleName),
      fontStyle,
      textCase,
      textTransform: getTextTransform(textCase),
    };
  };

  const getExportLineHeightPercent = (style: TypographyStyle): number => {
    const multiplier = style.lineHeight ?? 1;
    const size = style.size ?? 16;
    if (roundingGridSize > 0) {
      const pxLh = multiplier * size;
      const roundedPx = Math.round(pxLh / roundingGridSize) * roundingGridSize;
      return Math.round((roundedPx / size) * 100);
    }
    return Math.round(multiplier * 100);
  };

  const formatQuarterStepPercent = (value: number): string => {
    const quarterSteps = Math.round(value / 0.25);
    if (quarterSteps % 4 === 0) return value.toFixed(0);
    if (quarterSteps % 2 === 0) return value.toFixed(1);
    return value.toFixed(2);
  };

  const getExportMetrics = (style: TypographyStyle) => {
    const fontSizePx = Math.round(style.size ?? 0);
    const lineHeightPercent = getExportLineHeightPercent(style);
    const lineHeight = roundValue(lineHeightPercent / 100, 2);
    const letterSpacingPercentRaw = roundToStep(style.letterSpacing ?? 0, 0.25);
    const letterSpacingPercent = roundValue(letterSpacingPercentRaw, 2);
    const letterSpacingPercentDisplay = formatQuarterStepPercent(letterSpacingPercentRaw);
    const letterSpacingEm = roundValue(letterSpacingPercentRaw / 100, 4);
    return {
      fontSizePx,
      lineHeightPercent,
      lineHeight,
      letterSpacingPercent,
      letterSpacingPercentDisplay,
      letterSpacingEm,
    };
  };

  const getDisplayLabel = (styleKey: string, style: TypographyStyle): string => {
    const customName = style.customName?.trim();
    if (customName) return customName;
    return getConventionName(styleKey, namingConvention) || styleKey;
  };

  const buildExportEntries = (systemToExport: TypographySystem): ExportStyleEntry[] => {
    const usedTokenKeys = new Set<string>();
    const makeUniqueTokenKey = (baseKey: string): string => {
      let candidate = baseKey || "style";
      let index = 2;
      while (usedTokenKeys.has(candidate)) {
        candidate = `${baseKey}-${index}`;
        index += 1;
      }
      usedTokenKeys.add(candidate);
      return candidate;
    };

    return Object.entries(systemToExport)
      .filter(([key]) => styleVisibility[key] !== false)
      .map(([styleKey, style]) => {
        const label = getDisplayLabel(styleKey, style);
        const tokenKey = makeUniqueTokenKey(toKebabCase(label));
        return { styleKey, tokenKey, label, style };
      });
  };

  const buildExportPayloads = () => {
    const systemToExport = roundingGridSize > 0 ? applyRoundingToSystem(fineTunedStyles, roundingGridSize) : fineTunedStyles;
    const exportEntries = buildExportEntries(systemToExport);
    const timestamp = new Date().toISOString();
    const normalizeFileSegment = (value: string): string => {
      return value
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    };
    const primaryFontFamily =
      exportEntries.find((entry) => (entry.style.fontFamily || "").trim())?.style.fontFamily?.trim() ||
      "Typography System";
    const modeLabel = activeMode === "mobile" ? "Mobile" : "Desktop";
    const baseFilename = normalizeFileSegment(`Specimen ${modeLabel} - ${primaryFontFamily}`);

    const createAliasMaps = (entries: ExportStyleEntry[]): AliasMaps => {
      const usedAliasKeys = new Set<string>();
      const makeUniqueAlias = (prefix: string, rawValue: string) => {
        const normalizedValue = rawValue.trim() || "default";
        const base = `${prefix}-${toKebabCase(normalizedValue) || "default"}`;
        let candidate = base;
        let index = 2;
        while (usedAliasKeys.has(candidate)) {
          candidate = `${base}-${index}`;
          index += 1;
        }
        usedAliasKeys.add(candidate);
        return candidate;
      };

      const family: Record<string, string> = {};
      const styleName: Record<string, string> = {};
      const weight: Record<string, string> = {};
      const style: Record<string, string> = {};
      const textTransform: Record<string, string> = {};
      const textCase: Record<string, string> = {};

      entries.forEach((entry) => {
        const derived = getDerivedTypographyFields(entry.style);
        if (!family[derived.fontFamily]) family[derived.fontFamily] = makeUniqueAlias("font-family", derived.fontFamily);
        if (!styleName[derived.fontStyleName]) styleName[derived.fontStyleName] = makeUniqueAlias("font-style-name", derived.fontStyleName);
        if (!weight[derived.fontWeight]) weight[derived.fontWeight] = makeUniqueAlias("font-weight", derived.fontWeight);
        if (!style[derived.fontStyle]) style[derived.fontStyle] = makeUniqueAlias("font-style", derived.fontStyle);
        if (!textTransform[derived.textTransform]) textTransform[derived.textTransform] = makeUniqueAlias("text-transform", derived.textTransform);
        if (!textCase[derived.textCase]) textCase[derived.textCase] = makeUniqueAlias("text-case", derived.textCase);
      });

      return { family, styleName, weight, style, textTransform, textCase };
    };

    const aliasMaps = createAliasMaps(exportEntries);
    type DerivedFieldKey = 'fontFamily' | 'fontStyleName' | 'fontWeight' | 'fontStyle' | 'textTransform' | 'textCase';
    const renderFields: DerivedFieldKey[] = ['fontFamily', 'fontWeight', 'fontStyle', 'textTransform'];
    const metadataFields: DerivedFieldKey[] = ['fontStyleName', 'textCase'];
    const getFieldValue = (derived: DerivedTypographyFields, field: DerivedFieldKey): string => {
      return derived[field];
    };
    const getExportFontSource = (styleKey: string): 'primary' | 'secondary' | 'custom' => {
      return styleFontSources[styleKey] || DEFAULT_EXPORT_FONT_SOURCES[styleKey] || 'custom';
    };
    const sourceEntries = (source: 'primary' | 'secondary') =>
      exportEntries.filter((entry) => getExportFontSource(entry.styleKey) === source);
    const getDominantValue = (entries: ExportStyleEntry[], field: DerivedFieldKey): string | null => {
      if (entries.length === 0) return null;
      const counts = new Map<string, number>();
      entries.forEach((entry) => {
        const value = getFieldValue(getDerivedTypographyFields(entry.style), field);
        counts.set(value, (counts.get(value) || 0) + 1);
      });
      let bestValue: string | null = null;
      let bestCount = 0;
      counts.forEach((count, value) => {
        if (count > bestCount) {
          bestValue = value;
          bestCount = count;
        }
      });
      return bestValue;
    };
    const semanticAliasValues: Record<string, { field: DerivedFieldKey; value: string }> = {};
    const semanticAliasBySourceField: {
      primary: Partial<Record<DerivedFieldKey, string>>;
      secondary: Partial<Record<DerivedFieldKey, string>>;
    } = { primary: {}, secondary: {} };
    (['primary', 'secondary'] as const).forEach((source) => {
      const entries = sourceEntries(source);
      if (entries.length === 0) return;
      renderFields.forEach((field) => {
        const dominant = getDominantValue(entries, field);
        if (!dominant) return;
        const aliasName = `${toKebabCase(field.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`))}-${source}`;
        semanticAliasValues[aliasName] = { field, value: dominant };
        semanticAliasBySourceField[source][field] = aliasName;
      });
    });
    const valueAliasForField = (field: DerivedFieldKey, value: string): string => {
      switch (field) {
        case 'fontFamily': return aliasMaps.family[value];
        case 'fontStyleName': return aliasMaps.styleName[value];
        case 'fontWeight': return aliasMaps.weight[value];
        case 'fontStyle': return aliasMaps.style[value];
        case 'textTransform': return aliasMaps.textTransform[value];
        case 'textCase': return aliasMaps.textCase[value];
      }
    };
    const resolveAliasForField = (entry: ExportStyleEntry, derived: DerivedTypographyFields, field: DerivedFieldKey): string => {
      const source = getExportFontSource(entry.styleKey);
      if (source === 'primary' || source === 'secondary') {
        const semanticAlias = semanticAliasBySourceField[source][field];
        if (semanticAlias && semanticAliasValues[semanticAlias]?.value === getFieldValue(derived, field)) {
          return semanticAlias;
        }
      }
      return valueAliasForField(field, getFieldValue(derived, field));
    };
    const resolveMetadataAliasForField = (derived: DerivedTypographyFields, field: DerivedFieldKey): string => {
      return valueAliasForField(field, getFieldValue(derived, field));
    };
    const headingKeys = ['display', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    const bodyKeys = ['textLarge', 'textMain', 'textSmall', 'micro'];
    const dominantSourceForKeys = (keys: string[]): 'primary' | 'secondary' | 'custom' => {
      const counts = { primary: 0, secondary: 0, custom: 0 } as const;
      const mutableCounts: { primary: number; secondary: number; custom: number } = { ...counts };
      keys.forEach((key) => {
        const source = getExportFontSource(key);
        mutableCounts[source] += 1;
      });
      if (mutableCounts.secondary >= mutableCounts.primary && mutableCounts.secondary >= mutableCounts.custom) return 'secondary';
      if (mutableCounts.primary >= mutableCounts.custom) return 'primary';
      return 'custom';
    };
    const headingSource = dominantSourceForKeys(headingKeys);
    const bodySource = dominantSourceForKeys(bodyKeys);
    const isSemanticSource = (source: 'primary' | 'secondary' | 'custom'): source is 'primary' | 'secondary' =>
      source === 'primary' || source === 'secondary';
    const intentAliasEntries = ([
      ['typeface-heading', headingSource],
      ['typeface-text', bodySource],
    ] as const)
      .filter(([, source]) => isSemanticSource(source))
      .flatMap(([intent, source]) =>
        renderFields.flatMap((field) => {
          const normalizedSource = source as 'primary' | 'secondary';
          const semanticAlias = semanticAliasBySourceField[normalizedSource][field];
          if (!semanticAlias) return [];
          const aliasName = `${intent}-${toKebabCase(field.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`))}`;
          return [[aliasName, semanticAlias] as const];
        })
      );

    const css = [
      `/* Generated by Specimen Generator */`,
      `/* Export schema: semantic-v2.1 */`,
      `/* Naming convention: ${namingConvention} */`,
      `/* Exported at: ${timestamp} */`,
      `/* Allowed styles: ${headingKeys.map(k => exportEntries.find(e => e.styleKey === k)?.tokenKey ?? k).join(', ')} (headings), ${bodyKeys.map(k => exportEntries.find(e => e.styleKey === k)?.tokenKey ?? k).join(', ')} (body) */`,
      ``,
      `:root {`,
      `  /* Plugin semantic primitives (primary/secondary sources) */`,
      ...Object.entries(semanticAliasValues).map(([alias, info]) => {
        const sharedAlias = valueAliasForField(info.field, info.value);
        return `  --${alias}: var(--${sharedAlias});`;
      }),
      ``,
      `  /* Intent aliases for downstream consumers */`,
      ...intentAliasEntries.map(([alias, semanticAlias]) => `  --${alias}: var(--${semanticAlias});`),
      ``,
      `  /* Shared primitives */`,
      ...Object.entries(aliasMaps.family).map(([value, alias]) => `  --${alias}: "${escapeCssString(value)}";`),
      ...Object.entries(aliasMaps.weight).map(([value, alias]) => `  --${alias}: ${value};`),
      ...Object.entries(aliasMaps.style).map(([value, alias]) => `  --${alias}: ${value};`),
      ...Object.entries(aliasMaps.textTransform).map(([value, alias]) => `  --${alias}: ${value};`),
      ``,
      ...exportEntries.flatMap((entry) => {
        const metrics = getExportMetrics(entry.style);
        const derived = getDerivedTypographyFields(entry.style);
        const fontFamilyAlias = resolveAliasForField(entry, derived, 'fontFamily');
        const fontWeightAlias = resolveAliasForField(entry, derived, 'fontWeight');
        const fontStyleAlias = resolveAliasForField(entry, derived, 'fontStyle');
        const textTransformAlias = resolveAliasForField(entry, derived, 'textTransform');
        return [
          `  /* ${entry.label} (${entry.styleKey}) */`,
          `  --${entry.tokenKey}-font-family: var(--${fontFamilyAlias});`,
          `  --${entry.tokenKey}-font-weight: var(--${fontWeightAlias});`,
          `  --${entry.tokenKey}-font-style: var(--${fontStyleAlias});`,
          `  --${entry.tokenKey}-font-size: ${metrics.fontSizePx}px;`,
          `  --${entry.tokenKey}-line-height: ${formatNumber(metrics.lineHeight, 2)};`,
          `  --${entry.tokenKey}-letter-spacing: ${formatNumber(metrics.letterSpacingEm, 4)}em; /* ${metrics.letterSpacingPercentDisplay}% */`,
          `  --${entry.tokenKey}-text-transform: var(--${textTransformAlias});`,
          `  --${entry.tokenKey}-font: var(--${entry.tokenKey}-font-style) var(--${entry.tokenKey}-font-weight) var(--${entry.tokenKey}-font-size)/var(--${entry.tokenKey}-line-height) var(--${entry.tokenKey}-font-family);`,
          ``,
        ];
      }),
      `}`,
    ].join('\n');

    const jsonPayload = {
      meta: {
        generator: "Specimen Generator",
        exportSchema: "semantic-v2.1",
        namingConvention,
        lineHeightUnit,
        roundingGridSize,
        allowedStyles: {
          headings: headingKeys.map(k => {
            const entry = exportEntries.find(e => e.styleKey === k);
            return entry ? entry.tokenKey : k;
          }),
          body: bodyKeys.map(k => {
            const entry = exportEntries.find(e => e.styleKey === k);
            return entry ? entry.tokenKey : k;
          }),
        },
      },
      aliases: aliasMaps,
      semanticAliases: semanticAliasValues,
      intentAliases: Object.fromEntries(intentAliasEntries),
      styles: Object.fromEntries(
        exportEntries.map((entry) => {
          const metrics = getExportMetrics(entry.style);
          const derived = getDerivedTypographyFields(entry.style);
          const fontFamilyAlias = resolveAliasForField(entry, derived, 'fontFamily');
          const fontWeightAlias = resolveAliasForField(entry, derived, 'fontWeight');
          const fontStyleAlias = resolveAliasForField(entry, derived, 'fontStyle');
          const textTransformAlias = resolveAliasForField(entry, derived, 'textTransform');
          const fontStyleNameAlias = resolveMetadataAliasForField(derived, 'fontStyleName');
          const textCaseAlias = resolveMetadataAliasForField(derived, 'textCase');
          return [
            entry.tokenKey,
            {
              label: entry.label,
              originalKey: entry.styleKey,
              tokenKey: entry.tokenKey,
              fontSizePx: metrics.fontSizePx,
              lineHeight: metrics.lineHeight,
              lineHeightPercent: metrics.lineHeightPercent,
              letterSpacingPercent: metrics.letterSpacingPercent,
              letterSpacingPercentDisplay: metrics.letterSpacingPercentDisplay,
              letterSpacingEm: metrics.letterSpacingEm,
              fontFamily: derived.fontFamily,
              fontStyleName: derived.fontStyleName,
              fontWeight: derived.fontWeight,
              fontStyle: derived.fontStyle,
              textCase: derived.textCase,
              textTransform: derived.textTransform,
              fontSource: getExportFontSource(entry.styleKey),
              familyAlias: fontFamilyAlias,
              fontStyleNameAlias: fontStyleNameAlias,
              fontWeightAlias: fontWeightAlias,
              fontStyleAlias: fontStyleAlias,
              textCaseAlias: textCaseAlias,
              textTransformAlias: textTransformAlias,
              fontShorthand: `var(--${entry.tokenKey}-font)`,
              customName: entry.style.customName || null,
              visible: styleVisibility[entry.styleKey] !== false,
            },
          ];
        })
      ),
    };
    const json = JSON.stringify(jsonPayload, null, 2);

    const scss = [
      `// Generated by Specimen Generator`,
      `// Export schema: semantic-v2.1`,
      `// Naming convention: ${namingConvention}`,
      `// Exported at: ${timestamp}`,
      `// Allowed styles: ${headingKeys.map(k => exportEntries.find(e => e.styleKey === k)?.tokenKey ?? k).join(', ')} (headings), ${bodyKeys.map(k => exportEntries.find(e => e.styleKey === k)?.tokenKey ?? k).join(', ')} (body)`,
      ``,
      `// Plugin semantic primitives (primary/secondary sources)`,
      ...Object.entries(semanticAliasValues).map(([alias, info]) => {
        const sharedAlias = valueAliasForField(info.field, info.value);
        return `$${alias}: $${sharedAlias};`;
      }),
      ``,
      `// Intent aliases for downstream consumers`,
      ...intentAliasEntries.map(([alias, semanticAlias]) => `$${alias}: $${semanticAlias};`),
      ``,
      `// Shared primitives`,
      ...Object.entries(aliasMaps.family).map(([value, alias]) => `$${alias}: "${escapeCssString(value)}";`),
      ...Object.entries(aliasMaps.weight).map(([value, alias]) => `$${alias}: ${value};`),
      ...Object.entries(aliasMaps.style).map(([value, alias]) => `$${alias}: ${value};`),
      ...Object.entries(aliasMaps.textTransform).map(([value, alias]) => `$${alias}: ${value};`),
      ``,
      ...exportEntries.flatMap((entry) => {
        const metrics = getExportMetrics(entry.style);
        const derived = getDerivedTypographyFields(entry.style);
        const fontFamilyAlias = resolveAliasForField(entry, derived, 'fontFamily');
        const fontWeightAlias = resolveAliasForField(entry, derived, 'fontWeight');
        const fontStyleAlias = resolveAliasForField(entry, derived, 'fontStyle');
        const textTransformAlias = resolveAliasForField(entry, derived, 'textTransform');
        return [
          `// ${entry.label} (${entry.styleKey})`,
          `$${entry.tokenKey}-font-family: $${fontFamilyAlias};`,
          `$${entry.tokenKey}-font-weight: $${fontWeightAlias};`,
          `$${entry.tokenKey}-font-style: $${fontStyleAlias};`,
          `$${entry.tokenKey}-font-size: ${metrics.fontSizePx}px;`,
          `$${entry.tokenKey}-line-height: ${formatNumber(metrics.lineHeight, 2)};`,
          `$${entry.tokenKey}-line-height-percent: ${metrics.lineHeightPercent};`,
          `$${entry.tokenKey}-letter-spacing-percent: ${metrics.letterSpacingPercentDisplay};`,
          `$${entry.tokenKey}-letter-spacing-em: ${formatNumber(metrics.letterSpacingEm, 4)}em;`,
          `$${entry.tokenKey}-text-transform: $${textTransformAlias};`,
          `$${entry.tokenKey}-font: $${entry.tokenKey}-font-style $${entry.tokenKey}-font-weight $${entry.tokenKey}-font-size/$${entry.tokenKey}-line-height $${entry.tokenKey}-font-family;`,
          ``,
        ];
      }),
    ].join('\n');

    return { css, json, scss, baseFilename };
  };

  const exportAsCSS = () => {
    const { css, baseFilename } = buildExportPayloads();
    downloadFile(`${baseFilename}.css`, css);
    setIsExportDropdownOpen(false);
  };

  const exportAsJSON = () => {
    const { json, baseFilename } = buildExportPayloads();
    downloadFile(`${baseFilename}.json`, json);
    setIsExportDropdownOpen(false);
  };

  const exportAsSCSS = () => {
    const { scss, baseFilename } = buildExportPayloads();
    downloadFile(`${baseFilename}.scss`, scss);
    setIsExportDropdownOpen(false);
  };

  const exportAsZip = async () => {
    try {
      const { css, json, scss, baseFilename } = buildExportPayloads();
      const JSZipModule = await import('jszip');
      const zip = new JSZipModule.default();
      zip.file(`${baseFilename}.css`, css);
      zip.file(`${baseFilename}.json`, json);
      zip.file(`${baseFilename}.scss`, scss);
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(`${baseFilename}.zip`, zipBlob);
    } catch (error) {
      console.error('[FooterSection] Failed to export zip:', error);
    } finally {
      setIsExportDropdownOpen(false);
    }
  };

  const exportOptions = [
    { label: 'CSS Variables', handler: exportAsCSS },
    { label: 'JSON Data', handler: exportAsJSON },
    { label: 'SCSS Variables', handler: exportAsSCSS },
    { label: 'Export Everything (.zip)', handler: exportAsZip },
  ];

  // Use the custom hook for the Text Preset dropdown - This one seems to be un-used for now.
  // We'll leave it in case it's for a future feature.
  /*
  useClickOutside(textPresetDropdownContainerRef, () => {
    if (isTextPresetListOpen) {
      setIsTextPresetListOpen(false);
    }
  }, isTextPresetListOpen);
  */

  return (
    <div className="footer-fixed">
      {currentView === 'main' && (
        <Fragment>
          {/* Top Row: Preview Type Dropdown + Generate/Create Buttons */}
          <div className="footer-row footer-top-row">
            {/* Buttons - The button group will now take full width */}
            <div className="footer-button-group">
              <div className={`footer-main-cta ${shouldHighlightGenerateCTA ? 'cta-highlighted' : ''}`}>
                <div className="footer-main-cta-value" onClick={() => { pauseAutoPlay(); handleGeneratePreview(); }}>
                  {activeLoadingCTA === 'generate' ? (
                    <IconComponent name="loading-small-24" size={24} className="loading-svg" />
                  ) : (
                    generateButtonText
                  )}
                </div>
              </div>
              <div className={`footer-main-cta ${shouldHighlightStylesCTA ? 'cta-highlighted' : ''}`}>
                <div className="footer-main-cta-value" onClick={stylesActionHandler}>
                  {stylesActionDisplayLabel}
                </div>
                <div 
                  ref={stylesTriggerRef}
                  className="footer-main-cta-trigger" 
                  onClick={(e: TargetedEvent<HTMLElement, Event>) => { e.stopPropagation(); setIsStylesDropdownOpen(!isStylesDropdownOpen); }}>
                  {activeLoadingCTA === stylesLoadingCTA ? (
                    <IconComponent name="loading-small-24" size={24} className="loading-svg" />
                  ) : (
                    <IconComponent name="chevron-down-24" size={24} />
                  )}
                </div>
                {currentView === 'main' && isStylesDropdownOpen && (
                  <div 
                    ref={stylesDropdownContainerRef}
                    className="dropdown-list dropdown-list--opens-up footer-main-cta__dropdown-list" 
                    onMouseDown={(e: TargetedEvent<HTMLDivElement, MouseEvent>) => { e.preventDefault(); e.stopPropagation(); }}
                  >
                    <div class="dropdown-items-container">
                      {(["Generate Styles", "Update Styles"] as const).map(actionName => (
                        <button 
                          key={actionName}
                          className={`dropdown-item ${normalizedStylesAction === actionName ? 'selected' : ''}`}
                          onClick={(e: TargetedEvent<HTMLButtonElement, MouseEvent>) => { 
                            e.stopPropagation(); 
                            setSelectedStylesAction(actionName);
                            setIsStylesDropdownOpen(false); 
                            if (actionName === "Update Styles") {
                              handleUpdateStyles();
                            } else {
                              handleCreateStyles();
                            }
                          }}
                        >
                          <span class="dropdown-item-text-content">{actionName}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Fragment>
      )}

      {currentView === 'main' && isTextPresetListOpen && (
        <div 
          ref={textPresetDropdownContainerRef} // Ref is on the list itself
          className="dropdown-list dropdown-list--opens-up" 
          onMouseDown={(e: TargetedEvent<HTMLDivElement, MouseEvent>) => e.preventDefault()}
        >
          <div class="dropdown-items-container">
            {textPresetOptions.map(option => (
              <button 
                key={option.label}
                className={`dropdown-item ${selectedTextPreset === option.label ? 'selected' : ''}`}
                onMouseDown={() => {
                  setSelectedTextPreset(option.label);
                  setWaterfallText(option.value); 
                  emit('UPDATE_SPECIMEN_HEADING_WITH_TEXT', { text: option.value });
                  setIsTextPresetListOpen(false);
                  if ((selectedLayout === "cleanWaterfall" || selectedSpecimenPreset === "Specimen Waterfall") && previewExists) {
                    handleGenerateSpecimen(); 
                  }
                }}
              >
                <span class="dropdown-item-text-content">{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Row: Toggles + @Traits Label - Only show if currentView is 'main' */}
      {currentView === 'main' && (
        <div className="footer-row footer-bottom-row">
          <div className="footer-button-group footer-secondary-button-group">
            {/* Play / Pause toggle button */}
            <button
              className="button-secondary-new icon-only"
              disabled={!previewExists}
              onClick={() => {
                if (isAutoPlaying) {
                  setIsAutoPlaying(false);
                  console.log('[FooterSection] Auto-play paused');
                } else if (hasManualTextEdits) {
                  emit('RESET_SPECIMEN_TEXT');
                  console.log('[FooterSection] Reset specimen text');
                } else {
                  setIsAutoPlaying(true);
                  console.log('[FooterSection] Auto-play started');
                  emit('UPDATE_SPECIMEN_HEADING');
                }
              }}
              aria-label={isAutoPlaying ? "Pause text" : hasManualTextEdits ? "Reset text" : "Play text"}
            >
              {isAutoPlaying ? (
                <IconComponent name="pause-small-24" size={24} />
              ) : hasManualTextEdits ? (
                <IconComponent name="return-24" size={24} />
              ) : (
                <IconComponent name="play-small-24" size={24} />
              )}
            </button>
            <div ref={themeDropdownRef} className="custom-dropdown-container" style={{ position: 'static' }}>
              <button
                className="button-secondary-new"
                disabled={hasScannedFrameOnly || !previewExists}
                onClick={() => setIsThemeDropdownOpen(!isThemeDropdownOpen)}
                style={{ paddingRight: 0 }}
              >
                {previewThemeId === 'custom'
                  ? 'Custom'
                  : (PREVIEW_THEMES.find(t => t.id === previewThemeId) || PREVIEW_THEMES[0]).label}
                <IconComponent name="chevron-down-16" size={16} />
              </button>
              {isThemeDropdownOpen && (
                <div className="dropdown-list dropdown-list--opens-up" style={{ left: 'var(--sizing-default-spacers-spacer-3)', right: 'auto', width: 'auto', minWidth: '180px' }}>
                  <div className="dropdown-items-container" style={{ paddingBottom: 'var(--sizing-default-spacers-spacer-2)' }}>
                    {PREVIEW_THEMES.map(theme => (
                      <button
                        key={theme.id}
                        className={`dropdown-item ${previewThemeId === theme.id ? 'selected' : ''}`}
                        onMouseDown={() => handleThemeSelect(theme.id)}
                      >
                        <span className="dropdown-item-text-content">{theme.label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="search-divider" />
                  <div style={{ padding: '0 var(--sizing-default-spacers-spacer-2) var(--sizing-default-spacers-spacer-2)', display: 'flex', flexDirection: 'column', gap: 'var(--sizing-default-spacers-spacer-1)' }}>
                    <span className="control-label" style={{ color: 'var(--text-inactive)' }}>Background</span>
                    <input
                      type="text"
                      className="input"
                      value={customBgHex}
                      placeholder={currentBgHex}
                      maxLength={7}
                      onMouseDown={(e) => e.stopPropagation()}
                      onInput={(e: TargetedEvent<HTMLInputElement, Event>) => setCustomBgHex(e.currentTarget.value.replace('#', ''))}
                      onKeyDown={(e: TargetedEvent<HTMLInputElement, KeyboardEvent>) => {
                        if (e.key === 'Enter') handleCustomColorSubmit();
                      }}
                      style={{ width: '100%', height: 'var(--size-input-height)', boxSizing: 'border-box' }}
                    />
                    <span className="control-label" style={{ color: 'var(--text-inactive)', marginTop: 'var(--sizing-default-spacers-spacer-1)' }}>Text</span>
                    <input
                      type="text"
                      className="input"
                      value={customTextHex}
                      placeholder={currentTextHex}
                      maxLength={7}
                      onMouseDown={(e) => e.stopPropagation()}
                      onInput={(e: TargetedEvent<HTMLInputElement, Event>) => setCustomTextHex(e.currentTarget.value.replace('#', ''))}
                      onKeyDown={(e: TargetedEvent<HTMLInputElement, KeyboardEvent>) => {
                        if (e.key === 'Enter') handleCustomColorSubmit();
                      }}
                      style={{ width: '100%', height: 'var(--size-input-height)', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              )}
            </div>
            <button
              className="button-secondary-new"
              disabled={hasScannedFrameOnly || !previewExists}
              onClick={() => {
                const isChecked = !showSpecLabels;
                setShowSpecLabels(isChecked);
                const systemToUpdate = roundingGridSize > 0 ? applyRoundingToSystem(fineTunedStyles, roundingGridSize) : fineTunedStyles;
                if (previewExists) {
                  emitUpdatePreview(systemToUpdate, { showSpecLabels: isChecked });
                }
              }}
            >
              {showSpecLabels ? "Hide specs" : "View specs"}
            </button>
            <button
              className={`ghost-button button-secondary-new icon-only ${previewTextAlign === 'left' ? 'active' : ''}`}
              disabled={hasScannedFrameOnly || !previewExists}
              onClick={() => handlePreviewTextAlignChange('left')}
              aria-label="Align left"
              aria-pressed={previewTextAlign === 'left'}
            >
              <IconComponent name="text-align-left-24" size={24} />
            </button>
            <button
              className={`ghost-button button-secondary-new icon-only ${previewTextAlign === 'center' ? 'active' : ''}`}
              disabled={hasScannedFrameOnly || !previewExists}
              onClick={() => handlePreviewTextAlignChange('center')}
              aria-label="Align center"
              aria-pressed={previewTextAlign === 'center'}
            >
              <IconComponent name="text-align-center-24" size={24} />
            </button>
            <button
              className={`ghost-button button-secondary-new icon-only ${previewTextAlign === 'right' ? 'active' : ''}`}
              disabled={hasScannedFrameOnly || !previewExists}
              onClick={() => handlePreviewTextAlignChange('right')}
              aria-label="Align right"
              aria-pressed={previewTextAlign === 'right'}
            >
              <IconComponent name="text-align-right-24" size={24} />
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <button
              ref={exportTriggerRef}
              className="button-secondary-new with-icon"
              onClick={(e: TargetedEvent<HTMLButtonElement, Event>) => { 
                e.stopPropagation(); 
                setIsExportDropdownOpen(!isExportDropdownOpen); 
              }}
            >
              <IconComponent name="export-small-24" size={24} />
              Export
            </button>
            {/* Export dropdown list */}
            {isExportDropdownOpen && (
              <div 
                ref={exportDropdownContainerRef}
                className="dropdown-list dropdown-list--opens-up export-dropdown-list" 
                onMouseDown={(e: TargetedEvent<HTMLDivElement, MouseEvent>) => { e.preventDefault(); e.stopPropagation(); }}
              >
                <div class="dropdown-items-container">
                  {exportOptions.map(option => (
                    <button 
                      key={option.label}
                      className="dropdown-item"
                      onClick={(e: TargetedEvent<HTMLButtonElement, MouseEvent>) => { 
                        e.stopPropagation(); 
                        option.handler();
                        console.log(`[FooterSection] Export option clicked: ${option.label}`);
                      }}
                    >
                      <span class="dropdown-item-text-content">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {currentView === 'main' && (
        <div
          className={`footer-play-progress ${isPlayCycleVisualActive ? 'is-active' : ''}`}
          style={{ '--play-cycle-duration': `${AUTO_PLAY_INTERVAL}ms` } as any}
        />
      )}
    </div>
  );
} 