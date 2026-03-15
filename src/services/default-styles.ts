import { TypographySystem, TypographyStyle } from '../core/types';
import { TYPOGRAPHY_SCALE_POINTS, TYPOGRAPHY_SCALE_ORDER } from '../core/constants';

// --- Default Input Parameters (Desktop Focus) ---
const DEFAULT_FONT_FAMILY = "Inter";
const DEFAULT_FONT_STYLE = "Regular";
const DEFAULT_BASE_SIZE = 16;
const DEFAULT_SCALE_RATIO = 1.333;

// Line Height Defaults (as percentages for easier use here, then converted)
const DEFAULT_DESKTOP_HEADLINE_MIN_LH_PERCENT = 100; // For Display
const DEFAULT_DESKTOP_HEADLINE_MAX_LH_PERCENT = 125; // For H6
const DEFAULT_DESKTOP_TEXT_MIN_LH_PERCENT = 135;     // For TextLarge
const DEFAULT_DESKTOP_TEXT_MAX_LH_PERCENT = 175;     // For Micro

// Letter Spacing Defaults (as percentages)
const DEFAULT_DESKTOP_MIN_LS_PERCENT = -2.25; // For Display (maxLetterSpacing in UI)
const DEFAULT_DESKTOP_MAX_LS_PERCENT = 2.75;  // For Micro (letterSpacing in UI)

// Default curve types (can be hardcoded for preset generation)
const DEFAULT_LH_CURVE: 'inverse-smooth' | 'linear' = 'inverse-smooth';
const DEFAULT_LS_CURVE: 'inverse-smooth' | 'linear' /* | 'inverse-soft' */ = 'inverse-smooth'; // Assuming linear or inverse-smooth for simplicity here

