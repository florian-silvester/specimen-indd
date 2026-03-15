// src/utils.ts - Utility and helper functions for Typography Curves

import { FontInfo, TypographyStyle } from '../core/types';
import { INTER_REGULAR, SPEC_FONT_SIZE, STYLE_KEYS } from '../core/constants';
import { getCurrentPreviewTheme } from '../core/preview-theme-state';
import { getConventionName } from '../ui/naming-conventions';
import { getInternalKeyForDisplayName } from '../design-systems/base';
import { localHeadline, localBodyTextLarge, localBodyTextMain, localBodyTextSmall, localBodyTextMicro } from '../api/openai-utils';
const DEBUG_UPDATE_SPECS = false;
const debugUpdateSpecs = (...args: unknown[]) => {
  if (DEBUG_UPDATE_SPECS) {
    console.log(...args);
  }
};

// --- Display & Text Helpers ---

export function getDisplayName(styleName: string): string {
  // Ensure consistent case-insensitive matching
  const lowerCaseName = styleName.toLowerCase();
  switch (lowerCaseName) {
    case STYLE_KEYS.DISPLAY.toLowerCase(): return 'H0';
    case STYLE_KEYS.H1.toLowerCase(): return 'H1';
    case STYLE_KEYS.H2.toLowerCase(): return 'H2';
    case STYLE_KEYS.H3.toLowerCase(): return 'H3';
    case STYLE_KEYS.H4.toLowerCase(): return 'H4';
    case STYLE_KEYS.H5.toLowerCase(): return 'H5';
    case STYLE_KEYS.H6.toLowerCase(): return 'H6';
    case STYLE_KEYS.TEXT_MAIN.toLowerCase(): return 'Text Main';
    case STYLE_KEYS.TEXT_LARGE.toLowerCase(): return 'Text Large';
    case STYLE_KEYS.TEXT_SMALL.toLowerCase(): return 'Text Small';
    case STYLE_KEYS.MICRO.toLowerCase(): return 'Text Tiny';
    // Keep a default fallback, but it shouldn't ideally be hit for known keys
    default: return styleName;
  }
}

// NEW: Helper function that uses naming convention if available, falls back to default
export function getDisplayNameWithConvention(styleName: string, namingConvention?: string): string {
  if (namingConvention && namingConvention !== 'Default Naming') {
    const conventionName = getConventionName(styleName, namingConvention);
    if (conventionName) {
      return conventionName;
    }
  }
  // Fallback to default naming
  return getDisplayName(styleName);
}

export function getStyleFolderPrefix(activeMode: 'desktop' | 'mobile'): string {
  return activeMode === 'mobile' ? 'Mobile' : 'Specimen';
}

// NEW: Helper function to convert display names back to internal keys
export function getInternalKeyFromDisplayName(displayName: string, namingConvention: string): string {
  const canonical = getInternalKeyForDisplayName(displayName, namingConvention);
  if (canonical) {
    return canonical;
  }

  // Fallback: try lowercase for basic matching
  const fallback = displayName.toLowerCase().replace(/[\s\-\/]/g, '');
  console.warn(`[getInternalKeyFromDisplayName] No reverse-lookup found for "${displayName}" in ${namingConvention}, using fallback: "${fallback}"`);
  return fallback;
}

// --- REMOVED: Import of global naming convention function (now passed as parameter) ---

export function getExampleText(name: string): string {
    switch (name.toLowerCase()) {
      case STYLE_KEYS.DISPLAY.toLowerCase():
      case STYLE_KEYS.H1.toLowerCase():
      case STYLE_KEYS.H2.toLowerCase():
      case STYLE_KEYS.H3.toLowerCase():
      case STYLE_KEYS.H4.toLowerCase():
      case STYLE_KEYS.H5.toLowerCase():
      case STYLE_KEYS.H6.toLowerCase(): return localHeadline(); // Dynamic headline from content buckets
      case STYLE_KEYS.TEXT_LARGE.toLowerCase(): return localBodyTextLarge(); // Dynamic large text
      case STYLE_KEYS.TEXT_MAIN.toLowerCase(): return localBodyTextMain(); // Dynamic main text
      case STYLE_KEYS.TEXT_SMALL.toLowerCase(): return localBodyTextSmall(); // Dynamic small text
      case STYLE_KEYS.MICRO.toLowerCase(): return localBodyTextMicro(); // Dynamic micro text
      default: return `${getDisplayName(name)} example text`;
    }
}

