import { h, Fragment, ComponentType } from "preact";
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
  valueSuffix?: string;
  displayDecimals?: number;
  allowSameValues?: boolean;
  isFlatMode?: boolean;
  shiftMultiplier?: number | false;
}

export type LetterSpacingPresetId = 'tight' | 'adaptive' | 'loose' | 'uniform' | 'linear' | 'flat';

export interface LetterSpacingPresetValues {
  maxLetterSpacing: number;
  letterSpacing: number;
}

export const LETTER_SPACING_PRESETS: Record<'tight' | 'adaptive' | 'loose' | 'uniform', { desktop: LetterSpacingPresetValues; mobile: LetterSpacingPresetValues }> = {
  tight: {
    desktop: { maxLetterSpacing: -3.5, letterSpacing: 1.0 },
    mobile:  { maxLetterSpacing: -3.0, letterSpacing: 0.75 },
  },
  adaptive: {
    desktop: { maxLetterSpacing: -2.25, letterSpacing: 2.75 },
    mobile:  { maxLetterSpacing: -2.0, letterSpacing: 2.0 },
  },
  loose: {
    desktop: { maxLetterSpacing: -0.5, letterSpacing: 4.0 },
    mobile:  { maxLetterSpacing: -0.5, letterSpacing: 3.5 },
  },
  uniform: {
    desktop: { maxLetterSpacing: -0.25, letterSpacing: 0.5 },
    mobile:  { maxLetterSpacing: -0.25, letterSpacing: 0.5 },
  },
};

export interface LetterSpacingControlSectionProps {
  desktopLetterSpacing: number;
  setDesktopLetterSpacing: (value: number) => void;
  desktopMaxLetterSpacing: number;
  setDesktopMaxLetterSpacing: (value: number) => void;
  mobileLetterSpacing: number;
  setMobileLetterSpacing: (value: number) => void;
  mobileMaxLetterSpacing: number;
  setMobileMaxLetterSpacing: (value: number) => void;
  onApplySliderPreset?: (values: LetterSpacingPresetValues) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  letterSpacingDotValues: number[];
  headingLetterSpacingDotValues?: number[];
  textLetterSpacingDotValues?: number[];
  IconComponent: ComponentType<IconProps>;
  RangeSliderComponent: ComponentType<RangeSliderProps>;
  getSliderAnchorLabels: (type: 'headline' | 'text') => { min: string; max: string };
  handleSliderAnchorAdjustment: (
    sliderType: 'headlineLineHeight' | 'textLineHeight' | 'letterSpacing' | 'headingLetterSpacing' | 'textLetterSpacing',
    newValues: [number, number]
  ) => void;
  isSplitMode?: boolean;
  headingRangeSliderValues?: [number, number];
  textRangeSliderValues?: [number, number];
  onLetterSpacingPresetOrCurveChange?: () => void;
  inactive?: boolean;
}

