import { h } from "preact";
import { TargetedEvent } from 'preact/compat';
import { useState, useMemo, useRef, useEffect } from "preact/hooks"; 
import { TEXT_CASE_OPTIONS } from '../../core/constants';
import { useAppStore } from '../store/appStore';

// Assuming Icon is exported from ui.tsx or a central export point and passed as IconComponent
// import { Icon } from "../ui"; 

interface FontControlSectionProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  IconComponent: ({ name, className, size }: { name: string; className?: string; size?: number; }) => preact.JSX.Element;
  fontFamily: string;
  setFontFamily: (family: string) => void;
  selectedStyle: string;
  setSelectedStyle: (style: string) => void;
  emit: (eventName: string, payload?: any) => void; // For GET_STYLES_FOR_FAMILY
  availableFonts: string[]; // Now needs the full list
  availableStyles: string[];
  // showGoogleFonts is now managed by Zustand store
  googleFontsList: string[];
  // previewExists is now managed by Zustand store
  textSelectionButtonMode: 'select' | 'reset';
  handleSelectOrResetClick: () => void;
  // activeFlow is now managed by Zustand store (not used in this component)
  
  // Preview functionality
  previewFontFamily: string | null;
  isPreviewMode: boolean;
  startFontPreview: (font: string) => void;
  stopFontPreview: () => void;
  commitPreviewFont: (font: string) => void;
  getEffectiveFontFamily: () => string;
  
  // Weight preview functionality
  previewWeight: string | null;
  isWeightPreviewMode: boolean;
  startWeightPreview: (weight: string) => void;
  stopWeightPreview: () => void;
  commitPreviewWeight: (weight: string) => void;
  getEffectiveWeight: () => string;
  globalTextCase?: string;
  onGlobalTextCaseChange?: (value: string) => void;
}

