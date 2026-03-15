// src/preview-manager.ts
// Manages the creation and renaming of preview frames.

import { LlmStructuredContent, PreviewLayoutType, PreviewTextAlignMode, TypographySystem, FontInfo, PreviewLayoutHandlerParams, PreviewCreateResult } from '../core/types';
import {
    LAYOUT_BASE_NAMES,
    PREVIEW_WIDTH,
} from '../core/constants';
import { getCurrentPreviewTheme } from '../core/preview-theme-state';
// import { createPreviewFrame } from './preview-layouts/specimen'; // Removed import
import { getPreviewLayoutHandler } from './preview-layout-registry';

const getPresetProfileLabel = (selectedPresetProfile?: 'desktop' | 'mobile' | 'social' | 'presentation' | 'product' | 'focus') => {
    switch (selectedPresetProfile) {
        case 'mobile': return 'Mobile';
        case 'social': return 'Social';
        case 'presentation': return 'Presentation';
        case 'product': return 'Product';
        case 'focus': return 'Focus';
        case 'desktop':
        default:
            return 'Desktop';
    }
};

const getSpecimenTimestamp = () => {
    const now = new Date();
    const date = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    return { date, time };
};

/**
 * Centralized function to handle preview frame creation and management.
 * Determines which frame creation function to call based on layoutType.
 * Renames the previously active frame.
 * Returns the newly created frame node.
 */
