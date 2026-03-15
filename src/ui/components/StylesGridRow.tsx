import { h, Fragment } from "preact";
import { useState, useMemo, useRef, useEffect } from "preact/hooks";
import { TargetedEvent } from 'preact/compat';
import { TypographyStyle, FontInfo } from "../../core/types";
import { TEXT_CASE_OPTIONS } from "../../core/constants";
import { useAppStore } from '../store/appStore';
import { getConventionName } from "../naming-conventions";

// --- Helpers ---

function roundToStep(value: number, step: number): number {
  const inv = 1.0 / step;
  return Math.round(value * inv) / inv;
}

function snapToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function formatEm(value: number, step = 0.125): string {
  const snapped = snapToStep(value, step);
  return snapped.toFixed(3);
}

function computeDisplaySize(style: TypographyStyle, sizeUnit: string, baseSizeInPx: number): string {
  const px = style.size ?? 0;
  if (sizeUnit === 'em') return formatEm(px / baseSizeInPx);
  if (sizeUnit === 'rem') return formatEm(px / 16);
  return px.toFixed(0);
}

function computeDisplayLineHeight(
  style: TypographyStyle,
  lineHeightUnit: string,
  roundingGridSize: number,
): string {
  const multiplier = style.lineHeight ?? 0;
  const size = style.size ?? 16;
  if (lineHeightUnit === 'px') {
    const pxValue = multiplier * size;
    if (roundingGridSize > 0) {
      return (Math.round(pxValue / roundingGridSize) * roundingGridSize).toFixed(0);
    }
    return pxValue.toFixed(0);
  }
  if (lineHeightUnit === 'em' || lineHeightUnit === 'rem') {
    return formatEm(multiplier, 0.025);
  }
  // Percentage mode
  const pct = multiplier * 100;
  if (roundingGridSize > 0) {
    const pxLh = (pct / 100) * size;
    const roundedPx = Math.round(pxLh / roundingGridSize) * roundingGridSize;
    return ((roundedPx / size) * 100).toFixed(0);
  }
  return pct.toFixed(0);
}

function computeDisplayLetterSpacing(lsVal: number, unit: string, sizeInPx: number): string {
  const lsRounded = roundToStep(lsVal, 0.25);
  if (unit === 'px') {
    const pxValue = roundToStep((lsVal / 100) * (sizeInPx || 16), 0.25);
    return pxValue.toFixed(2);
  }
  if (unit === 'em' || unit === 'rem') {
    return formatEm(lsVal / 100);
  }
  const quarterSteps = Math.round(lsRounded / 0.25);
  if (quarterSteps % 4 === 0) return lsRounded.toFixed(0);
  if (quarterSteps % 2 === 0) return lsRounded.toFixed(1);
  return lsRounded.toFixed(2);
}

// TEXT_CASE_OPTIONS imported from core/constants

// --- Props ---

export interface StylesGridRowProps {
  styleKey: string;
  style: TypographyStyle;
  mobileStyle: TypographyStyle | null;
  isFluidMode: boolean;
  rowIndex: number;
  totalRows: number;
  isDragMode: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  getDisplayUIName: (styleName: string) => string;
  handleFineTuneChange: (
    styleName: string,
    property: keyof TypographyStyle,
    value: string,
  ) => void;
  handleGridKeyDown: (
    event: TargetedEvent<HTMLInputElement, KeyboardEvent>,
    styleName: string,
    property: keyof TypographyStyle,
  ) => void;
  onStyleHover: (styleName: string | null) => void;
  onVisibilityMouseDown: (
    event: TargetedEvent<HTMLButtonElement, MouseEvent>,
    styleKey: string,
  ) => void;
  onVisibilityClick: (
    event: TargetedEvent<HTMLButtonElement, MouseEvent>,
    styleKey: string,
    isVisible: boolean,
    valueToShow: string,
  ) => void;
  onRowMouseEnter: (
    styleKey: string,
    event?: TargetedEvent<HTMLDivElement, MouseEvent>,
  ) => void;
  IconComponent: ({
    name,
    className,
    size,
  }: {
    name: string;
    className?: string;
    size?: number;
  }) => preact.JSX.Element;
  // Font controls (detail panel)
  primaryFontFamily: string;
  secondaryFontFamily: string;
  primaryFontWeights: string[];
  secondaryFontWeights: string[];
  availableFonts: string[];
  actualAvailableFontsList: FontInfo[];
  onStyleFontSourceChange: (source: 'primary' | 'secondary' | 'custom') => void;
  onStyleWeightChange: (weight: string) => void;
  onStyleCustomFontChange: (fontFamily: string) => void;
  onStyleFontRelock: () => void;
  onStyleFontPreview?: (fontFamily: string) => void;
  onStyleFontPreviewStop?: () => void;
  baseSizeInPx?: number;
  // Dropdown handling for weight picker portal in parent
  onDropdownToggle: (
    event: TargetedEvent<HTMLButtonElement, MouseEvent>,
    key: string,
  ) => void;
}

