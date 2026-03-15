import { h, Fragment, ComponentType } from "preact";
import { useState, useRef, useEffect } from "preact/hooks";
import { TargetedEvent } from 'preact/compat';
import { useClickOutside } from '../hooks/useClickOutside';
import { useAppStore } from '../store/appStore';
import { PRESET_RATIOS_MAP, SCALE_RATIO_MAX, SCALE_RATIO_MIN, SystemPresetKey } from "../../core/constants";

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
  onChange: (values: [number, number]) => void;
  leftLabel: string;
  rightLabel: string;
  dotValues?: number[];
  allowSameValues?: boolean;
  valueSuffix?: string;
  displayDecimals?: number;
  isFlatMode?: boolean;
  shiftMultiplier?: number | false;
}

interface DesignPresetOption {
  id: SystemPresetKey;
  label: string;
}

export interface ScaleRatioControlSectionProps {
  // activeMode is now managed by Zustand store
  desktopScaleRatio: number;
  setDesktopScaleRatio: (value: number) => void;
  mobileScaleRatio: number;
  setMobileScaleRatio: (value: number) => void;
  systemPreset?: SystemPresetKey;
  setSystemPreset: (preset: SystemPresetKey | undefined) => void;
  designSystemPresets: DesignPresetOption[];
  isOpen: boolean;
  onToggleOpen: () => void;
  ratioSliderDotValues: number[];
  getScaleRatioDisplayText: () => string;
  IconComponent: ComponentType<IconProps>;
  CustomSingleSliderComponent: ComponentType<CustomSingleSliderProps>;
  RangeSliderComponent: ComponentType<RangeSliderProps>;
  isFluidMode: boolean;
}

