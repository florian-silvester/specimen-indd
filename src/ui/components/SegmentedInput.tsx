import { h, Fragment } from "preact";
import { TargetedEvent } from 'preact/compat';
import { Icon } from "./Icon"; // Corrected path to ui.tsx

interface SegmentedInputProps {
  inputValue: string;
  onInputChange?: (value: string) => void; // Make optional for readOnly mode
  onTriggerClick: () => void;
  placeholder?: string;
  triggerAriaLabel?: string;
  numericPrecision?: number; // Optional: number of decimal places for numeric input
  numericStep?: number;      // Optional: step for arrow key increment/decrement
  readOnly?: boolean; // New prop
  unit?: string; // New prop for displaying a unit like 'px'
}

export function SegmentedInput({
  inputValue,
  onInputChange,
  onTriggerClick,
  placeholder = "Type here...",
  triggerAriaLabel = "Open options",
  numericPrecision = 3, // Default to 3 decimal places for scale ratios
  numericStep = 0.001,  // Default step for scale ratios
  readOnly = false, // Default to false
  unit = "",      // Default to empty string
}: SegmentedInputProps) {

  const handleKeyDown = (event: TargetedEvent<HTMLInputElement, KeyboardEvent>) => {
    if (readOnly || !onInputChange) return; // Don't handle if readOnly or no handler

    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const currentValue = parseFloat(inputValue); // inputValue might have unit, so parse carefully or expect clean number
      if (isNaN(currentValue)) return;

      const step = event.key === 'ArrowUp' ? numericStep : -numericStep;
      const newValue = currentValue + step;
      const clampedNewValue = Math.max(0.001, newValue);
      onInputChange(clampedNewValue.toFixed(numericPrecision));
    }
  };

  const handleInput = (e: TargetedEvent<HTMLInputElement, Event>) => {
    if (readOnly || !onInputChange) return;
    onInputChange(e.currentTarget.value);
  };

  return (
    <div 
      class={`segmented-input-container ${readOnly ? 'readonly' : ''}`}
      onClick={readOnly ? onTriggerClick : undefined} // Make whole container clickable if readOnly
      style={readOnly ? { cursor: 'pointer' } : {}} // Add pointer cursor if readOnly
    >
      <input
        type="text" // Keep as text to allow flexible input, parsing handles numeric logic
        className="input segmented-input-field"
        value={readOnly && unit ? `${inputValue}${unit}` : inputValue} // Append unit if readOnly and unit is provided
        onInput={handleInput}
        onKeyDown={handleKeyDown} // Add keydown handler
        placeholder={placeholder}
        readOnly={readOnly} // Apply readOnly attribute
      />
      <button
        className="icon-button segmented-input-trigger"
        onClick={onTriggerClick} // Always use onTriggerClick for the button
        aria-label={triggerAriaLabel}
      >
        <Icon name="chevron-down-24" size={24} />
      </button>
    </div>
  );
} 