// --- Component ---

export function StylesGridRow({
  styleKey,
  style,
  mobileStyle,
  isFluidMode,
  rowIndex,
  totalRows,
  isDragMode,
  isExpanded,
  onToggleExpand,
  getDisplayUIName,
  handleFineTuneChange,
  handleGridKeyDown,
  onStyleHover,
  onVisibilityMouseDown,
  onVisibilityClick,
  onRowMouseEnter,
  IconComponent,
  primaryFontFamily,
  secondaryFontFamily,
  primaryFontWeights,
  secondaryFontWeights,
  availableFonts,
  actualAvailableFontsList,
  onStyleFontSourceChange,
  onStyleWeightChange,
  onStyleCustomFontChange,
  onStyleFontRelock,
  onStyleFontPreview,
  onStyleFontPreviewStop,
  onDropdownToggle,
  baseSizeInPx = 16,
}: StylesGridRowProps) {
  const {
    lineHeightUnit,
    sizeUnit,
    letterSpacingUnit,
    roundingGridSize,
    namingConvention,
    styleVisibility,
    updateStyleVisibility,
    styleFontSources,
    styleWeightLocked,
    updateStyleWeightLocked,
    showGoogleFonts,
    setShowGoogleFonts,
  } = useAppStore();

  // --- Local editing state for number inputs ---
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const startEditing = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditingValue(currentValue);
  };

  const commitEditing = (field: string) => {
    if (editingField !== field || editingValue === '') {
      setEditingField(null);
      return;
    }
    const num = parseFloat(editingValue);
    if (isNaN(num)) {
      setEditingField(null);
      return;
    }
    let valueToPass = editingValue;
    if (field === 'size') {
      if (sizeUnit === 'em') valueToPass = (num * baseSizeInPx).toFixed(0);
      else if (sizeUnit === 'rem') valueToPass = (num * 16).toFixed(0);
    }
    handleFineTuneChange(styleKey, field as keyof TypographyStyle, valueToPass);
    setEditingField(null);
  };

  // --- Detail panel dropdown states ---
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState(false);
  const [fontDropdownOpensUp, setFontDropdownOpensUp] = useState(false);
  const [isCaseDropdownOpen, setIsCaseDropdownOpen] = useState(false);
  const [caseDropdownOpensUp, setCaseDropdownOpensUp] = useState(false);
  const [fontSearchText, setFontSearchText] = useState('');
  const [isFontPreviewing, setIsFontPreviewing] = useState(false);
  const fontSearchInputRef = useRef<HTMLInputElement>(null);
  const fontDropdownContainerRef = useRef<HTMLDivElement>(null);
  const fontDropdownItemsRef = useRef<HTMLDivElement>(null);
  const fontTriggerRef = useRef<HTMLButtonElement>(null);
  const caseTriggerRef = useRef<HTMLButtonElement>(null);
  const fontPreviewTimeoutRef = useRef<number | null>(null);

  // Auto-focus search when font picker opens
  useEffect(() => {
    if (isFontDropdownOpen && fontSearchInputRef.current) {
      setTimeout(() => fontSearchInputRef.current?.focus(), 0);
    }
  }, [isFontDropdownOpen]);

  // Auto-scroll to selected font when dropdown opens
  useEffect(() => {
    if (isFontDropdownOpen && fontDropdownItemsRef.current) {
      setTimeout(() => {
        const container = fontDropdownItemsRef.current;
        if (!container) return;
        if (fontSearchText) {
          const firstItem = container.querySelector('.dropdown-item:first-child') as HTMLElement | null;
          firstItem?.scrollIntoView({ block: 'nearest' });
        } else {
          const selectedItem = container.querySelector('.dropdown-item.selected') as HTMLElement | null;
          if (selectedItem) {
            selectedItem.scrollIntoView({ block: 'nearest' });
          } else {
            container.scrollTop = 0;
          }
        }
      }, 50);
    }
  }, [isFontDropdownOpen, fontSearchText]);

  // Close font dropdown on outside click
  useEffect(() => {
    if (!isFontDropdownOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (fontDropdownContainerRef.current && !fontDropdownContainerRef.current.contains(event.target as Node)) {
        setIsFontDropdownOpen(false);
        setFontSearchText('');
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFontDropdownOpen]);

  // Stop font preview when dropdown closes
  const prevFontDropdownOpen = useRef(isFontDropdownOpen);
  useEffect(() => {
    if (prevFontDropdownOpen.current && !isFontDropdownOpen && isFontPreviewing) {
      onStyleFontPreviewStop?.();
      setIsFontPreviewing(false);
    }
    prevFontDropdownOpen.current = isFontDropdownOpen;
  }, [isFontDropdownOpen, isFontPreviewing, onStyleFontPreviewStop]);

  // Debounced font hover preview
  const startFontHoverPreview = (font: string) => {
    if (fontPreviewTimeoutRef.current) {
      clearTimeout(fontPreviewTimeoutRef.current);
    }
    fontPreviewTimeoutRef.current = window.setTimeout(() => {
      setIsFontPreviewing(true);
      onStyleFontPreview?.(font);
    }, 25);
  };

  const stopFontHoverPreview = () => {
    if (fontPreviewTimeoutRef.current) {
      clearTimeout(fontPreviewTimeoutRef.current);
      fontPreviewTimeoutRef.current = null;
    }
    if (isFontPreviewing) {
      onStyleFontPreviewStop?.();
      setIsFontPreviewing(false);
    }
  };

  // --- Derived state ---
  const isVisible = styleVisibility[styleKey] !== false;

  const currentFontSource = styleFontSources[styleKey] || 'primary';
  const isFontCustom = currentFontSource === 'custom';
  const isWeightLocked = styleWeightLocked[styleKey] !== false;
  const currentWeight = style.fontStyle || 'Regular';
  const currentTextCase = style.textCase || 'Original';

  // Resolve the displayed font family name
  const displayFontFamily = isFontCustom
    ? (style.fontFamily || 'Inter')
    : currentFontSource === 'secondary'
      ? secondaryFontFamily
      : primaryFontFamily;

  // Weights for the currently active font
  const currentFontWeights = useMemo(() => {
    if (isFontCustom) {
      const customFont = style.fontFamily || 'Inter';
      const weights = actualAvailableFontsList
        .filter(f => f.family === customFont)
        .map(f => f.style);
      return weights.length > 0 ? weights : ['Regular'];
    }
    return currentFontSource === 'secondary' ? secondaryFontWeights : primaryFontWeights;
  }, [isFontCustom, currentFontSource, style.fontFamily, actualAvailableFontsList, primaryFontWeights, secondaryFontWeights]);

  // Filtered font list for search
  const filteredFonts = useMemo(() => {
    if (!fontSearchText) return availableFonts;
    const lower = fontSearchText.toLowerCase();
    return availableFonts.filter(f => f.toLowerCase().includes(lower));
  }, [availableFonts, fontSearchText]);

  // --- Display values ---
  const displaySize = computeDisplaySize(style, sizeUnit, baseSizeInPx);
  const displaySizeMin = (mobileStyle?.size ?? style.size ?? 0).toFixed(0);
  const displayLineHeight = computeDisplayLineHeight(style, lineHeightUnit, roundingGridSize);
  const displayLetterSpacing = computeDisplayLetterSpacing(style.letterSpacing ?? 0, letterSpacingUnit, style.size ?? 16);

  // --- Display name ---
  const conventionName = getConventionName(styleKey, namingConvention);
  let valueToShow: string;
  if (style.customName) {
    valueToShow = style.customName;
  } else if (isVisible) {
    valueToShow = conventionName || getDisplayUIName(styleKey);
  } else {
    valueToShow = '--';
  }


  // --- Font lock toggle ---
  const handleFontLockToggle = () => {
    if (isFontCustom) {
      onStyleFontRelock();
    } else {
      onStyleFontSourceChange('custom');
    }
    setIsFontDropdownOpen(false);
    setFontSearchText('');
  };

  // --- Weight lock toggle ---
  const handleWeightLockToggle = () => {
    updateStyleWeightLocked(styleKey, !isWeightLocked);
  };

  // --- Text case labels ---
  const currentCaseLabel = TEXT_CASE_OPTIONS.find(o => o.value === currentTextCase)?.label ?? '\u2014';

  return (
    <div
      className={`grid-row-wrapper ${isExpanded ? 'grid-row-wrapper--expanded' : ''} ${!isVisible ? 'grid-row-wrapper--inactive' : ''}`}
      onMouseEnter={(e) => {
        onStyleHover(styleKey);
        onRowMouseEnter(styleKey, e);
      }}
      onMouseLeave={() => onStyleHover(null)}
    >
      {/* Main row */}
      <div
        className={`grid-style-row ${!isVisible ? 'grid-style-row--inactive' : ''} ${isDragMode ? 'grid-style-row--dragging' : ''}`}
      >
        {/* Name */}
        <div className="grid-cell">
          <input
            type="text"
            className="input grid-input grid-input-name"
            value={valueToShow}
            tabIndex={rowIndex * 4 + 1}
            onInput={(e: TargetedEvent<HTMLInputElement, Event>) => {
              const v = e.currentTarget.value;
              if (!isVisible && v !== '--') updateStyleVisibility(styleKey, true);
              handleFineTuneChange(styleKey, 'customName', v === '--' ? '' : v);
            }}
          />
        </div>

        {/* Size min (fluid only) */}
        {isFluidMode && (
          <div className="grid-cell grid-cell--responsive">
            <div className="input-container-fixed">
              <input
                type="number"
                className="input number-input grid-input grid-input-number"
                value={displaySizeMin}
                readOnly
                tabIndex={-1}
              />
            </div>
          </div>
        )}

        {/* Size */}
        <div className="grid-cell">
          <div className="input-container-fixed">
            <input
              type="number"
              title=""
              className="input number-input grid-input grid-input-number"
              value={editingField === 'size' ? editingValue : displaySize}
              step="1"
              min="1"
              tabIndex={rowIndex * 4 + 2}
              onFocus={() => startEditing('size', displaySize)}
              onBlur={() => commitEditing('size')}
              onInput={(e: TargetedEvent<HTMLInputElement, Event>) => {
                const v = e.currentTarget.value;
                setEditingField('size');
                setEditingValue(v);
                if (v !== '' && !isNaN(parseFloat(v))) {
                  handleFineTuneChange(styleKey, 'size', v);
                }
              }}
              onKeyDown={(e: TargetedEvent<HTMLInputElement, KeyboardEvent>) => {
                if (e.key === 'Enter') { commitEditing('size'); e.currentTarget.blur(); return; }
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { setEditingField(null); }
                handleGridKeyDown(e, styleKey, 'size');
              }}
              onWheel={(e: TargetedEvent<HTMLInputElement, WheelEvent>) => {
                if (e.currentTarget === document.activeElement) e.preventDefault();
              }}
            />
          </div>
        </div>

        {/* Line height */}
        <div className="grid-cell">
          <div className="input-container-fixed">
            <input
              type="number"
              title=""
              className="input number-input"
              value={editingField === 'lineHeight' ? editingValue : displayLineHeight}
              step="1"
              min="1"
              tabIndex={rowIndex * 4 + 3}
              onFocus={() => startEditing('lineHeight', displayLineHeight)}
              onBlur={() => commitEditing('lineHeight')}
              onInput={(e: TargetedEvent<HTMLInputElement, Event>) => {
                const v = e.currentTarget.value;
                setEditingField('lineHeight');
                setEditingValue(v);
                if (v !== '' && !isNaN(parseFloat(v))) {
                  handleFineTuneChange(styleKey, 'lineHeight', v);
                }
              }}
              onKeyDown={(e: TargetedEvent<HTMLInputElement, KeyboardEvent>) => {
                if (e.key === 'Enter') { commitEditing('lineHeight'); e.currentTarget.blur(); return; }
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { setEditingField(null); }
                handleGridKeyDown(e, styleKey, 'lineHeight');
              }}
              onWheel={(e: TargetedEvent<HTMLInputElement, WheelEvent>) => {
                if (e.currentTarget === document.activeElement) e.preventDefault();
              }}
            />
          </div>
        </div>

        {/* Letter spacing */}
        <div className="grid-cell">
          <div className="input-container-fixed">
            <input
              type="number"
              title=""
              className="input number-input"
              value={editingField === 'letterSpacing' ? editingValue : displayLetterSpacing}
              step="0.25"
              tabIndex={rowIndex * 4 + 4}
              onFocus={() => startEditing('letterSpacing', displayLetterSpacing)}
              onBlur={() => commitEditing('letterSpacing')}
              onInput={(e: TargetedEvent<HTMLInputElement, Event>) => {
                const v = e.currentTarget.value;
                setEditingField('letterSpacing');
                setEditingValue(v);
                if (v !== '' && !isNaN(parseFloat(v))) {
                  handleFineTuneChange(styleKey, 'letterSpacing', v);
                }
              }}
              onKeyDown={(e: TargetedEvent<HTMLInputElement, KeyboardEvent>) => {
                if (e.key === 'Enter') { commitEditing('letterSpacing'); e.currentTarget.blur(); return; }
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { setEditingField(null); }
                handleGridKeyDown(e, styleKey, 'letterSpacing');
              }}
              onWheel={(e: TargetedEvent<HTMLInputElement, WheelEvent>) => {
                if (e.currentTarget === document.activeElement) e.preventDefault();
              }}
            />
          </div>
        </div>

        {/* Expand / adjust button */}
        <div className="grid-cell grid-cell-expand">
          <button
            className={`icon-button grid-expand-button ${isExpanded ? 'grid-expand-button--active' : ''}`}
            onMouseDown={(e) => onVisibilityMouseDown(e, styleKey)}
            onClick={onToggleExpand}
            aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
          >
            <IconComponent
              name={isExpanded ? 'close-24' : 'adjust-small-24'}
              size={24}
              className="grid-expand-icon"
            />
          </button>
        </div>

        {/* Visibility */}
        <div className="grid-cell grid-cell-visibility">
          <button
            className={`icon-button grid-visibility-button ${isDragMode ? 'grid-visibility-button--dragging' : ''}`}
            onMouseDown={(e) => onVisibilityMouseDown(e, styleKey)}
            onClick={(e) => onVisibilityClick(e, styleKey, isVisible, valueToShow)}
            aria-label={isVisible ? 'Hide style' : 'Show style'}
          >
            <IconComponent
              name={isVisible ? 'visible-16' : 'hidden-16'}
              size={16}
              className="grid-visibility-icon"
            />
          </button>
        </div>
      </div>

      {/* Detail panel (accordion) */}
      {isExpanded && (
        <div className="grid-row-details">
          {/* Row 1: Font */}
          <div className="control-row font-selection-control-row control-row-no-left-padding">
            <label className="control-label">Font</label>
            <div className="grid-detail-field-with-lock">
              <div ref={fontDropdownContainerRef} className="custom-dropdown-container" style={{ flex: 1 }}>
                {isFontCustom ? (
                  /* Unlocked: full searchable font picker (mirrors main heading section) */
                  <>
                    <button
                      ref={fontTriggerRef}
                      className="input dropdown-trigger-button"
                      onClick={() => {
                        if (!isFontDropdownOpen) {
                          setFontSearchText('');
                          const rect = fontTriggerRef.current?.getBoundingClientRect();
                          if (rect) setFontDropdownOpensUp(rect.bottom + 320 > window.innerHeight);
                        }
                        setIsFontDropdownOpen(!isFontDropdownOpen);
                      }}
                    >
                      <span className="dropdown-trigger-label">{displayFontFamily}</span>
                    </button>
                    {isFontDropdownOpen && (
                      <div
                        className={`dropdown-list ${fontDropdownOpensUp ? 'dropdown-list--opens-up' : 'dropdown-list--opens-down'} grid-font-picker-dropdown`}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseLeave={() => stopFontHoverPreview()}
                      >
                        <div className="search-input-wrapper">
                          <IconComponent name="search-small-24" size={24} className="search-icon" />
                          <input
                            ref={fontSearchInputRef}
                            type="text"
                            className="input font-search-input-inside"
                            value={fontSearchText}
                            onInput={(e: TargetedEvent<HTMLInputElement, Event>) => setFontSearchText(e.currentTarget.value)}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            onDblClick={(e) => (e.target as HTMLInputElement).select()}
                            placeholder="Search fonts..."
                          />
                        </div>
                        {/* Google Fonts Toggle */}
                        <div
                          className="google-fonts-toggle-row"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <label className="toggle-item">
                            <input
                              type="checkbox"
                              className="toggle-checkbox-input"
                              checked={showGoogleFonts}
                              onChange={(e: TargetedEvent<HTMLInputElement, Event>) => {
                                setShowGoogleFonts(e.currentTarget.checked);
                              }}
                            />
                            <span className="toggle-text">Show Google Fonts</span>
                          </label>
                        </div>
                        <div className="search-divider"></div>
                        <div ref={fontDropdownItemsRef} className="dropdown-items-container">
                          {filteredFonts.length > 0 ? (
                            filteredFonts.map((font: string) => (
                              <button
                                key={font}
                                className={`dropdown-item ${font === displayFontFamily ? 'selected' : ''}`}
                                onMouseEnter={() => {
                                  if (font !== displayFontFamily) {
                                    startFontHoverPreview(font);
                                  }
                                }}
                                onMouseDown={() => {
                                  stopFontHoverPreview();
                                  onStyleCustomFontChange(font);
                                  setIsFontDropdownOpen(false);
                                  setFontSearchText('');
                                }}
                              >
                                <span className="dropdown-item-text-content">{font}</span>
                              </button>
                            ))
                          ) : (
                            <div className="dropdown-item no-results">No matching fonts</div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* Locked: just show font name, not clickable */
                  <button
                    className="input dropdown-trigger-button"
                    disabled
                  >
                    <span className="dropdown-trigger-label is-disabled">{displayFontFamily}</span>
                  </button>
                )}
              </div>
              <button
                className="ghost-button grid-lock-button"
                onClick={handleFontLockToggle}
                title={isFontCustom ? "Re-link to global font" : "Unlock for free font choice"}
              >
                <IconComponent
                  name={isFontCustom ? "link-broken-24" : "link-connected-24"}
                  size={24}
                  className="section-header-icon"
                />
              </button>
            </div>
          </div>

          {/* Row 2: Weight */}
          <div className="control-row font-selection-control-row control-row-no-left-padding">
            <label className="control-label">Weight</label>
            <div className="grid-detail-field-with-lock">
              <div className="custom-dropdown-container" style={{ flex: 1 }}>
                <button
                  className="input dropdown-trigger-button"
                  onClick={(e) => onDropdownToggle(e, styleKey)}
                  disabled={isWeightLocked}
                >
                  <span className={`dropdown-trigger-label ${isWeightLocked ? 'is-disabled' : ''}`}>{currentWeight}</span>
                </button>
              </div>
              <button
                className="ghost-button grid-lock-button"
                onClick={handleWeightLockToggle}
                title={isWeightLocked ? "Unlock for free weight choice" : "Re-link to global weight"}
              >
                <IconComponent
                  name={isWeightLocked ? "link-connected-24" : "link-broken-24"}
                  size={24}
                  className="section-header-icon"
                />
              </button>
            </div>
          </div>

          {/* Row 3: Text case */}
          <div className="control-row font-selection-control-row control-row-no-left-padding">
            <label className="control-label">Case</label>
            <div className="grid-detail-field-with-lock">
              <div className="custom-dropdown-container" style={{ flex: 1 }}>
                <button
                  ref={caseTriggerRef}
                  className="input dropdown-trigger-button"
                  onClick={() => {
                    if (!isCaseDropdownOpen) {
                      const rect = caseTriggerRef.current?.getBoundingClientRect();
                      if (rect) setCaseDropdownOpensUp(rect.bottom + 160 > window.innerHeight);
                    }
                    setIsCaseDropdownOpen(!isCaseDropdownOpen);
                  }}
                >
                  <span className="dropdown-trigger-label">{currentCaseLabel}</span>
                </button>
                {isCaseDropdownOpen && (
                  <div
                    className={`dropdown-list ${caseDropdownOpensUp ? 'dropdown-list--opens-up' : 'dropdown-list--opens-down'}`}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <div className="dropdown-items-container">
                      {TEXT_CASE_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          className={`dropdown-item ${currentTextCase === opt.value ? 'selected' : ''}`}
                          onMouseDown={() => {
                            handleFineTuneChange(styleKey, 'textCase', opt.value);
                            setIsCaseDropdownOpen(false);
                          }}
                        >
                          <span className="dropdown-item-text-content">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ width: 'var(--size-icon-size)', flexShrink: 0 }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
