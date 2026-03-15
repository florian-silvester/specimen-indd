import { h } from "preact";
import { useState, useEffect, useRef } from "preact/hooks";
import { TargetedEvent } from 'preact/compat';

interface RangeSliderProps {
  min: number;
  max: number;
  step: number;
  values: [number, number];
  onChange: (newValues: [number, number]) => void;
  valueSuffix?: string;
  displayDecimals?: number;
  leftLabel: string;
  rightLabel: string;
  dotValues?: number[];
  allowSameValues?: boolean;
  isFlatMode?: boolean; // NEW: Explicit flat mode flag
  shiftMultiplier?: number | false; // Shift+Arrow multiplier (default 10, false to disable)
}

export function RangeSlider({
  min,
  max,
  step,
  values,
  onChange,
  valueSuffix = "",
  displayDecimals = 0,
  leftLabel,
  rightLabel,
  dotValues = [],
  allowSameValues = false,
  isFlatMode = false, // NEW: Default to false
  shiftMultiplier = 10,
}: RangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [draggingKnob, setDraggingKnob] = useState<'left' | 'right' | null>(null);
  const [localValues, setLocalValues] = useState<[number, number]>(values);
  const hasMountedAndSettledRef = useRef(false);
  
  // NEW: Track raw input strings for free typing
  const [leftInputString, setLeftInputString] = useState<string>(values[0].toFixed(displayDecimals));
  const [rightInputString, setRightInputString] = useState<string>(values[1].toFixed(displayDecimals));

  useEffect(() => {
    setLocalValues(values);
    setLeftInputString(values[0].toFixed(displayDecimals));
    setRightInputString(values[1].toFixed(displayDecimals));
  }, [values, displayDecimals]);

  useEffect(() => {
    const timer = setTimeout(() => {
      hasMountedAndSettledRef.current = true;
      console.log('[RangeSlider] hasMountedAndSettledRef set to true');
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    console.log('[RangeSlider] draggingKnob changed to:', draggingKnob);
  }, [draggingKnob]);

  const leftKnobRef = useRef<HTMLDivElement>(null);
  const rightKnobRef = useRef<HTMLDivElement>(null);

  const roundToStep = (value: number, step: number) => {
    const inv = 1.0 / step;
    return Math.round(value * inv) / inv;
  };

  const percentageToValue = (percentage: number) => {
    if (max === min) return min;
    const value = (percentage / 100) * (max - min) + min;
    const rounded = roundToStep(value, step);
    return Math.max(min, Math.min(max, rounded));
  };

  const valueToPercentage = (value: number) => {
    if (max === min) return 0;
    return ((value - min) / (max - min)) * 100;
  };

  const handleTrackClick = (event: MouseEvent) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    let clickPercentage = (clickX / rect.width) * 100;
    clickPercentage = Math.max(0, Math.min(100, clickPercentage));

    const clickedValue = percentageToValue(clickPercentage);

    // FLAT MODE: If in flat mode, clicking moves both to clicked position
    if (isFlatMode) {
      const newValue = Math.max(min, Math.min(max, clickedValue));
      const newValues: [number, number] = [newValue, newValue];
      setLocalValues(newValues);
      console.log('[RangeSlider] onChange called from handleTrackClick (Flat mode)');
      onChange(newValues);
      return;
    }

    const distToLeft = Math.abs(clickedValue - localValues[0]);
    const distToRight = Math.abs(clickedValue - localValues[1]);

    let newValues: [number, number];
    if (distToLeft <= distToRight) {
      const newLeftValue = Math.min(clickedValue, localValues[1]);
      newValues = [newLeftValue, localValues[1]];
    } else {
      const newRightValue = Math.max(clickedValue, localValues[0]);
      newValues = [localValues[0], newRightValue];
    }
    
    // Ensure that the knobs don't overlap after a click
    if (!allowSameValues && newValues[0] >= newValues[1]) {
      if (distToLeft <= distToRight) {
        newValues[0] = newValues[1] - step;
      } else {
        newValues[1] = newValues[0] + step;
      }
    } else if (!allowSameValues && newValues[0] === newValues[1]) {
      // If they're equal but allowSameValues is false, separate them
      if (distToLeft <= distToRight) {
        newValues[0] = newValues[1] - step;
      } else {
        newValues[1] = newValues[0] + step;
      }
    }

    setLocalValues(newValues);
    console.log('[RangeSlider] onChange called from handleTrackClick');
    onChange(newValues);
  };

  const handleKnobKeyDown = (event: KeyboardEvent, knob: 'left' | 'right') => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      let newValue = knob === 'left' ? localValues[0] : localValues[1];
      const effectiveStep = (shiftMultiplier !== false && event.shiftKey) ? step * shiftMultiplier : step;
      const change = (event.key === 'ArrowLeft' || event.key === 'ArrowDown') ? -effectiveStep : effectiveStep;
      newValue += change;

      // Round the new value to the step
      newValue = roundToStep(newValue, step);

      let newValuesTuple: [number, number];
      if (knob === 'left') {
        const maxLeftValue = allowSameValues ? localValues[1] : localValues[1] - step;
        newValue = Math.max(min, Math.min(newValue, maxLeftValue));
        newValuesTuple = [newValue, localValues[1]];
      } else {
        const minRightValue = allowSameValues ? localValues[0] : localValues[0] + step;
        newValue = Math.max(minRightValue, Math.min(newValue, max));
        newValuesTuple = [localValues[0], newValue];
      }
      setLocalValues(newValuesTuple);
      console.log('[RangeSlider] onChange called from handleKnobKeyDown');
      onChange(newValuesTuple);
    }
  };

  const startDrag = (knob: 'left' | 'right', event: MouseEvent | TouchEvent) => {
    if (!hasMountedAndSettledRef.current) {
      console.log('[RangeSlider] startDrag IGNORED - component not fully settled.');
      event.preventDefault(); 
      return;
    }
    console.log('[RangeSlider] startDrag CALLED. Knob:', knob, 'Event type:', event.type, 'Target:', event.target);
    event.preventDefault();
    setDraggingKnob(knob);
  };

  useEffect(() => {
    const handleDragMove = (event: MouseEvent | TouchEvent) => {
      if (!draggingKnob || !trackRef.current) return;

      const rect = trackRef.current.getBoundingClientRect();
      let clientX;
      if (event.type.startsWith('touch')) {
        clientX = (event as TouchEvent).touches[0].clientX;
      } else {
        clientX = (event as MouseEvent).clientX;
      }

      const clickX = clientX - rect.left;
      let clickPercentage = (clickX / rect.width) * 100;
      clickPercentage = Math.max(0, Math.min(100, clickPercentage));
      
      const clickedValue = percentageToValue(clickPercentage);

      setLocalValues(prev => {
        let newLeft = prev[0];
        let newRight = prev[1];

        // FLAT MODE: If in flat mode, dragging right knob moves both
        if (isFlatMode && draggingKnob === 'right') {
          const clampedValue = Math.max(min, Math.min(max, clickedValue));
          newLeft = clampedValue;
          newRight = clampedValue;
        } else if (draggingKnob === 'left') {
          const maxLeftValue = allowSameValues ? prev[1] : prev[1] - step;
          newLeft = Math.min(clickedValue, maxLeftValue);
          newLeft = Math.max(min, newLeft);
        } else {
          const minRightValue = allowSameValues ? prev[0] : prev[0] + step;
          newRight = Math.max(clickedValue, minRightValue);
          newRight = Math.min(max, newRight);
        }
        
        if (!allowSameValues && newLeft > newRight - step) {
            if(draggingKnob === 'left') newLeft = newRight - step;
            else newRight = newLeft + step;
            newLeft = Math.max(min, newLeft);
            newRight = Math.min(max, newRight);
        }

        const newVals: [number, number] = [newLeft, newRight];
        if (newVals[0] !== prev[0] || newVals[1] !== prev[1]) {
            console.log('[RangeSlider] onChange called from drag useEffect');
            onChange(newVals);
        }
        return newVals;
      });
    };

    const endDrag = () => {
      if (draggingKnob) {
        setDraggingKnob(null);
      }
    };

    if (draggingKnob) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('touchmove', handleDragMove, { passive: false });
      document.addEventListener('mouseup', endDrag);
      document.addEventListener('touchend', endDrag);
    }

    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('touchmove', handleDragMove);
      document.removeEventListener('mouseup', endDrag);
      document.removeEventListener('touchend', endDrag);
    };
  }, [draggingKnob, min, max, step, onChange, percentageToValue]);

  const leftPercentage = valueToPercentage(localValues[0]);
  const rightPercentage = valueToPercentage(localValues[1]);

  const displayLeftPercentage = leftPercentage;
  const displayRightPercentage = rightPercentage;

  const filledTrackLeft = Math.min(displayLeftPercentage, displayRightPercentage);
  const filledTrackWidth = Math.abs(displayRightPercentage - displayLeftPercentage);
  const getDotPositionStyle = (dotPercentage: number) => {
    if (dotPercentage <= 0) {
      return { left: '0%', transform: 'translateY(-50%)' as const };
    }
    if (dotPercentage >= 100) {
      return { left: '100%', transform: 'translate(-100%, -50%)' as const };
    }
    return { left: `${dotPercentage}%`, transform: 'translate(-50%, -50%)' as const };
  };

  return (
    <div className="custom-range-slider-wrapper">
      <div className="knob-tooltips-row">
        <div className={`input-container-fixed ${draggingKnob === 'left' ? 'input-faded-out' : ''}`} style={{ width: "72px" }}>
          <input
            type="text"
            className="input number-input"
            value={leftInputString}
            onChange={(e: TargetedEvent<HTMLInputElement, Event>) => {
              // Just update the string while typing, no parsing/clamping
              setLeftInputString(e.currentTarget.value);
            }}
            onBlur={(e: TargetedEvent<HTMLInputElement, Event>) => {
              // Parse and clamp only on blur
              let val = parseFloat(e.currentTarget.value.replace(',', '.'));
              if (isNaN(val)) val = localValues[0];
              
              // FLAT MODE: If in flat mode, update both
              if (isFlatMode) {
                val = Math.max(min, Math.min(val, max));
                const newVals: [number, number] = [roundToStep(val, step), roundToStep(val, step)];
                setLocalValues(newVals);
                setLeftInputString(newVals[0].toFixed(displayDecimals));
                setRightInputString(newVals[1].toFixed(displayDecimals));
                console.log('[RangeSlider] onChange called from left input blur (Flat mode)');
                onChange(newVals);
              } else {
                const maxLeftInputValue = allowSameValues ? localValues[1] : localValues[1] - step;
                val = Math.max(min, Math.min(val, maxLeftInputValue));
                const newVals: [number, number] = [roundToStep(val, step), localValues[1]];
                setLocalValues(newVals);
                setLeftInputString(newVals[0].toFixed(displayDecimals));
                console.log('[RangeSlider] onChange called from left input blur');
                onChange(newVals);
              }
            }}
            onKeyDown={(e: TargetedEvent<HTMLInputElement, KeyboardEvent>) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur(); // Trigger blur to commit
              } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                const effectiveStep = (shiftMultiplier !== false && e.shiftKey) ? step * shiftMultiplier : step;
                const change = e.key === 'ArrowUp' ? effectiveStep : -effectiveStep;
                let newValue = localValues[0] + change;
                newValue = roundToStep(newValue, step);
                
                // FLAT MODE: If in flat mode, update both
                if (isFlatMode) {
                  newValue = Math.max(min, Math.min(newValue, max));
                  const newVals: [number, number] = [newValue, newValue];
                  setLocalValues(newVals);
                  setLeftInputString(newValue.toFixed(displayDecimals));
                  setRightInputString(newValue.toFixed(displayDecimals));
                  onChange(newVals);
                } else {
                  const maxLeftValue = allowSameValues ? localValues[1] : localValues[1] - step;
                  newValue = Math.max(min, Math.min(newValue, maxLeftValue));
                  const newVals: [number, number] = [newValue, localValues[1]];
                  setLocalValues(newVals);
                  setLeftInputString(newValue.toFixed(displayDecimals));
                  onChange(newVals);
                }
              }
            }}
          />
          {valueSuffix && <span className="input-unit">{valueSuffix}</span>}
        </div>

        <div className="knob-tooltips-content-area">
          {draggingKnob === 'left' && (
            <div
              className="knob-tooltip"
              style={{ left: `${displayLeftPercentage}%` }}
            >
              {`${localValues[0].toFixed(displayDecimals)}${valueSuffix}`}
            </div>
          )}
          {draggingKnob === 'right' && (
            <div
              className="knob-tooltip"
              style={{ left: `${displayRightPercentage}%` }}
            >
              {`${localValues[1].toFixed(displayDecimals)}${valueSuffix}`}
            </div>
          )}
        </div>

        <div className={`input-container-fixed ${draggingKnob === 'right' ? 'input-faded-out' : ''}`} style={{ width: "72px" }}>
          <input
            type="text"
            className="input number-input"
            value={rightInputString}
            onChange={(e: TargetedEvent<HTMLInputElement, Event>) => {
              // Just update the string while typing, no parsing/clamping
              setRightInputString(e.currentTarget.value);
            }}
            onBlur={(e: TargetedEvent<HTMLInputElement, Event>) => {
              // Parse and clamp only on blur
              let val = parseFloat(e.currentTarget.value.replace(',', '.'));
              if (isNaN(val)) val = localValues[1];
              
              // FLAT MODE: If in flat mode, update both
              if (isFlatMode) {
                val = Math.max(min, Math.min(val, max));
                const newVals: [number, number] = [roundToStep(val, step), roundToStep(val, step)];
                setLocalValues(newVals);
                setLeftInputString(newVals[0].toFixed(displayDecimals));
                setRightInputString(newVals[1].toFixed(displayDecimals));
                console.log('[RangeSlider] onChange called from right input blur (Flat mode)');
                onChange(newVals);
              } else {
                const minRightInputValue = allowSameValues ? localValues[0] : localValues[0] + step;
                val = Math.max(minRightInputValue, Math.min(val, max));
                const newVals: [number, number] = [localValues[0], roundToStep(val, step)];
                setLocalValues(newVals);
                setRightInputString(newVals[1].toFixed(displayDecimals));
                console.log('[RangeSlider] onChange called from right input blur');
                onChange(newVals);
              }
            }}
            onKeyDown={(e: TargetedEvent<HTMLInputElement, KeyboardEvent>) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur(); // Trigger blur to commit
              } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                const effectiveStep = (shiftMultiplier !== false && e.shiftKey) ? step * shiftMultiplier : step;
                const change = e.key === 'ArrowUp' ? effectiveStep : -effectiveStep;
                let newValue = localValues[1] + change;
                newValue = roundToStep(newValue, step);
                
                // FLAT MODE: If in flat mode, update both
                if (isFlatMode) {
                  newValue = Math.max(min, Math.min(newValue, max));
                  const newVals: [number, number] = [newValue, newValue];
                  setLocalValues(newVals);
                  setLeftInputString(newValue.toFixed(displayDecimals));
                  setRightInputString(newValue.toFixed(displayDecimals));
                  onChange(newVals);
                } else {
                  const minRightValue = allowSameValues ? localValues[0] : localValues[0] + step;
                  newValue = Math.max(minRightValue, Math.min(newValue, max));
                  const newVals: [number, number] = [localValues[0], newValue];
                  setLocalValues(newVals);
                  setRightInputString(newValue.toFixed(displayDecimals));
                  onChange(newVals);
                }
              }
            }}
          />
          {valueSuffix && <span className="input-unit">{valueSuffix}</span>}
        </div>
      </div>

      <div className="slider-main-row">
        <div className={`static-label-input-look align-left ${draggingKnob === 'left' ? 'label-active-drag' : ''}`}>
          {leftLabel}
        </div>

        <div className="slider-track-background" ref={trackRef}>
          <div className="slider-filled-track-element" style={{ left: `${filledTrackLeft}%`, width: `${filledTrackWidth}%` }}></div>
          {dotValues
            .filter((dotValue) => {
              const minSelected = Math.min(localValues[0], localValues[1]);
              const maxSelected = Math.max(localValues[0], localValues[1]);
              return dotValue >= minSelected && dotValue <= maxSelected;
            })
            .map((dotValue, index) => {
            const dotPercentage = valueToPercentage(dotValue);
            const clampedDotPercentage = Math.max(0, Math.min(100, dotPercentage));
            return (
              <div 
                key={`dot-${index}`}
                className="slider-track-dot"
                style={getDotPositionStyle(clampedDotPercentage)}
                title={`${dotValue.toFixed(displayDecimals)}${valueSuffix}`}
              />
            );
          })}
          <div
            ref={leftKnobRef}
            className="slider-knob"
            style={{ 
              left: `${displayLeftPercentage}%`,
              display: isFlatMode ? 'none' : 'block' // Hide in flat mode
            }}
            onMouseDown={(e) => startDrag('left', e)}
            onTouchStart={(e) => startDrag('left', e)}
            role="slider"
            aria-valuemin={min}
            aria-valuemax={localValues[1] - step}
            aria-valuenow={localValues[0]}
            aria-label="Left control knob"
            tabIndex={0}
            onKeyDown={(e) => handleKnobKeyDown(e, 'left')}
          ></div>
          <div
            ref={rightKnobRef}
            className="slider-knob"
            style={{ left: `${displayRightPercentage}%` }}
            onMouseDown={(e) => startDrag('right', e)}
            onTouchStart={(e) => startDrag('right', e)}
            role="slider"
            aria-valuemin={localValues[0] + step}
            aria-valuemax={max}
            aria-valuenow={localValues[1]}
            aria-label="Right control knob"
            tabIndex={0}
            onKeyDown={(e) => handleKnobKeyDown(e, 'right')}
          ></div>
        </div>

        <div className={`static-label-input-look align-right ${draggingKnob === 'right' ? 'label-active-drag' : ''}`}>
          {rightLabel}
        </div>
      </div>
    </div>
  );
} 