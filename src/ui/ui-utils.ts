import { TYPOGRAPHY_SCALE_POINTS, STYLE_KEYS } from '../core/constants';

// Helper to calculate initial sizes for manual mode
export const calculateInitialManualSizes = (
  baseSize: number,
  scaleRatio: number,
): { [key: string]: number } => {
  const initialSizes: { [key: string]: number } = {};
  for (const [name, exponent] of Object.entries(TYPOGRAPHY_SCALE_POINTS)) {
    let size = baseSize * Math.pow(scaleRatio, exponent);
    initialSizes[name] = Math.round(size);
  }
  // Apply H6->textMain, H5->textLarge overrides using centralized constants
  if (initialSizes[STYLE_KEYS.H6]) initialSizes[STYLE_KEYS.TEXT_MAIN] = initialSizes[STYLE_KEYS.H6];
  if (initialSizes[STYLE_KEYS.H5]) initialSizes[STYLE_KEYS.TEXT_LARGE] = initialSizes[STYLE_KEYS.H5];
  return initialSizes;
};

// Helper function within UI to get user-friendly names
export const getDisplayUIName = (styleName: string): string => {
  const lowerCaseName = styleName.toLowerCase();
  switch (lowerCaseName) {
    case STYLE_KEYS.DISPLAY.toLowerCase():
      return "H0";
    case STYLE_KEYS.H1.toLowerCase():
      return "H1";
    case STYLE_KEYS.H2.toLowerCase():
      return "H2";
    case STYLE_KEYS.H3.toLowerCase():
      return "H3";
    case STYLE_KEYS.H4.toLowerCase():
      return "H4";
    case STYLE_KEYS.H5.toLowerCase():
      return "H5";
    case STYLE_KEYS.H6.toLowerCase():
      return "H6";
    case STYLE_KEYS.TEXT_MAIN.toLowerCase():
      return "Text Main";
    case STYLE_KEYS.TEXT_LARGE.toLowerCase():
      return "Text Large";
    case STYLE_KEYS.TEXT_SMALL.toLowerCase():
      return "Text Small";
    case STYLE_KEYS.MICRO.toLowerCase():
      return "Text Tiny";
    default:
      return styleName; // Fallback
  }
}; 