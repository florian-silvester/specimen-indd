/**
 * Specimen InDesign — UI entry point
 * Standalone web app: side panel + canvas layout.
 * Re-uses all CSS variables and classes from the Figma Specimen plugin.
 */
import { render, h, Fragment } from 'preact';
import { useState, useMemo, useEffect, useRef, useCallback } from 'preact/hooks';

// CSS — reuse the entire Figma design system
import './ui/new-ui-styles.css';

// Icons
import { iconSvgs } from './ui/generated-icons';

// InDesign-specific modules
import { useInddStore } from './indd/store';
import {
  PAGE_SIZE_PRESETS, PAGE_SIZE_CATEGORIES,
  BASELINE_GRID_PRESETS, MARGIN_PRESETS,
  GRID_ALIGN_OPTIONS, GridAlignMode,
  MM_TO_PT, PT_TO_MM,
} from './indd/constants';
import { calculateGrid, snapLeadingToGrid, GridResult } from './indd/grid-calculator';

// Tiptap editor
import { Editor } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { Text } from '@tiptap/extension-text';
import { History } from '@tiptap/extension-history';
import { Gapcursor } from '@tiptap/extension-gapcursor';
import { StyledParagraph } from './indd/tiptap-schema';
import { StyledParagraphView, LayoutRegistry, LayoutEntry } from './indd/tiptap-nodeview';
import { storyBlocksToDoc, docToStoryBlocks } from './indd/tiptap-helpers';
import { Slice, Fragment as PMFragment } from '@tiptap/pm/model';

/**
 * Resolve grid rows for a style, respecting per-style overrides.
 * If the user has manually set a row count for this style, use that.
 * Otherwise auto-snap: smallest multiple of increment >= fontSize.
 */
function resolveGridRows(
  styleKey: string,
  fontSize: number,
  baselineIncrement: number,
  overrides: Record<string, number>,
): { gridRows: number; leadingPt: number; isOverridden: boolean } {
  const override = overrides?.[styleKey];
  if (override !== undefined && override >= 1) {
    return {
      gridRows: override,
      leadingPt: override * baselineIncrement,
      isOverridden: true,
    };
  }
  const snapped = snapLeadingToGrid(fontSize, baselineIncrement);
  return { ...snapped, isOverridden: false };
}

// Core typography (shared with Figma)
import { PRESET_RATIOS_MAP, SCALE_RATIO_MIN, SCALE_RATIO_MAX, TYPOGRAPHY_SCALE_ORDER } from './core/constants';
import { TypographySystem } from './core/types';
import { calculateStyles } from './ui/logic/typography-calculator';
import { RangeSlider } from './ui/components/RangeSlider';
import { CustomSingleSlider } from './ui/components/CustomSingleSlider';

// ── Sample text for flowing paragraphs ──────────────────────────────────────

const SAMPLE_TEXT = {
  title: 'The Art of Typography',
  subtitle: 'Foundations of the Printed Page',
  h2: 'Baseline Grid & Vertical Rhythm',
  h3: 'Understanding Leading',
  h4: 'Grid Alignment in Practice',
  body: [
    'Typography is the art and technique of arranging type to make written language legible, readable and appealing when displayed. The arrangement of type involves selecting typefaces, point sizes, line lengths, line-spacing (leading), and letter-spacing (tracking), and adjusting the space between pairs of letters (kerning).',
    'The baseline grid is the invisible foundation upon which all text sits. Like the ruled lines of a notebook, it establishes a consistent vertical rhythm that brings order and harmony to the printed page. When every line of text — regardless of size — aligns to this grid, the result is a page that feels balanced and intentional.',
    'In traditional book design, the baseline grid increment equals the leading of the body text. This ensures that body copy flows naturally across columns and pages. Headings, subheadings, and other elements occupy whole multiples of this increment, preserving the underlying rhythm even as sizes change.',
    'The relationship between type size and leading is fundamental to readability. Too tight, and the lines blur together; too loose, and the eye struggles to find the next line. The ideal ratio depends on the typeface, the measure (line length), and the context of the reading experience.',
    'Margins define the text area — the stage upon which the typographic performance takes place. In a well-designed grid, the text area height is an exact multiple of the baseline increment, ensuring that the last line of text sits precisely at the bottom margin. There is no remainder, no leftover space. The grid fills its container perfectly.',
    'When setting type for books, the inner margin (gutter) must be generous enough to prevent text from disappearing into the binding. The outer margin provides a resting place for the thumb. The top margin (head) and bottom margin (foot) frame the text block on the page, with the foot traditionally larger than the head.',
    'A well-chosen scale ratio generates a harmonious set of type sizes from a single base value. Each size in the scale relates mathematically to the others, creating visual consistency. When these sizes snap to the baseline grid, the mathematical harmony becomes visible rhythm.',
  ],
  smallText: 'Captions and annotations provide context without disrupting the flow of the main text. They sit quietly alongside images and figures, offering additional detail for the curious reader.',
  micro: 'Specimen for InDesign — Page',
};

// ── Icon component (reuse pattern) ───────────────────────────────────────────

function Icon({ name, className, size = 16 }: { name: string; className?: string; size?: number }) {
  const svgContent = iconSvgs[name];
  if (!svgContent) return <span className={`icon ${className || ''}`}>?</span>;
  return (
    <span
      className={`icon icon-${name} ${className || ''}`}
      style={{ width: `${size}px`, height: `${size}px`, display: 'inline-block', verticalAlign: 'middle' }}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}

// ── Font metrics measurement ────────────────────────────────────────────────
// Measure font ascent & descent ratios using canvas — for precise baseline
// positioning that matches the CSS half-leading model.
// CSS baseline = (lineHeight - contentArea)/2 + ascent,
// where contentArea = fontBoundingBoxAscent + fontBoundingBoxDescent.

const _metricsCanvas = document.createElement('canvas');
const _metricsCtx = _metricsCanvas.getContext('2d')!;
const _metricsCache = new Map<string, { ascent: number; descent: number }>();

/** Returns ascent & descent ratios (relative to fontSize) for a font + weight. */
function measureFontMetrics(fontFamily: string, fontWeight: number = 400): { ascent: number; descent: number } {
  const key = `${fontFamily}:${fontWeight}`;
  const cached = _metricsCache.get(key);
  if (cached) return cached;

  const refSize = 100; // large for precision
  _metricsCtx.font = `${fontWeight} ${refSize}px "${fontFamily}", serif`;
  const metrics = _metricsCtx.measureText('HhgpqABCDEFGHIJKLMNOPQRSTUVWXYZ');

  let ascent: number;
  let descent: number;
  if (metrics.fontBoundingBoxAscent !== undefined && metrics.fontBoundingBoxDescent !== undefined) {
    ascent = metrics.fontBoundingBoxAscent / refSize;
    descent = metrics.fontBoundingBoxDescent / refSize;
  } else if ((metrics as any).actualBoundingBoxAscent !== undefined) {
    ascent = (metrics as any).actualBoundingBoxAscent / refSize;
    descent = (metrics as any).actualBoundingBoxDescent / refSize || 0.2;
  } else {
    ascent = 0.82;
    descent = 0.2;
  }

  const result = { ascent, descent };
  _metricsCache.set(key, result);
  return result;
}

// ── Shared section header ────────────────────────────────────────────────────

function SectionHeader({ title, isOpen, onToggle, rightContent }: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  rightContent?: any;
}) {
  return (
    <div
      className="section-header"
      tabIndex={0}
      role="button"
      onClick={onToggle}
      onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
    >
      <div className="section-header-titles-container section-header-left">
        <Icon name="navigate-forward-24" size={24} className={`section-header-chevron ${isOpen ? 'open' : ''}`} />
        <span className="section-title">{title}</span>
      </div>
      {rightContent && (
        <div className="header-section-dropdown-container">
          {rightContent}
        </div>
      )}
    </div>
  );
}

// ── Dropdown component ───────────────────────────────────────────────────────

