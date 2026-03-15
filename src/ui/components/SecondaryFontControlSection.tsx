import { h } from "preact";
import { TargetedEvent } from 'preact/compat';
import { useState, useMemo, useRef, useEffect } from "preact/hooks"; 
import { TEXT_CASE_OPTIONS } from '../../core/constants';
import { useAppStore } from '../store/appStore';

// Assuming Icon is exported from ui.tsx or a central export point and passed as IconComponent
// import { Icon } from "../ui"; 

interface SecondaryFontControlSectionProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  IconComponent: ({ name, className, size }: { name: string; className?: string; size?: number; }) => preact.JSX.Element;
  
  // Secondary font specific props
  secondaryFontEnabled: boolean;
  setSecondaryFontEnabled: (enabled: boolean) => void;
  secondaryFontLinked: boolean;
  setSecondaryFontLinked: (linked: boolean) => void;
  toggleSecondaryFontLinked: () => void;
  secondaryWeightLinked: boolean;
  setSecondaryWeightLinked: (linked: boolean) => void;
  toggleSecondaryWeightLinked: () => void;
  secondaryFontFamily: string;
  setSecondaryFontFamily: (family: string) => void;
  secondarySelectedStyle: string;
  setSecondarySelectedStyle: (style: string) => void;
  
  // Shared props
  emit: (eventName: string, payload?: any) => void;
  availableFonts: string[];
  secondaryAvailableStyles: string[];
  // showGoogleFonts is now managed by Zustand store
  googleFontsList: string[]; // List of Google Font names for filtering
  // previewExists is now managed by Zustand store
  textSelectionButtonMode: 'select' | 'reset';
  handleSelectOrResetClick: () => void;
  // activeFlow is now managed by Zustand store (not used in this component)
  
  // Preview functionality for secondary font
  previewSecondaryFontFamily: string | null;
  isSecondaryPreviewMode: boolean;
  startSecondaryFontPreview: (font: string) => void;
  stopSecondaryFontPreview: () => void;
  commitSecondaryPreviewFont: (font: string) => void;
  getEffectiveSecondaryFontFamily: () => string;
  
  // Weight preview functionality for secondary weight
  previewSecondaryWeight: string | null;
  isSecondaryWeightPreviewMode: boolean;
  startSecondaryWeightPreview: (weight: string) => void;
  stopSecondaryWeightPreview: () => void;
  commitSecondaryPreviewWeight: (weight: string) => void;
  getEffectiveSecondaryWeight: () => string;
  inactive?: boolean;
  globalTextCase?: string;
  onGlobalTextCaseChange?: (value: string) => void;
}