export async function managePreview(
    layoutType: PreviewLayoutType,
    typeSystem: TypographySystem,
    selectedStyle: string,
    showSpecLabels: boolean,
    activeMode: 'desktop' | 'mobile',
    currentColorMode: 'light' | 'dark',
    availableFontsList: FontInfo[],
    activeScaleRatio: number,
    llmOutput?: LlmStructuredContent,
    action: 'create' | 'reset' = 'create',
    currentFrameId?: string | null,
    namingConvention?: string, // ADDED: For proper naming convention support
    showGrid?: boolean, // ADDED: Show grid overlay on individual items
    roundingGridSize?: number, // ADDED: Grid size for overlays
    lineHeightUnit?: 'percent' | 'px', // ADDED: Line height unit for specs
    styleVisibility?: { [key: string]: boolean }, // ADDED: Grid visibility state
    apiKey?: string, // ADDED: For LLM article generation
    previewTextAlign?: PreviewTextAlignMode,
    baseFontFamilyOverride?: string, // ADDED: For decorative elements - primary font family
    baseFontStyleOverride?: string, // ADDED: For decorative elements - primary font style/weight
    secondaryFontFamily?: string, // ADDED: For decorative elements with secondary font
    secondaryFontStyle?: string, // ADDED: For decorative elements with secondary font weight
    selectedPresetProfile?: 'desktop' | 'mobile' | 'social' | 'presentation' | 'product' | 'focus'
): Promise<PreviewCreateResult | null> {
    console.log(`[manager] managePreview called with action: "${action}" for layout: ${layoutType}, naming convention: ${namingConvention}`);
    console.log('[manager] 🎯 styleVisibility status:', !!styleVisibility);
    figma.currentPage.selection = [];
    // Use override if provided, otherwise fallback to typeSystem or 'Inter'/'Regular'
    const baseFontFamily = baseFontFamilyOverride || typeSystem.textMain?.fontFamily || 'Inter';
    const baseFontStyle = baseFontStyleOverride || selectedStyle || 'Regular';
    let newFrame: FrameNode | null = null;
    let newNodeMap: Map<string, string[]> | null = null;
    const applyActiveFrameBorder = (frame: FrameNode) => {
        const theme = getCurrentPreviewTheme();
        frame.strokes = [{ type: 'SOLID', color: theme.frameBorder }];
        frame.strokeWeight = 2;
    };

    // --- Process Type System (common for all layouts) ---
    const systemForFrame = { ...typeSystem };
    Object.keys(systemForFrame).forEach(key => {
        if (key.toLowerCase() === 'displayx8') {
             delete systemForFrame[key as keyof TypographySystem];
        }
        const style = systemForFrame[key as keyof TypographySystem];
        if (style && typeof style === 'object' && !style.fontFamily) {
            style.fontFamily = baseFontFamily;
        }
    });

    // --- Calculate position & Manage Previous Frame ---
    const viewport = figma.viewport.center;
    let newX = viewport.x - (PREVIEW_WIDTH / 2);
    let newY = viewport.y - (400 / 2); // Default Y, assuming an average height

    const currentFrame = currentFrameId ? await figma.getNodeByIdAsync(currentFrameId) as FrameNode | null : null;

    if (currentFrame && !currentFrame.removed) {
        if (action === 'reset') {
            console.log(`[manager] Reset action: Removing current active frame: "${currentFrame.name}"`);
            newX = currentFrame.x; // Use exact old position
            newY = currentFrame.y;
            currentFrame.remove();
        } else { // 'create' action
            console.log(`[manager] Create action: Archiving current active frame: "${currentFrame.name}"`);
            
            // --- New Timestamped Naming Logic ---
            const { date, time } = getSpecimenTimestamp();
            
            // The base name is the part before " — "
            const baseName = currentFrame.name.split(' — ')[0];
            if (baseName.startsWith('Specimen')) {
                currentFrame.name = `${baseName} — ${date} — ${time}`;
            } else {
                currentFrame.name = `${baseName} — ${baseFontFamily} ${date}/${time}`;
            }
            currentFrame.strokes = []; // Remove the highlight from the archived frame
            currentFrame.strokeWeight = 0;
            // Let new frame be placed at viewport center
        }
    }

    // --- Create New Frame (using layout handler) ---
    console.log(`[manager] Creating new ${layoutType} preview frame for mode: ${activeMode}.`);
    
    const handler = getPreviewLayoutHandler(layoutType);

    if (handler) {
        const handlerParams: PreviewLayoutHandlerParams = {
            typeSystem: systemForFrame,
            selectedStyle: selectedStyle,
            showSpecLabels,
            currentColorMode,
            availableFontsList,
            baseFontFamily,
            baseFontStyle, // ADDED: For decorative elements - primary font style/weight
            activeMode,
            activeScaleRatio,
            newX,
            llmOutput,
            namingConvention,
            showGrid,
            roundingGridSize,
            lineHeightUnit,
            styleVisibility,
            apiKey,
            previewTextAlign,
            secondaryFontFamily, // ADDED: For decorative elements with secondary font
            secondaryFontStyle, // ADDED: For decorative elements with secondary font weight
            selectedPresetProfile
        };
        
        console.log('[manager] 🎯 handlerParams.styleVisibility status:', !!handlerParams.styleVisibility);
        
        console.log(`[preview-manager] Creating ${layoutType} with API key: ${apiKey ? `${apiKey.substring(0, 7)}...` : 'none'}`);
        console.log(`[preview-manager] handlerParams.apiKey: ${!!handlerParams.apiKey}`);
        const createResult = await handler.create(handlerParams);
        if (createResult) {
            newFrame = createResult.frame;
            newNodeMap = createResult.nodeMap;
        }
    } else {
        console.error(`[manager] Unknown layout type or no handler registered: ${layoutType}`);
        figma.notify("Unknown preview layout type or handler not registered.", { error: true });
        return null;
    }

    // --- Notify User & Finalize (common) ---
    if (newFrame) {
        newFrame.y = newY; // Set the calculated Y position
        if (layoutType !== 'specimenCompact') {
            applyActiveFrameBorder(newFrame);
        } else {
            newFrame.strokes = [];
            newFrame.strokeWeight = 0;
        }
        if (handler) {
            if (layoutType === 'specimenCompact') {
                const { date, time } = getSpecimenTimestamp();
                const profileLabel = getPresetProfileLabel(selectedPresetProfile);
                newFrame.name = `${handler.getBaseName()} ${profileLabel} — ${date} — ${time}`;
            } else {
                newFrame.name = `${handler.getBaseName()} — ${baseFontFamily}`;
            }
        } else {
            if(LAYOUT_BASE_NAMES[layoutType]){
                 newFrame.name = LAYOUT_BASE_NAMES[layoutType];
            } else {
                console.warn("[manager] Frame created but handler not found for naming. Using existing frame name or default.");
            }
        }
        figma.viewport.scrollAndZoomIntoView([newFrame]);
        figma.notify("Preview created!");
        figma.currentPage.appendChild(newFrame);
    } else {
        figma.notify("Failed to create preview.", { error: true });
    }

    return newFrame ? { frame: newFrame, nodeMap: newNodeMap || new Map() } : null;
} 