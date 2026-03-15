// src/types.ts
// Re-evaluating after TS server restart.

// --- Core Data Structures ---

export interface TypographyStyle {
  size: number;
  lineHeight: number; // Percentage / 100 (e.g., 1.5 for 150%)
  letterSpacing: number; // Percentage value (e.g., -1 for -1%)
  fontFamily?: string;
  fontStyle?: string; // Added for specific style override
  textCase?: string; // Added for text case override (e.g., 'Uppercase', 'Original')
  customName?: string; // Added for custom naming
}

export interface TypographySystem {
  [key: string]: TypographyStyle;
}

export interface ScalePoint {
    [key: string]: number; // Maps style name to exponent
}

export interface FontInfo {
  family: string;
  style: string;
}

// NEW: Add DetectedTextStyle here
export interface DetectedTextStyle {
  id: string;
  fontFamily: string;
  fontStyle: string;
  fontSize: number;
  lineHeight: number; // Assuming this is the calculated multiplier (e.g., 1.2)
  letterSpacing: number; // Assuming this is the percentage value (e.g., -1 for -1%)
  textCase: string; // e.g., 'Original', 'UPPERCASE', etc.
  instanceCount: number;
  nodeName: string; // The name of the Figma layer
  mappedSystemStyle: string; // The key of the system style it's mapped to (e.g., 'h1', 'textMain', or 'None')
}

// --- Messages between UI and Main Plugin Code ---

// UI -> Main
export interface CalculateStylesRequest {
    // Define parameters if needed for a specific message, otherwise use directly
}

export interface CreateStylesRequest {
  typeSystem: TypographySystem;
  selectedStyle: string; // The globally selected style at time of creation
  activeMode: 'desktop' | 'mobile';
  selectedPresetProfile?: 'desktop' | 'mobile' | 'social' | 'presentation' | 'product' | 'focus';
  namingConvention: string;
  // UI rounding settings to ensure parity between UI and created/updated styles
  roundingGridSize?: number; // 0=off, else step in px
  lineHeightUnit?: 'percent' | 'px';
}

export interface CreatePreviewRequest { // Renamed from GeneratePreviewRequest for consistency
  typeSystem: TypographySystem;
  selectedStyle: string;
  showSpecLabels: boolean;
}

export interface UpdatePreviewRequest {
  typeSystem: TypographySystem;
  selectedStyle: string;
  showSpecLabels: boolean;
  styleVisibility?: { [key: string]: boolean };
  availableStyles: string[];
  activeMode: 'desktop' | 'mobile';
  activeScaleRatio: number;
  namingConvention?: string;
  showGrid?: boolean;
  roundingGridSize?: number;
  lineHeightUnit?: 'percent' | 'px' | 'em' | 'rem';
  baseFontFamily?: string;
  baseFontStyle?: string;
  secondaryFontFamily?: string;
  secondaryFontStyle?: string;
  previewTextAlign?: PreviewTextAlignMode;
  specimenSnapshot?: SpecimenSnapshot; // Full frame snapshot to persist on UPDATE_PREVIEW
}

export interface CreateWaterfallRequest {
  typeSystem: TypographySystem;
  selectedStyle: string;
  sampleText: string;
}

// Renamed: Request to create the dynamic "Specimen Compact" layout preview
export interface CreateSpecimenCompactPreviewRequest extends CreatePreviewRequest {
  layoutType: 'specimenCompact';
}

export interface GetStylesForFamilyRequest {
    family: string;
}

export interface ColorModeChangedMessage {
    mode: 'light' | 'dark';
    themeId?: string;
    background?: RGB;
    text?: RGB;
    border?: RGB;
    frameBorder?: RGB;
}

// NEW: Add UI -> Main event interfaces
export interface AutoMatchStylesEvent {
  apiKey: string;
  stylesToMatch: DetectedTextStyle[]; // Re-using the new DetectedTextStyle
}

export interface SaveApiKeyEvent {
  apiKey: string;
}

export interface NormalizeFrameStylesEvent {
  representativeStyles: DetectedTextStyle[];
}