function generateDefaultTypographySystem(): TypographySystem {
    const styles: TypographySystem = {};

    const baseSize = DEFAULT_BASE_SIZE;
    const scaleRatio = DEFAULT_SCALE_RATIO;

    for (const [name, exponent] of Object.entries(TYPOGRAPHY_SCALE_POINTS)) {
        const preciseSize = baseSize * Math.pow(scaleRatio, exponent);
        const roundedSize = Math.round(preciseSize);

        // Simplified Line Height Calculation (mirroring logic from ui.tsx for defaults)
        const isHeadline = TYPOGRAPHY_SCALE_ORDER.HEADINGS.includes(name as any);
        let lh_val_small_percent: number, lh_val_display_percent: number;
        let fs_at_scale_small: number, fs_at_scale_display: number;
        let scale_small_exp: number, scale_display_exp: number;

        if (isHeadline) {
            scale_small_exp = TYPOGRAPHY_SCALE_POINTS.h6;
            scale_display_exp = TYPOGRAPHY_SCALE_POINTS.display;
            lh_val_small_percent = DEFAULT_DESKTOP_HEADLINE_MAX_LH_PERCENT;
            lh_val_display_percent = DEFAULT_DESKTOP_HEADLINE_MIN_LH_PERCENT;
        } else {
            scale_small_exp = TYPOGRAPHY_SCALE_POINTS.micro;
            scale_display_exp = TYPOGRAPHY_SCALE_POINTS.textLarge;
            lh_val_small_percent = DEFAULT_DESKTOP_TEXT_MAX_LH_PERCENT;
            lh_val_display_percent = DEFAULT_DESKTOP_TEXT_MIN_LH_PERCENT;
        }
        fs_at_scale_small = baseSize * Math.pow(scaleRatio, scale_small_exp);
        fs_at_scale_display = baseSize * Math.pow(scaleRatio, scale_display_exp);
        
        const lh_val_small = lh_val_small_percent / 100;
        const lh_val_display = lh_val_display_percent / 100;
        let calculatedLineHeight: number;

        if (Math.abs(fs_at_scale_display - fs_at_scale_small) < 0.001 || (DEFAULT_LH_CURVE === 'inverse-smooth' && Math.abs(1/fs_at_scale_display - 1/fs_at_scale_small) < 0.00001)) {
            const expRangeForFallback = scale_display_exp - scale_small_exp;
            const rawExponentFraction = expRangeForFallback === 0 ? 0 : (exponent - scale_small_exp) / expRangeForFallback;
            calculatedLineHeight = lh_val_small + (lh_val_display - lh_val_small) * rawExponentFraction;
        } else if (DEFAULT_LH_CURVE === 'linear') {
            const fsRange = fs_at_scale_display - fs_at_scale_small;
            const clamped_current_fs = Math.max(fs_at_scale_small, Math.min(preciseSize, fs_at_scale_display));
            const fraction = fsRange === 0 ? 0 : (clamped_current_fs - fs_at_scale_small) / fsRange;
            calculatedLineHeight = lh_val_small + (lh_val_display - lh_val_small) * fraction;
        } else { // inverse-smooth
            const B_lh = (lh_val_display - lh_val_small) / (1/fs_at_scale_display - 1/fs_at_scale_small);
            const A_lh = lh_val_small - B_lh / fs_at_scale_small;
            calculatedLineHeight = A_lh + B_lh / preciseSize;
        }

        // Simplified Letter Spacing Calculation
        const ls_small_exp_ls = TYPOGRAPHY_SCALE_POINTS.micro;
        const ls_display_exp_ls = TYPOGRAPHY_SCALE_POINTS.display;
        const ls_at_scale_small = baseSize * Math.pow(scaleRatio, ls_small_exp_ls);
        const ls_at_scale_display = baseSize * Math.pow(scaleRatio, ls_display_exp_ls);
        const ls_val_small = DEFAULT_DESKTOP_MAX_LS_PERCENT; 
        const ls_val_display = DEFAULT_DESKTOP_MIN_LS_PERCENT;
        let calculatedLetterSpacing: number;

        if (Math.abs(ls_at_scale_display - ls_at_scale_small) < 0.001 || (DEFAULT_LS_CURVE === 'inverse-smooth' && Math.abs(1/ls_at_scale_display - 1/ls_at_scale_small) < 0.00001)) {
            const ls_expRange = ls_display_exp_ls - ls_small_exp_ls;
            const rawExponentFraction = ls_expRange === 0 ? 0 : (exponent - ls_small_exp_ls) / ls_expRange;
            calculatedLetterSpacing = ls_val_small + (ls_val_display - ls_val_small) * rawExponentFraction;
        } else if (DEFAULT_LS_CURVE === 'linear') {
             const fsRange = ls_at_scale_display - ls_at_scale_small;
             const clamped_current_fs = Math.max(ls_at_scale_small, Math.min(preciseSize, ls_at_scale_display));
             const fraction = fsRange === 0 ? 0 : (clamped_current_fs - ls_at_scale_small) / fsRange;
             calculatedLetterSpacing = ls_val_small + (ls_val_display - ls_val_small) * fraction;
        } else { // inverse-smooth for LS
            const B_ls = (ls_val_display - ls_val_small) / (1/ls_at_scale_display - 1/ls_at_scale_small);
            const A_ls = ls_val_small - B_ls / ls_at_scale_small;
            calculatedLetterSpacing = A_ls + B_ls / preciseSize;
        }

        styles[name] = {
            size: roundedSize,
            lineHeight: calculatedLineHeight,
            letterSpacing: calculatedLetterSpacing,
            fontFamily: DEFAULT_FONT_FAMILY,
            fontStyle: DEFAULT_FONT_STYLE,
            textCase: "Original",
        };
    }

    // Post-calculation adjustments (ensure keys exist before assigning)
    if (styles.h5 && styles.textLarge) styles.textLarge.size = styles.h5.size;
    if (styles.h6 && styles.textMain) styles.textMain.letterSpacing = styles.h6.letterSpacing; // Sync LS
    if (styles.h5 && styles.textLarge) styles.textLarge.letterSpacing = styles.h5.letterSpacing; // Sync LS
    // Note: Line heights are calculated independently per group (headlines/text) and curve now.

    return styles;
}

export const DEFAULT_TYPE_SYSTEM: TypographySystem = generateDefaultTypographySystem(); 