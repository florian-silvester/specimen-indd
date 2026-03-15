// src/preview-updater.ts
// Handles updating existing preview frames based on new settings

import { FontInfo, TypographySystem, PreviewLayoutType, PreviewLayoutHandlerParams, PreviewTextAlignMode } from '../core/types';
import {
    LAYOUT_BASE_NAMES,
    INTER_REGULAR,
    // MIDDLE_COLUMN_STYLE_NAMES, // Removed unused import
    // HORIZONTAL_TEXT_STYLE_NAMES, // Removed unused import
    NUMBERS_SET,
    UPPERCASE_SET,
    LOWERCASE_SET,
    SPECIAL_SET,
    // Constants needed for the weight preview update logic within this file
    ITEM_INTERNAL_SPACING,
    SPEC_FONT_SIZE,
    SPEC_COLOR
} from '../core/constants';
import { getDisplayName, getExampleText, getValidFont, applyTextStyleToNode, updateSpecsInRow, sortFontStylesNumerically } from '../services/utils';
import { getPreviewLayoutHandler } from './preview-layout-registry';
import { getCurrentPreviewTheme } from '../core/preview-theme-state';

const DEBUG_PREVIEW_UPDATER = false;
const logDebug = (...args: unknown[]) => {
  if (DEBUG_PREVIEW_UPDATER) {
    console.log(...args);
  }
};

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

export async function updateGivenFrame(
    frame: FrameNode,
    typeSystem: TypographySystem,
    selectedStyle: string,
    showSpecLabels: boolean,
    styleVisibility: { [key: string]: boolean },
    availableStyles: string[], // Styles available for the current font family (used in weight preview)
    currentColorMode: 'light' | 'dark', // Added parameter
    availableFontsList: FontInfo[], // Added parameter
    activeMode: 'desktop' | 'mobile',
    activeScaleRatio: number, // ADDED activeScaleRatio
    namingConvention?: string, // ADDED naming convention
    showGrid?: boolean, // ADDED: Show grid overlay on individual items
    roundingGridSize?: number, // ADDED: Grid size for overlays
    lineHeightUnit?: 'percent' | 'px', // ADDED: Line height unit
    selectedPresetProfile?: 'desktop' | 'mobile' | 'social' | 'presentation' | 'product' | 'focus',
    previewTextAlign?: PreviewTextAlignMode,
    baseFontFamilyOverride?: string,
    baseFontStyleOverride?: string,
    secondaryFontFamilyOverride?: string,
    secondaryFontStyleOverride?: string
) {
  logDebug(`>>> BACKEND [updater]: updateGivenFrame called. Target: ${frame.name}, Labels: ${showSpecLabels}, Mode: ${activeMode}, ScaleRatio: ${activeScaleRatio}`);
  try {
    // If text styles were attached to preview/specimen nodes (e.g. after update-style apply),
    // detach them before live preview updates so slider tweaks keep updating these nodes.
    const textNodes = frame.findAll((n) => n.type === 'TEXT') as TextNode[];
    for (const node of textNodes) {
      if (node.textStyleId && node.textStyleId !== figma.mixed) {
        try {
          node.textStyleId = '';
        } catch (e) {
          // Best-effort only; continue updating other nodes.
        }
      }
    }

    const baseFontFamily = baseFontFamilyOverride || typeSystem.textMain?.fontFamily || 'Inter';
    const baseFontStyle = baseFontStyleOverride || selectedStyle || 'Regular';
    // const globalStyle = selectedStyle || 'Regular'; // selectedStyle is already the base/global style

    // --- Update Frame Name ---
    const nameParts = frame.name.split(' — ');
    if (nameParts.length > 0) {
        const baseName = nameParts[0];
        if (baseName.startsWith('Specimen')) {
          const { date, time } = getSpecimenTimestamp();
          const profileLabel = getPresetProfileLabel(selectedPresetProfile);
          frame.name = `Specimen ${profileLabel} — ${date} — ${time}`;
        } else {
          frame.name = `${baseName} — ${baseFontFamily}`;
        }
    }

    // Preload fonts (minimal common fonts)
    try { await figma.loadFontAsync({ family: baseFontFamily, style: baseFontStyle }); } catch (e) { console.warn(`[updater] Preload failed for ${baseFontFamily} ${baseFontStyle}`); }
    if (secondaryFontFamilyOverride) {
      try {
        await figma.loadFontAsync({ family: secondaryFontFamilyOverride, style: secondaryFontStyleOverride || baseFontStyle });
      } catch (e) {
        console.warn(`[updater] Preload failed for ${secondaryFontFamilyOverride} ${secondaryFontStyleOverride || baseFontStyle}`);
      }
    }
    try { await figma.loadFontAsync(INTER_REGULAR); } catch (e) { console.warn(`[updater] Preload failed for Inter Regular`);}

    // Determine layout type from frame name
    let determinedLayoutType: PreviewLayoutType | 'unknown' = 'unknown';
    for (const key in LAYOUT_BASE_NAMES) {
        const type = key as PreviewLayoutType;
        const handlerForType = getPreviewLayoutHandler(type);
        if (handlerForType && frame.name.startsWith(handlerForType.getBaseName())) {
            determinedLayoutType = type;
            break;
        }
    }
    logDebug(`[updater] Determined layout type: ${determinedLayoutType}`);

    const theme = getCurrentPreviewTheme();
    frame.fills = [{ type: 'SOLID', color: theme.background }];

    const handler = getPreviewLayoutHandler(determinedLayoutType as PreviewLayoutType);

    if (handler) {
        logDebug(`[updater] Using handler for layout type: ${determinedLayoutType}`);
        logDebug(`[updater] 🔧 Passing namingConvention: "${namingConvention}" to layout handler`);
        const handlerParams: PreviewLayoutHandlerParams = {
            typeSystem,
            selectedStyle,
            showSpecLabels,
            styleVisibility,
            currentColorMode,
            availableFontsList,
            baseFontFamily,
            baseFontStyle,
            activeMode,
            activeScaleRatio,
            namingConvention,
            showGrid,
            roundingGridSize,
            lineHeightUnit,
            selectedPresetProfile,
            previewTextAlign,
            secondaryFontFamily: secondaryFontFamilyOverride,
            secondaryFontStyle: secondaryFontStyleOverride
        };
        await handler.update(frame, handlerParams);
        logDebug(`[PreviewUpdater] Update call to handler ${handler.getLayoutType()} completed.`);
    } else if (determinedLayoutType !== 'unknown') {
        console.warn(`[updater] Update logic not implemented or no handler registered for layout type: ${determinedLayoutType}`);
    } else {
         console.warn(`[updater] Could not determine layout type for frame: ${frame.name}. Update skipped.`);
    }

  } catch (error) {
    console.error('[updater] Error in updateGivenFrame:', error);
  }
  logDebug('>>> BACKEND [updater]: updateGivenFrame finished.');
} 