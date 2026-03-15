/**
 * ⚠️ DISCONTINUED LAYOUT
 * This layout (Article/Structured Text) has been removed from the UI but kept in the codebase for reference.
 * The Specimen layout provides a more comprehensive and polished view.
 * Last active: Nov 2025
 */

import {
    PreviewLayout,
    PreviewLayoutHandlerParams,
    PreviewLayoutType,
    TypographyStyle,
    TypographySystem,
    FontInfo,
    PreviewCreateResult
} from '../../core/types';
import { LlmStructuredContent } from '../../api/llm-prompts';
import {
    LAYOUT_BASE_NAMES,
    FRAME_CORNER_RADIUS,
    INTER_REGULAR,
    SPEC_FONT_SIZE,
    NUMBERS_SET,
    UPPERCASE_SET,
    LOWERCASE_SET,
    SPECIAL_SET,
    TYPOGRAPHY_SCALE_POINTS,
    STYLE_KEYS,
    TYPOGRAPHY_SCALE_ORDER
} from '../../core/constants';
import { getCurrentPreviewTheme } from '../../core/preview-theme-state';
import {
    getValidFont,
    applyTextStyleToNode,
    updateSpecsInRow,
    getDisplayName,
    getDisplayNameWithConvention,
    renameNodesForConvention
} from '../../services/utils';
import { getInternalKeyForDisplayName } from '../../design-systems/base';
import { createStyleItem } from './layout-utils';
import { localArticleHeadline, localBodySentence, generateArticleContentWithLLM, generateLocalArticleContent, getOpenaiApiKey } from '../../api/openai-utils';

const DEFAULT_ITEM_SPACING = 16;
const DEFAULT_PADDING = 64;

// Helper function to apply layout grid to item containers (reused from other layouts)
const applyLayoutGridToItem = (itemContainer: FrameNode, showGrid: boolean, gridSize: number) => {
    if (!showGrid || gridSize === 0) {
        itemContainer.layoutGrids = [];
        return;
    }

    itemContainer.layoutGrids = [{
        pattern: 'ROWS' as const,
        alignment: 'MAX' as const,
        gutterSize: 0,
        offset: 0,
        count: Infinity,
        sectionSize: gridSize,
        visible: true,
        color: { r: 1, g: 0, b: 0, a: 0.1 }
    }];
};

export class StructuredTextLayout implements PreviewLayout {
    getLayoutType(): PreviewLayoutType {
        return 'structuredText';
    }

    getBaseName(): string {
        return 'Article';
    }

