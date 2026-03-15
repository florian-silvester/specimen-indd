// src/event-handlers.ts
// Sets up event listeners for messages from the UI thread.

import { on, emit } from '@create-figma-plugin/utilities';
import {
    FontInfo,
    TypographySystem,
    CreateSpecimenCompactPreviewRequest,
    PreviewLayoutType,
    InitialFontsMessage,
    StylesForFamilyMessage,
    UpdatePreviewRequest,
    PreviewLayoutHandlerParams,
    ColorModeChangedMessage,
    SaveApiKeyEvent,
    LoadedSettingsEvent,
    AutoMatchStylesEvent,
    AutoMatchResultsEvent,
    NormalizeFrameStylesEvent,
    ApplySystemStylesToFrameEvent,
    ApplyMatchesCompleteMessage,
    AvailableFontsListUpdateEvent,
    CreatePreviewEvent,
    CapturePreviewSvgEvent,
    SpecimenSnapshot,
    PreviewSvgCapturedEvent,

} from '../core/types';
import { updateGivenFrame } from '../preview/preview-updater';
import { managePreview } from '../preview/preview-manager';
import { applyTextStyleToNode } from './utils';
import {
    DARK_MODE_BACKGROUND,
    DARK_MODE_TEXT,
    LIGHT_MODE_BACKGROUND,
    LIGHT_MODE_TEXT,
    ACTIVE_FRAME_BORDER_DARK,
    ACTIVE_FRAME_BORDER_LIGHT,
    SPEC_COLOR,
    SPEC_COLOR_OPACITY,
    SPEC_COLOR_DARK,
    SPEC_COLOR_DARK_OPACITY,
    LAYOUT_BASE_NAMES,
    INTER_REGULAR,
    FIGMA_NODE_NAMES,
    ALL_HEADING_DISPLAY_NAMES,
    resolvePreviewTheme,
    PreviewThemeId,
    PREVIEW_THEMES,
} from '../core/constants';
import { setCurrentPreviewTheme, getCurrentPreviewTheme } from '../core/preview-theme-state';
import googleFontFamilyNames from '../core/google-fonts.json';
import { getOpenaiApiKey, generateTextWithLLM, localBodySentence, localArticleHeadline, generateArticleContentWithLLM, generateLocalArticleContent, localHeadline } from '../api/openai-utils';

// Define the structure for the state accessors passed from main.ts
interface StateAccessors {
    setLatestPreviewFrame: (frame: FrameNode | null) => void;
    getLatestPreviewFrame: () => FrameNode | null;
    setCurrentColorMode: (mode: 'light' | 'dark') => void;
    getCurrentColorMode: () => 'light' | 'dark';
    setAvailableFontsList: (fonts: FontInfo[]) => void;
    getAvailableFontsList: () => FontInfo[];
    setLatestSelectedStyle: (style: string) => void;
    setLatestShowSpecLabels: (show: boolean) => void;
    setLatestActiveMode: (mode: 'desktop' | 'mobile') => void;
    setLatestActiveScaleRatio: (ratio: number) => void;
    // Add getters for live tweaking state
    getLiveTweakingTargetFrameId: () => string | null;
    getLiveTweakingNodeMappings: () => Array<{ nodeId: string; systemStyleKey: string }> | null;
    // Add setters for live tweaking state (already in main.ts, ensure interface matches if used directly by event-handlers)
    setLiveTweakingTargetFrameId: (id: string | null) => void; 
    setLiveTweakingNodeMappings: (mappings: Array<{ nodeId: string; systemStyleKey: string }> | null) => void;
    // Add accessors for highlight state
    getOriginalSelectionBeforeHighlight: () => ReadonlyArray<SceneNode> | null;
    setOriginalSelectionBeforeHighlight: (selection: ReadonlyArray<SceneNode> | null) => void;
    getCurrentScanSessionNodeCache: () => Map<string, SceneNode[]> | null;
    setCurrentScanSessionNodeCache: (cache: Map<string, SceneNode[]> | null) => void;
    // --- NEW for preview highlight ---
    getPreviewNodeMapping: () => Map<string, string[]> | null;
    setPreviewNodeMapping: (mapping: Map<string, string[]> | null) => void;
    // --- NEW for "Play Text" on scanned frames ---
    getScannedFrameWordCounts: () => Map<string, number> | null;
    setScannedFrameWordCounts: (counts: Map<string, number> | null) => void;
    getScannedFrameContainerId: () => string | null;
    setScannedFrameContainerId: (id: string | null) => void;
}

// Headline/content rotation is driven by term-bank packs in openai-utils.ts.

const decorativeTexts = ["Aa", "123", "XYZ"];
let currentDecorativeIndex = 0;

// <<< ADDED: Waterfall text cycle state (EXPANDED for endless variety) >>>
const waterfallTexts = [
    "abcdefghijklmnopqrstuvwxyz1234567", 
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567",
    "the quick brown fox jumps over lazy dogs",
    "TYPOGRAPHY IS THE ART OF ARRANGING TYPE",
    "spacing rhythm contrast hierarchy balance",
    "0123456789 FONTS STYLES WEIGHTS METRICS",
    "Lorem ipsum dolor sit amet consectetur",
    "Hamburgefonstiv ABCDEFGH abcdefgh 123",
    "How razzing black wizards jump quickly",
    "Pack my box with five dozen liquor jugs"
];
let currentWaterfallTextIndex = 0;
// <<< END ADDED >>>

// Animation state tracking
let currentTypingAnimation: { cancel: () => void } | null = null;