export function SecondaryFontControlSection({
  isOpen,
  onToggleOpen,
  IconComponent,
  secondaryFontEnabled,
  setSecondaryFontEnabled,
  secondaryFontLinked,
  setSecondaryFontLinked,
  toggleSecondaryFontLinked,
  secondaryWeightLinked,
  setSecondaryWeightLinked,
  toggleSecondaryWeightLinked,
  secondaryFontFamily,
  setSecondaryFontFamily,
  secondarySelectedStyle,
  setSecondarySelectedStyle,
  availableFonts,
  secondaryAvailableStyles,
  emit,
  // showGoogleFonts is from Zustand store
  googleFontsList,
  // previewExists is from Zustand store
  textSelectionButtonMode,
  handleSelectOrResetClick,
  // activeFlow removed - now in Zustand, not used here
  // Preview functionality
  previewSecondaryFontFamily,
  isSecondaryPreviewMode,
  startSecondaryFontPreview,
  stopSecondaryFontPreview,
  commitSecondaryPreviewFont,
  getEffectiveSecondaryFontFamily,
  // Weight preview functionality
  previewSecondaryWeight,
  isSecondaryWeightPreviewMode,
  startSecondaryWeightPreview,
  stopSecondaryWeightPreview,
  commitSecondaryPreviewWeight,
  getEffectiveSecondaryWeight,
  inactive = false,
  globalTextCase = 'Original',
  onGlobalTextCaseChange,
}: SecondaryFontControlSectionProps) {
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

  // Always show real fonts in dropdown (never show "--None--" as an option)
  const filteredFonts = useMemo(() => {
    let fonts = availableFonts;
    
    // Filter by search text
    if (fontSearchText) {
      const lowerSearchText = fontSearchText.toLowerCase();
      fonts = fonts.filter(f => f.toLowerCase().includes(lowerSearchText));
    }
    
    return fonts;
  }, [fontSearchText, availableFonts]);

  const currentDisplayFont = secondaryFontEnabled ? getEffectiveSecondaryFontFamily() : '--None--';
  
  // --- End Internal State ---

  // UseEffect to Focus Search Input
  useEffect(() => {
    if (isFontListOpen && fontSearchInputRef.current) {
      setTimeout(() => fontSearchInputRef.current?.focus(), 0);
    }
  }, [isFontListOpen]);

  // UseEffect to Handle Outside Click for Font Family Dropdown
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

  // UseEffect to Scroll Selected Font Into View
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
  }, [isFontListOpen, currentDisplayFont, fontSearchText]);

  // UseEffect to Handle Outside Click for Font Style List
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

  // Stop font preview when dropdown actually closes (not when preview state changes)
  const previousFontListOpen = useRef(isFontListOpen);
  useEffect(() => {
    const wasOpen = previousFontListOpen.current;
    const isNowClosed = !isFontListOpen;
    
    // Only stop preview if dropdown went from open to closed
    if (wasOpen && isNowClosed && isSecondaryPreviewMode) {
      console.log(`[SecondaryFontControlSection] Dropdown closed, stopping preview`);
      stopSecondaryFontPreview();
    }
    
    previousFontListOpen.current = isFontListOpen;
  }, [isFontListOpen, isSecondaryPreviewMode, stopSecondaryFontPreview]);

  // Stop weight preview when dropdown closes  
  const previousFontStyleListOpen = useRef(isFontStyleListOpen);
  useEffect(() => {
    const wasOpen = previousFontStyleListOpen.current;
    const isNowClosed = !isFontStyleListOpen;
    
    // Only stop preview if dropdown went from open to closed
    if (wasOpen && isNowClosed && isSecondaryWeightPreviewMode) {
      console.log(`[SecondaryFontControlSection] Weight dropdown closed, stopping weight preview`);
      stopSecondaryWeightPreview();
    }
    
    previousFontStyleListOpen.current = isFontStyleListOpen;
  }, [isFontStyleListOpen, isSecondaryWeightPreviewMode, stopSecondaryWeightPreview]);

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

  const handleFontSelection = (font: string) => {
    if (font === '--None--') {
      setSecondaryFontEnabled(false);
    } else {
      setSecondaryFontEnabled(true);
      setSecondaryFontFamily(font);
      
      // If user manually selects a different secondary font, automatically unlink BOTH font and weight
      // Different fonts have different available weights, so weight linking would break
      if (secondaryFontLinked) {
        setSecondaryFontLinked(false);
      }
      if (secondaryWeightLinked) {
        setSecondaryWeightLinked(false);
      }
      
      // Always request styles for the newly selected font
      emit("GET_STYLES_FOR_FAMILY", font);
    }
    setFontSearchText("");
    setIsFontListOpen(false);
  };
  // <<< END MOVED >>>

  return (
    <div className={`section font-section secondary-font-section ${isOpen ? 'section-open' : ''} ${inactive ? 'section--inactive' : ''}`}>
      <div className="section-header" tabIndex={0} role="button" onClick={onToggleOpen} onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleOpen(); } }}>
        <div className="section-header-titles-container section-header-left">
          <IconComponent name="navigate-forward-24" size={24} className={`section-header-chevron ${isOpen ? 'open' : ''}`} />
          <span className="section-title">Heading</span>
        </div>
        {/* Secondary Font Family Dropdown */}
        <div className="header-section-dropdown-container"> 
          <div
            ref={fontDropdownContainerRef}
            className="custom-dropdown-container font-family-dropdown font-family-dropdown-in-header secondary-font-dropdown"
          >
            <button
              className="input dropdown-trigger-button"
              onClick={(e) => {
                if (inactive) return;
                e.stopPropagation();
                // Only allow opening dropdown if not linked or reset mode
                if (!secondaryFontLinked && textSelectionButtonMode !== 'reset') {
                  setIsFontListOpen(!isFontListOpen);
                  if (!isFontListOpen) {
                    setFontSearchText("");
                  }
                }
              }}
              disabled={textSelectionButtonMode === 'reset' || secondaryFontLinked || inactive}
            >
              <span className={`dropdown-trigger-label ${textSelectionButtonMode === 'reset' || secondaryFontLinked ? 'is-disabled' : ''}`}>
                {currentDisplayFont}
                {isSecondaryPreviewMode && <span style={{opacity: 0.6}}> (preview)</span>}
              </span>
            </button>
            {isFontListOpen && (
              <div
                className="dropdown-list dropdown-list--opens-down font-family-dropdown-list"
                onMouseDown={(e) => e.preventDefault()}
                onMouseLeave={() => {
                  // Stop preview when leaving the entire dropdown
                  if (isSecondaryPreviewMode) {
                    console.log(`[SecondaryFontControlSection] PREVIEW LEAVE DROPDOWN`);
                    stopSecondaryFontPreview();
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
                {/* Google Fonts Toggle */}
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
                <div className="search-divider"></div>
                <div
                  ref={dropdownItemsContainerRef}
                  className="dropdown-items-container"
                >
                  {filteredFonts.length > 0 ? (
                    filteredFonts.map((font: string) => (
                      <button
                        key={font}
                        className={`dropdown-item ${font === currentDisplayFont ? 'selected' : ''}`}
                        onMouseEnter={() => {
                          // Start preview on hover (debounced)
                          if (font !== currentDisplayFont) {
                            console.log(`[SecondaryFontControlSection] PREVIEW HOVER: ${font}`);
                            startSecondaryFontPreview(font);
                          }
                        }}
                        onMouseDown={() => {
                          console.log(`[SecondaryFontControlSection] COMMIT FONT: ${font}`);
                          // Commit the font selection
                          commitSecondaryPreviewFont(font);
                          setFontSearchText("");
                          setIsFontListOpen(false);
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
          </div>
          <button 
            className="ghost-button"
            onClick={(e) => {
              if (inactive) return;
              e.stopPropagation();
              toggleSecondaryFontLinked();
            }}
            title={secondaryFontLinked ? "Unlink secondary font" : "Link secondary font to primary"}
          >
            <IconComponent 
              name={secondaryFontLinked ? "link-connected-24" : "link-broken-24"} 
              size={24} 
              className="section-header-icon" 
            />
          </button>
        </div>
      </div>
      {isOpen && (
        <div className="section-content font-section-content">
          {/* Font Style Dropdown remains in content, now with an empty label for spacing */}
          <div className="control-row font-selection-control-row control-row-no-left-padding">
            <label className="control-label" style={{ paddingLeft: 'calc(var(--size-icon-size) + var(--sizing-default-spacers-spacer-2))' }}>Weight</label>
            <div className="font-style-dropdown-with-icon">
              <div
                ref={fontStyleDropdownContainerRef}
                className="custom-dropdown-container font-style-dropdown font-style-dropdown-in-header secondary-weight-dropdown"
              >
                <button
                  className="input dropdown-trigger-button"
                  onClick={() => {
                    if (inactive) return;
                    setIsFontStyleListOpen(!isFontStyleListOpen);
                  }}
                  disabled={secondaryAvailableStyles.length <= 1 || textSelectionButtonMode === 'reset' || !secondaryFontEnabled || secondaryWeightLinked || inactive}
                >
                  <span className={`dropdown-trigger-label ${secondaryAvailableStyles.length <= 1 || textSelectionButtonMode === 'reset' || !secondaryFontEnabled || secondaryWeightLinked ? 'is-disabled' : ''}`}>
                    {secondaryFontEnabled ? getEffectiveSecondaryWeight() : '--None--'}
                  </span>
                </button>
              {isFontStyleListOpen && secondaryFontEnabled && (
                <div
                  className="dropdown-list dropdown-list--opens-down font-style-dropdown-list"
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseLeave={() => {
                    // Stop preview when leaving the entire dropdown
                    if (isSecondaryWeightPreviewMode) {
                      console.log(`[SecondaryFontControlSection] WEIGHT PREVIEW LEAVE DROPDOWN`);
                      stopSecondaryWeightPreview();
                    }
                  }}
                >
                  <div className="dropdown-items-container font-style-items-container"> {/* Corrected class to className */}
                    {secondaryAvailableStyles.map((style: string) => (
                      <button
                        key={style}
                        className={`dropdown-item ${style === getEffectiveSecondaryWeight() ? 'selected' : ''}`}
                        onMouseEnter={() => {
                          // Start preview on hover (debounced)
                          if (style !== getEffectiveSecondaryWeight()) {
                            console.log(`[SecondaryFontControlSection] WEIGHT PREVIEW HOVER: ${style}`);
                            startSecondaryWeightPreview(style);
                          }
                        }}
                        onMouseDown={() => {
                          console.log(`[SecondaryFontControlSection] COMMIT WEIGHT: ${style}`);
                          // Commit the weight selection
                          commitSecondaryPreviewWeight(style);
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
              <button 
                className="ghost-button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSecondaryWeightLinked();
                }}
                title={secondaryWeightLinked ? "Unlink secondary weight" : "Link secondary weight to primary"}
              >
                <IconComponent 
                  name={secondaryWeightLinked ? "link-connected-24" : "link-broken-24"} 
                  size={24} 
                  className="section-header-icon" 
                />
              </button>
            </div>
          </div>

          {/* Case dropdown row */}
          <div className="control-row font-selection-control-row control-row-no-left-padding">
            <label className="control-label" style={{ paddingLeft: 'calc(var(--size-icon-size) + var(--sizing-default-spacers-spacer-2))' }}>Case</label>
            <div className="font-style-dropdown-with-icon">
              <div
                ref={caseDropdownContainerRef}
                className="custom-dropdown-container font-style-dropdown"
              >
                <button
                  className="input dropdown-trigger-button font-style-trigger-button"
                  onClick={() => {
                    if (inactive) return;
                    setIsCaseDropdownOpen(!isCaseDropdownOpen);
                  }}
                  disabled={inactive}
                >
                  <span className="dropdown-trigger-label">{currentCaseLabel}</span>
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
              <div style={{ width: 'var(--size-icon-size)', flexShrink: 0 }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 