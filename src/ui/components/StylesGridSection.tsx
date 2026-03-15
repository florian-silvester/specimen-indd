import { h, Fragment } from "preact";
import { TargetedEvent } from 'preact/compat';
import { useState, useRef, useEffect, useMemo } from "preact/hooks";
import { TypographyStyle, TypographySystem, FontInfo, UpdatePreviewRequest } from "../../core/types";
import { FontSourceDropdownContent } from "./FontSourceDropdown";
import { StylesGridRow } from "./StylesGridRow";
import { useAppStore } from '../store/appStore';
import type { FontSource } from '../store/appStore';

// --- Sort order for visual display ---
const VISUAL_DISPLAY_ORDER: { [key: string]: number } = {
  display: 10,
  h1: 9,
  h2: 8,
  h3: 7,
  h4: 6,
  h5: 5,
  h6: 4,
  textLarge: 3,
  textMain: 2,
  textSmall: 1,
  micro: 0,
};

// --- Props ---
interface StylesGridSectionProps {
  fineTunedStyles: TypographySystem;
  mobileStyles?: TypographySystem | null;
  isFluidMode: boolean;
  isOpen: boolean;
  onToggleOpen: () => void;
  IconComponent: ({ name, className, size }: { name: string; className?: string; size?: number; }) => preact.JSX.Element;
  _scalePoints: { [key: string]: number };
  getDisplayUIName: (styleName: string) => string;
  handleFineTuneChange: (
    styleName: string,
    property: keyof TypographyStyle,
    value: string
  ) => void;
  handleGridKeyDown: (
    event: TargetedEvent<HTMLInputElement, KeyboardEvent>,
    styleName: string,
    property: keyof TypographyStyle
  ) => void;
  availableStyles: string[];
  openGridFontStyleDropdownKey: string | null;
  setOpenGridFontStyleDropdownKey: (key: string | null) => void;
  gridDropdownsRef: preact.RefObject<HTMLDivElement>;
  emitUpdatePreview: (typeSystem: TypographySystem, overrides?: Partial<UpdatePreviewRequest>) => void;
  selectedStyle: string;
  desktopScaleRatio: number;
  mobileScaleRatio: number;
  applyRoundingToSystem: (system: TypographySystem, gridSize: number) => TypographySystem;
  showSpecLabels: boolean;
  namingConventionOptions: string[];
  onStyleHover: (styleName: string | null) => void;
  showGrid: boolean;
  primaryFontFamily: string;
  primaryFontWeights: string[];
  secondaryFontFamily: string;
  secondaryFontWeights: string[];
  onStyleFontSourceChange: (styleName: string, source: FontSource) => void;
  onStyleWeightChange: (styleName: string, weight: string) => void;
  onStyleCustomFontChange: (styleName: string, fontFamily: string) => void;
  onStyleFontRelock: (styleName: string) => void;
  availableFonts: string[];
  actualAvailableFontsList: FontInfo[];
  onStylePreview?: (styleKey: string, weight: string) => void;
  onStylePreviewStop?: (styleKey: string) => void;
  onStyleFontPreview?: (styleKey: string, fontFamily: string) => void;
  onStyleFontPreviewStop?: (styleKey: string) => void;
  onResetGridOverrides: () => void;
  showResetAllOverrides?: boolean;
  baseSizeInPx?: number;
}