async function stopActiveTextPlayback(): Promise<void> {
    const { isTextGenerationActive, setTextGenerationActive } = await import('../core/main');
    const hadActivePlayback = Boolean(currentTypingAnimation) || isTextGenerationActive;

    if (currentTypingAnimation) {
        currentTypingAnimation.cancel();
        currentTypingAnimation = null;
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    if (hadActivePlayback) {
        setTextGenerationActive(false);
        emit('TEXT_GENERATION_COMPLETE');
    }
}

// Flash effect function for camera feedback
async function performFlashEffect(latestFrame: FrameNode): Promise<void> {
    try {
        console.log('[Event Handlers] 📸 Starting camera flash effect');
        
        // Get current frame background to detect theme
        const originalFrameFills = latestFrame.fills;
        let isCurrentlyDark = false;
        
        if (Array.isArray(originalFrameFills) && originalFrameFills.length > 0) {
            const firstFill = originalFrameFills[0];
            if (firstFill.type === 'SOLID' && firstFill.color) {
                const { r, g, b } = firstFill.color;
                const brightness = (r + g + b) / 3;
                isCurrentlyDark = brightness < 0.5;
            }
        }
        
        // Get all text nodes in frame to flash their colors too
        const textNodes = latestFrame.findAll(node => node.type === 'TEXT') as TextNode[];
        const originalTextFills = textNodes.map(node => ({ 
            node, 
            fills: Array.isArray(node.fills) ? node.fills : [] 
        }));
        
        // Flash colors using ACTUAL theme constants (opposite theme)
        const flashBgColor = isCurrentlyDark 
            ? LIGHT_MODE_BACKGROUND // Flash to light mode if currently dark
            : DARK_MODE_BACKGROUND; // Flash to dark mode if currently light
        
        const flashTextColor = isCurrentlyDark 
            ? LIGHT_MODE_TEXT // Light mode text
            : DARK_MODE_TEXT; // Dark mode text
        
        // 🔥 INSTANT FLASH - Quick onset
        latestFrame.fills = [{ type: 'SOLID', color: flashBgColor }];
        textNodes.forEach(node => {
            try {
                node.fills = [{ type: 'SOLID', color: flashTextColor }];
            } catch (e) {
                // Skip if node can't be modified
            }
        });
        
        console.log('[Event Handlers] 📸 Flash applied instantly!');
        
        // Brief hold at full flash
        await new Promise(resolve => setTimeout(resolve, 80));
        
        // 🌊 SMOOTH FADE BACK - Eased transition with multiple steps
        const steps = 5;
        const stepDuration = 25; // 125ms total fade back
        
        for (let i = 1; i <= steps; i++) {
            const progress = i / steps;
            // Ease-out curve: fast start, slow end
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            
            // Interpolate between flash and original colors
            const lerpColor = (flash: any, original: any, t: number) => ({
                r: flash.r + (original.r - flash.r) * t,
                g: flash.g + (original.g - flash.g) * t,
                b: flash.b + (original.b - flash.b) * t
            });
            
            // Apply interpolated background
            if (Array.isArray(originalFrameFills) && originalFrameFills.length > 0 && originalFrameFills[0].type === 'SOLID') {
                const interpolatedBg = lerpColor(flashBgColor, originalFrameFills[0].color, easedProgress);
                latestFrame.fills = [{ type: 'SOLID', color: interpolatedBg }];
            }
            
            // Apply interpolated text colors
            textNodes.forEach((node, nodeIndex) => {
                try {
                    const originalFills = originalTextFills[nodeIndex]?.fills;
                    if (Array.isArray(originalFills) && originalFills.length > 0 && originalFills[0].type === 'SOLID') {
                        const interpolatedText = lerpColor(flashTextColor, originalFills[0].color, easedProgress);
                        node.fills = [{ type: 'SOLID', color: interpolatedText }];
                    }
                } catch (e) {
                    // Skip if node can't be modified
                }
            });
            
            await new Promise(resolve => setTimeout(resolve, stepDuration));
        }
        
        // Final restore to ensure exact original colors
        latestFrame.fills = originalFrameFills;
        originalTextFills.forEach(({ node, fills }) => {
            try {
                node.fills = fills;
            } catch (e) {
                // Skip if node can't be modified
            }
        });
        
        console.log('[Event Handlers] 📸 Camera flash effect completed');
        
    } catch (flashError) {
        console.warn('[Event Handlers] 📸 Flash effect failed:', flashError);
    }
}

async function typeTextAnimation(
    textNodes: TextNode[],
    targetText: string,
    speed: number = 60, // ms per character - adjustable for feel
    onProgress?: () => void
): Promise<void> {
    console.log(`[Typing Animation] Starting for ${textNodes.length} nodes: "${targetText}"`);
    
    // For article layouts: Don't use global cancellation - each animation is independent
    let cancelled = false;
    
    // Only cancel existing animations for non-article layouts (specimen/waterfall)
    const isArticleAnimation = textNodes.length === 1 && textNodes[0].name.includes('Example Text -');
    
    if (!isArticleAnimation) {
        // Cancel any existing animation for specimen/waterfall layouts
    if (currentTypingAnimation) {
        currentTypingAnimation.cancel();
        await new Promise(resolve => setTimeout(resolve, 50)); // Brief pause to ensure cleanup
    }

    currentTypingAnimation = {
        cancel: () => { 
            cancelled = true;
            console.log('[Typing Animation] Cancelled');
        }
    };
    } else {
        console.log('[Typing Animation] Article mode - independent animation (no global cancellation)');
    }

    // Initialize with placeholder structure to maintain frame height
    const lineCount = (targetText.match(/\n/g) || []).length + 1;
    const placeholderText = Array(lineCount).fill(' ').join('\n');
    
    textNodes.forEach(node => {
        if (node.fontName !== figma.mixed) {
            node.characters = placeholderText;
        }
    });
    if (onProgress) onProgress();

    // Add small pause before typing starts
    await new Promise(resolve => setTimeout(resolve, 200));

    // Type character by character, maintaining line structure
    for (let i = 0; i <= targetText.length; i++) {
        if (cancelled) {
            console.log('[Typing Animation] Animation was cancelled, exiting');
            return;
        }
        
        const currentText = targetText.substring(0, i);
        // Pad remaining space to maintain line structure
        const remainingText = targetText.substring(i);
        const paddedText = currentText + remainingText.replace(/./g, ' ');
        
        textNodes.forEach(node => {
            if (node.fontName !== figma.mixed) {
                node.characters = paddedText;
            }
        });
        if (onProgress) onProgress();
        
        // Pause between characters (skip delay on last character)
        if (i < targetText.length) {
            await new Promise(resolve => setTimeout(resolve, speed));
        }
    }

    // Only clear global animation for non-article layouts
    if (!isArticleAnimation) {
    currentTypingAnimation = null;
    }
    if (onProgress) onProgress();
    console.log('[Typing Animation] Completed');
}

// Find target text nodes for headline updates (adapts to layout type)
function isHeadlineExampleNode(node: SceneNode): boolean {
    if (node.type !== 'TEXT') return false;
    if (node.name === FIGMA_NODE_NAMES.FONT_DISPLAY_NAME) return false;
    if (node.name === FIGMA_NODE_NAMES.DECORATIVE_AA_TEXT) return false;
    if (node.name === FIGMA_NODE_NAMES.CHARACTER_SET_DISPLAY) return false;

    const prefix = FIGMA_NODE_NAMES.EXAMPLE_TEXT_PREFIX.toLowerCase();
    const lower = node.name.toLowerCase();
    if (!lower.startsWith(prefix)) return false;

    // Extract suffix after "example text - " and check against ALL conventions
    const suffix = lower.slice(prefix.length).trim();
    return ALL_HEADING_DISPLAY_NAMES.has(suffix);
}

function findTargetTextNodes(frame: FrameNode, isWaterfall: boolean, isArticle: boolean = false): TextNode[] {
    if (isArticle) {
        return frame.findAll(node => {
            try { return isHeadlineExampleNode(node); }
            catch { return false; }
        }) as TextNode[];
    } else {
        const allTextNodes = frame.findAll(node => node.type === 'TEXT') as TextNode[];
        console.log(`[findTargetTextNodes] 🔍 Found ${allTextNodes.length} total text nodes in frame`);
        allTextNodes.slice(0, 5).forEach(node => {
            console.log(`[findTargetTextNodes]   Sample node: "${node.name}"`);
        });

        return frame.findAll(node => {
            try {
                const matched = isHeadlineExampleNode(node);
                if (matched) console.log(`[findTargetTextNodes] ✓ Matched headline: "${node.name}"`);
                return matched;
            } catch { return false; }
        }) as TextNode[];
    }
}

// Find body text nodes that should be updated with smart content
function findBodyTextNodes(frame: FrameNode, isArticle: boolean = false): TextNode[] {
    return frame.findAll(node => {
        try {
        if (node.type !== 'TEXT') return false;
            if (node.name === FIGMA_NODE_NAMES.FONT_DISPLAY_NAME) return false; // Exclude the main font display
            if (node.name === FIGMA_NODE_NAMES.DECORATIVE_AA_TEXT) return false; // Exclude decorative Aa text
            if (node.name === FIGMA_NODE_NAMES.CHARACTER_SET_DISPLAY) return false; // Exclude character set display
        
        // LAYOUT-AWARE FIX: Only exclude "Example Text - *" nodes in article layouts
        // In specimen layouts, these nodes SHOULD be updated by Generate Text
        if (isArticle && node.name.startsWith('Example Text -')) return false;
        
        const text = node.characters;
        const isBodyText = text.length > 50; // Body text is longer than headlines
        const isNotSpecLabel = !node.name.toLowerCase().includes('spec') && !node.name.toLowerCase().includes('label');
        const isNotHeadline = !text.includes('\n') || text.length > 30;
        
        // EXCLUDE character set displays (Aa, 123, symbols, alphabet displays)
        const isCharacterDisplay = text.match(/^[A-Za-z0-9\s\(\)\+\-\*]{1,50}$/) && text.length < 50;
        const isAlphabetDisplay = text.includes('ABCDEF') || text.includes('abcdef') || text.includes('123456');
        
        // Only include long body text content
        return isNotSpecLabel && isNotHeadline && isBodyText && !isCharacterDisplay && !isAlphabetDisplay;
        } catch (nodeAccessError) {
            console.warn(`[findBodyTextNodes] Skipping stale node:`, nodeAccessError);
            return false; // Exclude stale nodes
        }
    }) as TextNode[];
}

function syncSpecimenRowWidthsAfterTextChange(frame: FrameNode): void {
    const topContentRow = frame.findOne(n => n.type === 'FRAME' && n.name === 'Top Content Row') as FrameNode | null;
    const bottomContentRow = frame.findOne(n => n.type === 'FRAME' && n.name === 'Bottom Content Row') as FrameNode | null;
    if (!topContentRow || !bottomContentRow) return;

    const topLeft = topContentRow.children.find(n => n.name === 'Left Column (Headings)') as FrameNode | undefined;
    const topRight = topContentRow.children.find(n => n.name === 'Right Column (Text)') as FrameNode | undefined;
    const bottomLeft = bottomContentRow.children.find(n => n.name === 'Left Column (Headings)') as FrameNode | undefined;
    const bottomRight = bottomContentRow.children.find(n => n.name === 'Right Column (Text)') as FrameNode | undefined;
    if (!topLeft || !topRight || !bottomLeft || !bottomRight) return;

    const leftWidth = Math.round(topLeft.width);
    const rightWidth = Math.round(topRight.width);
    const topWidth = Math.round(topContentRow.width);

    bottomLeft.counterAxisSizingMode = 'FIXED';
    bottomRight.counterAxisSizingMode = 'FIXED';
    bottomContentRow.primaryAxisSizingMode = 'FIXED';
    bottomLeft.resize(leftWidth, bottomLeft.height);
    bottomRight.resize(rightWidth, bottomRight.height);
    bottomContentRow.resize(topWidth, bottomContentRow.height);
}

async function loadFontsForNodes(textNodes: TextNode[]): Promise<void> {
    const fontsToLoad = new Set<FontName>();
    textNodes.forEach(node => { 
        if (node.fontName !== figma.mixed) fontsToLoad.add(node.fontName as FontName); 
    });

    await Promise.all(Array.from(fontsToLoad).map(font => 
        figma.loadFontAsync(font).catch(e => 
            console.warn(`Font load failed: ${font.family} ${font.style}`, e)
        )
    ));
}

async function handleLLMTextGeneration(frame: FrameNode, apiKey: string): Promise<void> {
    try {
        const isWaterfall = frame.name.startsWith(LAYOUT_BASE_NAMES.cleanWaterfall);
        const isArticle = frame.name.startsWith(LAYOUT_BASE_NAMES.structuredText);
        const layoutType = isWaterfall ? 'waterfall' : (isArticle ? 'article' : 'specimen');
        
        console.log(`[LLM Text Generation] 🎬 Starting ${layoutType} generation with API key: ${apiKey.substring(0, 7)}...`);
        
        // Generate text with LLM - improved error handling
        let newText: string;
        let articleContent: any = null;
        
        if (isArticle) {
            // ⚠️ ARTICLE LAYOUT ONLY - DO NOT AFFECT SPECIMEN/WATERFALL
            console.log(`[LLM Text Generation] 🎯 Processing ARTICLE layout with LLM generation`);
            articleContent = await generateArticleContentWithLLM(apiKey);
            if (articleContent && articleContent.headline) {
                newText = articleContent.headline;
                console.log(`[LLM Text Generation] ✅ Generated LLM article content with headline: "${newText}"`);
            } else {
                // Fallback to local article generation
                const localContent = generateLocalArticleContent();
                newText = localContent.headline;
                console.log(`[LLM Text Generation] 📝 Fallback to local article content with headline: "${newText}"`);
            }
        } else {
            // ✅ SPECIMEN & WATERFALL LAYOUTS - UNCHANGED FROM ORIGINAL
            console.log(`[LLM Text Generation] 🎯 Processing ${isWaterfall ? 'WATERFALL' : 'SPECIMEN'} layout - original behavior preserved`);
            const llmLayoutType = isWaterfall ? 'waterfall' : 'specimen';
            newText = await generateTextWithLLM(apiKey, llmLayoutType);
        }
        console.log(`[LLM Text Generation] 📝 API call completed. Raw result: "${newText}"`);
        
        // Validate the generated text
        if (!newText || newText.trim().length === 0) {
            throw new Error('LLM returned empty or invalid text');
        }
        
        console.log(`[LLM Text Generation] ✅ Generated valid text: "${newText}"`);
        
        // Find target nodes (headlines and body text)
        const headlineNodes = findTargetTextNodes(frame, isWaterfall, isArticle);
        const bodyNodes = isWaterfall ? [] : findBodyTextNodes(frame, isArticle); // Update body text for specimens and articles
        console.log(`[LLM Text Generation] 🎯 Found ${headlineNodes.length} headline nodes and ${bodyNodes.length} body text nodes`);
        
        // DEBUG: Log the node names and current text
        headlineNodes.forEach((node, i) => {
            console.log(`[LLM Text Generation] Headline Node ${i}: "${node.name}" - Current text: "${node.characters}" - Font: ${JSON.stringify(node.fontName)}`);
        });
        
        if (headlineNodes.length > 0) {
            // Load fonts first
            await loadFontsForNodes([...headlineNodes, ...bodyNodes]);
            
            // Update body text instantly with smart content (before headline animation)
            if (bodyNodes.length > 0) {
                let bodyIndex = 0;
                bodyNodes.forEach(node => {
                    if (node.fontName !== figma.mixed) {
                        let bodyContent: string;
                        
                        // Use LLM article body content if available for articles
                        if (isArticle && articleContent && articleContent.bodyParagraphs && articleContent.bodyParagraphs[bodyIndex]) {
                            bodyContent = articleContent.bodyParagraphs[bodyIndex];
                            console.log(`[LLM Text Generation] Using LLM body content ${bodyIndex}: "${bodyContent.substring(0, 50)}..."`);
                            bodyIndex++;
                        } else {
                            bodyContent = localBodySentence(); // Fallback to local content
                        }
                        
                        node.characters = bodyContent;
                    }
                });
                console.log(`[LLM Text Generation] 📝 Updated ${bodyNodes.length} body text nodes with ${isArticle && articleContent ? 'LLM' : 'local'} content`);
            }
            
            // 🎭 TYPING ANIMATION for headlines
            if (isArticle) {
                // For articles, animate each headline with LLM content if available
                const animationPromises: Promise<void>[] = [];
                let headlineIndex = 0;
                
                for (const node of headlineNodes) {
                    console.log(`[Article Animation] Processing node: "${node.name}" - Font mixed: ${node.fontName === figma.mixed}`);
                    if (node.fontName !== figma.mixed) {
                        let uniqueHeadline: string;
                        
                        // Use LLM content if available, otherwise generate local content
                        if (articleContent) {
                            // Use main headline for first node, subheadings for h4 nodes
                            if (headlineIndex === 0) {
                                uniqueHeadline = articleContent.headline || localArticleHeadline();
                            } else if (node.name.includes('- h4') && articleContent.subheadings && articleContent.subheadings[headlineIndex - 1]) {
                                uniqueHeadline = articleContent.subheadings[headlineIndex - 1];
                            } else {
                                uniqueHeadline = localArticleHeadline();
                            }
                        } else {
                            uniqueHeadline = localArticleHeadline();
                        }
                        
                        console.log(`[Article Animation] Using headline: "${uniqueHeadline}" for node: "${node.name}"`);
                        
                        // Remove line breaks for h4 headlines (keep them for h1/display)
                        if (node.name.includes('- h4')) {
                            uniqueHeadline = uniqueHeadline.replace('\n', ' ');
                            console.log(`[Article Animation] Processed for h4: "${uniqueHeadline}"`);
                        }
                        
                        // Start all animations simultaneously
                        console.log(`[Article Animation] Starting animation for node: "${node.name}" with text: "${uniqueHeadline}"`);
                        animationPromises.push(typeTextAnimation([node], uniqueHeadline, 30));
                        headlineIndex++;
                    } else {
                        console.warn(`[Article Animation] Skipping node "${node.name}" due to mixed font`);
                    }
                }
                // Wait for all animations to complete
                await Promise.all(animationPromises);
            } else {
                // For specimen/waterfall, use same text for all headlines
                await typeTextAnimation(headlineNodes, newText, 48);
            }
            console.log(`[LLM Text Generation] 🎬 Typing animation completed`);
        }
        
        console.log(`[LLM Text Generation] 🎉 Successfully completed ${layoutType} update`);
    } catch (error) {
        console.error(`[LLM Text Generation] 💥 LLM generation failed:`, error);
        console.warn(`[LLM Text Generation] ⚠️ Falling back to traditional cycling...`);
        // Fallback to traditional cycling on error - this ensures endless generation
        await handleTraditionalTextCycling(frame);
    }
}

async function handleTraditionalTextCycling(frame: FrameNode): Promise<void> {
    // This is the existing logic, extracted for reuse
    if (frame.name.startsWith(LAYOUT_BASE_NAMES.cleanWaterfall)) {
        // --- Waterfall Update Logic ---
        const nextWaterfallIndex = (currentWaterfallTextIndex + 1) % waterfallTexts.length;
        const newWaterfallText = waterfallTexts[nextWaterfallIndex];
        console.log(`[event-handlers] Updating WATERFALL. Applying text: "${newWaterfallText}"`);

        const targetNodes = findTargetTextNodes(frame, true, false);
        
        if (targetNodes.length > 0) {
            await loadFontsForNodes(targetNodes);
            targetNodes.forEach(node => { 
                if (node.fontName !== figma.mixed) {
                    node.characters = newWaterfallText;
                }
            });
            
            console.log(`[event-handlers] Updated ${targetNodes.length} Waterfall nodes text to: "${newWaterfallText}"`);
            currentWaterfallTextIndex = nextWaterfallIndex;
        }
    } else if (frame.name.startsWith(LAYOUT_BASE_NAMES.specimenCompact)) {
        // --- Specimen Compact Update Logic ---
        const newHeadingContent = localHeadline();
        console.log(`[event-handlers] Updating SPECIMEN COMPACT. Applying to 'Heading here' instances: "${newHeadingContent.replace('\n', ' ')}"`);

        const headlineNodes = findTargetTextNodes(frame, false, false);
        const bodyNodes = findBodyTextNodes(frame, false); // isArticle = false for specimen compact
        
        if (headlineNodes.length > 0) {
            await loadFontsForNodes([...headlineNodes, ...bodyNodes]);
            
            // Update headlines
            headlineNodes.forEach(node => { 
                if (node.fontName !== figma.mixed) {
                    node.characters = newHeadingContent;
                }
            });
            
            // Update body text simultaneously
            if (bodyNodes.length > 0) {
                bodyNodes.forEach(node => {
                    if (node.fontName !== figma.mixed) {
                        node.characters = localBodySentence(); // Different content for each node
                    }
                });
                console.log(`[event-handlers] Updated ${bodyNodes.length} body text nodes with different content.`);
            }
            
            console.log(`[event-handlers] Updated Specimen Compact "Heading here" nodes.`);
            syncSpecimenRowWidthsAfterTextChange(frame);
        }
    } else if (frame.name.startsWith(LAYOUT_BASE_NAMES.structuredText)) {
        // --- Article/Structured Text Update Logic ---
        console.log(`[event-handlers] Updating ARTICLE. Generating unique headlines for each section...`);

        const headlineNodes = findTargetTextNodes(frame, false, true);
        const bodyNodes = findBodyTextNodes(frame, true); // isArticle = true for article layout
        
        console.log(`[Traditional Article Update] Found ${headlineNodes.length} headline nodes:`);
        headlineNodes.forEach((node, i) => {
            console.log(`[Traditional Article Update] Node ${i}: "${node.name}" - Current: "${node.characters}"`);
        });
        
        if (headlineNodes.length > 0) {
            await loadFontsForNodes([...headlineNodes, ...bodyNodes]);
            
            // Update headlines with new article-specific generator - EACH gets different content
            headlineNodes.forEach(node => { 
                if (node.fontName !== figma.mixed) {
                    let uniqueHeadline = localArticleHeadline();
                    console.log(`[Traditional Article Update] Generated "${uniqueHeadline}" for node "${node.name}"`);
                    
                    // Remove line breaks for h4 headlines (keep them for h1/display)
                    if (node.name.includes('- h4')) {
                        uniqueHeadline = uniqueHeadline.replace('\n', ' ');
                        console.log(`[Traditional Article Update] Line breaks removed: "${uniqueHeadline}"`);
                    }
                    
                    console.log(`[Traditional Article Update] Setting characters for "${node.name}": "${uniqueHeadline}"`);
                    node.characters = uniqueHeadline; // Generate DIFFERENT headline for each node
                } else {
                    console.warn(`[Traditional Article Update] Skipping "${node.name}" due to mixed font`);
                }
            });
            
            // Update body text simultaneously
            if (bodyNodes.length > 0) {
                bodyNodes.forEach(node => {
                    if (node.fontName !== figma.mixed) {
                        node.characters = localBodySentence(); // Different content for each node
                    }
                });
                console.log(`[event-handlers] Updated ${bodyNodes.length} body text nodes with different content.`);
            }
            
            console.log(`[event-handlers] Updated Article headline nodes.`);
        }
    }
}

// NEW: Smart text cycling with animation (no API key required)
export async function handleSmartTextCycling(frame: FrameNode): Promise<void> {
    try {
        const isWaterfall = frame.name.startsWith(LAYOUT_BASE_NAMES.cleanWaterfall);
        const isArticle = frame.name.startsWith(LAYOUT_BASE_NAMES.structuredText);
        const layoutType = isWaterfall ? 'waterfall' : (isArticle ? 'article' : 'specimen');
        
        console.log(`[Smart Text Cycling] 🎬 Starting ${layoutType} generation with smart buckets...`);
        
        // Generate smart text without LLM
        let newText: string;
        
        if (isArticle) {
            // Use local article content generation
            const localContent = generateLocalArticleContent();
            newText = localContent.headline;
            console.log(`[Smart Text Cycling] 📝 Generated local article headline: "${newText}"`);
        } else if (isWaterfall) {
            // Use smart waterfall generation (call the existing function)
            newText = await generateTextWithLLM('', 'waterfall'); // Empty API key since it uses local buckets
            console.log(`[Smart Text Cycling] 📝 Generated smart waterfall: "${newText}"`);
        } else {
            // Use smart specimen headlines from buckets
            newText = localHeadline();
            console.log(`[Smart Text Cycling] 📝 Generated smart headline: "${newText}"`);
        }
        
        // Find target nodes
        const headlineNodes = findTargetTextNodes(frame, isWaterfall, isArticle);
        const bodyNodes = findBodyTextNodes(frame, isArticle);
        
        console.log(`[Smart Text Cycling] 🔍 Found ${headlineNodes.length} headline nodes and ${bodyNodes.length} body nodes`);
        if (headlineNodes.length === 0) {
            console.warn('[Smart Text Cycling] ⚠️ NO HEADLINE NODES FOUND - animation skipped!');
        }
        
        if (headlineNodes.length > 0) {
            // Load fonts first
            await loadFontsForNodes([...headlineNodes, ...bodyNodes]);
            
            // Update body text with smart content (instant)
            if (bodyNodes.length > 0) {
                bodyNodes.forEach(node => {
                    if (node.fontName !== figma.mixed) {
                        node.characters = localBodySentence(); // Smart Wikipedia-style content
                    }
                });
                console.log(`[Smart Text Cycling] 📝 Updated ${bodyNodes.length} body text nodes with smart content`);
            }
            
            // 🎭 TYPING ANIMATION for headlines (always enabled)
            if (isArticle) {
                // For articles, animate each headline with different content
                const animationPromises: Promise<void>[] = [];
                let headlineIndex = 0;
                
                for (const node of headlineNodes) {
                    console.log(`[Smart Article Animation] Processing node: "${node.name}"`);
                    if (node.fontName !== figma.mixed) {
                        let uniqueHeadline = localArticleHeadline();
                        
                        // Remove line breaks for h4 headlines (keep them for h1/display)
                        if (node.name.includes('- h4')) {
                            uniqueHeadline = uniqueHeadline.replace('\n', ' ');
                        }
                        
                        console.log(`[Smart Article Animation] Starting animation for "${node.name}": "${uniqueHeadline}"`);
                        animationPromises.push(typeTextAnimation([node], uniqueHeadline, 30));
                        headlineIndex++;
                    }
                }
                // Wait for all animations to complete
                await Promise.all(animationPromises);
            } else {
                // For specimen/waterfall, use same text for all headlines with typing animation
                if (!isWaterfall && !isArticle) {
                    let lastSyncAt = 0;
                    const throttledSync = () => {
                        const now = Date.now();
                        if (now - lastSyncAt < 120) return;
                        lastSyncAt = now;
                        syncSpecimenRowWidthsAfterTextChange(frame);
                    };
                    await typeTextAnimation(headlineNodes, newText, 48, throttledSync);
                } else {
                    await typeTextAnimation(headlineNodes, newText, 48);
                }
            }
            console.log(`[Smart Text Cycling] 🎬 Typing animation completed`);
            if (!isWaterfall && !isArticle) {
                syncSpecimenRowWidthsAfterTextChange(frame);
                await new Promise(resolve => setTimeout(resolve, 40));
                syncSpecimenRowWidthsAfterTextChange(frame);
            }
        }
        
        console.log(`[Smart Text Cycling] 🎉 Successfully completed ${layoutType} smart update`);
    } catch (error) {
        console.error(`[Smart Text Cycling] 💥 Smart cycling failed:`, error);
        throw error; // Re-throw to trigger fallback
    }
}

// NEW: Play text on scanned frames - replaces text with placeholder matching original word counts
export async function handlePlayTextForScannedFrame(
    containerId: string,
    wordCounts: Map<string, number>
): Promise<void> {
    console.log(`[Play Text - Scanned Frame] 🎬 Starting play text for container: ${containerId}`);
    
    try {
        const container = figma.getNodeById(containerId);
        if (!container || container.removed) {
            console.warn('[Play Text - Scanned Frame] ⚠️ Container not found or removed');
            return;
        }
        
        // Get all text nodes in the container
        const textNodes: TextNode[] = [];
        const findTextNodesRecursive = (node: SceneNode) => {
            if (node.type === 'TEXT') {
                textNodes.push(node);
            }
            if ('children' in node) {
                for (const child of (node as any).children) {
                    findTextNodesRecursive(child as SceneNode);
                }
            }
        };
        findTextNodesRecursive(container as SceneNode);
        
        console.log(`[Play Text - Scanned Frame] 📝 Found ${textNodes.length} text nodes`);
        
        // Load fonts for all nodes first
        await loadFontsForNodes(textNodes);
        
        // Separate headlines (larger sizes) from body text
        // Headlines threshold: > 24px (typical heading sizes)
        const HEADLINE_THRESHOLD = 24;
        const headlineNodes: TextNode[] = [];
        const bodyNodes: TextNode[] = [];
        
        for (const node of textNodes) {
            if (node.fontName === figma.mixed || node.fontSize === figma.mixed) continue;
            const fontSize = node.fontSize as number;
            if (fontSize > HEADLINE_THRESHOLD) {
                headlineNodes.push(node);
            } else {
                bodyNodes.push(node);
            }
        }
        
        console.log(`[Play Text - Scanned Frame] 🎯 Headlines: ${headlineNodes.length}, Body: ${bodyNodes.length}`);
        
        // Use one term-bank pack per play-text operation.
        const headingText = localHeadline();

        // 1. Update BODY TEXT instantly (no animation)
        let updatedCount = 0;
        for (const node of bodyNodes) {
            const originalWordCount = wordCounts.get(node.id);
            if (originalWordCount !== undefined && originalWordCount > 0) {
                try {
                    const newText = localBodySentence();
                    node.characters = newText;
                    updatedCount++;
                } catch (e) {
                    console.warn(`[Play Text - Scanned Frame] ⚠️ Could not update body node "${node.name}":`, e);
                }
            }
        }
        console.log(`[Play Text - Scanned Frame] 📝 Updated ${updatedCount} body text nodes (instant)`);
        
        // 2. Update HEADLINES with typing animation
        if (headlineNodes.length > 0) {
            const animationPromises: Promise<void>[] = [];
            
            for (const node of headlineNodes) {
                const originalWordCount = wordCounts.get(node.id);
                if (originalWordCount !== undefined && originalWordCount > 0) {
                    try {
                        const newText = headingText;
                        animationPromises.push(typeTextAnimation([node], newText, 36));
                        console.log(`[Play Text - Scanned Frame] 🎬 Animating headline "${node.name}": ${originalWordCount} words`);
                    } catch (e) {
                        console.warn(`[Play Text - Scanned Frame] ⚠️ Could not animate headline "${node.name}":`, e);
                    }
                }
            }
            
            // Wait for all headline animations to complete
            await Promise.all(animationPromises);
            console.log(`[Play Text - Scanned Frame] 🎬 Headline animations completed`);
        }
        
        console.log(`[Play Text - Scanned Frame] 🎉 Updated ${updatedCount + headlineNodes.length}/${textNodes.length} text nodes`);
        if (container.type === 'FRAME') {
            syncSpecimenRowWidthsAfterTextChange(container);
        }
    } catch (error) {
        console.error(`[Play Text - Scanned Frame] 💥 Failed:`, error);
        throw error;
    }
}

// Debounce timer for live updates to avoid locking the UI during slider drags
let liveUpdateTimeoutId: any = null;
let latestPreviewUpdateSeq = 0;
let latestQueuedPreviewUpdate: { seq: number; data: UpdatePreviewRequest } | null = null;
let isProcessingPreviewUpdate = false;
const DEBUG_PREVIEW_PIPELINE = false;
const debugPreviewPipeline = (...args: unknown[]) => {
    if (DEBUG_PREVIEW_PIPELINE) {
        console.log(...args);
    }
};

export function initializeEventHandlers(state: StateAccessors) {
    console.log("[event-handlers] >>> Initializing event handlers START...");

    const processLatestPreviewUpdates = async () => {
        if (isProcessingPreviewUpdate) {
            return;
        }
        isProcessingPreviewUpdate = true;

        try {
            while (latestQueuedPreviewUpdate) {
                const queuedUpdate = latestQueuedPreviewUpdate;
                latestQueuedPreviewUpdate = null;
                const { seq, data } = queuedUpdate;

                // RESTORED: Original behavior - always use latest frame (generator screen principle)
                const targetFrame = state.getLatestPreviewFrame();
                debugPreviewPipeline(`[event-handlers UPDATE_PREVIEW] 🎯 Triggered with namingConvention: "${data.namingConvention}", showGrid: ${data.showGrid}, gridSize: ${data.roundingGridSize}, seq: ${seq}`);
                debugPreviewPipeline(`[event-handlers UPDATE_PREVIEW] Using LATEST preview frame: "${targetFrame?.name || 'none'}"`);

                // --- Update the latest preview frame (original generator behavior) ---
                if (targetFrame && !targetFrame.removed) {
                    try {
                        debugPreviewPipeline(`[event-handlers UPDATE_PREVIEW] Attempting to update frame. ID: ${targetFrame.id}, Name: "${targetFrame.name}", Removed: ${targetFrame.removed}`);
                    } catch (nameError) {
                        debugPreviewPipeline(`[event-handlers UPDATE_PREVIEW] Attempting to update frame. ID: ${targetFrame.id}, Name: [stale node], Removed: ${targetFrame.removed}`);
                    }
                    const baseFontFamily = data.typeSystem.textMain?.fontFamily || 'Inter';
                    const processedTypeSystem = { ...data.typeSystem };
                    const normalizedLineHeightUnit = data.lineHeightUnit === 'px' ? 'px' : 'percent';
                    const previewTextAlign = data.previewTextAlign ?? data.specimenSnapshot?.ui.previewTextAlign ?? 'left';
                    Object.keys(processedTypeSystem).forEach(key => {
                        processedTypeSystem[key as keyof TypographySystem].fontFamily = processedTypeSystem[key as keyof TypographySystem].fontFamily || baseFontFamily;
                    });
                    await updateGivenFrame(
                        targetFrame,
                        processedTypeSystem,
                        data.selectedStyle,
                        data.showSpecLabels,
                        data.styleVisibility || {},
                        data.availableStyles,
                        state.getCurrentColorMode(),
                        state.getAvailableFontsList(),
                        data.activeMode,
                        data.activeScaleRatio,
                        data.namingConvention,
                        data.showGrid,
                        data.roundingGridSize,
                        normalizedLineHeightUnit,
                        data.specimenSnapshot?.ui.selectedPresetProfile,
                        previewTextAlign,
                        data.baseFontFamily,
                        data.baseFontStyle,
                        data.secondaryFontFamily,
                        data.secondaryFontStyle
                    );

                    // If a newer preview request arrived while this async update was running,
                    // skip writing derived metadata from this stale request.
                    if (seq !== latestPreviewUpdateSeq) {
                        continue;
                    }

                    state.setLatestSelectedStyle(data.selectedStyle);
                    state.setLatestShowSpecLabels(data.showSpecLabels);
                    state.setLatestActiveMode(data.activeMode);
                    state.setLatestActiveScaleRatio(data.activeScaleRatio);

                    // Keep specimen snapshot in sync with latest settings only.
                    try {
                        const existingSnapshotData = targetFrame.getPluginData('specimen-snapshot');
                        const snapshot = data.specimenSnapshot
                            ? { ...data.specimenSnapshot }
                            : (existingSnapshotData ? JSON.parse(existingSnapshotData) : null);

                        if (snapshot) {
                            // Backward-compatible patch path when UI has not yet provided full snapshot.
                            if (!data.specimenSnapshot) {
                                snapshot.styles = data.typeSystem;
                                if (data.baseFontFamily) snapshot.fonts.primaryFontFamily = data.baseFontFamily;
                                if (data.baseFontStyle) snapshot.fonts.primaryFontStyle = data.baseFontStyle;
                                if (data.secondaryFontFamily !== undefined) snapshot.fonts.secondaryFontFamily = data.secondaryFontFamily;
                                if (data.secondaryFontStyle !== undefined) snapshot.fonts.secondaryFontStyle = data.secondaryFontStyle;
                                if (data.styleVisibility) snapshot.styleVisibility = data.styleVisibility;
                                if (data.namingConvention) snapshot.ui.namingConvention = data.namingConvention;
                                if (data.lineHeightUnit) snapshot.ui.lineHeightUnit = data.lineHeightUnit;
                                if (data.roundingGridSize !== undefined) snapshot.ui.roundingGridSize = data.roundingGridSize;
                                snapshot.ui.showSpecLabels = data.showSpecLabels;
                                snapshot.ui.activeMode = data.activeMode;
                                snapshot.ui.colorMode = state.getCurrentColorMode();
                                // Sync theme ID from current backend state
                                const currentTheme = getCurrentPreviewTheme();
                                if (currentTheme) {
                                    snapshot.ui.previewThemeId = currentTheme.id;
                                }
                            }

                            const currentNodeMapping = state.getPreviewNodeMapping();
                            if (currentNodeMapping) {
                                const serialized: { [key: string]: string[] } = {};
                                currentNodeMapping.forEach((ids, key) => { serialized[key] = ids; });
                                snapshot.nodeMapping = serialized;
                            }

                            targetFrame.setPluginData('specimen-snapshot', JSON.stringify(snapshot));
                            debugPreviewPipeline('[event-handlers] 🧬 Updated specimen snapshot + nodeMapping on frame during UPDATE_PREVIEW');
                        }
                    } catch (e) {
                        console.warn('[event-handlers] Failed to update specimen snapshot on UPDATE_PREVIEW:', e);
                    }
                } else if (targetFrame && targetFrame.removed) {
                    debugPreviewPipeline(`[event-handlers] UPDATE_PREVIEW ignored, specimen frame ${targetFrame.id} has been removed. Clearing reference.`);
                    if (targetFrame === state.getLatestPreviewFrame()) {
                        state.setLatestPreviewFrame(null); // Clear the stale reference only if it's the latest
                    }
                }

                // --- Safely handle the live-tweaking design frame ---
                const liveFrameId = state.getLiveTweakingTargetFrameId();
                const liveNodeMappings = state.getLiveTweakingNodeMappings();

                if (liveFrameId && liveNodeMappings && liveNodeMappings.length > 0) {
                    if (liveUpdateTimeoutId) {
                        clearTimeout(liveUpdateTimeoutId);
                    }
                    liveUpdateTimeoutId = setTimeout(() => {
                        // Do not apply delayed live updates from stale requests.
                        if (seq !== latestPreviewUpdateSeq) {
                            return;
                        }
                        try {
                            const userDesignFrame = figma.getNodeById(liveFrameId);

                            if (userDesignFrame && !userDesignFrame.removed) {
                                debugPreviewPipeline(`%c[event-handlers UPDATE_PREVIEW] LIVE UPDATE TRIGGERED for user frame ID: ${liveFrameId}`, 'background: #222; color: #bada55');
                                const updatePromises: Promise<void>[] = [];
                                for (const mapping of liveNodeMappings) {
                                    // CRITICAL FIX: The previous `findOne` was causing catastrophic lag on complex frames and components
                                    // because it searched the entire deep subtree repeatedly for EVERY single style mapping.
                                    // We already know the exact Node ID from the mapping, so we can just use `getNodeById`
                                    // which is an instant O(1) memory lookup in Figma.
                                    const node = figma.getNodeById(mapping.nodeId);
                                    
                                    // We still check if it's a TEXT node just to be safe, though our mapping guarantees it should be.
                                    if (node && !node.removed && node.type === 'TEXT') {
                                        const textNode = node as TextNode;
                                        const stylePropsToApply = data.typeSystem[mapping.systemStyleKey];
                                        if (stylePropsToApply) {
                                            const targetFamily = stylePropsToApply.fontFamily;
                                            const targetStyle = stylePropsToApply.fontStyle;
                                            if (targetFamily && targetStyle) {
                                                try {
                                                    // SAFE: Wrap node property access in try-catch to handle stale references
                                                    let nodeName = '[stale node]';
                                                    try {
                                                        nodeName = textNode.name;
                                                    } catch {
                                                        // Node name inaccessible, use fallback
                                                    }
                                                    console.log(`   Applying live style ${mapping.systemStyleKey} to node ${nodeName} (${textNode.id})`);
                                                    updatePromises.push(
                                                        applyTextStyleToNode(
                                                            textNode,
                                                            stylePropsToApply,
                                                            { family: targetFamily, style: targetStyle },
                                                            state.getAvailableFontsList(),
                                                            `LiveUpdate-${nodeName}`
                                                        )
                                                    );
                                                } catch (nodeAccessError) {
                                                    console.warn(`[event-handlers] Skipping stale node ${mapping.nodeId} in live update:`, nodeAccessError);
                                                    // Remove this stale mapping from future updates
                                                    const updatedMappings = liveNodeMappings.filter(m => m.nodeId !== mapping.nodeId);
                                                    if (updatedMappings.length !== liveNodeMappings.length) {
                                                        state.setLiveTweakingNodeMappings(updatedMappings.length > 0 ? updatedMappings : null);
                                                        console.log(`[event-handlers] Cleaned stale node mapping. Remaining: ${updatedMappings.length}`);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                                Promise.all(updatePromises).catch(err => console.error(`[event-handlers UPDATE_PREVIEW] Error during live update of user frame:`, err));
                            } else {
                                debugPreviewPipeline(`%c[event-handlers UPDATE_PREVIEW] LIVE UPDATE CONTEXT CLEARED because frame ${liveFrameId} was invalid or removed.`, 'background: #222; color: #ff8888');
                                state.setLiveTweakingTargetFrameId(null);
                                state.setLiveTweakingNodeMappings(null);
                            }
                        } catch (error) {
                            debugPreviewPipeline(`%c[event-handlers UPDATE_PREVIEW] LIVE UPDATE ERROR: Node ${liveFrameId} not found or deleted. Clearing context.`, 'background: #222; color: #ff8888');
                            state.setLiveTweakingTargetFrameId(null);
                            state.setLiveTweakingNodeMappings(null);
                        }
                    }, 150); // 150ms debounce
                }
            }
        } finally {
            isProcessingPreviewUpdate = false;
            // If something arrived between the final loop check and finally,
            // process once more to guarantee latest-wins behavior.
            if (latestQueuedPreviewUpdate) {
                processLatestPreviewUpdates();
            }
        }
    };

    // --- Event Handlers ---
    on('UPDATE_PREVIEW', (data: UpdatePreviewRequest) => {
        latestPreviewUpdateSeq += 1;
        latestQueuedPreviewUpdate = { seq: latestPreviewUpdateSeq, data };
        processLatestPreviewUpdates();
    });

    // CREATE_STYLES handler moved to main.ts to avoid duplication

    on('UI_READY', async () => {
        console.log("[event-handlers] Received UI_READY event from UI.");
        try {
            const figmaFontList = await figma.listAvailableFontsAsync();
            const fonts: FontInfo[] = figmaFontList.map(font => ({
                family: font.fontName.family,
                style: font.fontName.style
            }));
            state.setAvailableFontsList(fonts); // Update state via setter

            // Emit the full list for other UI parts that need it
            emit('AVAILABLE_FONTS_LIST_UPDATE', { availableFonts: fonts } as AvailableFontsListUpdateEvent);

            const families = Array.from(new Set(fonts.map(font => font.family))).sort();
            let initialFamily = 'Inter';
            if (!families.includes(initialFamily)) {
                initialFamily = families.length > 0 ? families[0] : 'Arial';
            }
            const initialStyles = fonts
                .filter(font => font.family === initialFamily)
                .map(font => font.style)
                .sort();

            console.log(`[event-handlers] Found ${families.length} families. Initial: ${initialFamily}`);
            emit('INITIAL_FONTS', { families, googleFonts: googleFontFamilyNames, initialFamily, initialStyles });
            figma.ui.postMessage({ type: 'CHECK_THEME' });
        } catch (error) {
            console.error('[event-handlers] Error getting font list:', error);
            const defaultFamilies = ['Inter', 'Arial', 'Times New Roman'];
            const defaultStyles = ['Regular', 'Bold', 'Italic'];
            emit('INITIAL_FONTS', { families: defaultFamilies, googleFonts: googleFontFamilyNames, initialFamily: 'Inter', initialStyles: defaultStyles });
        }
    });

    on('GET_STYLES_FOR_FAMILY', (selectedFamily: string) => {
        console.log(`[event-handlers] Received GET_STYLES_FOR_FAMILY for: ${selectedFamily}`);
        const availableFonts = state.getAvailableFontsList(); // Get state via getter
        if (!availableFonts || availableFonts.length === 0) {
            console.warn('[event-handlers] Font list not available yet.');
            emit('STYLES_FOR_FAMILY', { family: selectedFamily, styles: ['Regular'] });
            return;
        }
        const styles = availableFonts
            .filter(font => font.family === selectedFamily)
            .map(font => font.style)
            .sort();
        console.log(`[event-handlers] Styles for ${selectedFamily}:`, styles);
        emit('STYLES_FOR_FAMILY', { family: selectedFamily, styles: styles.length > 0 ? styles : ['Regular'] });
    });

    on('CREATE_PREVIEW', async (data: CreatePreviewEvent) => {
        console.log(`[event-handlers] CREATE_PREVIEW received with action: ${data.action}, naming convention: ${data.namingConvention}`);
        console.log('[event-handlers] 🎯 styleVisibility status:', !!data.styleVisibility);
        try {
            await stopActiveTextPlayback();

            // Get API key ONLY for structured text (article) layouts - DO NOT affect specimen/waterfall
            let apiKey: string | undefined = undefined;
            if (data.layoutType === 'structuredText') {
                const keyFromStorage = await getOpenaiApiKey();
                apiKey = keyFromStorage || undefined;
                console.log(`[event-handlers] CREATE_PREVIEW API key ${apiKey ? `found (${apiKey.substring(0, 7)}...)` : 'not found'} for ARTICLE layout`);
                console.log(`[event-handlers] CREATE_PREVIEW will pass API key to managePreview: ${!!apiKey}`);
            } else {
                console.log(`[event-handlers] CREATE_PREVIEW skipping API key for ${data.layoutType} layout (specimen/waterfall unchanged)`);
            }
            
            const currentFrame = state.getLatestPreviewFrame();
            const result = await managePreview(
                data.layoutType,
                data.typeSystem,
                data.selectedStyle,
                data.showSpecLabels,
                data.activeMode,
                state.getCurrentColorMode(),
                state.getAvailableFontsList(),
                data.activeScaleRatio,
                data.llmOutput,
                data.action,
                currentFrame ? currentFrame.id : null,
                data.namingConvention,
                data.showGrid,
                data.roundingGridSize,
                data.lineHeightUnit,
                data.styleVisibility,
                apiKey, // Only pass API key for article layouts
                data.previewTextAlign,
                data.baseFontFamily, // ADDED: For decorative elements - primary font family
                data.baseFontStyle, // ADDED: For decorative elements - primary font style/weight
                data.secondaryFontFamily, // ADDED: For decorative elements with secondary font
                data.secondaryFontStyle, // ADDED: For decorative elements with secondary font weight
                data.specimenSnapshot?.ui.selectedPresetProfile
            );
            
            if (result) {
                state.setLatestPreviewFrame(result.frame);
                state.setPreviewNodeMapping(result.nodeMap);
                
                // Store specimen snapshot as pluginData on the frame for sampling
                if (data.specimenSnapshot) {
                    try {
                        const snapshotToStore = { ...data.specimenSnapshot };
                        if (result.nodeMap) {
                            const serialized: { [key: string]: string[] } = {};
                            result.nodeMap.forEach((ids, key) => { serialized[key] = ids; });
                            snapshotToStore.nodeMapping = serialized;
                        }
                        result.frame.setPluginData('specimen-snapshot', JSON.stringify(snapshotToStore));
                        console.log('[event-handlers] 🧬 Stored specimen snapshot + nodeMapping on frame.');
                    } catch (e) {
                        console.warn('[event-handlers] Failed to store specimen snapshot:', e);
                    }
                }
                
                console.log('[event-handlers] Stored new preview frame and node map.');
            } else {
                state.setLatestPreviewFrame(null);
                state.setPreviewNodeMapping(null);
                console.log('[event-handlers] Preview creation failed. Cleared frame and node map.');
            }

            // Update latest parameters
            state.setLatestSelectedStyle(data.selectedStyle);
            state.setLatestShowSpecLabels(data.showSpecLabels);
            state.setLatestActiveMode(data.activeMode);
            state.setLatestActiveScaleRatio(data.activeScaleRatio);

            if (data.action === 'create') {
              // Clear live tweaking context only when creating a new frame from scratch
              state.setLiveTweakingTargetFrameId(null);
              state.setLiveTweakingNodeMappings(null);
            }
        } finally {
            emit('OPERATION_COMPLETE');
        }
    });

    on('COLOR_MODE_CHANGED', (data: ColorModeChangedMessage) => {
        const themeId = (data.themeId || data.mode) as PreviewThemeId;
        const customColors = data.background && data.text
          ? { background: data.background, text: data.text }
          : undefined;
        const theme = resolvePreviewTheme(themeId, customColors);
        setCurrentPreviewTheme(theme);

        console.log(`[event-handlers] COLOR_MODE_CHANGED received: theme=${theme.id}, base=${theme.base}`);
        state.setCurrentColorMode(theme.base);
        const latestFrame = state.getLatestPreviewFrame();

        if (latestFrame && !latestFrame.removed) {
          const isSpecimenFrame = latestFrame.name.startsWith(LAYOUT_BASE_NAMES.specimenCompact);

          latestFrame.fills = [{ type: 'SOLID', color: theme.background }];
          if (isSpecimenFrame) {
            latestFrame.strokes = [];
            latestFrame.strokeWeight = 0;
          } else {
            latestFrame.strokes = [{ type: 'SOLID', color: theme.frameBorder }];
            latestFrame.strokeWeight = 2;
          }

          const textNodes = latestFrame.findAllWithCriteria({ types: ['TEXT'] }) as TextNode[];
          const isInsideLabelSpecs = (node: SceneNode): boolean => {
            let current: BaseNode | null = node.parent;
            while (current && 'parent' in current) {
              if (current.type === 'FRAME' && (current as FrameNode).name.startsWith('LabelSpecs')) return true;
              current = current.parent;
            }
            return false;
          };
          const tolerance = 0.05;
          const matchesSpecColor = (color: RGB, opacity: number | undefined, refColor: RGB, refOpacity: number) => {
            const colorOk = Math.abs(color.r - refColor.r) < tolerance &&
                            Math.abs(color.g - refColor.g) < tolerance &&
                            Math.abs(color.b - refColor.b) < tolerance;
            const opacityOk = typeof opacity === 'number' && Math.abs(opacity - refOpacity) < 0.15;
            return colorOk && opacityOk;
          };
          textNodes.forEach(textNode => {
            let isSpecLabel = isInsideLabelSpecs(textNode);
            if (!isSpecLabel) {
              const currentFill = textNode.fills;
              if (Array.isArray(currentFill) && currentFill.length > 0 && currentFill[0].type === 'SOLID') {
                const fill = currentFill[0];
                isSpecLabel = matchesSpecColor(fill.color, fill.opacity, SPEC_COLOR, SPEC_COLOR_OPACITY) ||
                              matchesSpecColor(fill.color, fill.opacity, SPEC_COLOR_DARK, SPEC_COLOR_DARK_OPACITY) ||
                              PREVIEW_THEMES.some(t => matchesSpecColor(fill.color, fill.opacity, t.specColor, t.specColorOpacity));
              }
            }
            if (isSpecLabel) {
                 textNode.fills = [{ type: 'SOLID', color: theme.specColor, opacity: theme.specColorOpacity }];
            } else {
                 textNode.fills = [{ type: 'SOLID', color: theme.text }];
            }
          });
          // Update spec border strokes on label rows
          const allFrames = latestFrame.findAllWithCriteria({ types: ['FRAME'] }) as FrameNode[];
          allFrames.forEach(frameNode => {
            if (frameNode.name.startsWith('LabelSpecs') && Array.isArray(frameNode.strokes) && frameNode.strokes.length > 0) {
              frameNode.strokes = [{ type: 'SOLID', color: theme.specBorderColor, opacity: theme.specBorderOpacity }];
            }
          });
          // Persist theme change to snapshot on the frame
          try {
            const existingSnapshotData = latestFrame.getPluginData('specimen-snapshot');
            if (existingSnapshotData) {
              const snapshot = JSON.parse(existingSnapshotData);
              snapshot.ui.colorMode = theme.base;
              snapshot.ui.previewThemeId = theme.id;
              snapshot.ui.customPreviewColors = customColors ?? null;
              latestFrame.setPluginData('specimen-snapshot', JSON.stringify(snapshot));
            }
          } catch (e) {
            console.warn('[event-handlers] Could not persist theme to snapshot:', e);
          }
          console.log(`[event-handlers] Applied theme '${theme.id}' to latest preview frame.`);
        } else {
          console.log('[event-handlers] COLOR_MODE_CHANGED ignored - no latest frame available.');
        }
    });

    console.log("[event-handlers] Attaching UPDATE_SPECIMEN_HEADING listener...");
    // --- Smart Text Cycling with Animation (No API Key Required) ---
    on('UPDATE_SPECIMEN_HEADING', async () => { 
        // CRITICAL: Set flag SYNCHRONOUSLY before starting typing animation
        const { setTextGenerationActive } = await import('../core/main');
        setTextGenerationActive(true);
        
        // Notify UI that text generation is starting
        emit('TEXT_GENERATION_START');

        try {
            // NEW: Check if we have a scanned frame active - use Play Text for scanned frames
            const scannedContainerId = state.getScannedFrameContainerId();
            const scannedWordCounts = state.getScannedFrameWordCounts();
            
            if (scannedContainerId && scannedWordCounts && scannedWordCounts.size > 0) {
                // Use Play Text for scanned frames - replace with placeholder matching word counts
                console.log('[event-handlers] 🎬 Using Play Text for scanned frame');
                await handlePlayTextForScannedFrame(scannedContainerId, scannedWordCounts);
            } else {
                // Use regular specimen text cycling for generated specimens
                const latestFrame = state.getLatestPreviewFrame();
                if (!latestFrame || latestFrame.removed) {
                    console.warn('[event-handlers] No valid preview frame found to update text.');
                    setTextGenerationActive(false);
                    emit('TEXT_GENERATION_COMPLETE');
                    return;
                }
                
                // 🎬 ALWAYS USE SMART CONTENT + TYPING ANIMATION (No API key needed)
                await handleSmartTextCycling(latestFrame);
            }
        } catch (error) {
            console.error('[event-handlers] Error in UPDATE_SPECIMEN_HEADING:', error);
            // Fallback to basic cycling if smart cycling fails
            const latestFrame = state.getLatestPreviewFrame();
            if (latestFrame && !latestFrame.removed) {
                await handleTraditionalTextCycling(latestFrame);
            }
        } finally {
            // Clear flag and notify UI (timestamp will be recorded)
            setTextGenerationActive(false);
            emit('TEXT_GENERATION_COMPLETE');
        }
    });

    // --- NEW: Select all text nodes in the preview frame ---
    on('SELECT_PREVIEW_TEXT_NODES', () => {
        const latestFrame = state.getLatestPreviewFrame();
        if (!latestFrame || latestFrame.removed) {
            figma.notify("No preview frame found to select text from.", { error: true });
            return;
        }

        const textNodes = latestFrame.findAll(n => {
            try {
                return n.type === 'TEXT' && 
                 !n.name.toLowerCase().includes('spec') &&
                       !n.name.toLowerCase().includes('label');
            } catch {
                return false; // Skip stale nodes
            }
        }) as TextNode[];

        if (textNodes.length > 0) {
            figma.currentPage.selection = textNodes;
            figma.notify(`Selected ${textNodes.length} text nodes in the preview.`);
        } else {
            figma.notify("No text nodes found to select in the preview frame.");
        }
    });

    // --- NEW: Event handlers for hover highlighting --- 
    on('HIGHLIGHT_DETECTED_STYLE_GROUP', async (data: { aggregationKey: string }) => {
        // console.log(`[Event Handlers] Received HIGHLIGHT_DETECTED_STYLE_GROUP for key: ${data.aggregationKey}`);
        const cache = state.getCurrentScanSessionNodeCache();
        if (!cache) {
            console.warn("[Event Handlers] No scan session node cache available for highlighting.");
            return;
        }
        const cachedNodes = cache.get(data.aggregationKey);
        if (cachedNodes && cachedNodes.length > 0) {
            // Store current selection if not already stored by this highlight sequence
            if (state.getOriginalSelectionBeforeHighlight() === null) {
                state.setOriginalSelectionBeforeHighlight(figma.currentPage.selection);
            }
            
            // Filter out any nodes that might have been deleted since the scan
            const validNodes = cachedNodes.filter(node => !node.removed);
            
            if (validNodes.length > 0) {
                // Limit to 100 nodes to prevent Figma from lagging when drawing selection boxes for hundreds of nodes
                const nodesToHighlight = validNodes.slice(0, 100);
                figma.currentPage.selection = nodesToHighlight;
                // console.log(`[Event Handlers] Highlighted ${nodesToHighlight.length} nodes for ${data.aggregationKey}.`);
            } else {
                console.log(`[Event Handlers] No valid nodes remaining for key ${data.aggregationKey}`);
            }
        } else {
            console.log(`[Event Handlers] No nodes found in cache for aggregationKey: ${data.aggregationKey}`);
        }
    });

    on('CLEAR_STYLE_HIGHLIGHTS', () => {
        console.log("[Event Handlers] Received CLEAR_STYLE_HIGHLIGHTS.");
        const originalSelection = state.getOriginalSelectionBeforeHighlight();
        if (originalSelection) {
            figma.currentPage.selection = originalSelection;
            state.setOriginalSelectionBeforeHighlight(null); // Clear stored selection
            console.log("[Event Handlers] Restored original selection.");
        } else {
            // If nothing was stored, it might mean the user clicked away or no highlight was active.
            // Optionally, we could clear selection: figma.currentPage.selection = [];
            // But for now, just log if nothing to restore.
            console.log("[Event Handlers] No original selection stored to restore.");
        }
    });

    // --- Preset persistence handlers removed: replaced by specimen sampling ---

    // --- NEW: Enhanced JPG capture handler with timing and selection clearing ---
    on('CAPTURE_PREVIEW_SVG', async () => {
        console.log('[Event Handlers] 📸 CAPTURE_PREVIEW_SVG event received (using PNG)');
        try {
            const latestFrame = state.getLatestPreviewFrame();
            
            // Enhanced safety check with try-catch for stale references
            if (!latestFrame) {
                console.warn('[Event Handlers] 📸 No preview frame reference found for JPG capture');
                emit('PREVIEW_SVG_CAPTURED', { svgData: null });
                return;
            }

            // Safe check for removed/deleted frames
            try {
                if (latestFrame.removed) {
                    console.warn('[Event Handlers] 📸 Preview frame was removed, clearing stale reference');
                    state.setLatestPreviewFrame(null); // Clear the stale reference
                    emit('PREVIEW_SVG_CAPTURED', { svgData: null });
                    return;
                }
                
                // Test frame access to catch stale node references
                const frameName = latestFrame.name; // This will throw if node doesn't exist
                console.log('[Event Handlers] 📸 Capturing JPG from frame:', frameName);
                
            } catch (nodeAccessError) {
                console.warn('[Event Handlers] 📸 Frame node no longer exists (stale reference), clearing state');
                state.setLatestPreviewFrame(null); // Clear the stale reference
                emit('PREVIEW_SVG_CAPTURED', { svgData: null });
                return;
            }

            // 🎯 CLEAR SELECTION AND CREATE TEMPORARY CLONE TO AVOID BORDER
            const originalSelection = figma.currentPage.selection;
            figma.currentPage.selection = []; // Clear selection
            console.log('[Event Handlers] 📸 Cleared selection');

            // 🎯 WAIT FOR NEXT COMPLETE HEADING CYCLE
            console.log('[Event Handlers] 📸 Waiting for next complete heading cycle...');
            
            // Set up a promise that resolves when text generation completes
            const waitForCompleteHeading = new Promise<void>((resolve) => {
                let timeoutId: number;
                
                const completeListener = on('TEXT_GENERATION_COMPLETE', () => {
                    console.log('[Event Handlers] 📸 Complete heading detected, proceeding with capture');
                    clearTimeout(timeoutId);
                    completeListener(); // Clean up listener
                    resolve();
                });
                
                // Fallback timeout in case no text animation is happening
                timeoutId = setTimeout(() => {
                    console.log('[Event Handlers] 📸 No text animation detected, proceeding with capture');
                    completeListener(); // Clean up listener
                    resolve();
                }, 1000);
            });
            
            // 📸 INSTANT CAMERA FLASH EFFECT - Immediate visual feedback!
            await performFlashEffect(latestFrame);
            
            // Skip text update for capture - not needed 
            // emit('UPDATE_SPECIMEN_HEADING');
            // await waitForCompleteHeading;
            
            // Brief pause to ensure frame is stable after flash
            await new Promise(resolve => setTimeout(resolve, 50));

            // 🎭 CREATE TEMPORARY CLONE FOR CLEAN EXPORT
            let frameToExport = latestFrame;
            let tempClone: FrameNode | null = null;
            
            try {
                // Clone the frame to export without any selection artifacts
                tempClone = latestFrame.clone();
                tempClone.name = `${latestFrame.name} - TEMP EXPORT`;
                tempClone.x = latestFrame.x + latestFrame.width + 100; // Place off to the side
                tempClone.y = latestFrame.y;
                frameToExport = tempClone;
                console.log('[Event Handlers] 📸 Created temporary clone for export');
            } catch (cloneError) {
                console.warn('[Event Handlers] 📸 Clone failed, using original frame:', cloneError);
                frameToExport = latestFrame;
            }

            // 📸 CAPTURE PNG AFTER FLASH EFFECT
            try {
                const pngData = await frameToExport.exportAsync({ 
                    format: 'PNG',
                    useAbsoluteBounds: false,
                });
                
                // Convert to base64 data URL
                const base64String = figma.base64Encode(pngData);
                const pngDataUrl = `data:image/png;base64,${base64String}`;
                console.log('[Event Handlers] 📸 PNG captured successfully after flash, data URL length:', pngDataUrl.length);
                
                emit('PREVIEW_SVG_CAPTURED', { svgData: pngDataUrl });
            } finally {
                // 🧹 CLEANUP TEMPORARY CLONE
                if (tempClone) {
                    try {
                        tempClone.remove();
                        console.log('[Event Handlers] 📸 Removed temporary clone');
                    } catch (cleanupError) {
                        console.warn('[Event Handlers] 📸 Failed to cleanup temp clone:', cleanupError);
                    }
                }
                
                // 🔄 RESTORE ORIGINAL SELECTION
                figma.currentPage.selection = originalSelection;
                console.log('[Event Handlers] 📸 Restored original selection');
            }
            
        } catch (error) {
            console.error('[Event Handlers] ❌ Error capturing PNG:', error);
            // Clear any stale frame reference on error
            state.setLatestPreviewFrame(null);
            emit('PREVIEW_SVG_CAPTURED', { svgData: null });
        }
    });
} 