import { DesignSystemHandler, FigmaTextStyle, StyleWithMatching } from './base';
import { STYLE_KEYS } from '../core/constants';

export class RelumeHandler implements DesignSystemHandler {
  name = 'Relume';

  detectSystem(styles: FigmaTextStyle[]): boolean {
    const styleNames = styles.map(s => s.name.toLowerCase());
    
    // Relume-specific patterns (folder structure)
    const relumePatterns = [
      /^heading\/h[1-6]$/i,           // "Heading/H1", "Heading/H2", etc.
      /^heading\/tagline$/i,          // "Heading/Tagline"
      /^text\/(large|medium|regular|small|tiny)\//i,  // "Text/Large/Light", "Text/Medium/Normal", etc.
      /\/(light|normal|medium|semi bold|bold|extra bold|link)$/i,  // Weight variations
      /^display$/i                    // "Display" (if they have it)
    ];
    
    let matches = 0;
    for (const pattern of relumePatterns) {
      matches += styleNames.filter(name => pattern.test(name)).length;
    }
    
    // Need good coverage OR clear winner
    const coverage = matches / styles.length;
    const hasRelumeStructure = styleNames.some(name => /^heading\/h[1-6]$/i.test(name)) ||
                              styleNames.some(name => /^text\/(large|regular|small)\//i.test(name));
    
    console.log('[Relume] Detection - matches:', matches, 'coverage:', coverage, 'hasRelumeStructure:', hasRelumeStructure);
    
    return (coverage > 0.2) && hasRelumeStructure;
  }

  groupStyles(styles: FigmaTextStyle[]): StyleWithMatching[] {
    const result: StyleWithMatching[] = [];
    const processedSizes = new Set<string>();
    
    console.log('[Relume] Grouping - input styles:', styles.map(s => s.name));
    
    // Process headings - handle both "Heading/H1" AND standalone "H1" patterns
    styles.forEach(style => {
      const styleName = style.name;
      
      // Pattern 1: Heading/H1, Heading/H2, etc. (existing Relume styles)
      if (/^Heading\/H[1-6]$/i.test(styleName) || /^Heading\/Tagline$/i.test(styleName)) {
        let mappedSystemStyle = "None";
        if (/^Heading\/H1$/i.test(styleName)) mappedSystemStyle = "H1";
        else if (/^Heading\/H2$/i.test(styleName)) mappedSystemStyle = "H2";
        else if (/^Heading\/H3$/i.test(styleName)) mappedSystemStyle = "H3";
        else if (/^Heading\/H4$/i.test(styleName)) mappedSystemStyle = "H4";
        else if (/^Heading\/H5$/i.test(styleName)) mappedSystemStyle = "H5";
        else if (/^Heading\/H6$/i.test(styleName)) mappedSystemStyle = "H6";
        else if (/^Heading\/Tagline$/i.test(styleName)) mappedSystemStyle = "None";

        console.log(`[Relume] Processed heading (with folder): ${styleName} -> ${mappedSystemStyle}`);
        
        result.push({
          ...style,
          name: styleName.replace('Heading/', ''), // Show just "H1", "H2", etc.
          originalName: styleName, // Preserve original for updates
          isOpen: false,
          mappedSystemStyle,
          group: 'Heading'
        });
      }
      // Pattern 2: Standalone H1, H2, etc. (should map to existing Heading folder styles)
      else if (/^H[1-6]$/i.test(styleName) || /^Tagline$/i.test(styleName)) {
        let mappedSystemStyle = "None";
        if (/^H1$/i.test(styleName)) mappedSystemStyle = "H1";
        else if (/^H2$/i.test(styleName)) mappedSystemStyle = "H2";
        else if (/^H3$/i.test(styleName)) mappedSystemStyle = "H3";
        else if (/^H4$/i.test(styleName)) mappedSystemStyle = "H4";
        else if (/^H5$/i.test(styleName)) mappedSystemStyle = "H5";
        else if (/^H6$/i.test(styleName)) mappedSystemStyle = "H6";
        else if (/^Tagline$/i.test(styleName)) mappedSystemStyle = "None";

        console.log(`[Relume] Processed heading (standalone): ${styleName} -> ${mappedSystemStyle}`);
        
        result.push({
          ...style,
          name: styleName, // Keep original name "H1", "H2", etc.
          originalName: styleName, // Preserve original
          isOpen: false,
          mappedSystemStyle,
          group: 'Heading'
        });
      }
    });
    
    // Process text sizes (Large, Medium, Regular, Small, Tiny) - merge weight variations
    const textSizes = ['Large', 'Medium', 'Regular', 'Small', 'Tiny'];
    
    textSizes.forEach(sizeGroup => {
      const matchingStyles = styles.filter(style => 
        style.name.startsWith(`Text/${sizeGroup}/`)
      );
      
      console.log(`[Relume] Looking for Text/${sizeGroup}/ styles:`, matchingStyles.map(s => s.name));
      
      if (matchingStyles.length > 0 && !processedSizes.has(sizeGroup)) {
        processedSizes.add(sizeGroup);
        
        // Use the first style as representative, but change the name to just the size
        const representative = matchingStyles[0];
        
        // Map to Relume naming convention
        let mappedSystemStyle = "None";
        if (sizeGroup === 'Large') mappedSystemStyle = "Text Large";
        else if (sizeGroup === 'Medium') mappedSystemStyle = "None"; // Relume doesn't have Medium
        else if (sizeGroup === 'Regular') mappedSystemStyle = "Text Main";
        else if (sizeGroup === 'Small') mappedSystemStyle = "Text Small";
        else if (sizeGroup === 'Tiny') mappedSystemStyle = "Text Tiny";
        
        console.log(`[Relume] Processed text group: ${sizeGroup} -> ${mappedSystemStyle}`);
        
        result.push({
          ...representative,
          name: sizeGroup, // Show just "Large", "Medium", etc.
          originalName: representative.name, // Preserve original for updates
          isOpen: false,
          mappedSystemStyle,
          group: 'Text'
        });
      }
    });
    
    console.log('[Relume] Grouping - final result:', result.map(r => `${r.name} -> ${r.mappedSystemStyle}`));
    
    return result;
  }

  getSystemStyleOptions(): string[] {
    return [
      'Heading/H1', 'Heading/H2', 'Heading/H3', 'Heading/H4', 'Heading/H5', 'Heading/H6',
      'Text/Large', 'Text/Regular', 'Text/Small', 'Text/Tiny', 'None'
    ];
  }

  createBlueprint(styles: FigmaTextStyle[] | TextStyle[]): Map<string, string> {
    const blueprint = new Map<string, string>();
    const relumeHeadingStyles = new Map<string, { name: string }>();
    const relumeTextStyles = new Map<string, { name: string }[]>();
    
    for (const style of styles) {
      // Extract style name (works for both FigmaTextStyle and TextStyle)
      const styleName = style.name;
      
      // Detect Relume heading patterns: Heading/H1, Heading/H2, etc.
      if (styleName.startsWith('Heading/H')) {
        const headingMatch = styleName.match(/Heading\/H(\d+)/);
        if (headingMatch) {
          const systemKey = `h${headingMatch[1]}`;
          relumeHeadingStyles.set(systemKey, { name: styleName });
          console.log('[Relume] Found heading:', systemKey, '->', styleName);
        }
      }
      
      // Detect Relume text patterns: Text/Large/Normal, Text/Small/Bold, etc.
      if (styleName.startsWith('Text/')) {
        const textMatch = styleName.match(/Text\/(Large|Regular|Small|Tiny)(?:\/(.+))?/);
        if (textMatch) {
          const sizeCategory = textMatch[1].toLowerCase();
          let systemKey = '';
          switch (sizeCategory) {
            case 'large': systemKey = STYLE_KEYS.TEXT_LARGE; break;
            case 'regular': systemKey = STYLE_KEYS.TEXT_MAIN; break;
            case 'small': systemKey = STYLE_KEYS.TEXT_SMALL; break;
            case 'tiny': systemKey = STYLE_KEYS.MICRO; break;
          }
          
          if (systemKey) {
            if (!relumeTextStyles.has(systemKey)) {
              relumeTextStyles.set(systemKey, []);
            }
            relumeTextStyles.get(systemKey)!.push({ name: styleName });
            console.log('[Relume] Found text style:', systemKey, '->', styleName);
          }
        }
      }
    }
    
    // Add heading styles using UI display names as keys
    for (const [systemKey, style] of Array.from(relumeHeadingStyles.entries())) {
      const uiDisplayName = systemKey.toUpperCase(); // h1 -> H1, h2 -> H2, etc.
      blueprint.set(uiDisplayName, style.name);
      console.log('[Relume] Blueprint heading:', uiDisplayName, '->', style.name);
    }
    
    // Add text styles using UI display names as keys
    for (const [systemKey, styleArray] of Array.from(relumeTextStyles.entries())) {
      if (styleArray.length > 0) {
        let uiDisplayName = systemKey;
        // Convert internal keys to UI display names
        switch (systemKey) {
          case STYLE_KEYS.TEXT_MAIN: uiDisplayName = 'Text Main'; break;
          case STYLE_KEYS.TEXT_LARGE: uiDisplayName = 'Text Large'; break;
          case STYLE_KEYS.TEXT_SMALL: uiDisplayName = 'Text Small'; break;
          case STYLE_KEYS.MICRO: uiDisplayName = 'Text Tiny'; break;
        }
        blueprint.set(uiDisplayName, styleArray[0].name);
        console.log('[Relume] Blueprint text:', uiDisplayName, '->', styleArray[0].name, `(${styleArray.length} variants)`);
      }
    }
    
    return blueprint;
  }

  async updateStylesFromBlueprint(
    blueprint: Map<string, string>,
    newTypographySystem: any,
    newFontFamily: string,
    newFontStyle: string,
    availableFontStyles: string[]
  ): Promise<void> {
    console.log('[Relume] Updating styles from blueprint with weight mapping');
    
    const localStyles = figma.getLocalTextStyles();
    const localStyleMap = new Map(localStyles.map(style => [style.name, style]));
    
    // For Relume, we need to handle weight variations
    for (const [uiDisplayName, figmaStyleName] of Array.from(blueprint.entries())) {
      const figmaStyle = localStyleMap.get(figmaStyleName);
      if (!figmaStyle) {
        console.warn(`[Relume] Style not found: ${figmaStyleName}`);
        continue;
      }
      
      // Map UI display name back to internal key
      const internalKey = this.uiNameToInternalKey(uiDisplayName);
      const typographyConfig = newTypographySystem[internalKey];
      
      if (!typographyConfig) {
        console.warn(`[Relume] No typography config for ${internalKey}`);
        continue;
      }
      
      try {
        // For Relume, use the specified font style or default
        await figma.loadFontAsync({ family: newFontFamily, style: newFontStyle });
        
        figmaStyle.fontName = { family: newFontFamily, style: newFontStyle };
        figmaStyle.fontSize = typographyConfig.size;
        figmaStyle.lineHeight = typographyConfig.lineHeight > 5 
          ? { value: typographyConfig.lineHeight, unit: 'PIXELS' }
          : { value: typographyConfig.lineHeight * 100, unit: 'PERCENT' };
        figmaStyle.letterSpacing = { value: typographyConfig.letterSpacing, unit: 'PIXELS' };
        
        console.log(`[Relume] Updated style: ${figmaStyleName} -> ${newFontFamily} ${newFontStyle} ${typographyConfig.size}px`);
      } catch (error) {
        console.error(`[Relume] Failed to update style ${figmaStyleName}:`, error);
      }
    }
    
    // Handle weight variations for Text styles
    await this.updateTextStyleWeights(localStyles, newFontFamily, availableFontStyles);
  }

  async smartImport(availableFontStyles: string[]): Promise<{ success: boolean; message?: string }> {
    console.log('[Relume] Performing smart Relume import');
    
    const localStyles = figma.getLocalTextStyles();
    const blueprint = this.createBlueprint(localStyles);
    
    if (blueprint.size === 0) {
      return { success: false, message: 'No Relume styles detected in this file' };
    }
    
    console.log(`[Relume] Found ${blueprint.size} Relume styles for smart import`);
    return { success: true, message: `Smart import ready for ${blueprint.size} Relume styles` };
  }

  private async updateTextStyleWeights(
    localStyles: TextStyle[], 
    newFontFamily: string, 
    availableFontStyles: string[]
  ): Promise<void> {
    console.log('[Relume] Updating text style weight variations');
    
    const textStyleGroups = new Map<string, TextStyle[]>();
    
    // Group text styles by size category
    for (const style of localStyles) {
      if (style.name.startsWith('Text/')) {
        const match = style.name.match(/Text\/(Large|Regular|Small|Tiny)(?:\/(.+))?/);
        if (match) {
          const sizeCategory = match[1];
          if (!textStyleGroups.has(sizeCategory)) {
            textStyleGroups.set(sizeCategory, []);
          }
          textStyleGroups.get(sizeCategory)!.push(style);
        }
      }
    }
    
    // Update each group's weight variations
    for (const [sizeCategory, styles] of Array.from(textStyleGroups.entries())) {
      for (const style of styles) {
        const weightMatch = style.name.match(/Text\/.+\/(.+)$/);
        if (weightMatch) {
          const originalWeight = weightMatch[1];
          const mappedWeight = this.mapWeightToAvailable(originalWeight, availableFontStyles);
          
          if (mappedWeight) {
            try {
              await figma.loadFontAsync({ family: newFontFamily, style: mappedWeight });
              style.fontName = { family: newFontFamily, style: mappedWeight };
              console.log(`[Relume] Updated ${style.name} weight: ${originalWeight} -> ${mappedWeight}`);
            } catch (error) {
              console.error(`[Relume] Failed to update weight for ${style.name}:`, error);
            }
          }
        }
      }
    }
  }

  private mapWeightToAvailable(originalWeight: string, availableWeights: string[]): string | null {
    // Direct match first
    if (availableWeights.includes(originalWeight)) {
      return originalWeight;
    }
    
    // Fallback mapping
    const weightMappings: Record<string, string[]> = {
      'Light': ['Light', 'Thin', 'Regular', 'Normal'],
      'Normal': ['Regular', 'Normal', 'Medium', 'Light'],
      'Regular': ['Regular', 'Normal', 'Medium', 'Light'],
      'Medium': ['Medium', 'Regular', 'Normal', 'Semi Bold'],
      'Semi Bold': ['Semi Bold', 'SemiBold', 'Medium', 'Bold'],
      'Bold': ['Bold', 'Semi Bold', 'SemiBold', 'Black'],
      'Extra Bold': ['Extra Bold', 'ExtraBold', 'Black', 'Bold'],
      'Black': ['Black', 'Extra Bold', 'ExtraBold', 'Bold']
    };
    
    const candidates = weightMappings[originalWeight] || ['Regular', 'Normal'];
    for (const candidate of candidates) {
      if (availableWeights.includes(candidate)) {
        return candidate;
      }
    }
    
    // Last resort: use first available weight
    return availableWeights.length > 0 ? availableWeights[0] : null;
  }

  private uiNameToInternalKey(uiName: string): string {
    const mapping: Record<string, string> = {
      'H0': STYLE_KEYS.DISPLAY,
      'H1': STYLE_KEYS.H1,
      'H2': STYLE_KEYS.H2,
      'H3': STYLE_KEYS.H3,
      'H4': STYLE_KEYS.H4, 
      'H5': STYLE_KEYS.H5,
      'H6': STYLE_KEYS.H6,
      'Text Large': STYLE_KEYS.TEXT_LARGE,
      'Text Main': STYLE_KEYS.TEXT_MAIN,
      'Text Small': STYLE_KEYS.TEXT_SMALL,
      'Text Tiny': STYLE_KEYS.MICRO
    };
    return mapping[uiName] || uiName.toLowerCase();
  }

  // Relume-specific method for checking weight mismatches
  checkWeightMismatches(styles: FigmaTextStyle[] | TextStyle[], newFontFamily: string, availableFontStyles: string[]) {
    const relumeWeights = new Set<string>();
    const textSizeGroups = new Set<string>();
    
    // Scan ALL local text styles for Relume patterns
    for (const style of styles) {
      const styleName = style.name; // Works for both FigmaTextStyle and TextStyle
      if (styleName.startsWith('Text/')) {
        const parts = styleName.split('/');
        if (parts.length >= 3) {
          const baseName = `${parts[0]}/${parts[1]}`; // e.g., "Text/Large"
          const weight = parts[2]; // e.g., "Normal", "Bold", "Light", etc.
          textSizeGroups.add(baseName);
          relumeWeights.add(weight);
          console.log(`[Relume] Found text style: ${baseName} with weight: ${weight}`);
        }
      }
    }

    console.log('[Relume] Weights found:', Array.from(relumeWeights));
    console.log('[Relume] Text size groups found:', Array.from(textSizeGroups));
    console.log('[Relume] Available new font weights:', availableFontStyles);

    // Check if any Relume weights are missing in the new font
    const missingWeights = Array.from(relumeWeights).filter(w => !availableFontStyles.includes(w));
    
    return {
      hasMismatches: missingWeights.length > 0,
      missingWeights: Array.from(relumeWeights), // Send all weights for mapping
      availableWeights: availableFontStyles,
      textSizeGroups: Array.from(textSizeGroups),
      newFontFamily: newFontFamily
    };
  }
} 