// ADDED: Event for processing unformatted text
export interface ProcessUnformattedTextRequestEvent {
  unformattedText: string;
  selectedContentType: string;
  // Parameters needed for the StructuredTextLayout
  typeSystem: TypographySystem;
  selectedStyle: string;
  showSpecLabels: boolean;
  currentColorMode: 'light' | 'dark';
  availableFontsList: FontInfo[];
  baseFontFamily: string;
  activeScaleRatio: number;
  activeMode: 'desktop' | 'mobile';
}

// Main -> UI
export interface InitialFontsMessage {
  families: string[];
  googleFonts: string[];
  initialFamily: string;
  initialStyles: string[];
}

export interface StylesForFamilyMessage {
  family: string;
  styles: string[];
}

// NEW: Add Main -> UI event interfaces
export interface AutoMatchResultsEvent {
  success: boolean;
  updatedStyles?: DetectedTextStyle[];
  message?: string;
}

export interface LoadedSettingsEvent {
  apiKey?: string | null;
}

// NEW: Event for manual text edits detection
export interface ManualTextEditsDetectedEvent {
  hasEdits: boolean;
}

// ADDED: Event for sending the full FontInfo[] list to the UI
export interface AvailableFontsListUpdateEvent {
  availableFonts: FontInfo[];
}

// ADDED: Event for LLM text processing response
export interface ProcessUnformattedTextResponseEvent {
  success: boolean;
  error?: string;
  llmOutput?: LlmStructuredContent;
  // No data needed if main navigates UI or updates preview directly
}

// ADDED: Event for text style weight mapping requirements
export interface TextStyleWeightMappingRequiredEvent {
  hasMismatches: boolean;
  relumeWeights: string[];
  textSizeGroups: string[];
  newFontFamily: string;
  availableNewWeights: string[];
  missingWeights: string[];
}

export interface CreatePreviewEvent {
  action: 'create' | 'reset';
  layoutType: PreviewLayoutType;
  typeSystem: TypographySystem;
  selectedStyle: string;
  showSpecLabels: boolean;
  activeMode: 'desktop' | 'mobile';
  activeScaleRatio: number;
  llmOutput?: LlmStructuredContent;
  namingConvention?: string; // ADDED: For proper naming convention support
  showGrid?: boolean; // ADDED: Show grid overlay on individual items
  roundingGridSize?: number; // ADDED: Grid size for overlays
  lineHeightUnit?: 'percent' | 'px'; // ADDED: Line height unit for specs
  styleVisibility?: { [key: string]: boolean }; // ADDED: Grid visibility state
  baseFontFamily?: string; // ADDED: For decorative elements - primary font family
  baseFontStyle?: string; // ADDED: For decorative elements - primary font style/weight
  secondaryFontFamily?: string; // ADDED: For decorative elements with secondary font
  secondaryFontStyle?: string; // ADDED: For decorative elements with secondary font weight
  previewTextAlign?: PreviewTextAlignMode;
  specimenSnapshot?: SpecimenSnapshot; // Specimen sampling: full settings snapshot to store on frame
}

export interface ApplySystemStylesToFrameEvent {
  mappedDetectedStyles: DetectedTextStyle[];
  targetSystemDefinition: TypographySystem;
  namingConvention: string; // ADDED: For proper style name generation
  detectedRatio?: number | null; // CRITICAL: Pass the detected ratio from scan
  autoWidth?: boolean;
  applyToFrame?: boolean;
}

export interface ImportDesignSystemEvent {
  figmaStyles: Array<{
    id: string;
    name: string;
    fontSize: number;
    fontFamily: string;
    fontWeight: string;
    lineHeight: number;
    letterSpacing: number;
    mappedSystemStyle: string;
    originalFigmaStyleName?: string;
  }>;
  targetSystem: string;
}

export interface ApplyTextStyleWeightMappingEvent {
  weightMapping: { [relumeWeight: string]: string }; // e.g., {"Normal": "Regular", "Bold": "Bold"}
  selectedSizeGroups: string[]; // e.g., ["Text/Large", "Text/Regular"]
  originalRequest: CreateStylesRequest;
}

