import { h, Fragment } from "preact";
import { useState, useRef, useEffect } from "preact/hooks";
import { emit } from '@create-figma-plugin/utilities';
import { Icon } from "../components/Icon";
import { ApplyTypographyVariableMappingEvent } from '../../core/types';

interface VariableMappingScreenProps {
  data: {
    detectedVariables: Array<{
      variableId: string;
      variableName: string;
      property: string;
      usedByStyles: string[];
      currentValue: number | string;
      isLocal: boolean;
      targetFontFamily?: string;
      availableWeights?: string[];
      availableFontFamilies?: string[];
    }>;
    typeSystemKeys: string[];
    originalRequest: any;
  };
  onSubmit: (mapping: { variableMapping: { [variableId: string]: { action: string; newValue?: string } }; originalRequest: any }) => void;
  onCancel: () => void;
}

export function VariableMappingScreen({ data, onSubmit, onCancel }: VariableMappingScreenProps) {
  const { detectedVariables, originalRequest } = data;
  
  // Group variables by type
  const fontFamilyVariables = detectedVariables.filter(v => v.property === 'fontFamily');
  const fontWeightVariables = detectedVariables.filter(v => v.property === 'fontStyle');
  
  // Initialize mapping state for font variables only
  const [variableMapping, setVariableMapping] = useState<{
    [variableId: string]: {
      action: 'update' | 'preserve' | 'disconnect';
      newValue?: string;
    };
  }>(() => {
    const initial: any = {};
    detectedVariables.forEach(variable => {
      if (variable.property === 'fontFamily') {
        initial[variable.variableId] = {
          action: 'update',
          newValue: variable.targetFontFamily
        };
      } else if (variable.property === 'fontStyle') {
        const defaultWeight = variable.availableWeights?.[0] || 'Regular';
        initial[variable.variableId] = {
          action: 'update',
          newValue: defaultWeight
        };
      }
    });
    return initial;
  });

  // Dropdown state management
  const [openDropdownKey, setOpenDropdownKey] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ 
    top?: number; 
    bottom?: number; 
    left?: number; 
    width?: number; 
  } | null>(null);
  const dropdownListRef = useRef<HTMLDivElement>(null);
  const activeDropdownTriggerRef = useRef<HTMLButtonElement | null>(null);

  const toggleDropdown = (event: h.JSX.TargetedMouseEvent<HTMLButtonElement>, variableId: string) => {
    const currentlyOpen = openDropdownKey === variableId;

    if (currentlyOpen) {
      setOpenDropdownKey(null);
      setDropdownPosition(null);
      activeDropdownTriggerRef.current = null;
    } else {
      setOpenDropdownKey(variableId);
      const button = event.currentTarget;
      activeDropdownTriggerRef.current = button;
      const buttonRect = button.getBoundingClientRect();
      
      const variable = detectedVariables.find(v => v.variableId === variableId);
      const options = variable?.property === 'fontFamily' 
        ? (variable.availableFontFamilies || [])
        : (variable?.availableWeights || []);
      const dropdownHeightEstimate = 30 * options.length;
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

  const selectOption = (variableId: string, selectedValue: string) => {
    setVariableMapping(prev => ({
      ...prev,
      [variableId]: {
        ...prev[variableId],
        newValue: selectedValue
      }
    }));
    setOpenDropdownKey(null);
    setDropdownPosition(null);
    activeDropdownTriggerRef.current = null;
  };

  // Handle outside clicks
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
    onSubmit({
      variableMapping,
      originalRequest
    });
  };

  const renderVariableGroup = (variables: typeof detectedVariables, title: string) => {
    if (variables.length === 0) return null;

    return (
      <Fragment>
        {/* Section Header */}
        <div class="section-header" style={{ cursor: 'default' }}>
          <div class="section-header-titles-container section-header-left">
            <span class="section-title">{title}</span>
          </div>
        </div>

        {/* Column Headers */}
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
            backgroundColor: 'var(--background-subtle)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            <span style={{ fontSize: 'var(--ui-font-size-xsmall)', color: 'var(--text-inactive)', fontWeight: 'var(--ui-font-weight-regular)' }}>Variable name</span>
          </div>
          <div style={{ width: '180px', flexShrink: 0 }}>
            <span style={{ fontSize: 'var(--ui-font-size-xsmall)', color: 'var(--text-inactive)', fontWeight: 'var(--ui-font-weight-regular)' }}>New value</span>
          </div>
        </div>

        {/* Variable Rows */}
        {variables.map((variable) => {
          const mapping = variableMapping[variable.variableId];
          
          return (
            <div 
              key={variable.variableId}
              class="section-header" 
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
                gap: 'var(--sizing-default-spacers-spacer-2)'
              }}
            >
              {/* Left Column: Variable Name */}
              <div class="result-text-wrap" style={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
                <span class="section-title" style={{ fontWeight: 'var(--ui-font-weight-regular)' }}>
                  {variable.variableName}
                </span>
              </div>
              
              {/* Right Column: Dropdown */}
              <div style={{ width: '180px', flexShrink: 0 }}>
                <button
                  className="input dropdown-trigger-button"
                  onClick={(e) => { e.stopPropagation(); toggleDropdown(e, variable.variableId); }}
                  style={{ width: '100%' }}
                >
                  <span class="dropdown-trigger-label">{mapping?.newValue || 'Select...'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </Fragment>
    );
  };

  return (
    <Fragment>
      <div class="main-content">
        {/* Fixed Header */}
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
              <span class="section-title" style={{ fontWeight: "var(--font-weight-strong)" }}>Typography Variables Detected</span>
            </div>
          </div>
        </div>

        {/* Variables Section */}
        <div style={{ paddingBottom: 'var(--sizing-default-spacers-spacer-4)' }}>
          <div class="scan-results-list">
            {/* Font Family Variables */}
            {renderVariableGroup(fontFamilyVariables, 'Font Family')}
            
            {/* Font Weight Variables */}
            {renderVariableGroup(fontWeightVariables, 'Font Weight')}
          </div>
        </div>
      </div>

      {/* Footer */}
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
            >
              Update
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

      {/* Dropdown list */}
      {openDropdownKey && dropdownPosition && (() => {
        const activeVariable = detectedVariables.find(v => v.variableId === openDropdownKey);
        if (!activeVariable) return null;

        const options = activeVariable.property === 'fontFamily' 
          ? (activeVariable.availableFontFamilies || [])
          : (activeVariable.availableWeights || []);

        return (
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
              {options.map(option => (
                <button
                  key={option}
                  className={`dropdown-item ${variableMapping[openDropdownKey]?.newValue === option ? 'selected' : ''}`}
                  onMouseDown={() => selectOption(openDropdownKey, option)}
                >
                  <span className="dropdown-item-text-content">{option}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })()}
    </Fragment>
  );
} 