export function FontControlSection({
  isOpen,
  onToggleOpen,
  IconComponent,
  fontFamily,
  setFontFamily,
  availableStyles,
  availableFonts, // Receive full list
  selectedStyle,
  setSelectedStyle,
  emit,
  // showGoogleFonts is from Zustand store
  googleFontsList,
  // previewExists is from Zustand store
  textSelectionButtonMode,
  handleSelectOrResetClick,
  // activeFlow removed - now in Zustand, not used here
  // Preview functionality
  previewFontFamily,
  isPreviewMode,
  startFontPreview,
  stopFontPreview,
  commitPreviewFont,
  getEffectiveFontFamily,
  // Weight preview functionality
  previewWeight,
  isWeightPreviewMode,
  startWeightPreview,
  stopWeightPreview,
  commitPreviewWeight,
  getEffectiveWeight,
  globalTextCase = 'Original',
  onGlobalTextCaseChange,
}: FontControlSectionProps) {
  // Get state from Zustand store
  const { previewExists, showGoogleFonts, setShowGoogleFonts } = useAppStore();

  // --- Internal State Management ---
  const [fontSearchText, setFontSearchText] = useState("");
  const [isFontListOpen, setIsFontListOpen] = useState(false);
  const [isFontStyleListOpen, setIsFontStyleListOpen] = useState(false);
  const [isCaseDropdownOpen, setIsCaseDropdownOpen] = useState(false);

  const fontSearchInputRef = useRef<HTMLInputElement>(null);
  const fontDropdownContainerRef = useRef<HTMLDivElement>(null);
  const dropdownItemsContainerRef = useRef<HTMLDivElement>(null);
  const fontStyleDropdownContainerRef = useRef<HTMLDivElement>(null);
  const caseDropdownContainerRef = useRef<HTMLDivElement>(null);

  const filteredFonts = useMemo(() => {
    if (!fontSearchText) {
      return availableFonts;
    }
    const lowerSearchText = fontSearchText.toLowerCase();
    return availableFonts.filter(font => 
      font.toLowerCase().includes(lowerSearchText)
    );
  }, [fontSearchText, availableFonts]);
  // --- End Internal State ---

  // <<< MOVED UseEffect to Focus Search Input >>>
  useEffect(() => {
    if (isFontListOpen && fontSearchInputRef.current) {
      setTimeout(() => fontSearchInputRef.current?.focus(), 0);
    }
  }, [isFontListOpen]);
  // <<< END MOVED >>>

  // <<< MOVED UseEffect to Handle Outside Click for Font Family Dropdown >>>
  useEffect(() => {
    if (!isFontListOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (fontDropdownContainerRef.current && !fontDropdownContainerRef.current.contains(event.target as Node)) {
        setIsFontListOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isFontListOpen]);
  // <<< END MOVED >>>

  // <<< MOVED UseEffect to Scroll Selected Font Into View >>>
  useEffect(() => {
    if (isFontListOpen && dropdownItemsContainerRef.current) {
      setTimeout(() => {
        const container = dropdownItemsContainerRef.current;
        if (!container) return;
        
        if (fontSearchText) {
          // When searching, scroll to the first filtered result (alphabetically first)
          const firstItem = container.querySelector('.dropdown-item:first-child') as HTMLElement | null;
          if (firstItem) {
            firstItem.scrollIntoView({
              block: 'nearest',
              inline: 'nearest'
            });
          }
        } else {
          // When not searching, scroll to the currently selected font
          const selectedItem = container.querySelector('.dropdown-item.selected') as HTMLElement | null;
          if (selectedItem) {
            selectedItem.scrollIntoView({
              block: 'nearest',
              inline: 'nearest'
            });
          } else {
            container.scrollTop = 0;
          }
        }
      }, 50);
    }
  }, [isFontListOpen, fontFamily, fontSearchText]);
  // <<< END MOVED >>>

  // <<< MOVED UseEffect to Handle Outside Click for Font Style List >>>
  useEffect(() => {
    if (!isFontStyleListOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (fontStyleDropdownContainerRef.current && !fontStyleDropdownContainerRef.current.contains(event.target as Node)) {
        setIsFontStyleListOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isFontStyleListOpen]);
  // <<< END MOVED >>>

  // Stop font preview when dropdown closes
  useEffect(() => {
    if (!isFontListOpen && isPreviewMode) {
      console.log(`[FontControlSection] Dropdown closed, stopping preview`);
      stopFontPreview();
    }
  }, [isFontListOpen, isPreviewMode, stopFontPreview]);

  // Stop weight preview when dropdown closes
  useEffect(() => {
    if (!isFontStyleListOpen && isWeightPreviewMode) {
      console.log(`[FontControlSection] Weight dropdown closed, stopping weight preview`);
      stopWeightPreview();
    }
  }, [isFontStyleListOpen, isWeightPreviewMode, stopWeightPreview]);

  useEffect(() => {
    if (!isCaseDropdownOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (caseDropdownContainerRef.current && !caseDropdownContainerRef.current.contains(event.target as Node)) {
        setIsCaseDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isCaseDropdownOpen]);

  const currentCaseLabel = TEXT_CASE_OPTIONS.find(o => o.value === globalTextCase)?.label ?? (globalTextCase === 'Mixed' ? '~' : '\u2014');

  return (
    <div className={`section font-section ${isOpen ? 'section-open' : ''}`}>
      <div className="section-header" tabIndex={0} role="button" onClick={onToggleOpen} onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleOpen(); } }}>
        <div className="section-header-titles-container section-header-left">
          <IconComponent name="navigate-forward-24" size={24} className={`section-header-chevron ${isOpen ? 'open' : ''}`} />
          <span className="section-title">Text</span>
        </div>
        {/* Font Family Dropdown moved into the header from ui.tsx */}
        <div className="header-section-dropdown-container"> 
          <div
            ref={fontDropdownContainerRef}
            className="custom-dropdown-container font-family-dropdown font-family-dropdown-in-header"
          >
            <button
              className="input dropdown-trigger-button"
              onClick={(e) => {
                e.stopPropagation();
                setIsFontListOpen(!isFontListOpen);
                if (!isFontListOpen) {
                  setFontSearchText("");
                }
              }}
              disabled={textSelectionButtonMode === 'reset'}
            >
              <span className={`dropdown-trigger-label ${textSelectionButtonMode === 'reset' ? 'is-disabled' : ''}`}>
                {getEffectiveFontFamily()}
              </span>
            </button>
            {isFontListOpen && (
              <div
                className="dropdown-list dropdown-list--opens-down font-family-dropdown-list"
                onMouseDown={(e) => e.preventDefault()}
                onMouseLeave={() => {
                  // Stop preview when leaving the entire dropdown
                  if (isPreviewMode) {
                    console.log(`[FontControlSection] PREVIEW LEAVE DROPDOWN`);
                    stopFontPreview();
                  }
                }}
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
                    onDblClick={(e) => e.currentTarget.select()}
                    placeholder="Search fonts..."
                  />
                </div>
                {/* --- NEW: Google Fonts Toggle --- */}
                <div 
                  className="google-fonts-toggle-row"
                  onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
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
                {/* --- END NEW --- */}
                <div className="search-divider"></div>
                <div
                  ref={dropdownItemsContainerRef}
                  className="dropdown-items-container" // Corrected class to className
                >
                  {filteredFonts.length > 0 ? (
                    filteredFonts.map(font => (
                      <button
                        key={font}
                        className={`dropdown-item ${font === getEffectiveFontFamily() ? 'selected' : ''}`}
                        onMouseEnter={() => {
                          // Start preview on hover (debounced)
                          if (font !== getEffectiveFontFamily()) {
                            console.log(`[FontControlSection] PREVIEW HOVER: ${font}`);
                            startFontPreview(font);
                          }
                        }}
                        onMouseDown={() => {
                          console.log(`[FontControlSection] COMMIT FONT: ${font}`);
                          // Commit the font selection
                          commitPreviewFont(font);
                          setFontSearchText("");
                          setIsFontListOpen(false);
                        }}
                      >
                        <span className="dropdown-item-text-content">
                          {font}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="dropdown-item no-results">No matching fonts</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {isOpen && (
        <div className="section-content font-section-content">
          {/* Font Style Dropdown remains in content, now with an empty label for spacing */}
          <div className="control-row font-selection-control-row control-row-no-left-padding">
            <label className="control-label" style={{ paddingLeft: 'calc(var(--size-icon-size) + var(--sizing-default-spacers-spacer-2))' }}>Weight</label>
            <div
              ref={fontStyleDropdownContainerRef}
              className="custom-dropdown-container font-style-dropdown"
            >
              <button
                className="input dropdown-trigger-button font-style-trigger-button"
                onClick={() => setIsFontStyleListOpen(!isFontStyleListOpen)}
                disabled={availableStyles.length <= 1 || textSelectionButtonMode === 'reset'}
              >
                <span className={`dropdown-trigger-label ${availableStyles.length <= 1 || textSelectionButtonMode === 'reset' ? 'is-disabled' : ''}`}>
                  {getEffectiveWeight()}
                  {isWeightPreviewMode && <span style={{opacity: 0.6}}> (preview)</span>}
                </span>
              </button>
              {isFontStyleListOpen && (
                <div
                  className="dropdown-list dropdown-list--opens-down font-style-dropdown-list"
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseLeave={() => {
                    // Stop preview when leaving the entire dropdown
                    if (isWeightPreviewMode) {
                      console.log(`[FontControlSection] WEIGHT PREVIEW LEAVE DROPDOWN`);
                      stopWeightPreview();
                    }
                  }}
                >
                  <div className="dropdown-items-container font-style-items-container"> {/* Corrected class to className */}
                    {availableStyles.map((style: string) => (
                      <button
                        key={style}
                        className={`dropdown-item ${style === getEffectiveWeight() ? 'selected' : ''}`}
                        onMouseEnter={() => {
                          // Start preview on hover (debounced)
                          if (style !== getEffectiveWeight()) {
                            console.log(`[FontControlSection] WEIGHT PREVIEW HOVER: ${style}`);
                            startWeightPreview(style);
                          }
                        }}
                        onMouseDown={() => {
                          console.log(`[FontControlSection] COMMIT WEIGHT: ${style}`);
                          // Commit the weight selection
                          commitPreviewWeight(style);
                          setIsFontStyleListOpen(false);
                        }}
                      >
                        <span className="dropdown-item-text-content">{style}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Case dropdown row */}
          <div className="control-row font-selection-control-row control-row-no-left-padding">
            <label className="control-label" style={{ paddingLeft: 'calc(var(--size-icon-size) + var(--sizing-default-spacers-spacer-2))' }}>Case</label>
            <div
              ref={caseDropdownContainerRef}
              className="custom-dropdown-container font-style-dropdown"
            >
              <button
                className="input dropdown-trigger-button font-style-trigger-button"
                onClick={() => setIsCaseDropdownOpen(!isCaseDropdownOpen)}
                disabled={textSelectionButtonMode === 'reset'}
              >
                <span className={`dropdown-trigger-label ${textSelectionButtonMode === 'reset' ? 'is-disabled' : ''}`}>{currentCaseLabel}</span>
              </button>
              {isCaseDropdownOpen && (
                <div
                  className="dropdown-list dropdown-list--opens-down font-style-dropdown-list"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <div className="dropdown-items-container font-style-items-container">
                    {TEXT_CASE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        className={`dropdown-item ${globalTextCase === opt.value ? 'selected' : ''}`}
                        onMouseDown={() => {
                          onGlobalTextCaseChange?.(opt.value);
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
          </div>
        </div>
      )}
    </div>
  );
} 