    async create(params: PreviewLayoutHandlerParams): Promise<PreviewCreateResult | null> {
        const {
            typeSystem,
            selectedStyle,
            showSpecLabels,
            currentColorMode,
            availableFontsList,
            baseFontFamily,
            activeScaleRatio,
            newX,
            llmOutput,
            lineHeightUnit = 'percent',
            showGrid = false,
            roundingGridSize = 0,
            namingConvention
        } = params;

        const nodeMap = new Map<string, string[]>();

                    console.log('[StructuredTextLayout.create] Creating advanced article layout with specimens');

                    console.log('[StructuredTextLayout.create] Creating article layout - checking for LLM vs generated content');

        try {
            // --- Font Loading --- 
            const fontsToLoad = new Set<FontName>();
            fontsToLoad.add(INTER_REGULAR);

            // Add fonts from typeSystem
            Object.values(typeSystem).forEach(style => {
                fontsToLoad.add({ 
                    family: style.fontFamily || baseFontFamily, 
                    style: style.fontStyle || selectedStyle 
                });
            });

            await Promise.all(Array.from(fontsToLoad).map(font =>
                figma.loadFontAsync(font).catch(e =>
                    console.warn(`[StructuredTextLayout.create] Font load failed: ${font.family} ${font.style}`, e)
                )
            ));

            // --- Main Frame Setup ---
            const frame = figma.createFrame();
            frame.name = this.getBaseName();
            frame.x = newX || 0;
            frame.layoutMode = 'VERTICAL';
            frame.primaryAxisSizingMode = 'AUTO';
            frame.counterAxisSizingMode = 'FIXED';
            frame.resize(1440, 100); // Will auto-size height
            frame.itemSpacing = 64;
            frame.paddingTop = DEFAULT_PADDING;
            frame.paddingBottom = DEFAULT_PADDING;
            frame.paddingLeft = DEFAULT_PADDING;
            frame.paddingRight = DEFAULT_PADDING;
            frame.cornerRadius = FRAME_CORNER_RADIUS;
            frame.clipsContent = false;

            const theme = getCurrentPreviewTheme();
            const textColor = theme.text;
            frame.fills = [{ type: 'SOLID', color: theme.background }];

            // Font Display Name removed per user request

            // --- Generate All Content First ---
                    // Use LLM content if it's real content, otherwise generate fresh content
        const headingElement = llmOutput?.elements?.find(el => el.role === STYLE_KEYS.H1 || el.role === STYLE_KEYS.DISPLAY);
            let mainHeadingContent: string;
            let leftColumnItems: any[] = [];
            let rightColumnItems: any[] = [];
            
            // Check if we have real LLM content (from text input flow) vs placeholder content
            const hasRealLLMContent = llmOutput?.elements && 
                llmOutput.elements.length > 1 && 
                llmOutput.elements.some(el => el.content && 
                    el.content !== "Article Headline" && 
                    el.content !== "Article" &&
                    !el.content.includes("This is a larger body text") &&
                    !el.content.includes("Lorem ipsum") &&
                    !el.content.includes("Section Subheading") &&
                    !el.content.includes("Another Subheading") &&
                    el.content.length > 20) &&
                llmOutput.suggestedFrameTitle !== "Placeholder Article";
            
            console.log(`[StructuredTextLayout.create] 🔍 LLM content detection:
                - Has llmOutput: ${!!llmOutput}
                - Elements count: ${llmOutput?.elements?.length || 0}
                - Suggested title: "${llmOutput?.suggestedFrameTitle || 'none'}"
                - Has real LLM content: ${hasRealLLMContent}`);
            
            if (hasRealLLMContent) {
                console.log('[StructuredTextLayout.create] Using LLM processed content from text input flow');
                
                // Use the heading from LLM processed content
                if (headingElement && headingElement.content && headingElement.content !== "Article Headline" && headingElement.content.length > 10) {
                    mainHeadingContent = headingElement.content;
                    console.log(`[StructuredTextLayout.create] Using LLM headline: "${mainHeadingContent}"`);
                } else {
                    mainHeadingContent = localArticleHeadline();
                    console.log(`[StructuredTextLayout.create] Generated fresh headline: "${mainHeadingContent}"`);
                }
                
                // Use LLM processed content for columns
                for (let i = 0; i < llmOutput.elements.length; i++) {
                const element = llmOutput.elements[i];
                    
                    // Skip the main heading we already processed
                    if (element.role === STYLE_KEYS.H1 || element.role === STYLE_KEYS.DISPLAY) continue;

                    if (element.role === STYLE_KEYS.MICRO || element.role === STYLE_KEYS.TEXT_SMALL) {
                        leftColumnItems.push(element);
                    } else if (element.role === STYLE_KEYS.TEXT_MAIN || element.role === STYLE_KEYS.TEXT_LARGE) {
                        rightColumnItems.push(element);
                    } else if (typeof element.role === 'string' && element.role.startsWith('h')) {
                        rightColumnItems.push(element);
                    }
                }
            } else {
                console.log('[StructuredTextLayout.create] 📋 ARTICLE LAYOUT: Entering LLM content generation path for generator screen');
                console.log(`[StructuredTextLayout.create] 🔍 Debug info:
                    - Layout type: ${this.getLayoutType()}
                    - Has llmOutput: ${!!llmOutput}
                    - llmOutput elements length: ${llmOutput?.elements?.length || 0}
                    - API key passed: ${!!params.apiKey}`);
                
                // ⚠️ SAFETY CHECK: This should ONLY run for structured text (article) layouts
                if (this.getLayoutType() !== 'structuredText') {
                    console.error('[StructuredTextLayout.create] ❌ CRITICAL ERROR: LLM generation attempted on non-article layout!');
                    throw new Error('LLM article generation should only be used for article layouts');
                }
                
                // Try to generate LLM content, fall back to local if no API key or error
                let articleContent: any = null;
                let apiKey = params.apiKey;
                
                // If no API key passed through params, try to get it from storage
                if (!apiKey) {
                    const keyFromStorage = await getOpenaiApiKey();
                    apiKey = keyFromStorage || undefined;
                    console.log(`[StructuredTextLayout.create] API key from storage: ${apiKey ? 'found' : 'not found'}`);
                }
                
                if (apiKey) {
                    try {
                        console.log(`[StructuredTextLayout.create] 🚀 Attempting LLM article generation with API key: ${apiKey.substring(0, 7)}...`);
                        articleContent = await generateArticleContentWithLLM(apiKey);

                        if (articleContent) {
                            console.log('[StructuredTextLayout.create] ✅ LLM generation successful:', {
                                headline: articleContent.headline,
                                bodyParagraphs: articleContent.bodyParagraphs?.length || 0,
                                subheadings: articleContent.subheadings?.length || 0
                            });
                        } else {
                            console.warn('[StructuredTextLayout.create] ⚠️ LLM generation returned null/incomplete data');
                        }
                    } catch (error) {
                        console.error('[StructuredTextLayout.create] ❌ LLM generation failed with error:', error);
                        articleContent = null;
                    }
                } else {
                    console.log('[StructuredTextLayout.create] 🔑 No API key available, using local content generation');
                }

                // Limit textLarge to 4 lines (approximately 300-400 characters)
            const limitToFourLines = (text: string): string => {
                const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
                let result = '';
                let lineCount = 0;
                
                for (let i = 0; i < sentences.length && lineCount < 4; i++) {
                    const sentence = sentences[i].trim() + (i < sentences.length - 1 ? '.' : '');
                    const newResult = result + (result ? ' ' : '') + sentence;
                    if (newResult.length > 350) break; // Roughly 4 lines worth
                    result = newResult;
                    lineCount = Math.ceil(result.length / 80); // Estimate lines
                }
                return result + (result.endsWith('.') ? '' : '.');
            };

            // Use LLM content if available, otherwise use local generation
                if (articleContent) {
                    console.log('[StructuredTextLayout.create] ✅ Using LLM-generated article content');
                    
                    // Use LLM headline
                    mainHeadingContent = articleContent.headline || localArticleHeadline();
                    console.log(`[StructuredTextLayout.create] Using LLM headline: "${mainHeadingContent}"`);
                    
                    // Create 5-line synopsis for LLM content
                    const synopsis = `${articleContent.headline.replace('\n', ' ')}\n\nA comprehensive exploration covering fundamental principles, practical applications, and contemporary developments.\n\nKey insights and methodologies examined through expert analysis.`;
                    leftColumnItems = [
                        { 
                            role: STYLE_KEYS.MICRO, 
                            content: synopsis
                        }
                    ];

                    rightColumnItems = [
                        { 
                            role: STYLE_KEYS.TEXT_LARGE, 
                            content: limitToFourLines(articleContent.bodyParagraphs[0] || localBodySentence())
                        },
                        { 
                            role: STYLE_KEYS.H4, 
                            content: articleContent.subheadings[0] || localArticleHeadline().replace('\n', ' ')
                        },
                        { 
                            role: STYLE_KEYS.TEXT_MAIN, 
                            content: articleContent.bodyParagraphs[1] || localBodySentence()
                        },
                        { 
                            role: STYLE_KEYS.H4, 
                            content: articleContent.subheadings[1] || localArticleHeadline().replace('\n', ' ')
                        },
                        { 
                            role: STYLE_KEYS.TEXT_MAIN, 
                            content: articleContent.bodyParagraphs[2] || localBodySentence()
                        }
                    ];
                } else {
                    console.log('[StructuredTextLayout.create] 📝 Using local article content generation');
                    const localContent = generateLocalArticleContent();
                    
                    // Use local headline
                    mainHeadingContent = localContent.headline;
                    console.log(`[StructuredTextLayout.create] Using local headline: "${mainHeadingContent}"`);
                    
                    // Create 5-line synopsis for local content
                    const localSynopsis = `${localContent.headline.replace('\n', ' ')}\n\nA detailed examination exploring key concepts, methodologies, and contemporary applications in this field.\n\nComprehensive analysis with practical insights.`;
                    leftColumnItems = [
                        { 
                            role: STYLE_KEYS.MICRO, 
                            content: localSynopsis
                        }
                    ];

                    rightColumnItems = [
                        { 
                            role: STYLE_KEYS.TEXT_LARGE, 
                            content: limitToFourLines(localContent.bodyParagraphs[0])
                        },
                        { 
                            role: STYLE_KEYS.H4, 
                            content: localContent.subheadings[0]
                        },
                        { 
                            role: STYLE_KEYS.TEXT_MAIN, 
                            content: localContent.bodyParagraphs[1]
                        },
                        { 
                            role: STYLE_KEYS.H4, 
                            content: localContent.subheadings[1]
                        },
                        { 
                            role: STYLE_KEYS.TEXT_MAIN, 
                            content: localContent.bodyParagraphs[2]
                        }
                    ];
                }
                }

            // --- Create Main Heading as Item - display ---
            const mainHeadingStyle = typeSystem[STYLE_KEYS.DISPLAY] || typeSystem[STYLE_KEYS.H1] || { 
                size: 67, 
                lineHeight: 1.02, 
                letterSpacing: -1.38, 
                fontFamily: baseFontFamily, 
                fontStyle: selectedStyle 
            };

            const targetFamily = mainHeadingStyle.fontFamily || baseFontFamily;
            const targetStyle = mainHeadingStyle.fontStyle || selectedStyle;
            
            console.log(`[StructuredTextLayout.create] Creating main heading with content: "${mainHeadingContent}"`);
            const mainHeadingItemFrame = await createStyleItem(
                STYLE_KEYS.DISPLAY,
                mainHeadingStyle,
                mainHeadingContent,
                targetFamily,
                targetStyle,
                showSpecLabels,
                textColor,
                availableFontsList,
                currentColorMode,
                namingConvention,
                lineHeightUnit
            );

            // FORCE ARTICLE LAYOUT: Override createStyleItem for main heading
            mainHeadingItemFrame.layoutAlign = 'STRETCH';
            mainHeadingItemFrame.counterAxisSizingMode = 'FIXED'; // Force horizontal fill
            const mainHeadingTextNode = mainHeadingItemFrame.children.find(n => n.type === 'TEXT') as TextNode | undefined;
            if (mainHeadingTextNode) {
                mainHeadingTextNode.textAlignHorizontal = 'LEFT';
                mainHeadingTextNode.textAutoResize = 'HEIGHT';
                mainHeadingTextNode.layoutAlign = 'STRETCH';
            }
            
            applyLayoutGridToItem(mainHeadingItemFrame, showGrid, roundingGridSize);
            
            // Handle visibility for main heading item
            if (params.styleVisibility && params.styleVisibility[STYLE_KEYS.DISPLAY] !== undefined) {
                const isVisible = params.styleVisibility[STYLE_KEYS.DISPLAY];
                
                if (isVisible) {
                    // Show: immediate restore entire item
                    mainHeadingItemFrame.opacity = 1;
                    mainHeadingItemFrame.visible = true;
                } else {
                    // Hide: immediate collapse entire item
                    mainHeadingItemFrame.opacity = 0;
                    mainHeadingItemFrame.visible = false; // Collapses height in auto layout
                    console.log(`[StructuredTextLayout.create] ✅ HIDDEN main heading: ${STYLE_KEYS.DISPLAY}`);
                }
            } else {
                mainHeadingItemFrame.opacity = 1;
                mainHeadingItemFrame.visible = true;
            }
            
            frame.appendChild(mainHeadingItemFrame);

            // Add to nodeMap
            if (mainHeadingTextNode) {
                if (!nodeMap.has(STYLE_KEYS.DISPLAY)) nodeMap.set(STYLE_KEYS.DISPLAY, []);
                nodeMap.get(STYLE_KEYS.DISPLAY)!.push(mainHeadingTextNode.id);
            }

            // --- Two-Column Content Layout ---
            const contentRowFrame = figma.createFrame();
            contentRowFrame.name = "Content Row";
            contentRowFrame.layoutMode = 'HORIZONTAL';
            contentRowFrame.primaryAxisSizingMode = 'FIXED'; 
            contentRowFrame.counterAxisSizingMode = 'AUTO';
            contentRowFrame.itemSpacing = 64;
            contentRowFrame.fills = [];
            contentRowFrame.clipsContent = false;
            
            // FORCE FULL WIDTH: 1440px - 128px padding = 1312px
            contentRowFrame.resize(1312, 100);
            
            frame.appendChild(contentRowFrame);

            // --- Left Column Article (Shorter Content) ---
            const leftColumnFrame = figma.createFrame();
            leftColumnFrame.name = "Left Column Article";
            leftColumnFrame.layoutMode = 'VERTICAL';
            leftColumnFrame.primaryAxisSizingMode = 'AUTO';
            leftColumnFrame.counterAxisSizingMode = 'AUTO';
            leftColumnFrame.layoutGrow = 1; // HORIZONTAL FILL
            leftColumnFrame.itemSpacing = 32;
            leftColumnFrame.fills = [];
            leftColumnFrame.clipsContent = false;
            contentRowFrame.appendChild(leftColumnFrame);

            // --- Right Column Article (Main Content) ---
            const rightColumnFrame = figma.createFrame();
            rightColumnFrame.name = "Right Column Article";
            rightColumnFrame.layoutMode = 'VERTICAL';
            rightColumnFrame.primaryAxisSizingMode = 'AUTO';
            rightColumnFrame.counterAxisSizingMode = 'AUTO';
            rightColumnFrame.layoutGrow = 1; // HORIZONTAL FILL
            rightColumnFrame.itemSpacing = 32;
            rightColumnFrame.fills = [];
            rightColumnFrame.clipsContent = false;
            contentRowFrame.appendChild(rightColumnFrame);

            // Content generation logic moved above - variables already populated

            // --- Create Left Column Content ---
            for (const item of leftColumnItems) {
                const styleToApply = typeSystem[item.role as keyof TypographySystem];
                if (!styleToApply) continue;

                let content = item.content;

                const targetFamily = styleToApply.fontFamily || baseFontFamily;
                const targetStyle = styleToApply.fontStyle || selectedStyle;
                
                const styleItemFrame = await createStyleItem(
                    item.role,
                    styleToApply,
                    content,
                    targetFamily,
                    targetStyle,
                    showSpecLabels,
                    textColor,
                    availableFontsList,
                    currentColorMode,
                    namingConvention,
                    lineHeightUnit
                );

                // FORCE ARTICLE LAYOUT: Override createStyleItem to get horizontal fill
                    styleItemFrame.layoutAlign = 'STRETCH';
                styleItemFrame.counterAxisSizingMode = 'FIXED'; // Force horizontal fill
                const textNode = styleItemFrame.children.find(n => n.type === 'TEXT') as TextNode | undefined;
                if (textNode) {
                    textNode.textAlignHorizontal = 'LEFT';
                    textNode.textAutoResize = 'HEIGHT';
                    textNode.layoutAlign = 'STRETCH';
                }

                // Apply grid and alignment
                applyLayoutGridToItem(styleItemFrame, showGrid, roundingGridSize);
                
                // Handle visibility for left column item
                if (params.styleVisibility && params.styleVisibility[item.role] !== undefined) {
                    const isVisible = params.styleVisibility[item.role];
                    
                    if (isVisible) {
                        // Show: immediate restore entire item
                        styleItemFrame.opacity = 1;
                        styleItemFrame.visible = true;
                    } else {
                        // Hide: immediate collapse entire item
                        styleItemFrame.opacity = 0;
                        styleItemFrame.visible = false; // Collapses height in auto layout
                        console.log(`[StructuredTextLayout.create] ✅ HIDDEN left column: ${item.role}`);
                    }
                } else {
                    styleItemFrame.opacity = 1;
                    styleItemFrame.visible = true;
                }
                
                leftColumnFrame.appendChild(styleItemFrame);

                // Add to nodeMap
                if (textNode) {
                    if (!nodeMap.has(item.role)) nodeMap.set(item.role, []);
                    nodeMap.get(item.role)!.push(textNode.id);
                }
            }

                        // --- Create Right Column Content ---
            for (const item of rightColumnItems) {
                // Use smart generated content directly
                const actualRole = item.role;
                const actualContent = item.content;
                
                const styleToApply = typeSystem[actualRole as keyof TypographySystem];
                if (!styleToApply) continue;

                const targetFamily = styleToApply.fontFamily || baseFontFamily;
                const targetStyle = styleToApply.fontStyle || selectedStyle;
                
                const styleItemFrame = await createStyleItem(
                    actualRole,
                    styleToApply,
                    actualContent,
                    targetFamily,
                    targetStyle,
                    showSpecLabels,
                    textColor,
                    availableFontsList,
                    currentColorMode,
                    namingConvention,
                    lineHeightUnit
                );

                // FORCE ARTICLE LAYOUT: Override createStyleItem to get horizontal fill
                styleItemFrame.layoutAlign = 'STRETCH'; 
                styleItemFrame.counterAxisSizingMode = 'FIXED'; // Force horizontal fill
                const textNode = styleItemFrame.children.find(n => n.type === 'TEXT') as TextNode | undefined;
                if (textNode) {
                    textNode.textAlignHorizontal = 'LEFT';
                    textNode.textAutoResize = 'HEIGHT';
                    textNode.layoutAlign = 'STRETCH';
                }

                applyLayoutGridToItem(styleItemFrame, showGrid, roundingGridSize);
                
                // Handle visibility for right column item
                if (params.styleVisibility && params.styleVisibility[actualRole] !== undefined) {
                    const isVisible = params.styleVisibility[actualRole];
                    
                    if (isVisible) {
                        // Show: immediate restore entire item
                        styleItemFrame.opacity = 1;
                        styleItemFrame.visible = true;
                    } else {
                        // Hide: immediate collapse entire item
                        styleItemFrame.opacity = 0;
                        styleItemFrame.visible = false; // Collapses height in auto layout
                        console.log(`[StructuredTextLayout.create] ✅ HIDDEN right column: ${actualRole}`);
                    }
                } else {
                    styleItemFrame.opacity = 1;
                    styleItemFrame.visible = true;
                }
                
                rightColumnFrame.appendChild(styleItemFrame);

                // Add to nodeMap
                if (textNode) {
                    if (!nodeMap.has(item.role)) nodeMap.set(item.role, []);
                    nodeMap.get(item.role)!.push(textNode.id);
                }
            }

            // Decorative elements removed per user request
            
            console.log('[StructuredTextLayout.create] Finished creating advanced article layout');
            return { frame, nodeMap };

        } catch (error) {
            console.error('[StructuredTextLayout.create] Error:', error);
            figma.notify('Error creating Advanced Article Layout. Check console.', { error: true });
            return null;
        }
    }



