// src/ui/logic/typography-calculator.ts
// This file will contain the logic for calculating the typography system. 

import { TypographySystem, TypographyStyle } from "../../core/types";
import { TypographyModeSettings } from "../state";
import { TYPOGRAPHY_SCALE_POINTS, STYLE_KEYS, TYPOGRAPHY_SCALE_ORDER, SYSTEM_PRESETS, StyleName, SCALE_RATIO_MAX, SCALE_RATIO_MIN } from "../../core/constants";

export interface CalculateStylesParams {
  modeSettings: TypographyModeSettings;
  fontFamily: string;
  fontStyle: string;
  lineHeightCurve: 'inverse-smooth' | 'linear' | 'flat';
  letterSpacingCurve: 'inverse-smooth' | 'linear' | 'flat';
  letterSpacingSplit?: boolean;
  explicitBaseSize?: number;
  availableStyleAnchors?: {
    headlineMin: string; // e.g., 'h6' or 'textSmall' 
    headlineMax: string; // e.g., 'display' or 'h1'
    textMin: string;     // e.g., 'micro' or 'textSmall'
    textMax: string;     // e.g., 'textLarge' or 'textMain'
  };
  // Secondary font for headlines
  secondaryFontFamily?: string;
  secondaryFontStyle?: string;
}