// NEW: Events for typography variable mapping
export interface TypographyVariableMappingRequiredEvent {
  hasVariables: boolean;
  detectedVariables: Array<{
    variableId: string;
    variableName: string;
    property: string; // Allow any string (fontFamily, fontStyle, fontSize, etc.)
    usedByStyles: string[];
    currentValue: number | string;
    isLocal: boolean;
    targetFontFamily?: string; // For mapping context
    availableWeights?: string[]; // For fontStyle variables
    availableFontFamilies?: string[]; // For fontFamily variables
  }>;
  typeSystemKeys: string[]; // Available keys in the new typography system
  originalRequest: CreateStylesRequest;
}

export interface ApplyTypographyVariableMappingEvent {
  variableMapping: { 
    [variableId: string]: {
      action: 'preserve' | 'update' | 'disconnect';
      newValue?: string; // For font variables: the new font family or weight to apply
    }
  };
  originalRequest: CreateStylesRequest;
}

export interface DetectedVariable {
  variableId: string;
  variableName: string;
  property: 'fontFamily' | 'fontStyle' | 'fontSize';
  usedByStyles: string[];
}

export interface ApplyStyleMappingEvent {
  mapping: { [systemKey: string]: string };
  originalRequest: CreateStylesRequest;
  variableHandlingMode?: 'update' | 'disconnect';
}

export interface VariableUpdateDecisionRequiredEvent {
  mapping: { [systemKey: string]: string };
  originalRequest: CreateStylesRequest;
  detectedVariables: Array<{
    variableId: string;
    variableName: string;
    property: 'fontFamily' | 'fontStyle' | 'fontSize';
    usedByStyles: string[];
  }>;
}

// NEW: Unified update screen that shows all document structure
export interface UnifiedUpdateRequiredEvent {
  // Variables section (if any found)
  variables: Array<{
    variableId: string;
    variableName: string;
    property: string;
    usedByStyles: string[];
    currentValue: number | string;
    isLocal: boolean;
    targetFontFamily?: string;
    availableWeights?: string[];
    availableFontFamilies?: string[];
  }>;
  
  // New variables to be created
  newVariables?: Array<{
    variableName: string;
    property: string;
    targetValue: string;
    reason: string;
  }>;
  
  // Weight variations section (if any found)
  weightVariations: Array<{
    baseGroup: string; // e.g., "Text/Large"
    weights: string[]; // e.g., ["Normal", "Bold", "Semi Bold"]
    styles: { weight: string; styleName: string }[];
  }>;
  
  // Available options for mapping
  availableWeights: string[];
  availableFontFamilies: string[];
  targetFontFamily: string;
  
  // System info
  detectedSystem: string;
  
  // Original request for processing
  originalRequest: CreateStylesRequest;
}

export interface ApplyUnifiedUpdateEvent {
  // Variable mappings
  variableMapping: { 
    [variableId: string]: {
      action: 'preserve' | 'update' | 'disconnect';
      newValue?: string;
    }
  };
  
  // New variables to create
  newVariables?: Array<{
    variableName: string;
    property: string;
    targetValue: string;
  }>;
  
  // Weight mappings
  weightMapping: { 
    [originalWeight: string]: string; // Maps original weight to new weight or 'Delete'
  };
  
  // Selected weight groups to apply mappings to
  selectedWeightGroups: string[]; // e.g., ["Text/Large", "Text/Small"]
  
  // Original request
  originalRequest: CreateStylesRequest;
}

// --- NEW: Event message for when Apply Matches from a scan is complete ---
export interface ApplyMatchesCompleteMessage {
  success: boolean;
  nodesChanged: number;
  appliedToFrame?: boolean;
  estimatedRatio?: number;
  baseSizeInPx?: number;
  largeSizeInPx?: number;
  primaryScannedFontFamily?: string;
  primaryScannedFontStyle?: string;
  secondaryScannedFontFamily?: string;
  secondaryScannedFontStyle?: string;
  detectedNamingConvention?: string;
}

// --- Preset persistence events (REMOVED - replaced by specimen sampling) ---

// --- Specimen Sampling ---

/**
 * Complete settings snapshot stored as pluginData on each specimen frame.
 * Enables "sampling" a previous specimen to restore all settings.
 */