    // Helper method to calculate decorative style
    private calculateDecorativeStyle(
        typeSystem: TypographySystem, 
        activeScaleRatio: number, 
        baseFontFamily: string, 
        selectedStyle: string
    ): TypographyStyle {
        const displayStyle = typeSystem[STYLE_KEYS.DISPLAY];
        const displayExponent = TYPOGRAPHY_SCALE_POINTS[STYLE_KEYS.DISPLAY]; // 6
        const decorativeExponent = displayExponent + 2; // 8 (2 steps beyond display)
        const baseSize = typeSystem[STYLE_KEYS.TEXT_MAIN]?.size || 16;
        
        let decorativeSize = Math.round(baseSize * Math.pow(activeScaleRatio, decorativeExponent));
        
        // Apply grid rounding if detected
        const detectedGridSize = this.detectGridSize(typeSystem);
        if (detectedGridSize > 0) {
            decorativeSize = Math.round(decorativeSize / detectedGridSize) * detectedGridSize;
        }

        return {
            fontFamily: displayStyle?.fontFamily || baseFontFamily,
            fontStyle: selectedStyle,
            size: decorativeSize,
            lineHeight: 0.8,
            letterSpacing: displayStyle?.letterSpacing !== undefined ? displayStyle.letterSpacing : -3.6,
        };
    }