// --- Figma Node Manipulation Helpers ---

/**
 * Applies style properties (font, size, LH, LS, case) to a Figma TextNode.
 * Includes robust font loading fallbacks.
 * Preserves existing text styles EXCEPT when in live tweaking context.
 * 
 * IMPORTANT: This function HARMONIZES mixed styling (bold, underline, etc.)
 * by overwriting all inline styles and applying uniform formatting across
 * the entire text node. Mixed nodes will be normalized to a single style.
 */
export async function applyTextStyleToNode(
    textNode: TextNode,
    style: TypographyStyle,
    targetFont: FontName,
    availableFontsList: FontInfo[], // Added parameter
    debugIdentifier?: string
): Promise<void> {
    const nodeName = textNode.name || 'Unnamed Node';
    const logPrefix = debugIdentifier ? `[applyTextStyle ${nodeName} (${debugIdentifier})]` : `[applyTextStyle ${nodeName}]`;

    // --- LIVE TWEAKING BYPASS: Allow overriding styled nodes during live tweaking ---
    const isLiveTweakingContext = debugIdentifier && debugIdentifier.startsWith('LiveUpdate-');
    
    if (textNode.textStyleId && textNode.textStyleId !== figma.mixed && typeof textNode.textStyleId === 'string') {
        if (isLiveTweakingContext) {
            console.log(`${logPrefix} 🔥 LIVE TWEAKING: Overriding existing text style (ID: ${textNode.textStyleId}) for real-time feedback`);
            // Continue with applying raw properties for live feedback
        } else {
            console.log(`${logPrefix} ✅ Text style already applied (ID: ${textNode.textStyleId}). Preserving existing style.`);
            return;
        }
    }

    console.log(`${logPrefix} Applying:`, style, `Font: ${targetFont.family} ${targetFont.style}`);

    // --- Font Application & Harmonization ---
    // IMPORTANT: This normalizes any mixed inline styles (bold, underline, etc.)
    // to a single uniform style across the entire text node
    try {
        await figma.loadFontAsync(targetFont);
        const fullLen = textNode.characters.length;
        if (textNode.fontName === figma.mixed) {
            // Harmonize mixed runs (e.g., bold, italic) to a single target font
            try { textNode.setRangeFontName(0, fullLen, targetFont); } catch {}
        } else {
            textNode.fontName = targetFont;
        }
    } catch (e) {
        console.warn(`${logPrefix} Could not apply font for ${targetFont.family} ${targetFont.style}. Error: ${e}.`);
    }

    // --- Size ---
    if (textNode.fontSize === figma.mixed) {
        try { textNode.setRangeFontSize(0, textNode.characters.length, style.size); } catch {}
    } else if (textNode.fontSize !== style.size) {
        textNode.fontSize = style.size;
    }

    // --- Line Height ---
    const targetLH: LineHeight = { unit: 'PERCENT', value: style.lineHeight * 100 };
    if (textNode.lineHeight === figma.mixed) {
        try { textNode.setRangeLineHeight(0, textNode.characters.length, targetLH); } catch {}
    } else {
        const currentLH = textNode.lineHeight as LineHeight;
        if (currentLH.unit !== targetLH.unit || currentLH.value !== targetLH.value) {
            textNode.lineHeight = targetLH;
        }
    }

    // --- Letter Spacing ---
    const targetLS: LetterSpacing = { unit: 'PERCENT', value: style.letterSpacing };
    if (textNode.letterSpacing === figma.mixed) {
        try { textNode.setRangeLetterSpacing(0, textNode.characters.length, targetLS); } catch {}
    } else {
        const currentLS = textNode.letterSpacing as LetterSpacing;
        if (currentLS.unit !== targetLS.unit || currentLS.value !== targetLS.value) {
            textNode.letterSpacing = targetLS;
        }
    }

    // --- Text Case ---
    let targetTextCase: TextCase = 'ORIGINAL';
    switch (style.textCase?.toLowerCase()) { // Use lowerCase comparison
        case 'uppercase': targetTextCase = 'UPPER'; break;
        case 'lowercase': targetTextCase = 'LOWER'; break;
        case 'title case': targetTextCase = 'TITLE'; break;
    }
    if (textNode.textCase === figma.mixed) {
        try { textNode.setRangeTextCase(0, textNode.characters.length, targetTextCase); } catch {}
    } else if (textNode.textCase !== targetTextCase) {
        try { textNode.textCase = targetTextCase; } catch (e) { console.warn(`[applyTextStyle ${nodeName}] Error applying textCase ${targetTextCase}: ${e}`); }
    }
}

