import { emit } from '@create-figma-plugin/utilities';
import {
    ProcessUnformattedTextRequestEvent,
    ProcessUnformattedTextResponseEvent,
    TypographySystem,
    FontInfo
} from '../core/types';
import { LlmStructuredContent } from './llm-prompts';
import { getOpenaiApiKey, getStructuredTextFromLLM } from './openai-utils';
import { generateStructuringPrompt } from './llm-prompts';
import { managePreview } from '../preview/preview-manager';

export async function handleProcessUnformattedText(
    eventData: ProcessUnformattedTextRequestEvent,
    setLatestPreviewFrame: (frame: FrameNode | null) => void,
    getLatestPreviewFrame: () => FrameNode | null,
    getCurrentColorMode: () => 'light' | 'dark',
    setPreviewNodeMapping: (mapping: Map<string, string[]> | null) => void
): Promise<void> {
    console.log('[text-processor] Received PROCESS_UNFORMATTED_TEXT_REQUEST:', eventData);

    const {
        unformattedText,
        selectedContentType,
        typeSystem,
        selectedStyle,
        showSpecLabels,
        availableFontsList,
        baseFontFamily,
        activeScaleRatio,
        activeMode
    } = eventData;

    try {
        const apiKey = await getOpenaiApiKey();
        if (!apiKey) {
            figma.notify("OpenAI API key not set. Please set it in the plugin settings.", { error: true });
            emit('PROCESS_UNFORMATTED_TEXT_RESPONSE', { success: false, error: "API key not set" } as ProcessUnformattedTextResponseEvent);
            return;
        }

        const prompt = generateStructuringPrompt(unformattedText, selectedContentType);
        console.log('[text-processor] Generated LLM prompt.');

        const llmResponse: LlmStructuredContent | null = await getStructuredTextFromLLM(apiKey, prompt);

        if (!llmResponse || !llmResponse.elements || llmResponse.elements.length === 0) {
            console.error('[text-processor] Failed to get valid structured content from LLM.');
            emit('PROCESS_UNFORMATTED_TEXT_RESPONSE', { success: false, error: "LLM did not return valid content." } as ProcessUnformattedTextResponseEvent);
            return;
        }

        console.log('[text-processor] Successfully received and parsed LLM response.');

        // --- UNIFIED FRAME CREATION ---
        const currentFrame = getLatestPreviewFrame();
        const newFrameResult = await managePreview(
            'structuredText',
            typeSystem,
            selectedStyle,
            showSpecLabels,
            activeMode,
            getCurrentColorMode(),
            availableFontsList,
            activeScaleRatio,
            llmResponse,
            'create', // Always 'create' for this flow
            currentFrame ? currentFrame.id : null
        );

        if (newFrameResult) {
            setLatestPreviewFrame(newFrameResult.frame);
            setPreviewNodeMapping(newFrameResult.nodeMap);
            emit('PROCESS_UNFORMATTED_TEXT_RESPONSE', { success: true, llmOutput: llmResponse } as ProcessUnformattedTextResponseEvent);
            emit('NAVIGATE_TO_MAIN_VIEW');
        } else {
            setLatestPreviewFrame(null);
            setPreviewNodeMapping(null);
            emit('PROCESS_UNFORMATTED_TEXT_RESPONSE', { success: false, error: "Frame creation failed." } as ProcessUnformattedTextResponseEvent);
        }

    } catch (error: any) {
        console.error('[text-processor] Error processing unformatted text:', error);
        figma.notify(`Error: ${error.message || 'Could not process text.'}`, { error: true });
        setLatestPreviewFrame(null);
        setPreviewNodeMapping(null);
        emit('PROCESS_UNFORMATTED_TEXT_RESPONSE', { success: false, error: error.message || "Unknown error" } as ProcessUnformattedTextResponseEvent);
    }
} 