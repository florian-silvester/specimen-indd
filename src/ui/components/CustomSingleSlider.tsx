import { h } from "preact";
import { useState, useEffect, useRef } from "preact/hooks";

interface CustomSingleSliderProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (newValue: number) => void;
  valueSuffix?: string;
  displayDecimals?: number;
  dotValues?: number[];
  onDragStateChange?: (dragging: boolean) => void;
  shiftMultiplier?: number | false; // Shift+Arrow multiplier (default 10, false to disable)
}

export function CustomSingleSlider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  valueSuffix = "",
  displayDecimals = 0,
  dotValues = [], 
  onDragStateChange,
  shiftMultiplier = 10,
}: CustomSingleSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [currentValue, setCurrentValue] = useState(value); 

  useEffect(() => {
    setCurrentValue(value); 
  }, [value]);

  const valueToPercentage = (val: number) => {
    if (max === min) return 0;
    const percentage = ((val - min) / (max - min)) * 100;
    return Math.max(0, Math.min(100, percentage));
  };

  const percentageToValue = (percentage: number) => {
    const rawValue = (percentage / 100) * (max - min) + min;
    const steppedValue = Math.round(rawValue / step) * step;
    return Math.max(min, Math.min(steppedValue, max));
  };

  const currentPercentage = valueToPercentage(currentValue);
  const getDotPositionStyle = (dotPercentage: number) => {
    if (dotPercentage <= 0) {
      return { left: '0%', transform: 'translateY(-50%)' as const };
    }
    if (dotPercentage >= 100) {
      return { left: '100%', transform: 'translate(-100%, -50%)' as const };
    }
    return { left: `${dotPercentage}%`, transform: 'translate(-50%, -50%)' as const };
  };

  const startDrag = (event: MouseEvent | TouchEvent) => {
    setIsDragging(true);
    if (onDragStateChange) onDragStateChange(true);
  };

  useEffect(() => {
    const handleDragMove = (event: MouseEvent | TouchEvent) => {
      if (!isDragging || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      let clientX = event.type.startsWith('touch') ? (event as TouchEvent).touches[0].clientX : (event as MouseEvent).clientX;
      let percentage = ((clientX - rect.left) / rect.width) * 100;
      percentage = Math.max(0, Math.min(100, percentage));
      const newValue = percentageToValue(percentage);
      if (newValue !== currentValue) {
          setCurrentValue(newValue);
          onChange(newValue);
      }
    };
    const endDrag = () => {
      if (isDragging) {
        setIsDragging(false);
        if (onDragStateChange) onDragStateChange(false);
      }
    };
    if (isDragging) {
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
  }, [isDragging, min, max, step, onChange, currentValue, percentageToValue]);
  
  const handleTrackClick = (event: MouseEvent) => {
    if (!trackRef.current || isDragging || (knobRef.current && knobRef.current.contains(event.target as Node))) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    let clickPercentage = (clickX / rect.width) * 100;
    clickPercentage = Math.max(0, Math.min(100, clickPercentage));
    const clickedValue = percentageToValue(clickPercentage);
    setCurrentValue(clickedValue);
    onChange(clickedValue);
  };

  const handleKnobKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const effectiveStep = (shiftMultiplier !== false && event.shiftKey) ? step * shiftMultiplier : step;
      const change = (event.key === 'ArrowLeft' || event.key === 'ArrowDown') ? -effectiveStep : effectiveStep;
      let newValue = currentValue + change;
      newValue = Math.max(min, Math.min(newValue, max));
      newValue = Math.round(newValue / step) * step;
      newValue = Math.max(min, Math.min(newValue, max)); 
      setCurrentValue(newValue);
      onChange(newValue);
    }
  };

  return (
    <div className="custom-single-slider-area" ref={trackRef} onClick={handleTrackClick}>
      {isDragging && (
        <div
          className="knob-tooltip"
          style={{ left: `${currentPercentage}%`}}
        >
          {`${currentValue.toFixed(displayDecimals)}${valueSuffix}`}
        </div>
      )}
      <div className="slider-track-background">
        <div 
          className="slider-filled-track-element"
          style={{ width: `${currentPercentage}%` }}
        ></div>
        <div 
          ref={knobRef}
          className="slider-knob"
          style={{ left: `${currentPercentage}%` }}
          onMouseDown={startDrag}
          onTouchStart={startDrag}
          role="slider"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={currentValue}
          aria-label={label}
          tabIndex={0}
          onKeyDown={handleKnobKeyDown}
        ></div>
        {dotValues
          .filter((dotValue) => dotValue >= min && dotValue <= max)
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
      </div>
    </div>
  );
} 