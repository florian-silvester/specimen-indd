import { DesignSystemHandler, FigmaTextStyle } from './base';
import { LumosHandler } from './lumos';
import { RelumeHandler } from './relume';
import { BootstrapHandler } from './bootstrap';
import { STYLE_KEYS } from '../core/constants';

// Registry of all design system handlers
const handlers: DesignSystemHandler[] = [
  new LumosHandler(),
  new RelumeHandler(),
  new BootstrapHandler()
];

// Export individual handlers
export { LumosHandler } from './lumos';
export { RelumeHandler } from './relume';
export { BootstrapHandler } from './bootstrap';
export * from './base';

/**
 * Auto-detect which design system is being used based on text style patterns
 */
export function detectDesignSystem(styles: FigmaTextStyle[]): string {
  console.log('[DesignSystems] Auto-detecting system from', styles.length, 'styles');
  
  // Create normalized styles for detection - extract just the style name part
  const normalizedStyles = styles.map(style => {
    // For grouped styles like "Desktop/Inter/H2", extract just "H2"
    // For Relume styles like "Heading/H1", keep the folder structure
    const parts = style.name.split('/');
    let normalizedName = style.name;
    
    if (parts.length === 3 && (parts[0].toLowerCase() === 'desktop' || parts[0].toLowerCase() === 'mobile' || parts[0].toLowerCase() === 'specimen')) {
      // This is a grouped style: "Desktop/FontFamily/StyleName" → "StyleName"
      normalizedName = parts[2];
    } else if (parts.length === 2 && !parts[0].toLowerCase().includes('text') && !parts[0].toLowerCase().includes('heading')) {
      // This might be "FontFamily/StyleName" format → "StyleName"  
      normalizedName = parts[1];
    }
    // Otherwise keep the original name (for Relume "Heading/H1" patterns, etc.)
    
    return {
      ...style,
      name: normalizedName
    };
  });
  
  console.log('[DesignSystems] Normalized style names for detection:', normalizedStyles.map(s => s.name));
  
  for (const handler of handlers) {
    if (handler.detectSystem(normalizedStyles)) {
      console.log('[DesignSystems] Detected system:', handler.name);
      return handler.name;
    }
  }
  
  console.log('[DesignSystems] No specific system detected, using Default Naming');
  return 'Default Naming';
}

/**
 * Get the handler for a specific design system
 */
export function getDesignSystemHandler(systemName: string): DesignSystemHandler | null {
  const handler = handlers.find(h => h.name === systemName);
  if (!handler) {
    console.warn('[DesignSystems] No handler found for system:', systemName);
    return null;
  }
  return handler;
}

/**
 * Get system style options for a given design system
 */
export function getSystemStyleOptions(systemName: string): string[] {
  const handler = getDesignSystemHandler(systemName);
  if (handler) {
    return handler.getSystemStyleOptions();
  }
  
  // Fallback to default options - using centralized constants
  return [
    'H0', // Display name for STYLE_KEYS.DISPLAY in Default Naming
    'H1', // STYLE_KEYS.H1
    'H2', // STYLE_KEYS.H2
    'H3', // STYLE_KEYS.H3
    'H4', // STYLE_KEYS.H4
    'H5', // STYLE_KEYS.H5
    'H6', // STYLE_KEYS.H6
    'Text Large', // STYLE_KEYS.TEXT_LARGE
    'Text Main',  // STYLE_KEYS.TEXT_MAIN
    'Text Small', // STYLE_KEYS.TEXT_SMALL
    'Text Tiny',  // STYLE_KEYS.MICRO
    'None'
  ];
}

/**
 * Group styles using the appropriate design system handler
 */
export function groupStylesBySystem(styles: FigmaTextStyle[], systemName: string) {
  const handler = getDesignSystemHandler(systemName);
  if (handler) {
    return handler.groupStyles(styles);
  }
  
  // Fallback to generic grouping
  return styles.map(style => ({
    ...style,
    name: style.name,
    originalName: style.name,
    isOpen: false,
    mappedSystemStyle: "None",
    group: 'Styles'
  }));
}

/**
 * Create blueprint using the appropriate design system handler
 */
export function createSystemBlueprint(styles: FigmaTextStyle[], systemName: string): Map<string, string> {
  const handler = getDesignSystemHandler(systemName);
  if (handler) {
    return handler.createBlueprint(styles);
  }
  
  // Fallback to empty blueprint
  return new Map();
} 