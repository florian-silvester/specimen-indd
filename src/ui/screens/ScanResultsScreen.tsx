/**
 * ScanResultsScreen.tsx
 * 
 * This screen displays font sizes detected from a selected Figma frame and allows
 * users to map them to their typography system using a smart ratio-based algorithm.
 * 
 * NOTE: AI/LLM auto-matching functionality is currently DISABLED but preserved in
 * commented code for future use. See /src/api folder for LLM-related utilities.
 */

import { h, Fragment } from "preact";
import { useState, useCallback, useEffect, useRef } from "preact/hooks";
import { emit, on } from "@create-figma-plugin/utilities";
import { Icon } from "../components/Icon";
import { TypographySystem, DetectedTextStyle } from "../../core/types"; // Assuming types are in types.ts
import { detectDesignSystem, getSystemStyleOptions, getDesignSystemHandler } from "../../design-systems";
import { STYLE_KEYS, TYPOGRAPHY_SCALE_POINTS } from "../../core/constants";
import { useAppStore } from "../store/appStore";
// import { TypographyStyle } from "../types"; // Import types as needed

// Ensure DetectedTextStyle is defined or imported here
// MOVED to shared types

// Props for this new screen
interface ScanResultsScreenProps {
  setCurrentView: (view: 'landing' | 'main' | 'scanResults') => void;
  initialDetectedStyles: DetectedTextStyle[]; // ADDED: Prop to receive scanned styles
  targetSystemDefinition: TypographySystem; // ADDED PROP
  apiKeyFromStorage?: string | null; // ADDED: Prop to receive API key from parent
  onApplyCompleteAndNavigating?: (data: { 
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
  }) => void;
  onScanComplete: (data: { 
    success: boolean; 
    detectedStyles: DetectedTextStyle[]; 
    message?: string; 
    primaryScannedFontFamily?: string; 
    primaryScannedFontStyle?: string;
    primaryScannedBaseSize?: number;
    hasSpecimenSnapshot?: boolean;
  }) => void;
  autoScanOnMount?: boolean;
  onAutoScanHandled?: () => void;
}

// Mock data for found styles
const mockFoundStyles = [
  { id: "1", size: "11px", instances: "11 instances", mappedSystemStyle: "H0" },
  { id: "2", size: "11px", instances: "11 instances", mappedSystemStyle: "H1" },
  { id: "3", size: "11px", instances: "11 instances", mappedSystemStyle: "H2" },
  { id: "4", size: "11px", instances: "11 instances", mappedSystemStyle: "H3" },
  { id: "5", size: "11px", instances: "11 instances", mappedSystemStyle: "H4" },
];

// Removed: hardcoded systemStyleOptions - now using getSystemStyleOptions(selectedSystem)

export interface FoundStyleData extends DetectedTextStyle {
  sizeDisplay: string; // e.g., "11px"
  styleName: string | null; // e.g., "H1" or null if no style
  isOpen: boolean;
  mappedSystemStyle: string; // The style it maps to in your design system
}

// NEW: Interface for Auto Match Styles event payload
export interface AutoMatchStylesEvent {
  apiKey: string;
  stylesToMatch: FoundStyleData[]; // Send the current state of found styles
}

// For now, assuming AutoMatchResultsEvent might need to be defined here or imported if not in types.ts
interface AutoMatchResultsEvent {
  success: boolean;
  updatedStyles?: FoundStyleData[]; // Expecting the full FoundStyleData structure back
  message?: string;
}

// NEW: Interface for Save API Key event payload (can be moved to types.ts)
export interface SaveApiKeyEvent {
  apiKey: string;
}

// NEW: Interface for Loaded Settings event from main.ts
interface LoadedSettingsEvent {
  apiKey?: string | null;
}

// NEW: Interface for Normalize Frame Styles event payload
export interface NormalizeFrameStylesEvent {
  representativeStyles: FoundStyleData[]; // Send the current state of found styles (which includes full style details)
}

// NEW: Interface for the event to main.ts
export interface ApplySystemStylesToFrameEvent {
  mappedDetectedStyles: FoundStyleData[];
  targetSystemDefinition: TypographySystem;
  namingConvention?: string;
  detectedRatio?: number | null; // CRITICAL: Pass the detected ratio from scan
  applyToFrame?: boolean;
}