export function LetterSpacingControlSection({
  desktopLetterSpacing,
  setDesktopLetterSpacing,
  desktopMaxLetterSpacing,
  setDesktopMaxLetterSpacing,
  mobileLetterSpacing,
  setMobileLetterSpacing,
  mobileMaxLetterSpacing,
  setMobileMaxLetterSpacing,
  onApplySliderPreset,
  isOpen,
  onToggleOpen,
  letterSpacingDotValues,
  headingLetterSpacingDotValues = [],
  textLetterSpacingDotValues = [],
  IconComponent,
  RangeSliderComponent,
  getSliderAnchorLabels,
  handleSliderAnchorAdjustment,
  isSplitMode = false,
  headingRangeSliderValues,
  textRangeSliderValues,
  onLetterSpacingPresetOrCurveChange,
  inactive = false,
}: LetterSpacingControlSectionProps) {
  // Get state from Zustand store
  const { letterSpacingCurve, setLetterSpacingCurve, activeMode } = useAppStore();
  
  const [isLetterSpacingCurveOpen, setIsLetterSpacingCurveOpen] = useState(false);
  const letterSpacingCurveRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLetterSpacingCurveOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (letterSpacingCurveRef.current && !letterSpacingCurveRef.current.contains(event.target as Node)) {
        setIsLetterSpacingCurveOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isLetterSpacingCurveOpen]);

  const currentLetterSpacing = activeMode === 'desktop' ? desktopLetterSpacing : mobileLetterSpacing;
  const setCurrentLetterSpacing = activeMode === 'desktop' ? setDesktopLetterSpacing : setMobileLetterSpacing;
  const currentMaxLetterSpacing = activeMode === 'desktop' ? desktopMaxLetterSpacing : mobileMaxLetterSpacing;
  const setCurrentMaxLetterSpacing = activeMode === 'desktop' ? setDesktopMaxLetterSpacing : setMobileMaxLetterSpacing;

  const rangeSliderValues: [number, number] = activeMode === 'desktop'
    ? [desktopMaxLetterSpacing, desktopLetterSpacing] // Note: Max is first value for this slider in original code
    : [mobileMaxLetterSpacing, mobileLetterSpacing];

  // Get dynamic anchor labels - for letter spacing we need the extreme values across all styles
  const headlineLabels = getSliderAnchorLabels('headline');
  const textLabels = getSliderAnchorLabels('text');

  // Use the largest style for left (max letter spacing) and smallest for right (min letter spacing)
  const leftLabel = headlineLabels.max || 'H0';
  const rightLabel = textLabels.min || 'Text Tiny';

  // When visible styles are a SUBSET of the full range, the raw range endpoints
  // (maxLetterSpacing / letterSpacing) correspond to H0 and Tiny — NOT the
  // visible extreme styles.  Show computed dot values for the visible extremes
  // instead, and map drag deltas back to the underlying range.
  const isSingleLetterSpacingAnchor =
    leftLabel !== '' && leftLabel === rightLabel;
  const singleLSValue =
    isSingleLetterSpacingAnchor && letterSpacingDotValues.length === 1
      ? Math.round(letterSpacingDotValues[0] * 100) / 100
      : null;

  // Detect when visible extremes differ from full-range endpoints by comparing
  // the first/last computed dot values against the raw slider range values.
  const visibleLeftDot = letterSpacingDotValues.length >= 2
    ? Math.round(letterSpacingDotValues[0] * 100) / 100
    : null;
  const visibleRightDot = letterSpacingDotValues.length >= 2
    ? Math.round(letterSpacingDotValues[letterSpacingDotValues.length - 1] * 100) / 100
    : null;
  const isSubsetRange =
    visibleLeftDot !== null && visibleRightDot !== null &&
    (Math.abs(visibleLeftDot - rangeSliderValues[0]) > 0.01 ||
     Math.abs(visibleRightDot - rangeSliderValues[1]) > 0.01);

  const effectiveRangeSliderValues: [number, number] =
    singleLSValue !== null
      ? [singleLSValue, singleLSValue]
      : isSubsetRange
        ? [visibleLeftDot!, visibleRightDot!]
        : rangeSliderValues;

  // Split mode: detect single-anchor per group
  const singleHeadingLSValue =
    headlineLabels.max !== '' && headlineLabels.max === headlineLabels.min &&
    headingLetterSpacingDotValues.length === 1
      ? Math.round(headingLetterSpacingDotValues[0] * 100) / 100
      : null;
  const singleTextLSValue =
    textLabels.max !== '' && textLabels.max === textLabels.min &&
    textLetterSpacingDotValues.length === 1
      ? Math.round(textLetterSpacingDotValues[0] * 100) / 100
      : null;

  // Split mode: detect subset range per group (2+ visible but not full extremes)
  const visibleHeadingLeft = headingLetterSpacingDotValues.length >= 2
    ? Math.round(headingLetterSpacingDotValues[0] * 100) / 100 : null;
  const visibleHeadingRight = headingLetterSpacingDotValues.length >= 2
    ? Math.round(headingLetterSpacingDotValues[headingLetterSpacingDotValues.length - 1] * 100) / 100 : null;
  const isHeadingSubsetRange =
    headingRangeSliderValues && visibleHeadingLeft !== null && visibleHeadingRight !== null &&
    (Math.abs(visibleHeadingLeft - headingRangeSliderValues[0]) > 0.01 ||
     Math.abs(visibleHeadingRight - headingRangeSliderValues[1]) > 0.01);

  const visibleTextLSLeft = textLetterSpacingDotValues.length >= 2
    ? Math.round(textLetterSpacingDotValues[0] * 100) / 100 : null;
  const visibleTextLSRight = textLetterSpacingDotValues.length >= 2
    ? Math.round(textLetterSpacingDotValues[textLetterSpacingDotValues.length - 1] * 100) / 100 : null;
  const isTextLSSubsetRange =
    textRangeSliderValues && visibleTextLSLeft !== null && visibleTextLSRight !== null &&
    (Math.abs(visibleTextLSLeft - textRangeSliderValues[0]) > 0.01 ||
     Math.abs(visibleTextLSRight - textRangeSliderValues[1]) > 0.01);

  const effectiveHeadingValues: [number, number] =
    headingRangeSliderValues
      ? (singleHeadingLSValue !== null
          ? [singleHeadingLSValue, singleHeadingLSValue]
          : isHeadingSubsetRange
            ? [visibleHeadingLeft!, visibleHeadingRight!]
            : headingRangeSliderValues)
      : effectiveRangeSliderValues;
  const effectiveTextValues: [number, number] =
    textRangeSliderValues
      ? (singleTextLSValue !== null
          ? [singleTextLSValue, singleTextLSValue]
          : isTextLSSubsetRange
            ? [visibleTextLSLeft!, visibleTextLSRight!]
            : textRangeSliderValues)
      : effectiveRangeSliderValues;

  // Shift the full internal range by delta when visible styles are a subset.
  const handleRangeSliderChange = (newValues: [number, number]) => {
    if (singleLSValue !== null) {
      // Single visible style → shift entire range uniformly
      const delta = newValues[0] - singleLSValue;
      handleSliderAnchorAdjustment('letterSpacing', [
        rangeSliderValues[0] + delta,
        rangeSliderValues[1] + delta,
      ]);
    } else if (isSubsetRange && visibleLeftDot !== null && visibleRightDot !== null) {
      // Subset of styles visible → map handle deltas back to full range
      const deltaLeft = newValues[0] - visibleLeftDot;
      const deltaRight = newValues[1] - visibleRightDot;
      handleSliderAnchorAdjustment('letterSpacing', [
        rangeSliderValues[0] + deltaLeft,
        rangeSliderValues[1] + deltaRight,
      ]);
    } else {
      handleSliderAnchorAdjustment('letterSpacing', newValues);
    }
  };

  return (
    <div className={`section letter-spacing-section ${isOpen ? 'section-open' : ''} ${inactive ? 'section--inactive' : ''}`}>
      <div className="section-header" tabIndex={0} role="button" onClick={onToggleOpen} onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleOpen(); } }}>
        <div className="section-header-titles-container section-header-left">
          <IconComponent name="navigate-forward-24" size={24} className={`section-header-chevron ${isOpen ? 'open' : ''}`} />
          <span className="section-title">Letter spacing</span>
        </div>
        <div
          ref={letterSpacingCurveRef}
          className="custom-dropdown-container header-section-dropdown-container"
        >
          <button
            className="input dropdown-trigger-button"
            onClick={(e) => {
              if (inactive) return;
              e.stopPropagation();
              setIsLetterSpacingCurveOpen(!isLetterSpacingCurveOpen);
            }}
          >
            <span className="dropdown-trigger-label">
              {letterSpacingCurve === 'linear' ? 'Linear' : letterSpacingCurve === 'flat' ? 'Flat' : (() => {
                const modeKey = activeMode as 'desktop' | 'mobile';
                const curLS = activeMode === 'desktop' ? desktopLetterSpacing : mobileLetterSpacing;
                const curMaxLS = activeMode === 'desktop' ? desktopMaxLetterSpacing : mobileMaxLetterSpacing;
                const match = (['tight', 'adaptive', 'loose', 'uniform'] as const).find(id => {
                  const p = LETTER_SPACING_PRESETS[id][modeKey];
                  return p.letterSpacing === curLS && p.maxLetterSpacing === curMaxLS;
                });
                return match ? { tight: 'Tight', adaptive: 'Neutral', loose: 'Loose', uniform: 'Uniform' }[match] : 'Custom';
              })()}
            </span>
          </button>
          {isLetterSpacingCurveOpen && (
            <div
              className="dropdown-list preset-ratio-dropdown-list"
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className="dropdown-items-container preset-ratio-items-container">
                {([
                  { id: 'tight' as const, label: 'Tight' },
                  { id: 'adaptive' as const, label: 'Neutral' },
                  { id: 'loose' as const, label: 'Loose' },
                  { id: 'uniform' as const, label: 'Uniform' },
                ]).map(option => {
                  const presetVals = LETTER_SPACING_PRESETS[option.id][activeMode as 'desktop' | 'mobile'];
                  const curLS = activeMode === 'desktop' ? desktopLetterSpacing : mobileLetterSpacing;
                  const curMaxLS = activeMode === 'desktop' ? desktopMaxLetterSpacing : mobileMaxLetterSpacing;
                  const isSelected = letterSpacingCurve === 'inverse-smooth' &&
                    curLS === presetVals.letterSpacing && curMaxLS === presetVals.maxLetterSpacing;
                  return (
                    <button
                      key={option.id}
                      className={`dropdown-item ${isSelected ? 'selected' : ''}`}
                      onMouseDown={() => {
                        // Ensure imported letter-spacing locks are released via shared anchor-adjustment pipeline.
                        if (isSplitMode) {
                          handleSliderAnchorAdjustment('headingLetterSpacing', [
                            presetVals.maxLetterSpacing,
                            presetVals.letterSpacing,
                          ]);
                          handleSliderAnchorAdjustment('textLetterSpacing', [
                            presetVals.maxLetterSpacing,
                            presetVals.letterSpacing,
                          ]);
                        } else {
                          handleSliderAnchorAdjustment('letterSpacing', [
                            presetVals.maxLetterSpacing,
                            presetVals.letterSpacing,
                          ]);
                        }
                        onLetterSpacingPresetOrCurveChange?.();
                        setLetterSpacingCurve('inverse-smooth');
                        if (onApplySliderPreset) onApplySliderPreset(presetVals);
                        setIsLetterSpacingCurveOpen(false);
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
                    className={`dropdown-item ${letterSpacingCurve === option.value ? 'selected' : ''}`}
                    onMouseDown={() => {
                      // Curve mode changes should also release imported letter-spacing locks.
                      if (isSplitMode) {
                        handleSliderAnchorAdjustment('headingLetterSpacing', [
                          effectiveHeadingValues[0],
                          effectiveHeadingValues[1],
                        ]);
                        handleSliderAnchorAdjustment('textLetterSpacing', [
                          effectiveTextValues[0],
                          effectiveTextValues[1],
                        ]);
                      } else {
                        handleSliderAnchorAdjustment('letterSpacing', [
                          rangeSliderValues[0],
                          rangeSliderValues[1],
                        ]);
                      }
                      onLetterSpacingPresetOrCurveChange?.();
                      setLetterSpacingCurve(option.value as 'inverse-smooth' | 'linear' | 'flat');
                      setIsLetterSpacingCurveOpen(false);
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
          {isSplitMode ? (
            <Fragment>
              <div className="control-row-range-slider letter-spacing-slider-container">
                <RangeSliderComponent
                  min={-10}
                  max={10}
                  step={0.25}
                  values={effectiveHeadingValues}
                  onChange={(newValues) => {
                    if (singleHeadingLSValue !== null && headingRangeSliderValues) {
                      const delta = newValues[0] - singleHeadingLSValue;
                      handleSliderAnchorAdjustment('headingLetterSpacing', [
                        headingRangeSliderValues[0] + delta,
                        headingRangeSliderValues[1] + delta,
                      ]);
                    } else if (isHeadingSubsetRange && headingRangeSliderValues && visibleHeadingLeft !== null && visibleHeadingRight !== null) {
                      const deltaLeft = newValues[0] - visibleHeadingLeft;
                      const deltaRight = newValues[1] - visibleHeadingRight;
                      handleSliderAnchorAdjustment('headingLetterSpacing', [
                        headingRangeSliderValues[0] + deltaLeft,
                        headingRangeSliderValues[1] + deltaRight,
                      ]);
                    } else {
                      handleSliderAnchorAdjustment('headingLetterSpacing', newValues);
                    }
                  }}
                  leftLabel={headlineLabels.max || 'H0'}
                  rightLabel={headlineLabels.min || 'H6'}
                  valueSuffix="%"
                  displayDecimals={2}
                  dotValues={headingLetterSpacingDotValues}
                  allowSameValues={true}
                  isFlatMode={letterSpacingCurve === 'flat' || singleHeadingLSValue !== null}
                  shiftMultiplier={4}
                />
              </div>
              <div className="control-row-range-slider letter-spacing-slider-container">
                <RangeSliderComponent
                  min={-10}
                  max={10}
                  step={0.25}
                  values={effectiveTextValues}
                  onChange={(newValues) => {
                    if (singleTextLSValue !== null && textRangeSliderValues) {
                      const delta = newValues[0] - singleTextLSValue;
                      handleSliderAnchorAdjustment('textLetterSpacing', [
                        textRangeSliderValues[0] + delta,
                        textRangeSliderValues[1] + delta,
                      ]);
                    } else if (isTextLSSubsetRange && textRangeSliderValues && visibleTextLSLeft !== null && visibleTextLSRight !== null) {
                      const deltaLeft = newValues[0] - visibleTextLSLeft;
                      const deltaRight = newValues[1] - visibleTextLSRight;
                      handleSliderAnchorAdjustment('textLetterSpacing', [
                        textRangeSliderValues[0] + deltaLeft,
                        textRangeSliderValues[1] + deltaRight,
                      ]);
                    } else {
                      handleSliderAnchorAdjustment('textLetterSpacing', newValues);
                    }
                  }}
                  leftLabel={textLabels.max || 'Text Large'}
                  rightLabel={textLabels.min || 'Text Tiny'}
                  valueSuffix="%"
                  displayDecimals={2}
                  dotValues={textLetterSpacingDotValues}
                  allowSameValues={true}
                  isFlatMode={letterSpacingCurve === 'flat' || singleTextLSValue !== null}
                  shiftMultiplier={4}
                />
              </div>
            </Fragment>
          ) : (
            <div className="control-row-range-slider letter-spacing-slider-container">
              <RangeSliderComponent
                min={-10}
                max={10}
                step={0.25}
                values={effectiveRangeSliderValues}
                onChange={handleRangeSliderChange}
                leftLabel={leftLabel}
                rightLabel={rightLabel}
                valueSuffix="%"
                displayDecimals={2}
                dotValues={letterSpacingDotValues}
                allowSameValues={true}
                isFlatMode={letterSpacingCurve === 'flat' || singleLSValue !== null}
                shiftMultiplier={4}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
} 