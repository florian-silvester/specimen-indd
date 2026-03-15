import {
    FontInfo,
    PreviewLayout,
    PreviewLayoutHandlerParams,
    PreviewLayoutType,
    PreviewTextAlignMode,
    TypographyStyle,
    TypographySystem,
    PreviewCreateResult
} from '../../core/types';
import {
    FRAME_CORNER_RADIUS,
    INTER_REGULAR,
    NUMBERS_SET,
    UPPERCASE_SET,
    LOWERCASE_SET,
    SPECIAL_SET,
    LAYOUT_BASE_NAMES,
    SPEC_FONT_SIZE,
    TYPOGRAPHY_SCALE_POINTS,
    TYPOGRAPHY_SCALE_ORDER,
    STYLE_KEYS,
    FIGMA_NODE_NAMES,
} from '../../core/constants';
import { getExampleText, getValidFont, applyTextStyleToNode, updateSpecsInRow, getDisplayNameWithConvention, renameNodesForConvention } from '../../services/utils';
import { createStyleItem } from './layout-utils';
import { getCurrentPreviewTheme } from '../../core/preview-theme-state';

// Constants from original createSpecimenCompactPreviewFrame
const BASE_CHARACTER_MULTIPLIER = 27;
const LINE_LENGTH_ADJUSTMENT_FACTOR = 0.2;

// Constants from original _updateSpecimenCompactLayout (within preview-updater.ts)
const UPDATER_BASE_CHARACTER_MULTIPLIER = 27;
const UPDATER_LINE_LENGTH_ADJUSTMENT_FACTOR = 0.2;
const TEXT_MAX_WIDTH_MULTIPLIER = 1.0625;
const TEXT_MAX_WIDTH_MIN = 213;
const TEXT_MAX_WIDTH_MAX = 850;
const CHARACTER_SET_FIXED_LINE_HEIGHT = 1.3;
const CHARACTER_SET_FIXED_LETTER_SPACING = 3;
const DECORATIVE_AA_FIXED_LETTER_SPACING = -1.5;
const DEBUG_PREVIEW_LAYOUT = false;
const logDebug = (...args: unknown[]) => {
    if (DEBUG_PREVIEW_LAYOUT) {
        console.log(...args);
    }
};

const getHeadingItemCounterAxisAlignment = (previewTextAlign?: PreviewTextAlignMode): AutoLayoutMixin['counterAxisAlignItems'] => {
    if (previewTextAlign === 'center') return 'CENTER';
    if (previewTextAlign === 'right') return 'MAX';
    return 'MIN';
};

const getHeadingTextAlignment = (previewTextAlign?: PreviewTextAlignMode): 'LEFT' | 'CENTER' | 'RIGHT' => {
    if (previewTextAlign === 'center') return 'CENTER';
    if (previewTextAlign === 'right') return 'RIGHT';
    return 'LEFT';
};

const formatFontSpecLabel = (fontFamily: string, fontStyle?: string) => {
    const safeStyle = (fontStyle || 'Regular').trim();
    return `${fontFamily} ${safeStyle}`.trim();
};

// Helper function to apply layout grid to item containers
const applyLayoutGridToItem = (itemContainer: FrameNode, showGrid: boolean, gridSize: number) => {
    if (!showGrid || gridSize === 0) {
        itemContainer.layoutGrids = [];
        return;
    }

    // Apply Figma ROWS grid based on user's exact specs from screenshot
    // Type: Bottom, Height: 4px, Count: Auto, Offset: 0, Gutter: 0
    itemContainer.layoutGrids = [{
        pattern: 'ROWS' as const,
        alignment: 'MAX' as const, // "Bottom" in the UI
        gutterSize: 0, // Gutter spacing between rows
        offset: 0, // Distance from edges
        count: Infinity, // "Auto" in the UI
        sectionSize: gridSize, // Height of each row (2px or 4px)
        visible: true,
        color: { r: 1, g: 0, b: 0, a: 0.1 } // Red color with 10% opacity like in screenshot
    }];
};

// Helper function to find largest visible style overall (both headings and text)
const getLargestVisibleStyle = (typeSystem: TypographySystem, styleVisibility?: { [key: string]: boolean }) => {
    // Check all styles ordered largest to smallest: display, h1, h2, h3, h4, h5, h6, textLarge, textMain, textSmall, micro
    const allStylesOrderedBySize = [
        ...TYPOGRAPHY_SCALE_ORDER.HEADINGS,
        ...TYPOGRAPHY_SCALE_ORDER.TEXT_STYLES
    ];
    
    for (const styleKey of allStylesOrderedBySize) {
        const style = typeSystem[styleKey as keyof TypographySystem];
        const isVisible = !styleVisibility || styleVisibility[styleKey] !== false;
        if (style && isVisible) {
            return { key: styleKey, style };
        }
    }
    // Fallback to display if no styles are visible
    return { key: STYLE_KEYS.DISPLAY, style: typeSystem[STYLE_KEYS.DISPLAY] };
};

// Helper function to find largest visible heading style (kept for backward compatibility if needed)
const getLargestVisibleHeadingStyle = (typeSystem: TypographySystem, styleVisibility?: { [key: string]: boolean }) => {
    // Headings are ordered largest to smallest: display, h1, h2, h3, h4, h5, h6
    for (const headingKey of TYPOGRAPHY_SCALE_ORDER.HEADINGS) {
        const style = typeSystem[headingKey as keyof TypographySystem];
        const isVisible = !styleVisibility || styleVisibility[headingKey] !== false;
        if (style && isVisible) {
            return { key: headingKey, style };
        }
    }
    // Fallback to display if no headings are visible
    return { key: STYLE_KEYS.DISPLAY, style: typeSystem[STYLE_KEYS.DISPLAY] };
};

// Helper function to find largest visible text style (kept for backward compatibility if needed)
const getLargestVisibleTextStyle = (typeSystem: TypographySystem, styleVisibility?: { [key: string]: boolean }) => {
    // Text styles are ordered largest to smallest: textLarge, textMain, textSmall, micro
    for (const textKey of TYPOGRAPHY_SCALE_ORDER.TEXT_STYLES) {
        const style = typeSystem[textKey as keyof TypographySystem];
        const isVisible = !styleVisibility || styleVisibility[textKey] !== false;
        if (style && isVisible) {
            return { key: textKey, style };
        }
    }
    // Fallback to textMain if no text styles are visible
    return { key: STYLE_KEYS.TEXT_MAIN, style: typeSystem[STYLE_KEYS.TEXT_MAIN] };
};

const ensureFamilySpecNode = async (labelSpecsRow: FrameNode, familyName: string) => {
    let familyNode = labelSpecsRow.children.find(n => n.name === "Family") as TextNode | undefined;
    if (!familyNode) {
        familyNode = figma.createText();
        familyNode.name = "Family";
        try { await figma.loadFontAsync(INTER_REGULAR); } catch (e) { console.warn('[SpecimenCompactLayout] Failed to load Inter for Family node', e); }
        familyNode.fontName = INTER_REGULAR;
        familyNode.fontSize = SPEC_FONT_SIZE;
        const specTheme = getCurrentPreviewTheme();
        familyNode.fills = [{ type: 'SOLID', color: specTheme.specColor, opacity: specTheme.specColorOpacity }];
        familyNode.leadingTrim = 'CAP_HEIGHT';
        familyNode.textAutoResize = 'WIDTH_AND_HEIGHT';
        familyNode.layoutAlign = 'INHERIT';
        familyNode.layoutGrow = 0;
        
        const styleLabelIndex = labelSpecsRow.children.findIndex(n => n.name === 'Style Label');
        const insertIndex = styleLabelIndex >= 0 ? styleLabelIndex + 1 : labelSpecsRow.children.length;
        labelSpecsRow.insertChild(insertIndex, familyNode);
    }
    if (familyNode.characters !== familyName) {
        try { await figma.loadFontAsync(familyNode.fontName as FontName); } catch {}
        familyNode.characters = familyName;
    }
};

const configureStyleLabelForFamily = async (styleLabel: TextNode | undefined, labelText: string) => {
    if (!styleLabel) return;
    try { await figma.loadFontAsync(styleLabel.fontName as FontName); } catch {}
    styleLabel.characters = labelText;
    styleLabel.layoutGrow = 1;
    styleLabel.layoutAlign = 'STRETCH';
    styleLabel.textAutoResize = 'HEIGHT';
    styleLabel.leadingTrim = 'CAP_HEIGHT';
};

const createHeaderTextNode = async (
    name: string,
    characters: string,
    color: RGB,
    options?: {
        fixedWidth?: number;
        grow?: boolean;
        align?: 'LEFT' | 'RIGHT';
        autoWidth?: boolean;
        opacity?: number;
    }
): Promise<TextNode> => {
    const node = figma.createText();
    node.name = name;
    try { await figma.loadFontAsync(INTER_REGULAR); } catch {}
    node.fontName = INTER_REGULAR;
    node.characters = characters;
    node.fontSize = SPEC_FONT_SIZE;
    node.fills = [{ type: 'SOLID', color, ...(options?.opacity != null ? { opacity: options.opacity } : {}) }];
    node.leadingTrim = 'CAP_HEIGHT';
    node.textAutoResize = options?.autoWidth ? 'WIDTH_AND_HEIGHT' : 'HEIGHT';
    node.layoutAlign = options?.grow ? 'STRETCH' : 'INHERIT';
    node.layoutGrow = options?.grow ? 1 : 0;
    if (options?.align === 'RIGHT') {
        node.textAlignHorizontal = 'RIGHT';
    }
    if (options?.fixedWidth) {
        node.textAutoResize = 'HEIGHT';
        node.resize(options.fixedWidth, node.height);
    }
    return node;
};