/**
 * Updates the label and specs text nodes within a LabelSpecsRow frame.
 */
export async function updateSpecsInRow(labelSpecsRow: FrameNode, styleToUse: TypographyStyle, namingConvention?: string, lineHeightUnit?: 'percent' | 'px', internalKey?: string) {
    // --- DEBUG START ---
    debugUpdateSpecs(`[updateSpecsInRow] Processing: ${labelSpecsRow.name}`);
    // --- DEBUG END ---
    
    // The spec nodes are created using internal keys, so we need to find the original internal key
    // that was used when creating this frame, regardless of current naming convention
    const displayName: string = labelSpecsRow.name.replace('LabelSpecs - ', '');
    
    debugUpdateSpecs(`[updateSpecsInRow] 🔍 DEBUG - Display name from frame: "${displayName}"`);
    
    // Look for spec nodes using the current display name (how they're actually named)
    let foundInternalKey: string | undefined = internalKey; // Use the passed internal key
    let styleLabel: TextNode | undefined;
    let sizeSpecNode: TextNode | undefined;
    let lineHeightSpecNode: TextNode | undefined;
    let letterSpacingSpecNode: TextNode | undefined;
    
    // First try with the display name (how spec nodes are actually named)
    sizeSpecNode = labelSpecsRow.children.find(n => n.name === `Size Spec - ${displayName}`) as TextNode | undefined;
    lineHeightSpecNode = labelSpecsRow.children.find(n => n.name === `LineHeight Spec - ${displayName}`) as TextNode | undefined;
    letterSpacingSpecNode = labelSpecsRow.children.find(n => n.name === `LetterSpacing Spec - ${displayName}`) as TextNode | undefined;
    styleLabel = labelSpecsRow.children.find(n => n.name === `Style Label`) as TextNode | undefined;
    
    if (sizeSpecNode && lineHeightSpecNode && letterSpacingSpecNode) {
        debugUpdateSpecs(`[updateSpecsInRow] 🔍 Found spec nodes using display name: "${displayName}"`);
    } else {
        // Fallback: try with all internal keys (for backwards compatibility)
        debugUpdateSpecs(`[updateSpecsInRow] 🔄 Trying fallback search with internal keys...`);
        const allInternalKeys = Object.values(STYLE_KEYS);
                 for (const testInternalKey of allInternalKeys) {
             const testSizeSpec = labelSpecsRow.children.find(n => n.name === `Size Spec - ${testInternalKey}`) as TextNode | undefined;
             if (testSizeSpec) {
                 foundInternalKey = testInternalKey;
                 sizeSpecNode = testSizeSpec;
                 lineHeightSpecNode = labelSpecsRow.children.find(n => n.name === `LineHeight Spec - ${testInternalKey}`) as TextNode | undefined;
                 letterSpacingSpecNode = labelSpecsRow.children.find(n => n.name === `LetterSpacing Spec - ${testInternalKey}`) as TextNode | undefined;
                 styleLabel = labelSpecsRow.children.find(n => n.name === `Style Label`) as TextNode | undefined;
                 debugUpdateSpecs(`[updateSpecsInRow] 🔍 Found spec nodes using internal key: "${testInternalKey}"`);
                 break;
             }
         }
    }
    
    if (!sizeSpecNode || !lineHeightSpecNode || !letterSpacingSpecNode || !styleLabel) {
        console.warn(`[updateSpecsInRow] ⚠️ Could not find spec nodes for frame: ${labelSpecsRow.name}`);
        return;
    }

    // --- DEBUG START ---
    console.log(`  > Found styleLabel: ${!!styleLabel}, sizeSpecNode: ${!!sizeSpecNode}, lineHeightSpecNode: ${!!lineHeightSpecNode}, letterSpacingSpecNode: ${!!letterSpacingSpecNode}`);
    // --- DEBUG END ---

    // All nodes were found (validated above), proceed with updates
    // Update Style Label Text - prioritize customName, then naming convention
    let expectedDisplayName: string;
    if (styleToUse.customName) {
        expectedDisplayName = styleToUse.customName;
        debugUpdateSpecs(`[updateSpecsInRow] 🎯 Using custom name: "${expectedDisplayName}"`);
    } else {
        expectedDisplayName = getDisplayNameWithConvention(foundInternalKey as string, namingConvention || 'Default Naming');
        debugUpdateSpecs(`[updateSpecsInRow] 🏷️ Using convention name: "${expectedDisplayName}"`);
    }
    
        if (styleLabel.characters !== expectedDisplayName) {
            try { await figma.loadFontAsync(styleLabel.fontName as FontName); } catch {}
            styleLabel.characters = expectedDisplayName;
        debugUpdateSpecs(`[updateSpecsInRow] ✅ Updated Style Label: "${expectedDisplayName}"`);
        }

        // Calculate individual spec strings
        const roundedSize = Math.round(styleToUse.size * 2) / 2;
        const sizeString = `${roundedSize}px`;
        
        // Line height calculation based on unit preference
        let lineHeightString: string;
        if (lineHeightUnit === 'px') {
            const lineHeightInPx = Math.round(styleToUse.lineHeight * styleToUse.size);
            lineHeightString = `${lineHeightInPx}px`;
        } else {
            lineHeightString = `${Math.round(styleToUse.lineHeight * 100)}%`;
        }
        
        const lsValue = styleToUse.letterSpacing;
        // Round to 0.25 steps and trim decimals consistently
        const lsRounded = Math.round((lsValue ?? 0) / 0.25) * 0.25;
        const quarterSteps = Math.round(lsRounded / 0.25);
        const lsString = `${quarterSteps % 4 === 0 ? lsRounded.toFixed(0) : quarterSteps % 2 === 0 ? lsRounded.toFixed(1) : lsRounded.toFixed(2)}%`;

        // --- DEBUG START ---
        console.log(`  > Calculated Specs: Size=${sizeString}, LH=${lineHeightString}, LS=${lsString}`);
        // --- DEBUG END ---

        // Update Size
        if (sizeSpecNode.characters !== sizeString) {
            // --- DEBUG START ---
            console.log(`  > Updating Size Spec from '${sizeSpecNode.characters}' to '${sizeString}'`);
            // --- DEBUG END ---
            try { await figma.loadFontAsync(sizeSpecNode.fontName as FontName); } catch {}
            sizeSpecNode.characters = sizeString;
        } else {
             // --- DEBUG START ---
             console.log(`  > Size Spec already up-to-date ('${sizeString}')`);
             // --- DEBUG END ---
        }
        // Update Line Height
        if (lineHeightSpecNode.characters !== lineHeightString) {
             // --- DEBUG START ---
             console.log(`  > Updating LH Spec from '${lineHeightSpecNode.characters}' to '${lineHeightString}'`);
             // --- DEBUG END ---
            try { await figma.loadFontAsync(lineHeightSpecNode.fontName as FontName); } catch {}
            lineHeightSpecNode.characters = lineHeightString;
        } else {
             // --- DEBUG START ---
             console.log(`  > LH Spec already up-to-date ('${lineHeightString}')`);
             // --- DEBUG END ---
        }
        // Update Letter Spacing
        if (letterSpacingSpecNode.characters !== lsString) {
             // --- DEBUG START ---
             console.log(`  > Updating LS Spec from '${letterSpacingSpecNode.characters}' to '${lsString}'`);
             // --- DEBUG END ---
            try { await figma.loadFontAsync(letterSpacingSpecNode.fontName as FontName); } catch {}
            letterSpacingSpecNode.characters = lsString;
        } else {
             // --- DEBUG START ---
             console.log(`  > LS Spec already up-to-date ('${lsString}')`);
             // --- DEBUG END ---
        }

        const SPEC_NODE_WIDTH = 40;
        sizeSpecNode.resize(SPEC_NODE_WIDTH, sizeSpecNode.height);
        lineHeightSpecNode.resize(SPEC_NODE_WIDTH, lineHeightSpecNode.height);
        letterSpacingSpecNode.resize(SPEC_NODE_WIDTH, letterSpacingSpecNode.height);

        // Ensure common properties (Font, Size, Color) for all label/spec nodes
        const nodesToEnsure = [styleLabel, sizeSpecNode, lineHeightSpecNode, letterSpacingSpecNode];
        for (const node of nodesToEnsure) {
            if (!node) continue;
            try { await figma.loadFontAsync(INTER_REGULAR); } catch (e) { console.warn("Failed to load Inter Regular for spec labels"); }
            if (node.fontName !== INTER_REGULAR && JSON.stringify(node.fontName) !== JSON.stringify(INTER_REGULAR)) node.fontName = INTER_REGULAR;
            // Try setting tabular figures again during update, although it might not have visual effect
            // try {
            //     node.setSharedPluginData("figma", "fontVariantNumeric", "TABULAR");
            // } catch(e) {}

            const specTheme = getCurrentPreviewTheme();
            const targetFill: SolidPaint = { type: 'SOLID', color: specTheme.specColor, opacity: specTheme.specColorOpacity };
            const currentFill = Array.isArray(node.fills) ? node.fills[0] : node.fills;
            if (node.fills === figma.mixed || JSON.stringify(currentFill) !== JSON.stringify(targetFill)) {
                 node.fills = [targetFill];
            }
            if (node.fontSize !== SPEC_FONT_SIZE) node.fontSize = SPEC_FONT_SIZE;
            if (node.leadingTrim !== 'CAP_HEIGHT') node.leadingTrim = 'CAP_HEIGHT';
    }
}

