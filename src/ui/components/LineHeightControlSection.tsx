import { h, ComponentType } from "preact";
import { useState, useRef, useEffect } from "preact/hooks";
import { useAppStore } from '../store/appStore';

// Assuming IconProps and RangeSliderProps are defined elsewhere and will be imported
// or defined in a shared types file later. For now, basic placeholders:
interface IconProps { name: string; size: number; className?: string; }
interface RangeSliderProps { // Simplified, ensure this matches your actual RangeSliderProps
  min: number;
  max: number;
  step: number;
  values: [number, number];
  onChange: (newValues: [number, number]) => void;
  leftLabel: string;
  rightLabel: string;
  dotValues?: number[];
  valueSuffix?: string; // Optional, as it was commented out in the original RangeSlider call
  displayDecimals?: number;
  allowSameValues?: boolean;
  isFlatMode?: boolean;
  shiftMultiplier?: number | false;
}

export type LineHeightPresetId = 'tight' | 'adaptive' | 'loose' | 'uniform' | 'linear' | 'flat';

export interface LineHeightPresetValues {
  headlineMinLineHeight: number;
  headlineMaxLineHeight: number;
  textMinLineHeight: number;
  textMaxLineHeight: number;
}

export const LINE_HEIGHT_PRESETS: Record<'tight' | 'adaptive' | 'loose' | 'uniform', { desktop: LineHeightPresetValues; mobile: LineHeightPresetValues }> = {
  tight: {
    desktop: { headlineMinLineHeight: 100, headlineMaxLineHeight: 115, textMinLineHeight: 130, textMaxLineHeight: 140 },
    mobile:  { headlineMinLineHeight: 110, headlineMaxLineHeight: 125, textMinLineHeight: 140, textMaxLineHeight: 145 },
  },
  adaptive: {
    desktop: { headlineMinLineHeight: 100, headlineMaxLineHeight: 125, textMinLineHeight: 135, textMaxLineHeight: 150 },
    mobile:  { headlineMinLineHeight: 115, headlineMaxLineHeight: 135, textMinLineHeight: 145, textMaxLineHeight: 150 },
  },
  loose: {
    desktop: { headlineMinLineHeight: 110, headlineMaxLineHeight: 140, textMinLineHeight: 145, textMaxLineHeight: 170 },
    mobile:  { headlineMinLineHeight: 120, headlineMaxLineHeight: 145, textMinLineHeight: 150, textMaxLineHeight: 170 },
  },
  uniform: {
    desktop: { headlineMinLineHeight: 118, headlineMaxLineHeight: 125, textMinLineHeight: 128, textMaxLineHeight: 135 },
    mobile:  { headlineMinLineHeight: 125, headlineMaxLineHeight: 130, textMinLineHeight: 140, textMaxLineHeight: 145 },
  },
};

export interface LineHeightControlSectionProps {
  desktopHeadlineMinLineHeight: number;
  setDesktopHeadlineMinLineHeight: (value: number) => void;
  desktopHeadlineMaxLineHeight: number;
  setDesktopHeadlineMaxLineHeight: (value: number) => void;
  desktopTextMinLineHeight: number;
  setDesktopTextMinLineHeight: (value: number) => void;
  desktopTextMaxLineHeight: number;
  setDesktopTextMaxLineHeight: (value: number) => void;
  mobileHeadlineMinLineHeight: number;
  setMobileHeadlineMinLineHeight: (value: number) => void;
  mobileHeadlineMaxLineHeight: number;
  setMobileHeadlineMaxLineHeight: (value: number) => void;
  mobileTextMinLineHeight: number;
  setMobileTextMinLineHeight: (value: number) => void;
  mobileTextMaxLineHeight: number;
  setMobileTextMaxLineHeight: (value: number) => void;
  onApplySliderPreset?: (values: LineHeightPresetValues) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  headlineDotValues: number[];
  textLineHeightDotValues: number[];
  IconComponent: ComponentType<IconProps>;
  RangeSliderComponent: ComponentType<RangeSliderProps>;
  getSliderAnchorLabels: (type: 'headline' | 'text') => { min: string; max: string };
  handleSliderAnchorAdjustment: (
    sliderType: 'headlineLineHeight' | 'textLineHeight' | 'letterSpacing' | 'headingLetterSpacing' | 'textLetterSpacing',
    newValues: [number, number]
  ) => void;
  onLineHeightPresetOrCurveChange?: () => void;
  inactive?: boolean;
}