const syncBottomRowWidthsToTop = (
    topRowFrame: FrameNode | undefined,
    leftColumnFrame: FrameNode | undefined,
    rightColumnFrame: FrameNode | undefined,
    bottomRowFrame: FrameNode | undefined,
    bottomLeftColumnFrame: FrameNode | undefined,
    bottomRightColumnFrame: FrameNode | undefined
) => {
    if (!topRowFrame || !leftColumnFrame || !rightColumnFrame || !bottomRowFrame || !bottomLeftColumnFrame || !bottomRightColumnFrame) {
        return;
    }

    // Enforce deterministic width parity: bottom columns/row mirror top row exactly.
    const leftWidth = Math.round(leftColumnFrame.width);
    const rightWidth = Math.round(rightColumnFrame.width);
    const topRowWidth = Math.round(topRowFrame.width);

    bottomLeftColumnFrame.counterAxisSizingMode = 'FIXED';
    bottomRightColumnFrame.counterAxisSizingMode = 'FIXED';
    bottomRowFrame.primaryAxisSizingMode = 'FIXED';

    bottomLeftColumnFrame.resize(leftWidth, bottomLeftColumnFrame.height);
    bottomRightColumnFrame.resize(rightWidth, bottomRightColumnFrame.height);
    bottomRowFrame.resize(topRowWidth, bottomRowFrame.height);

    logDebug('[SpecimenCompactLayout] Synced bottom widths to top', {
        topRowWidth,
        leftWidth,
        rightWidth
    });
};

export class SpecimenCompactLayout implements PreviewLayout {
    getLayoutType(): PreviewLayoutType {
        return 'specimenCompact';
    }

    getBaseName(): string {
        return 'Specimen';
    }

