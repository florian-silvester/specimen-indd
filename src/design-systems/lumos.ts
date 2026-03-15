import { DesignSystemHandler, FigmaTextStyle, StyleWithMatching, InternalSystemKey, getDisplayNameForKey } from './base';
import { STYLE_KEYS } from '../core/constants';

export class LumosHandler implements DesignSystemHandler {
  name = 'Lumos';

  detectSystem(styles: FigmaTextStyle[]): boolean {
    const styleNames = styles.map(s => s.name.toLowerCase());
    
    // Lumos-specific patterns (flat structure, no folders) - EXPANDED to match common variations
    const lumosPatterns = [
      /^(display|h0)$/i,              // "display" OR "h0" (both map to display)
      /^h[1-6]$/i,                    // Exact: "h1", "h2", etc.
      /^text\s+(large|main|small)$/i, // "Text Large", "Text Main", "Text Small" 
      /^(micro|text\s+tiny)$/i        // "micro" OR "Text Tiny" (both map to micro)
    ];
    
    let matches = 0;
    for (const pattern of lumosPatterns) {
      matches += styleNames.filter(name => pattern.test(name)).length;
    }
    
    // Need at least 30% match and some key styles
    const coverage = matches / styles.length;
    const hasKeyStyles = (styleNames.some(name => /^h[1-3]$/i.test(name)) || styleNames.some(name => /^(display|h0)$/i.test(name))) && 
                        styleNames.some(name => /^text\s+main$/i.test(name));
    
    console.log('[Lumos] Detection - matches:', matches, 'coverage:', coverage, 'hasKeyStyles:', hasKeyStyles, 'styleNames:', styleNames);
    
    return coverage > 0.3 && hasKeyStyles;
  }

  groupStyles(styles: FigmaTextStyle[]): StyleWithMatching[] {
    const result: StyleWithMatching[] = [];
    const usedSuggestions = new Set<string>();
    
    // Sort by size (largest first) for better suggestions
    const sortedStyles = [...styles].sort((a, b) => b.fontSize - a.fontSize);
    
    for (const style of sortedStyles) {
      const styleName = style.name.trim();
      const mappedSystemStyle = this.mapToSystemStyle(styleName, usedSuggestions);
      
      if (mappedSystemStyle !== "None") {
        usedSuggestions.add(mappedSystemStyle);
      }
      
      result.push({
        ...style,
        name: styleName,
        originalName: styleName, // Lumos uses flat names, so original = display name
        isOpen: false,
        mappedSystemStyle,
        group: this.getGroup(styleName)
      });
    }
    
    console.log('[Lumos] Grouped styles:', result.map(r => `${r.name} -> ${r.mappedSystemStyle}`));
    return result;
  }

  getSystemStyleOptions(): string[] {
    return [
      'Display', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
      'Text Large', 'Text Main', 'Text Small', 'Micro', 'None'
    ];
  }

  createBlueprint(styles: FigmaTextStyle[] | TextStyle[]): Map<string, string> {
    const blueprint = new Map<string, string>();
    
    for (const style of styles) {
      const styleName = style.name.trim();
      const systemStyleName = this.mapToSystemStyle(styleName, new Set());
      
      if (systemStyleName !== "None") {
        blueprint.set(systemStyleName, styleName); // Store UI name -> Figma name
        console.log('[Lumos] Blueprint mapping:', systemStyleName, '->', styleName);
      }
    }
    
    return blueprint;
  }

  private mapToSystemStyle(styleName: string, usedSuggestions: Set<string>): string {
    const name = styleName.toLowerCase().trim();
    
    // Direct mappings for Lumos flat structure
    const directMappings: Record<string, string> = {
      [STYLE_KEYS.DISPLAY]: 'Display',
      [STYLE_KEYS.H1]: 'H1',
      [STYLE_KEYS.H2]: 'H2', 
      [STYLE_KEYS.H3]: 'H3',
      [STYLE_KEYS.H4]: 'H4',
      [STYLE_KEYS.H5]: 'H5',
      [STYLE_KEYS.H6]: 'H6',
      'text large': 'Text Large',
      'text main': 'Text Main',
      'text small': 'Text Small',
      [STYLE_KEYS.MICRO]: 'Micro'
    };

    // Check direct mappings first
    for (const [pattern, systemStyle] of Object.entries(directMappings)) {
      if (name === pattern && !usedSuggestions.has(systemStyle)) {
        return systemStyle;
      }
    }
    
    // Fallback to size-based mapping if direct match not found
    return this.mapBySize(styleName, usedSuggestions);
  }

