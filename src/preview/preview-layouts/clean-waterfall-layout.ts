/**
 * ⚠️ DISCONTINUED LAYOUT
 * This layout has been removed from the UI but kept in the codebase for reference.
 * The Specimen layout provides a more comprehensive and polished view.
 * Last active: Nov 2025
 */

import {
    FontInfo,
    PreviewLayout,
    PreviewLayoutHandlerParams,
    PreviewLayoutType,
    TypographyStyle,
    TypographySystem,
    PreviewCreateResult
} from '../../core/types';
import {
    FRAME_CORNER_RADIUS,
    INTER_REGULAR,
    SPEC_FONT_SIZE,
    LAYOUT_BASE_NAMES,
    TYPOGRAPHY_SCALE_ORDER
} from '../../core/constants';
import { getDisplayName, getDisplayNameWithConvention, getValidFont, applyTextStyleToNode, updateSpecsInRow, renameNodesForConvention } from '../../services/utils';
import { getCurrentPreviewTheme } from '../../core/preview-theme-state';

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

export class CleanWaterfallLayout implements PreviewLayout {
    getLayoutType(): PreviewLayoutType {
        return 'cleanWaterfall';
    }

    getBaseName(): string {
        return 'Waterfall';
    }

    async create(params: PreviewLayoutHandlerParams): Promise<PreviewCreateResult | null> {
        const {
            typeSystem,
            selectedStyle, // This is baseFontStyle
            showSpecLabels,
            currentColorMode,
            availableFontsList,
            baseFontFamily, // This is mainFamily
            // baseFontStyle is selectedStyle
            newX, // This is targetX
            showGrid = false, // ADDED: Default to false if not provided
            roundingGridSize = 0 // ADDED: Default to 0 if not provided
            // activeMode and activeScaleRatio are not used by this specific create method but are part of params
        } = params;

        const nodeMap = new Map<string, string[]>();

        console.log('[CleanWaterfallLayout.create] Starting creation.');
        try {
            // --- Preload necessary fonts ---
            const fontsToLoad = new Set<FontName>();
            fontsToLoad.add({ family: baseFontFamily, style: selectedStyle });
            if (selectedStyle !== 'Regular') {
                fontsToLoad.add({ family: baseFontFamily, style: 'Regular' });
            }
            const displayStyle = typeSystem.display;
            if (displayStyle) {
                const displayFamily = displayStyle.fontFamily || baseFontFamily;
                const displayStyleName = displayStyle.fontStyle || selectedStyle;
                if (displayFamily !== baseFontFamily || displayStyleName !== selectedStyle) {
                    fontsToLoad.add({ family: displayFamily, style: displayStyleName });
                }
                if (displayStyleName !== 'Regular' && (displayFamily !== baseFontFamily || 'Regular' !== selectedStyle)) {
                    fontsToLoad.add({ family: displayFamily, style: 'Regular' });
                }
            }
            const microStyle = typeSystem.micro;
            if (microStyle) {
                const microFamily = microStyle.fontFamily || baseFontFamily;
                const microStyleName = microStyle.fontStyle || selectedStyle;
                if (microFamily !== baseFontFamily || microStyleName !== selectedStyle) {
                    fontsToLoad.add({ family: microFamily, style: microStyleName });
                }
                if (microStyleName !== 'Regular' && (microFamily !== baseFontFamily || 'Regular' !== selectedStyle)) {
                    fontsToLoad.add({ family: microFamily, style: 'Regular' });
                }
            }
            fontsToLoad.add(INTER_REGULAR);

            let interRegularLoaded = false;
            try {
                await figma.loadFontAsync(INTER_REGULAR);
                interRegularLoaded = true;
            } catch (e) { console.warn('[CleanWaterfallLayout.create] Failed preloading Inter Regular.'); }

            const fontLoadPromises = Array.from(fontsToLoad)
                .filter(font => !(font.family === INTER_REGULAR.family && font.style === INTER_REGULAR.style))
                .map(font =>
                    figma.loadFontAsync(font).catch(e => console.warn(`[CleanWaterfallLayout.create] Font load failed: ${font.family} ${font.style}`, e))
                );
            await Promise.all(fontLoadPromises);

            // --- Create main frame ---
            const frame = figma.createFrame();
            frame.name = this.getBaseName();
            frame.x = newX || 0;

            const theme = getCurrentPreviewTheme();
            const textColor = theme.text;

            frame.resize(1440, 100); // Initial height, will be auto
            frame.layoutMode = 'VERTICAL';
            frame.primaryAxisSizingMode = 'AUTO';
            frame.counterAxisSizingMode = 'FIXED';
            frame.itemSpacing = 120;
            frame.paddingTop = 64;
            frame.paddingRight = 64;
            frame.paddingBottom = 64;
            frame.paddingLeft = 64;
            frame.fills = [{ type: 'SOLID', color: theme.background }];
            frame.cornerRadius = FRAME_CORNER_RADIUS;
            frame.clipsContent = false;

            // Font Display Name removed per user request

            const textStylesGroup = figma.createFrame();
            textStylesGroup.name = "Text";
            textStylesGroup.layoutMode = 'VERTICAL';
            textStylesGroup.primaryAxisSizingMode = 'AUTO';
            textStylesGroup.counterAxisSizingMode = 'FIXED';
            textStylesGroup.layoutAlign = 'STRETCH';
            textStylesGroup.itemSpacing = 24;
            textStylesGroup.fills = [];
            textStylesGroup.clipsContent = false;

            const headingStylesGroup = figma.createFrame();
            headingStylesGroup.name = "Headers";
            headingStylesGroup.layoutMode = 'VERTICAL';
            headingStylesGroup.primaryAxisSizingMode = 'AUTO';
            headingStylesGroup.counterAxisSizingMode = 'FIXED';
            headingStylesGroup.layoutAlign = 'STRETCH';
            headingStylesGroup.itemSpacing = 24;
            headingStylesGroup.fills = [];
            headingStylesGroup.clipsContent = false;

            frame.appendChild(textStylesGroup);
            frame.appendChild(headingStylesGroup);

            const sampleText = "abcdefghijklmnopqrstuvwxyz1234567";
            const textStyleKeys: (keyof TypographySystem)[] = [...TYPOGRAPHY_SCALE_ORDER.TEXT_STYLES];
            const headingStyleKeys: (keyof TypographySystem)[] = [...TYPOGRAPHY_SCALE_ORDER.HEADINGS];

            const createWaterfallItemInternal = async (styleKey: string, style: TypographyStyle, targetGroup: FrameNode, namingConvention: string) => {
                const itemContainer = figma.createFrame();
                itemContainer.name = `Item - ${styleKey}`;
                itemContainer.layoutMode = 'VERTICAL';
                itemContainer.primaryAxisSizingMode = 'AUTO';
                itemContainer.counterAxisSizingMode = 'FIXED';
                itemContainer.layoutAlign = 'STRETCH';
                itemContainer.itemSpacing = showSpecLabels ? 8 : 0;
                itemContainer.fills = [];
                itemContainer.clipsContent = false;

                const textNode = figma.createText();
                textNode.name = styleKey;
                const family = style.fontFamily || baseFontFamily;
                const styleToApply = style.fontStyle || selectedStyle;
                const fontToApply = getValidFont(family, styleToApply, availableFontsList);

                await applyTextStyleToNode(textNode, style, fontToApply, availableFontsList);
                textNode.characters = sampleText;
                textNode.fills = [{ type: 'SOLID', color: textColor }];
                textNode.layoutAlign = 'STRETCH';
                textNode.textAutoResize = 'HEIGHT';
                textNode.leadingTrim = 'CAP_HEIGHT';
                textNode.textTruncation = 'ENDING';
                // 🔄 OPTIMIZATION: Text node will be appended AFTER label specs row

                // Add to map
                if (!nodeMap.has(styleKey)) nodeMap.set(styleKey, []);
                nodeMap.get(styleKey)!.push(textNode.id);

                // 🔄 MOVED: Label specs row now comes FIRST, then text node
                const labelSpecsRow = figma.createFrame();
                labelSpecsRow.name = `LabelSpecs - ${styleKey}`;
                    labelSpecsRow.layoutMode = 'HORIZONTAL';
    labelSpecsRow.primaryAxisSizingMode = 'FIXED';
    labelSpecsRow.counterAxisSizingMode = 'FIXED';
    labelSpecsRow.resize(itemContainer.width, 16); // Fixed height of 16px
    labelSpecsRow.layoutAlign = 'STRETCH';
                labelSpecsRow.itemSpacing = 4;
                labelSpecsRow.fills = [];
                labelSpecsRow.opacity = showSpecLabels ? 1 : 0;
                labelSpecsRow.clipsContent = false;
                labelSpecsRow.paddingBottom = 4;
                labelSpecsRow.strokes = [{ type: 'SOLID', color: theme.specBorderColor, opacity: theme.specBorderOpacity }];
                labelSpecsRow.strokeBottomWeight = 1;

                const styleLabel = figma.createText();
                styleLabel.name = `Style Label - ${styleKey}`;
                if (interRegularLoaded) styleLabel.fontName = INTER_REGULAR;
                styleLabel.characters = getDisplayName(styleKey);
                styleLabel.fontSize = SPEC_FONT_SIZE;
                styleLabel.fills = [{ type: 'SOLID', color: theme.specColor, opacity: theme.specColorOpacity }];
                styleLabel.layoutGrow = 1;
                styleLabel.textAutoResize = 'HEIGHT';
                styleLabel.layoutAlign = 'STRETCH'; // Changed from MIN to STRETCH
                styleLabel.leadingTrim = 'CAP_HEIGHT';
                labelSpecsRow.appendChild(styleLabel);

                const roundedSize = Math.round(style.size * 2) / 2;
                const sizeString = `${roundedSize}px`;
                
                // Line height calculation based on unit preference
                let lineHeightString: string;
                if (params.lineHeightUnit === 'px') {
                    const lineHeightInPx = Math.round(style.lineHeight * style.size);
                    lineHeightString = `${lineHeightInPx}px`;
                } else {
                    lineHeightString = `${Math.round(style.lineHeight * 100)}%`;
                }
                
                const lsValue = style.letterSpacing;
                const lsRounded = Math.round((lsValue ?? 0) / 0.25) * 0.25;
                const quarterSteps = Math.round(lsRounded / 0.25);
                const lsString = `${quarterSteps % 4 === 0 ? lsRounded.toFixed(0) : quarterSteps % 2 === 0 ? lsRounded.toFixed(1) : lsRounded.toFixed(2)}%`;
                const sizeWidth = 30, lineHeightWidth = 35, letterSpacingWidth = 35;

                const createSpecNode = async (specName: string, value: string, width: number): Promise<TextNode> => {
                    const node = figma.createText();
                    // 🔧 FIX: Use display name instead of internal key for spec node names
                    const styleDisplayName = getDisplayNameWithConvention(styleKey, namingConvention || 'Default Naming');
                    node.name = `${specName} Spec - ${styleDisplayName}`;
                    if (interRegularLoaded) node.fontName = INTER_REGULAR;
                    node.characters = value;
                    node.fontSize = SPEC_FONT_SIZE;
                    node.fills = [{ type: 'SOLID', color: theme.specColor, opacity: theme.specColorOpacity }];
                    node.textAlignHorizontal = 'RIGHT';
                    node.leadingTrim = 'CAP_HEIGHT';
                    node.textAutoResize = 'HEIGHT';
                    node.layoutAlign = 'INHERIT';
                    node.resize(width, node.height); // Set fixed width
                    return node;
                };
                labelSpecsRow.appendChild(await createSpecNode("Size", sizeString, sizeWidth));
                labelSpecsRow.appendChild(await createSpecNode("LineHeight", lineHeightString, lineHeightWidth));
                labelSpecsRow.appendChild(await createSpecNode("LetterSpacing", lsString, letterSpacingWidth));

                itemContainer.appendChild(labelSpecsRow);
                
                // 🔄 OPTIMIZATION: Append text node AFTER label specs (swapped order)
                itemContainer.appendChild(textNode);
                
                // Apply layout grid to waterfall item
                applyLayoutGridToItem(itemContainer, showGrid, roundingGridSize);
                
                // Handle visibility for entire item container
                if (params.styleVisibility && params.styleVisibility[styleKey] !== undefined) {
                    const isVisible = params.styleVisibility[styleKey];
                    
                    if (isVisible) {
                        // Show: immediate restore entire item
                        itemContainer.opacity = 1;
                        itemContainer.visible = true;
                    } else {
                        // Hide: immediate collapse entire item
                        itemContainer.opacity = 0;
                        itemContainer.visible = false; // Collapses height in auto layout
                        console.log(`[CleanWaterfallLayout.create] ✅ HIDDEN style: ${styleKey}`);
                    }
                } else {
                    itemContainer.opacity = 1;
                    itemContainer.visible = true;
                }
                
                targetGroup.appendChild(itemContainer);
            };

            for (const styleKey of textStyleKeys) {
                const style = typeSystem[styleKey];
                if (style) await createWaterfallItemInternal(styleKey as string, style, textStylesGroup, params.namingConvention || 'Default Naming');
            }
            for (const styleKey of headingStyleKeys) {
                const style = typeSystem[styleKey];
                if (style) await createWaterfallItemInternal(styleKey as string, style, headingStylesGroup, params.namingConvention || 'Default Naming');
            }
            return { frame, nodeMap };
        } catch (error) {
            console.error('[CleanWaterfallLayout.create] Error:', error);
            figma.notify("Error creating Clean Waterfall preview. Check console.", { error: true });
            return null;
        }
    }

