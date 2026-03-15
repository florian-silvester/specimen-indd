import { h, Fragment, ComponentType } from "preact";
import { useState, useRef, useEffect } from "preact/hooks";
import { TargetedEvent } from 'preact/compat';
import { useAppStore } from '../store/appStore';

interface IconProps { name: string; size: number; className?: string; }
interface CustomSingleSliderProps {
  label: string;
  min: number;
  max: number;
  value: number;
  step: number;
  onChange: (newValue: number) => void;
  displayDecimals: number;
  valueSuffix?: string;
  dotValues: number[];
  onDragStateChange: (dragging: boolean) => void;
  shiftMultiplier?: number | false;
}

interface RangeSliderProps {
  min: number;
  max: number;
  step: number;
  values: [number, number];
  onChange: (newValues: [number, number]) => void;
  leftLabel: string;
  rightLabel: string;
  dotValues?: number[];
  allowSameValues?: boolean;
  valueSuffix?: string;
  displayDecimals?: number;
  isFlatMode?: boolean;
  shiftMultiplier?: number | false;
}

const BASE_SIZE_MIN = 12;
const BASE_SIZE_MAX = 26;
const baseSizePresetOptions = Array.from(
  { length: BASE_SIZE_MAX - BASE_SIZE_MIN + 1 },
  (_, index) => BASE_SIZE_MIN + index,
);

export interface BaseSizeControlSectionProps {
  // activeMode is now managed by Zustand store
  desktopBaseSize: number;
  setDesktopBaseSize: (value: number) => void;
  mobileBaseSize: number;
  setMobileBaseSize: (value: number) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  textMainSliderDotValues: number[];
  IconComponent: ComponentType<IconProps>;
  CustomSingleSliderComponent: ComponentType<CustomSingleSliderProps>;
  RangeSliderComponent: ComponentType<RangeSliderProps>;
  isFluidMode: boolean;
}

