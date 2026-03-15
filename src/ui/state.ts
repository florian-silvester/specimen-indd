/**
 * Represents the typography settings for a single mode (e.g., desktop or mobile).
 */
import { SystemPresetKey } from "../core/constants";

export interface TypographyModeSettings {
  baseSize: number;
  scaleRatio: number;
  systemPreset?: SystemPresetKey;
  letterSpacing: number;
  maxLetterSpacing: number;
  headingLetterSpacing: number;
  headingMaxLetterSpacing: number;
  textLetterSpacing: number;
  textMaxLetterSpacing: number;
  headlineMinLineHeight: number;
  headlineMaxLineHeight: number;
  textMinLineHeight: number;
  textMaxLineHeight: number;
  maxSize: number;
  minSize: number;
  interpolationType: 'linear' | 'exponential';
}

/**
 * Holds the typography settings for both desktop and mobile modes.
 */
export interface TypographySettings {
  desktop: TypographyModeSettings;
  mobile: TypographyModeSettings;
} 