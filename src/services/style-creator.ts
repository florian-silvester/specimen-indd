// src/style-creator.ts
// Logic for creating Figma Text Styles from the generated TypographySystem.

import { TypographyStyle, TypographySystem, FontInfo } from '../core/types';
import { INTER_REGULAR } from '../core/constants';
import { getDisplayNameWithConvention } from './utils';

type RoundingSettings = { roundingGridSize?: number; lineHeightUnit?: 'percent' | 'px' };

function getPresetProfileLabel(
    selectedPresetProfile: 'desktop' | 'mobile' | 'social' | 'presentation' | 'product' | 'focus' | undefined,
    activeMode: 'desktop' | 'mobile'
): string {
    switch (selectedPresetProfile || activeMode) {
        case 'desktop': return 'Desktop';
        case 'mobile': return 'Mobile';
        case 'social': return 'Social';
        case 'presentation': return 'Deck';
        case 'product': return 'Product';
        case 'focus': return 'Focus';
        default: return activeMode === 'mobile' ? 'Mobile' : 'Desktop';
    }
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveSetFolderName(
    family: string,
    basePresetLabel: string,
    localStyleNames: string[]
): string {
    const prefix = `Specimen / ${family} / `;
    const existingSetNames = new Set<string>();

    for (const styleName of localStyleNames) {
        if (!styleName.startsWith(prefix)) continue;
        const remaining = styleName.slice(prefix.length);
        const parts = remaining.split('/').map((part) => part.trim()).filter(Boolean);
        if (parts.length < 2) continue;
        existingSetNames.add(parts[0]);
    }

    if (!existingSetNames.has(basePresetLabel)) {
        return basePresetLabel;
    }

    const suffixPattern = new RegExp(`^${escapeRegExp(basePresetLabel)}\\s+(\\d+)$`);
    let maxSuffix = 1;
    for (const setName of Array.from(existingSetNames.values())) {
        const match = setName.match(suffixPattern);
        if (!match) continue;
        const parsed = Number(match[1]);
        if (!Number.isFinite(parsed) || parsed < 2) continue;
        maxSuffix = Math.max(maxSuffix, parsed);
    }
    return `${basePresetLabel} ${maxSuffix + 1}`;
}

function computeRoundedStyle(style: TypographyStyle, settings: RoundingSettings): { size: number; lineHeightPercent: number; letterSpacingPercent: number } {
    const grid = settings.roundingGridSize ?? 0;
    const sizePx = Math.round(style.size);

    // Line height rounding based on unit
    let lhPercent: number;
    if ((settings.lineHeightUnit || 'percent') === 'px') {
        const lhPxRaw = (style.lineHeight ?? 1.2) * sizePx;
        const lhPx = grid > 0 ? Math.round(lhPxRaw / grid) * grid : Math.round(lhPxRaw);
        lhPercent = Math.round((lhPx / sizePx) * 100);
    } else {
        const rawPercent = (style.lineHeight ?? 1.2) * 100;
        lhPercent = Math.round(rawPercent);
    }

    // Letter spacing in 0.25 steps
    const ls = style.letterSpacing ?? 0;
    const lsRounded = Math.round(ls / 0.25) * 0.25;

    return { size: sizePx, lineHeightPercent: lhPercent, letterSpacingPercent: lsRounded };
}

export async function createFigmaTextStyles(
    typeSystem: TypographySystem,
    globalSelectedStyle: string,
    activeMode: 'desktop' | 'mobile',
    availableFontsList: FontInfo[], // Added parameter
    selectedPresetProfile?: 'desktop' | 'mobile' | 'social' | 'presentation' | 'product' | 'focus',
    namingConvention?: string, // NEW: Add naming convention parameter
    roundingSettings?: RoundingSettings
): Promise<{ [systemKey: string]: string }> {
    console.log(`[style-creator] CREATE_STYLES received for mode: ${activeMode}`);
    console.log('[style-creator] TypeSystem: ', JSON.stringify(typeSystem, null, 2));
    console.log('[style-creator] Selected Style: ', globalSelectedStyle);

    try {
        const uniqueStylesMap = new Map<string, [string, TypographyStyle]>();
        Object.entries(typeSystem).forEach(([name, style]) => {
             if (name.toLowerCase() === 'displayx8') { return; } // Exclude decorative
             if (!uniqueStylesMap.has(name)) {
                 uniqueStylesMap.set(name, [name, style]);
             }
         });

        const fontFamilyCounts = new Map<string, number>();
        for (const [, style] of Array.from(uniqueStylesMap.values())) {
            const family = style.fontFamily?.trim();
            if (!family) continue;
            fontFamilyCounts.set(family, (fontFamilyCounts.get(family) ?? 0) + 1);
        }

        const sortedFontFamilies = Array.from(fontFamilyCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([family]) => family);

        let defaultFontFamily = sortedFontFamilies[0] || typeSystem.textMain?.fontFamily || 'Inter';
        let defaultFontStyle = globalSelectedStyle || 'Regular';
        const defaultFont: FontName = { family: defaultFontFamily, style: defaultFontStyle };

        // Preload default and Inter fonts
        try { await figma.loadFontAsync(defaultFont); } catch (e) { console.warn(`[style-creator] Failed preload default ${defaultFont.family} ${defaultFont.style}`); }
        try { await figma.loadFontAsync(INTER_REGULAR); } catch {}

        console.log('[style-creator] Detected font families:', sortedFontFamilies);
        const basePresetLabel = getPresetProfileLabel(selectedPresetProfile, activeMode);
        const localStyleNames = figma.getLocalTextStyles().map((style) => style.name);
        const familySetFolderMap = new Map<string, string>();
        const familiesInRequest = new Set<string>(
            Array.from(uniqueStylesMap.values()).map(([, style]) => (style.fontFamily || defaultFontFamily).trim())
        );
        for (const family of Array.from(familiesInRequest.values())) {
            familySetFolderMap.set(
                family,
                resolveSetFolderName(family, basePresetLabel, localStyleNames)
            );
        }

        const createdStyles = [];
        const resolvedStyleIds: { [systemKey: string]: string } = {};
        for (const [originalName, style] of Array.from(uniqueStylesMap.values())) {
            const specificFamily = style.fontFamily || defaultFontFamily;
            const specificStyleName = style.fontStyle || defaultFontStyle;
            const specificFontTarget: FontName = { family: specificFamily, style: specificStyleName };
            let fontToApply: FontName = INTER_REGULAR;

            // Try loading the specific font, fallback to default, then Inter Regular
            try {
                await figma.loadFontAsync(specificFontTarget);
                fontToApply = specificFontTarget;
            } catch (e) {
                console.warn(`[style-creator] Failed loading specific ${specificFontTarget.family} ${specificFontTarget.style}. Trying default.`);
                try {
                    await figma.loadFontAsync(defaultFont);
                    fontToApply = defaultFont;
                } catch (e2) {
                    console.warn(`[style-creator] Failed loading default ${defaultFont.family} ${defaultFont.style}. Using Inter Regular.`);
                    // Ensure Inter Regular is loaded if default fails
                    try { await figma.loadFontAsync(INTER_REGULAR); } catch {}
                    fontToApply = INTER_REGULAR;
                }
            }

            // Create grouped style name with font family + naming convention
            const namePart = style.customName?.trim() || getDisplayNameWithConvention(originalName, namingConvention || 'Default Naming');
            const setFolder = familySetFolderMap.get(specificFamily) || basePresetLabel;
            const finalStyleName = `Specimen / ${specificFamily} / ${setFolder} / ${namePart}`;
            console.log(`[style-creator] Determined finalStyleName for ${originalName}: "${finalStyleName}"`);

            const textStyle = figma.createTextStyle();
            textStyle.name = finalStyleName;
            console.log(`[style-creator] Set textStyle.name to: "${textStyle.name}"`);

            // Apply style properties (similar to applyTextStyleToNode but on TextStyle object)
            const rounded = computeRoundedStyle(style, roundingSettings || {});
            textStyle.fontSize = rounded.size;
            textStyle.lineHeight = { unit: 'PERCENT', value: rounded.lineHeightPercent };
            textStyle.letterSpacing = { unit: 'PERCENT', value: rounded.letterSpacingPercent };
            textStyle.fontName = fontToApply;
            textStyle.leadingTrim = 'CAP_HEIGHT';

            let targetTextCase: TextCase = 'ORIGINAL';
            switch (style.textCase?.toLowerCase()) {
                case 'uppercase': targetTextCase = 'UPPER'; break;
                case 'lowercase': targetTextCase = 'LOWER'; break;
                case 'title case': targetTextCase = 'TITLE'; break;
            }
            if (targetTextCase !== 'ORIGINAL') {
                 try { textStyle.textCase = targetTextCase; } catch (e) { console.warn(`[style-creator] Error setting textCase ${targetTextCase} for ${originalName}: ${e}`); }
            }

            console.log(`[style-creator] Style "${finalStyleName}" prepared.`);
            createdStyles.push({ name: finalStyleName }); // Only need name for notification now
            resolvedStyleIds[originalName] = textStyle.id;
        }

        let notificationMessage = `${createdStyles.length} text styles created.`;
        if (sortedFontFamilies.length === 1) {
            const singleFamily = sortedFontFamilies[0];
            const folder = familySetFolderMap.get(singleFamily) || basePresetLabel;
            notificationMessage = `${createdStyles.length} text styles created in Specimen / ${singleFamily} / ${folder}.`;
        } else if (sortedFontFamilies.length > 1) {
            notificationMessage = `${createdStyles.length} text styles created across ${sortedFontFamilies.length} font families (${sortedFontFamilies.join(', ')}).`;
        }
        console.log('[style-creator] Notification:', notificationMessage);
        figma.notify(notificationMessage);
        return resolvedStyleIds;

    } catch (error) {
      console.error('[style-creator] Error creating text styles:', error);
      figma.notify("Error creating text styles", { error: true });
      return {};
    }
} 