export function calculateStyles({
  modeSettings,
  fontFamily,
  fontStyle,
  lineHeightCurve,
  letterSpacingCurve,
  letterSpacingSplit = false,
  explicitBaseSize,
  availableStyleAnchors,
  secondaryFontFamily,
  secondaryFontStyle,
}: CalculateStylesParams): TypographySystem {

  const {
    baseSize: rawBaseSizeFromState,
    scaleRatio: rawScaleRatio,
    systemPreset,
    letterSpacing,
    maxLetterSpacing,
    headingLetterSpacing,
    headingMaxLetterSpacing,
    textLetterSpacing,
    textMaxLetterSpacing,
    headlineMinLineHeight,
    headlineMaxLineHeight,
    textMinLineHeight,
    textMaxLineHeight,
  } = modeSettings;

  const rawBaseSize = typeof explicitBaseSize === 'number' && explicitBaseSize > 0 
                      ? explicitBaseSize 
                      : rawBaseSizeFromState;
  
  // CRITICAL FIX: Ensure scaleRatio is valid (but allow 1.0 "Flat" as it's a valid preset)
  // Default to 1.333 (Perfect Fourth) if invalid
  let scaleRatio = rawScaleRatio;
  if (typeof scaleRatio !== 'number' || isNaN(scaleRatio) || scaleRatio <= 0) {
    console.warn(`[typography-calculator] ⚠️ Invalid scaleRatio detected: ${scaleRatio}, defaulting to 1.333`);
    scaleRatio = 1.333;
  }
  if (scaleRatio > SCALE_RATIO_MAX) {
    console.warn(`[typography-calculator] ⚠️ scaleRatio ${scaleRatio} exceeds max ${SCALE_RATIO_MAX}; clamping.`);
    scaleRatio = SCALE_RATIO_MAX;
  }
  if (scaleRatio < SCALE_RATIO_MIN) {
    console.warn(`[typography-calculator] ⚠️ scaleRatio ${scaleRatio} below min ${SCALE_RATIO_MIN}; clamping.`);
    scaleRatio = SCALE_RATIO_MIN;
  }
  
  const baseSize = Math.round(rawBaseSize);

  // Debug logging to diagnose why all sizes are 16px
  console.log(`[typography-calculator] 🔍 CALCULATION INPUTS: baseSize=${baseSize}, scaleRatio=${scaleRatio}`);
  
  // CRITICAL: Warn if scaleRatio is 1.0 (Flat) - this would make all sizes equal to baseSize
  if (Math.abs(scaleRatio - 1.0) < 0.001) {
    console.warn(`[typography-calculator] ⚠️ WARNING: scaleRatio is 1.0 (Flat)! All sizes will be ${baseSize}px.`);
  }

  const minExp = TYPOGRAPHY_SCALE_POINTS.textSmall; // -0.5
  const maxExp = TYPOGRAPHY_SCALE_POINTS.display; // 4.25
  const baseExp = TYPOGRAPHY_SCALE_POINTS.textMain; // 0
  const expRange = maxExp - minExp; // 4.75

  const styles: TypographySystem = {};

  const presetDefinition = systemPreset ? SYSTEM_PRESETS[systemPreset] : undefined;

  for (const [name, exponent] of Object.entries(TYPOGRAPHY_SCALE_POINTS)) {
    const presetMultiplier = presetDefinition ? presetDefinition[name as StyleName] : undefined;
    const multiplier = typeof presetMultiplier === 'number' ? presetMultiplier : Math.pow(scaleRatio, exponent);
    const calculatedSize = baseSize * multiplier;
    console.log(`[typography-calculator] 📐 Style "${name}": exponent=${exponent}, multiplier=${multiplier.toFixed(3)}, calculatedSize=${calculatedSize.toFixed(2)}, roundedSize=${Math.round(calculatedSize)}`);

    const preciseSize = calculatedSize;
    const roundedSize = Math.round(calculatedSize);

    const isHeadline = TYPOGRAPHY_SCALE_ORDER.HEADINGS.includes(name as any);
    
    let lh_val_small: number;
    let lh_val_display: number;
    let fs_at_scale_small: number;
    let fs_at_scale_display: number;
    let scale_small_exp: number;
    let scale_display_exp: number;
    
    if (isHeadline) {
      // Use dynamic headline anchors if available, fallback to defaults
      const headlineMinAnchor = availableStyleAnchors?.headlineMin || STYLE_KEYS.H6;
      const headlineMaxAnchor = availableStyleAnchors?.headlineMax || STYLE_KEYS.DISPLAY;
      
      scale_small_exp = TYPOGRAPHY_SCALE_POINTS[headlineMinAnchor] ?? TYPOGRAPHY_SCALE_POINTS[STYLE_KEYS.H6];
      scale_display_exp = TYPOGRAPHY_SCALE_POINTS[headlineMaxAnchor] ?? TYPOGRAPHY_SCALE_POINTS[STYLE_KEYS.DISPLAY];
      fs_at_scale_small = baseSize * Math.pow(scaleRatio, scale_small_exp);
      fs_at_scale_display = baseSize * Math.pow(scaleRatio, scale_display_exp);
      lh_val_small = headlineMaxLineHeight / 100;
      lh_val_display = headlineMinLineHeight / 100;
    } else {
      // Use dynamic text anchors if available, fallback to defaults
      const textMinAnchor = availableStyleAnchors?.textMin || STYLE_KEYS.MICRO;
      const textMaxAnchor = availableStyleAnchors?.textMax || STYLE_KEYS.TEXT_LARGE;
      
      scale_small_exp = TYPOGRAPHY_SCALE_POINTS[textMinAnchor] ?? TYPOGRAPHY_SCALE_POINTS[STYLE_KEYS.MICRO];
      scale_display_exp = TYPOGRAPHY_SCALE_POINTS[textMaxAnchor] ?? TYPOGRAPHY_SCALE_POINTS[STYLE_KEYS.TEXT_LARGE];
      fs_at_scale_small = baseSize * Math.pow(scaleRatio, scale_small_exp);
      fs_at_scale_display = baseSize * Math.pow(scaleRatio, scale_display_exp);
      lh_val_small = textMaxLineHeight / 100;
      lh_val_display = textMinLineHeight / 100;
    }
    
    const current_fs = preciseSize;
    let calculatedLineHeight: number;

    if (lineHeightCurve === 'flat') {
        // Flat: Use the slider value directly (no interpolation)
        // lh_val_small and lh_val_display should be the same when user drags to same spot
        calculatedLineHeight = lh_val_small; // Use one of them (they should be equal)
    } else if (Math.abs(fs_at_scale_display - fs_at_scale_small) < 0.001) {
        const expRangeForFallback = scale_display_exp - scale_small_exp;
        const rawExponentFraction = expRangeForFallback === 0 ? 0 : (exponent - scale_small_exp) / expRangeForFallback;
        calculatedLineHeight = lh_val_small + (lh_val_display - lh_val_small) * rawExponentFraction;
    } else {
        if (lineHeightCurve === 'linear') {
            const exponentRange = scale_display_exp - scale_small_exp;
            const fraction = exponentRange === 0 ? 0 : (exponent - scale_small_exp) / exponentRange;
            calculatedLineHeight = lh_val_small + (lh_val_display - lh_val_small) * fraction;
        } else {
            if (Math.abs(1/fs_at_scale_display - 1/fs_at_scale_small) < 0.00001 || fs_at_scale_small < 0.1 || current_fs < 0.1) {
                // Fallback to linear if inverse calculation is unstable (division by zero)
                const expRangeForFallback = scale_display_exp - scale_small_exp;
                const rawExponentFraction = expRangeForFallback === 0 ? 0 : (exponent - scale_small_exp) / expRangeForFallback;
                calculatedLineHeight = lh_val_small + (lh_val_display - lh_val_small) * rawExponentFraction;
            } else {
                const B_lh = (lh_val_display - lh_val_small) / (1/fs_at_scale_display - 1/fs_at_scale_small);
                const A_lh = lh_val_small - B_lh / fs_at_scale_small;
                calculatedLineHeight = A_lh + B_lh / current_fs;
            }
        }
    }

    const isHeadlineStyle = TYPOGRAPHY_SCALE_ORDER.HEADINGS.includes(name as any);
    const shouldSplitLetterSpacing = letterSpacingSplit;

    // Use group-aware letter spacing anchors and values when split mode is active.
    const letterSpacingMinAnchor = shouldSplitLetterSpacing
      ? (isHeadlineStyle
          ? (availableStyleAnchors?.headlineMin || STYLE_KEYS.H6)
          : (availableStyleAnchors?.textMin || STYLE_KEYS.MICRO))
      : (availableStyleAnchors?.textMin || STYLE_KEYS.MICRO);
    const letterSpacingMaxAnchor = shouldSplitLetterSpacing
      ? (isHeadlineStyle
          ? (availableStyleAnchors?.headlineMax || STYLE_KEYS.DISPLAY)
          : (availableStyleAnchors?.textMax || STYLE_KEYS.TEXT_LARGE))
      : (availableStyleAnchors?.headlineMax || STYLE_KEYS.DISPLAY);

    const ls_small_exp = TYPOGRAPHY_SCALE_POINTS[letterSpacingMinAnchor] ?? TYPOGRAPHY_SCALE_POINTS[STYLE_KEYS.MICRO];
    const ls_display_exp = TYPOGRAPHY_SCALE_POINTS[letterSpacingMaxAnchor] ?? TYPOGRAPHY_SCALE_POINTS[STYLE_KEYS.DISPLAY];
    const ls_at_scale_small = baseSize * Math.pow(scaleRatio, ls_small_exp);
    const ls_at_scale_display = baseSize * Math.pow(scaleRatio, ls_display_exp);

    const ls_val_small = shouldSplitLetterSpacing
      ? (isHeadlineStyle ? headingLetterSpacing : textLetterSpacing)
      : letterSpacing;
    const ls_val_display = shouldSplitLetterSpacing
      ? (isHeadlineStyle ? headingMaxLetterSpacing : textMaxLetterSpacing)
      : maxLetterSpacing;
    let calculatedLetterSpacing: number;

    if (letterSpacingCurve === 'flat') {
        // Flat: Use the slider value directly (no interpolation)
        calculatedLetterSpacing = ls_val_small; // Use slider value (should be same as ls_val_display)
    } else if (Math.abs(ls_at_scale_display - ls_at_scale_small) < 0.001) {
        const ls_expRange = ls_display_exp - ls_small_exp;
        const rawExponentFraction = ls_expRange === 0 ? 0 : (exponent - ls_small_exp) / ls_expRange;
        calculatedLetterSpacing = ls_val_small + (ls_val_display - ls_val_small) * rawExponentFraction;
    } else {
      if (letterSpacingCurve === 'linear') {
        const ls_expRange = ls_display_exp - ls_small_exp;
        const fraction = ls_expRange === 0 ? 0 : (exponent - ls_small_exp) / ls_expRange;
        calculatedLetterSpacing = ls_val_small + (ls_val_display - ls_val_small) * fraction;
      } else { // 'inverse-smooth'
        if (Math.abs(1/ls_at_scale_display - 1/ls_at_scale_small) < 0.00001 || ls_at_scale_small < 0.1 || preciseSize < 0.1) {
          // Fallback to linear if inverse calculation is unstable
          const ls_expRange = ls_display_exp - ls_small_exp;
          const rawExponentFraction = ls_expRange === 0 ? 0 : (exponent - ls_small_exp) / ls_expRange;
          calculatedLetterSpacing = ls_val_small + (ls_val_display - ls_val_small) * rawExponentFraction;
        } else {
          const B_ls = (ls_val_display - ls_val_small) / (1/ls_at_scale_display - 1/ls_at_scale_small);
          const A_ls = ls_val_small - B_ls / ls_at_scale_small;
          calculatedLetterSpacing = A_ls + B_ls / preciseSize;
        }
      }
    }
    
    // Round letter spacing to 0.25 steps for flat and linear modes
    if (letterSpacingCurve === 'flat' || letterSpacingCurve === 'linear') {
      calculatedLetterSpacing = Math.round(calculatedLetterSpacing * 4) / 4;
    }
    
    // Determine which font to use based on style type
    const styleFontFamily = isHeadlineStyle && secondaryFontFamily ? secondaryFontFamily : fontFamily;
    const styleFontStyle = isHeadlineStyle && secondaryFontStyle ? secondaryFontStyle : fontStyle;
    
    console.log(`[typography-calculator] 🎨 Style "${name}": isHeadline=${isHeadlineStyle}, font="${styleFontFamily}", secondaryAvailable="${secondaryFontFamily}"`);;

    styles[name] = {
      size: roundedSize,
      lineHeight: calculatedLineHeight,
      letterSpacing: calculatedLetterSpacing,
      fontFamily: styleFontFamily,
      fontStyle: styleFontStyle,
      textCase: "Original",
      customName: undefined,
    };
  }

  if (!presetDefinition) {
    if (styles[STYLE_KEYS.H5]) styles[STYLE_KEYS.TEXT_LARGE].size = styles[STYLE_KEYS.H5].size;

    if (styles[STYLE_KEYS.H6]) {
      styles[STYLE_KEYS.TEXT_MAIN].size = styles[STYLE_KEYS.H6].size;
    }
    // Keep legacy linked-mode behavior only. In split letter-spacing mode this would
    // incorrectly couple textLarge to heading interpolation.
    if (!letterSpacingSplit && styles[STYLE_KEYS.H5]) {
      styles[STYLE_KEYS.TEXT_LARGE].letterSpacing = styles[STYLE_KEYS.H5].letterSpacing;
    }
  }

  return styles;
} 