export function ScaleRatioControlSection({
  desktopScaleRatio,
  setDesktopScaleRatio,
  mobileScaleRatio,
  setMobileScaleRatio,
  systemPreset,
  setSystemPreset,
  designSystemPresets,
  isOpen,
  onToggleOpen,
  ratioSliderDotValues,
  getScaleRatioDisplayText,
  IconComponent,
  CustomSingleSliderComponent,
  RangeSliderComponent,
  isFluidMode,
}: ScaleRatioControlSectionProps) {
  // Get state from Zustand store
  const { activeMode } = useAppStore();
  
  const [isScaleRatioPresetListOpen, setIsScaleRatioPresetListOpen] = useState(false);
  const [scaleRatioDropdownOpensUp, setScaleRatioDropdownOpensUp] = useState(false);
  const scaleRatioInputContainerRef = useRef<HTMLDivElement>(null);
  const [isScaleRatioSliderDragging, setIsScaleRatioSliderDragging] = useState(false);

  const currentScaleRatio = activeMode === 'desktop' ? desktopScaleRatio : mobileScaleRatio;
  const [inputString, setInputString] = useState<string>(currentScaleRatio.toFixed(3));
  const ratioMin = SCALE_RATIO_MIN;
  const ratioMax = SCALE_RATIO_MAX;
  const isPresetLocked = Boolean(systemPreset);

  // Compute fluid mode display text: show preset name if both match, otherwise "Custom"
  const getFluidDisplayText = () => {
    const tolerance = 0.001;
    if (Math.abs(mobileScaleRatio - desktopScaleRatio) < tolerance) {
      const match = Object.entries(PRESET_RATIOS_MAP).find(
        ([_, value]) => Math.abs(mobileScaleRatio - value) < tolerance
      );
      if (match) {
        return match[0].split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      }
    }
    return "Custom";
  };

  useEffect(() => {
    setInputString(currentScaleRatio.toFixed(3));
  }, [currentScaleRatio]);

  useClickOutside(scaleRatioInputContainerRef, () => {
    if (isScaleRatioPresetListOpen) {
      setIsScaleRatioPresetListOpen(false);
    }
  }, isScaleRatioPresetListOpen);

  const setCurrentScaleRatio = activeMode === 'desktop' ? setDesktopScaleRatio : setMobileScaleRatio;

  const handleFluidRangeChange = ([minValue, maxValue]: [number, number]) => {
    const clampedMin = Math.max(ratioMin, Math.min(parseFloat(minValue.toFixed(3)), ratioMax));
    const clampedMax = Math.max(clampedMin, Math.min(parseFloat(maxValue.toFixed(3)), ratioMax));
    setMobileScaleRatio(clampedMin);
    setDesktopScaleRatio(clampedMax);
  };

  return (
    <div className={`section scale-ratio-section ${isOpen ? 'section-open' : ''}`}>
      <div className="section-header" tabIndex={0} role="button" onClick={onToggleOpen} onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleOpen(); } }}>
        <div className="section-header-titles-container section-header-left">
          <IconComponent name="navigate-forward-24" size={24} className={`section-header-chevron ${isOpen ? 'open' : ''}`} />
          <span className="section-title">Scale ratio</span>
        </div>
        <div
          ref={scaleRatioInputContainerRef}
          className="custom-dropdown-container header-section-dropdown-container"
        >
          <button
            className="input dropdown-trigger-button"
            onClick={(e) => {
              e.stopPropagation();
              if (!isScaleRatioPresetListOpen) {
                const rect = e.currentTarget.getBoundingClientRect();
                setScaleRatioDropdownOpensUp(rect.top > window.innerHeight / 2);
              }
              setIsScaleRatioPresetListOpen(!isScaleRatioPresetListOpen);
            }}
            aria-label="Select preset scale ratio"
          >
            <span className="dropdown-trigger-label">
              {isFluidMode
                ? getFluidDisplayText()
                : getScaleRatioDisplayText()}
            </span>
          </button>
          {isScaleRatioPresetListOpen && (
            <div
              className={`dropdown-list ${scaleRatioDropdownOpensUp ? 'dropdown-list--opens-up' : 'dropdown-list--opens-down'}`}
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className="dropdown-items-container">
                {Object.entries(PRESET_RATIOS_MAP)
                  .filter(([, value]) => value <= ratioMax)
                  .map(([name, value]) => (
                  <button
                    key={name}
                    className={`dropdown-item ${
                      isFluidMode
                        ? mobileScaleRatio === value && desktopScaleRatio === value ? 'selected' : ''
                        : !systemPreset && currentScaleRatio === value
                          ? 'selected'
                          : ''
                    }`}
                    onMouseDown={() => {
                      setSystemPreset(undefined);
                      if (isFluidMode) {
                        setMobileScaleRatio(value);
                        setDesktopScaleRatio(value);
                      } else {
                        setCurrentScaleRatio(value);
                      }
                      setIsScaleRatioPresetListOpen(false);
                    }}
                  >
                    <span className="dropdown-item-text-content">{`${value.toFixed(3)} ${name}`}</span>
                  </button>
                ))}
                {!isFluidMode && designSystemPresets.length > 0 && (
                  <Fragment>
                    <div className="dropdown-section-divider" />
                    {designSystemPresets.map((preset) => (
                      <button
                        key={preset.id}
                        className={`dropdown-item ${systemPreset === preset.id ? 'selected' : ''}`}
                        onMouseDown={() => {
                          setSystemPreset(preset.id);
                          setIsScaleRatioPresetListOpen(false);
                        }}
                      >
                        <span className="dropdown-item-text-content">{preset.label}</span>
                      </button>
                    ))}
                  </Fragment>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {isOpen && (
        !isFluidMode ? (
          <div className="section-content column">
            <div className="control-row custom-single-slider-input-row">
              <div className={`input-container-fixed ${isScaleRatioSliderDragging ? 'input-faded-out' : ''}`} style={{ width: "72px" }}>
                <input
                  type="text"
                  id={activeMode === 'desktop' ? "desktopScaleRatioNumInput" : "mobileScaleRatioNumInput"}
                  className="input number-input"
                  disabled={isPresetLocked}
                  value={inputString}
                  onChange={(e: TargetedEvent<HTMLInputElement, Event>) => {
                    setInputString(e.currentTarget.value);
                  }}
                  onBlur={(e: TargetedEvent<HTMLInputElement, Event>) => {
                    let val = parseFloat(e.currentTarget.value.replace(',', '.'));
                    if (isNaN(val)) val = currentScaleRatio;
                    val = Math.max(ratioMin, Math.min(val, ratioMax));
                    setCurrentScaleRatio(val);
                    setInputString(val.toFixed(3));
                  }}
                  onKeyDown={(e: TargetedEvent<HTMLInputElement, KeyboardEvent>) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      const change = e.key === 'ArrowUp' ? 0.001 : -0.001;
                      let newValue = currentScaleRatio + change;
                      newValue = Math.max(ratioMin, Math.min(newValue, ratioMax));
                      setCurrentScaleRatio(newValue);
                      setInputString(newValue.toFixed(3));
                    }
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                />
              </div>
              <div className="custom-single-slider-tooltip-spacer"></div>
            </div>

            <div className="control-row control-row-no-gap">
              <div className="static-label-input-look align-left">Ratio</div>
              <div
                className="slider-container"
                style={isPresetLocked ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
              >
                <CustomSingleSliderComponent
                  label="Ratio"
                  min={ratioMin}
                  max={ratioMax}
                  value={currentScaleRatio}
                  step={0.001}
                  onChange={(newValue: number) => {
                    setCurrentScaleRatio(newValue);
                  }}
                  displayDecimals={3}
                  dotValues={isPresetLocked ? [] : ratioSliderDotValues}
                  onDragStateChange={setIsScaleRatioSliderDragging}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="section-content">
            <div className="control-row-range-slider">
              <RangeSliderComponent
                min={ratioMin}
                max={ratioMax}
                step={0.001}
                values={[mobileScaleRatio, desktopScaleRatio]}
                onChange={handleFluidRangeChange}
                leftLabel="Min"
                rightLabel="Max"
                dotValues={ratioSliderDotValues}
                allowSameValues={true}
                displayDecimals={3}
              />
            </div>
          </div>
        )
      )}
    </div>
  );
}