export function StylesGridSection({
  fineTunedStyles,
  mobileStyles,
  isFluidMode,
  isOpen,
  onToggleOpen,
  IconComponent,
  _scalePoints,
  getDisplayUIName,
  handleFineTuneChange,
  handleGridKeyDown,
  availableStyles,
  openGridFontStyleDropdownKey,
  setOpenGridFontStyleDropdownKey,
  gridDropdownsRef,
  emitUpdatePreview,
  selectedStyle,
  desktopScaleRatio,
  mobileScaleRatio,
  applyRoundingToSystem,
  showSpecLabels,
  namingConventionOptions,
  onStyleHover,
  showGrid,
  primaryFontFamily,
  primaryFontWeights,
  secondaryFontFamily,
  secondaryFontWeights,
  onStyleFontSourceChange,
  onStyleWeightChange,
  onStyleCustomFontChange,
  onStyleFontRelock,
  availableFonts,
  actualAvailableFontsList,
  onStylePreview,
  onStylePreviewStop,
  onStyleFontPreview,
  onStyleFontPreviewStop,
  onResetGridOverrides,
  showResetAllOverrides = false,
  baseSizeInPx = 16,
}: StylesGridSectionProps) {
  // --- Constants ---
  const SIZE_UNIT_OPTIONS = ['px', 'em', 'rem'] as const;
  const LINE_UNIT_OPTIONS = ['%', 'px', 'em', 'rem'] as const;
  const LETTER_UNIT_OPTIONS = ['%', 'px', 'em', 'rem'] as const;

  // --- Zustand store ---
  const {
    previewExists,
    lineHeightUnit,
    setLineHeightUnit,
    sizeUnit,
    setSizeUnit,
    letterSpacingUnit,
    setLetterSpacingUnit,
    roundingGridSize,
    namingConvention,
    setNamingConvention,
    styleVisibility,
    updateStyleVisibility,
    styleFontSources,
    generatorTab,
  } = useAppStore();

  // When on the dedicated "styles" tab, force the section open
  const isStandaloneTab = generatorTab === 'styles';
  const effectiveIsOpen = isStandaloneTab || isOpen;

  // --- Dropdown positioning state ---
  const [dropdownPosition, setDropdownPosition] = useState<{
    top?: number; bottom?: number; left?: number; right?: number;
  } | null>(null);
  const activeDropdownTriggerRef = useRef<HTMLButtonElement | null>(null);
  const dropdownListRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);

  // --- Drag-to-toggle visibility state ---
  const [isDragMode, setIsDragMode] = useState(false);
  const [dragAction, setDragAction] = useState<'show' | 'hide' | null>(null);
  const [processedItems, setProcessedItems] = useState<Set<string>>(new Set());
  const [dragStartY, setDragStartY] = useState<number>(0);
  const [lastDragDirection, setLastDragDirection] = useState<'up' | 'down' | null>(null);

  // --- Header dropdown state (naming + unit dropdowns in grid) ---
  const [isNamingDropdownOpen, setIsNamingDropdownOpen] = useState(false);
  const [isSizeUnitDropdownOpen, setIsSizeUnitDropdownOpen] = useState(false);
  const [isLineUnitDropdownOpen, setIsLineUnitDropdownOpen] = useState(false);
  const [isLetterUnitDropdownOpen, setIsLetterUnitDropdownOpen] = useState(false);
  const namingDropdownRef = useRef<HTMLDivElement>(null);
  const headerDropdownsRef = useRef<HTMLDivElement>(null);

  // Single-accordion: only one row can be expanded at a time
  const [expandedStyleKey, setExpandedStyleKey] = useState<string | null>(null);

  // ── Effects ──

  // Close header dropdowns (naming + unit) on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (namingDropdownRef.current && !namingDropdownRef.current.contains(target)) {
        setIsNamingDropdownOpen(false);
      }
      if (headerDropdownsRef.current && !headerDropdownsRef.current.contains(target)) {
        setIsSizeUnitDropdownOpen(false);
        setIsLineUnitDropdownOpen(false);
        setIsLetterUnitDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isNamingDropdownOpen, isSizeUnitDropdownOpen, isLineUnitDropdownOpen, isLetterUnitDropdownOpen]);

  // End drag on global mouse-up
  useEffect(() => {
    function handleDocumentMouseUp() {
      if (isDragMode) {
        setIsDragMode(false);
        setDragAction(null);
        setProcessedItems(new Set());
        setDragStartY(0);
        setLastDragDirection(null);
      }
    }
    document.addEventListener("mouseup", handleDocumentMouseUp);
    return () => document.removeEventListener("mouseup", handleDocumentMouseUp);
  }, [isDragMode]);

  // Close font/weight dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!openGridFontStyleDropdownKey) return;
      if (
        dropdownListRef.current &&
        !dropdownListRef.current.contains(event.target as Node) &&
        activeDropdownTriggerRef.current &&
        !activeDropdownTriggerRef.current.contains(event.target as Node)
      ) {
        setOpenGridFontStyleDropdownKey(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openGridFontStyleDropdownKey, setOpenGridFontStyleDropdownKey]);

  // Sync visibility changes → preview
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (previewExists) {
      const systemToUpdate = roundingGridSize > 0
        ? applyRoundingToSystem(fineTunedStyles, roundingGridSize)
        : fineTunedStyles;
      emitUpdatePreview(systemToUpdate);
    }
  }, [styleVisibility]);

  // Sync naming convention changes → preview
  useEffect(() => {
    if (isInitialMount.current) return;
    if (previewExists) {
      const systemToUpdate = roundingGridSize > 0
        ? applyRoundingToSystem(fineTunedStyles, roundingGridSize)
        : fineTunedStyles;
      emitUpdatePreview(systemToUpdate);
    }
  }, [namingConvention]);

  // ── Drag-to-toggle handlers ──

  const handleVisibilityMouseDown = (
    event: TargetedEvent<HTMLButtonElement, MouseEvent>,
    styleKey: string,
  ) => {
    event.preventDefault();
    setIsDragMode(true);
    setDragStartY(event.clientY);
    setProcessedItems(new Set([styleKey]));
    setDragAction(null);
    setLastDragDirection(null);
  };

  const handleRowMouseEnter = (
    styleKey: string,
    event?: TargetedEvent<HTMLDivElement, MouseEvent>,
  ) => {
    if (!isDragMode) return;
    const currentY = event?.clientY || 0;
    const deltaY = currentY - dragStartY;
    const threshold = 5;

    if (Math.abs(deltaY) > threshold) {
      const currentDirection = deltaY > 0 ? 'down' : 'up';
      const currentAction = currentDirection === 'down' ? 'hide' : 'show';

      if (lastDragDirection && lastDragDirection !== currentDirection) {
        setProcessedItems(new Set());
        setLastDragDirection(currentDirection);
        setDragAction(currentAction);
      } else if (!lastDragDirection) {
        setLastDragDirection(currentDirection);
        setDragAction(currentAction);
      }

      if (!processedItems.has(styleKey)) {
        updateStyleVisibility(styleKey, currentAction === 'show');
        setProcessedItems(prev => new Set([...Array.from(prev), styleKey]));
      }
    }
  };

  const handleVisibilityClick = (
    event: TargetedEvent<HTMLButtonElement, MouseEvent>,
    styleKey: string,
    currentVisibility: boolean,
    valueToShow: string,
  ) => {
    if (!isDragMode) {
      const newVisibility = !currentVisibility;
      updateStyleVisibility(styleKey, newVisibility);
    }
  };

  // ── Dropdown positioning ──

  const handleDropdownToggle = (
    event: TargetedEvent<HTMLButtonElement, MouseEvent>,
    key: string,
  ) => {
    if (openGridFontStyleDropdownKey === key) {
      setOpenGridFontStyleDropdownKey(null);
      setDropdownPosition(null);
    } else {
      const button = event.currentTarget;
      activeDropdownTriggerRef.current = button;
      const buttonRect = button.getBoundingClientRect();
      const gridRect = gridDropdownsRef.current?.getBoundingClientRect();

      const pluginMidpoint = window.innerHeight / 2;
      const opensUpward = buttonRect.top > pluginMidpoint;

      const position: { top?: number; bottom?: number; left?: number; right?: number } = {};
      if (opensUpward) {
        position.bottom = window.innerHeight - buttonRect.top;
      } else {
        position.top = buttonRect.bottom;
      }
      if (gridRect) {
        position.right = window.innerWidth - gridRect.right;
      }

      setDropdownPosition(position);
      setOpenGridFontStyleDropdownKey(key);
    }
  };

  // ── Sorted styles ──

  const sortedStyles = useMemo(
    () =>
      Object.keys(fineTunedStyles).sort(
        (a, b) =>
          (VISUAL_DISPLAY_ORDER[b] ?? 0) - (VISUAL_DISPLAY_ORDER[a] ?? 0),
      ),
    [fineTunedStyles],
  );

  // ── Render ──

  return (
    <div className={isStandaloneTab ? 'styles-tab-content' : `section fine-tune-section ${effectiveIsOpen ? 'section-open' : ''}`}>
      {/* ── Section header ── */}
      {!isStandaloneTab ? (
        <div
          className="section-header"
          tabIndex={0}
          role="button"
          onClick={onToggleOpen}
          onKeyDown={(e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToggleOpen();
            }
          }}
        >
          <div className="section-header-titles-container section-header-left">
            <IconComponent
              name="navigate-forward-24"
              size={24}
              className={`section-header-chevron ${effectiveIsOpen ? 'open' : ''}`}
            />
            <span className="section-title">Styles</span>
          </div>
          <div className="styles-header-actions">
            {showResetAllOverrides && (
              <button
                type="button"
                className="button-secondary-new"
                onClick={(e) => {
                  e.stopPropagation();
                  onResetGridOverrides();
                }}
              >
                Reset overrides
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="section-header">
          <div className="section-header-titles-container section-header-left">
            <span className="section-title">Styles</span>
          </div>
          <div className="styles-header-actions">
            {showResetAllOverrides && (
              <button
                type="button"
                className="button-secondary-new"
                onClick={onResetGridOverrides}
              >
                Reset overrides
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Section content — grid ── */}
      {effectiveIsOpen && (
        <div className={isStandaloneTab ? 'styles-tab-content__inner' : 'section-content'} style={isStandaloneTab ? undefined : { paddingBottom: 'var(--sizing-default-spacers-spacer-2)' }}>
          <div
            className={`styles-grid ${isDragMode ? 'styles-grid--dragging' : ''} ${isFluidMode ? 'styles-grid--fluid' : ''}`}
            ref={gridDropdownsRef}
          >
            {/* Header row — naming + unit dropdowns */}
            <div className="grid-header-row" ref={headerDropdownsRef}>
              {/* Col 1: Naming convention */}
              <div className="grid-header-cell" ref={namingDropdownRef}>
                <div className="custom-dropdown-container">
                  <button
                    className="dropdown-trigger-button dropdown-trigger-secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = !isNamingDropdownOpen;
                      if (next) {
                        setIsSizeUnitDropdownOpen(false);
                        setIsLineUnitDropdownOpen(false);
                        setIsLetterUnitDropdownOpen(false);
                      }
                      setIsNamingDropdownOpen(next);
                    }}
                  >
                    <IconComponent name="chevron-down-16" size={16} />
                    <span className="dropdown-trigger-label">{namingConvention}</span>
                  </button>
                  {isNamingDropdownOpen && (
                    <div
                      className="dropdown-list convention-dropdown-list dropdown-list--opens-down"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <div className="dropdown-items-container">
                        {namingConventionOptions.map(option => (
                          <button
                            key={option}
                            className={`dropdown-item ${namingConvention === option ? 'selected' : ''}`}
                            onMouseDown={() => {
                              setNamingConvention(option);
                              setIsNamingDropdownOpen(false);
                            }}
                          >
                            <span className="dropdown-item-text-content">{option}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {isFluidMode && (
                <div className="grid-header text-xs">
                  Size min <span className="grid-header-unit">px</span>
                </div>
              )}
              {/* Size unit */}
              <div className="grid-header-cell">
                <div className="custom-dropdown-container">
                  <button
                    className="dropdown-trigger-button dropdown-trigger-secondary"
                    onClick={() => {
                      const next = !isSizeUnitDropdownOpen;
                      if (next) {
                        setIsNamingDropdownOpen(false);
                        setIsLineUnitDropdownOpen(false);
                        setIsLetterUnitDropdownOpen(false);
                      }
                      setIsSizeUnitDropdownOpen(next);
                    }}
                  >
                    <IconComponent name="chevron-down-16" size={16} />
                    <span className="dropdown-trigger-label">Size {sizeUnit}</span>
                  </button>
                  {isSizeUnitDropdownOpen && (
                    <div className="dropdown-list dropdown-list--opens-down" onMouseDown={(e) => e.preventDefault()}>
                      <div className="dropdown-items-container">
                        {SIZE_UNIT_OPTIONS.map(unit => (
                          <button
                            key={unit}
                            className={`dropdown-item ${sizeUnit === unit ? 'selected' : ''}`}
                            onMouseDown={() => { setSizeUnit(unit); setIsSizeUnitDropdownOpen(false); }}
                          >
                            <span className="dropdown-item-text-content">{unit}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {/* Line unit */}
              <div className="grid-header-cell">
                <div className="custom-dropdown-container">
                  <button
                    className="dropdown-trigger-button dropdown-trigger-secondary"
                    onClick={() => {
                      const next = !isLineUnitDropdownOpen;
                      if (next) {
                        setIsNamingDropdownOpen(false);
                        setIsSizeUnitDropdownOpen(false);
                        setIsLetterUnitDropdownOpen(false);
                      }
                      setIsLineUnitDropdownOpen(next);
                    }}
                  >
                    <IconComponent name="chevron-down-16" size={16} />
                    <span className="dropdown-trigger-label">
                      Line {lineHeightUnit === 'percent' ? '%' : lineHeightUnit}
                    </span>
                  </button>
                  {isLineUnitDropdownOpen && (
                    <div className="dropdown-list dropdown-list--opens-down" onMouseDown={(e) => e.preventDefault()}>
                      <div className="dropdown-items-container">
                        {LINE_UNIT_OPTIONS.map(unit => (
                          <button
                            key={unit}
                            className={`dropdown-item ${(lineHeightUnit === 'percent' ? unit === '%' : lineHeightUnit === unit) ? 'selected' : ''}`}
                            onMouseDown={() => {
                              setLineHeightUnit(unit === '%' ? 'percent' : unit as 'px' | 'em' | 'rem');
                              setIsLineUnitDropdownOpen(false);
                            }}
                          >
                            <span className="dropdown-item-text-content">{unit}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {/* Letter unit */}
              <div className="grid-header-cell">
                <div className="custom-dropdown-container">
                  <button
                    className="dropdown-trigger-button dropdown-trigger-secondary"
                    onClick={() => {
                      const next = !isLetterUnitDropdownOpen;
                      if (next) {
                        setIsNamingDropdownOpen(false);
                        setIsSizeUnitDropdownOpen(false);
                        setIsLineUnitDropdownOpen(false);
                      }
                      setIsLetterUnitDropdownOpen(next);
                    }}
                  >
                    <IconComponent name="chevron-down-16" size={16} />
                    <span className="dropdown-trigger-label">
                      Letter {letterSpacingUnit === 'percent' ? '%' : letterSpacingUnit}
                    </span>
                  </button>
                  {isLetterUnitDropdownOpen && (
                    <div className="dropdown-list dropdown-list--opens-down dropdown-list--align-right" onMouseDown={(e) => e.preventDefault()}>
                      <div className="dropdown-items-container">
                        {LETTER_UNIT_OPTIONS.map(unit => (
                          <button
                            key={unit}
                            className={`dropdown-item ${(letterSpacingUnit === 'percent' ? unit === '%' : letterSpacingUnit === unit) ? 'selected' : ''}`}
                            onMouseDown={() => {
                              setLetterSpacingUnit(unit === '%' ? 'percent' : unit as 'px' | 'em' | 'rem');
                              setIsLetterUnitDropdownOpen(false);
                            }}
                          >
                            <span className="dropdown-item-text-content">{unit}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="grid-header text-xs"></div>
              <div className="grid-header text-xs"></div>
            </div>

            {/* Style rows */}
            {sortedStyles.map((styleKey, rowIndex) => {
              const style = fineTunedStyles[styleKey];
              if (!style) return null;
              const mobileStyle =
                isFluidMode && mobileStyles ? mobileStyles[styleKey] ?? null : null;

              return (
                <StylesGridRow
                  key={styleKey}
                  styleKey={styleKey}
                  style={style}
                  mobileStyle={mobileStyle}
                  isFluidMode={isFluidMode}
                  rowIndex={rowIndex}
                  totalRows={sortedStyles.length}
                  isDragMode={isDragMode}
                  isExpanded={expandedStyleKey === styleKey}
                  onToggleExpand={() => setExpandedStyleKey(expandedStyleKey === styleKey ? null : styleKey)}
                  getDisplayUIName={getDisplayUIName}
                  handleFineTuneChange={handleFineTuneChange}
                  handleGridKeyDown={handleGridKeyDown}
                  onStyleHover={onStyleHover}
                  onVisibilityMouseDown={handleVisibilityMouseDown}
                  onVisibilityClick={handleVisibilityClick}
                  onRowMouseEnter={handleRowMouseEnter}
                  IconComponent={IconComponent}
                  primaryFontFamily={primaryFontFamily}
                  secondaryFontFamily={secondaryFontFamily}
                  primaryFontWeights={primaryFontWeights}
                  secondaryFontWeights={secondaryFontWeights}
                  availableFonts={availableFonts}
                  actualAvailableFontsList={actualAvailableFontsList}
                  onStyleFontSourceChange={(source) =>
                    onStyleFontSourceChange(styleKey, source)
                  }
                  onStyleWeightChange={(weight) =>
                    onStyleWeightChange(styleKey, weight)
                  }
                  onStyleCustomFontChange={(fontFamily: string) =>
                    onStyleCustomFontChange(styleKey, fontFamily)
                  }
                  onStyleFontRelock={() =>
                    onStyleFontRelock(styleKey)
                  }
                  onStyleFontPreview={onStyleFontPreview
                    ? (fontFamily: string) => onStyleFontPreview(styleKey, fontFamily)
                    : undefined
                  }
                  onStyleFontPreviewStop={onStyleFontPreviewStop
                    ? () => onStyleFontPreviewStop(styleKey)
                    : undefined
                  }
                  onDropdownToggle={handleDropdownToggle}
                  baseSizeInPx={baseSizeInPx}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Font weight dropdown portal (fixed-position) ── */}
      {openGridFontStyleDropdownKey && dropdownPosition && (
        <div
          ref={dropdownListRef}
          className="dropdown-list dropdown-list--opens-down grid-font-style-dropdown-list"
          style={{
            position: 'fixed',
            top: dropdownPosition.top !== undefined ? `${dropdownPosition.top}px` : 'auto',
            bottom: dropdownPosition.bottom !== undefined ? `${dropdownPosition.bottom}px` : 'auto',
            left: 'auto',
            right: dropdownPosition.right !== undefined ? `${dropdownPosition.right}px` : 'auto',
          }}
          onMouseDown={(e) => e.preventDefault()}
          onMouseLeave={() => {
            if (onStylePreviewStop && openGridFontStyleDropdownKey) {
              onStylePreviewStop(openGridFontStyleDropdownKey);
            }
          }}
        >
          {(() => {
            const dropdownSource = styleFontSources[openGridFontStyleDropdownKey] || 'primary';
            const isCustomSource = dropdownSource === 'custom';
            const customWeights = isCustomSource
              ? actualAvailableFontsList
                  .filter(f => f.family === fineTunedStyles[openGridFontStyleDropdownKey]?.fontFamily)
                  .map(f => f.style)
              : [];
            return (
              <FontSourceDropdownContent
                currentFontSource={dropdownSource}
                currentWeight={fineTunedStyles[openGridFontStyleDropdownKey]?.fontStyle || "Regular"}
                primaryFontWeights={isCustomSource ? customWeights : primaryFontWeights}
                secondaryFontWeights={isCustomSource ? customWeights : secondaryFontWeights}
                onFontSourceChange={(source) => {
                  onStyleFontSourceChange(openGridFontStyleDropdownKey, source);
                }}
                onWeightChange={(weight) => {
                  onStyleWeightChange(openGridFontStyleDropdownKey, weight);
                  setOpenGridFontStyleDropdownKey(null);
                }}
                startWeightPreview={
                  onStylePreview
                    ? (weight: string) => onStylePreview(openGridFontStyleDropdownKey, weight)
                    : undefined
                }
                stopWeightPreview={
                  onStylePreviewStop
                    ? () => onStylePreviewStop(openGridFontStyleDropdownKey)
                    : undefined
                }
                getEffectiveWeight={() =>
                  fineTunedStyles[openGridFontStyleDropdownKey]?.fontStyle || "Regular"
                }
              />
            );
          })()}
        </div>
      )}
    </div>
  );
}