    async create(params: PreviewLayoutHandlerParams): Promise<PreviewCreateResult | null> {
        const {
            typeSystem,
            selectedStyle, // This is for typography system context
            showSpecLabels,
            currentColorMode,
            availableFontsList,
            baseFontFamily, // Primary font family
            baseFontStyle, // Primary font style/weight - use this for decorative elements
            activeScaleRatio,
            newX, // targetX in old func
            namingConvention,
            showGrid = false, // ADDED: Default to false if not provided
            roundingGridSize = 0, // ADDED: Default to 0 if not provided
            lineHeightUnit = 'percent', // ADDED: Default to percent if not provided
            previewTextAlign = 'left',
            secondaryFontFamily, // ADDED: For secondary font integration
            secondaryFontStyle // ADDED: For secondary font integration
        } = params;
        
        // Use baseFontStyle with fallback to selectedStyle or 'Regular'
        const primaryFontStyle = baseFontStyle || selectedStyle || 'Regular';

        const nodeMap = new Map<string, string[]>();

        logDebug(`[SpecimenCompactLayout.create] Start. ScaleRatio: ${activeScaleRatio}`);
        logDebug('[SpecimenCompactLayout.create] 🎯 params.styleVisibility status:', !!params.styleVisibility);
        logDebug('[SpecimenCompactLayout.create] 🔍 styleVisibility content:', params.styleVisibility);
        try {
            // --- Determine Main Font ---
            // const mainFamily = typeSystem.textMain?.fontFamily || 'Inter'; // Now baseFontFamily
            // const globalStyle = primaryFontStyle || 'Regular'; // Use primaryFontStyle for main font
            const globalFont: FontName = { family: baseFontFamily, style: primaryFontStyle };
            const fontsToLoad = new Set<FontName>();
            fontsToLoad.add(globalFont);
            fontsToLoad.add(INTER_REGULAR);

            const stylesToCheck = TYPOGRAPHY_SCALE_ORDER.ALL_STYLES;
            stylesToCheck.forEach((styleNameKey: keyof TypographySystem) => {
                const style = typeSystem[styleNameKey];
                if (style) {
                    const family = style.fontFamily || baseFontFamily;
                    const styleToUse = style.fontStyle || primaryFontStyle;
                    fontsToLoad.add({ family: family, style: styleToUse });
                    fontsToLoad.add({ family: family, style: 'Regular' }); // Ensure regular is loaded for fallbacks
                }
            });

            const fontLoadPromises = Array.from(fontsToLoad).map(font =>
                figma.loadFontAsync(font).catch(e => console.warn(`[SpecimenCompactLayout.create] Font load failed: ${font.family} ${font.style}`, e))
            );
            await Promise.all(fontLoadPromises);
            logDebug('[SpecimenCompactLayout.create] Font loading complete.');

            // --- Base Frame Setup ---
            const frame = figma.createFrame();
            frame.name = this.getBaseName(); // Set to base name initially
            frame.x = newX || 0;
            frame.layoutMode = 'VERTICAL';
            frame.primaryAxisSizingMode = 'AUTO';
            frame.counterAxisSizingMode = 'AUTO';
            frame.minWidth = 1440;
            frame.primaryAxisAlignItems = 'MIN';
            frame.counterAxisAlignItems = 'CENTER';
            frame.itemSpacing = 96;
            frame.paddingTop = 64;
            frame.paddingBottom = 64;
            frame.paddingLeft = 64;
            frame.paddingRight = 64;

            const theme = getCurrentPreviewTheme();
            const textColor = theme.text;

            frame.fills = [{ type: 'SOLID', color: theme.background }];
            frame.cornerRadius = FRAME_CORNER_RADIUS;
            frame.clipsContent = false;

            // --- Top Row: Main Columns ---
            const topRowFrame = figma.createFrame();
            topRowFrame.name = "Top Content Row";
            topRowFrame.layoutMode = 'HORIZONTAL';
            topRowFrame.primaryAxisSizingMode = 'AUTO';
            topRowFrame.counterAxisSizingMode = 'AUTO';
            topRowFrame.minWidth = 1312;
            topRowFrame.itemSpacing = 64;
            topRowFrame.fills = [];
            topRowFrame.primaryAxisAlignItems = 'MIN';
            topRowFrame.counterAxisAlignItems = 'MIN';
            frame.appendChild(topRowFrame);
            topRowFrame.clipsContent = false;

            // --- Left Column (Headings) ---
            const leftColumnFrame = figma.createFrame();
            leftColumnFrame.name = "Left Column (Headings)";
            leftColumnFrame.layoutMode = 'VERTICAL';
            leftColumnFrame.primaryAxisSizingMode = 'AUTO';
            leftColumnFrame.counterAxisSizingMode = 'AUTO';
            leftColumnFrame.minWidth = 624;
            leftColumnFrame.itemSpacing = 48; // Changed from 64px to 48px
            leftColumnFrame.fills = [];
            topRowFrame.appendChild(leftColumnFrame);
            leftColumnFrame.clipsContent = false;

            const headingHeaderItem = figma.createFrame();
            headingHeaderItem.name = "Item Headings Header";
            headingHeaderItem.layoutMode = 'VERTICAL';
            headingHeaderItem.primaryAxisSizingMode = 'AUTO';
            headingHeaderItem.counterAxisSizingMode = 'FIXED';
            headingHeaderItem.minWidth = 624;
            headingHeaderItem.itemSpacing = 24;
            headingHeaderItem.paddingBottom = 48;
            headingHeaderItem.layoutAlign = 'STRETCH';
            headingHeaderItem.fills = [];
            headingHeaderItem.clipsContent = false;
            leftColumnFrame.appendChild(headingHeaderItem);

            const headingHeaderLabel = formatFontSpecLabel(
                secondaryFontFamily || baseFontFamily,
                secondaryFontStyle || primaryFontStyle
            );
            const headingNameNode = await createHeaderTextNode(
                "Heading Name",
                headingHeaderLabel,
                textColor,
                { autoWidth: true }
            );
            headingHeaderItem.appendChild(headingNameNode);

            // Generate ONE headline for all heading styles in this specimen
            const specimenHeadline = getExampleText(STYLE_KEYS.DISPLAY); // This calls localHeadline() once
            
            const headingStylesOrder = TYPOGRAPHY_SCALE_ORDER.HEADINGS;
            for (const name of headingStylesOrder) {
                const styleToUse = typeSystem[name as keyof TypographySystem];
                if (styleToUse) {
                    const family = styleToUse.fontFamily || baseFontFamily;
                    const styleNameForFont = styleToUse.fontStyle || selectedStyle;
                    const fontForStyle = getValidFont(family, styleNameForFont, availableFontsList);
                    const headingItem = await createStyleItem(name as string, styleToUse, specimenHeadline, fontForStyle.family, fontForStyle.style, showSpecLabels, textColor, availableFontsList, currentColorMode, namingConvention, lineHeightUnit);
                    headingItem.counterAxisAlignItems = getHeadingItemCounterAxisAlignment(previewTextAlign);
                    
                    // Apply layout grid to heading item
                    applyLayoutGridToItem(headingItem, showGrid, roundingGridSize);
                    
                    // Handle visibility for entire item container
                    logDebug(`[SpecimenCompactLayout.create] 🔍 Checking visibility for "${name}": styleVisibility[${name}] = ${params.styleVisibility?.[name as string]}`);
                    if (params.styleVisibility && params.styleVisibility[name as string] !== undefined) {
                        const isVisible = params.styleVisibility[name as string];
                        logDebug(`[SpecimenCompactLayout.create] 🔍 "${name}" visibility decision: ${isVisible}`);
                        
                        if (isVisible) {
                            // Show: immediate restore entire item
                            headingItem.opacity = 1;
                            headingItem.visible = true;
                        } else {
                            // Hide: immediate collapse entire item
                            headingItem.opacity = 0;
                            headingItem.visible = false; // Collapses height in auto layout
                            logDebug(`[SpecimenCompactLayout.create] ✅ HIDDEN heading: ${name}`);
                        }
                    } else {
                        logDebug(`[SpecimenCompactLayout.create] 🔍 "${name}" defaulting to visible (no visibility data or undefined)`);
                        headingItem.opacity = 1;
                        headingItem.visible = true;
                    }
                    
                    const textNode = headingItem.children.find(n => n.type === 'TEXT') as TextNode | undefined;
                    if (textNode) {
                        textNode.textAlignHorizontal = getHeadingTextAlignment(previewTextAlign);
                        nodeMap.set(name as string, [textNode.id]);
                    }
                    
                    leftColumnFrame.appendChild(headingItem);
                }
            }

            // --- Right Column (Text Examples) ---
            const rightColumnFrame = figma.createFrame();
            rightColumnFrame.name = "Right Column (Text)";
            rightColumnFrame.layoutMode = 'VERTICAL';
            rightColumnFrame.primaryAxisSizingMode = 'AUTO';
            rightColumnFrame.counterAxisSizingMode = 'AUTO';
            rightColumnFrame.minWidth = 624;
            rightColumnFrame.itemSpacing = 48; // Changed from 24px to 48px
            rightColumnFrame.fills = [];
            topRowFrame.appendChild(rightColumnFrame);
            rightColumnFrame.clipsContent = false;

            const textHeaderWrapper = figma.createFrame();
            textHeaderWrapper.name = "Item - Text Header";
            textHeaderWrapper.layoutMode = 'VERTICAL';
            textHeaderWrapper.primaryAxisSizingMode = 'AUTO';
            textHeaderWrapper.counterAxisSizingMode = 'FIXED';
            textHeaderWrapper.minWidth = 624;
            textHeaderWrapper.paddingBottom = 48;
            textHeaderWrapper.layoutAlign = 'STRETCH';
            textHeaderWrapper.fills = [];
            textHeaderWrapper.clipsContent = false;
            rightColumnFrame.appendChild(textHeaderWrapper);

            const topHeaderRightItem = figma.createFrame();
            topHeaderRightItem.name = "Item - Text";
            topHeaderRightItem.layoutMode = 'VERTICAL';
            topHeaderRightItem.primaryAxisSizingMode = 'AUTO';
            topHeaderRightItem.counterAxisSizingMode = 'FIXED';
            topHeaderRightItem.minWidth = 624;
            topHeaderRightItem.itemSpacing = 24;
            topHeaderRightItem.layoutAlign = 'STRETCH';
            topHeaderRightItem.fills = [];
            topHeaderRightItem.clipsContent = false;
            textHeaderWrapper.appendChild(topHeaderRightItem);

            const textHeaderLabel = formatFontSpecLabel(baseFontFamily, primaryFontStyle);
            const textNameNode = await createHeaderTextNode("Text Name", textHeaderLabel, textColor, { autoWidth: true });
            topHeaderRightItem.appendChild(textNameNode);

            const textMainStyle = typeSystem[STYLE_KEYS.TEXT_MAIN];
            const h6Style = typeSystem[STYLE_KEYS.H6];
            if (textMainStyle && h6Style) {
                const headingFont = getValidFont(
                    h6Style.fontFamily || secondaryFontFamily || baseFontFamily,
                    h6Style.fontStyle || secondaryFontStyle || selectedStyle,
                    availableFontsList
                );
                const textMainFont = getValidFont(
                    textMainStyle.fontFamily || baseFontFamily,
                    textMainStyle.fontStyle || primaryFontStyle,
                    availableFontsList
                );

                const headingNameStyle: TypographyStyle = {
                    size: textMainStyle.size,
                    lineHeight: textMainStyle.lineHeight,
                    letterSpacing: textMainStyle.letterSpacing,
                    fontFamily: headingFont.family,
                    fontStyle: headingFont.style
                };
                const textNameStyle: TypographyStyle = {
                    size: textMainStyle.size,
                    lineHeight: textMainStyle.lineHeight,
                    letterSpacing: textMainStyle.letterSpacing,
                    fontFamily: textMainFont.family,
                    fontStyle: textMainFont.style
                };

                await applyTextStyleToNode(headingNameNode, headingNameStyle, headingFont, availableFontsList);
                await applyTextStyleToNode(textNameNode, textNameStyle, textMainFont, availableFontsList);
                headingNameNode.characters = formatFontSpecLabel(headingFont.family, headingFont.style);
                textNameNode.characters = formatFontSpecLabel(textMainFont.family, textMainFont.style);
                headingNameNode.fills = [{ type: 'SOLID', color: textColor }];
                textNameNode.fills = [{ type: 'SOLID', color: textColor }];
            }

            const textExampleGroups: { text: keyof TypographySystem }[] = [
                { text: STYLE_KEYS.TEXT_LARGE },
                { text: STYLE_KEYS.TEXT_MAIN },
                { text: STYLE_KEYS.TEXT_SMALL },
                { text: STYLE_KEYS.MICRO },
            ];
            
            for (const group of textExampleGroups) {
                const textStyle = typeSystem[group.text];
                if (textStyle) {
                    const textFamily = textStyle.fontFamily || baseFontFamily;
                    const textFontStyleName = textStyle.fontStyle || selectedStyle;
                    const textFont = getValidFont(textFamily, textFontStyleName, availableFontsList);
                    const exampleStringToUse = getExampleText(group.text as string);
                    const textItemContainer = await createStyleItem(group.text as string, textStyle, exampleStringToUse, textFont.family, textFont.style, showSpecLabels, textColor, availableFontsList, currentColorMode, namingConvention, lineHeightUnit);
                    
                    // Apply layout grid to text item
                    applyLayoutGridToItem(textItemContainer, showGrid, roundingGridSize);
                    
                    // Handle visibility for entire text item container
                    if (params.styleVisibility && params.styleVisibility[group.text as string] !== undefined) {
                        const isVisible = params.styleVisibility[group.text as string];
                        
                        if (isVisible) {
                            // Show: immediate restore entire item
                            textItemContainer.opacity = 1;
                            textItemContainer.visible = true;
                        } else {
                            // Hide: immediate collapse entire item
                            textItemContainer.opacity = 0;
                            textItemContainer.visible = false; // Collapses height in auto layout
                        }
                    } else {
                        textItemContainer.opacity = 1;
                        textItemContainer.visible = true;
                    }
                    
                    const textNode = textItemContainer.children.find(n => n.type === 'TEXT' && n.name.startsWith(FIGMA_NODE_NAMES.EXAMPLE_TEXT_PREFIX)) as TextNode | undefined;

                    if (textNode) {
                         nodeMap.set(group.text as string, [textNode.id]);
                    }
                    
                    if (textNode && (group.text === STYLE_KEYS.TEXT_LARGE || group.text === STYLE_KEYS.TEXT_MAIN || group.text === STYLE_KEYS.TEXT_SMALL || group.text === STYLE_KEYS.MICRO)) {
                        let dynamicMultiplier = BASE_CHARACTER_MULTIPLIER;
                        const textMainSize = typeSystem[STYLE_KEYS.TEXT_MAIN]?.size;

                        if (textMainSize && textMainSize > 0 && textStyle.size > 0) {
                            const sizeRatio = textStyle.size / textMainSize;
                            dynamicMultiplier = BASE_CHARACTER_MULTIPLIER * Math.pow(sizeRatio, -LINE_LENGTH_ADJUSTMENT_FACTOR);
                            dynamicMultiplier = Math.max(BASE_CHARACTER_MULTIPLIER * 0.7, Math.min(dynamicMultiplier, BASE_CHARACTER_MULTIPLIER * 1.3));
                        }
                        
                        let desiredWidth = Math.round(textStyle.size * dynamicMultiplier * TEXT_MAX_WIDTH_MULTIPLIER);
                        desiredWidth = Math.max(TEXT_MAX_WIDTH_MIN, Math.min(desiredWidth, TEXT_MAX_WIDTH_MAX));
                        
                        try {
                            textNode.maxWidth = desiredWidth;
                        } catch (e) {
                            console.warn(`[SpecimenCompactLayout.create] Failed to set maxWidth on ${textNode.name}: ${e}.`);
                        }
                    }
                    
                    // Width behavior - apply directly to textItemContainer since no wrapper
                    if (group.text === STYLE_KEYS.TEXT_LARGE) {
                        textItemContainer.counterAxisSizingMode = 'AUTO';
                        textItemContainer.minWidth = 624; 
                    } else { 
                        textItemContainer.counterAxisSizingMode = 'FIXED'; 
                        textItemContainer.layoutAlign = 'STRETCH'; 
                    }
                    
                    // Add directly to right column (no wrapper)
                    rightColumnFrame.appendChild(textItemContainer);
                }
            }

            // --- Bottom Row: Duplicate of Main Columns ---
            const bottomRowFrame = figma.createFrame();
            bottomRowFrame.name = "Bottom Content Row";
            bottomRowFrame.layoutMode = 'HORIZONTAL';
            bottomRowFrame.primaryAxisSizingMode = 'AUTO';
            bottomRowFrame.counterAxisSizingMode = 'AUTO';
            bottomRowFrame.minWidth = 1312;
            bottomRowFrame.itemSpacing = 64;
            bottomRowFrame.fills = [];
            bottomRowFrame.primaryAxisAlignItems = 'MIN';
            bottomRowFrame.counterAxisAlignItems = 'MIN';
            frame.appendChild(bottomRowFrame);
            bottomRowFrame.clipsContent = false;

            // --- Bottom Left Column (Headings) ---
            const bottomLeftColumnFrame = figma.createFrame();
            bottomLeftColumnFrame.name = "Left Column (Headings)";
            bottomLeftColumnFrame.layoutMode = 'VERTICAL';
            bottomLeftColumnFrame.primaryAxisSizingMode = 'AUTO';
            bottomLeftColumnFrame.counterAxisSizingMode = 'AUTO';
            bottomLeftColumnFrame.minWidth = 624;
            bottomLeftColumnFrame.itemSpacing = 24;
            bottomLeftColumnFrame.fills = [];
            bottomRowFrame.appendChild(bottomLeftColumnFrame);
            bottomLeftColumnFrame.clipsContent = false;

            // Use largest visible style overall for decorative sample (both headings and text)
            const largestVisibleStyle = getLargestVisibleStyle(typeSystem, params.styleVisibility);
            if (largestVisibleStyle.style) {
                const decorativeFamily = largestVisibleStyle.style.fontFamily || secondaryFontFamily || baseFontFamily;
                const decorativeStyleName = largestVisibleStyle.style.fontStyle || secondaryFontStyle || selectedStyle;
                const fontForStyle = getValidFont(decorativeFamily, decorativeStyleName, availableFontsList);
                // 🎯 FIX: Create clean decorative style with only size, ignore grid font/case overrides
                const decorativeHeadingStyle = {
                    size: largestVisibleStyle.style.size, // Only use the size from largest visible
                    fontFamily: fontForStyle.family, // Use main section secondary font
                    fontStyle: fontForStyle.style,   // Use main section secondary weight
                    lineHeight: largestVisibleStyle.style.lineHeight, // Keep line height
                    letterSpacing: DECORATIVE_AA_FIXED_LETTER_SPACING, // Fixed -1.5% letter spacing
                    // Explicitly exclude textCase to keep "Aa" as "Aa"
                };
                const h0Item = await createStyleItem("Heading", decorativeHeadingStyle, "Aa", fontForStyle.family, fontForStyle.style, showSpecLabels, textColor, availableFontsList, currentColorMode, namingConvention, lineHeightUnit);
                
                // Update Style Label to show font name and normalize bottom-row specs
                const labelSpecsRow = h0Item.children.find(n => n.name.startsWith('LabelSpecs')) as FrameNode | undefined;
                if (labelSpecsRow) {
                    await ensureFamilySpecNode(labelSpecsRow, fontForStyle.family);
                    const styleLabel = labelSpecsRow.children.find(n => n.name === 'Style Label') as TextNode | undefined;
                    await configureStyleLabelForFamily(styleLabel, styleLabel?.characters || 'Heading');
                    
                    // Bottom row should only keep Weight (no size/line-height/letter-spacing)
                    const sizeSpec = labelSpecsRow.children.find(n => n.name.includes('Size Spec')) as TextNode | undefined;
                    const lineHeightSpec = labelSpecsRow.children.find(n => n.name.includes('LineHeight Spec')) as TextNode | undefined;
                    const letterSpacingSpec = labelSpecsRow.children.find(n => n.name.includes('LetterSpacing Spec')) as TextNode | undefined;
                    
                    if (sizeSpec) {
                        sizeSpec.name = "Weight Spec - Heading";
                        sizeSpec.characters = fontForStyle.style;
                        sizeSpec.textAutoResize = 'WIDTH_AND_HEIGHT';
                        sizeSpec.layoutAlign = 'INHERIT';
                        sizeSpec.textAlignHorizontal = 'RIGHT';
                    }
                    if (lineHeightSpec) {
                        lineHeightSpec.remove();
                    }
                    if (letterSpacingSpec) {
                        letterSpacingSpec.remove();
                    }
                }
                
                // Apply layout grid to heading item
                applyLayoutGridToItem(h0Item, showGrid, roundingGridSize);
                
                const textNode = h0Item.children.find(n => n.type === 'TEXT') as TextNode | undefined;
                if (textNode) {
                    textNode.name = "Decorative Aa Headings";
                }

                bottomLeftColumnFrame.appendChild(h0Item);
                
                const h6Style = typeSystem[STYLE_KEYS.H6];
                if (h6Style) {
                    const headingCharFamily = h6Style.fontFamily || secondaryFontFamily || baseFontFamily;
                    const headingCharStyleName = h6Style.fontStyle || secondaryFontStyle || selectedStyle;
                    const headingCharFont = getValidFont(headingCharFamily, headingCharStyleName, availableFontsList);
                    const characterSet = "1234567890\nABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz\n(+,.*?-{ })";
                    
                    const headingCharSetItem = figma.createFrame();
                    headingCharSetItem.name = "Item - Heading Character Set";
                    headingCharSetItem.layoutMode = 'VERTICAL';
                    headingCharSetItem.fills = [];
                    headingCharSetItem.primaryAxisSizingMode = 'AUTO';
                    headingCharSetItem.counterAxisSizingMode = 'AUTO';
                    
                    const charSetTextNode = figma.createText();
                    charSetTextNode.name = "Heading Character Set";
                    charSetTextNode.characters = characterSet;
                    const headingCharStyle = {
                        ...h6Style,
                        fontFamily: headingCharFont.family,
                        fontStyle: headingCharFont.style,
                        lineHeight: CHARACTER_SET_FIXED_LINE_HEIGHT,
                        letterSpacing: CHARACTER_SET_FIXED_LETTER_SPACING,
                    };
                    await applyTextStyleToNode(charSetTextNode, headingCharStyle, headingCharFont, availableFontsList);
                    charSetTextNode.fills = [{ type: 'SOLID', color: textColor }];
                    charSetTextNode.textAutoResize = 'WIDTH_AND_HEIGHT';
                    
                    headingCharSetItem.appendChild(charSetTextNode);
                    nodeMap.set("headingCharacterSet", [charSetTextNode.id]);
                    
                    // Apply layout grid to character set item
                    applyLayoutGridToItem(headingCharSetItem, showGrid, roundingGridSize);

                    bottomLeftColumnFrame.appendChild(headingCharSetItem);
                }
            }
            
            // --- Bottom Right Column (Text Examples) ---
            const bottomRightColumnFrame = figma.createFrame();
            bottomRightColumnFrame.name = "Right Column (Text)";
            bottomRightColumnFrame.layoutMode = 'VERTICAL';
            bottomRightColumnFrame.primaryAxisSizingMode = 'AUTO';
            bottomRightColumnFrame.counterAxisSizingMode = 'AUTO';
            bottomRightColumnFrame.minWidth = 624;
            bottomRightColumnFrame.itemSpacing = 24;
            bottomRightColumnFrame.fills = [];
            bottomRowFrame.appendChild(bottomRightColumnFrame);
            bottomRightColumnFrame.clipsContent = false;

            // Use largest visible style overall for decorative sample (same as headings)
            const largestVisibleTextStyle = getLargestVisibleStyle(typeSystem, params.styleVisibility);
            if (largestVisibleTextStyle.style) {
                // 🎯 FIX: Use main section primary font settings, not grid overrides
                const textFamily = baseFontFamily;
                const textFontStyleName = primaryFontStyle;
                const textFont = getValidFont(textFamily, textFontStyleName, availableFontsList);
                // 🎯 FIX: Create clean decorative style with only size, ignore grid font/case overrides
                const decorativeTextStyle = {
                    size: largestVisibleTextStyle.style.size, // Only use the size from largest visible
                    fontFamily: textFont.family, // Use main section primary font
                    fontStyle: textFont.style,   // Use main section primary weight
                    lineHeight: largestVisibleTextStyle.style.lineHeight, // Keep line height
                    letterSpacing: DECORATIVE_AA_FIXED_LETTER_SPACING, // Fixed -1.5% letter spacing
                    // Explicitly exclude textCase to keep "Aa" as "Aa"
                };
                const textItemContainer = await createStyleItem("Text", decorativeTextStyle, "Aa", textFont.family, textFont.style, showSpecLabels, textColor, availableFontsList, currentColorMode, namingConvention, lineHeightUnit);
                
                // Update Style Label to show font name and normalize bottom-row specs
                const labelSpecsRow = textItemContainer.children.find(n => n.name.startsWith('LabelSpecs')) as FrameNode | undefined;
                if (labelSpecsRow) {
                    await ensureFamilySpecNode(labelSpecsRow, textFont.family);
                    const styleLabel = labelSpecsRow.children.find(n => n.name === 'Style Label') as TextNode | undefined;
                    await configureStyleLabelForFamily(styleLabel, styleLabel?.characters || 'Text');
                    
                    // Bottom row should only keep Weight (no size/line-height/letter-spacing)
                    const sizeSpec = labelSpecsRow.children.find(n => n.name.includes('Size Spec')) as TextNode | undefined;
                    const lineHeightSpec = labelSpecsRow.children.find(n => n.name.includes('LineHeight Spec')) as TextNode | undefined;
                    const letterSpacingSpec = labelSpecsRow.children.find(n => n.name.includes('LetterSpacing Spec')) as TextNode | undefined;
                    
                    if (sizeSpec) {
                        sizeSpec.name = "Weight Spec - Text";
                        sizeSpec.characters = textFont.style;
                        sizeSpec.textAutoResize = 'WIDTH_AND_HEIGHT';
                        sizeSpec.layoutAlign = 'INHERIT';
                        sizeSpec.textAlignHorizontal = 'RIGHT';
                    }
                    if (lineHeightSpec) {
                        lineHeightSpec.remove();
                    }
                    if (letterSpacingSpec) {
                        letterSpacingSpec.remove();
                    }
                }
                
                // Apply layout grid to text item
                applyLayoutGridToItem(textItemContainer, showGrid, roundingGridSize);
                
                const textNode = textItemContainer.children.find(n => n.type === 'TEXT' && n.name.startsWith(FIGMA_NODE_NAMES.EXAMPLE_TEXT_PREFIX)) as TextNode | undefined;

                if (textNode) {
                    textNode.name = "Decorative Aa Text";
                }

                // No maxWidth restrictions for display-sized text
                
                // Width behavior for display-sized text
                textItemContainer.counterAxisSizingMode = 'AUTO';
                textItemContainer.minWidth = 624; 
                
                // Add to bottom right column
                bottomRightColumnFrame.appendChild(textItemContainer);
                
                // Add character set version for text with textMain size - use primary font for text
                const textMainStyle = typeSystem[STYLE_KEYS.TEXT_MAIN];
                if (textMainStyle) {
                    // 🎯 FIX: Use main section primary font settings, not grid overrides
                    const textMainFamily = baseFontFamily;
                    const textMainStyleName = primaryFontStyle;
                    const textMainFont = getValidFont(textMainFamily, textMainStyleName, availableFontsList);
                    const characterSet = "1234567890\nABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz\n(+,.*?-{ })";
                    
                    // Create character set node directly (no labels needed)
                    const textCharSetItem = figma.createFrame();
                    textCharSetItem.name = "Item - Text Character Set";
                    textCharSetItem.layoutMode = 'VERTICAL';
                    textCharSetItem.fills = [];
                    textCharSetItem.primaryAxisSizingMode = 'AUTO';
                    textCharSetItem.counterAxisSizingMode = 'AUTO';
                    
                    const charSetTextNode = figma.createText();
                    charSetTextNode.name = "Text Character Set";
                    charSetTextNode.characters = characterSet;
                    const characterSetStyle = {
                        ...textMainStyle,
                        lineHeight: CHARACTER_SET_FIXED_LINE_HEIGHT,
                        letterSpacing: CHARACTER_SET_FIXED_LETTER_SPACING,
                    };
                    await applyTextStyleToNode(charSetTextNode, characterSetStyle, textMainFont, availableFontsList);
                    charSetTextNode.fills = [{ type: 'SOLID', color: textColor }];
                    charSetTextNode.textAutoResize = 'WIDTH_AND_HEIGHT';
                    
                    textCharSetItem.appendChild(charSetTextNode);
                    nodeMap.set("textCharacterSet", [charSetTextNode.id]);
                    
                    // Apply layout grid to character set item
                    applyLayoutGridToItem(textCharSetItem, showGrid, roundingGridSize);

                    bottomRightColumnFrame.appendChild(textCharSetItem);
                }
            }
            
            syncBottomRowWidthsToTop(
                topRowFrame,
                leftColumnFrame,
                rightColumnFrame,
                bottomRowFrame,
                bottomLeftColumnFrame,
                bottomRightColumnFrame
            );



            // --- Finalize ---
            // figma.currentPage.appendChild(frame); // Appending will be handled by manager
            return { frame, nodeMap };

        } catch (error) {
            console.error('[SpecimenCompactLayout.create] Error:', error);
            figma.notify("Error creating Specimen Compact Preview. Check console.", { error: true });
            return null;
        }
    }