// --- Font Handling Helpers ---

/**
 * Checks if a specific font style is available for a family, falling back to
 * 'Regular', then the first available style, then finally defaulting to 'Regular'.
 */
export function getValidFont(family: string, style: string, availableFontsList: FontInfo[]): FontName { // Added parameter
    const isStyleValid = availableFontsList.some(font => font.family === family && font.style === style);
    if (isStyleValid) {
        console.log(`[getValidFont] Style '${style}' for family '${family}' is valid. Returning:`, { family, style });
        return { family, style };
    }

    console.log(`[getValidFont] Style '${style}' not valid for family '${family}'. Checking fallbacks...`);
    const isRegularValid = availableFontsList.some(font => font.family === family && font.style === 'Regular');
    if (isRegularValid) {
        console.log(`[getValidFont]  -> 'Regular' is valid. Returning:`, { family, style: 'Regular' });
        return { family, style: 'Regular' };
    }

    const firstAvailable = availableFontsList.find(font => font.family === family)?.style;
    if (firstAvailable) {
        console.log(`[getValidFont]  -> Using first available style: '${firstAvailable}'. Returning:`, { family, style: firstAvailable });
        return { family, style: firstAvailable };
    }

    console.warn(`[getValidFont]  -> No styles found for family '${family}'! Defaulting to 'Regular'. Returning:`, { family, style: 'Regular' });
    return { family, style: 'Regular' }; // Final fallback within this helper
}