export interface SpecimenSnapshot {
  version: 1; // For future migration if the shape evolves
  typography: {
    desktop: {
      baseSize: number;
      scaleRatio: number;
      systemPreset?: string;
      letterSpacing: number;
      maxLetterSpacing: number;
      headingLetterSpacing?: number;
      headingMaxLetterSpacing?: number;
      textLetterSpacing?: number;
      textMaxLetterSpacing?: number;
      headlineMinLineHeight: number;
      headlineMaxLineHeight: number;
      textMinLineHeight: number;
      textMaxLineHeight: number;
      maxSize: number;
      minSize: number;
      interpolationType: 'linear' | 'exponential';
    };
    mobile: {
      baseSize: number;
      scaleRatio: number;
      systemPreset?: string;
      letterSpacing: number;
      maxLetterSpacing: number;
      headingLetterSpacing?: number;
      headingMaxLetterSpacing?: number;
      textLetterSpacing?: number;
      textMaxLetterSpacing?: number;
      headlineMinLineHeight: number;
      headlineMaxLineHeight: number;
      textMinLineHeight: number;
      textMaxLineHeight: number;
      maxSize: number;
      minSize: number;
      interpolationType: 'linear' | 'exponential';
    };
  };
  fonts: {
    primaryFontFamily: string;
    primaryFontStyle: string;
    secondaryFontFamily?: string;
    secondaryFontStyle?: string;
    secondaryFontEnabled: boolean;
    secondaryFontLinked?: boolean;
    secondaryWeightLinked?: boolean;
  };
  ui: {
    namingConvention: string;
    lineHeightUnit: 'percent' | 'px' | 'em' | 'rem';
    roundingGridSize: number;
    colorMode: 'light' | 'dark';
    previewThemeId?: string;
    customPreviewColors?: { background: { r: number; g: number; b: number }; text?: { r: number; g: number; b: number } } | null;
    showSpecLabels: boolean;
    activeMode: 'desktop' | 'mobile';
    selectedLayout?: PreviewLayoutType;
    previewTextAlign?: PreviewTextAlignMode;
    waterfallText?: string;
    selectedPresetProfile?: 'desktop' | 'mobile' | 'social' | 'presentation' | 'product' | 'focus';
    lineHeightCurve: string;
    letterSpacingCurve: string;
  };
  styles: TypographySystem; // Full fine-tuned styles including all overrides
  styleVisibility: { [key: string]: boolean };
  styleFontSources: { [key: string]: 'primary' | 'secondary' | 'custom' };
  nodeMapping?: { [key: string]: string[] }; // Serialized preview node mapping for reactivation
}

export interface SpecimenSampledEvent {
  snapshot: SpecimenSnapshot;
  previewExists?: boolean; // When true, the sampled frame is now the active preview frame
}

export interface ActiveSpecimenContextEvent {
  hasActiveSpecimenContext: boolean;
}

// --- Event Names (Optional but good practice) ---

export type UIMessageTypes =
  | 'UI_READY'
  | 'GET_STYLES_FOR_FAMILY'
  | 'UPDATE_PREVIEW'
  | 'CREATE_STYLES'
  | 'CREATE_PREVIEW' // Unified event
  | 'COLOR_MODE_CHANGED'
  | 'PROCESS_UNFORMATTED_TEXT_REQUEST'
  | 'NAVIGATE_TO_MAIN_VIEW'
  | 'SELECT_PREVIEW_TEXT_NODES'
  | 'UPDATE_SPECIMEN_HEADING'
  | 'MANUAL_TEXT_EDITS_DETECTED'
  | 'RESET_SPECIMEN_TEXT'
  | 'SAVE_API_KEY'
  | 'SCAN_SELECTED_FRAME'
  | 'AUTO_MATCH_STYLES'
  | 'SMART_MATCH_STYLES'
  | 'APPLY_SMART_MATCH_STYLES'
  | 'SMART_IMPORT_RELUME'
  | 'NORMALIZE_FRAME_STYLES'
  | 'APPLY_SYSTEM_STYLES_TO_FRAME'
  | 'HIGHLIGHT_DETECTED_STYLE_GROUP'
  | 'CLEAR_STYLE_HIGHLIGHTS'
  | 'FORCE_SET_API_KEY'
  | 'IMPORT_DESIGN_SYSTEM'
  | 'GET_LOCAL_TEXT_STYLES'
  | 'APPLY_TEXT_STYLE_WEIGHT_MAPPING'
  | 'APPLY_TYPOGRAPHY_VARIABLE_MAPPING'
  | 'CAPTURE_PREVIEW_SVG'
  | 'REQUEST_SMART_IMPORT'; // Unified: auto-detect specimen vs regular frame