    async update(frame: FrameNode, params: PreviewLayoutHandlerParams): Promise<void> {
        const {
            typeSystem,
            selectedStyle, // This is for typography system context
            showSpecLabels,
            styleVisibility,
            currentColorMode,
            availableFontsList,
            baseFontFamily, // Primary font family
            baseFontStyle, // Primary font style/weight
            activeScaleRatio,
            showGrid = false, // ADDED: Grid overlay state
            roundingGridSize = 0, // ADDED: Grid size for overlays
            lineHeightUnit = 'percent', // ADDED: Line height unit for specs
            previewTextAlign = 'left',
            secondaryFontFamily, // ADDED: For secondary font integration
            secondaryFontStyle // ADDED: For secondary font integration
            // newX is not used in update
            // activeMode is not directly used by this specific layout's update logic but is part of params
        } = params;

        // Use baseFontStyle with fallback to selectedStyle or 'Regular'
        const primaryFontStyle = baseFontStyle || selectedStyle || 'Regular';

        logDebug(`[SpecimenCompactLayout.update] Applying update. Target: ${frame.name}, Labels: ${showSpecLabels}, ScaleRatio: ${activeScaleRatio}`);
        try {
            const theme = getCurrentPreviewTheme();
            const textColor = theme.text;

            // Batch-preload all fonts before applying to nodes
            const fontsToLoad = new Set<string>();
            fontsToLoad.add(JSON.stringify({ family: baseFontFamily, style: primaryFontStyle }));
            fontsToLoad.add(JSON.stringify(INTER_REGULAR));
            if (secondaryFontFamily) {
                fontsToLoad.add(JSON.stringify({ family: secondaryFontFamily, style: secondaryFontStyle || primaryFontStyle }));
            }
            Object.values(typeSystem).forEach(style => {
                if (style) {
                    fontsToLoad.add(JSON.stringify({ family: style.fontFamily || baseFontFamily, style: style.fontStyle || primaryFontStyle }));
                }
            });
            await Promise.all(Array.from(fontsToLoad).map(fontJson => {
                const font = JSON.parse(fontJson) as FontName;
                return figma.loadFontAsync(font).catch(e =>
                    console.warn(`[SpecimenCompactLayout.update] Font preload failed: ${font.family} ${font.style}`, e)
                );
            }));

            const updatePromises: Promise<void>[] = [];

            // --- Update Content Columns ---
            const topRowFrame = frame.children.find(n => n.name === "Top Content Row") as FrameNode | undefined;
            const leftColumnFrame = topRowFrame?.children.find(n => n.name === "Left Column (Headings)") as FrameNode | undefined;
            const rightColumnFrame = topRowFrame?.children.find(n => n.name === "Right Column (Text)") as FrameNode | undefined;
            const headingHeaderItem = leftColumnFrame?.children.find(n => n.name === "Item Headings Header") as FrameNode | undefined;
            const textHeaderWrapper = rightColumnFrame?.children.find(n => n.name === "Item - Text Header") as FrameNode | undefined;
            if (headingHeaderItem) {
                headingHeaderItem.paddingBottom = 48;
                headingHeaderItem.counterAxisSizingMode = 'FIXED';
                headingHeaderItem.layoutAlign = 'STRETCH';
            }
            if (textHeaderWrapper) {
                textHeaderWrapper.paddingBottom = 48;
                textHeaderWrapper.counterAxisSizingMode = 'FIXED';
                textHeaderWrapper.layoutAlign = 'STRETCH';
            }
            const h6Style = typeSystem[STYLE_KEYS.H6];
            const textMainStyle = typeSystem[STYLE_KEYS.TEXT_MAIN];
            const targetHeadingFont = getValidFont(
                h6Style?.fontFamily || secondaryFontFamily || baseFontFamily,
                h6Style?.fontStyle || secondaryFontStyle || selectedStyle || 'Regular',
                availableFontsList
            );
            const targetTextFont = getValidFont(
                textMainStyle?.fontFamily || baseFontFamily,
                textMainStyle?.fontStyle || primaryFontStyle,
                availableFontsList
            );
            const targetHeadingName = formatFontSpecLabel(targetHeadingFont.family, targetHeadingFont.style);
            const targetTextName = formatFontSpecLabel(targetTextFont.family, targetTextFont.style);

            const headerTextParents: FrameNode[] = [];
            if (headingHeaderItem) headerTextParents.push(headingHeaderItem);
            if (textHeaderWrapper) headerTextParents.push(textHeaderWrapper);
            const headerTexts = headerTextParents.flatMap(parent => parent.findAll((n: SceneNode) => n.type === 'TEXT') as TextNode[]);
            headerTexts.forEach(textNode => {
                updatePromises.push((async () => {
                    const nodeName = textNode.name;
                    if (nodeName === "Date " || nodeName === "Time (00:00)") {
                        textNode.remove();
                        return;
                    }
                    const needsAutoWidth = nodeName === "Heading Name"
                        || nodeName === "Font Name"
                        || nodeName === "Text Name";
                    if (needsAutoWidth) {
                        textNode.textAutoResize = 'WIDTH_AND_HEIGHT';
                        textNode.layoutAlign = 'INHERIT';
                        textNode.layoutGrow = 0;
                    } else if (
                        nodeName === "Preset"
                        || nodeName === "Empty"
                        || nodeName === "Heading Label"
                        || nodeName === "Text Label"
                    ) {
                        textNode.remove();
                        return;
                    }
                    if (nodeName === "Heading Name" && textNode.characters !== targetHeadingName) {
                        try { await figma.loadFontAsync(textNode.fontName as FontName); } catch {}
                        textNode.characters = targetHeadingName;
                    } else if (nodeName === "Preset" || nodeName === "Empty") {
                        textNode.remove();
                        return;
                    } else if (nodeName === "Specimen by Traits") {
                        textNode.remove();
                    } else if ((nodeName === "Font Name" || nodeName === "Text Name") && textNode.characters !== targetTextName) {
                        try { await figma.loadFontAsync(textNode.fontName as FontName); } catch {}
                        textNode.characters = targetTextName;
                        if (nodeName === "Font Name") {
                            textNode.name = "Text Name";
                        }
                    }
                    const isHeaderValue = nodeName === "Heading Name" || nodeName === "Font Name" || nodeName === "Text Name";
                    textNode.fills = [{ type: 'SOLID', color: isHeaderValue ? textColor : theme.specColor, opacity: isHeaderValue ? undefined : theme.specColorOpacity }];
                })());
            });

            const headingNameNode = headingHeaderItem?.findOne(n => n.type === 'TEXT' && n.name === "Heading Name") as TextNode | null;
            const textNameNode = (textHeaderWrapper?.findOne(n => n.type === 'TEXT' && (n.name === "Text Name" || n.name === "Font Name")) as TextNode | null) || null;
            if (headingNameNode && textNameNode && textMainStyle && h6Style) {
                updatePromises.push((async () => {
                    const headingFont = getValidFont(
                        h6Style.fontFamily || secondaryFontFamily || baseFontFamily,
                        h6Style.fontStyle || secondaryFontStyle || selectedStyle,
                        availableFontsList
                    );
                    const textMainFont = getValidFont(
                        textMainStyle.fontFamily || baseFontFamily,
                        textMainStyle.fontStyle || primaryFontStyle,
                        availableFontsList
                    );

                    const headingNameStyle: TypographyStyle = {
                        size: textMainStyle.size,
                        lineHeight: textMainStyle.lineHeight,
                        letterSpacing: textMainStyle.letterSpacing,
                        fontFamily: headingFont.family,
                        fontStyle: headingFont.style
                    };
                    const textNameStyle: TypographyStyle = {
                        size: textMainStyle.size,
                        lineHeight: textMainStyle.lineHeight,
                        letterSpacing: textMainStyle.letterSpacing,
                        fontFamily: textMainFont.family,
                        fontStyle: textMainFont.style
                    };

                    await applyTextStyleToNode(headingNameNode, headingNameStyle, headingFont, availableFontsList);
                    await applyTextStyleToNode(textNameNode, textNameStyle, textMainFont, availableFontsList);
                    headingNameNode.characters = formatFontSpecLabel(headingFont.family, headingFont.style);
                    textNameNode.characters = formatFontSpecLabel(textMainFont.family, textMainFont.style);
                    headingNameNode.fills = [{ type: 'SOLID', color: textColor }];
                    textNameNode.fills = [{ type: 'SOLID', color: textColor }];
                    if (textNameNode.name === "Font Name") {
                        textNameNode.name = "Text Name";
                    }
                })());
            }

            // Update Headings in Left Column
            if (leftColumnFrame) {
                const headingItemNodes = leftColumnFrame.children.filter(n => n.type === 'FRAME' && n.name.startsWith(FIGMA_NODE_NAMES.ITEM_PREFIX)) as FrameNode[];
                const headingItemMap = new Map(headingItemNodes?.map(node => [node.name.replace('Item - ', ''), node]));
                const headingStylesOrder = TYPOGRAPHY_SCALE_ORDER.HEADINGS;
                
                // DEBUG: Log what nodes we found and what we're looking for
                console.log(`[SpecimenCompact] 🔍 DEBUG - Found heading nodes:`, headingItemNodes.map(n => n.name));
                console.log(`[SpecimenCompact] 🔍 DEBUG - Heading map keys:`, Array.from(headingItemMap.keys()));
                console.log(`[SpecimenCompact] 🔍 DEBUG - Naming convention:`, params.namingConvention);
                
                headingStylesOrder.forEach(name => {
                    const styleToUse = typeSystem[name as keyof TypographySystem];
                    
                    // Try to find node with multiple naming conventions (robust lookup)
                    let headingItemContainer: FrameNode | undefined;
                    const namingConventions = ['Default Naming', 'Lumos', 'Tailwind', 'Bootstrap', 'Relume'];
                    
                    for (const convention of namingConventions) {
                        const displayName = getDisplayNameWithConvention(name as string, convention);
                        headingItemContainer = headingItemMap.get(displayName);
                        if (headingItemContainer) {
                            console.log(`[SpecimenCompact] 🔍 Found "${name}" using ${convention} convention: "${displayName}"`);
                            break;
                        }
                    }
                    
                    if (!headingItemContainer) {
                        console.warn(`[SpecimenCompact] ⚠️ Could not find node for "${name}" with any naming convention. Available keys:`, Array.from(headingItemMap.keys()));
                    }
                    if (styleToUse && headingItemContainer) {
                        updatePromises.push((async () => {
                            // 🏷️ RENAME NODES: Only rename if naming convention has changed
                            const currentConvention = params.namingConvention || 'Default Naming';
                            const lastConvention = headingItemContainer.getPluginData('lastNamingConvention') || 'Default Naming';
                            
                            if (currentConvention !== lastConvention) {
                                console.log(`[SpecimenCompact] 🔄 Naming convention changed (${lastConvention} → ${currentConvention}), renaming "${headingItemContainer.name}"`);
                                await renameNodesForConvention(headingItemContainer, name as string, currentConvention);
                                headingItemContainer.setPluginData('lastNamingConvention', currentConvention);
                            }
                            
                            // Apply layout grid to heading item
                            applyLayoutGridToItem(headingItemContainer, showGrid, roundingGridSize);
                            headingItemContainer.counterAxisAlignItems = getHeadingItemCounterAxisAlignment(previewTextAlign);
                            
                            const exampleTextNode = headingItemContainer.children.find(n => n.type === 'TEXT') as TextNode | undefined;
                            const labelSpecsRow = headingItemContainer.children.find(n => n.name.startsWith('LabelSpecs')) as FrameNode | undefined;
                            
                            // Handle visibility for entire item container
                            if (styleVisibility && styleVisibility[name as string] !== undefined) {
                                const isVisible = styleVisibility[name as string];
                                
                                if (isVisible) {
                                    // Show: immediate restore entire item
                                    headingItemContainer.opacity = 1;
                                    headingItemContainer.visible = true;
                                } else {
                                    // Hide: immediate collapse entire item
                                    headingItemContainer.opacity = 0;
                                    headingItemContainer.visible = false; // Collapses height in auto layout
                                }
                            } else {
                                headingItemContainer.opacity = 1;
                                headingItemContainer.visible = true;
                            }
                            
                            if (exampleTextNode) {
                                const itemFamily = styleToUse.fontFamily || baseFontFamily;
                                const itemStyle = styleToUse.fontStyle || primaryFontStyle;
                                const finalItemFont = getValidFont(itemFamily, itemStyle, availableFontsList);
                                await applyTextStyleToNode(exampleTextNode, styleToUse, finalItemFont, availableFontsList);
                                exampleTextNode.fills = [{ type: 'SOLID', color: textColor }];
                                exampleTextNode.textAlignHorizontal = getHeadingTextAlignment(previewTextAlign);
                            }
                            if (labelSpecsRow) {
                                labelSpecsRow.opacity = showSpecLabels ? 1 : 0;
                                if (showSpecLabels) await updateSpecsInRow(labelSpecsRow, styleToUse, params.namingConvention, lineHeightUnit, name as string);
                            }
                        })());
                    }
                });
            } else { console.warn('[SpecimenCompactLayout.update] Could not find Left Column (Headings)');}


            // Update Text Examples in Right Column
            if (rightColumnFrame) {
                const textItemNodes = rightColumnFrame.children.filter(
                    n => n.type === 'FRAME'
                        && n.name.startsWith(FIGMA_NODE_NAMES.ITEM_PREFIX)
                        && n.name !== "Item - Text Header"
                ) as FrameNode[];
                const textItemMap = new Map(textItemNodes?.map(node => [node.name.replace('Item - ', ''), node]));
                const textExampleGroups: { text: keyof TypographySystem }[] = [
                     { text: STYLE_KEYS.MICRO }, { text: STYLE_KEYS.TEXT_SMALL }, { text: STYLE_KEYS.TEXT_MAIN }, { text: STYLE_KEYS.TEXT_LARGE },
                ];

                textExampleGroups.forEach(group => {
                    // Try to find node with multiple naming conventions (robust lookup)
                    let textItemContainer: FrameNode | undefined;
                    const namingConventions = ['Default Naming', 'Lumos', 'Tailwind', 'Bootstrap', 'Relume'];
                    
                    for (const convention of namingConventions) {
                        const displayName = getDisplayNameWithConvention(group.text as string, convention);
                        textItemContainer = textItemMap.get(displayName);
                        if (textItemContainer) {
                            console.log(`[SpecimenCompact] 🔍 Found "${group.text}" using ${convention} convention: "${displayName}"`);
                            break;
                        }
                    }
                    
                    if (!textItemContainer) {
                        console.warn(`[SpecimenCompact] ⚠️ Could not find text node for "${group.text}" with any naming convention. Available keys:`, Array.from(textItemMap.keys()));
                    }
                    if (textItemContainer) {
                        updatePromises.push((async () => {
                            // 🏷️ RENAME NODES: Only rename if naming convention has changed
                            const currentConvention = params.namingConvention || 'Default Naming';
                            const lastConvention = textItemContainer.getPluginData('lastNamingConvention') || 'Default Naming';
                            
                            if (currentConvention !== lastConvention) {
                                console.log(`[SpecimenCompact] 🔄 Naming convention changed (${lastConvention} → ${currentConvention}), renaming text item "${textItemContainer.name}"`);
                                await renameNodesForConvention(textItemContainer, group.text as string, currentConvention);
                                textItemContainer.setPluginData('lastNamingConvention', currentConvention);
                            }
                            
                            // Apply layout grid to text item
                            applyLayoutGridToItem(textItemContainer, showGrid, roundingGridSize);
                            
                            const textStyle = typeSystem[group.text];
                            
                            if (textItemContainer && textStyle) {
                                const textNode = textItemContainer.children.find(n => n.type === 'TEXT') as TextNode | undefined;
                                const labelSpecsRow = textItemContainer.children.find(n => n.name.startsWith('LabelSpecs')) as FrameNode | undefined;

                                // Handle visibility for entire text item container
                                if (styleVisibility && styleVisibility[group.text as string] !== undefined) {
                                    const isVisible = styleVisibility[group.text as string];
                                    
                                    if (isVisible) {
                                        // Show: immediate restore entire item
                                        textItemContainer.opacity = 1;
                                        textItemContainer.visible = true;
                                    } else {
                                        // Hide: immediate collapse entire item
                                        textItemContainer.opacity = 0;
                                        textItemContainer.visible = false; // Collapses height in auto layout
                                    }
                                } else {
                                    textItemContainer.opacity = 1;
                                    textItemContainer.visible = true;
                                }

                                if (textNode) {
                                    const itemFamily = textStyle.fontFamily || baseFontFamily;
                                    const itemStyle = textStyle.fontStyle || primaryFontStyle;
                                    const finalItemFont = getValidFont(itemFamily, itemStyle, availableFontsList);
                                    await applyTextStyleToNode(textNode, textStyle, finalItemFont, availableFontsList);
                                    textNode.fills = [{ type: 'SOLID', color: textColor }];
                                    if (textNode.textAlignHorizontal !== 'LEFT') textNode.textAlignHorizontal = 'LEFT';
                                    textNode.textAutoResize = 'WIDTH_AND_HEIGHT';
                                    textNode.layoutAlign = 'INHERIT'; // Should be INHERIT if its parent (textItemContainer) is controlling width

                                    let dynamicMultiplier = UPDATER_BASE_CHARACTER_MULTIPLIER;
                                    const textMainStyle = typeSystem[STYLE_KEYS.TEXT_MAIN];
                                    if (textMainStyle && textMainStyle.size && textMainStyle.size > 0 && textStyle.size > 0) {
                                        const sizeRatio = textStyle.size / textMainStyle.size;
                                        dynamicMultiplier = UPDATER_BASE_CHARACTER_MULTIPLIER * Math.pow(sizeRatio, -UPDATER_LINE_LENGTH_ADJUSTMENT_FACTOR);
                                        dynamicMultiplier = Math.max(UPDATER_BASE_CHARACTER_MULTIPLIER * 0.7, Math.min(dynamicMultiplier, UPDATER_BASE_CHARACTER_MULTIPLIER * 1.3));
                                    }
                                    let targetMaxWidth = Math.round(textStyle.size * dynamicMultiplier * TEXT_MAX_WIDTH_MULTIPLIER);
                                    targetMaxWidth = Math.max(TEXT_MAX_WIDTH_MIN, Math.min(targetMaxWidth, TEXT_MAX_WIDTH_MAX));
                                    
                                    try {
                                        if (textNode.maxWidth !== targetMaxWidth) {
                                            textNode.maxWidth = targetMaxWidth;
                                        }
                                    } catch (e) {
                                        console.warn(`[SpecimenCompactLayout.update] Failed to set/update maxWidth on ${textNode.name}: ${e}`);
                                    }
                                }
                                if (labelSpecsRow) {
                                    labelSpecsRow.opacity = showSpecLabels ? 1 : 0;
                                    if (showSpecLabels) await updateSpecsInRow(labelSpecsRow, textStyle, params.namingConvention, lineHeightUnit, group.text as string);
                                }
                            }
                        })());
                    }
                });
            } else { console.warn('[SpecimenCompactLayout.update] Could not find Right Column (Text)');}

            // --- Update Bottom Content Row ---
            const bottomRowFrame = frame.children.find(n => n.name === "Bottom Content Row") as FrameNode | undefined;
            const bottomLeftColumnFrame = bottomRowFrame?.children.find(n => n.name === "Left Column (Headings)") as FrameNode | undefined;
            const bottomRightColumnFrame = bottomRowFrame?.children.find(n => n.name === "Right Column (Text)") as FrameNode | undefined;

            // Update Bottom Left Column (Heading items with secondary font)
            if (bottomLeftColumnFrame) {
                const bottomHeadingItems = bottomLeftColumnFrame.children.filter(n => n.type === 'FRAME' && n.name.startsWith(FIGMA_NODE_NAMES.ITEM_PREFIX)) as FrameNode[];
                
                bottomHeadingItems.forEach(itemContainer => {
                updatePromises.push((async () => {
                        if (itemContainer.name === "Item - Headings") {
                            itemContainer.name = "Item - Heading";
                        }
                        // Apply layout grid to bottom heading item
                        applyLayoutGridToItem(itemContainer, showGrid, roundingGridSize);
                        
                        const textNode = itemContainer.children.find(n => n.type === 'TEXT') as TextNode | undefined;
                        if (textNode) {
                            // Use largest visible style overall for decorative sample (both headings and text)
                            const largestVisibleStyle = getLargestVisibleStyle(typeSystem, styleVisibility);
                            if (largestVisibleStyle.style) {
                                const headingFontFamily = largestVisibleStyle.style.fontFamily || secondaryFontFamily || baseFontFamily;
                                const headingFontStyleName = largestVisibleStyle.style.fontStyle || secondaryFontStyle || selectedStyle || 'Regular';
                                const fontForStyle = getValidFont(headingFontFamily, headingFontStyleName, availableFontsList);
                                
                                if (textNode.name === "Decorative Aa Headings") {
                                    // 🎯 FIX: Decorative elements should ONLY use largest SIZE, ignore grid font/case overrides
                                    // Create clean style with only size, using main section font settings
                                    const decorativeStyle = {
                                        size: largestVisibleStyle.style.size, // Only use the size from largest visible
                                        fontFamily: fontForStyle.family, // Use main section secondary font
                                        fontStyle: fontForStyle.style,   // Use main section secondary weight
                                        lineHeight: largestVisibleStyle.style.lineHeight, // Keep line height
                                        letterSpacing: DECORATIVE_AA_FIXED_LETTER_SPACING, // Fixed -1.5% letter spacing
                                        // Explicitly exclude textCase to keep "Aa" as "Aa"
                                    };
                                    await applyTextStyleToNode(textNode, decorativeStyle, fontForStyle, availableFontsList);
                                    textNode.fills = [{ type: 'SOLID', color: textColor }];
                                    // Ensure content stays as "Aa" regardless of text case settings
                                    if (textNode.characters !== "Aa") {
                                        textNode.characters = "Aa";
                                    }
                                    
                                    // Update Style Label and Weight Spec for bottom heading row
                                    const labelSpecsRow = itemContainer.children.find(n => n.name.startsWith('LabelSpecs')) as FrameNode | undefined;
                                    if (labelSpecsRow) {
                                        // Toggle visibility based on showSpecLabels
                                        labelSpecsRow.opacity = showSpecLabels ? 1 : 0;
                                        
                                        await ensureFamilySpecNode(labelSpecsRow, fontForStyle.family);
                                        const styleLabel = labelSpecsRow.children.find(n => n.name === 'Style Label') as TextNode | undefined;
                                        await configureStyleLabelForFamily(styleLabel, styleLabel?.characters || 'Heading');
                                        
                                        // Ensure bottom row uses Weight-only spec structure
                                        let weightSpec = labelSpecsRow.children.find(n => n.name.includes('Weight Spec')) as TextNode | undefined;
                                        const legacySizeSpec = labelSpecsRow.children.find(n => n.name.includes('Size Spec')) as TextNode | undefined;
                                        const legacyLineHeight = labelSpecsRow.children.find(n => n.name.includes('LineHeight Spec')) as TextNode | undefined;
                                        const legacyLetterSpacing = labelSpecsRow.children.find(n => n.name.includes('LetterSpacing Spec')) as TextNode | undefined;
                                        if (!weightSpec && legacySizeSpec) {
                                            legacySizeSpec.name = "Weight Spec - Heading";
                                            weightSpec = legacySizeSpec;
                                        }
                                        if (legacyLineHeight) legacyLineHeight.remove();
                                        if (legacyLetterSpacing) legacyLetterSpacing.remove();
                                        if (weightSpec) {
                                            if (weightSpec.name === "Weight Spec - Headings") {
                                                weightSpec.name = "Weight Spec - Heading";
                                            }
                                            weightSpec.characters = fontForStyle.style;
                                            weightSpec.textAutoResize = 'WIDTH_AND_HEIGHT';
                                            weightSpec.layoutAlign = 'INHERIT';
                                            weightSpec.textAlignHorizontal = 'RIGHT';
                                        }
                                    }
                            } else if (textNode.name === "Heading Character Set") {
                                    const h6Style = typeSystem[STYLE_KEYS.H6];
                                    if (h6Style) {
                                        const headingCharFamily = h6Style.fontFamily || secondaryFontFamily || baseFontFamily;
                                        const headingCharStyleName = h6Style.fontStyle || secondaryFontStyle || selectedStyle;
                                        const headingCharFont = getValidFont(headingCharFamily, headingCharStyleName, availableFontsList);
                                        const characterSetStyle = {
                                            ...h6Style,
                                            fontFamily: headingCharFont.family,
                                            fontStyle: headingCharFont.style,
                                            lineHeight: CHARACTER_SET_FIXED_LINE_HEIGHT,
                                            letterSpacing: CHARACTER_SET_FIXED_LETTER_SPACING,
                                        };
                                        await applyTextStyleToNode(textNode, characterSetStyle, headingCharFont, availableFontsList);
                                        textNode.fills = [{ type: 'SOLID', color: textColor }];
                                    }
                            }
                            }
                        }
                    })());
                });
            } else { console.warn('[SpecimenCompactLayout.update] Could not find Bottom Left Column (Headings)');}

            // Update Bottom Right Column (Text items with primary font)
            if (bottomRightColumnFrame) {
                const bottomTextItems = bottomRightColumnFrame.children.filter(n => n.type === 'FRAME' && n.name.startsWith(FIGMA_NODE_NAMES.ITEM_PREFIX)) as FrameNode[];
                logDebug(`[SpecimenCompactLayout.update] Found ${bottomTextItems.length} bottom text items:`, bottomTextItems.map(i => i.name));
                
                bottomTextItems.forEach(itemContainer => {
                    updatePromises.push((async () => {
                        // Apply layout grid to bottom text item
                        applyLayoutGridToItem(itemContainer, showGrid, roundingGridSize);
                        
                        const textNode = itemContainer.children.find(n => n.type === 'TEXT') as TextNode | undefined;
                        logDebug(`[SpecimenCompactLayout.update] Processing item "${itemContainer.name}", textNode found: ${textNode?.name || 'none'}`);
                        if (textNode) {
                            // 🎯 FIX: Get font from typeSystem (like top text items) instead of params, so it updates immediately during preview
                            const textMainStyle = typeSystem[STYLE_KEYS.TEXT_MAIN];
                            const currentPrimaryFont = textMainStyle?.fontFamily || baseFontFamily;
                            const currentPrimaryStyle = textMainStyle?.fontStyle || primaryFontStyle;
                            const primaryFontForText = getValidFont(currentPrimaryFont, currentPrimaryStyle, availableFontsList);
                            
                            if (textNode.name === "Decorative Aa Text") {
                                logDebug('[SpecimenCompactLayout.update] ✅ Updating Decorative Aa Text');
                                // Use largest visible style overall for decorative sample (same as headings)
                                const largestVisibleStyle = getLargestVisibleStyle(typeSystem, styleVisibility);
                                if (largestVisibleStyle.style) {
                                    // 🎯 FIX: Decorative elements should ONLY use largest SIZE, ignore grid font/case overrides
                                    // Create clean style with only size, using main section font settings
                                    const decorativeStyle = {
                                        size: largestVisibleStyle.style.size, // Only use the size from largest visible
                                        fontFamily: primaryFontForText.family, // Use main section primary font
                                        fontStyle: primaryFontForText.style,   // Use main section primary weight
                                        lineHeight: largestVisibleStyle.style.lineHeight, // Keep line height
                                        letterSpacing: DECORATIVE_AA_FIXED_LETTER_SPACING, // Fixed -1.5% letter spacing
                                        // Explicitly exclude textCase to keep "Aa" as "Aa"
                                    };
                                    logDebug('[SpecimenCompactLayout.update] Decorative style being applied:', decorativeStyle, 'Font:', primaryFontForText);
                                    await applyTextStyleToNode(textNode, decorativeStyle, primaryFontForText, availableFontsList);
                                    textNode.fills = [{ type: 'SOLID', color: textColor }];
                                    // Ensure content stays as "Aa" regardless of text case settings
                                    if (textNode.characters !== "Aa") {
                                        textNode.characters = "Aa";
                                    }
                                    
                                    // Update Style Label and Weight Spec for bottom text row
                                    const labelSpecsRow = itemContainer.children.find(n => n.name.startsWith('LabelSpecs')) as FrameNode | undefined;
                                    if (labelSpecsRow) {
                                        // Toggle visibility based on showSpecLabels
                                        labelSpecsRow.opacity = showSpecLabels ? 1 : 0;
                                        
                                        await ensureFamilySpecNode(labelSpecsRow, primaryFontForText.family);
                                        const styleLabel = labelSpecsRow.children.find(n => n.name === 'Style Label') as TextNode | undefined;
                                        await configureStyleLabelForFamily(styleLabel, styleLabel?.characters || 'Text');
                                        
                                        // Ensure bottom row uses Weight-only spec structure
                                        let weightSpec = labelSpecsRow.children.find(n => n.name.includes('Weight Spec')) as TextNode | undefined;
                                        const legacySizeSpec = labelSpecsRow.children.find(n => n.name.includes('Size Spec')) as TextNode | undefined;
                                        const legacyLineHeight = labelSpecsRow.children.find(n => n.name.includes('LineHeight Spec')) as TextNode | undefined;
                                        const legacyLetterSpacing = labelSpecsRow.children.find(n => n.name.includes('LetterSpacing Spec')) as TextNode | undefined;
                                        if (!weightSpec && legacySizeSpec) {
                                            legacySizeSpec.name = "Weight Spec - Text";
                                            weightSpec = legacySizeSpec;
                                        }
                                        if (legacyLineHeight) legacyLineHeight.remove();
                                        if (legacyLetterSpacing) legacyLetterSpacing.remove();
                                        if (weightSpec) {
                                            weightSpec.characters = primaryFontForText.style;
                                            weightSpec.textAutoResize = 'WIDTH_AND_HEIGHT';
                                            weightSpec.layoutAlign = 'INHERIT';
                                            weightSpec.textAlignHorizontal = 'RIGHT';
                                        }
                                    }
                                }
                            } else if (textNode.name === "Text Character Set") {
                                // 🎯 FIX: Character sets should use main section fonts, not grid overrides
                                // Apply textMain style with main section primary font settings
                                const textMainStyle = typeSystem[STYLE_KEYS.TEXT_MAIN];
                                if (textMainStyle) {
                                    // Create clean style with textMain size but main section primary font
                                    const characterSetStyle = {
                                        size: textMainStyle.size,
                                        fontFamily: primaryFontForText.family, // Use main section primary font
                                        fontStyle: primaryFontForText.style,   // Use main section primary weight
                                        lineHeight: CHARACTER_SET_FIXED_LINE_HEIGHT,
                                        letterSpacing: CHARACTER_SET_FIXED_LETTER_SPACING,
                                        // No textCase for character sets
                                    };
                                    await applyTextStyleToNode(textNode, characterSetStyle, primaryFontForText, availableFontsList);
                                    textNode.fills = [{ type: 'SOLID', color: textColor }];
                                }
                            }
                        }
                })());
                });
            } else { console.warn('[SpecimenCompactLayout.update] Could not find Bottom Right Column (Text)');}



            await Promise.all(updatePromises);
            syncBottomRowWidthsToTop(
                topRowFrame,
                leftColumnFrame,
                rightColumnFrame,
                bottomRowFrame,
                bottomLeftColumnFrame,
                bottomRightColumnFrame
            );
            logDebug('[SpecimenCompactLayout.update] Update finished.');

        } catch (error) {
            console.error('[SpecimenCompactLayout.update] Error:', error);
            figma.notify("Error updating Specimen Compact Preview. Check console.", { error: true });
        }
    }
}

// Helper function to register this layout (optional, can be done in a central place)
// import { registerPreviewLayout } from '../preview-layout-registry';
// registerPreviewLayout(new SpecimenCompactLayout()); 