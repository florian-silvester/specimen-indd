// src/preview-layouts/layout-utils.ts
// Shared utility functions for creating preview layout elements

import { FontInfo, TypographyStyle } from '../../core/types';
import { SPEC_FONT_SIZE, INTER_REGULAR, FIGMA_NODE_NAMES, STYLE_KEYS } from '../../core/constants';
import { getCurrentPreviewTheme } from '../../core/preview-theme-state';
import { getDisplayName, getDisplayNameWithConvention, applyTextStyleToNode } from '../../services/utils';

/**
 * Creates a standard item container (for a single text style) used in previews.
 * Includes the example text node and an optional label/specs row.
 */
export async function createStyleItem(
    name: string,
    style: TypographyStyle,
    exampleString: string,
    targetFamily: string,
    targetStyle: string,
    showLabels: boolean,
    textColor: RGB, // Changed from optional customTextColor
    availableFontsList: FontInfo[], // Added parameter
    currentColorMode: 'light' | 'dark', // ADDED currentColorMode
    namingConvention = 'Default Naming', // ADDED: For proper naming convention support
    lineHeightUnit: 'percent' | 'px' = 'percent' // ADDED: Line height unit for specs
): Promise<FrameNode> {

    const theme = getCurrentPreviewTheme();

    // *** OPTIMIZATION: Load spec font ONCE ***
    let interRegularLoaded = false;
    try {
        await figma.loadFontAsync(INTER_REGULAR);
        interRegularLoaded = true;
    } catch (e) {
        console.warn("Failed loading INTER_REGULAR for createStyleItem");
    }
    // *** END OPTIMIZATION ***

    const itemContainer = figma.createFrame();
    const displayName = getDisplayNameWithConvention(name, namingConvention || 'Default Naming');
    itemContainer.name = FIGMA_NODE_NAMES.ITEM_CONTAINER(displayName);
    itemContainer.layoutMode = 'VERTICAL';
    itemContainer.itemSpacing = 24; // Changed from 16px to 24px
    itemContainer.fills = [];
    itemContainer.primaryAxisSizingMode = 'AUTO'; // Hug Height for all

    // --- Example Text Node ---
    const exampleText = figma.createText();
    exampleText.name = FIGMA_NODE_NAMES.EXAMPLE_TEXT(displayName);

    // Universal settings for exampleText: size itself by content, align to start.
    exampleText.textAutoResize = 'WIDTH_AND_HEIGHT';
    exampleText.layoutAlign = 'INHERIT'; // CORRECTED: Use INHERIT for textAutoResize=WIDTH_AND_HEIGHT

    // Configure itemContainer based on style type
    if (name === STYLE_KEYS.DISPLAY || name === STYLE_KEYS.TEXT_LARGE) {
        itemContainer.counterAxisSizingMode = 'AUTO'; // Hug Width of exampleText
        if (name === STYLE_KEYS.DISPLAY) {
            itemContainer.minWidth = 624; // Specific minWidth for display's container
        } else if (name === STYLE_KEYS.TEXT_LARGE) {
            itemContainer.minWidth = 624; // <<< FULFILLING REQUEST: minWidth for Item - textLarge (itemContainer)
        }
        // For textLarge, itemContainer will hug the exampleText, which has a maxWidth
    } else { // For h1-h6, textMain, textSmall, micro
        itemContainer.counterAxisSizingMode = 'FIXED';
        itemContainer.layoutAlign = 'STRETCH'; // These containers fill their parent column
    }

    itemContainer.clipsContent = false;

    const fontNameToApply: FontName = { family: targetFamily, style: targetStyle };

    // Apply text style using the utility function, passing availableFontsList
    await applyTextStyleToNode(exampleText, style, fontNameToApply, availableFontsList);

    // <<< ADDED LOG >>>
    console.log(`[createStyleItem] Setting text for role/name: ${name}. Received exampleString (first 50 chars): "${exampleString.substring(0,50)}..."}`);
    exampleText.characters = exampleString;
    exampleText.fills = [{ type: 'SOLID', color: textColor }]; // Use the passed textColor
    exampleText.leadingTrim = 'CAP_HEIGHT';
    // exampleText.layoutAlign and exampleText.textAutoResize are set above based on 'name'
    // 🔄 OPTIMIZATION: Example text will be appended AFTER label specs row

    // --- Label and Specs Row --- (Always created, opacity controlled by showLabels)
    // 🔄 MOVED: Label specs row now comes FIRST, then example text
    const labelSpecsRow = figma.createFrame();
        labelSpecsRow.name = FIGMA_NODE_NAMES.LABEL_SPECS_ROW(displayName);
      labelSpecsRow.layoutMode = 'HORIZONTAL';
  labelSpecsRow.primaryAxisSizingMode = 'FIXED';
  labelSpecsRow.counterAxisSizingMode = 'FIXED';
  labelSpecsRow.resize(itemContainer.width, 16); // Fixed height of 16px
  labelSpecsRow.layoutAlign = 'STRETCH';
    labelSpecsRow.itemSpacing = 4; // MODIFICATION: Add gap between label elements
    labelSpecsRow.fills = [];
    labelSpecsRow.opacity = showLabels ? 1 : 0;
    labelSpecsRow.clipsContent = false;

    // ADDED padding and border
    labelSpecsRow.paddingBottom = 4; // 4px bottom padding
    labelSpecsRow.strokes = [{
        type: 'SOLID', 
        color: theme.specBorderColor, 
        opacity: theme.specBorderOpacity 
    }]; 
    labelSpecsRow.strokeWeight = 0; 
    labelSpecsRow.strokeBottomWeight = 1; 

    itemContainer.appendChild(labelSpecsRow);

    // Style Label (Left part, grows)
    const styleLabel = figma.createText();
        styleLabel.name = "Style Label"; // Keep simple for the style label itself
        styleLabel.fontName = INTER_REGULAR;
    styleLabel.characters = getDisplayNameWithConvention(name, namingConvention || 'Default Naming');
    console.log(`[createStyleItem] Setting label for ${name} with convention ${namingConvention || 'Default Naming'}: ${styleLabel.characters}`);
    styleLabel.fontSize = SPEC_FONT_SIZE;
    styleLabel.fills = [{ type: 'SOLID', color: theme.specColor, opacity: theme.specColorOpacity }];
    styleLabel.layoutGrow = 1;
    styleLabel.leadingTrim = 'CAP_HEIGHT';
    styleLabel.textAutoResize = 'HEIGHT';
    styleLabel.layoutAlign = 'STRETCH';
    labelSpecsRow.appendChild(styleLabel);

    // --- MODIFICATION START: Create separate spec nodes ---
    // Helper function to create a single spec node
    const createSpecNode = async (specName: string, value: string, width: number): Promise<TextNode> => {
        const node = figma.createText();
            // 🔧 FIX: Use display name instead of internal key for spec node names
            node.name = `${specName} Spec - ${displayName}`;
        if (interRegularLoaded) { // Use pre-loaded font
            node.fontName = INTER_REGULAR;
        } // Else: keep default font
        node.characters = value;
        node.fontSize = SPEC_FONT_SIZE;
        node.fills = [{ type: 'SOLID', color: theme.specColor, opacity: theme.specColorOpacity }];
        node.textAlignHorizontal = 'RIGHT';
        node.leadingTrim = 'CAP_HEIGHT';
        node.textAutoResize = 'HEIGHT'; // Resize height automatically
        node.layoutAlign = 'INHERIT'; // Updated: Use INHERIT instead of deprecated MIN
        node.layoutGrow = 0;
        node.resize(width, node.height); // Set fixed width

        return node;
    };

    // Calculate spec values
    const roundedSize = Math.round(style.size * 2) / 2;
    const sizeString = `${roundedSize}px`;
    
    // Line height calculation based on unit preference
    let lineHeightString: string;
    if (lineHeightUnit === 'px') {
        const lineHeightInPx = Math.round(style.lineHeight * style.size);
        lineHeightString = `${lineHeightInPx}px`;
    } else {
        lineHeightString = `${Math.round(style.lineHeight * 100)}%`;
    }
    
    const lsValue = style.letterSpacing;
    const inv = 1.0 / 0.25;
    const roundedLsValue = Math.round(lsValue * inv) / inv;
    const quarterSteps = Math.round(roundedLsValue / 0.25);
    const lsString = `${quarterSteps % 4 === 0 ? roundedLsValue.toFixed(0) : quarterSteps % 2 === 0 ? roundedLsValue.toFixed(1) : roundedLsValue.toFixed(2)}%`;

    // Define widths (adjust as needed)
    const sizeWidth = 40;
    const lineHeightWidth = 40;
    const letterSpacingWidth = 40;

    // Create and append nodes
    const sizeSpecNode = await createSpecNode("Size", sizeString, sizeWidth);
    const lineHeightSpecNode = await createSpecNode("LineHeight", lineHeightString, lineHeightWidth);
    const letterSpacingSpecNode = await createSpecNode("LetterSpacing", lsString, letterSpacingWidth);

    labelSpecsRow.appendChild(sizeSpecNode);
    labelSpecsRow.appendChild(lineHeightSpecNode);
    labelSpecsRow.appendChild(letterSpacingSpecNode);
    // --- MODIFICATION END ---

    // 🔄 OPTIMIZATION: Append example text AFTER label specs (swapped order)
    itemContainer.appendChild(exampleText);

    return itemContainer;
} 