export function ScanResultsScreen({ 
  setCurrentView,
  initialDetectedStyles,
  targetSystemDefinition, // ADDED PROP
  apiKeyFromStorage, // ADDED: Prop to receive API key from parent
  onApplyCompleteAndNavigating, // RE-ADD: Callback prop
  onScanComplete, // ADDED: For scan button
  autoScanOnMount = false,
  onAutoScanHandled,
}: ScanResultsScreenProps) {
  
  // const [apiKey, setApiKey] = useState<string>(""); // OLD API key state - REMOVED
  // Initialize as empty - will be populated by the smart mapping effect
  const [foundStylesData, setFoundStylesData] = useState<FoundStyleData[]>([]);
  const detectedScaleRatioRef = useRef<number | null>(null); // Store detected ratio from scan

  // State for API key modal - DISABLED (kept for future use)
  // const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  // const [footerApiKey, setFooterApiKey] = useState(""); // Initialize as empty string
  // const [isAutoMatching, setIsAutoMatching] = useState(false); // NEW: Loading state for auto-match
  const [isApplyingMatches, setIsApplyingMatches] = useState(false); // NEW: Loading state for apply matches
  const [isScanning, setIsScanning] = useState(false); // NEW: Loading state for scanning
  const [hasSpecimenSnapshot, setHasSpecimenSnapshot] = useState(false);
  
  // NEW: Design system dropdown state  
  const [selectedSystem, setSelectedSystem] = useState<string>('Default Naming');
  // --- NEW: Dropdown positioning ---
  const [dropdownPosition, setDropdownPosition] = useState<{ top?: number; bottom?: number; left?: number; width?: number; } | null>(null);
  const dropdownListRef = useRef<HTMLDivElement>(null);
  const activeDropdownTriggerRef = useRef<HTMLButtonElement | null>(null);
  // --- END NEW ---

  // Debounce logic for highlighting
  const highlightTimeoutRef = useRef<number | null>(null);

  const handleMouseEnter = (itemId: string) => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = window.setTimeout(() => {
      console.log(`[ScanResultsScreen] Debounced Mouse enter row: ${itemId}`);
      emit('HIGHLIGHT_DETECTED_STYLE_GROUP', { aggregationKey: itemId });
    }, 150); // 150ms delay
  };

  const handleMouseLeave = () => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    console.log(`[ScanResultsScreen] Mouse leave`);
    emit('CLEAR_STYLE_HIGHLIGHTS');
  };

  // NEW: Effect to update footerApiKey when apiKeyFromStorage prop changes - DISABLED (kept for future use)
  // useEffect(() => {
  //   if (apiKeyFromStorage) {
  //     setFooterApiKey(apiKeyFromStorage);
  //     console.log('[ScanResultsScreen] API key set from prop:', apiKeyFromStorage);
  //   }
  // }, [apiKeyFromStorage]);

  // NEW: Auto-detect design system on screen load (BEFORE scanning)
  useEffect(() => {
    console.log('[ScanResultsScreen] 🔍 Auto-detecting design system on screen load...');
    emit('GET_LOCAL_TEXT_STYLES_FOR_SCAN_DETECTION');
  }, []); // Run once on mount

  // NEW: Listener for auto-detection results
  useEffect(() => {
    const handleDetectionResult = on('SCAN_DETECTION_RESULT', (data: { detectedSystem: string }) => {
      console.log('[ScanResultsScreen] 🎯 Auto-detection result:', data.detectedSystem);
      if (data.detectedSystem !== 'Default Naming') {
        setSelectedSystem(data.detectedSystem);
        console.log(`[ScanResultsScreen] ✅ Auto-detected and set: ${data.detectedSystem}`);
      }
    });

    return () => {
      handleDetectionResult();
    };
  }, []);

  const handleBack = useCallback(() => {
    const prev = useAppStore.getState().popPrevious();
    if (prev) {
      setCurrentView(prev as any);
      return;
    }
    setCurrentView('main');
  }, [setCurrentView]);

  const toggleDropdown = (event: h.JSX.TargetedMouseEvent<HTMLButtonElement>, id: string) => {
    const currentlyOpen = foundStylesData.find(s => s.id === id)?.isOpen;

    setFoundStylesData(prevData => 
      prevData.map(style => 
        style.id === id ? { ...style, isOpen: !currentlyOpen } : { ...style, isOpen: false }
      )
    );

    if (currentlyOpen) {
      setDropdownPosition(null);
      activeDropdownTriggerRef.current = null;
    } else {
      const button = event.currentTarget;
      activeDropdownTriggerRef.current = button;
      const buttonRect = button.getBoundingClientRect();
      const currentSystemOptions = getSystemStyleOptions(selectedSystem);
      
      // Improved positioning logic (same as DesignSystemImportScreen)
      const maxDropdownHeight = 240; // Max height before scrolling (8 items * 30px)
      const estimatedHeight = Math.min(currentSystemOptions.length * 30, maxDropdownHeight);
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - buttonRect.bottom - 20; // 20px buffer
      const spaceAbove = buttonRect.top - 20; // 20px buffer
      
      // Determine if dropdown should open upward
      const shouldOpenUpward = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
      
      // Calculate horizontal position to prevent overflow
      const viewportWidth = window.innerWidth;
      const dropdownWidth = buttonRect.width;
      let leftPosition = buttonRect.left;
      
      // Adjust if dropdown would overflow right edge
      if (leftPosition + dropdownWidth > viewportWidth - 20) {
        leftPosition = viewportWidth - dropdownWidth - 20;
      }
      
      // Ensure it doesn't go off the left edge
      if (leftPosition < 20) {
        leftPosition = 20;
      }

      const pos: typeof dropdownPosition = {
        left: leftPosition,
        width: dropdownWidth,
      };

      if (shouldOpenUpward) {
        pos.bottom = viewportHeight - buttonRect.top;
      } else {
        pos.top = buttonRect.bottom;
      }
      setDropdownPosition(pos);
    }
  };

  const selectStyle = (id: string, selectedStyle: string) => {
    setFoundStylesData(prevData =>
      prevData.map(style =>
        style.id === id ? { ...style, mappedSystemStyle: selectedStyle, isOpen: false } : style
      )
    );
    setDropdownPosition(null);
    activeDropdownTriggerRef.current = null;
  };
  
  // Ref for handling outside clicks for all dropdowns in the list
  const dropdownsContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const isDropdownOpen = foundStylesData.some(style => style.isOpen);
      if (!isDropdownOpen) return;

      if (
        dropdownListRef.current && !dropdownListRef.current.contains(event.target as Node) &&
        activeDropdownTriggerRef.current && !activeDropdownTriggerRef.current.contains(event.target as Node)
      ) {
        // Clicked outside: close all dropdowns
        setFoundStylesData(prevData => prevData.map(style => ({ ...style, isOpen: false })));
        setDropdownPosition(null);
        activeDropdownTriggerRef.current = null;
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    
    // REMOVED: Listener for LOADED_SETTINGS (now handled by parent)
    /*
    const handleLoadedSettings = on('LOADED_SETTINGS', (settings: LoadedSettingsEvent) => {
      console.log('[ScanResultsScreen] Received LOADED_SETTINGS:', settings);
      if (settings.apiKey) {
        setFooterApiKey(settings.apiKey);
      }
    });
    */

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      // handleLoadedSettings(); // REMOVED: Cleanup loaded settings listener
    };
  }, [foundStylesData]);

  // API Key and Auto-Match handlers - DISABLED (kept for future use)
  // const toggleApiKeyModal = () => {
  //   setIsApiKeyModalOpen(!isApiKeyModalOpen);
  // };

  // // Placeholder handlers for modal CTAs
  // const handleClearApiKey = () => setFooterApiKey("");
  // const handleApplyApiKeyInModal = () => { 
  //   console.log("Saving and Applying API Key from modal:", footerApiKey);
  //   emit("SAVE_API_KEY", { apiKey: footerApiKey } as SaveApiKeyEvent); // Emit event to main.ts
  //   toggleApiKeyModal(); // Close modal after initiating save
  // };

  // const handleAutoMatch = useCallback(() => {
  //   if (!footerApiKey) {
  //     console.warn("Auto Match clicked, but no API key is entered.");
  //     // Optionally, open the API key modal here if it's not already open
  //     // setIsApiKeyModalOpen(true);
  //     // Or show a more user-friendly message in the UI
  //     alert("Please enter your API key first using the 'API Key' button in the footer.");
  //     return;
  //   }
  //   console.log("Auto Match clicked. API Key:", footerApiKey, "Styles:", foundStylesData);
  //   setIsAutoMatching(true);
  //   emit("AUTO_MATCH_STYLES", { apiKey: footerApiKey, stylesToMatch: foundStylesData } as AutoMatchStylesEvent);
  //   // We'll need a listener for AUTO_MATCH_RESULTS to set isAutoMatching back to false
  // }, [footerApiKey, foundStylesData]);

  const handleApplyMatches = useCallback(() => {
    console.log("Apply Matches clicked. Mappings:", foundStylesData, "Target System:", targetSystemDefinition);
    if (!targetSystemDefinition || Object.keys(targetSystemDefinition).length === 0) {
      alert("Target system styles are not defined. Please check plugin settings.");
      return;
    }
    if (!foundStylesData || foundStylesData.length === 0) {
      alert("No detected styles to apply.");
      return;
    }
    setIsApplyingMatches(true); // Set loading state

    // First, clear any active highlights to restore the original selection.
    emit('CLEAR_STYLE_HIGHLIGHTS');

    // Use a short timeout to ensure Figma's main thread has time to process the
    // selection change from CLEAR_STYLE_HIGHLIGHTS before we proceed.
    setTimeout(() => {
      emit("APPLY_SYSTEM_STYLES_TO_FRAME", { 
        mappedDetectedStyles: foundStylesData, 
        targetSystemDefinition: targetSystemDefinition,
        namingConvention: selectedSystem, // ADDED: Pass the detected/selected naming convention
        detectedRatio: detectedScaleRatioRef.current, // CRITICAL: Pass the detected ratio from scan
        autoWidth: false, // DISABLE auto width application in scan flow
        applyToFrame: !hasSpecimenSnapshot
      } as ApplySystemStylesToFrameEvent);
      console.log(`[Apply] 📤 Sending detected ratio: ${detectedScaleRatioRef.current}`);
    }, 100); // 100ms delay

  }, [foundStylesData, targetSystemDefinition, selectedSystem, hasSpecimenSnapshot]);

  // NEW: Handler for the Scan button
  const handleScanFrame = useCallback(() => {
    console.log('[ScanResultsScreen] Scan Frame button clicked.');
    setIsScanning(true);
    emit("SCAN_SELECTED_FRAME"); 
  }, []);

  const canApplyMatches =
    !isApplyingMatches &&
    !isScanning &&
    foundStylesData.length > 0 &&
    foundStylesData.some(style => style.mappedSystemStyle !== "None");
  
  // NEW: Translate base style names to system-specific display names
  const translateStyleToSystem = (baseName: string, systemName: string): string => {
    if (baseName === "None") return "None";

    // System-specific name mappings
    const nameMaps: { [system: string]: { [base: string]: string } } = {
      'Lumos': { // Default/base names are the same
        'Display': 'Display', 'H1': 'H1', 'H2': 'H2', 'H3': 'H3', 'H4': 'H4', 'H5': 'H5', 'H6': 'H6',
        'Text Large': 'Text Large', 'Text Main': 'Text Main', 'Text Small': 'Text Small', 'Micro': 'Micro'
      },
      'Relume': {
        'Display': 'Heading/H1', // Relume often uses H1 as its largest style
        'H1': 'Heading/H1', 'H2': 'Heading/H2', 'H3': 'Heading/H3', 'H4': 'Heading/H4', 'H5': 'Heading/H5', 'H6': 'Heading/H6',
        'Text Large': 'Text/Large', 'Text Main': 'Text/Regular', 'Text Small': 'Text/Small', 'Micro': 'Text/Tiny'
      },
      'Bootstrap': {
        'Display': 'Display 1', 'H1': 'H1', 'H2': 'H2', 'H3': 'H3', 'H4': 'H4', 'H5': 'H5', 'H6': 'H6',
        'Text Large': 'Lead', // Bootstrap's "Lead" is for emphasized paragraphs
        'Text Main': 'Body', // Generic name for standard <p> text
        'Text Small': 'Small', 'Micro': 'Small' // No Micro in Bootstrap, map to Small
      }
    };

    const systemMap = nameMaps[systemName];
    if (systemMap && systemMap[baseName]) {
      return systemMap[baseName];
    }
    
    // Fallback if system or baseName is not in the map
    return baseName;
  };
  
  // NEW: Fuzzy matching helper functions
  const normalizeStyleName = useCallback((name: string): string => {
    return name
      .toLowerCase()
      .replace(/[\s\-_]/g, '') // Remove spaces, hyphens, underscores
      .replace(/0/g, '') // "H01" → "H1" 
      .replace(/heading/g, 'h') // "Heading 1" → "h1"
      .replace(/display/g, STYLE_KEYS.DISPLAY) // Keep display as is
      .replace(/text/g, 't') // "Text Large" → "tlarge"
      .replace(/large/g, 'l')
      .replace(/small/g, 's')
      .replace(/main/g, 'm')
      .replace(/micro/g, STYLE_KEYS.MICRO)
      .replace(/tiny/g, 't');
  }, []);

  const calculateSimilarity = useCallback((str1: string, str2: string): number => {
    if (str1 === str2) return 1.0;
    
    // Simple Levenshtein distance-based similarity
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1.0;
    
    const distance = levenshteinDistance(str1, str2);
    return 1 - (distance / maxLength);
  }, []);

  const levenshteinDistance = useCallback((str1: string, str2: string): number => {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator  // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }, []);

  const fuzzyMatchStyleName = useCallback((nodeName: string, systemOptions: string[]): string | null => {
    if (!nodeName || nodeName.trim() === '') return null;
    
    const normalized = normalizeStyleName(nodeName);
    console.log(`[ScanResultsScreen] 🔍 Fuzzy matching "${nodeName}" (normalized: "${normalized}")`);
    
    let bestMatch = null;
    let bestScore = 0;
    
    for (const option of systemOptions) {
      if (option === "None") continue;
      
      const normalizedOption = normalizeStyleName(option);
      const similarity = calculateSimilarity(normalized, normalizedOption);
      
      console.log(`[ScanResultsScreen]   - "${option}" (normalized: "${normalizedOption}") → similarity: ${similarity.toFixed(2)}`);
      
      if (similarity > bestScore && similarity > 0.6) { // 60% similarity threshold
        bestScore = similarity;
        bestMatch = option;
      }
    }
    
    if (bestMatch) {
      console.log(`[ScanResultsScreen] ✅ Best fuzzy match: "${nodeName}" → "${bestMatch}" (score: ${bestScore.toFixed(2)})`);
    } else {
      console.log(`[ScanResultsScreen] ❌ No fuzzy match found for "${nodeName}"`);
    }
    
    return bestMatch;
  }, [normalizeStyleName, calculateSimilarity]);

  // HELPER: Consolidate similar font sizes (11.25 ≈ 11.275 → 11)
  const consolidateSize = (size: number): number => {
    return Math.round(size * 2) / 2; // Round to nearest 0.5
  };

  // HELPER: NEW SMART DISTRIBUTION-AWARE ANALYSIS
  const analyzeTypographyHierarchy = (styles: DetectedTextStyle[]) => {
    // Consolidate sizes first
    const consolidatedSizes = styles.map(s => consolidateSize(s.fontSize));
    const uniqueSizes = Array.from(new Set(consolidatedSizes)).sort((a, b) => b - a);

    console.log('[ScanResultsScreen] 📊 Unique sizes found:', uniqueSizes);

    // Weighted counts by instanceCount to identify body text
    const weightedCounts = new Map<number, number>();
    styles.forEach(s => {
      const consolidated = consolidateSize(s.fontSize);
      const prev = weightedCounts.get(consolidated) || 0;
      weightedCounts.set(consolidated, prev + (s.instanceCount || 1));
    });

    // Find body text size (most frequent in typical range)
    // CRITICAL: Text Main must be in 12-20px range. 21-24px is Text Large territory!
    const pickTopInRange = (min: number, max: number): number | undefined => {
      const inRange = Array.from(weightedCounts.entries())
        .filter(([size]) => size >= min && size <= max)
        .sort((a, b) => b[1] - a[1]);
      return inRange[0]?.[0];
    };

    // Text Main detection: STRICT 12-20px range only
    const TEXT_MAIN_MIN = 12;
    const TEXT_MAIN_MAX = 20;
    const TEXT_LARGE_MIN = 21;
    const TEXT_LARGE_MAX = 28;

    let bodyTextSize = pickTopInRange(14, TEXT_MAIN_MAX)  // Prefer 14-20px (most common body text)
      || pickTopInRange(TEXT_MAIN_MIN, TEXT_MAIN_MAX);    // Fallback to full 12-20px range
    
    // If no body text found in 12-20px range, check if we have Text Large candidates (21-28px)
    // If so, infer body size from Text Large using typical ratio
    if (!bodyTextSize) {
      const textLargeCandidate = pickTopInRange(TEXT_LARGE_MIN, TEXT_LARGE_MAX);
      if (textLargeCandidate) {
        // Text Large = baseSize * ratio^1, so baseSize = textLargeSize / ratio
        // Use Minor Third (1.2) as default inference ratio
        const inferenceRatio = 1.2;
        const inferredBodySize = Math.round(textLargeCandidate / inferenceRatio);
        console.log(`[ScanResultsScreen] ⚠️ No Text Main found in ${TEXT_MAIN_MIN}-${TEXT_MAIN_MAX}px range.`);
        console.log(`[ScanResultsScreen] 📐 Inferring body size from Text Large candidate (${textLargeCandidate}px): ${inferredBodySize}px`);
        bodyTextSize = inferredBodySize;
      } else {
        // Last resort: default to 16px
        bodyTextSize = 16;
        console.log('[ScanResultsScreen] ⚠️ No body text or Text Large found. Defaulting to 16px.');
      }
    }

    console.log('[ScanResultsScreen] 📍 Body text size (weighted):', bodyTextSize);

    // NEW: Create relative tiers based on body size
    const bodyRange = bodyTextSize * 0.2; // ±20% tolerance
    const smallThreshold = bodyTextSize * 0.8;
    const headingThreshold = bodyTextSize * 1.5;
    const displayThreshold = bodyTextSize * 4;

    const smallSizes = uniqueSizes.filter(s => s < smallThreshold).sort((a, b) => b - a);
    const bodySizes = uniqueSizes.filter(s => s >= smallThreshold && s < headingThreshold).sort((a, b) => b - a);
    const headingSizes = uniqueSizes.filter(s => s >= headingThreshold && s < displayThreshold).sort((a, b) => b - a);
    const displaySizes = uniqueSizes.filter(s => s >= displayThreshold).sort((a, b) => b - a);

    console.log('[ScanResultsScreen] 🎯 Distribution:');
    console.log('  Display tier (>=' + displayThreshold + 'px):', displaySizes);
    console.log('  Heading tier (' + headingThreshold + '-' + displayThreshold + 'px):', headingSizes);
    console.log('  Body tier (' + smallThreshold + '-' + headingThreshold + 'px):', bodySizes);
    console.log('  Small tier (<' + smallThreshold + 'px):', smallSizes);

    return { 
      bodyTextSize, 
      bodySizes, 
      headingSizes, 
      uniqueSizes,
      // NEW: Return tier data
      smallSizes,
      displaySizes,
      tiers: { smallThreshold, headingThreshold, displayThreshold }
    };
  };

  // HELPER: NEW - Smart tier-based mapping
  const mapSizeToSystemStyle = (
    size: number, 
    hierarchy: ReturnType<typeof analyzeTypographyHierarchy>,
    systemOptions: string[]
  ): string | null => {
    const { bodyTextSize, smallSizes, bodySizes, headingSizes, displaySizes, tiers } = hierarchy;
    
    console.log(`[ScanResultsScreen] 🎯 Mapping ${size}px...`);
    
    // 1. Check if it's the body text
    if (Math.abs(size - bodyTextSize) < 2) {
      if (systemOptions.includes('Text Main')) return 'Text Main';
      if (systemOptions.includes('Main')) return 'Main';
    }
    
    // 2. Small tier
    if (smallSizes.includes(size)) {
      const indexInSmall = smallSizes.indexOf(size);
      // Map: largest small → Text Small, smaller → Micro
      if (indexInSmall === 0 && systemOptions.includes('Text Small')) return 'Text Small';
      if (systemOptions.includes('Micro')) return 'Micro';
      if (systemOptions.includes('Text Small')) return 'Text Small';
    }
    
    // 3. Body tier (near body size)
    if (bodySizes.includes(size) && size !== bodyTextSize) {
      const indexInBody = bodySizes.indexOf(size);
      if (size > bodyTextSize && systemOptions.includes('Text Large')) return 'Text Large';
      if (size < bodyTextSize && systemOptions.includes('Text Small')) return 'Text Small';
    }
    
    // 4. Heading tier - distribute across H6 → H1
    if (headingSizes.includes(size)) {
      const headingOptions = ['H6', 'H5', 'H4', 'H3', 'H2', 'H1'].filter(h => systemOptions.includes(h));
      const indexInHeadings = headingSizes.indexOf(size);
      const totalHeadings = headingSizes.length;
      
      // Distribute evenly: smallest heading → H6, largest → H1
      if (headingOptions.length > 0) {
        const mappedIndex = Math.floor((indexInHeadings / totalHeadings) * headingOptions.length);
        const clampedIndex = Math.min(mappedIndex, headingOptions.length - 1);
        const reversedIndex = headingOptions.length - 1 - clampedIndex; // Reverse: smallest → H6
        console.log(`  Heading ${size}px: index ${indexInHeadings}/${totalHeadings} → ${headingOptions[reversedIndex]}`);
        return headingOptions[reversedIndex];
      }
    }
    
    // 5. Display tier - map to Display or largest headings
    if (displaySizes.includes(size)) {
      const indexInDisplay = displaySizes.indexOf(size);
      const totalDisplay = displaySizes.length;
      
      // Largest → Display, next → H1, then H2
      if (indexInDisplay === 0) {
      if (systemOptions.includes('Display')) return 'Display';
      if (systemOptions.includes('H0')) return 'H0';
      if (systemOptions.includes('H1')) return 'H1';
      } else if (indexInDisplay === 1) {
      if (systemOptions.includes('H1')) return 'H1';
        if (systemOptions.includes('Display')) return 'Display';
      } else if (indexInDisplay === 2) {
        if (systemOptions.includes('H2')) return 'H2';
        if (systemOptions.includes('H1')) return 'H1';
      } else {
        // 4th+ display size → H3 or lower
        if (systemOptions.includes('H3')) return 'H3';
        if (systemOptions.includes('H2')) return 'H2';
      }
    }
    
    return null;
  };

  // NEW: Ratio-aware scale calculation helper
  const calculateExpectedSizes = (bodySize: number, ratio: number) => {
    const expectedSizes: { [key: string]: number } = {};
    Object.entries(TYPOGRAPHY_SCALE_POINTS).forEach(([name, exp]) => {
      expectedSizes[name] = bodySize * Math.pow(ratio, exp);
    });
    
    return expectedSizes;
  };
  
  // NEW: Smart adaptive mapping function with RATIO-AWARE intelligence
  const mapStylesToSystem = useCallback((styles: DetectedTextStyle[], systemName: string): FoundStyleData[] => {
    const systemOptions = getSystemStyleOptions(systemName);
    
    // Analyze the typography hierarchy ONCE
    const hierarchy = analyzeTypographyHierarchy(styles);
    
    // Consolidate sizes and group styles
    const consolidatedStyles = styles.map(style => ({
      ...style,
      consolidatedSize: consolidateSize(style.fontSize)
    }));
    
    // === SIZE CONSOLIDATION (±1px → same style) ===
    const uniqueSizes = hierarchy.uniqueSizes;
    const sortedUnique = [...uniqueSizes].sort((a, b) => b - a);
    const sizeClusters: { representative: number; members: number[] }[] = sortedUnique.map((size) => ({
      representative: size,
      members: [size],
    }));

    // Aggregate instance counts per consolidated size, then per cluster.
    const sizeWeights = new Map<number, number>();
    // NEW: Track the most common style name per cluster
    const clusterNames = new Map<number, string>();

    consolidatedStyles.forEach((style) => {
      const prev = sizeWeights.get(style.consolidatedSize) || 0;
      sizeWeights.set(style.consolidatedSize, prev + (style.instanceCount || 1));
    });
    const clusterWeights = new Map<number, number>();
    sizeClusters.forEach((cluster) => {
      const total = cluster.members.reduce((sum, member) => sum + (sizeWeights.get(member) || 0), 0);
      clusterWeights.set(cluster.representative, Math.max(1, total));

      // Find the most frequent name in this cluster (if any)
      const nameCounts = new Map<string, number>();
      cluster.members.forEach(memberSize => {
        consolidatedStyles.filter(s => s.consolidatedSize === memberSize && s.nodeName && s.nodeName !== "No Style").forEach(s => {
          if (s.nodeName) {
            nameCounts.set(s.nodeName, (nameCounts.get(s.nodeName) || 0) + (s.instanceCount || 1));
          }
        });
      });
      let bestName = "";
      let maxCount = 0;
      nameCounts.forEach((count, name) => {
        if (count > maxCount) {
          maxCount = count;
          bestName = name;
        }
      });
      if (bestName) {
        clusterNames.set(cluster.representative, bestName);
      }
    });

    // Canonical slot layout used by the generator/apply pipeline.
    // Keep both shared-exponent slots (h6/textMain and h5/textLarge) so dense scales can map without dropping to None.
    const pickOption = (candidates: string[], fallback: string): string => {
      for (const candidate of candidates) {
        if (systemOptions.includes(candidate)) return candidate;
      }
      return fallback;
    };

    const displayName = pickOption(['Display', 'H0', 'Display 1', 'Heading/H1'], 'Display');
    const h1Name = pickOption(['H1', 'Display 2', 'Heading/H2'], 'H1');
    const h2Name = pickOption(['H2', 'Display 3', 'Heading/H3'], 'H2');
    const h3Name = pickOption(['H3', 'Display 4', 'Heading/H4'], 'H3');
    const h4Name = pickOption(['H4', 'Heading/H5'], 'H4');
    const h5Name = pickOption(['H5', 'Heading/H6'], 'H5');
    const h6Name = pickOption(['H6', 'Heading/H6', 'Heading 6'], 'H6');
    const textLargeName = pickOption(['Text Large', 'Lead', 'Text/Large', 'Paragraph Large'], 'Text Large');
    const textMainName = pickOption(['Text Main', 'Main', 'Body', 'Text/Regular', 'Paragraph'], 'Text Main');
    const textSmallName = pickOption(['Text Small', 'Small', 'Text/Small', 'Paragraph Small'], 'Text Small');
    const microName = pickOption(['Micro', 'Text Tiny', 'Tiny', 'Text/Tiny', 'Paragraph Tiny'], 'Micro');

    const slots = [
      { key: 'display', exponent: 6, name: displayName },
      { key: 'h1', exponent: 5, name: h1Name },
      { key: 'h2', exponent: 4, name: h2Name },
      { key: 'h3', exponent: 3, name: h3Name },
      { key: 'h4', exponent: 2, name: h4Name },
      { key: 'textLarge', exponent: 1, name: textLargeName },
      { key: 'h5', exponent: 1, name: h5Name },
      { key: 'textMain', exponent: 0, name: textMainName },
      { key: 'h6', exponent: 0, name: h6Name }, // H6 is usually body size or slightly smaller/larger, exponent 0 is same as body
      { key: 'textSmall', exponent: -1, name: textSmallName },
      { key: 'micro', exponent: -2, name: microName },
    ] as const;

    const ratioCandidates = [1.067, 1.125, 1.2, 1.25, 1.333, 1.414, 1.5, 1.618];

    const solveAssignments = (ratio: number, baseSize: number) => {
      const expectedSizes = slots.map((slot) => ({
        ...slot,
        expectedSize: baseSize * Math.pow(ratio, slot.exponent),
      }));

      // A massive penalty for skipping a highly-used slot. This forces the algorithm
      // to map the high-instance count sizes (like 19px with 14 instances) to *something*
      // rather than leaving them as "None".
      const SKIP_PENALTY = 25.0; // Increased massively so high-instance nodes are never skipped
      
      const memo = new Map<string, { cost: number; mapped: number; picks: number[] }>();

      const dfs = (idx: number, usedMask: number): { cost: number; mapped: number; picks: number[] } => {
        if (idx >= sizeClusters.length) return { cost: 0, mapped: 0, picks: [] };
        const memoKey = `${idx}:${usedMask}`;
        const cached = memo.get(memoKey);
        if (cached) return cached;

        const cluster = sizeClusters[idx];
        const weight = clusterWeights.get(cluster.representative) || 1;

        const skip = dfs(idx + 1, usedMask);
        let best = {
          cost: skip.cost + SKIP_PENALTY * weight, // Huge penalty for skipping a size with many instances
          mapped: skip.mapped,
          picks: [-1, ...skip.picks],
        };

        const clusterName = clusterNames.get(cluster.representative) || "";

        const observedLog = Math.log(Math.max(cluster.representative, 1));
        expectedSizes.forEach((slot, slotIdx) => {
          if ((usedMask & (1 << slotIdx)) !== 0) return;
          const next = dfs(idx + 1, usedMask | (1 << slotIdx));
          const expectedLog = Math.log(Math.max(slot.expectedSize, 1));
          const error = observedLog - expectedLog;
          let fitCost = (error * error) * weight;

          // NEW: Hybrid Name-Weighted Tiebreaker
          // If the cluster has a formal style name, and it matches the slot name or key identifiers,
          // give it a massive cost reduction (bonus). This allows the math to still find the best overall fit,
          // but breaks ties or near-ties by trusting the designer's original intent.
          if (clusterName) {
            const normName = clusterName.toLowerCase();
            const normSlot = slot.name.toLowerCase();
            const slotKey = slot.key.toLowerCase(); // e.g. "textmain", "h1"

            // Heuristics for matching names to slots
            const isMatch = 
              normName === normSlot || 
              normName.includes(normSlot) ||
              (slotKey.match(/h[0-6]/) && normName.includes(slotKey)) ||
              (slotKey === 'display' && (normName.includes('display') || normName.includes('hero'))) ||
              (slotKey === 'textlarge' && (normName.includes('large') || normName.includes('lead') || normName.includes('subtitle'))) ||
              (slotKey === 'textmain' && (normName.includes('main') || normName.includes('body') || normName.includes('regular') || normName === 'paragraph')) ||
              (slotKey === 'textsmall' && (normName.includes('small') || normName.includes('caption') || normName.includes('detail'))) ||
              (slotKey === 'micro' && (normName.includes('micro') || normName.includes('tiny')));

            if (isMatch) {
              // 90% discount on the error cost if the name matches.
              // It still penalizes huge size mismatches, but strongly prefers this slot if it's close.
              fitCost = fitCost * 0.1; 
            }
          }

          const candidate = {
            cost: next.cost + fitCost,
            mapped: next.mapped + 1,
            picks: [slotIdx, ...next.picks],
          };
          if (
            candidate.cost < best.cost ||
            (Math.abs(candidate.cost - best.cost) < 1e-9 && candidate.mapped > best.mapped)
          ) {
            best = candidate;
          }
        });

        memo.set(memoKey, best);
        return best;
      };

      const solved = dfs(0, 0);
      const assignmentByCluster = new Map<number, string>();
      solved.picks.forEach((pickedSlotIndex, clusterIndex) => {
        if (pickedSlotIndex < 0) return;
        const cluster = sizeClusters[clusterIndex];
        const slot = expectedSizes[pickedSlotIndex];
        if (cluster && slot) {
          assignmentByCluster.set(cluster.representative, slot.name);
        }
      });

      return {
        normalizedCost: solved.cost / Math.max(1, sizeClusters.length),
        mappedCount: solved.mapped,
        assignmentByCluster,
      };
    };

    const bodyAnchor = hierarchy.bodyTextSize;
    type BestFitResult = {
      ratio: number;
      baseSize: number;
      normalizedCost: number;
      mappedCount: number;
      assignments: Map<number, string>;
    };
    let bestFit: BestFitResult | undefined;

    const exponents = slots.map((slot) => slot.exponent);
    const estimateBaseForRatio = (ratio: number): number => {
      const logRatio = Math.log(ratio);
      let weightedLogBaseSum = 0;
      let totalWeight = 0;

      sizeClusters.forEach((cluster) => {
        const weight = clusterWeights.get(cluster.representative) || 1;
        const observedLog = Math.log(Math.max(cluster.representative, 1));
        let nearestExponent = exponents[0];
        let nearestDistance = Infinity;
        exponents.forEach((exp) => {
          const expectedAtBody = bodyAnchor * Math.pow(ratio, exp);
          const distance = Math.abs(cluster.representative - expectedAtBody);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestExponent = exp;
          }
        });
        const impliedLogBase = observedLog - (nearestExponent * logRatio);
        weightedLogBaseSum += impliedLogBase * weight;
        totalWeight += weight;
      });

      const meanLogBase = totalWeight > 0 ? weightedLogBaseSum / totalWeight : Math.log(Math.max(bodyAnchor, 1));
      return Math.exp(meanLogBase);
    };

    ratioCandidates.forEach((ratio) => {
      const estimatedBase = estimateBaseForRatio(ratio);
      const baseCandidates = Array.from(
        new Set([
          Number(estimatedBase.toFixed(3)),
          Number(Math.round(estimatedBase).toFixed(3)),
          Number(bodyAnchor.toFixed(3)),
          Number(Math.round(bodyAnchor).toFixed(3)),
        ])
      ).filter((baseSize) => isFinite(baseSize) && baseSize >= 8 && baseSize <= 40);

      baseCandidates.forEach((baseSize) => {
        const solved = solveAssignments(ratio, baseSize);
        if (
          !bestFit ||
          solved.normalizedCost < bestFit.normalizedCost ||
          (Math.abs(solved.normalizedCost - bestFit.normalizedCost) < 1e-9 && solved.mappedCount > bestFit.mappedCount)
        ) {
          bestFit = {
            ratio,
            baseSize,
            normalizedCost: solved.normalizedCost,
            mappedCount: solved.mappedCount,
            assignments: solved.assignmentByCluster,
          };
        }
      });
    });

    if (bestFit !== undefined) {
      detectedScaleRatioRef.current = bestFit.ratio;
      console.log(
        `[Scan] Best-fit ratio=${bestFit.ratio.toFixed(3)}, base=${bestFit.baseSize.toFixed(2)}, mapped=${bestFit.mappedCount}/${sizeClusters.length}, cost=${bestFit.normalizedCost.toFixed(4)}`
      );
      console.log('[Scan] Best-fit assignments:', Object.fromEntries(bestFit.assignments));
    } else {
      detectedScaleRatioRef.current = 1.333;
      console.log('[Scan] Fallback ratio used: 1.333');
    }

    // === MAP INDIVIDUAL STYLES ===
    return consolidatedStyles
      .slice()
      .sort((a, b) => b.consolidatedSize - a.consolidatedSize)
      .map(style => {
        const cluster = sizeClusters.find(c => c.members.includes(style.consolidatedSize));
        const mapping = cluster ? (bestFit?.assignments.get(cluster.representative) || 'None') : 'None';

        return {
          ...style,
          sizeDisplay: `${style.fontSize}px`,
          styleName: style.nodeName && style.nodeName !== "No Style" ? style.nodeName : null,
          isOpen: false,
          mappedSystemStyle: mapping
        };
      });
  }, [getSystemStyleOptions]);
  
  // NEW: Map scanned styles when they arrive
  useEffect(() => {
    if (initialDetectedStyles.length === 0) return;
    
    // MAPPING SHOULD ONLY RUN ONCE when initial styles are set.
    // The selectedSystem at this point is the auto-detected one, which is correct for the initial mapping.
    console.log('[ScanResultsScreen] 📊 Mapping initial scanned styles to system:', selectedSystem);
    const mappedStyles = mapStylesToSystem(initialDetectedStyles, selectedSystem);
    setFoundStylesData(mappedStyles);
    
  }, [initialDetectedStyles, mapStylesToSystem]); // CRITICAL FIX: Removed selectedSystem from deps to prevent re-mapping

  // REMOVED: Re-mapping effect - this was causing assignments to change.

  // NEW: Listener for scan results
  useEffect(() => {
    const handleFrameScanResult = on('FRAME_SCAN_RESULT', (data: { success: boolean, detectedStyles: DetectedTextStyle[], message?: string, primaryScannedBaseSize?: number, primaryScannedFontFamily?: string, primaryScannedFontStyle?: string, hasSpecimenSnapshot?: boolean }) => {
      console.log('[ScanResultsScreen] Received FRAME_SCAN_RESULT:', data);
      setIsScanning(false);
      if (data.success && data.detectedStyles) {
        setHasSpecimenSnapshot(!!data.hasSpecimenSnapshot);
        onScanComplete(data);
      } else {
        console.error("Frame scan failed or no text styles found:", data.message);
        if (data.message) {
          alert(data.message);
        }
      }
    });

    return () => {
      handleFrameScanResult(); 
    }
  }, [onScanComplete]);

  // Auto-start a scan when opened from the wand shortcut.
  useEffect(() => {
    if (!autoScanOnMount) return;
    handleScanFrame();
    onAutoScanHandled?.();
  }, [autoScanOnMount, handleScanFrame, onAutoScanHandled]);

  // NEW: Listener for AUTO_MATCH_RESULTS - DISABLED (kept for future use)
  // useEffect(() => {
  //   const handleAutoMatchResults = on('AUTO_MATCH_RESULTS', (data: AutoMatchResultsEvent) => {
  //     console.log('[ScanResultsScreen] Received AUTO_MATCH_RESULTS:', data);
  //     setIsAutoMatching(false);
  //     if (data.success && data.updatedStyles) {
  //       // Update foundStylesData with the new mappings
  //       // It's important that the structure of data.updatedStyles matches FoundStyleData
  //       // or can be mapped to it.
  //       setFoundStylesData(data.updatedStyles.slice().sort((a, b) => b.fontSize - a.fontSize)); 
  //     } else {
  //       alert(data.message || "Auto-matching failed. Please try again.");
  //     }
  //   });

  //   return () => {
  //     handleAutoMatchResults(); // Cleanup listener
  //   };
  // }, []); // Empty dependency array, runs once on mount

  // NEW: Listener for APPLY_MATCHES_COMPLETE for navigation
  useEffect(() => {
    const handleApplyMatchesComplete = on('APPLY_MATCHES_COMPLETE', (data: { 
      success: boolean, 
      nodesChanged: number,
      appliedToFrame?: boolean,
      estimatedRatio?: number, // ADDED: Expect ratio here
      baseSizeInPx?: number,
      largeSizeInPx?: number,
      primaryScannedFontFamily?: string,
      primaryScannedFontStyle?: string,
      secondaryScannedFontFamily?: string,
      secondaryScannedFontStyle?: string,
      detectedNamingConvention?: string // ADDED: Expect detected naming convention
    }) => {
      console.log('[ScanResultsScreen] Received APPLY_MATCHES_COMPLETE:', data);
      setIsApplyingMatches(false); // Clear loading state
      if (data.success) {
        if (data.appliedToFrame !== false && data.nodesChanged === 0) {
          alert("No text nodes were updated. Check mappings and try again.");
          return;
        }

        if (onApplyCompleteAndNavigating) { 
          const mappedStyleNames = Array.from(
            new Set(
              foundStylesData
                .map((style) => style.mappedSystemStyle)
                .filter((name) => name && name !== 'None')
            )
          );
          onApplyCompleteAndNavigating({
            nodesChanged: data.nodesChanged,
            appliedToFrame: data.appliedToFrame,
            estimatedRatio: data.estimatedRatio,
            baseSizeInPx: data.baseSizeInPx,
            largeSizeInPx: data.largeSizeInPx,
            primaryScannedFontFamily: data.primaryScannedFontFamily,
            primaryScannedFontStyle: data.primaryScannedFontStyle,
            secondaryScannedFontFamily: data.secondaryScannedFontFamily,
            secondaryScannedFontStyle: data.secondaryScannedFontStyle,
            detectedNamingConvention: data.detectedNamingConvention, // ADDED: Pass detected naming convention
            mappedStyleNames,
            mappedSystemName: selectedSystem,
          });
        }
        setCurrentView('main'); // Navigate to main UI
      } else {
        // Handle failure if necessary, though main.ts currently always sends success: true
        alert("There was an issue applying the matches.");
      }
    });

    return () => {
      handleApplyMatchesComplete(); // Cleanup listener
    };
  }, [setCurrentView, onApplyCompleteAndNavigating, foundStylesData, selectedSystem]); // RE-ADD onApplyCompleteAndNavigating to dependencies

  return (
    <Fragment>
      <div class="main-content" style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Fixed Header */}
        <div class="header-tabs-section">
          <div class="tab-row">
            <div class="header-title-group">
              {/* ADDED Back Button */}
              <button 
                className="ghost-button"
                onClick={handleBack} 
                aria-label="Back to landing screen"
              >
                <Icon name="return-24" size={24} />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable content area - fills remaining space */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
          {foundStylesData.length > 0 ? (
          <Fragment>
            <div style={{ paddingBottom: 'var(--sizing-default-spacers-spacer-2)' }}>
              <div
                class="section-header"
                style={{
                  cursor: 'default',
                  height: 'var(--size-header-height)',
                  gridTemplateColumns: '1fr 180px',
                }}
              >
                <div class="section-header-titles-container section-header-left">
                  <span class="control-label" style={{ color: 'var(--text-inactive)' }}>Scanned size</span>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <span class="control-label" style={{ color: 'var(--text-inactive)' }}>Assign plugin style</span>
                </div>
              </div>
              <div ref={dropdownsContainerRef} class="scan-results-list">
              {foundStylesData.map((item) => (
                <div 
                  key={item.id} 
                  class="section-header" 
                  style={{ 
                    height: 'var(--size-row-height)', 
                    boxSizing: 'border-box', 
                    cursor: 'default', 
                    paddingLeft: 'var(--sizing-default-spacers-spacer-3)', // Added Left Padding for consistency with API row
                    paddingRight: 'var(--sizing-default-spacers-spacer-3)',
                    display: 'flex', // Explicitly ensure flex
                    alignItems: 'center', // Explicitly ensure vertical centering
                    justifyContent: 'flex-start', // Override space-between from class to use gap
                    gap: 'var(--sizing-default-spacers-spacer-2)' // Consistent gap
                  }}
                  onMouseEnter={() => handleMouseEnter(item.id)}
                  onMouseLeave={handleMouseLeave}
                >
                  <div class="result-text-wrap" style={{ display: 'flex', alignItems: 'center', flexGrow: 1, overflow: 'hidden' }}>
                    <span class="section-title" style={{ fontWeight: 'var(--ui-font-weight-regular)', width: '48px', flexShrink: 0, flexGrow: 0, marginRight: 'var(--sizing-default-spacers-spacer-2)' }}>
                      {item.sizeDisplay}
                    </span>
                    {item.nodeName && item.nodeName !== "No Style" && (
                      <span style={{
                        fontSize: 'var(--ui-font-size-small)', 
                        color: 'var(--text-inactive)',
                        flexGrow: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginRight: 'var(--sizing-default-spacers-spacer-2)'
                      }}>
                        {item.nodeName}
                      </span>
                    )}
                  </div>
                  <div 
                    class="custom-dropdown-container header-section-dropdown-container" 
                    style={{
                      width: '180px', // Consistent fixed width
                      flexShrink: 0 // Prevent shrinking
                    }}
                  >
                    <button
                      className="input dropdown-trigger-button"
                      onClick={(e) => { e.stopPropagation(); toggleDropdown(e, item.id); }}
                    >
                      <span class="dropdown-trigger-label">{translateStyleToSystem(item.mappedSystemStyle, selectedSystem)}</span>
                    </button>
                    {/* Dropdown list is now rendered at the top level */}
                  </div>
                </div>
              ))}
              </div>
            </div>

          </Fragment>
        ) : (
          <div class="section-header" style={{ 
            cursor: 'default', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            flex: 1 
          }}>
            <div class="section-header-titles-container section-header-left">
              <span class="section-title" style={{ color: 'var(--text-secondary)', fontWeight: 'var(--ui-font-weight-regular)', whiteSpace: 'normal', wordWrap: 'break-word', textAlign: 'center' }}>
                Select a frame and click 'Scan' to detect font sizes.
              </span>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* MODIFIED Footer with expandable API Key input */}
      <div class="footer-fixed">
        <div class="footer-row footer-top-row"> {/* This row is flex-column by default */}
          <div class="footer-button-group"> {/* This group handles button layout (row for children) */}
            <div class="footer-main-cta" onClick={handleBack}>
              <div class="footer-main-cta-value">Cancel</div>
            </div>
            <div 
              class={`footer-main-cta ${canApplyMatches ? 'cta-highlighted' : ''}`} 
              onClick={canApplyMatches && !isApplyingMatches ? handleApplyMatches : undefined}
              style={{ 
                flexGrow: 1, 
                opacity: canApplyMatches ? 1 : 'var(--opacity-disabled)',
                pointerEvents: canApplyMatches && !isApplyingMatches ? 'auto' : 'none'
              }}
            >
              <div class="footer-main-cta-value">
                {isApplyingMatches ? <Icon name="loading-small-24" size={24} className="loading-svg" /> : "Apply matches"}
              </div>
            </div>
          </div>
        </div>
        {/* Footer Bottom Row - Reused from Landing Screen */}
        <div className="footer-row footer-bottom-row">
          <div className="footer-button-group footer-secondary-button-group">
            <button className="button-secondary-new icon-only" disabled>
              <Icon name="play-small-24" size={24} />
            </button>
            <button className="button-secondary-new" disabled>
              Dark
            </button>
            <button className="button-secondary-new" disabled>
              Hide specs
            </button>
          </div>
          <button className="button-secondary-new with-icon" disabled>
            <Icon name="export-small-24" size={24} />
            Export
          </button>
        </div>
      </div>

      {/* API Key Modal - REMOVED (kept in code history for future use) */}

      {/* --- NEW: Render dropdown list at top level --- */}
      {foundStylesData.some(s => s.isOpen) && dropdownPosition && (() => {
        const activeItem = foundStylesData.find(s => s.isOpen);
        if (!activeItem) return null;

        return (
          <div
            ref={dropdownListRef}
            className="dropdown-list"
            style={{
              position: 'fixed',
              top: dropdownPosition.top !== undefined ? `${dropdownPosition.top}px` : 'auto',
              bottom: dropdownPosition.bottom !== undefined ? `${dropdownPosition.bottom}px` : 'auto',
              left: dropdownPosition.left !== undefined ? `${dropdownPosition.left}px` : 'auto',
              width: dropdownPosition.width !== undefined ? `${dropdownPosition.width}px` : 'auto',
              maxHeight: '240px', // 8 items * 30px
              overflowY: 'auto',
              zIndex: 1000,
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="dropdown-items-container">
              {getSystemStyleOptions(selectedSystem).map((option: string) => (
                <button
                  key={option}
                  className={`dropdown-item ${activeItem.mappedSystemStyle === option ? 'selected' : ''}`}
                  onMouseDown={() => selectStyle(activeItem.id, option)}
                >
                  <span className="dropdown-item-text-content">{option}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })()}
    </Fragment>
  );
}