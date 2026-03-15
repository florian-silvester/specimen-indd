// src/preview-layout-registry.ts
import { PreviewLayout, PreviewLayoutType } from '../core/types';
import { SpecimenCompactLayout } from './preview-layouts/specimen-compact-layout';
import { CleanWaterfallLayout } from './preview-layouts/clean-waterfall-layout';
import { StructuredTextLayout } from './preview-layouts/structured-text-layout';

const layoutRegistry = new Map<PreviewLayoutType, PreviewLayout>();

export function registerPreviewLayout(handler: PreviewLayout): void {
    if (layoutRegistry.has(handler.getLayoutType())) {
        console.warn(`[LayoutRegistry] Handler for layout type "${handler.getLayoutType()}" is being overwritten.`);
    }
    layoutRegistry.set(handler.getLayoutType(), handler);
    console.log(`[LayoutRegistry] Registered layout handler for: ${handler.getLayoutType()}`);
}

export function getPreviewLayoutHandler(layoutType: PreviewLayoutType): PreviewLayout | undefined {
    const handler = layoutRegistry.get(layoutType);
    if (!handler) {
        console.warn(`[LayoutRegistry] No handler found for layout type: ${layoutType}`);
    }
    return handler;
}

export function getAllLayoutTypes(): PreviewLayoutType[] {
    return Array.from(layoutRegistry.keys());
}

// Initialize default layouts
registerPreviewLayout(new SpecimenCompactLayout());
registerPreviewLayout(new CleanWaterfallLayout());
registerPreviewLayout(new StructuredTextLayout()); 