  private mapBySize(styleName: string, usedSuggestions: Set<string>): string {
    // Extract font size from the style (this would need to be passed in)
    // For now, use pattern-based fallback
    const name = styleName.toLowerCase().trim();
    
    if (name.includes('display') && !usedSuggestions.has('Display')) return 'Display';
    if (/h1|heading.?1/.test(name) && !usedSuggestions.has('H1')) return 'H1';
    if (/h2|heading.?2/.test(name) && !usedSuggestions.has('H2')) return 'H2';
    if (/h3|heading.?3/.test(name) && !usedSuggestions.has('H3')) return 'H3';
    if (/h4|heading.?4/.test(name) && !usedSuggestions.has('H4')) return 'H4';
    if (/h5|heading.?5/.test(name) && !usedSuggestions.has('H5')) return 'H5';
    if (/h6|heading.?6/.test(name) && !usedSuggestions.has('H6')) return 'H6';
    
    if (/large|big/.test(name) && !usedSuggestions.has('Text Large')) return 'Text Large';
    if (/main|body|regular|normal/.test(name) && !usedSuggestions.has('Text Main')) return 'Text Main';
    if (/small|caption/.test(name) && !usedSuggestions.has('Text Small')) return 'Text Small';
    if (/micro|tiny/.test(name) && !usedSuggestions.has('Micro')) return 'Micro';
    
    return "None";
  }

  async updateStylesFromBlueprint(
    blueprint: Map<string, string>,
    newTypographySystem: any,
    newFontFamily: string,
    newFontStyle: string,
    availableFontStyles: string[]
  ): Promise<void> {
    console.log('[Lumos] Updating styles from blueprint');
    
    const localStyles = figma.getLocalTextStyles();
    const localStyleMap = new Map(localStyles.map(style => [style.name, style]));
    
    for (const [uiDisplayName, figmaStyleName] of Array.from(blueprint.entries())) {
      const figmaStyle = localStyleMap.get(figmaStyleName);
      if (!figmaStyle) {
        console.warn(`[Lumos] Style not found: ${figmaStyleName}`);
        continue;
      }
      
      // Map UI display name back to internal key for typography system lookup
      const internalKey = this.uiNameToInternalKey(uiDisplayName);
      const typographyConfig = newTypographySystem[internalKey];
      
      if (!typographyConfig) {
        console.warn(`[Lumos] No typography config for ${internalKey}`);
        continue;
      }
      
      try {
        // Update the Figma text style
        await figma.loadFontAsync({ family: newFontFamily, style: newFontStyle });
        
        figmaStyle.fontName = { family: newFontFamily, style: newFontStyle };
        figmaStyle.fontSize = typographyConfig.size;
        figmaStyle.lineHeight = typographyConfig.lineHeight > 5 
          ? { value: typographyConfig.lineHeight, unit: 'PIXELS' }
          : { value: typographyConfig.lineHeight * 100, unit: 'PERCENT' };
        figmaStyle.letterSpacing = { value: typographyConfig.letterSpacing, unit: 'PIXELS' };
        
        console.log(`[Lumos] Updated style: ${figmaStyleName} -> ${newFontFamily} ${newFontStyle} ${typographyConfig.size}px`);
      } catch (error) {
        console.error(`[Lumos] Failed to update style ${figmaStyleName}:`, error);
      }
    }
  }

  async smartImport(availableFontStyles: string[]): Promise<{ success: boolean; message?: string }> {
    console.log('[Lumos] Smart import not needed - Lumos uses simple flat structure');
    return { success: true, message: 'Lumos uses flat structure - use standard import flow' };
  }

  private uiNameToInternalKey(uiName: string): string {
    const mapping: Record<string, string> = {
      'Display': STYLE_KEYS.DISPLAY,
      'H1': STYLE_KEYS.H1,
      'H2': STYLE_KEYS.H2,
      'H3': STYLE_KEYS.H3, 
      'H4': STYLE_KEYS.H4,
      'H5': STYLE_KEYS.H5,
      'H6': STYLE_KEYS.H6,
      'Text Large': STYLE_KEYS.TEXT_LARGE,
      'Text Main': STYLE_KEYS.TEXT_MAIN,
      'Text Small': STYLE_KEYS.TEXT_SMALL,
      'Micro': STYLE_KEYS.MICRO
    };
    return mapping[uiName] || uiName.toLowerCase();
  }

  private getGroup(styleName: string): string {
    // Lumos is COMPLETELY FLAT - no folder structure at all
    return 'Styles';
  }
} 