    async update(frame: FrameNode, params: PreviewLayoutHandlerParams): Promise<void> {
        const {
            typeSystem,
            selectedStyle, // This is baseFontStyle / globalStyle
            showSpecLabels,
            styleVisibility,
            currentColorMode,
            availableFontsList,
            baseFontFamily, // This is mainFamily
            showGrid = false, // ADDED: Grid overlay state
            roundingGridSize = 0, // ADDED: Grid size for overlays
            lineHeightUnit = 'percent' // ADDED: Line height unit for specs
            // activeMode, activeScaleRatio, newX are not directly used by this update method
        } = params;

        console.log('[CleanWaterfallLayout.update] Applying update.');
        try {
            const theme = getCurrentPreviewTheme();
            const textColor = theme.text;

            // Batch-preload all fonts before applying to nodes
            const fontsToLoad = new Set<string>();
            fontsToLoad.add(JSON.stringify({ family: baseFontFamily, style: selectedStyle }));
            fontsToLoad.add(JSON.stringify(INTER_REGULAR));
            Object.values(typeSystem).forEach(style => {
                if (style) {
                    fontsToLoad.add(JSON.stringify({ family: style.fontFamily || baseFontFamily, style: style.fontStyle || selectedStyle }));
                }
            });
            await Promise.all(Array.from(fontsToLoad).map(fontJson => {
                const font = JSON.parse(fontJson) as FontName;
                return figma.loadFontAsync(font).catch(e =>
                    console.warn(`[CleanWaterfallLayout.update] Font preload failed: ${font.family} ${font.style}`, e)
                );
            }));

            const textStylesGroup = frame.children.find(n => n.name === "Text") as FrameNode | undefined;
            const headingStylesGroup = frame.children.find(n => n.name === "Headers") as FrameNode | undefined;
            const updatePromises: Promise<void>[] = [];

            const updateItemGroup = async (groupFrame: FrameNode | undefined, styleKeys: (keyof TypographySystem)[]) => {
                if (!groupFrame) { console.warn("[CleanWaterfallLayout.update] Group frame missing."); return; }
                const itemNodes = groupFrame.children.filter(n => n.type === 'FRAME' && n.name.startsWith('Item -')) as FrameNode[];
                const itemMap = new Map(itemNodes.map(node => [node.name.replace('Item - ', ''), node]));
                
                for (const styleKey of styleKeys) {
                    const styleToUse = typeSystem[styleKey];
                    const itemContainer = itemMap.get(styleKey as string);
                    if (styleToUse && itemContainer) {
                        updatePromises.push((async () => {
                            // 🏷️ RENAME NODES: Ensure nodes match current naming convention  
                            await renameNodesForConvention(itemContainer, styleKey as string, params.namingConvention || 'Default Naming');
                            
                            // Apply layout grid to waterfall item
                            applyLayoutGridToItem(itemContainer, showGrid, roundingGridSize);
                            
                            const textNode = itemContainer.children.find(n => n.type === 'TEXT' && n.name === styleKey) as TextNode | undefined;
                            const labelSpecsRow = itemContainer.children.find(n => n.name.startsWith('LabelSpecs')) as FrameNode | undefined;
                            
                            // Handle visibility for entire item container
                            if (styleVisibility && styleVisibility[styleKey as string] !== undefined) {
                                const isVisible = styleVisibility[styleKey as string];
                                
                                if (isVisible) {
                                    // Show: immediate restore entire item
                                    itemContainer.opacity = 1;
                                    itemContainer.visible = true;
                                } else {
                                    // Hide: immediate collapse entire item
                                    itemContainer.opacity = 0;
                                    itemContainer.visible = false; // Collapses height in auto layout
                                }
                            } else {
                                itemContainer.opacity = 1;
                                itemContainer.visible = true;
                            }
                            
                            if (textNode) {
                                const itemFamily = styleToUse.fontFamily || baseFontFamily;
                                const itemStyle = styleToUse.fontStyle || selectedStyle;
                                const finalItemFont = getValidFont(itemFamily, itemStyle, availableFontsList);
                                await applyTextStyleToNode(textNode, styleToUse, finalItemFont, availableFontsList);
                                textNode.fills = [{ type: 'SOLID', color: textColor }];
                            } else { console.warn(`[CleanWaterfallLayout.update] Text node missing for ${styleKey}`); }

                            if (labelSpecsRow) {
                                labelSpecsRow.opacity = showSpecLabels ? 1 : 0;
                                if (showSpecLabels) {
                                    // Re-fetch style to ensure latest for specs, though styleToUse should be current
                                    const latestStyleForSpec = typeSystem[styleKey]; 
                                    if (latestStyleForSpec) {
                                        await updateSpecsInRow(labelSpecsRow, latestStyleForSpec, params.namingConvention, lineHeightUnit, styleKey as string); // Pass naming convention, lineHeightUnit, and internal key
                                    } else {
                                        console.warn(`[CleanWaterfallLayout.update] Could not find latest style for ${styleKey} in typeSystem for specs.`);
                                    }
                                }
                            } else if (showSpecLabels) { console.warn(`[CleanWaterfallLayout.update] LabelSpecs row missing for ${styleKey}`); }
                        })());
                    } else if (!itemContainer) { console.warn(`[CleanWaterfallLayout.update] Item container missing for ${styleKey}`); }
                }
            };

            const textStyleKeysToUpdate: (keyof TypographySystem)[] = [...TYPOGRAPHY_SCALE_ORDER.TEXT_STYLES];
            const headingStyleKeysToUpdate: (keyof TypographySystem)[] = [...TYPOGRAPHY_SCALE_ORDER.HEADINGS];

            await updateItemGroup(textStylesGroup, textStyleKeysToUpdate);
            await updateItemGroup(headingStylesGroup, headingStyleKeysToUpdate);
            await Promise.all(updatePromises); // Await all collected promises from individual item updates

        } catch (error) {
            console.error('[CleanWaterfallLayout.update] Error:', error);
            figma.notify("Error updating Clean Waterfall preview. Check console.", { error: true });
        }
    }
}

// Optional: For direct registration if this file is imported early enough
// import { registerPreviewLayout } from '../preview-layout-registry';
// registerPreviewLayout(new CleanWaterfallLayout()); 