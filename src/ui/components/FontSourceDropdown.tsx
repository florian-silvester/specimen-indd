import { h } from "preact";
import { useState, useRef, useEffect } from "preact/hooks";
import { TargetedEvent } from 'preact/compat';

interface FontSourceDropdownProps {
  currentFontSource: 'primary' | 'secondary' | 'custom';
  currentWeight: string;
  primaryFontWeights: string[];
  secondaryFontWeights: string[];
  onFontSourceChange: (source: 'primary' | 'secondary' | 'custom') => void;
  onWeightChange: (weight: string) => void;
  disabled?: boolean;
  IconComponent: ({ name, className, size }: { name: string; className?: string; size?: number; }) => preact.JSX.Element;
  styleKey: string;
  onDropdownToggle: (event: any, key: string) => void;
  isOpen: boolean;
}

export function FontSourceDropdown({
  currentFontSource,
  currentWeight,
  primaryFontWeights,
  secondaryFontWeights,
  onFontSourceChange,
  onWeightChange,
  disabled = false,
  IconComponent,
  styleKey,
  onDropdownToggle,
  isOpen
}: FontSourceDropdownProps) {
  
  // Get available weights for current font source
  const availableWeights = currentFontSource === 'primary' ? primaryFontWeights : secondaryFontWeights;

  const handleFontSourceClick = (source: 'primary' | 'secondary') => {
    onFontSourceChange(source);

    const newAvailableWeights = source === 'primary' ? primaryFontWeights : secondaryFontWeights;
    if (!newAvailableWeights.includes(currentWeight)) {
      const firstAvailableWeight = newAvailableWeights[0] || 'Regular';
      onWeightChange(firstAvailableWeight);
    }
  };

  const handleWeightClick = (weight: string) => {
    onWeightChange(weight);
    // Close dropdown by calling the grid's toggle function
    onDropdownToggle({} as any, styleKey);
  };

  const handleTriggerClick = (e: TargetedEvent<HTMLButtonElement, MouseEvent>) => {
    if (!disabled) {
      onDropdownToggle(e, styleKey);
    }
  };

  // Determine what to display in trigger
  const getTriggerDisplay = () => {
    return currentFontSource === 'primary' ? 'T' : 'H';
  };

  const triggerTitle = currentFontSource === 'primary' ? 'Text Font' : 'Heading Font';

      return (
    <div className="custom-dropdown-container">
      <button
        className="input dropdown-trigger-button grid-font-style-trigger-button"
        onClick={handleTriggerClick}
        disabled={disabled}
        data-key={styleKey}
        title={triggerTitle}
      >
        <span className={`dropdown-trigger-label ${disabled ? 'is-disabled' : ''}`}>
          {getTriggerDisplay()}
        </span>
      </button>
    </div>
  );
}

// Separate component for the dropdown content that the grid will render
export function FontSourceDropdownContent({
  currentFontSource,
  currentWeight,
  primaryFontWeights,
  secondaryFontWeights,
  onFontSourceChange,
  onWeightChange,
  startWeightPreview,
  stopWeightPreview,
  getEffectiveWeight,
}: {
  currentFontSource: 'primary' | 'secondary' | 'custom';
  currentWeight: string;
  primaryFontWeights: string[];
  secondaryFontWeights: string[];
  onFontSourceChange: (source: 'primary' | 'secondary' | 'custom') => void;
  onWeightChange: (weight: string) => void;
  // NEW: Preview functionality
  startWeightPreview?: (weight: string) => void;
  stopWeightPreview?: () => void;
  getEffectiveWeight?: () => string;
}) {
  const availableWeights = currentFontSource === 'primary' ? primaryFontWeights : secondaryFontWeights;

  return (
    <div className="dropdown-items-container">
      {availableWeights.length > 0 && availableWeights.map((weight) => (
        <div
          key={weight}
          className={`dropdown-item ${weight === (getEffectiveWeight ? getEffectiveWeight() : currentWeight) ? 'selected' : ''}`}
          onMouseEnter={() => {
            // Start preview on hover if preview functions are available
            if (startWeightPreview && weight !== (getEffectiveWeight ? getEffectiveWeight() : currentWeight)) {
              console.log(`[FontSourceDropdown] WEIGHT PREVIEW HOVER: ${weight}`);
              startWeightPreview(weight);
            }
          }}
          onClick={() => onWeightChange(weight)}
        >
          <span className="dropdown-item-text-content">{weight}</span>
        </div>
      ))}
    </div>
  );
} 