export function LineHeightControlSection({
  desktopHeadlineMinLineHeight,
  setDesktopHeadlineMinLineHeight,
  desktopHeadlineMaxLineHeight,
  setDesktopHeadlineMaxLineHeight,
  desktopTextMinLineHeight,
  setDesktopTextMinLineHeight,
  desktopTextMaxLineHeight,
  setDesktopTextMaxLineHeight,
  mobileHeadlineMinLineHeight,
  setMobileHeadlineMinLineHeight,
  mobileHeadlineMaxLineHeight,
  setMobileHeadlineMaxLineHeight,
  mobileTextMinLineHeight,
  setMobileTextMinLineHeight,
  mobileTextMaxLineHeight,
  setMobileTextMaxLineHeight,
  onApplySliderPreset,
  isOpen,
  onToggleOpen,
  headlineDotValues,
  textLineHeightDotValues,
  IconComponent,
  RangeSliderComponent,
  getSliderAnchorLabels,
  handleSliderAnchorAdjustment,
  onLineHeightPresetOrCurveChange,
  inactive = false,
}: LineHeightControlSectionProps) {
  // Get state from Zustand store
  const { roundingGridSize, lineHeightCurve, setLineHeightCurve, activeMode } = useAppStore();
  
  const [isLineHeightCurveDropdownOpen, setIsLineHeightCurveDropdownOpen] = useState(false);
  const lineHeightCurveDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLineHeightCurveDropdownOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (lineHeightCurveDropdownRef.current && !lineHeightCurveDropdownRef.current.contains(event.target as Node)) {
        setIsLineHeightCurveDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isLineHeightCurveDropdownOpen]);

  const headlineValues: [number, number] = activeMode === 'desktop'
    ? [desktopHeadlineMinLineHeight, desktopHeadlineMaxLineHeight]
    : [mobileHeadlineMinLineHeight, mobileHeadlineMaxLineHeight];

  const textValues: [number, number] = activeMode === 'desktop'
    ? [desktopTextMinLineHeight, desktopTextMaxLineHeight]
    : [mobileTextMinLineHeight, mobileTextMaxLineHeight];

  // Get dynamic anchor labels based on current naming convention
  const headlineLabels = getSliderAnchorLabels('headline');
  const textLabels = getSliderAnchorLabels('text');

  // When visible styles are a SUBSET of the full range, the raw range endpoints
  // (headlineMin/Max) correspond to H0 and H6 — NOT the visible extreme styles.
  // Show computed dot values for the visible extremes instead, and map drag
  // deltas back to the underlying range.
  const isSingleHeadlineAnchor =
    headlineLabels.max !== '' && headlineLabels.max === headlineLabels.min;
  const isSingleTextAnchor =
    textLabels.max !== '' && textLabels.max === textLabels.min;

  const singleHeadlineValue =
    isSingleHeadlineAnchor && headlineDotValues.length === 1
      ? Math.round(headlineDotValues[0])
      : null;
  const singleTextValue =
    isSingleTextAnchor && textLineHeightDotValues.length === 1
      ? Math.round(textLineHeightDotValues[0])
      : null;

  // Detect subset range for headlines (2+ visible but not full extremes)
  const visibleHeadlineLeft = headlineDotValues.length >= 2
    ? Math.round(headlineDotValues[0]) : null;
  const visibleHeadlineRight = headlineDotValues.length >= 2
    ? Math.round(headlineDotValues[headlineDotValues.length - 1]) : null;
  const isHeadlineSubsetRange =
    visibleHeadlineLeft !== null && visibleHeadlineRight !== null &&
    (Math.abs(visibleHeadlineLeft - headlineValues[0]) > 0.5 ||
     Math.abs(visibleHeadlineRight - headlineValues[1]) > 0.5);

  // Detect subset range for text styles
  const visibleTextLeft = textLineHeightDotValues.length >= 2
    ? Math.round(textLineHeightDotValues[0]) : null;
  const visibleTextRight = textLineHeightDotValues.length >= 2
    ? Math.round(textLineHeightDotValues[textLineHeightDotValues.length - 1]) : null;
  const isTextSubsetRange =
    visibleTextLeft !== null && visibleTextRight !== null &&
    (Math.abs(visibleTextLeft - textValues[0]) > 0.5 ||
     Math.abs(visibleTextRight - textValues[1]) > 0.5);

  const effectiveHeadlineValues: [number, number] =
    singleHeadlineValue !== null
      ? [singleHeadlineValue, singleHeadlineValue]
      : isHeadlineSubsetRange
        ? [visibleHeadlineLeft!, visibleHeadlineRight!]
        : headlineValues;
  const effectiveTextValues: [number, number] =
    singleTextValue !== null
      ? [singleTextValue, singleTextValue]
      : isTextSubsetRange
        ? [visibleTextLeft!, visibleTextRight!]
        : textValues;

  // When visible styles are a subset, map handle deltas back to the full
  // internal range so the spread is preserved.
  const handleHeadlineChange = (newValues: [number, number]) => {
    if (singleHeadlineValue !== null) {
      const delta = newValues[0] - singleHeadlineValue;
      handleSliderAnchorAdjustment('headlineLineHeight', [
        headlineValues[0] + delta,
        headlineValues[1] + delta,
      ]);
    } else if (isHeadlineSubsetRange && visibleHeadlineLeft !== null && visibleHeadlineRight !== null) {
      const deltaLeft = newValues[0] - visibleHeadlineLeft;
      const deltaRight = newValues[1] - visibleHeadlineRight;
      handleSliderAnchorAdjustment('headlineLineHeight', [
        headlineValues[0] + deltaLeft,
        headlineValues[1] + deltaRight,
      ]);
    } else {
      handleSliderAnchorAdjustment('headlineLineHeight', newValues);
    }
  };

  const handleTextChange = (newValues: [number, number]) => {
    if (singleTextValue !== null) {
      const delta = newValues[0] - singleTextValue;
      handleSliderAnchorAdjustment('textLineHeight', [
        textValues[0] + delta,
        textValues[1] + delta,
      ]);
    } else if (isTextSubsetRange && visibleTextLeft !== null && visibleTextRight !== null) {
      const deltaLeft = newValues[0] - visibleTextLeft;
      const deltaRight = newValues[1] - visibleTextRight;
      handleSliderAnchorAdjustment('textLineHeight', [
        textValues[0] + deltaLeft,
        textValues[1] + deltaRight,
      ]);
    } else {
      handleSliderAnchorAdjustment('textLineHeight', newValues);
    }
  };

  // Calculate slider step size based on baseline grid setting
  // When baseline grid is enabled, use larger steps to ensure grid-aligned results
  const sliderStep = roundingGridSize > 0 ? 2 : 1; // 2% steps when grid enabled, 1% when disabled

  return (
    <div className={`section line-height-section ${isOpen ? 'section-open' : ''} ${inactive ? 'section--inactive' : ''}`}>
      <div className="section-header" tabIndex={0} role="button" onClick={onToggleOpen} onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleOpen(); } }}>
        <div className="section-header-titles-container section-header-left">
          <IconComponent name="navigate-forward-24" size={24} className={`section-header-chevron ${isOpen ? 'open' : ''}`} />
          <span className="section-title">Line height</span>
        </div>
        <div
          ref={lineHeightCurveDropdownRef} 
          className="custom-dropdown-container header-section-dropdown-container"
        >
          <button
            className="input dropdown-trigger-button"
            onClick={(e) => {
              if (inactive) return;
              e.stopPropagation();
              setIsLineHeightCurveDropdownOpen(!isLineHeightCurveDropdownOpen);
            }}
          >
            <span className="dropdown-trigger-label">
              {lineHeightCurve === 'linear' ? 'Linear' : lineHeightCurve === 'flat' ? 'Flat' : (() => {
                const modeKey = activeMode as 'desktop' | 'mobile';
                const vals = { headlineMinLineHeight: headlineValues[0], headlineMaxLineHeight: headlineValues[1], textMinLineHeight: textValues[0], textMaxLineHeight: textValues[1] };
                const match = (['tight', 'adaptive', 'loose', 'uniform'] as const).find(id => {
                  const p = LINE_HEIGHT_PRESETS[id][modeKey];
                  return p.headlineMinLineHeight === vals.headlineMinLineHeight && p.headlineMaxLineHeight === vals.headlineMaxLineHeight && p.textMinLineHeight === vals.textMinLineHeight && p.textMaxLineHeight === vals.textMaxLineHeight;
                });
                return match ? { tight: 'Tight', adaptive: 'Neutral', loose: 'Loose', uniform: 'Uniform' }[match] : 'Custom';
              })()}
            </span>
          </button>
          {isLineHeightCurveDropdownOpen && (
            <div
              className="dropdown-list dropdown-list--opens-down"
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className="dropdown-items-container preset-ratio-items-container">
                {([
                  { id: 'tight' as const, label: 'Tight' },
                  { id: 'adaptive' as const, label: 'Neutral' },
                  { id: 'loose' as const, label: 'Loose' },
                  { id: 'uniform' as const, label: 'Uniform' },
                ]).map(option => {
                  const presetVals = LINE_HEIGHT_PRESETS[option.id][activeMode as 'desktop' | 'mobile'];
                  const isSelected = lineHeightCurve === 'inverse-smooth' &&
                    headlineValues[0] === presetVals.headlineMinLineHeight && headlineValues[1] === presetVals.headlineMaxLineHeight &&
                    textValues[0] === presetVals.textMinLineHeight && textValues[1] === presetVals.textMaxLineHeight;
                  return (
                    <button
                      key={option.id}
                      className={`dropdown-item ${isSelected ? 'selected' : ''}`}
                      onMouseDown={() => {
                        // Ensure imported line-height locks are released via shared anchor-adjustment pipeline.
                        handleSliderAnchorAdjustment('headlineLineHeight', [
                          presetVals.headlineMinLineHeight,
                          presetVals.headlineMaxLineHeight,
                        ]);
                        handleSliderAnchorAdjustment('textLineHeight', [
                          presetVals.textMinLineHeight,
                          presetVals.textMaxLineHeight,
                        ]);
                        onLineHeightPresetOrCurveChange?.();
                        setLineHeightCurve('inverse-smooth');
                        if (onApplySliderPreset) onApplySliderPreset(presetVals);
                        setIsLineHeightCurveDropdownOpen(false);
                      }}
                    >
                      <span className="dropdown-item-text-content">{option.label}</span>
                    </button>
                  );
                })}
                <div className="dropdown-section-divider" />
                {[
                  { value: 'linear', label: 'Linear' },
                  { value: 'flat', label: 'Flat' }
                ].map(option => (
                  <button
                    key={option.value}
                    className={`dropdown-item ${lineHeightCurve === option.value ? 'selected' : ''}`}
                    onMouseDown={() => {
                      // Curve mode changes should also release imported line-height locks.
                      handleSliderAnchorAdjustment('headlineLineHeight', [
                        headlineValues[0],
                        headlineValues[1],
                      ]);
                      handleSliderAnchorAdjustment('textLineHeight', [
                        textValues[0],
                        textValues[1],
                      ]);
                      onLineHeightPresetOrCurveChange?.();
                      setLineHeightCurve(option.value as 'inverse-smooth' | 'linear' | 'flat');
                      setIsLineHeightCurveDropdownOpen(false);
                    }}
                  >
                    <span className="dropdown-item-text-content">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {isOpen && (
        <div className="section-content">
          <div className="control-row-range-slider">
            <RangeSliderComponent
              min={80}
              max={200}
              step={sliderStep}
              values={effectiveHeadlineValues}
              onChange={handleHeadlineChange}
              leftLabel={headlineLabels.max}
              rightLabel={headlineLabels.min}
              dotValues={headlineDotValues}
              valueSuffix="%"
              displayDecimals={0}
              allowSameValues={true}
              isFlatMode={lineHeightCurve === 'flat' || singleHeadlineValue !== null}
            />
          </div>
          <div className="control-row-range-slider">
            <RangeSliderComponent
              min={80}
              max={200}
              step={sliderStep}
              values={effectiveTextValues}
              onChange={handleTextChange}
              leftLabel={textLabels.max}
              rightLabel={textLabels.min}
              dotValues={textLineHeightDotValues}
              valueSuffix="%"
              displayDecimals={0}
              allowSameValues={true}
              isFlatMode={lineHeightCurve === 'flat' || singleTextValue !== null}
            />
          </div>
        </div>
      )}
    </div>
  );
} 