function Dropdown({ value, options, onChange, sections }: {
  value: string;
  options?: { value: string; label: string }[];
  onChange: (value: string) => void;
  sections?: { label: string; options: { value: string; label: string }[] }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const allOptions = sections
    ? sections.flatMap(s => s.options)
    : (options || []);
  const selected = allOptions.find(o => o.value === value);

  return (
    <div className="custom-dropdown-container" ref={ref}>
      <button
        className="input dropdown-trigger-button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
      >
        <span className="dropdown-trigger-label">{selected?.label || value}</span>
      </button>
      {open && (
        <div className="dropdown-list dropdown-list--opens-down" onMouseDown={(e) => e.preventDefault()}>
          <div className="dropdown-items-container">
            {sections ? sections.map((section, si) => (
              <Fragment key={si}>
                {si > 0 && <div className="dropdown-section-divider" />}
                <div className="dropdown-section-label">{section.label}</div>
                {section.options.map(o => (
                  <button
                    key={o.value}
                    className={`dropdown-item ${value === o.value ? 'selected' : ''}`}
                    onMouseDown={() => { onChange(o.value); setOpen(false); }}
                  >
                    <span className="dropdown-item-text-content">{o.label}</span>
                  </button>
                ))}
              </Fragment>
            )) : (options || []).map(o => (
              <button
                key={o.value}
                className={`dropdown-item ${value === o.value ? 'selected' : ''}`}
                onMouseDown={() => { onChange(o.value); setOpen(false); }}
              >
                <span className="dropdown-item-text-content">{o.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Number input with label ──────────────────────────────────────────────────

function NumberInput({ value, onChange, unit, min, max, step = 1, width = '64px' }: {
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  width?: string;
}) {
  const decimals = step >= 1 ? 0 : Math.max(1, (step.toString().split('.')[1] || '').length);
  const fmt = (v: number) => decimals > 0 ? v.toFixed(decimals) : v.toString();
  const [str, setStr] = useState(fmt(value));
  useEffect(() => { setStr(fmt(value)); }, [value, step]);

  const commit = (raw: string) => {
    let v = parseFloat(raw.replace(',', '.'));
    if (isNaN(v)) v = value;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    if (step >= 1) v = Math.round(v);
    else v = Math.round(v / step) * step;
    onChange(v);
    setStr(fmt(v));
  };

  return (
    <div className="input-container-fixed" style={{ width }}>
      <input
        type="text"
        className="input number-input"
        value={str}
        onChange={(e: any) => setStr(e.currentTarget.value)}
        onBlur={(e: any) => commit(e.currentTarget.value)}
        onKeyDown={(e: any) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const delta = e.key === 'ArrowUp' ? step : -step;
            let next = value + delta;
            if (min !== undefined) next = Math.max(min, next);
            if (max !== undefined) next = Math.min(max, next);
            onChange(Math.round(next / step) * step);
          }
        }}
        onMouseDown={(e: any) => e.stopPropagation()}
      />
      {unit && <span className="input-unit">{unit}</span>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PANEL SECTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Page Size Section ────────────────────────────────────────────────────────

function PageSizeSection() {
  const {
    pagePresetId, setPagePresetId, pageWidth, setPageWidth, pageHeight, setPageHeight,
    facingPages, setFacingPages, openSections, toggleSection,
  } = useInddStore();
  const isOpen = !!openSections.pageSize;

  const handlePresetChange = (id: string) => {
    const preset = PAGE_SIZE_PRESETS.find(p => p.id === id);
    if (preset) {
      setPagePresetId(id);
      useInddStore.setState({ pageWidth: preset.width, pageHeight: preset.height });
    }
  };

  const sections = PAGE_SIZE_CATEGORIES.map(cat => ({
    label: cat.label,
    options: PAGE_SIZE_PRESETS.filter(p => p.category === cat.id).map(p => ({
      value: p.id,
      label: `${p.label} (${p.width}×${p.height})`,
    })),
  }));

  return (
    <div className={`section ${isOpen ? 'section-open' : ''}`}>
      <SectionHeader
        title="Page size"
        isOpen={isOpen}
        onToggle={() => toggleSection('pageSize')}
        rightContent={
          <Dropdown
            value={pagePresetId}
            sections={sections}
            onChange={handlePresetChange}
          />
        }
      />
      {isOpen && (
        <div className="section-content">
          <div className="control-row">
            <span className="control-label">Width</span>
            <NumberInput value={pageWidth} onChange={setPageWidth} unit="mm" min={50} max={1000} step={0.1} />
          </div>
          <div className="control-row">
            <span className="control-label">Height</span>
            <NumberInput value={pageHeight} onChange={setPageHeight} unit="mm" min={50} max={1500} step={0.1} />
          </div>
          <div className="control-row">
            <span className="control-label">Facing pages</span>
            <label className="checkbox-right" style={{ cursor: 'pointer', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '6px' }}>
              <span className="checkbox-label">{facingPages ? 'On' : 'Off'}</span>
              <input
                type="checkbox"
                className="checkbox-input"
                checked={facingPages}
                onChange={(e: any) => setFacingPages(e.currentTarget.checked)}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Baseline Grid Section ────────────────────────────────────────────────────

function BaselineGridSection() {
  const {
    bodyLeading,
    baselineGridPresetId, setBaselineGridPresetId,
    halfGrid, setHalfGrid,
    openSections, toggleSection,
  } = useInddStore();
  const isOpen = !!openSections.baselineGrid;

  const handlePresetChange = (id: string) => {
    const preset = BASELINE_GRID_PRESETS.find(p => p.id === id);
    if (preset) {
      setBaselineGridPresetId(id);
      useInddStore.setState({ bodyLeading: preset.increment });
    }
  };

  const presetOptions = BASELINE_GRID_PRESETS.map(p => ({
    value: p.id,
    label: p.label,
  }));

  return (
    <div className={`section ${isOpen ? 'section-open' : ''}`}>
      <SectionHeader
        title="Baseline grid"
        isOpen={isOpen}
        onToggle={() => toggleSection('baselineGrid')}
        rightContent={
          <Dropdown value={baselineGridPresetId} options={presetOptions} onChange={handlePresetChange} />
        }
      />
      {isOpen && (
        <div className="section-content">
          <div className="control-row">
            <span className="control-label">Increment</span>
            <NumberInput value={bodyLeading} onChange={(v) => {
              useInddStore.setState({ bodyLeading: v, baselineGridPresetId: 'custom' });
            }} unit="pt" min={4} max={48} step={0.25} />
          </div>
          <div className="control-row">
            <span className="control-label">Half grid</span>
            <label className="checkbox-right" style={{ cursor: 'pointer', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '6px' }}>
              <span className="checkbox-label">{halfGrid ? 'On' : 'Off'}</span>
              <input
                type="checkbox"
                className="checkbox-input"
                checked={halfGrid}
                onChange={(e: any) => setHalfGrid(e.currentTarget.checked)}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Margins Section (in mm) ─────────────────────────────────────────────────

function MarginsSection({ grid }: { grid: GridResult }) {
  const {
    marginPresetId, setMarginPresetId,
    marginTopMm, setMarginTopMm,
    marginBottomMinMm, setMarginBottomMinMm,
    marginInnerMm, setMarginInnerMm,
    marginOuterMm, setMarginOuterMm,
    autoMatchBottom, setAutoMatchBottom,
    facingPages,
    openSections, toggleSection,
  } = useInddStore();
  const isOpen = !!openSections.margins;

  const handlePresetChange = (id: string) => {
    const preset = MARGIN_PRESETS.find(p => p.id === id);
    if (preset && id !== 'custom') {
      setMarginPresetId(id);
      useInddStore.setState({
        marginTopMm: preset.topMm,
        marginBottomMinMm: preset.bottomMm,
        marginInnerMm: preset.innerMm,
        marginOuterMm: preset.outerMm,
      });
    }
  };

  const presetOptions = MARGIN_PRESETS.map(p => ({
    value: p.id,
    label: p.label,
  }));

  const actualBottomMm = grid.marginBottomMm;
  const bottomDiffers = autoMatchBottom && Math.abs(actualBottomMm - marginBottomMinMm) > 0.2;

  return (
    <div className={`section ${isOpen ? 'section-open' : ''}`}>
      <SectionHeader
        title="Margins"
        isOpen={isOpen}
        onToggle={() => toggleSection('margins')}
        rightContent={
          <Dropdown value={marginPresetId} options={presetOptions} onChange={handlePresetChange} />
        }
      />
      {isOpen && (
        <div className="section-content">
          <div className="control-row">
            <span className="control-label">Top</span>
            <NumberInput value={marginTopMm} onChange={setMarginTopMm} unit="mm" min={5} max={100} step={0.5} />
          </div>
          <div className="control-row">
            <span className="control-label">{autoMatchBottom ? 'Bottom (min)' : 'Bottom'}</span>
            <NumberInput value={marginBottomMinMm} onChange={setMarginBottomMinMm} unit="mm" min={5} max={100} step={0.5} />
          </div>
          {bottomDiffers && (
            <div className="control-row">
              <span className="control-label">Bottom (actual)</span>
              <div className="static-label-input-look">{actualBottomMm.toFixed(1)} mm</div>
            </div>
          )}
          <div className="control-row">
            <span className="control-label">{facingPages ? 'Inner' : 'Left'}</span>
            <NumberInput value={marginInnerMm} onChange={setMarginInnerMm} unit="mm" min={5} max={100} step={0.5} />
          </div>
          <div className="control-row">
            <span className="control-label">{facingPages ? 'Outer' : 'Right'}</span>
            <NumberInput value={marginOuterMm} onChange={setMarginOuterMm} unit="mm" min={5} max={100} step={0.5} />
          </div>
          <div className="control-row">
            <span className="control-label">Rows</span>
            <div className="static-label-input-look">{grid.rowCount} rows</div>
          </div>
          <div className="control-row">
            <span className="control-label">Snap to grid</span>
            <label className="checkbox-right" style={{ cursor: 'pointer', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '6px' }}>
              <span className="checkbox-label">{autoMatchBottom ? 'On' : 'Off'}</span>
              <input
                type="checkbox"
                className="checkbox-input"
                checked={autoMatchBottom}
                onChange={(e: any) => setAutoMatchBottom(e.currentTarget.checked)}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Type Scale Sections ──────────────────────────────────────────────────────

function BaseSizeSection() {
  const { baseSize, setBaseSize } = useInddStore();

  return (
    <div className="section">
      <div className="section-content" style={{ paddingTop: 'var(--sizing-default-spacers-spacer-2)' }}>
        <div className="control-row">
          <span className="control-label">Base size</span>
          <NumberInput value={baseSize} onChange={setBaseSize} unit="pt" min={4} max={36} step={0.25} />
        </div>
      </div>
    </div>
  );
}

function ScaleRatioSection() {
  const { scaleRatio, setScaleRatio, openSections, toggleSection } = useInddStore();
  const isOpen = !!openSections.scaleRatio;

  const ratioName = Object.entries(PRESET_RATIOS_MAP).find(
    ([, v]) => Math.abs(v - scaleRatio) < 0.001
  )?.[0] || 'Custom';

  const ratioOptions = Object.entries(PRESET_RATIOS_MAP)
    .filter(([, v]) => v <= SCALE_RATIO_MAX)
    .map(([name, value]) => ({
      value: value.toFixed(3),
      label: `${value.toFixed(3)} ${name}`,
    }));

  // Dot values for preset ratio positions on the slider
  const presetDotValues = Object.values(PRESET_RATIOS_MAP)
    .filter(v => v >= SCALE_RATIO_MIN && v <= SCALE_RATIO_MAX);

  return (
    <div className={`section ${isOpen ? 'section-open' : ''}`}>
      <SectionHeader
        title="Scale ratio"
        isOpen={isOpen}
        onToggle={() => toggleSection('scaleRatio')}
        rightContent={
          <Dropdown
            value={scaleRatio.toFixed(3)}
            options={ratioOptions}
            onChange={(v) => setScaleRatio(parseFloat(v))}
          />
        }
      />
      {isOpen && (
        <div className="section-content">
          <div className="slider-row">
            <div className="custom-single-slider-wrapper">
              <div className="custom-single-slider-row">
                <div className="static-label-input-look align-left">{scaleRatio.toFixed(3)}</div>
                <CustomSingleSlider
                  label="Scale ratio"
                  min={SCALE_RATIO_MIN}
                  max={SCALE_RATIO_MAX}
                  step={0.001}
                  value={scaleRatio}
                  onChange={setScaleRatio}
                  displayDecimals={3}
                  dotValues={presetDotValues}
                />
                <div className="static-label-input-look align-right">{ratioName}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// LineHeightSection removed — in InDesign, the baseline grid determines leading.
// Each style's leading = ceil(fontSize / increment) × increment.

function LetterSpacingSection() {
  const {
    letterSpacing, setLetterSpacing,
    maxLetterSpacing, setMaxLetterSpacing,
    letterSpacingCurve, setLetterSpacingCurve,
    openSections, toggleSection,
  } = useInddStore();
  const isOpen = !!openSections.letterSpacing;

  const curveOptions = [
    { value: 'inverse-smooth', label: 'Ease' },
    { value: 'linear', label: 'Linear' },
    { value: 'flat', label: 'Flat' },
  ];

  return (
    <div className={`section ${isOpen ? 'section-open' : ''}`}>
      <SectionHeader
        title="Letter spacing"
        isOpen={isOpen}
        onToggle={() => toggleSection('letterSpacing')}
        rightContent={
          <Dropdown value={letterSpacingCurve} options={curveOptions} onChange={(v: any) => setLetterSpacingCurve(v)} />
        }
      />
      {isOpen && (
        <div className="section-content">
          <div className="slider-row">
            <RangeSlider
              min={-100}
              max={100}
              step={5}
              values={[Math.round(maxLetterSpacing * 10), Math.round(letterSpacing * 10)]}
              onChange={([l, r]) => {
                setMaxLetterSpacing(l / 10);
                setLetterSpacing(r / 10);
              }}
              leftLabel="Display"
              rightLabel="Small"
              valueSuffix=""
              displayDecimals={0}
              allowSameValues={true}
              isFlatMode={letterSpacingCurve === 'flat'}
              shiftMultiplier={4}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Paragraph Styles Grid ────────────────────────────────────────────────────

function ParagraphStylesGrid({ typeSystem, grid }: { typeSystem: TypographySystem; grid: GridResult }) {
  const { gridAlignMode, setGridAlignMode, gridRowOverrides, setGridRowOverride, styleVisibility, toggleStyleVisibility, spaceBefore, spaceAfter, setSpaceBefore, setSpaceAfter, sizeOverrides, setSizeOverride, trackingOverrides, setTrackingOverride } = useInddStore();
  const allStyles = TYPOGRAPHY_SCALE_ORDER.ALL_STYLES;

  const rows = allStyles.map(key => {
    const style = typeSystem[key];
    if (!style) return null;
    const visible = styleVisibility[key] !== false;
    const sizePt = sizeOverrides[key] ?? style.size;
    const resolved = resolveGridRows(key, sizePt, grid.baselineIncrement, gridRowOverrides);
    const computedTracking = Math.round(style.letterSpacing * 10);
    const tracking = trackingOverrides[key] ?? computedTracking;
    return {
      key, style, visible,
      sizePt,
      leadingPt: resolved.leadingPt,
      gridRows: resolved.gridRows,
      tracking,
      sb: spaceBefore[key] || 0,
      sa: spaceAfter[key] || 0,
    };
  }).filter(Boolean) as { key: string; style: any; visible: boolean; sizePt: number; leadingPt: number; gridRows: number; tracking: number; sb: number; sa: number }[];

  const displayName = (key: string) => {
    switch (key) {
      case 'display': return 'Display';
      case 'h1': return 'H1';
      case 'h2': return 'H2';
      case 'h3': return 'H3';
      case 'h4': return 'H4';
      case 'h5': return 'H5';
      case 'h6': return 'H6';
      case 'textLarge': return 'Text Lg';
      case 'textMain': return 'Body';
      case 'textSmall': return 'Caption';
      case 'micro': return 'Micro';
      default: return key;
    }
  };

  const cellInput = (value: number, step: number, min: number, onChange: (v: number) => void, disabled?: boolean) => (
    <NumberInput value={value} onChange={onChange} step={step} min={min} width="100%" />
  );

  return (
    <div className="section-content">
      <div className="control-row">
        <span className="control-label">Grid align</span>
        <Dropdown
          value={gridAlignMode}
          options={GRID_ALIGN_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
          onChange={(v) => setGridAlignMode(v as GridAlignMode)}
        />
      </div>

      <div className="styles-grid" style={{ '--grid-cols': '20px 1fr 48px 36px 44px 44px 32px 32px', marginTop: 'var(--sizing-default-spacers-spacer-2)' } as any}>
        <div className="grid-header-row">
          <div className="grid-cell"></div>
          <div className="grid-cell"><span className="grid-header">Style</span></div>
          <div className="grid-cell"><span className="grid-header">Size</span></div>
          <div className="grid-cell"><span className="grid-header">Rows</span></div>
          <div className="grid-cell"><span className="grid-header">Lead</span></div>
          <div className="grid-cell"><span className="grid-header">Track</span></div>
          <div className="grid-cell"><span className="grid-header" title="Space before (grid rows)">↑</span></div>
          <div className="grid-cell"><span className="grid-header" title="Space after (grid rows)">↓</span></div>
        </div>
        {rows.map(row => (
          <div key={row.key} className={`grid-style-row${row.visible ? '' : ' grid-style-row--hidden'}`}>
            <div className="grid-cell">
              <button
                type="button"
                onClick={() => toggleStyleVisibility(row.key)}
                title={row.visible ? 'Hide style' : 'Show style'}
                style={{
                  all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '16px', height: '16px', borderRadius: '2px',
                  color: row.visible ? 'var(--text-secondary)' : 'var(--text-disabled, var(--neutral-700))',
                  fontSize: '10px',
                }}
              >{row.visible ? '●' : '○'}</button>
            </div>
            <div className="grid-cell">
              <span style={{
                fontWeight: 'var(--font-weight-strong)',
                color: row.visible ? 'var(--text-default)' : 'var(--text-disabled, var(--neutral-700))',
              }}>
                {displayName(row.key)}
              </span>
            </div>
            <div className="grid-cell">
              {cellInput(row.sizePt, 0.25, 4, (v) => setSizeOverride(row.key, v))}
            </div>
            <div className="grid-cell">
              {cellInput(row.gridRows, 1, 1, (v) => setGridRowOverride(row.key, v))}
            </div>
            <div className="grid-cell">
              <div className="input-container-fixed" style={{ width: '100%' }}>
                <input
                  type="text"
                  className="input number-input"
                  value={row.leadingPt.toFixed(1).replace(/\.0$/, '')}
                  readOnly
                  tabIndex={-1}
                  style={{ color: 'var(--text-secondary)' }}
                />
              </div>
            </div>
            <div className="grid-cell">
              {cellInput(row.tracking, 1, -100, (v) => setTrackingOverride(row.key, v))}
            </div>
            <div className="grid-cell">
              {cellInput(row.sb, 1, 0, (v) => setSpaceBefore(row.key, v))}
            </div>
            <div className="grid-cell">
              {cellInput(row.sa, 1, 0, (v) => setSpaceAfter(row.key, v))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Export Panel ──────────────────────────────────────────────────────────────

function generateInDesignScript(
  typeSystem: TypographySystem,
  grid: GridResult,
  store: ReturnType<typeof useInddStore.getState>,
): string {
  const printStyles: [string, string][] = [
    ['display', 'Display'], ['h1', 'H1'], ['h2', 'H2'], ['h3', 'H3'],
    ['textMain', 'Body'], ['textSmall', 'Caption'],
  ];
  const styleLines = printStyles.map(([key, name]) => {
    const style = typeSystem[key];
    if (!style) return '';
    const snapped = store.snapToGrid
      ? snapLeadingToGrid(style.size, grid.baselineIncrement)
      : null;
    const leading = snapped ? snapped.leadingPt : Math.round(style.size * style.lineHeight * 10) / 10;
    const gridAlign = store.gridAlignMode === 'allLines'
      ? 'GridAlignment.ALIGN_BASELINE_GRID'
      : store.gridAlignMode === 'firstLineOnly'
        ? 'GridAlignment.ALIGN_FIRST_LINE_ONLY'
        : 'GridAlignment.NONE';

    const sb = ((store.spaceBefore[key] || 0) * grid.baselineIncrement).toFixed(2);
    const sa = ((store.spaceAfter[key] || 0) * grid.baselineIncrement).toFixed(2);
    return `  createOrUpdateStyle("${name}", "${store.fontFamily}", "${store.fontStyle}", ${style.size}, ${leading.toFixed(2)}, ${gridAlign}, ${sb}, ${sa});`;
  }).filter(Boolean).join('\n');

  return `// Specimen InDesign — Generated Paragraph Styles
// Page: ${store.pageWidth}×${store.pageHeight} mm
// Baseline grid: ${grid.baselineIncrement.toFixed(1)} pt
// Generated: ${new Date().toISOString().split('T')[0]}

var doc = app.activeDocument;

// Set baseline grid
doc.gridPreferences.baselineDivision = ${grid.baselineIncrement.toFixed(2)};
doc.gridPreferences.baselineStart = ${grid.marginTopPt.toFixed(2)};
doc.gridPreferences.baselineGridShown = true;

// Set margins on all pages
for (var i = 0; i < doc.pages.length; i++) {
  var page = doc.pages.item(i);
  page.marginPreferences.top = ${grid.marginTopPt.toFixed(2)};
  page.marginPreferences.bottom = ${grid.marginBottomPt.toFixed(2)};
  page.marginPreferences.left = ${grid.marginInnerPt.toFixed(2)};
  page.marginPreferences.right = ${grid.marginOuterPt.toFixed(2)};
}

// Helper: create or update a paragraph style
function createOrUpdateStyle(name, fontFamily, fontStyle, size, leading, gridAlign, spaceBefore, spaceAfter) {
  var style;
  try {
    style = doc.paragraphStyles.itemByName(name);
    if (!style.isValid) throw new Error();
  } catch (e) {
    style = doc.paragraphStyles.add({name: name});
  }
  style.appliedFont = fontFamily;
  style.fontStyle = fontStyle;
  style.pointSize = size;
  style.leading = leading;
  style.spaceBefore = spaceBefore;
  style.spaceAfter = spaceAfter;
  if (gridAlign === GridAlignment.NONE) {
    style.gridAlignFirstLineOnly = false;
  } else if (gridAlign === GridAlignment.ALIGN_FIRST_LINE_ONLY) {
    style.gridAlignFirstLineOnly = true;
  } else {
    style.gridAlignFirstLineOnly = false;
    style.gridAlignment = gridAlign;
  }
}

// Create styles
${styleLines}

alert("Specimen: " + ${printStyles.length} + " paragraph styles created/updated.");
`;
}

function ExportPanel({ typeSystem, grid }: { typeSystem: TypographySystem; grid: GridResult }) {
  const store = useInddStore.getState();
  const [copied, setCopied] = useState(false);

  const script = useMemo(
    () => generateInDesignScript(typeSystem, grid, store),
    [typeSystem, grid],
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(script).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    const blob = new Blob([script], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'specimen-styles.jsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="section-content">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sizing-default-spacers-spacer-2)' }}>
        <button className="button button-primary-new" onClick={handleDownload}>
          Download .jsx
        </button>
        <button className="button button-secondary-new" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy script'}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CANVAS PREVIEW — Flowing text across pages, snapped to baseline grid
// ═══════════════════════════════════════════════════════════════════════════════

/** A text block: style key + text content + computed metrics */
interface TextBlock {
  storyIndex: number;  // index in the story array (for editing)
  styleKey: string;
  text: string;
  sizePt: number;
  leadingPt: number;
  gridRows: number;
  letterSpacing: number;
  fontWeight: number;
  spaceBeforePt: number;
  spaceAfterPt: number;
}

/** Build a sequence of text blocks (the "story") that flows across pages */
/** Default story structure used when no custom story is set */
const DEFAULT_STORY: { styleKey: string; text: string }[] = [
  { styleKey: 'display', text: SAMPLE_TEXT.title },
  { styleKey: 'h2', text: SAMPLE_TEXT.subtitle },
  { styleKey: 'textMain', text: SAMPLE_TEXT.body[0] },
  { styleKey: 'textMain', text: SAMPLE_TEXT.body[1] },
  { styleKey: 'h3', text: SAMPLE_TEXT.h2 },
  { styleKey: 'textMain', text: SAMPLE_TEXT.body[2] },
  { styleKey: 'textMain', text: SAMPLE_TEXT.body[3] },
  { styleKey: 'h4', text: SAMPLE_TEXT.h3 },
  { styleKey: 'textMain', text: SAMPLE_TEXT.body[4] },
  { styleKey: 'textMain', text: SAMPLE_TEXT.body[5] },
  { styleKey: 'h3', text: SAMPLE_TEXT.h4 },
  { styleKey: 'textMain', text: SAMPLE_TEXT.body[6] },
  { styleKey: 'textMain', text: SAMPLE_TEXT.body[0] },
  { styleKey: 'textSmall', text: SAMPLE_TEXT.smallText },
  { styleKey: 'h2', text: 'Proportions & Harmony' },
  { styleKey: 'textMain', text: SAMPLE_TEXT.body[3] },
  { styleKey: 'textMain', text: SAMPLE_TEXT.body[4] },
  { styleKey: 'textMain', text: SAMPLE_TEXT.body[5] },
  { styleKey: 'h3', text: 'The Role of White Space' },
  { styleKey: 'textMain', text: SAMPLE_TEXT.body[6] },
  { styleKey: 'textMain', text: SAMPLE_TEXT.body[0] },
  { styleKey: 'textMain', text: SAMPLE_TEXT.body[1] },
  { styleKey: 'h4', text: 'Margins & Gutters' },
  { styleKey: 'textMain', text: SAMPLE_TEXT.body[2] },
  { styleKey: 'textMain', text: SAMPLE_TEXT.body[3] },
  { styleKey: 'textSmall', text: SAMPLE_TEXT.smallText },
  { styleKey: 'textMain', text: SAMPLE_TEXT.body[4] },
  { styleKey: 'textMain', text: SAMPLE_TEXT.body[5] },
];

function buildStory(
  typeSystem: TypographySystem,
  grid: GridResult,
  snapToGrid: boolean,
  gridRowOverrides: Record<string, number>,
  spaceBefore: Record<string, number>,
  spaceAfter: Record<string, number>,
  storyBlocks: { styleKey: string; text: string }[] | null,
): TextBlock[] {
  const blocks: TextBlock[] = [];
  const increment = grid.baselineIncrement;
  const source = storyBlocks || DEFAULT_STORY;

  source.forEach((entry, index) => {
    const style = typeSystem[entry.styleKey];
    if (!style) return;
    const resolved = snapToGrid
      ? resolveGridRows(entry.styleKey, style.size, grid.baselineIncrement, gridRowOverrides)
      : null;
    const leadingPt = resolved ? resolved.leadingPt : Math.round(style.size * style.lineHeight * 10) / 10;
    const gridRows = resolved ? resolved.gridRows : Math.max(1, Math.ceil(leadingPt / grid.baselineIncrement));
    blocks.push({
      storyIndex: index,
      styleKey: entry.styleKey,
      text: entry.text,
      sizePt: style.size,
      leadingPt,
      gridRows,
      letterSpacing: style.letterSpacing || 0,
      fontWeight: style.fontWeight || 400,
      spaceBeforePt: (spaceBefore[entry.styleKey] || 0) * increment,
      spaceAfterPt: (spaceAfter[entry.styleKey] || 0) * increment,
    });
  });

  return blocks;
}

/**
 * Flow text blocks across pages. Each block occupies N grid rows.
 * Text wraps within the text area width. A block that doesn't fit
 * on the current page continues on the next page.
 */
interface PageContent {
  elements: {
    block: TextBlock;
    yPt: number;      // from top of text area
    heightPt: number;  // how much of this block is on this page
    isOverflow: boolean; // continued from previous page
    text: string;      // the text for this page (may be full or partial)
  }[];
}

function flowTextToPages(
  blocks: TextBlock[],
  grid: GridResult,
  pageCount: number,
): PageContent[] {
  const pages: PageContent[] = [];
  const textAreaHeightPt = grid.textAreaHeightPt;
  const increment = grid.baselineIncrement;

  let currentPage: PageContent = { elements: [] };
  let cursorPt = 0; // current Y position in pt from top of text area

  for (const block of blocks) {
    if (pages.length >= pageCount) break;

    // How many grid lines does one line of this block occupy?
    const linesPerRow = block.gridRows;
    const rowHeightPt = linesPerRow * increment;

    // For body text, estimate how many lines this paragraph needs
    // based on characters per line (rough estimate: ~65 chars per line at body size)
    const charsPerLine = Math.max(20, Math.floor(grid.textAreaWidthPt / (block.sizePt * 0.5)));
    const totalLines = Math.max(1, Math.ceil(block.text.length / charsPerLine));
    const totalHeightPt = totalLines * rowHeightPt;

    // Space before (from store, in grid rows converted to pt)
    const isHeading = ['display', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(block.styleKey);
    if (cursorPt > 0 && block.spaceBeforePt > 0) {
      cursorPt += block.spaceBeforePt;
    } else if (isHeading && cursorPt > 0 && block.spaceBeforePt === 0) {
      cursorPt += increment; // default 1 row before headings if no explicit space set
    }

    // Does this block fit on the current page?
    let remainingOnPage = textAreaHeightPt - cursorPt;

    // If a heading doesn't have room for at least itself + 2 lines of text, push to next page
    if (isHeading && remainingOnPage < rowHeightPt + 2 * increment) {
      // Move to next page
      pages.push(currentPage);
      currentPage = { elements: [] };
      cursorPt = 0;
      remainingOnPage = textAreaHeightPt;
      if (pages.length >= pageCount) break;
    }

    if (totalHeightPt <= remainingOnPage) {
      // Block fits entirely on this page
      currentPage.elements.push({
        block,
        yPt: cursorPt,
        heightPt: totalHeightPt,
        isOverflow: false,
        text: block.text,
      });
      cursorPt += totalHeightPt + block.spaceAfterPt;
    } else {
      // Block needs to split across pages
      const linesOnThisPage = Math.floor(remainingOnPage / rowHeightPt);

      if (linesOnThisPage > 0) {
        const splitPoint = Math.floor(block.text.length * (linesOnThisPage / totalLines));
        const textOnThisPage = block.text.slice(0, splitPoint);
        const textOnNextPage = block.text.slice(splitPoint);

        currentPage.elements.push({
          block,
          yPt: cursorPt,
          heightPt: linesOnThisPage * rowHeightPt,
          isOverflow: false,
          text: textOnThisPage,
        });

        // Move to next page
        pages.push(currentPage);
        currentPage = { elements: [] };
        cursorPt = 0;
        if (pages.length >= pageCount) break;

        // Continue block on next page
        const remainingLines = totalLines - linesOnThisPage;
        const remainingHeight = remainingLines * rowHeightPt;

        currentPage.elements.push({
          block,
          yPt: 0,
          heightPt: Math.min(remainingHeight, textAreaHeightPt),
          isOverflow: true,
          text: textOnNextPage,
        });
        cursorPt = Math.min(remainingHeight, textAreaHeightPt);
      } else {
        // No room at all, go to next page
        pages.push(currentPage);
        currentPage = { elements: [] };
        cursorPt = 0;
        if (pages.length >= pageCount) break;

        currentPage.elements.push({
          block,
          yPt: 0,
          heightPt: Math.min(totalHeightPt, textAreaHeightPt),
          isOverflow: false,
          text: block.text,
        });
        cursorPt = Math.min(totalHeightPt, textAreaHeightPt);
      }
    }
  }

  // Push last page
  if (currentPage.elements.length > 0 && pages.length < pageCount) {
    pages.push(currentPage);
  }

  // Pad with empty pages if needed
  while (pages.length < pageCount) {
    pages.push({ elements: [] });
  }

  return pages;
}

// Tiptap removed parseGlobalContainer — editor handles parsing

/** Visual-only page component — renders margins, baseline grid, and page number */
function PageView({
  pageIndex,
  pw, ph,
  mTop, mBottom, mLeft, mRight,
  textW, textH,
  gridLineSpacingPx,
  gridLineCount,
  showBaselines,
  isVerso,
}: {
  pageIndex: number;
  pw: number; ph: number;
  mTop: number; mBottom: number; mLeft: number; mRight: number;
  textW: number; textH: number;
  gridLineSpacingPx: number;
  gridLineCount: number;
  showBaselines: boolean;
  isVerso: boolean;
}) {
  const actualMLeft = isVerso ? mRight : mLeft;
  const actualMRight = isVerso ? mLeft : mRight;

  return (
    <div
      className="indd-page"
      style={{ position: 'absolute', width: `${pw}px`, height: `${ph}px`, left: 0, top: 0 }}
    >
      {/* Margin guides */}
      <div
        className="indd-margins-overlay"
        style={{
          left: `${actualMLeft}px`,
          top: `${mTop}px`,
          width: `${textW}px`,
          height: `${textH}px`,
        }}
      />

      {/* Baseline grid lines */}
      {showBaselines && Array.from({ length: gridLineCount }, (_, i) => (
        <div
          key={i}
          className="indd-baseline-line"
          style={{
            top: `${mTop + (i + 1) * gridLineSpacingPx}px`,
            left: `${actualMLeft}px`,
            right: `${actualMRight}px`,
          }}
        />
      ))}

      {/* Page number */}
      <div
        className="indd-type-specimen-label"
        style={{
          bottom: `${mBottom * 0.3}px`,
          [isVerso ? 'left' : 'right']: `${(isVerso ? actualMLeft : actualMRight)}px`,
        }}
      >
        {pageIndex + 1}
      </div>
    </div>
  );
}

/**
 * Tiptap-powered text overlay — single ProseMirror editor spanning all pages.
 * Handles cross-page selection, undo/redo, paste, and paragraph splitting.
 */
function TiptapTextOverlay({
  pagePositions,
  pageContents,
  ptToPx,
  fontFamily,
  grid,
  mTop,
  mInner,
  mOuter,
  textW,
  textH,
  facingPages,
  pw,
  totalW,
  totalH,
}: {
  pagePositions: { x: number; y: number }[];
  pageContents: PageContent[];
  ptToPx: (pt: number) => number;
  fontFamily: string;
  grid: GridResult;
  mTop: number;
  mInner: number;
  mOuter: number;
  textW: number;
  textH: number;
  facingPages: boolean;
  pw: number;
  totalW: number;
  totalH: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const layoutRegistryRef = useRef<LayoutRegistry>(new Map());
  const isSyncingFromStoreRef = useRef(false);
  const syncTimerRef = useRef<any>(null);

  // Compute layout entries for each story block (non-overflow, first occurrence)
  const layoutMap = useMemo(() => {
    const map: LayoutRegistry = new Map();

    for (let pi = 0; pi < pageContents.length; pi++) {
      const page = pageContents[pi];
      const pos = pagePositions[pi];
      if (!page || !pos) continue;

      const isVerso = facingPages && pi > 0 && pi % 2 === 1;
      const marginLeft = isVerso ? mOuter : mInner;

      for (const el of page.elements) {
        // Only map the first occurrence (non-overflow) for each storyIndex
        if (el.isOverflow) continue;
        if (map.has(el.block.storyIndex)) continue;

        const sizePx = ptToPx(el.block.sizePt);
        const leadingPx = ptToPx(el.block.leadingPt);
        const yPx = ptToPx(el.yPt);
        const incrementPx = ptToPx(grid.baselineIncrement);
        const letterSpacingEm = `${(el.block.letterSpacing / 100).toFixed(4)}em`;

        const fm = measureFontMetrics(fontFamily, el.block.fontWeight);
        const contentAreaPx = sizePx * (fm.ascent + fm.descent);
        const ascentPx = sizePx * fm.ascent;
        const baselineOffsetPx = (leadingPx - contentAreaPx) / 2 + ascentPx;
        const elementTopInPage = mTop + yPx + incrementPx - baselineOffsetPx;
        const heightPx = ptToPx(el.heightPt) + baselineOffsetPx;

        map.set(el.block.storyIndex, {
          globalX: pos.x + marginLeft,
          globalY: pos.y + elementTopInPage,
          sizePx,
          leadingPx,
          letterSpacingEm,
          heightPx,
          fontFamily,
          fontWeight: el.block.fontWeight,
          textW: ptToPx(grid.textAreaWidthPt),
          isOverflow: false,
        });
      }
    }
    return map;
  }, [pageContents, pagePositions, ptToPx, fontFamily, grid, mTop, mInner, mOuter, textW, textH, facingPages]);

  // Compute overflow elements for rendering outside the editor
  const overflowElements = useMemo(() => {
    const elements: {
      key: string;
      globalX: number;
      globalY: number;
      sizePx: number;
      leadingPx: number;
      letterSpacingEm: string;
      heightPx: number;
      fontWeight: number;
      text: string;
    }[] = [];

    for (let pi = 0; pi < pageContents.length; pi++) {
      const page = pageContents[pi];
      const pos = pagePositions[pi];
      if (!page || !pos) continue;

      const isVerso = facingPages && pi > 0 && pi % 2 === 1;
      const marginLeft = isVerso ? mOuter : mInner;

      for (const el of page.elements) {
        if (!el.isOverflow) continue;

        const sizePx = ptToPx(el.block.sizePt);
        const leadingPx = ptToPx(el.block.leadingPt);
        const yPx = ptToPx(el.yPt);
        const incrementPx = ptToPx(grid.baselineIncrement);
        const letterSpacingEm = `${(el.block.letterSpacing / 100).toFixed(4)}em`;

        const fm = measureFontMetrics(fontFamily, el.block.fontWeight);
        const contentAreaPx = sizePx * (fm.ascent + fm.descent);
        const ascentPx = sizePx * fm.ascent;
        const baselineOffsetPx = (leadingPx - contentAreaPx) / 2 + ascentPx;
        const elementTopInPage = mTop + yPx + incrementPx - baselineOffsetPx;
        const heightPx = ptToPx(el.heightPt) + baselineOffsetPx;

        elements.push({
          key: `overflow-${pi}-${el.block.storyIndex}`,
          globalX: pos.x + marginLeft,
          globalY: pos.y + elementTopInPage,
          sizePx,
          leadingPx,
          letterSpacingEm,
          heightPx,
          fontWeight: el.block.fontWeight,
          text: el.text,
        });
      }
    }
    return elements;
  }, [pageContents, pagePositions, ptToPx, fontFamily, grid, mTop, mInner, mOuter, textW, textH, facingPages]);

  // Initialize Tiptap editor (pre-populate registry before creating)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || editorRef.current) return;

    // Pre-populate registry so NodeViews get positions on creation
    const registry = layoutRegistryRef.current;
    registry.clear();
    for (const [key, value] of layoutMap) {
      registry.set(key, value);
    }

    const store = useInddStore.getState();
    const initialBlocks = store.storyBlocks || DEFAULT_STORY;

    const editor = new Editor({
      element: el,
      extensions: [
        Document,
        Text,
        History,
        Gapcursor,
        StyledParagraph.extend({
          addNodeView() {
            return ({ node, view, getPos }) => {
              return new StyledParagraphView(node, view, getPos, registry);
            };
          },
        }),
      ],
      content: storyBlocksToDoc(initialBlocks),
      editorProps: {
        attributes: {
          style: `position:absolute;left:0;top:0;width:${totalW}px;height:${totalH}px;outline:none;cursor:text;z-index:1;`,
          spellcheck: 'false',
        },
        // Custom clipboard text parser: split pasted text into StyledParagraph nodes
        clipboardTextParser: (text, $context, plain, view) => {
          const paragraphs = text.split(/\n/).filter(line => line.length > 0);
          const schema = view.state.schema;
          const nodes = paragraphs.map(line =>
            schema.nodes.styledParagraph.create(
              { styleKey: 'textMain', storyIndex: 0 },
              line ? [schema.text(line)] : [],
            ),
          );
          // Return a Slice
          return Slice.maxOpen(PMFragment.from(nodes));
        },
      },
    });

    // Sync editor changes to Zustand store (debounced)
    editor.on('update', () => {
      if (isSyncingFromStoreRef.current) return;
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => {
        const blocks = docToStoryBlocks(editor.state.doc);
        const store = useInddStore.getState();
        // Avoid writing back if content matches
        const current = store.storyBlocks || DEFAULT_STORY;
        const changed = blocks.length !== current.length ||
          blocks.some((b, i) => b.text !== current[i]?.text || b.styleKey !== current[i]?.styleKey);
        if (changed) {
          isSyncingFromStoreRef.current = true;
          store.setStoryBlocks(blocks);
          // Re-index storyIndex attrs to match new store indices
          const { tr } = editor.state;
          let pos = 0;
          editor.state.doc.forEach((node, offset, index) => {
            if (node.attrs.storyIndex !== index) {
              tr.setNodeMarkup(offset, undefined, { ...node.attrs, storyIndex: index });
            }
          });
          if (tr.docChanged) editor.view.dispatch(tr);
          isSyncingFromStoreRef.current = false;
        }
      }, 200);
    });

    // Track selection for style picker
    editor.on('selectionUpdate', () => {
      const { $from } = editor.state.selection;
      const node = $from.parent;
      if (node.type.name === 'styledParagraph') {
        useInddStore.getState().setActiveBlockIndex(node.attrs.storyIndex);
      }
    });

    editorRef.current = editor;

    return () => {
      editor.destroy();
      editorRef.current = null;
    };
  }, []); // mount once

  // Update layout registry when positions change, then refresh NodeView DOM directly
  useEffect(() => {
    const registry = layoutRegistryRef.current;
    registry.clear();
    for (const [key, value] of layoutMap) {
      registry.set(key, value);
    }

    const editor = editorRef.current;
    if (editor && !editor.isDestroyed) {
      // Update editor element size
      const editorEl = editor.view.dom as HTMLElement;
      editorEl.style.width = `${totalW}px`;
      editorEl.style.height = `${totalH}px`;

      // Directly update each NodeView's DOM from the registry
      const contentEl = editorEl;
      for (const child of Array.from(contentEl.children) as HTMLElement[]) {
        const si = parseInt(child.dataset?.storyIndex || '-1', 10);
        if (si < 0) continue;
        const layout = registry.get(si);
        if (layout) {
          const s = child.style;
          s.position = 'absolute';
          s.left = `${layout.globalX}px`;
          s.top = `${layout.globalY}px`;
          s.width = `${layout.textW}px`;
          s.height = `${layout.heightPx}px`;
          s.overflow = 'hidden';
          s.fontSize = `${layout.sizePx}px`;
          s.lineHeight = `${layout.leadingPx}px`;
          s.letterSpacing = layout.letterSpacingEm;
          s.fontFamily = `"${layout.fontFamily}", serif`;
          s.fontWeight = String(layout.fontWeight);
          s.color = '#000';
          s.opacity = '';
          s.pointerEvents = '';
        } else {
          child.style.position = 'absolute';
          child.style.opacity = '0';
          child.style.pointerEvents = 'none';
        }
      }
    }
  }, [layoutMap, totalW, totalH]);

  // Sync Zustand store → editor when storyBlocks changes externally
  useEffect(() => {
    const unsub = useInddStore.subscribe((state, prevState) => {
      if (isSyncingFromStoreRef.current) return;
      if (state.storyBlocks === prevState.storyBlocks) return;

      const editor = editorRef.current;
      if (!editor || editor.isDestroyed) return;

      const blocks = state.storyBlocks || DEFAULT_STORY;
      isSyncingFromStoreRef.current = true;
      editor.commands.setContent(storyBlocksToDoc(blocks));
      isSyncingFromStoreRef.current = false;
    });
    return unsub;
  }, []);

  return (
    <Fragment>
      {/* Tiptap mounts its own contentEditable inside this container */}
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: `${totalW}px`,
          height: `${totalH}px`,
          zIndex: 1,
        }}
      />

      {/* Overflow text (continued from previous page) — non-editable */}
      {overflowElements.map(ov => (
        <div
          key={ov.key}
          style={{
            position: 'absolute',
            left: `${ov.globalX}px`,
            top: `${ov.globalY}px`,
            width: `${ptToPx(grid.textAreaWidthPt)}px`,
            height: `${ov.heightPx}px`,
            overflow: 'hidden',
            fontSize: `${ov.sizePx}px`,
            lineHeight: `${ov.leadingPx}px`,
            letterSpacing: ov.letterSpacingEm,
            fontFamily: `"${fontFamily}", serif`,
            fontWeight: ov.fontWeight,
            color: '#000',
            opacity: 0.6,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        >
          {ov.text}
        </div>
      ))}
    </Fragment>
  );
}

// ── Floating style picker (appears when a text block is focused) ──────────────

function StylePicker() {
  const [activeIdx, setActiveIdx] = useState(-1);
  const [blocks, setBlocks] = useState<{ styleKey: string; text: string }[] | null>(null);
  const [open, setOpen] = useState(false);

  // Subscribe to store changes manually (Preact compat workaround)
  useEffect(() => {
    const unsub = useInddStore.subscribe((state) => {
      setActiveIdx(state.activeBlockIndex);
      setBlocks(state.storyBlocks);
    });
    return unsub;
  }, []);

  const active = activeIdx >= 0;
  const source = blocks || DEFAULT_STORY;
  const current = active ? source[activeIdx] : null;

  const displayName = (key: string) => {
    switch (key) {
      case 'display': return 'Display';
      case 'h1': return 'H1';
      case 'h2': return 'H2';
      case 'h3': return 'H3';
      case 'h4': return 'H4';
      case 'h5': return 'H5';
      case 'h6': return 'H6';
      case 'textLarge': return 'Text Lg';
      case 'textMain': return 'Body';
      case 'textSmall': return 'Caption';
      case 'micro': return 'Micro';
      default: return key;
    }
  };

  const allStyles = TYPOGRAPHY_SCALE_ORDER.ALL_STYLES;

  const changeStyle = (newKey: string) => {
    const s = useInddStore.getState();
    if (!s.storyBlocks) {
      const initial = DEFAULT_STORY.map((b, i) =>
        i === activeIdx ? { ...b, styleKey: newKey } : { ...b }
      );
      s.setStoryBlocks(initial);
    } else {
      s.updateStoryBlockStyle(activeIdx, newKey);
    }
    setOpen(false);
  };

  return (
    <div className="indd-style-picker" style={{
      position: 'absolute',
      top: '12px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 100,
      display: active ? 'flex' : 'none',
      alignItems: 'center',
      gap: '6px',
    }}>
      <div style={{ position: 'relative' }}>
        <button
          className="button-secondary-new"
          onClick={() => setOpen(!open)}
          style={{ minWidth: '80px', fontSize: '11px' }}
        >
          {current ? displayName(current.styleKey) : '—'} ▾
        </button>
        {open && current && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '4px',
            background: 'var(--bg-primary, #2a2a2a)',
            border: '1px solid var(--border-primary, #444)',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,.4)',
            overflow: 'hidden',
            minWidth: '120px',
          }}>
            {allStyles.map(key => (
              <button
                key={key}
                onClick={() => changeStyle(key)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '5px 12px',
                  border: 'none',
                  background: key === current.styleKey ? 'var(--bg-tertiary, #444)' : 'transparent',
                  color: 'var(--text-primary, #eee)',
                  fontSize: '11px',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e: any) => { e.currentTarget.style.background = 'var(--bg-secondary, #333)'; }}
                onMouseLeave={(e: any) => { e.currentTarget.style.background = key === current.styleKey ? 'var(--bg-tertiary, #444)' : 'transparent'; }}
              >
                {displayName(key)}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        className="button-secondary-new"
        onClick={() => { useInddStore.getState().setActiveBlockIndex(-1); setOpen(false); }}
        style={{ fontSize: '11px', padding: '4px 8px' }}
      >
        ✕
      </button>
    </div>
  );
}

function CanvasPreview({ grid, typeSystem }: { grid: GridResult; typeSystem: TypographySystem }) {
  const store = useInddStore();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);

  // Recalculate fit scale on resize or page change
  const recalcFit = useCallback(() => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const pad = 80;
    const spreadW = store.facingPages ? store.pageWidth * 2 + 4 : store.pageWidth;
    const availW = rect.width - pad * 2;
    const availH = rect.height - pad * 2;
    const s = Math.min(availW / spreadW, availH / store.pageHeight, 4);
    const fs = Math.max(0.1, s);
    setFitScale(fs);
    store.setLastFitScale(fs);
  }, [store.pageWidth, store.pageHeight, store.facingPages]);

  useEffect(() => {
    recalcFit();
    window.addEventListener('resize', recalcFit);
    return () => window.removeEventListener('resize', recalcFit);
  }, [recalcFit, store.fitSignal]);

  // Pinch-to-zoom (trackpad sends wheel events with ctrlKey=true)
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const s = useInddStore.getState();
      const currentZoom = s.zoom === 0 ? s.lastFitScale : s.zoom;
      const delta = -e.deltaY * 0.01;
      const next = Math.max(0.1, Math.min(15, currentZoom * (1 + delta)));
      const ratio = next / currentZoom;

      // Zoom toward cursor: keep the point under the pinch fixed
      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      const contentX = el.scrollLeft + cursorX;
      const contentY = el.scrollTop + cursorY;
      const newScrollLeft = contentX * ratio - cursorX;
      const newScrollTop = contentY * ratio - cursorY;

      s.setZoom(next);
      requestAnimationFrame(() => {
        el.scrollLeft = Math.max(0, newScrollLeft);
        el.scrollTop = Math.max(0, newScrollTop);
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // 96 CSS px per inch / 25.4 mm per inch ≈ 3.78 px/mm  →  that's "100%" (physical size)
  const PX_PER_MM = 96 / 25.4;
  const scale = store.zoom === 0 ? fitScale : store.zoom;
  const zoomPercent = Math.round((scale / PX_PER_MM) * 100);

  // Page dimensions in CSS px (page size is in mm, scale maps mm→px)
  const ptToPx = (pt: number) => pt * PT_TO_MM * scale;
  const pw = store.pageWidth * scale;
  const ph = store.pageHeight * scale;

  // Margins in CSS px — use pt values for precision (mm values are rounded for display)
  const mTop = ptToPx(grid.marginTopPt);
  const mBottom = ptToPx(grid.marginBottomPt);
  const mInner = ptToPx(grid.marginInnerPt);
  const mOuter = ptToPx(grid.marginOuterPt);
  const textW = ptToPx(grid.textAreaWidthPt);
  const textH = ptToPx(grid.textAreaHeightPt);

  // Grid line spacing — use exact pt conversion (not rounded mm) to match text positioning
  const gridLineSpacingPx = ptToPx(grid.gridLineSpacing);
  const canShowBaselines = gridLineSpacingPx > 2;
  const gridLineCount = canShowBaselines ? grid.gridLineCount : 0;

  // Build story and flow across pages
  const story = useMemo(
    () => buildStory(typeSystem, grid, store.snapToGrid, store.gridRowOverrides, store.spaceBefore, store.spaceAfter, store.storyBlocks),
    [typeSystem, grid, store.snapToGrid, store.gridRowOverrides, store.spaceBefore, store.spaceAfter, store.storyBlocks],
  );

  const pageContents = useMemo(
    () => flowTextToPages(story, grid, store.pageCount),
    [story, grid, store.pageCount],
  );

  // Build spreads
  const pageCount = store.pageCount;
  const spreads: { pages: number[] }[] = [];
  if (store.facingPages) {
    spreads.push({ pages: [0] });
    for (let i = 1; i < pageCount; i += 2) {
      const pair = [i];
      if (i + 1 < pageCount) pair.push(i + 1);
      spreads.push({ pages: pair });
    }
  } else {
    for (let i = 0; i < pageCount; i++) {
      spreads.push({ pages: [i] });
    }
  }

  const spreadGap = 32;

  return (
    <div className="indd-canvas" ref={canvasRef}>
      {/* Info badges */}
      <div className="indd-canvas-info">
        <span className="indd-info-badge">{store.pageWidth}×{store.pageHeight} mm</span>
        <span className="indd-info-badge">{grid.baselineIncrement.toFixed(1)} pt grid</span>
        <span className="indd-info-badge">{grid.rowCount} rows</span>
      </div>

      {/* Zoom controls */}
      <div className="indd-canvas-controls">
        <button className="button-secondary-new" onClick={store.zoomOut}>−</button>
        <button className="button-secondary-new" onClick={store.zoomFit} style={{ minWidth: '48px' }}>
          {zoomPercent}%
        </button>
        <button className="button-secondary-new" onClick={store.zoomIn}>+</button>
      </div>

      {/* Absolutely positioned pages + global text overlay */}
      {(() => {
        const padding = 48;
        const facingGap = store.facingPages ? 4 : 0;

        // Compute page positions
        const pagePos: { x: number; y: number }[] = [];
        const maxSpreadPages = Math.max(...spreads.map(s => s.pages.length));
        const maxSpreadW = maxSpreadPages * pw + (maxSpreadPages > 1 ? facingGap : 0);
        let yOff = 0;

        for (const spread of spreads) {
          const spreadW = spread.pages.length * pw + (spread.pages.length > 1 ? facingGap : 0);
          const spreadX = (maxSpreadW - spreadW) / 2;
          for (let i = 0; i < spread.pages.length; i++) {
            const pi = spread.pages[i];
            pagePos[pi] = {
              x: spreadX + i * (pw + facingGap),
              y: yOff,
            };
          }
          yOff += ph + spreadGap;
        }

        const totalH = yOff - spreadGap;
        const totalW = maxSpreadW;

        return (
          <div style={{
            position: 'relative',
            width: `${totalW}px`,
            height: `${totalH}px`,
            margin: `${padding}px auto`,
          }}>
            {/* Visual page chrome (margins, grid, page numbers) */}
            {Array.from({ length: pageCount }, (_, pi) => {
              const pos = pagePos[pi];
              if (!pos) return null;
              const isVerso = store.facingPages && pi > 0 && pi % 2 === 1;
              return (
                <div key={pi} style={{ position: 'absolute', left: `${pos.x}px`, top: `${pos.y}px` }}>
                  <PageView
                    pageIndex={pi}
                    pw={pw} ph={ph}
                    mTop={mTop} mBottom={mBottom}
                    mLeft={mInner} mRight={mOuter}
                    textW={textW} textH={textH}
                    gridLineSpacingPx={gridLineSpacingPx}
                    gridLineCount={gridLineCount}
                    showBaselines={store.showBaselines && canShowBaselines}
                    isVerso={isVerso}
                  />
                </div>
              );
            })}

            {/* Global text overlay — single contentEditable for cross-page selection */}
            <TiptapTextOverlay
              pagePositions={pagePos}
              pageContents={pageContents}
              ptToPx={ptToPx}
              fontFamily={store.fontFamily}
              grid={grid}
              mTop={mTop}
              mInner={mInner}
              mOuter={mOuter}
              textW={textW}
              textH={textH}
              facingPages={store.facingPages}
              pw={pw}
              totalW={totalW}
              totalH={totalH}
            />
          </div>
        );
      })()}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN APP — Panel + Canvas
// ═══════════════════════════════════════════════════════════════════════════════

function App() {
  const store = useInddStore();

  // Apply dark theme on mount
  useEffect(() => {
    document.body.classList.toggle('dark-theme', store.colorMode === 'dark');
  }, []);

  // ── Compute grid ──────────────────────────────────────────────────────────
  const grid = useMemo(() => calculateGrid({
    pageWidth: store.pageWidth,
    pageHeight: store.pageHeight,
    bodyLeading: store.bodyLeading,
    marginTopMm: store.marginTopMm,
    marginBottomMinMm: store.marginBottomMinMm,
    marginInnerMm: store.marginInnerMm,
    marginOuterMm: store.marginOuterMm,
    halfGrid: store.halfGrid,
    autoMatchBottom: store.autoMatchBottom,
  }), [
    store.pageWidth, store.pageHeight,
    store.bodyLeading,
    store.marginTopMm, store.marginBottomMinMm,
    store.marginInnerMm, store.marginOuterMm,
    store.halfGrid, store.autoMatchBottom,
  ]);

  // ── Compute type system ───────────────────────────────────────────────────
  const typeSystem = useMemo(() => calculateStyles({
    modeSettings: {
      baseSize: store.baseSize,
      scaleRatio: store.scaleRatio,
      systemPreset: undefined,
      letterSpacing: store.letterSpacing,
      maxLetterSpacing: store.maxLetterSpacing,
      headingLetterSpacing: store.letterSpacing,
      headingMaxLetterSpacing: store.maxLetterSpacing,
      textLetterSpacing: store.letterSpacing,
      textMaxLetterSpacing: store.maxLetterSpacing,
      headlineMinLineHeight: store.headlineMinLineHeight,
      headlineMaxLineHeight: store.headlineMaxLineHeight,
      textMinLineHeight: store.textMinLineHeight,
      textMaxLineHeight: store.textMaxLineHeight,
      maxSize: 120,
      minSize: 6,
      interpolationType: 'exponential',
    },
    fontFamily: store.fontFamily,
    fontStyle: store.fontStyle,
    lineHeightCurve: store.lineHeightCurve,
    letterSpacingCurve: store.letterSpacingCurve,
  }), [
    store.baseSize, store.scaleRatio,
    store.letterSpacing, store.maxLetterSpacing,
    store.headlineMinLineHeight, store.headlineMaxLineHeight,
    store.textMinLineHeight, store.textMaxLineHeight,
    store.lineHeightCurve, store.letterSpacingCurve,
    store.fontFamily, store.fontStyle,
  ]);

  return (
    <div className="indd-shell">
      {/* ══ LEFT: Control Panel ══════════════════════════════════════════════ */}
      <div className="indd-panel">
        {/* Header / Tabs */}
        <div className="header-tabs-section">
          <div className="tab-row">
            <div className="tabs-container">
              {(['setup', 'type', 'styles'] as const).map(tab => (
                <button
                  key={tab}
                  className={`tab-button ${store.activeTab === tab ? 'active' : ''}`}
                  onClick={() => store.setActiveTab(tab)}
                >
                  {tab === 'setup' ? 'Setup' : tab === 'type' ? 'Type Scale' : 'Styles'}
                </button>
              ))}
            </div>
            <div className="header-actions-group">
              <button
                className="icon-button"
                onClick={store.toggleColorMode}
                data-tooltip={store.colorMode === 'dark' ? 'Light mode' : 'Dark mode'}
              >
                <Icon name={store.colorMode === 'dark' ? 'visible-16' : 'hidden-16'} size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="main-content">

          {/* TAB: Setup */}
          {store.activeTab === 'setup' && (
            <Fragment>
              <PageSizeSection />
              <BaselineGridSection />
              <MarginsSection grid={grid} />
            </Fragment>
          )}

          {/* TAB: Type Scale */}
          {store.activeTab === 'type' && (
            <Fragment>
              <BaseSizeSection />
              <ScaleRatioSection />
              <LetterSpacingSection />
            </Fragment>
          )}


          {/* TAB: Styles */}
          {store.activeTab === 'styles' && (
            <Fragment>
              <div className="section section-open">
                <div className="section-header" style={{ cursor: 'default' }}>
                  <div className="section-header-titles-container section-header-left">
                    <span className="section-title">Paragraph styles</span>
                  </div>
                </div>
                <ParagraphStylesGrid typeSystem={typeSystem} grid={grid} />
              </div>

              <div className="section section-open">
                <div className="section-header" style={{ cursor: 'default' }}>
                  <div className="section-header-titles-container section-header-left">
                    <span className="section-title">Export</span>
                  </div>
                </div>
                <ExportPanel typeSystem={typeSystem} grid={grid} />
              </div>
            </Fragment>
          )}
        </div>

        {/* Footer */}
        <div className="footer-fixed">
          <div className="footer-content" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sizing-default-spacers-spacer-2)', padding: '0 var(--sizing-default-spacers-spacer-3)' }}>
            <span className="control-label-xsmall">Pages</span>
            <NumberInput value={store.pageCount} onChange={store.setPageCount} min={1} max={20} width="40px" />
            <label style={{ cursor: 'pointer', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="checkbox-label">Grid</span>
              <input
                type="checkbox"
                className="checkbox-input"
                checked={store.showBaselines}
                onChange={(e: any) => store.setShowBaselines(e.currentTarget.checked)}
              />
            </label>
          </div>
        </div>
      </div>

      {/* ══ RIGHT: Canvas Preview ═════════════════════════════════════════════ */}
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <CanvasPreview grid={grid} typeSystem={typeSystem} />
        <StylePicker />
      </div>
    </div>
  );
}

// ── Mount ────────────────────────────────────────────────────────────────────

const root = document.getElementById('app');
if (root) render(<App />, root);