    // Helper method to detect grid size
    private detectGridSize(system: TypographySystem): number {
        const sizes = Object.values(system).map(style => style?.size || 0).filter(size => size > 0);
        if (sizes.length === 0) return 0;
        
        const allMultiplesOf4 = sizes.every(size => size % 4 === 0);
        if (allMultiplesOf4) return 4;
        
        const allMultiplesOf2 = sizes.every(size => size % 2 === 0);
        if (allMultiplesOf2) return 2;
        
        return 0;
    }

    async update(frame: FrameNode, params: PreviewLayoutHandlerParams): Promise<void> {
        const {
            typeSystem,
            selectedStyle,
            showSpecLabels,
            styleVisibility,
            currentColorMode,
            availableFontsList,
            baseFontFamily,
            llmOutput,
            lineHeightUnit = 'percent',
            showGrid = false,
            roundingGridSize = 0
        } = params;

        if (!frame) {
            console.warn('[StructuredTextLayout.update] No frame to update.');
            return;
        }

        console.log('[StructuredTextLayout.update] Updating advanced article layout');

        try {
            const theme = getCurrentPreviewTheme();
            const textColor = theme.text;
            frame.fills = [{ type: 'SOLID', color: theme.background }];

            // --- CRITICAL FIX: Load all fonts before applying them ---
            const fontsToLoad = new Set<FontName>();
            fontsToLoad.add(INTER_REGULAR);
            
            // Add all fonts from typeSystem (including newly selected secondary fonts)
            Object.values(typeSystem).forEach(style => {
                if (style) {
                    fontsToLoad.add({ 
                        family: style.fontFamily || baseFontFamily, 
                        style: style.fontStyle || selectedStyle 
                    });
                }
            });
            
            console.log(`[StructuredTextLayout.update] Loading ${fontsToLoad.size} fonts before applying changes...`);
            await Promise.all(Array.from(fontsToLoad).map(font =>
                figma.loadFontAsync(font).catch(e =>
                    console.warn(`[StructuredTextLayout.update] Font load failed: ${font.family} ${font.style}`, e)
                )
            ));
            console.log(`[StructuredTextLayout.update] Font loading complete.`);

            const updatePromises: Promise<void>[] = [];

            // Font Display Name update removed per user request

            // Update main heading (now Item - display) - use robust lookup
            let mainHeadingItem: FrameNode | undefined;
            const namingConventions = ['Default Naming', 'Lumos', 'Tailwind', 'Bootstrap', 'Relume'];
            
            for (const convention of namingConventions) {
                const displayName = getDisplayNameWithConvention(STYLE_KEYS.DISPLAY, convention);
                mainHeadingItem = frame.children.find(n => n.name === `Item - ${displayName}`) as FrameNode | undefined;
                if (mainHeadingItem) {
                    console.log(`[StructuredText] 🔍 Found main heading using ${convention} convention: "Item - ${displayName}"`);
                    break;
                }
            }
            
            if (!mainHeadingItem) {
                console.warn(`[StructuredText] ⚠️ Could not find main heading with any naming convention`);
            }
            if (mainHeadingItem) {
                updatePromises.push((async () => {
                    // 🏷️ RENAME NODES: Ensure main heading matches current naming convention
                    await renameNodesForConvention(mainHeadingItem, STYLE_KEYS.DISPLAY, params.namingConvention || 'Default Naming');
                    
                    const headingStyle = typeSystem[STYLE_KEYS.DISPLAY] || typeSystem[STYLE_KEYS.H1];
                    if (headingStyle) {
                        const headingTextNode = mainHeadingItem.children.find(n => n.type === 'TEXT') as TextNode | undefined;
                        const labelSpecsRow = mainHeadingItem.children.find(n => n.name.startsWith('LabelSpecs')) as FrameNode | undefined;
                        
                        if (headingTextNode) {
                            const headingFont = getValidFont(
                                headingStyle.fontFamily || baseFontFamily, 
                                headingStyle.fontStyle || selectedStyle, 
                                availableFontsList
                            );
                            await applyTextStyleToNode(headingTextNode, headingStyle, headingFont, availableFontsList);
                            headingTextNode.fills = [{ type: 'SOLID', color: textColor }];
                            // Ensure consistent behavior
                            headingTextNode.textAlignHorizontal = 'LEFT';
                            headingTextNode.textAutoResize = 'HEIGHT';
                            headingTextNode.layoutAlign = 'STRETCH';
                        }

                        if (labelSpecsRow) {
                            labelSpecsRow.opacity = showSpecLabels ? 1 : 0;
                            if (showSpecLabels) {
                                updatePromises.push(updateSpecsInRow(labelSpecsRow, headingStyle, params.namingConvention, lineHeightUnit, STYLE_KEYS.DISPLAY));
                            }
                        }
                    }
                })());
            }

            // Update content columns (Article columns)
            const contentRow = frame.children.find(n => n.name === "Content Row") as FrameNode | undefined;
            if (contentRow) {
                for (const column of contentRow.children) {
                    if (column.type !== 'FRAME') continue;
                    
                    for (const itemContainer of column.children) {
                if (itemContainer.type !== 'FRAME') continue;
                
                                                 // Apply grid updates
                         applyLayoutGridToItem(itemContainer as FrameNode, showGrid, roundingGridSize);

                         const displayNameFromNode = itemContainer.name.replace('Item - ', '');
                         // Convert display name back to internal key for typeSystem lookup
                         const internalKey = getInternalKeyForDisplayName(displayNameFromNode, params.namingConvention || 'Default Naming')
                           || displayNameFromNode.toLowerCase();
                         const styleToApply = typeSystem[internalKey as keyof TypographySystem];

                         if (!styleToApply) continue;
                         
                         // 🏷️ RENAME NODES: Ensure nodes match current naming convention
                         await renameNodesForConvention(itemContainer as FrameNode, internalKey, params.namingConvention || 'Default Naming');

                         // Handle visibility for entire item container
                         if (styleVisibility && styleVisibility[internalKey] !== undefined) {
                             const isVisible = styleVisibility[internalKey];
                             
                             if (isVisible) {
                                 // Show: immediate restore entire item
                                 (itemContainer as FrameNode).opacity = 1;
                                 (itemContainer as FrameNode).visible = true;
                             } else {
                                 // Hide: immediate collapse entire item
                                 (itemContainer as FrameNode).opacity = 0;
                                 (itemContainer as FrameNode).visible = false; // Collapses height in auto layout
                             }
                         } else {
                             (itemContainer as FrameNode).opacity = 1;
                             (itemContainer as FrameNode).visible = true;
                         }

                         // FORCE ARTICLE LAYOUT: Override for horizontal fill  
                         (itemContainer as FrameNode).layoutAlign = 'STRETCH';
                         (itemContainer as FrameNode).counterAxisSizingMode = 'FIXED';

                         const textNode = itemContainer.children.find(n => n.type === 'TEXT' && n.name.startsWith('Example Text')) as TextNode | undefined;
                         const labelSpecsRow = itemContainer.children.find(n => n.name.startsWith('LabelSpecs')) as FrameNode | undefined;

                if (textNode) {
                    updatePromises.push((async () => {
                        const targetFamily = styleToApply.fontFamily || baseFontFamily;
                        const targetStyleName = styleToApply.fontStyle || selectedStyle;
                        const finalFont = getValidFont(targetFamily, targetStyleName, availableFontsList);
                        
                        await applyTextStyleToNode(textNode, styleToApply, finalFont, availableFontsList);
                        textNode.fills = [{ type: 'SOLID', color: textColor }];
                        
                                 // Ensure consistent behavior: horizontal fill + vertical hug + left alignment
                                 textNode.textAlignHorizontal = 'LEFT';
                                 textNode.textAutoResize = 'HEIGHT';
                                 textNode.layoutAlign = 'STRETCH';
                    })());
                }

                if (labelSpecsRow) {
                    labelSpecsRow.opacity = showSpecLabels ? 1 : 0;
                    if (showSpecLabels) {
                                updatePromises.push(updateSpecsInRow(labelSpecsRow, styleToApply, params.namingConvention, lineHeightUnit, internalKey));
                            }
                        }
                    }
                }
            }

            // Decorative elements removed - no update needed

            // Legacy check for character set display (will be removed in future updates)
            const charSetDisplay = frame.children.find(n => n.name === "Character Set Display") as TextNode | undefined;
            if (charSetDisplay) {
                updatePromises.push((async () => {
                    const charSetStyle = typeSystem.h5 || { fontFamily: baseFontFamily, size: 21, lineHeight: 1.17, letterSpacing: -0.1 };
                    const charSetFont = getValidFont(charSetStyle.fontFamily || baseFontFamily, charSetStyle.fontStyle || selectedStyle, availableFontsList);
                    await applyTextStyleToNode(charSetDisplay, charSetStyle, charSetFont, availableFontsList);
                    charSetDisplay.fills = [{ type: 'SOLID', color: textColor }];
                })());
            }

            await Promise.all(updatePromises);
            console.log('[StructuredTextLayout.update] Finished updating advanced article layout');

        } catch (error) {
            console.error('[StructuredTextLayout.update] Error:', error);
            figma.notify('Error updating Advanced Article Layout. Check console.', { error: true });
        }
    }
}

// Optional: Register the layout (can also be done in a central registry file)
// import { registerPreviewLayout } from '../preview-layout-registry';
// registerPreviewLayout(new StructuredTextLayout()); 