export type MainMessageTypes =
  | 'INITIAL_FONTS'
  | 'STYLES_FOR_FAMILY'
  | 'PROCESS_UNFORMATTED_TEXT_RESPONSE'
  | 'AVAILABLE_FONTS_LIST_UPDATE' // <<< ADDED
  | 'SMART_MATCH_RESULTS' // <<< ADDED
  | 'APPLY_RELUME_PRESET' // <<< ADDED
  | 'CREATE_PREVIEW' // <<< ADDED UNIFIED EVENT
  | 'RECALCULATE_PREVIEW_FROM_STATE' // Trigger UI->main preview refresh using current UI state
  | 'TEXT_STYLE_WEIGHT_MAPPING_REQUIRED' // <<< ADDED
  | 'TYPOGRAPHY_VARIABLE_MAPPING_REQUIRED' // <<< ADDED
  | 'TEXT_GENERATION_START' // <<< ADDED
  | 'TEXT_GENERATION_COMPLETE' // <<< ADDED
  | 'SPECIMEN_SAMPLED' // Specimen sampling: emitted when a scanned frame is a specimen
  | 'SPECIMEN_DETECTED' // Smart import: specimen frame detected, awaiting user confirmation
  | 'NO_SPECIMEN_START_SCAN' // Smart import: no specimen found, UI should start scan flow
  | 'ACTIVE_SPECIMEN_CONTEXT' // Runtime context for active specimen preview binding
  | 'PREVIEW_SVG_CAPTURED';

// Add type for layout options from UI
export type PreviewLayoutType = 
  | 'specimenCompact' 
  | 'cleanWaterfall'
  | 'structuredText';

export type PreviewTextAlignMode = 'left' | 'center' | 'right';

// --- Preview Layout Abstraction ---

import { LlmStructuredContent } from '../api/llm-prompts';

export type { LlmStructuredContent };

export interface PreviewLayoutHandlerParams {
  typeSystem: TypographySystem;
  selectedStyle: string;
  showSpecLabels: boolean;
  styleVisibility?: { [key: string]: boolean }; // <<< ADDED (optional for now)
  currentColorMode: 'light' | 'dark';
  availableFontsList: FontInfo[];
  baseFontFamily: string;
  baseFontStyle?: string; // ADDED: Primary font style/weight for decorative elements
  activeScaleRatio: number;
  newX?: number;
  sampleText?: string; // For waterfall
  activeMode?: 'desktop' | 'mobile'; // For mode-specific previews
  llmOutput?: LlmStructuredContent; // <<< ADDED: For structured text layout
  namingConvention?: string; // ADDED: For proper naming convention support
  showGrid?: boolean; // ADDED: Show grid overlay on individual items
  roundingGridSize?: number; // ADDED: Grid size for overlays (2px or 4px)
  lineHeightUnit?: 'percent' | 'px'; // ADDED: Line height unit for specs
  apiKey?: string; // ADDED: For LLM article generation
  secondaryFontFamily?: string; // ADDED: For secondary font integration
  secondaryFontStyle?: string; // ADDED: For secondary font integration
  selectedPresetProfile?: 'desktop' | 'mobile' | 'social' | 'presentation' | 'product' | 'focus';
  previewTextAlign?: PreviewTextAlignMode;
}

export interface PreviewLayout {
  getLayoutType(): PreviewLayoutType;
  getBaseName(): string;
  create(params: PreviewLayoutHandlerParams): Promise<PreviewCreateResult | null>;
  update(frame: FrameNode, params: PreviewLayoutHandlerParams): Promise<void>;
}

export interface PreviewCreateResult {
  frame: FrameNode;
  nodeMap: Map<string, string[]>;
}

// --- NEW: JPG preview capture events ---
export interface CapturePreviewSvgEvent {
  // No parameters - captures current preview frame as JPG
}

export interface PreviewSvgCapturedEvent {
  svgData: string | null; // JPG data URL or null if capture failed
} 