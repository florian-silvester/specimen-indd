// src/ui/hooks/useFontState.ts
import { useState, useEffect, useRef, useCallback } from "preact/hooks";
import { on } from "@create-figma-plugin/utilities";
import {
  FontInfo,
  InitialFontsMessage,
  StylesForFamilyMessage,
  AvailableFontsListUpdateEvent,
  TypographySystem,
} from "../../core/types";

export function useFontState(
  fineTunedStyles: TypographySystem,
  setFineTunedStyles: (styles: TypographySystem) => void,
  emit: (name: string, ...args: any[]) => void
) {
  // Primary font state
  const [fontFamily, setFontFamily] = useState("Inter");
  const [availableFonts, setAvailableFonts] = useState<string[]>(["Inter"]);
  const [selectedStyle, setSelectedStyle] = useState("Regular");
  const [availableStyles, setAvailableStyles] = useState<string[]>(["Regular"]);
  const [actualAvailableFontsList, setActualAvailableFontsList] = useState<FontInfo[]>([]);
  const [pendingStyleSelection, setPendingStyleSelection] = useState<string | null>(null);

  // Preview state for real-time font preview (primary)
  const [previewFontFamily, setPreviewFontFamily] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const previewTimeoutRef = useRef<number | null>(null);

  // Preview state for secondary font
  const [previewSecondaryFontFamily, setPreviewSecondaryFontFamily] = useState<string | null>(null);
  const [isSecondaryPreviewMode, setIsSecondaryPreviewMode] = useState(false);
  const secondaryPreviewTimeoutRef = useRef<number | null>(null);

  // Preview state for real-time weight preview (primary)
  const [previewWeight, setPreviewWeight] = useState<string | null>(null);
  const [isWeightPreviewMode, setIsWeightPreviewMode] = useState(false);
  const weightPreviewTimeoutRef = useRef<number | null>(null);

  // Preview state for secondary weight
  const [previewSecondaryWeight, setPreviewSecondaryWeight] = useState<string | null>(null);
  const [isSecondaryWeightPreviewMode, setIsSecondaryWeightPreviewMode] = useState(false);
  const secondaryWeightPreviewTimeoutRef = useRef<number | null>(null);

  // Secondary font state - starts "linked" to primary font
  const [secondaryFontEnabled, setSecondaryFontEnabled] = useState(true); // Start enabled/linked
  const [secondaryFontLinked, setSecondaryFontLinked] = useState(true); // Track if secondary font family is linked to primary
  const [secondaryWeightLinked, setSecondaryWeightLinked] = useState(true); // Track if secondary weight is linked to primary (start linked by default)
  const [secondaryFontFamily, setSecondaryFontFamily] = useState("Inter"); // Same as primary initially
  const [secondarySelectedStyle, setSecondarySelectedStyle] = useState("Regular");
  const [secondaryAvailableStyles, setSecondaryAvailableStyles] = useState<string[]>(["Regular"]);
  const [pendingSecondaryStyleSelection, setPendingSecondaryStyleSelection] = useState<string | null>(null);

  // Use refs to track current state values to avoid dependency issues
  const selectedStyleRef = useRef(selectedStyle);
  selectedStyleRef.current = selectedStyle;
  
  const fontFamilyRef = useRef(fontFamily);
  fontFamilyRef.current = fontFamily;
  
  const secondaryFontFamilyRef = useRef(secondaryFontFamily);
  secondaryFontFamilyRef.current = secondaryFontFamily;

  // Listen for initial font families and styles from the plugin
  useEffect(() => {
    const handler = on("INITIAL_FONTS", (data: InitialFontsMessage) => {
      console.log("[useFontState] Received INITIAL_FONTS event.");
      if (Array.isArray(data.families) && data.families.length > 0) {
        setAvailableFonts(data.families);
        setFontFamily(data.initialFamily);
        setAvailableStyles(data.initialStyles);
        let initialStyle = "Regular";
        if (data.initialStyles.includes("Regular")) {
          initialStyle = "Regular";
        } else if (data.initialStyles.length > 0) {
          initialStyle = data.initialStyles[0];
        }
        setSelectedStyle(initialStyle);

        // Initialize secondary font with same styles as primary (since they start linked)
        setSecondaryAvailableStyles(data.initialStyles);
        // Since secondary weight is linked by default, use the same style as primary
        setSecondarySelectedStyle(initialStyle);
      } else {
        setAvailableFonts(["Inter"]);
        setFontFamily("Inter");
        setAvailableStyles(["Regular"]);
        setSelectedStyle("Regular");
        // Also initialize secondary with same fallback (linked by default)
        setSecondaryAvailableStyles(["Regular"]);
        setSecondarySelectedStyle("Regular");
      }
    });
    return () => handler();
  }, []);

  // Listener for the full FontInfo[] list
  useEffect(() => {
    const handleFontsUpdate = on(
      "AVAILABLE_FONTS_LIST_UPDATE",
      (data: AvailableFontsListUpdateEvent) => {
        console.log(
          "[useFontState] Received AVAILABLE_FONTS_LIST_UPDATE with",
          data.availableFonts.length,
          "fonts.",
        );
        setActualAvailableFontsList(data.availableFonts);
      },
    );
    return () => handleFontsUpdate();
  }, []);

  // Handle receiving new styles for a selected family
  useEffect(() => {
    const handler = on(
      "STYLES_FOR_FAMILY",
      (data: { family: string; styles: string[] }) => {
        console.log(
          `[useFontState] Received STYLES_FOR_FAMILY for ${data.family}. Primary pending: ${pendingStyleSelection}, Secondary pending: ${pendingSecondaryStyleSelection}`,
        );

        // FIXED: Check preview fonts first, then committed fonts
        // Priority: secondary preview > primary preview > committed secondary > committed primary
        const isForSecondaryPreview = data.family === previewSecondaryFontFamily && isSecondaryPreviewMode;
        const isForPrimaryPreview = data.family === previewFontFamily && isPreviewMode && !isForSecondaryPreview;
        const isForSecondaryFont = !isForSecondaryPreview && !isForPrimaryPreview && 
                                  data.family === secondaryFontFamilyRef.current && 
                                  secondaryFontEnabled && 
                                  !secondaryFontLinked; // Only handle unlinked secondary fonts here
        const isForPrimaryFont = !isForSecondaryPreview && !isForPrimaryPreview && !isForSecondaryFont && 
                                 data.family === fontFamilyRef.current;
        
        console.log(`[useFontState] Font matching check: data.family=${data.family}, fontFamilyRef=${fontFamilyRef.current}, secondaryFontFamilyRef=${secondaryFontFamilyRef.current}, isForPrimary=${isForPrimaryFont}, isForSecondary=${isForSecondaryFont}, isForSecondaryPreview=${isForSecondaryPreview}, isForPrimaryPreview=${isForPrimaryPreview}`);

        if (isForSecondaryPreview) {
          // Handle secondary font preview - just update the available styles for weight dropdown
          console.log(`[useFontState] Processing SECONDARY PREVIEW font styles for: ${data.family}`);
          setSecondaryAvailableStyles(data.styles);
          // Don't change the selected style during preview, that's handled by the commit function
        } else if (isForPrimaryPreview) {
          // Handle primary font preview
          console.log(`[useFontState] Processing PRIMARY PREVIEW font styles for: ${data.family}`);
          setAvailableStyles(data.styles);

          // If secondary is linked, also update secondary styles during primary preview
          if (secondaryFontEnabled && secondaryFontLinked) {
            console.log(`[useFontState] Updating secondary styles because primary preview and font is linked`);
            setSecondaryAvailableStyles(data.styles);
            }
          // Don't change the selected styles during preview, that's handled by the commit function
        } else if (isForSecondaryFont) {
          // Handle secondary font styles (when manually selected/unlinked)
          console.log(`[useFontState] Processing SECONDARY font styles for: ${data.family}`);
          setSecondaryAvailableStyles(data.styles);

          let newStyleToSelect: string;
          if (pendingSecondaryStyleSelection && data.styles.includes(pendingSecondaryStyleSelection)) {
            newStyleToSelect = pendingSecondaryStyleSelection;
            setPendingSecondaryStyleSelection(null);
            console.log(
              `[useFontState] Applied pending SECONDARY style selection: ${newStyleToSelect}`,
            );
          } else {
            // Preserve current secondary weight first, then primary, then Regular, then first available
            if (data.styles.includes(secondarySelectedStyle)) {
              newStyleToSelect = secondarySelectedStyle;
              console.log(`[useFontState] Preserving current secondary weight: ${newStyleToSelect}`);
            } else if (data.styles.includes(selectedStyleRef.current)) {
              newStyleToSelect = selectedStyleRef.current;
              console.log(`[useFontState] Using same weight as primary: ${newStyleToSelect}`);
            } else if (data.styles.includes("Regular")) {
              newStyleToSelect = "Regular";
              console.log(`[useFontState] Falling back to Regular: ${newStyleToSelect}`);
            } else {
              newStyleToSelect = data.styles[0] || selectedStyleRef.current;
              console.log(`[useFontState] Using first available secondary weight: ${newStyleToSelect}`);
            }
          }

          setSecondarySelectedStyle(newStyleToSelect);
          console.log(
            `[useFontState] Set SECONDARY selectedStyle to: ${newStyleToSelect}`,
          );
        } else if (isForPrimaryFont) {
          // Handle primary font styles
          setAvailableStyles(data.styles);

          let newStyleToSelect: string;
          if (pendingStyleSelection && data.styles.includes(pendingStyleSelection)) {
            newStyleToSelect = pendingStyleSelection;
            setPendingStyleSelection(null);
            console.log(
              `[useFontState] Applied pending PRIMARY style selection: ${newStyleToSelect}`,
            );
          } else if (data.styles.includes(selectedStyleRef.current)) {
            // FIXED: Preserve current selection if it's available in new styles
            newStyleToSelect = selectedStyleRef.current;
            console.log(
              `[useFontState] Preserved existing PRIMARY style selection: ${newStyleToSelect}`,
            );
          } else {
            // Only default to Regular if current selection is not available
            newStyleToSelect = "Regular";
            if (data.styles.includes("Regular")) {
              newStyleToSelect = "Regular";
            } else if (data.styles.length > 0) {
              newStyleToSelect = data.styles[0];
            }
            console.log(
              `[useFontState] Current PRIMARY style not available, defaulting to: ${newStyleToSelect}`,
            );
          }

          setSelectedStyle(newStyleToSelect);
          console.log(
            `[useFontState] Set PRIMARY selectedStyle to: ${newStyleToSelect}`,
          );

          // If secondary font is linked to primary, update secondary styles too
          if (secondaryFontEnabled && secondaryFontLinked) {
            console.log(`[useFontState] Updating secondary styles because font is linked. Available styles:`, data.styles);
            console.log(`[useFontState] Current secondary styles before update:`, secondaryAvailableStyles);
            setSecondaryAvailableStyles(data.styles);
            
            let newSecondaryStyleToSelect: string;
            if (secondaryWeightLinked) {
              // Weight is linked: try to use same as primary, fallback to reasonable default
              if (data.styles.includes(newStyleToSelect)) {
                newSecondaryStyleToSelect = newStyleToSelect;
                console.log(`[useFontState] Using same weight as primary: ${newStyleToSelect}`);
              } else if (data.styles.includes("Regular")) {
                newSecondaryStyleToSelect = "Regular";
                console.log(`[useFontState] Primary weight not available, falling back to Regular`);
              } else if (data.styles.length > 0) {
                newSecondaryStyleToSelect = data.styles[0];
                console.log(`[useFontState] Primary weight not available, using first available: ${data.styles[0]}`);
              } else {
                newSecondaryStyleToSelect = "Regular";
                console.log(`[useFontState] No styles available, defaulting to Regular`);
              }
            } else {
              // Weight is NOT linked: try to preserve current secondary weight, otherwise first available
              if (data.styles.includes(secondarySelectedStyle)) {
                newSecondaryStyleToSelect = secondarySelectedStyle;
                console.log(`[useFontState] Preserving current secondary weight: ${secondarySelectedStyle}`);
              } else {
                newSecondaryStyleToSelect = data.styles[0] || secondarySelectedStyle;
                console.log(`[useFontState] Current weight not available, using first available: ${newSecondaryStyleToSelect}`);
              }
            }
            
            setSecondarySelectedStyle(newSecondaryStyleToSelect);
            console.log(
              `[useFontState] Updated SECONDARY styles (font linked, weight ${secondaryWeightLinked ? 'linked' : 'unlinked'}): ${newSecondaryStyleToSelect}`,
            );
          }
        } else {
          console.log(
            `[useFontState] Received styles for ${data.family} but it doesn't match current primary (${fontFamily}) or secondary (${secondaryFontFamilyRef.current}) font`,
          );
        }
      },
    );
    return () => handler();
  }, [pendingStyleSelection, pendingSecondaryStyleSelection, fontFamily, secondaryFontEnabled, secondaryFontLinked, secondaryWeightLinked]);

  // Sync secondary weight with primary weight when weight is linked
  useEffect(() => {
    if (secondaryFontEnabled && secondaryWeightLinked && selectedStyle !== secondarySelectedStyle) {
      // Only update if the primary style is available in secondary styles
      if (secondaryAvailableStyles.includes(selectedStyle)) {
        setSecondarySelectedStyle(selectedStyle);
        console.log(`[useFontState] Synced secondary weight to primary: ${selectedStyle}`);
      }
    }
  }, [selectedStyle, secondaryFontEnabled, secondaryWeightLinked, secondaryAvailableStyles, secondarySelectedStyle]);

  // Custom setFontFamily that also updates secondary if linked
  const setFontFamilyWithLinking = (newFontFamily: string) => {
    console.log(`[useFontState] setFontFamilyWithLinking called with: ${newFontFamily}`);
    setFontFamily(newFontFamily);
    fontFamilyRef.current = newFontFamily; // CRITICAL: Update ref immediately for STYLES_FOR_FAMILY handler
    
    // If secondary is linked, update secondary font family too
    if (secondaryFontEnabled && secondaryFontLinked) {
      console.log(`[useFontState] Secondary is linked, updating secondary font to: ${newFontFamily}`);
      setSecondaryFontFamily(newFontFamily);
      secondaryFontFamilyRef.current = newFontFamily;
    }
    
    // IMPORTANT: Always emit GET_STYLES_FOR_FAMILY for the new primary font
    // This ensures weights get updated when font family changes
    console.log(`[useFontState] Emitting GET_STYLES_FOR_FAMILY for primary font: ${newFontFamily}`);
    emit("GET_STYLES_FOR_FAMILY", newFontFamily);
  };

  // Custom setSecondaryFontFamily that also updates the ref
  const setSecondaryFontFamilyWithRef = (newFontFamily: string) => {
    setSecondaryFontFamily(newFontFamily);
    secondaryFontFamilyRef.current = newFontFamily;
  };

  // Toggle secondary font family linking
  const toggleSecondaryFontLinked = () => {
    const newLinkedState = !secondaryFontLinked;
    setSecondaryFontLinked(newLinkedState);
    
    // If linking font to primary, update secondary font family to match
    if (newLinkedState && secondaryFontEnabled) {
      setSecondaryFontFamily(fontFamilyRef.current);
      secondaryFontFamilyRef.current = fontFamilyRef.current;
      // Also emit to get styles for the primary font for secondary
      emit("GET_STYLES_FOR_FAMILY", fontFamilyRef.current);
    }
  };

  // Toggle secondary weight linking
  const toggleSecondaryWeightLinked = () => {
    const newLinkedState = !secondaryWeightLinked;
    setSecondaryWeightLinked(newLinkedState);
    
    // If linking weight to primary, sync the weight if available
    if (newLinkedState && secondaryFontEnabled && availableStyles.includes(selectedStyle)) {
      setSecondarySelectedStyle(selectedStyle);
    }
  };

  // Debounced preview function for real-time font preview
  const startFontPreview = (font: string) => {
    // Clear existing timeout
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }
    
    // Set new timeout for 25ms debounce (ultra-fast)
    previewTimeoutRef.current = setTimeout(() => {
      console.log(`[useFontState] Starting font preview for: ${font}`);
      setPreviewFontFamily(font);
      setIsPreviewMode(true);
      
      // CRITICAL: If secondary is linked, also preview secondary with same font
      // This ensures ALL nodes (headlines + text) update together
      if (secondaryFontEnabled && secondaryFontLinked) {
        console.log(`[useFontState] 🔗 Secondary is linked, also previewing secondary with: ${font}`);
        console.log(`[useFontState] 🔗 Current secondary state: enabled=${secondaryFontEnabled}, linked=${secondaryFontLinked}, family=${secondaryFontFamily}`);
        setPreviewSecondaryFontFamily(font);
        setIsSecondaryPreviewMode(true);
        console.log(`[useFontState] 🔗 Set preview secondary font to: ${font}`);
      } else {
        console.log(`[useFontState] ❌ Secondary NOT linked or not enabled: enabled=${secondaryFontEnabled}, linked=${secondaryFontLinked}`);
      }
      
      // Request styles for preview font (needed for weight dropdowns)
      emit("GET_STYLES_FOR_FAMILY", font);
    }, 25);
  };

  // Stop font preview and revert to committed font
  const stopFontPreview = () => {
    // Clear any pending timeout
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
    
    console.log(`[useFontState] Stopping font preview, reverting to: ${fontFamily}`);
    setPreviewFontFamily(null);
    setIsPreviewMode(false);
    
    // CRITICAL: If secondary was being previewed due to linking, also stop secondary preview
    if (isSecondaryPreviewMode && secondaryFontEnabled && secondaryFontLinked) {
      console.log(`[useFontState] Also stopping linked secondary preview`);
      setPreviewSecondaryFontFamily(null);
      setIsSecondaryPreviewMode(false);
    }
  };

  // Commit preview font as the actual selection
  const commitPreviewFont = (font: string) => {
    console.log(`[useFontState] Committing preview font: ${font}`);
    stopFontPreview(); // Clear preview state
    setFontFamilyWithLinking(font); // Use normal font selection logic
  };

  // Secondary font preview functions
  const startSecondaryFontPreview = (font: string) => {
    // Clear existing timeout
    if (secondaryPreviewTimeoutRef.current) {
      clearTimeout(secondaryPreviewTimeoutRef.current);
    }
    
    // Set new timeout for 25ms debounce (ultra-fast)
    secondaryPreviewTimeoutRef.current = setTimeout(() => {
      console.log(`[useFontState] Starting secondary font preview for: ${font}`);
      setPreviewSecondaryFontFamily(font);
      setIsSecondaryPreviewMode(true);
      
      // Request styles for preview font (needed for weight dropdowns)
      emit("GET_STYLES_FOR_FAMILY", font);
    }, 25);
  };

  // Stop secondary font preview and revert to committed font
  const stopSecondaryFontPreview = () => {
    // Clear any pending timeout
    if (secondaryPreviewTimeoutRef.current) {
      clearTimeout(secondaryPreviewTimeoutRef.current);
      secondaryPreviewTimeoutRef.current = null;
    }
    
    console.log(`[useFontState] Stopping secondary font preview, reverting to: ${secondaryFontFamily}`);
    setPreviewSecondaryFontFamily(null);
    setIsSecondaryPreviewMode(false);
  };

  // Commit preview secondary font as the actual selection
  const commitSecondaryPreviewFont = (font: string) => {
    console.log(`[useFontState] Committing secondary preview font: ${font}`);
    stopSecondaryFontPreview(); // Clear preview state
    
    // Handle the font selection logic
    if (font === '--None--') {
      setSecondaryFontEnabled(false);
    } else {
      setSecondaryFontEnabled(true);
      
      // CRITICAL FIX: Intelligently select weight BEFORE setting font family
      // This prevents flash caused by font/weight mismatch
      const availableWeightsForNewFont = actualAvailableFontsList
        .filter(f => f.family === font)
        .map(f => f.style);
      
      console.log(`[useFontState] Available weights for ${font}:`, availableWeightsForNewFont);
      
      // Preserve current secondary weight first, then primary, then Regular, then first available
      let bestWeight: string;
      if (availableWeightsForNewFont.includes(secondarySelectedStyle)) {
        bestWeight = secondarySelectedStyle;
        console.log(`[useFontState] Preserving current secondary weight: ${bestWeight}`);
      } else if (availableWeightsForNewFont.includes(selectedStyle)) {
        bestWeight = selectedStyle;
        console.log(`[useFontState] Using same weight as primary: ${bestWeight}`);
      } else if (availableWeightsForNewFont.includes("Regular")) {
        bestWeight = "Regular";
        console.log(`[useFontState] Falling back to Regular: ${bestWeight}`);
      } else {
        bestWeight = availableWeightsForNewFont[0] || selectedStyle;
        console.log(`[useFontState] Using first available secondary weight: ${bestWeight}`);
      }
      
      // Set font family and weight together (React batches these updates)
      setSecondaryFontFamilyWithRef(font);
      setSecondarySelectedStyle(bestWeight);
      setSecondaryAvailableStyles(availableWeightsForNewFont);
      
      // If user manually selects a different secondary font, automatically unlink BOTH font and weight
      if (secondaryFontLinked) {
        setSecondaryFontLinked(false);
      }
      if (secondaryWeightLinked) {
        setSecondaryWeightLinked(false);
      }
      
      // Still request styles for UI updates (dropdown, etc)
      // But we've already set the correct weight, so no flash!
      emit("GET_STYLES_FOR_FAMILY", font);
    }
  };

  // Helper to get the effective font family (preview takes priority)
  const getEffectiveFontFamily = useCallback(() => previewFontFamily || fontFamily, [previewFontFamily, fontFamily]);
  
  // Helper to get the effective secondary font family (preview takes priority)
  const getEffectiveSecondaryFontFamily = useCallback(() => {
    const result = previewSecondaryFontFamily || secondaryFontFamily;
    console.log(`[useFontState] 🎯 getEffectiveSecondaryFontFamily: preview="${previewSecondaryFontFamily}", committed="${secondaryFontFamily}", returning="${result}"`);
    return result;
  }, [previewSecondaryFontFamily, secondaryFontFamily]);

  // Weight preview functions for primary weight
  const startWeightPreview = (weight: string) => {
    // Clear existing timeout
    if (weightPreviewTimeoutRef.current) {
      clearTimeout(weightPreviewTimeoutRef.current);
    }
    
    // Set new timeout for 25ms debounce (ultra-fast)
    weightPreviewTimeoutRef.current = setTimeout(() => {
      console.log(`[useFontState] Starting weight preview for: ${weight}`);
      setPreviewWeight(weight);
      setIsWeightPreviewMode(true);
      
      // CRITICAL: If secondary weight is linked, also preview secondary with same weight
      if (secondaryFontEnabled && secondaryWeightLinked) {
        console.log(`[useFontState] 🔗 Secondary weight is linked, also previewing secondary weight: ${weight}`);
        setPreviewSecondaryWeight(weight);
        setIsSecondaryWeightPreviewMode(true);
      }
    }, 25);
  };

  // Stop weight preview and revert to committed weight
  const stopWeightPreview = () => {
    // Clear any pending timeout
    if (weightPreviewTimeoutRef.current) {
      clearTimeout(weightPreviewTimeoutRef.current);
      weightPreviewTimeoutRef.current = null;
    }
    
    console.log(`[useFontState] Stopping weight preview, reverting to: ${selectedStyle}`);
    setPreviewWeight(null);
    setIsWeightPreviewMode(false);
    
    // CRITICAL: If secondary weight was being previewed due to linking, also stop secondary preview
    if (isSecondaryWeightPreviewMode && secondaryFontEnabled && secondaryWeightLinked) {
      console.log(`[useFontState] Also stopping linked secondary weight preview`);
      setPreviewSecondaryWeight(null);
      setIsSecondaryWeightPreviewMode(false);
    }
  };

  // Commit preview weight as the actual selection
  const commitPreviewWeight = (weight: string) => {
    console.log(`[useFontState] Committing preview weight: ${weight}`);
    stopWeightPreview(); // Clear preview state
    setSelectedStyle(weight); // Set the committed weight
    
    // If secondary weight is linked, also update secondary
    if (secondaryFontEnabled && secondaryWeightLinked && secondaryAvailableStyles.includes(weight)) {
      setSecondarySelectedStyle(weight);
    }
  };

  // Secondary weight preview functions
  const startSecondaryWeightPreview = (weight: string) => {
    // Clear existing timeout
    if (secondaryWeightPreviewTimeoutRef.current) {
      clearTimeout(secondaryWeightPreviewTimeoutRef.current);
    }
    
    // Set new timeout for 25ms debounce (ultra-fast)
    secondaryWeightPreviewTimeoutRef.current = setTimeout(() => {
      console.log(`[useFontState] Starting secondary weight preview for: ${weight}`);
      setPreviewSecondaryWeight(weight);
      setIsSecondaryWeightPreviewMode(true);
    }, 25);
  };

  // Stop secondary weight preview and revert to committed weight
  const stopSecondaryWeightPreview = () => {
    // Clear any pending timeout
    if (secondaryWeightPreviewTimeoutRef.current) {
      clearTimeout(secondaryWeightPreviewTimeoutRef.current);
      secondaryWeightPreviewTimeoutRef.current = null;
    }
    
    console.log(`[useFontState] Stopping secondary weight preview, reverting to: ${secondarySelectedStyle}`);
    setPreviewSecondaryWeight(null);
    setIsSecondaryWeightPreviewMode(false);
  };

  // Commit preview secondary weight as the actual selection
  const commitSecondaryPreviewWeight = (weight: string) => {
    console.log(`[useFontState] Committing secondary preview weight: ${weight}`);
    stopSecondaryWeightPreview(); // Clear preview state
    setSecondarySelectedStyle(weight); // Set the committed weight
  };

  // Helper to get the effective weight (preview takes priority)
  const getEffectiveWeight = useCallback(() => previewWeight || selectedStyle, [previewWeight, selectedStyle]);
  
  // Helper to get the effective secondary weight (preview takes priority)
  const getEffectiveSecondaryWeight = useCallback(() => previewSecondaryWeight || secondarySelectedStyle, [previewSecondaryWeight, secondarySelectedStyle]);

  return {
    // Primary font state
    fontFamily,
    setFontFamily: setFontFamilyWithLinking, // Use the linking-aware version
    availableFonts,
    selectedStyle,
    setSelectedStyle,
    availableStyles,
    actualAvailableFontsList,
    pendingStyleSelection,
    setPendingStyleSelection,
    
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
    setSecondaryFontFamily: setSecondaryFontFamilyWithRef,
    secondarySelectedStyle,
    setSecondarySelectedStyle,
    secondaryAvailableStyles,
    pendingSecondaryStyleSelection,
    setPendingSecondaryStyleSelection,
    
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
  };
}