export function BaseSizeControlSection({
  desktopBaseSize,
  setDesktopBaseSize,
  mobileBaseSize,
  setMobileBaseSize,
  isOpen,
  onToggleOpen,
  textMainSliderDotValues,
  IconComponent,
  CustomSingleSliderComponent,
  RangeSliderComponent,
  isFluidMode,
}: BaseSizeControlSectionProps) {
  // Get state from Zustand store
  const { activeMode } = useAppStore();
  
  const [isBaseSizePresetOpen, setIsBaseSizePresetOpen] = useState(false);
  const baseSizePresetDropdownRef = useRef<HTMLDivElement>(null);
  const [isBaseSizeSliderDragging, setIsBaseSizeSliderDragging] = useState(false);

  const currentBaseSize = activeMode === 'desktop' ? desktopBaseSize : mobileBaseSize;
  const [inputString, setInputString] = useState<string>(currentBaseSize.toString());

  useEffect(() => {
    setInputString(currentBaseSize.toString());
  }, [currentBaseSize]);

  useEffect(() => {
    if (!isBaseSizePresetOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (baseSizePresetDropdownRef.current && !baseSizePresetDropdownRef.current.contains(event.target as Node)) {
        setIsBaseSizePresetOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isBaseSizePresetOpen]);

  const setCurrentBaseSize = activeMode === 'desktop' ? setDesktopBaseSize : setMobileBaseSize;

  const handleFluidRangeChange = ([minValue, maxValue]: [number, number]) => {
    const clampedMin = Math.max(BASE_SIZE_MIN, Math.min(Math.round(minValue), BASE_SIZE_MAX));
    const clampedMax = Math.max(clampedMin, Math.min(Math.round(maxValue), BASE_SIZE_MAX));
    setMobileBaseSize(clampedMin);
    setDesktopBaseSize(clampedMax);
  };

  return (
    <div className={`section base-size-section ${isOpen ? 'section-open' : ''}`}>
      <div className="section-header" tabIndex={0} role="button" onClick={onToggleOpen} onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleOpen(); } }}>
        <div className="section-header-titles-container section-header-left">
          <IconComponent name="navigate-forward-24" size={24} className={`section-header-chevron ${isOpen ? 'open' : ''}`} />
          <span className="section-title">Base size</span>
        </div>
        <div className="header-section-dropdown-container" ref={baseSizePresetDropdownRef}>
          <div className="custom-dropdown-container">
            <button
              className="input dropdown-trigger-button"
              onClick={(e) => {
                e.stopPropagation();
                setIsBaseSizePresetOpen(!isBaseSizePresetOpen);
              }}
              aria-label="Select base size"
            >
              <span className="dropdown-trigger-label">
                {isFluidMode ? `${mobileBaseSize}–${desktopBaseSize} px` : `${currentBaseSize} px`}
              </span>
            </button>
            {isBaseSizePresetOpen && (
              <div
                className="dropdown-list dropdown-list--opens-down"
                onMouseDown={(e) => e.preventDefault()}
              >
                <div className="dropdown-items-container base-size-items-container">
                  {baseSizePresetOptions.map((size) => (
                    <button
                      key={size}
                      className={`dropdown-item ${isFluidMode ? (mobileBaseSize === size && desktopBaseSize === size ? 'selected' : '') : (currentBaseSize === size ? 'selected' : '')}`}
                      onMouseDown={() => {
                        if (isFluidMode) {
                          setMobileBaseSize(size);
                          setDesktopBaseSize(size);
                        } else {
                          setCurrentBaseSize(size);
                        }
                        setIsBaseSizePresetOpen(false);
                      }}
                    >
                      <span className="dropdown-item-text-content">{`${size} px`}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {isOpen && (
        !isFluidMode ? (
          <div className="section-content column">
            <div className="control-row custom-single-slider-input-row">
              <div className={`input-container-fixed ${isBaseSizeSliderDragging ? 'input-faded-out' : ''}`} style={{ width: "72px" }}>
                <input
                  type="text"
                  id={activeMode === 'desktop' ? "desktopBaseSizeInput" : "mobileBaseSizeInput"}
                  className="input number-input"
                  value={inputString}
                  onChange={(e: TargetedEvent<HTMLInputElement, Event>) => {
                    setInputString(e.currentTarget.value);
                  }}
                  onBlur={(e: TargetedEvent<HTMLInputElement, Event>) => {
                    let val = parseInt(e.currentTarget.value.replace(',', '.'), 10);
                    if (isNaN(val)) val = currentBaseSize;
                    val = Math.max(BASE_SIZE_MIN, Math.min(val, BASE_SIZE_MAX));
                    setCurrentBaseSize(val);
                    setInputString(val.toString());
                  }}
                  onKeyDown={(e: TargetedEvent<HTMLInputElement, KeyboardEvent>) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      const change = e.key === 'ArrowUp' ? 1 : -1;
                      let newValue = currentBaseSize + change;
                      newValue = Math.max(BASE_SIZE_MIN, Math.min(newValue, BASE_SIZE_MAX));
                      setCurrentBaseSize(newValue);
                      setInputString(newValue.toString());
                    }
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                />
              </div>
              <div className="custom-single-slider-tooltip-spacer"></div>
            </div>

            <div className="control-row control-row-no-gap">
              <div className="static-label-input-look align-left">Text Main</div>
              <div className="slider-container">
                <CustomSingleSliderComponent
                  label="Text Main"
                  min={BASE_SIZE_MIN}
                  max={BASE_SIZE_MAX}
                  value={currentBaseSize}
                  step={1}
                  onChange={(newValue: number) => {
                    setCurrentBaseSize(newValue);
                  }}
                  displayDecimals={0}
                  valueSuffix="px"
                  dotValues={textMainSliderDotValues}
                  onDragStateChange={setIsBaseSizeSliderDragging}
                  shiftMultiplier={false}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="section-content">
            <div className="control-row-range-slider">
              <RangeSliderComponent
                min={BASE_SIZE_MIN}
                max={BASE_SIZE_MAX}
                step={1}
                values={[mobileBaseSize, desktopBaseSize]}
                onChange={handleFluidRangeChange}
                leftLabel="Min"
                rightLabel="Max"
                dotValues={textMainSliderDotValues}
                allowSameValues={true}
                displayDecimals={0}
                shiftMultiplier={false}
              />
            </div>
          </div>
        )
      )}
    </div>
  );
}