// ADD extractStyleFromTextNode HERE
export async function extractStyleFromTextNode(node: TextNode, availableFontsList: FontInfo[]): Promise<TypographyStyle | null> {
  if (node.fontName === figma.mixed || node.fontSize === figma.mixed || node.lineHeight === figma.mixed || node.letterSpacing === figma.mixed) {
    console.warn(`[utils.extractStyle] Mixed properties for node ${node.name}. Skipping.`);
    return null;
  }

  const fontNameObj = node.fontName as FontName;
  const font = await getValidFont(fontNameObj.family, fontNameObj.style, availableFontsList); // Pass availableFontsList
  if (!font) {
    console.warn(`[utils.extractStyle] Could not load/validate font for node ${node.name}:`, node.fontName);
    return null;
  }
  // It's good practice to ensure font is loaded before accessing properties that might depend on it,
  // although getValidFont might imply it's loadable. LoadAsync is safe.
  try {
    await figma.loadFontAsync(font);
  } catch (e) {
    console.warn(`[utils.extractStyle] Error loading font ${font.family}-${font.style} for node ${node.name}: ${e}`);
    return null; // Cannot proceed if font doesn't load
  }

  const fontSize = typeof node.fontSize === 'number' ? node.fontSize : 0;
  
  let lineHeightMultiplier = 1.2; // Default
  if (typeof node.lineHeight === 'object' && node.lineHeight.unit !== 'AUTO') {
    if (node.lineHeight.unit === 'PERCENT') {
      lineHeightMultiplier = (node.lineHeight.value || 120) / 100;
    } else if (node.lineHeight.unit === 'PIXELS') {
      lineHeightMultiplier = fontSize > 0 ? (node.lineHeight.value || fontSize * 1.2) / fontSize : 1.2;
    }
  }

  let letterSpacingPercent = 0; // Default
  if (typeof node.letterSpacing === 'object') {
    if (node.letterSpacing.unit === 'PERCENT') {
      letterSpacingPercent = node.letterSpacing.value || 0;
    } else if (node.letterSpacing.unit === 'PIXELS') {
      letterSpacingPercent = fontSize > 0 ? (node.letterSpacing.value / fontSize) * 100 : 0;
    }
  }

  // Text case detection
  let textCase: string = 'Original';
  if (node.textCase !== figma.mixed) {
    switch (node.textCase) {
      case 'UPPER':
        textCase = 'Uppercase';
        break;
      case 'LOWER':
        textCase = 'Lowercase';
        break;
      case 'TITLE':
        textCase = 'Title Case';
        break;
      // 'ORIGINAL' is the default
    }
  }

  return {
    size: fontSize,
    lineHeight: lineHeightMultiplier,
    letterSpacing: letterSpacingPercent,
    fontFamily: font.family,
    fontStyle: font.style,
    textCase: textCase, // Use detected text case
  };
}

