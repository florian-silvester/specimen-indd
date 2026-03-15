import { DesignSystemHandler, FigmaTextStyle, StyleWithMatching, InternalSystemKey, getDisplayNameForKey } from './base';
import { STYLE_KEYS } from '../core/constants';

export class BootstrapHandler implements DesignSystemHandler {
  name = 'Bootstrap';

  detectSystem(styles: FigmaTextStyle[]): boolean {
    const styleNames = styles.map(s => s.name.toLowerCase());
    
    // Bootstrap-specific patterns
    const bootstrapPatterns = [
      /^display[-\s]*[1-6]$/i,          // "display-1", "display-2", etc.
      /^h[1-6]$/i,                      // "h1", "h2", etc.
      /^(lead|small|mark)$/i,           // Bootstrap utility classes
      /^text[-\s]*(muted|primary|secondary)$/i, // Bootstrap text utilities
    ];
    
    let matches = 0;
    for (const pattern of bootstrapPatterns) {
      matches += styleNames.filter(name => pattern.test(name)).length;
    }
    
    // Need at least 30% match and some key styles
    const coverage = matches / styles.length;
    const hasKeyStyles = styleNames.some(name => /^display[-\s]*[1-2]$/i.test(name)) &&
                        styleNames.some(name => /^h[1-3]$/i.test(name));
    
    console.log('[Bootstrap] Detection - matches:', matches, 'coverage:', coverage, 'hasKeyStyles:', hasKeyStyles, 'styleNames:', styleNames);
    
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
        originalName: styleName,
        isOpen: false,
        mappedSystemStyle,
        group: this.getGroup(styleName)
      });
    }
    
    console.log('[Bootstrap] Grouped styles:', result.map(r => `${r.name} -> ${r.mappedSystemStyle}`));
    return result;
  }

  getSystemStyleOptions(): string[] {
    return [
      'Display 1', 'Display 2', 'Display 3', 'Display 4',
      'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
      'Lead', 'Body', 'Small', 'Tiny',
      'None'
    ];
  }

  createBlueprint(styles: FigmaTextStyle[] | TextStyle[]): Map<string, string> {
    const blueprint = new Map<string, string>();
    
    for (const style of styles) {
      const styleName = style.name.trim();
      const systemStyleName = this.mapToSystemStyle(styleName, new Set());
      
      if (systemStyleName !== "None") {
        blueprint.set(systemStyleName, styleName);
        console.log('[Bootstrap] Blueprint mapping:', systemStyleName, '->', styleName);
      }
    }
    
    return blueprint;
  }

  private mapToSystemStyle(styleName: string, usedSuggestions: Set<string>): string {
    const name = styleName.toLowerCase().trim();
    
    // Direct mappings for Bootstrap
    const directMappings: Record<string, string> = {
      'display-1': 'Display 1',
      'display-2': 'Display 2', 
      'display-3': 'Display 3',
      'display-4': 'Display 4',
      'h1': 'H1',
      'h2': 'H2',
      'h3': 'H3',
      'h4': 'H4',
      'h5': 'H5',
      'h6': 'H6',
      'lead': 'Lead',
      'small': 'Small'
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
    const name = styleName.toLowerCase().trim();
    
    if (name.includes('display') && !usedSuggestions.has('Display 1')) return 'Display 1';
    if (/h1|heading.*1/.test(name) && !usedSuggestions.has('H1')) return 'H1';
    if (/h2|heading.*2/.test(name) && !usedSuggestions.has('H2')) return 'H2';
    if (/h3|heading.*3/.test(name) && !usedSuggestions.has('H3')) return 'H3';
    if (/h4|heading.*4/.test(name) && !usedSuggestions.has('H4')) return 'H4';
    if (/h5|heading.*5/.test(name) && !usedSuggestions.has('H5')) return 'H5';
    if (/h6|heading.*6/.test(name) && !usedSuggestions.has('H6')) return 'H6';
    
    if (/large|lead/.test(name) && !usedSuggestions.has('Lead')) return 'Lead';
    if (/main|body|regular/.test(name) && !usedSuggestions.has('Body')) return 'Body';
    if (/small|caption/.test(name) && !usedSuggestions.has('Small')) return 'Small';
    if (/micro|tiny/.test(name) && !usedSuggestions.has('Tiny')) return 'Tiny';
    
    return "None";
  }

  async updateStylesFromBlueprint(
    blueprint: Map<string, string>,
    newTypographySystem: any,
    newFontFamily: string,
    newFontStyle: string,
    availableFontStyles: string[]
  ): Promise<void> {
    console.log('[Bootstrap] Updating styles from blueprint');
    
    const localStyles = figma.getLocalTextStyles();
    const localStyleMap = new Map(localStyles.map(style => [style.name, style]));
    
    for (const [uiDisplayName, figmaStyleName] of Array.from(blueprint.entries())) {
      const figmaStyle = localStyleMap.get(figmaStyleName);
      if (!figmaStyle) {
        console.warn(`[Bootstrap] Style not found: ${figmaStyleName}`);
        continue;
      }
      
      // Map UI display name back to internal key for typography system lookup
      const internalKey = this.uiNameToInternalKey(uiDisplayName);
      const typographyConfig = newTypographySystem[internalKey];
      
      if (!typographyConfig) {
        console.warn(`[Bootstrap] No typography config for ${internalKey}`);
        continue;
      }
      
      try {
        await figma.loadFontAsync({ family: newFontFamily, style: newFontStyle });
        
        figmaStyle.fontName = { family: newFontFamily, style: newFontStyle };
        figmaStyle.fontSize = typographyConfig.size;
        figmaStyle.lineHeight = typographyConfig.lineHeight > 5 
          ? { value: typographyConfig.lineHeight, unit: 'PIXELS' }
          : { value: typographyConfig.lineHeight * 100, unit: 'PERCENT' };
        figmaStyle.letterSpacing = { value: typographyConfig.letterSpacing, unit: 'PIXELS' };
        
        console.log(`[Bootstrap] Updated style: ${figmaStyleName} -> ${newFontFamily} ${newFontStyle} ${typographyConfig.size}px`);
      } catch (error) {
        console.error(`[Bootstrap] Failed to update style ${figmaStyleName}:`, error);
      }
    }
  }

  async smartImport(availableFontStyles: string[]): Promise<{ success: boolean; message?: string }> {
    console.log('[Bootstrap] Smart import not needed - Bootstrap uses standard naming');
    return { success: true, message: 'Bootstrap uses standard naming - use standard import flow' };
  }

  private uiNameToInternalKey(uiName: string): string {
    // Map Bootstrap UI names to internal keys
    const mapping: Record<string, string> = {
      'Display 1': STYLE_KEYS.DISPLAY,
      'Display 2': STYLE_KEYS.H1,
      'Display 3': STYLE_KEYS.H2,
      'Display 4': STYLE_KEYS.H3,
      'H1': STYLE_KEYS.H1,
      'H2': STYLE_KEYS.H2,
      'H3': STYLE_KEYS.H3,
      'H4': STYLE_KEYS.H4,
      'H5': STYLE_KEYS.H5,
      'H6': STYLE_KEYS.H6,
      'Lead': STYLE_KEYS.TEXT_LARGE,
      'Body': STYLE_KEYS.TEXT_MAIN,
      'Small': STYLE_KEYS.TEXT_SMALL,
      'Tiny': STYLE_KEYS.MICRO
    };
    return mapping[uiName] || uiName.toLowerCase();
  }

  private getGroup(styleName: string): string {
    return 'Bootstrap';
  }
} 