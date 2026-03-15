import { h, Fragment } from "preact";
import { useState, useRef, useEffect } from "preact/hooks";
import { Icon } from "../components/Icon";

interface WeightMappingScreenProps {
  data: {
    missingWeights: string[];
    availableWeights: string[];
    textSizeGroups: string[];
    newFontFamily: string;
  };
  onSubmit: (mapping: { weightMapping: { [key: string]: string }; selectedSizeGroups: string[] }) => void;
  onCancel: () => void;
}

export function WeightMappingScreen({ data, onSubmit, onCancel }: WeightMappingScreenProps) {
  const { missingWeights, availableWeights, textSizeGroups, newFontFamily } = data;
  
  // Smart mapping function
  const getSmartMapping = (weight: string, availableWeights: string[]): string => {
    // Exact match first
    if (availableWeights.includes(weight)) {
      return weight;
    }
    
    // Smart mappings for common weight variations
    const mappings: { [key: string]: string[] } = {
      'Normal': ['Regular', 'Medium', 'Book'],
      'Regular': ['Normal', 'Medium', 'Book'],
      'Semi Bold': ['SemiBold', 'Semibold', 'Medium', 'Bold'],
      'SemiBold': ['Semi Bold', 'Semibold', 'Medium', 'Bold'],
      'Semibold': ['Semi Bold', 'SemiBold', 'Medium', 'Bold'],
      'Extra Bold': ['ExtraBold', 'Black', 'Heavy', 'Bold'],
      'ExtraBold': ['Extra Bold', 'Black', 'Heavy', 'Bold'],
      'Ultra Light': ['UltraLight', 'Thin', 'Light'],
      'UltraLight': ['Ultra Light', 'Thin', 'Light']
    };

    // Try smart mappings
    if (mappings[weight]) {
      for (const candidate of mappings[weight]) {
        if (availableWeights.includes(candidate)) {
          return candidate;
        }
      }
    }

    // Fallback to first available weight
    return availableWeights[0] || 'Delete';
  };

  // State for weight mappings - initialize with smart matching
  const [weightMapping, setWeightMapping] = useState<{ [key: string]: string }>(() => {
    const initialMapping: { [key: string]: string } = {};
    missingWeights.forEach(weight => {
      initialMapping[weight] = getSmartMapping(weight, availableWeights);
    });
    return initialMapping;
  });

  // Always update all text groups - no selection needed

  // Dropdown state management - similar to ScanResultsScreen
  const [openDropdownKey, setOpenDropdownKey] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ 
    top?: number; 
    bottom?: number; 
    left?: number; 
    width?: number; 
  } | null>(null);
  const dropdownListRef = useRef<HTMLDivElement>(null);
  const activeDropdownTriggerRef = useRef<HTMLButtonElement | null>(null);

  const toggleDropdown = (event: h.JSX.TargetedMouseEvent<HTMLButtonElement>, weightKey: string) => {
    const currentlyOpen = openDropdownKey === weightKey;

    if (currentlyOpen) {
      setOpenDropdownKey(null);
      setDropdownPosition(null);
      activeDropdownTriggerRef.current = null;
    } else {
      setOpenDropdownKey(weightKey);
      const button = event.currentTarget;
      activeDropdownTriggerRef.current = button;
      const buttonRect = button.getBoundingClientRect();
      const dropdownHeightEstimate = 30 * availableWeights.length;
      const spaceBelow = window.innerHeight - buttonRect.bottom;
      const opensUpward = spaceBelow < dropdownHeightEstimate && buttonRect.top > dropdownHeightEstimate;

      const pos: typeof dropdownPosition = {
        left: buttonRect.left,
        width: buttonRect.width,
      };

      if (opensUpward) {
        pos.bottom = window.innerHeight - buttonRect.top;
      } else {
        pos.top = buttonRect.bottom;
      }
      setDropdownPosition(pos);
    }
  };

  const selectWeight = (weightKey: string, selectedWeight: string) => {
    setWeightMapping(prev => ({
      ...prev,
      [weightKey]: selectedWeight
    }));
    setOpenDropdownKey(null);
    setDropdownPosition(null);
    activeDropdownTriggerRef.current = null;
  };

  // Text groups function removed - always update all groups

  // Handle outside clicks - similar to ScanResultsScreen
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!openDropdownKey) return;

      if (
        dropdownListRef.current && !dropdownListRef.current.contains(event.target as Node) &&
        activeDropdownTriggerRef.current && !activeDropdownTriggerRef.current.contains(event.target as Node)
      ) {
        setOpenDropdownKey(null);
        setDropdownPosition(null);
        activeDropdownTriggerRef.current = null;
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openDropdownKey]);

  const handleSubmit = () => {
    // Always update all text groups
    onSubmit({
      weightMapping,
      selectedSizeGroups: textSizeGroups // Use all groups
    });
  };

  const hasSelections = true; // Always true since we always update all groups

  return (
    <Fragment>
      <div class="main-content">
        {/* Fixed Header - same pattern as ScanResultsScreen */}
        <div class="header-tabs-section">
          <div class="tab-row">
            <div class="header-title-group">
              <button
                className="ghost-button"
                onClick={onCancel}
                aria-label="Back"
              >
                <Icon name="return-24" size={24} />
              </button>
              <span class="section-title" style={{ fontWeight: "var(--font-weight-strong)" }}>Select Text Style Weights</span>
            </div>
          </div>
        </div>

        {/* Weight Variants Section - Remove the section wrapper to eliminate double border */}
        <div style={{ paddingBottom: 'var(--sizing-default-spacers-spacer-4)' }}>
          {/* Scan results list - directly under header, no separate "Weight variants" title */}
          <div class="scan-results-list">
            {/* Column headers row - use a non-hoverable class */}
            <div 
              style={{ 
                height: 'var(--size-row-height)', 
                paddingTop: 'var(--sizing-default-spacers-spacer-1)', 
                paddingBottom: 'var(--sizing-default-spacers-spacer-1)', 
                boxSizing: 'border-box', 
                cursor: 'default', 
                paddingLeft: 'var(--sizing-default-spacers-spacer-3)',
                paddingRight: 'var(--sizing-default-spacers-spacer-3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: 'var(--sizing-default-spacers-spacer-2)',
                backgroundColor: 'var(--background-default)' // Ensure no hover background
              }}
            >
              <div class="result-text-wrap" style={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
                <span style={{ fontSize: 'var(--ui-font-size-xsmall)', color: 'var(--text-inactive)', fontWeight: 'var(--ui-font-weight-regular)' }}>Relume default styles</span>
              </div>
              <div 
                class="custom-dropdown-container header-section-dropdown-container" 
                style={{
                  width: '180px',
                  flexShrink: 0
                }}
              >
                <span style={{ fontSize: 'var(--ui-font-size-xsmall)', color: 'var(--text-inactive)', fontWeight: 'var(--ui-font-weight-regular)' }}>Available weights in {newFontFamily}</span>
              </div>
            </div>

            {/* Weight variant rows - remove hover effect since no frame highlighting */}
            {missingWeights.map((weight) => (
              <div 
                key={weight}
                style={{ 
                  height: 'var(--size-row-height)', 
                  paddingTop: 'var(--sizing-default-spacers-spacer-1)', 
                  paddingBottom: 'var(--sizing-default-spacers-spacer-1)', 
                  boxSizing: 'border-box', 
                  cursor: 'default', 
                  paddingLeft: 'var(--sizing-default-spacers-spacer-3)',
                  paddingRight: 'var(--sizing-default-spacers-spacer-3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: 'var(--sizing-default-spacers-spacer-2)',
                  backgroundColor: 'var(--background-default)' // Ensure no hover background
                }}
              >
                <div class="result-text-wrap" style={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
                  <span class="section-title" style={{ fontWeight: 'var(--ui-font-weight-regular)', marginRight: 'var(--sizing-default-spacers-spacer-2)' }}>{weight}</span>
                  <span style={{ fontSize: 'var(--ui-font-size-xsmall)', color: 'var(--text-inactive)' }}>→</span>
                </div>
                <div 
                  class="custom-dropdown-container header-section-dropdown-container" 
                  style={{
                    width: '180px',
                    flexShrink: 0
                  }}
                >
                  <button
                    className="input dropdown-trigger-button"
                    onClick={(e) => { e.stopPropagation(); toggleDropdown(e, weight); }}
                  >
                    <span class="dropdown-trigger-label">{weightMapping[weight]}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer - exact same pattern as main screen */}
      <div class="footer-fixed">
        <div class="footer-row footer-top-row">
          <div class="footer-button-group">
            <button 
              class="button button-secondary" 
              onClick={onCancel}
            >
              Cancel
            </button>
            <button 
              class="button button-primary" 
              onClick={handleSubmit}
              disabled={!hasSelections}
            >
              Update Styles
            </button>
          </div>
        </div>
        <div className="footer-row footer-bottom-row">
          <div className="footer-button-group footer-secondary-button-group">
            <button 
              className="button-secondary-new icon-only"
              disabled
            >
              <Icon name="play-small-24" size={24} />
            </button>
            <button 
              className="button-secondary-new" 
              disabled
            >
              Dark
            </button>
            <button 
              className="button-secondary-new" 
              disabled
            >
              Hide specs
            </button>
          </div>
          <button className="button-secondary-new with-icon" disabled>
            <Icon name="export-small-24" size={24} />
            Export
          </button>
        </div>
      </div>

      {/* Dropdown list - rendered at top level like ScanResultsScreen */}
      {openDropdownKey && dropdownPosition && (
        <div
          ref={dropdownListRef}
          className="dropdown-list"
          style={{
            position: 'fixed',
            top: dropdownPosition.top !== undefined ? `${dropdownPosition.top}px` : 'auto',
            bottom: dropdownPosition.bottom !== undefined ? `${dropdownPosition.bottom}px` : 'auto',
            left: dropdownPosition.left !== undefined ? `${dropdownPosition.left}px` : 'auto',
            width: dropdownPosition.width !== undefined ? `${dropdownPosition.width}px` : 'auto',
            zIndex: 1000,
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="dropdown-items-container">
            {availableWeights.map(weight => (
              <button
                key={weight}
                className={`dropdown-item ${weightMapping[openDropdownKey] === weight ? 'selected' : ''}`}
                onMouseDown={() => selectWeight(openDropdownKey, weight)}
              >
                <span className="dropdown-item-text-content">{weight}</span>
              </button>
            ))}
            <button
              key="delete"
              className={`dropdown-item ${weightMapping[openDropdownKey] === 'Delete' ? 'selected' : ''}`}
              onMouseDown={() => selectWeight(openDropdownKey, 'Delete')}
              style={{ color: 'var(--text-danger)' }}
            >
              <span className="dropdown-item-text-content">Delete</span>
            </button>
          </div>
        </div>
      )}
    </Fragment>
  );
} 