/**
 * Sorts an array of font style names numerically (100-900),
 * then alphabetically for non-numeric styles, placing italics after non-italics of the same weight.
 */
export function sortFontStylesNumerically(styles: string[]): string[] {
    const weightMap: { [key: string]: number } = {
        thin: 100, hairline: 100,
        'extra light': 200, 'ultra light': 200,
        light: 300,
        regular: 400, normal: 400,
        medium: 500,
        'semi bold': 600, 'demi bold': 600,
        bold: 700,
        'extra bold': 800, 'ultra bold': 800,
        black: 900, heavy: 900,
    };

    const getWeight = (style: string): { weight: number, isItalic: boolean } => {
        const lowerStyle = style.toLowerCase().trim();
        let isItalic = lowerStyle.includes('italic');
        let baseStyleName = lowerStyle.replace(/ italic$/, '').trim();

        if (weightMap[baseStyleName]) {
            return { weight: weightMap[baseStyleName], isItalic };
        }
        const num = parseInt(baseStyleName, 10);
        if (!isNaN(num) && num >= 100 && num <= 900) {
            return { weight: num, isItalic };
        }
        if (baseStyleName === 'italic' && isItalic) {
            return { weight: 400, isItalic: true }; // Standalone italic treated as 400 italic
        }
        // Default for non-numeric/unmapped styles (e.g., Condensed, Extended)
        return { weight: 1000 + (isItalic ? 1 : 0), isItalic }; // Place after numeric weights, non-italic first
    };

    return styles.sort((a, b) => {
        const infoA = getWeight(a);
        const infoB = getWeight(b);

        if (infoA.weight !== infoB.weight) {
            return infoA.weight - infoB.weight;
        }
        // Weights are the same, sort non-italic before italic only if weights are <= 900 (numeric)
        // For non-numeric (weight 1000+), italic already factored into weight sort
        if (infoA.weight <= 900 && infoA.isItalic !== infoB.isItalic) {
            return infoA.isItalic ? 1 : -1;
        }
        // Final tie-breaker: alphabetical
        return a.localeCompare(b);
    });
}

/**
 * Renames nodes to match the current naming convention.
 * This ensures that node names are consistent when users switch naming conventions.
 * 
 * @param itemContainer - The item container frame to rename (and its children)
 * @param internalKey - The internal style key (e.g., "display", "h1") 
 * @param newNamingConvention - The target naming convention
 */
export async function renameNodesForConvention(
    itemContainer: FrameNode, 
    internalKey: string, 
    newNamingConvention: string
): Promise<void> {
    console.log(`[renameNodes] 🚀 CALLED: renaming "${itemContainer.name}" for internal key "${internalKey}" to convention "${newNamingConvention}"`);
    
    const newDisplayName = getDisplayNameWithConvention(internalKey, newNamingConvention);
    const oldName = itemContainer.name;
    
    // 1. Rename the item container itself: "Item - display" -> "Item - H0"
    const newItemName = `Item - ${newDisplayName}`;
    if (itemContainer.name !== newItemName) {
        itemContainer.name = newItemName;
        console.log(`[renameNodes] 🏷️ Renamed item container: "${oldName}" -> "${newItemName}"`);
    }
    
    // 2. Rename child nodes
    for (const child of itemContainer.children) {
        try {
            // Rename Example Text nodes: "Example Text - display" -> "Example Text - H0"
            if (child.name.startsWith('Example Text -')) {
                const newExampleTextName = `Example Text - ${newDisplayName}`;
                if (child.name !== newExampleTextName) {
                    child.name = newExampleTextName;
                    console.log(`[renameNodes] 🏷️ Renamed example text: "${child.name}" -> "${newExampleTextName}"`);
                }
            }
            
            // Rename LabelSpecs frames: "LabelSpecs - display" -> "LabelSpecs - H0"
            else if (child.name.startsWith('LabelSpecs -')) {
                const newLabelSpecsName = `LabelSpecs - ${newDisplayName}`;
                if (child.name !== newLabelSpecsName) {
                    child.name = newLabelSpecsName;
                    console.log(`[renameNodes] 🏷️ Renamed label specs: "${child.name}" -> "${newLabelSpecsName}"`);
                    
                    // Update Style Label and Spec Nodes inside the LabelSpecs frame
                    if (child.type === 'FRAME') {
                        const styleLabel = child.children.find(n => n.name === 'Style Label') as TextNode | undefined;
                        if (styleLabel) {
                            try {
                                await figma.loadFontAsync(styleLabel.fontName as FontName);
                                styleLabel.characters = newDisplayName;
                                console.log(`[renameNodes] 🏷️ Updated style label text: "${newDisplayName}"`);
                            } catch (e) {
                                console.warn(`[renameNodes] Failed to update style label text: ${e}`);
                            }
                        }
                        
                        // 🔧 FIX: Rename spec nodes to show correct naming convention
                        for (const specChild of child.children) {
                            if (specChild.name.startsWith('Size Spec -')) {
                                const oldSpecName = specChild.name;
                                const newSpecName = `Size Spec - ${newDisplayName}`;
                                if (oldSpecName !== newSpecName) {
                                    specChild.name = newSpecName;
                                    console.log(`[renameNodes] 🏷️ Renamed spec node: "${oldSpecName}" -> "${newSpecName}"`);
                                }
                            } else if (specChild.name.startsWith('LineHeight Spec -')) {
                                const oldSpecName = specChild.name;
                                const newSpecName = `LineHeight Spec - ${newDisplayName}`;
                                if (oldSpecName !== newSpecName) {
                                    specChild.name = newSpecName;
                                    console.log(`[renameNodes] 🏷️ Renamed spec node: "${oldSpecName}" -> "${newSpecName}"`);
                                }
                            } else if (specChild.name.startsWith('LetterSpacing Spec -')) {
                                const oldSpecName = specChild.name;
                                const newSpecName = `LetterSpacing Spec - ${newDisplayName}`;
                                if (oldSpecName !== newSpecName) {
                                    specChild.name = newSpecName;
                                    console.log(`[renameNodes] 🏷️ Renamed spec node: "${oldSpecName}" -> "${newSpecName}"`);
                                }
                            }
                        }
                    }
                }
            }
            
        } catch (error) {
            console.warn(`[renameNodes] Error renaming child node "${child.name}": ${error}`);
        }
    }
} 