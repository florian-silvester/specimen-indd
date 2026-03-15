import { h, Fragment, RefObject } from "preact";
import { TargetedEvent } from 'preact/compat';
import { useRef, useState, useEffect, useMemo, useCallback } from "preact/hooks";

import { FontControlSection } from '../components/FontControlSection'; 
import { SecondaryFontControlSection } from '../components/SecondaryFontControlSection';
import { BaseSizeControlSection } from '../components/BaseSizeControlSection';
import { ScaleRatioControlSection } from '../components/ScaleRatioControlSection';
import { LineHeightControlSection } from '../components/LineHeightControlSection';
import { LetterSpacingControlSection } from '../components/LetterSpacingControlSection';
import { StylesGridSection } from '../components/StylesGridSection';
import { FooterSection } from '../components/FooterSection';
import { HeaderTabsSection } from '../components/HeaderTabsSection';
import { Icon } from '../components/Icon';
import { CustomSingleSlider } from "../components/CustomSingleSlider";
import { RangeSlider } from "../components/RangeSlider";

import { TypographySystem, TypographyStyle, UpdatePreviewRequest, SpecimenSnapshot } from '../../core/types';
import { TypographyModeSettings, TypographySettings } from '../state';
import { useTypographyState } from "../hooks/useTypographyState";
import { calculateStyles } from "../logic/typography-calculator";
import { useAppStore } from '../store/appStore';
import { SCALE_RATIO_MAX, SCALE_RATIO_MIN } from '../../core/constants';

// We will define the full props interface in the next step.
// For now, we'll use `any` to get the JSX in place.
export function GeneratorScreen(props: any) {
  const {
    // currentView is now from Zustand store
    // activeMode is now from Zustand store
    // previewExists is now from Zustand store
    mainContentRef,
    openSections,
    toggleSection,
    fontFamily,
    setFontFamily,
    availableFonts,
    availableStyles,
    selectedStyle,
    setSelectedStyle,
    actualAvailableFontsList,
    
    // Secondary font props
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
    secondaryAvailableStyles,
    
    // Preview functionality
    previewFontFamily,
    isPreviewMode,
    startFontPreview,
    stopFontPreview,
    commitPreviewFont,
    getEffectiveFontFamily,
    
    // Weight preview functionality
    previewWeight,
    isWeightPreviewMode,
    startWeightPreview,
    stopWeightPreview,
    commitPreviewWeight,
    getEffectiveWeight,
    
    // Secondary preview functionality
    previewSecondaryFontFamily,
    isSecondaryPreviewMode,
    startSecondaryFontPreview,
    stopSecondaryFontPreview,
    commitSecondaryPreviewFont,
    getEffectiveSecondaryFontFamily,
    
    // Secondary weight preview functionality
    previewSecondaryWeight,
    isSecondaryWeightPreviewMode,
    startSecondaryWeightPreview,
    stopSecondaryWeightPreview,
    commitSecondaryPreviewWeight,
    getEffectiveSecondaryWeight,
    
    emit,
    // showGoogleFonts is now from Zustand store
    googleFontsList,
    desktop,
    setSettings,
    setSettingsInternal,
    mobile,
    textMainSliderDotValues,
    ratioSliderDotValues,
    designSystemPresets,
    getScaleRatioDisplayText,
    // lineHeightCurve is now from Zustand store
    headlineDotValues,
    textLineHeightDotValues,
    // letterSpacingCurve is now from Zustand store
    letterSpacingDotValues,
    headingLetterSpacingDotValues,
    textLetterSpacingDotValues,
    fineTunedStyles,
    // roundingGridSize is now from Zustand store
    TYPOGRAPHY_SCALE_POINTS,
    getDisplayUIName,
    handleFineTuneChange,
    handleGridKeyDown,
    openGridFontStyleDropdownKey,
    setOpenGridFontStyleDropdownKey,
    gridDropdownsRef,
    // styleVisibility is now from Zustand store
    isRoundingDropdownOpen,
    setIsRoundingDropdownOpen,
    roundingDropdownRef,
    activeLoadingCTA,
    isSpecimenLayoutListOpen,
    setIsSpecimenLayoutListOpen,
    selectedSpecimenPreset,
    setSelectedSpecimenPreset,
    specimenPresetOptions,
    selectedLayout,
    setSelectedLayout,
    previewTextAlign,
    setPreviewTextAlign,
    isTextPresetListOpen,
    setIsTextPresetListOpen,
    textPresetDropdownContainerRef,
    selectedTextPreset,
    setSelectedTextPreset,
    textPresetOptions,
    waterfallText,
    setWaterfallText,
    // colorMode and showSpecLabels are now from Zustand store
    applyRoundingToSystem,
    handleGeneratePreview,
    handleCreateStyles,
    handleUpdateStyles,
    handleGenerateSpecimen,
    specimenLayoutDropdownContainerRef,
    IconComponent,
    RangeSliderComponent,
    CustomSingleSliderComponent,
    textSelectionButtonMode,
    setTextSelectionButtonMode,
    handleSelectOrResetClick,
    // activeFlow is now managed by Zustand store
    isStylesDropdownOpen,
    setIsStylesDropdownOpen,
    selectedStylesAction,
    setSelectedStylesAction,
    stylesDropdownContainerRef,
    isExportDropdownOpen,
    setIsExportDropdownOpen,
    exportDropdownContainerRef,
    // namingConvention is now from Zustand store
    namingConventionOptions,
    selectedPresetProfile,
    presetProfileOptions,
    onPresetProfileSelect,
    // styleFontSources is now from Zustand store
    onStyleFontSourceChange,
    onStyleWeightChange,
    onStyleCustomFontChange,
    onStyleFontRelock,
    handleGlobalTextCaseChange,
    getGlobalTextCase,
    // Grid font source mapping helper
    applyGridFontSourceMappings,
    // Reset grid overrides function
    handleResetGridOverrides,
    handleResetGeneratorDefaults,
    hasGeneratorDeviationFromPreset,
    hasManualStyleTweaks,
    releaseImportedNumericAxis,
    hasActiveSpecimenContext,
    // hasManualGridEdits is now from Zustand store (used directly in StylesGridSection)
    // hasManualTextEdits is now from Zustand store (used directly in FooterSection)
    hasScannedFrameOnly, // Disable Dark/Light, Show specs when only scanned frame
    suppressCtaHighlight = false,
    // --- END ADDED ---
    // --- ADDED: Pass calculated baseline system for manual edit detection ---
    calculatedBaselineSystem,
    getSliderAnchorLabels,
    isLetterSpacingSplit,
  } = props;

  // Get state from Zustand store
  const { colorMode, previewThemeId, customPreviewColors, showSpecLabels, previewExists, lineHeightUnit, setLineHeightUnit, roundingGridSize, setRoundingGridSize, lineHeightCurve, setLineHeightCurve, letterSpacingCurve, setLetterSpacingCurve, activeMode, setActiveMode, namingConvention, setNamingConvention, currentView, setCurrentView, styleVisibility, setStyleVisibility, styleFontSources, generatorTab, setGeneratorTab, hasManualGridEdits, setHasManualGridEdits } = useAppStore();

  // Override warning modal — shown once when switching to generate tab with custom tweaks
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const prevTabRef = useRef(generatorTab);
  useEffect(() => {
    if (prevTabRef.current === 'styles' && generatorTab === 'generate' && hasManualGridEdits) {
      setShowOverrideModal(true);
    }
    prevTabRef.current = generatorTab;
  }, [generatorTab, hasManualGridEdits]);

  // Debounce logic for highlighting
  const highlightTimeoutRef = useRef<number | null>(null);

  // Layout guides notification helper
  const showLayoutGuidesNotification = () => {
    // Check if user has seen this before
    const hasSeenNotification = localStorage.getItem('stylegeek-layout-guides-notification');
    
    if (!hasSeenNotification) {
      // Send notification to main thread to show Figma notification
      emit('SHOW_LAYOUT_GUIDES_NOTIFICATION');
      
      // Remember that user has seen this
      localStorage.setItem('stylegeek-layout-guides-notification', 'true');
    }
  };

  // Responsive mode was removed in favor of preset-driven behavior.
  // Keep section components in standard mode only.
  const isFluidMode = false;
  const buildSpecimenSnapshot = useCallback((
    typeSystem: TypographySystem,
    overrides: Partial<UpdatePreviewRequest> = {}
  ): SpecimenSnapshot => ({
    version: 1,
    typography: {
      desktop: { ...desktop, systemPreset: desktop.systemPreset as string | undefined },
      mobile: { ...mobile, systemPreset: mobile.systemPreset as string | undefined },
    },
    fonts: {
      primaryFontFamily: getEffectiveFontFamily(),
      primaryFontStyle: getEffectiveWeight(),
      secondaryFontFamily: secondaryFontEnabled ? getEffectiveSecondaryFontFamily() : undefined,
      secondaryFontStyle: secondaryFontEnabled ? getEffectiveSecondaryWeight() : undefined,
      secondaryFontEnabled,
      secondaryFontLinked,
      secondaryWeightLinked,
    },
    ui: {
      namingConvention: overrides.namingConvention ?? namingConvention,
      lineHeightUnit: (overrides.lineHeightUnit as 'percent' | 'px' | 'em' | 'rem') ?? lineHeightUnit,
      roundingGridSize: overrides.roundingGridSize ?? roundingGridSize,
      colorMode,
      previewThemeId,
      customPreviewColors: customPreviewColors ?? undefined,
      showSpecLabels: overrides.showSpecLabels ?? showSpecLabels,
      activeMode: overrides.activeMode ?? activeMode,
      selectedLayout,
      previewTextAlign: overrides.previewTextAlign ?? previewTextAlign,
      waterfallText,
      selectedPresetProfile,
      lineHeightCurve,
      letterSpacingCurve,
    },
    styles: typeSystem,
    styleVisibility: { ...(overrides.styleVisibility ?? styleVisibility) },
    styleFontSources: { ...styleFontSources },
  }), [
    desktop,
    mobile,
    getEffectiveFontFamily,
    getEffectiveWeight,
    secondaryFontEnabled,
    getEffectiveSecondaryFontFamily,
    getEffectiveSecondaryWeight,
    secondaryFontLinked,
    secondaryWeightLinked,
    namingConvention,
    lineHeightUnit,
    roundingGridSize,
    colorMode,
    previewThemeId,
    customPreviewColors,
    showSpecLabels,
    activeMode,
    selectedLayout,
    previewTextAlign,
    waterfallText,
    selectedPresetProfile,
    lineHeightCurve,
    letterSpacingCurve,
    styleVisibility,
    styleFontSources,
  ]);

  const emitUpdatePreview = useCallback(
    (typeSystem: TypographySystem, overrides: Partial<UpdatePreviewRequest> = {}) => {
      if (!previewExists) {
        return;
      }
      emit("UPDATE_PREVIEW", {
        typeSystem,
        selectedStyle,
        showSpecLabels,
        styleVisibility,
        availableStyles,
        activeMode,
        activeScaleRatio: activeMode === 'desktop' ? desktop.scaleRatio : mobile.scaleRatio,
        namingConvention,
        showGrid: roundingGridSize > 0,
        roundingGridSize,
        lineHeightUnit,
        previewTextAlign,
        baseFontFamily: getEffectiveFontFamily(),
        baseFontStyle: getEffectiveWeight(),
        secondaryFontFamily: secondaryFontEnabled ? getEffectiveSecondaryFontFamily() : undefined,
        secondaryFontStyle: secondaryFontEnabled ? getEffectiveSecondaryWeight() : undefined,
        specimenSnapshot: buildSpecimenSnapshot(typeSystem, overrides),
        ...overrides,
      } as UpdatePreviewRequest);
    },
    [
      previewExists,
      emit,
      selectedStyle,
      showSpecLabels,
      styleVisibility,
      availableStyles,
      activeMode,
      desktop.scaleRatio,
      mobile.scaleRatio,
      namingConvention,
      roundingGridSize,
      lineHeightUnit,
      previewTextAlign,
      getEffectiveFontFamily,
      getEffectiveWeight,
      secondaryFontEnabled,
      getEffectiveSecondaryFontFamily,
      getEffectiveSecondaryWeight,
      buildSpecimenSnapshot,
    ],
  );

  const lockedMobileFields: Array<keyof TypographyModeSettings> = [
    'letterSpacing',
    'maxLetterSpacing',
    'headlineMinLineHeight',
    'headlineMaxLineHeight',
    'textMinLineHeight',
    'textMaxLineHeight',
    'maxSize',
    'minSize',
    'interpolationType'
  ];

  const effectivePrimaryFontFamily = getEffectiveFontFamily();
  const effectivePrimaryFontStyle = getEffectiveWeight();
  const effectiveSecondaryFontFamily = secondaryFontEnabled ? getEffectiveSecondaryFontFamily() : undefined;
  const effectiveSecondaryFontStyle = secondaryFontEnabled ? getEffectiveSecondaryWeight() : undefined;

  const mobileResponsiveStyles = useMemo(() => {
    if (!isFluidMode) return null;
    return calculateStyles({
      modeSettings: mobile,
      fontFamily: effectivePrimaryFontFamily,
      fontStyle: effectivePrimaryFontStyle,
      lineHeightCurve,
      letterSpacingCurve,
      letterSpacingSplit: isLetterSpacingSplit,
      secondaryFontFamily: effectiveSecondaryFontFamily,
      secondaryFontStyle: effectiveSecondaryFontStyle,
    });
  }, [
    isFluidMode,
    mobile,
    effectivePrimaryFontFamily,
    effectivePrimaryFontStyle,
    effectiveSecondaryFontFamily,
    effectiveSecondaryFontStyle,
    lineHeightCurve,
    letterSpacingCurve,
    isLetterSpacingSplit,
  ]);

  const stylesTabCount = useMemo(() => {
    const allStyleKeys = Object.keys(fineTunedStyles || {});
    if (allStyleKeys.length === 0) return 0;
    return allStyleKeys.filter((key) => styleVisibility[key] !== false).length;
  }, [fineTunedStyles, styleVisibility]);

  // Ensure mobile settings start as a copy of desktop on initial load
  // Uses setSettingsInternal to avoid falsely flagging as user deviation
  useEffect(() => {
    setSettingsInternal((prev: TypographySettings) => {
      const hasDifference = Object.keys(prev.desktop).some((key) => {
        const typedKey = key as keyof TypographyModeSettings;
        return (prev.desktop as any)[typedKey] !== (prev.mobile as any)[typedKey];
      });
      if (!hasDifference) return prev;
      return { ...prev, mobile: { ...prev.desktop } };
    });
  }, [setSettingsInternal]);

  // Keep locked fields in sync with desktop when desktop values change
  // Uses setSettingsInternal to avoid falsely flagging as user deviation
  useEffect(() => {
    setSettingsInternal((prev: TypographySettings) => {
      let changed = false;
      const nextMobile: TypographyModeSettings = { ...prev.mobile };
      lockedMobileFields.forEach((field) => {
        if ((nextMobile as any)[field] !== (prev.desktop as any)[field]) {
          (nextMobile as any)[field] = (prev.desktop as any)[field];
          changed = true;
        }
      });
      if (!changed) return prev;
      return { ...prev, mobile: nextMobile };
    });
  }, [desktop, setSettingsInternal]);

  // Debug helper for testing notifications (accessible from console)
  useEffect(() => {    
    (window as any).resetLayoutGuidesNotification = () => {
      localStorage.removeItem('stylegeek-layout-guides-notification');
      console.log('[Debug] Reset layout guides notification - will show on next grid enable');
    };
    (window as any).forceShowLayoutGuidesNotification = () => {
      console.log('[Debug] Force showing layout guides notification');
      emit('SHOW_LAYOUT_GUIDES_NOTIFICATION');
    };
  }, []);

  const handleStyleHover = (styleName: string | null) => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    if (styleName) {
      highlightTimeoutRef.current = window.setTimeout(() => {
        emit('HIGHLIGHT_PREVIEW_STYLE_GROUP', { styleName });
      }, 150); // 150ms delay
    } else {
      emit('CLEAR_STYLE_HIGHLIGHTS');
    }
  };





  return (
    <Fragment>
      {/* --- Header Tabs Section --- */}
      <HeaderTabsSection 
        IconComponent={IconComponent}
        stylesCount={stylesTabCount}
        // Preset buttons removed - specimens now store their own settings
      />
      {/* --- End Header Tabs Section --- */}

      {/* Override warning modal — rendered outside main-content to avoid :first-child issues */}
      {generatorTab === 'generate' && showOverrideModal && (
        <div className="override-modal-backdrop" onClick={() => setShowOverrideModal(false)}>
          <div className="override-modal" onClick={(e) => e.stopPropagation()}>
            <span>Changes here will reset overrides.</span>
            <div className="override-modal-actions">
              <button className="button-secondary-new" onClick={() => { setShowOverrideModal(false); setGeneratorTab('styles'); }}>
                Cancel
              </button>
              <button
                className="button-secondary-new active"
                onClick={() => {
                  setShowOverrideModal(false);
                  handleResetGridOverrides();
                }}
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Main UI Content --- Wrap everything below header in a main content div --- */}
      <div class="main-content" ref={mainContentRef}> {/* Attach ref here */}

        {/* --- Generate tab: all control sections --- */}
        {generatorTab === 'generate' && (
        <Fragment>

        <div className="preset-profile-row">
          <div className="ramp-preset-tags">
            {presetProfileOptions.map((option: { id: string; label: string }) => (
              <button
                key={option.id}
                className={`ramp-preset-tag ${selectedPresetProfile === option.id ? 'ramp-preset-tag--active' : ''}`}
                onClick={() => onPresetProfileSelect(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* --- NEW: Secondary Font Section (Headings) --- */}
        <SecondaryFontControlSection
          isOpen={openSections.secondaryFont}
          onToggleOpen={() => toggleSection('secondaryFont')}
          IconComponent={IconComponent}
          secondaryFontEnabled={secondaryFontEnabled}
          setSecondaryFontEnabled={setSecondaryFontEnabled}
          secondaryFontLinked={secondaryFontLinked}
          setSecondaryFontLinked={setSecondaryFontLinked}
          toggleSecondaryFontLinked={toggleSecondaryFontLinked}
          secondaryWeightLinked={secondaryWeightLinked}
          setSecondaryWeightLinked={setSecondaryWeightLinked}
          toggleSecondaryWeightLinked={toggleSecondaryWeightLinked}
          secondaryFontFamily={secondaryFontFamily}
          setSecondaryFontFamily={setSecondaryFontFamily}
          secondarySelectedStyle={secondarySelectedStyle}
          setSecondarySelectedStyle={setSecondarySelectedStyle}
          availableFonts={availableFonts}
          secondaryAvailableStyles={secondaryAvailableStyles}
          emit={emit}
          googleFontsList={googleFontsList}
          textSelectionButtonMode={textSelectionButtonMode}
          handleSelectOrResetClick={handleSelectOrResetClick}
          // Secondary preview functionality
          previewSecondaryFontFamily={previewSecondaryFontFamily}
          isSecondaryPreviewMode={isSecondaryPreviewMode}
          startSecondaryFontPreview={startSecondaryFontPreview}
          stopSecondaryFontPreview={stopSecondaryFontPreview}
          commitSecondaryPreviewFont={commitSecondaryPreviewFont}
          getEffectiveSecondaryFontFamily={getEffectiveSecondaryFontFamily}
          // Secondary weight preview functionality
          previewSecondaryWeight={previewSecondaryWeight}
          isSecondaryWeightPreviewMode={isSecondaryWeightPreviewMode}
          startSecondaryWeightPreview={startSecondaryWeightPreview}
          stopSecondaryWeightPreview={stopSecondaryWeightPreview}
          commitSecondaryPreviewWeight={commitSecondaryPreviewWeight}
          getEffectiveSecondaryWeight={getEffectiveSecondaryWeight}
          globalTextCase={getGlobalTextCase('headings')}
          onGlobalTextCaseChange={(value: string) => handleGlobalTextCaseChange('headings', value)}
        />
        {/* --- END NEW: Secondary Font Section (Headings) --- */}

        {/* --- NEW: Font Section (Text) --- */}
        <FontControlSection
          isOpen={openSections.font}
          onToggleOpen={() => toggleSection('font')}
          IconComponent={IconComponent}
          fontFamily={fontFamily}
          setFontFamily={setFontFamily}
          availableFonts={availableFonts}
          availableStyles={(() => {
            // Dynamic computation: get weights for the actual effective primary font
            const effectivePrimaryFont = getEffectiveFontFamily();
            const primaryWeights = actualAvailableFontsList
              .filter((f: any) => f.family === effectivePrimaryFont)
              .map((f: any) => f.style);
            return primaryWeights.length > 0 ? primaryWeights : ['Regular'];
          })()}
          selectedStyle={selectedStyle}
          setSelectedStyle={setSelectedStyle}
          emit={emit}
          googleFontsList={googleFontsList}
          textSelectionButtonMode={textSelectionButtonMode}
          handleSelectOrResetClick={handleSelectOrResetClick}
          // Preview functionality
          previewFontFamily={previewFontFamily}
          isPreviewMode={isPreviewMode}
          startFontPreview={startFontPreview}
          stopFontPreview={stopFontPreview}
          commitPreviewFont={commitPreviewFont}
          getEffectiveFontFamily={getEffectiveFontFamily}
          // Weight preview functionality
          previewWeight={previewWeight}
          isWeightPreviewMode={isWeightPreviewMode}
          startWeightPreview={startWeightPreview}
          stopWeightPreview={stopWeightPreview}
          commitPreviewWeight={commitPreviewWeight}
          getEffectiveWeight={getEffectiveWeight}
          globalTextCase={getGlobalTextCase('text')}
          onGlobalTextCaseChange={(value: string) => handleGlobalTextCaseChange('text', value)}
        />
        {/* --- END NEW: Font Section (Text) --- */}

        {/* --- MODIFIED: Base Size Section --- */}
        <BaseSizeControlSection
          desktopBaseSize={desktop.baseSize}
          setDesktopBaseSize={(value: number) => {
            releaseImportedNumericAxis?.('size');
            setSettings((s: any) => ({ ...s, desktop: { ...s.desktop, baseSize: value } }));
            if (hasManualGridEdits) {
              console.log(`[GeneratorScreen] Cleared manual grid edits because base size changed`);
              setHasManualGridEdits(false);
            }
          }}
          mobileBaseSize={mobile.baseSize}
          setMobileBaseSize={(value: number) => {
            releaseImportedNumericAxis?.('size');
            setSettings((s: any) => ({ ...s, mobile: { ...s.mobile, baseSize: value } }));
            if (hasManualGridEdits) {
              console.log(`[GeneratorScreen] Cleared manual grid edits because base size changed`);
              setHasManualGridEdits(false);
            }
          }}
          isOpen={openSections.baseSize}
          onToggleOpen={() => toggleSection('baseSize')}
          textMainSliderDotValues={textMainSliderDotValues}
          IconComponent={IconComponent} // Pass the Icon component defined in this file
          CustomSingleSliderComponent={CustomSingleSliderComponent} // Pass the CustomSingleSlider component defined in this file
          RangeSliderComponent={RangeSliderComponent}
          isFluidMode={isFluidMode}
        />
        {/* --- END MODIFIED: Base Size Section --- */}

        {/* --- NEW: Scale Ratio Section --- */}
        <ScaleRatioControlSection
          desktopScaleRatio={desktop.scaleRatio}
          setDesktopScaleRatio={(value: number) => {
            console.log(`[GeneratorScreen] Setting desktop scaleRatio to: ${value}`);
            if (typeof value !== 'number' || isNaN(value) || value <= 0) {
              console.error(`[GeneratorScreen] ❌ Invalid scaleRatio value: ${value}, defaulting to 1.333`);
              value = 1.333;
            }
            value = Math.max(SCALE_RATIO_MIN, Math.min(value, SCALE_RATIO_MAX));
            releaseImportedNumericAxis?.('size');
            setSettings((s: any) => ({ ...s, desktop: { ...s.desktop, scaleRatio: value } }));
            if (hasManualGridEdits) {
              console.log(`[GeneratorScreen] Cleared manual grid edits because scale ratio changed`);
              setHasManualGridEdits(false);
            }
          }}
          mobileScaleRatio={mobile.scaleRatio}
          setMobileScaleRatio={(value: number) => {
            console.log(`[GeneratorScreen] Setting mobile scaleRatio to: ${value}`);
            if (typeof value !== 'number' || isNaN(value) || value <= 0) {
              console.error(`[GeneratorScreen] ❌ Invalid scaleRatio value: ${value}, defaulting to 1.4`);
              value = 1.4;
            }
            value = Math.max(SCALE_RATIO_MIN, Math.min(value, SCALE_RATIO_MAX));
            releaseImportedNumericAxis?.('size');
            setSettings((s: any) => ({ ...s, mobile: { ...s.mobile, scaleRatio: value } }));
            if (hasManualGridEdits) {
              console.log(`[GeneratorScreen] Cleared manual grid edits because scale ratio changed`);
              setHasManualGridEdits(false);
            }
          }}
          systemPreset={activeMode === 'desktop' ? desktop.systemPreset : mobile.systemPreset}
          setSystemPreset={(preset) => {
            setSettings((s: any) => ({
              ...s,
              [activeMode]: {
                ...s[activeMode],
                systemPreset: preset,
              },
            }));
          }}
          designSystemPresets={designSystemPresets}
          isOpen={openSections.scaleRatio}
          onToggleOpen={() => toggleSection('scaleRatio')}
          ratioSliderDotValues={ratioSliderDotValues}
          getScaleRatioDisplayText={getScaleRatioDisplayText}
          IconComponent={IconComponent}
          CustomSingleSliderComponent={CustomSingleSliderComponent}
          RangeSliderComponent={RangeSliderComponent}
          isFluidMode={isFluidMode}
        />
        {/* --- END NEW: Scale Ratio Section --- */}

        {/* --- MODIFIED: Letter Spacing Section --- */}
        <LetterSpacingControlSection
          desktopLetterSpacing={desktop.letterSpacing}
          setDesktopLetterSpacing={(value: number) => setSettings((s: any) => ({ ...s, desktop: { ...s.desktop, letterSpacing: value } }))}
          desktopMaxLetterSpacing={desktop.maxLetterSpacing}
          setDesktopMaxLetterSpacing={(value: number) => setSettings((s: any) => ({ ...s, desktop: { ...s.desktop, maxLetterSpacing: value } }))}
          mobileLetterSpacing={mobile.letterSpacing}
          setMobileLetterSpacing={(value: number) => setSettings((s: any) => ({ ...s, mobile: { ...s.mobile, letterSpacing: value } }))}
          mobileMaxLetterSpacing={mobile.maxLetterSpacing}
          setMobileMaxLetterSpacing={(value: number) => setSettings((s: any) => ({ ...s, mobile: { ...s.mobile, maxLetterSpacing: value } }))}
          onApplySliderPreset={(vals) => {
            releaseImportedNumericAxis?.('letterSpacing');
            setSettings((s: any) => ({ ...s, [activeMode]: { ...s[activeMode], ...vals } }));
          }}
          onLetterSpacingPresetOrCurveChange={() => releaseImportedNumericAxis?.('letterSpacing')}
          isOpen={openSections.letterSpacing}
          onToggleOpen={() => toggleSection('letterSpacing')}
          letterSpacingDotValues={letterSpacingDotValues}
          headingLetterSpacingDotValues={headingLetterSpacingDotValues}
          textLetterSpacingDotValues={textLetterSpacingDotValues}
          IconComponent={IconComponent}
          RangeSliderComponent={RangeSliderComponent}
          getSliderAnchorLabels={getSliderAnchorLabels}
          handleSliderAnchorAdjustment={props.handleSliderAnchorAdjustment}
          isSplitMode={Boolean(isLetterSpacingSplit)}
          headingRangeSliderValues={[activeMode === 'desktop' ? desktop.headingMaxLetterSpacing : mobile.headingMaxLetterSpacing, activeMode === 'desktop' ? desktop.headingLetterSpacing : mobile.headingLetterSpacing]}
          textRangeSliderValues={[activeMode === 'desktop' ? desktop.textMaxLetterSpacing : mobile.textMaxLetterSpacing, activeMode === 'desktop' ? desktop.textLetterSpacing : mobile.textLetterSpacing]}
        />
        {/* --- END MODIFIED: Letter Spacing Section --- */}

        {/* --- MODIFIED: Line Height Section --- */}
        <LineHeightControlSection
            desktopHeadlineMinLineHeight={desktop.headlineMinLineHeight}
            setDesktopHeadlineMinLineHeight={(value: number) => setSettings((s: any) => ({ ...s, desktop: { ...s.desktop, headlineMinLineHeight: value } }))}
            desktopHeadlineMaxLineHeight={desktop.headlineMaxLineHeight}
            setDesktopHeadlineMaxLineHeight={(value: number) => setSettings((s: any) => ({ ...s, desktop: { ...s.desktop, headlineMaxLineHeight: value } }))}
            desktopTextMinLineHeight={desktop.textMinLineHeight}
            setDesktopTextMinLineHeight={(value: number) => setSettings((s: any) => ({ ...s, desktop: { ...s.desktop, textMinLineHeight: value } }))}
            desktopTextMaxLineHeight={desktop.textMaxLineHeight}
            setDesktopTextMaxLineHeight={(value: number) => setSettings((s: any) => ({ ...s, desktop: { ...s.desktop, textMaxLineHeight: value } }))}
            mobileHeadlineMinLineHeight={mobile.headlineMinLineHeight}
            setMobileHeadlineMinLineHeight={(value: number) => setSettings((s: any) => ({ ...s, mobile: { ...s.mobile, headlineMinLineHeight: value } }))}
            mobileHeadlineMaxLineHeight={mobile.headlineMaxLineHeight}
            setMobileHeadlineMaxLineHeight={(value: number) => setSettings((s: any) => ({ ...s, mobile: { ...s.mobile, headlineMaxLineHeight: value } }))}
            mobileTextMinLineHeight={mobile.textMinLineHeight}
            setMobileTextMinLineHeight={(value: number) => setSettings((s: any) => ({ ...s, mobile: { ...s.mobile, textMinLineHeight: value } }))}
            mobileTextMaxLineHeight={mobile.textMaxLineHeight}
            setMobileTextMaxLineHeight={(value: number) => setSettings((s: any) => ({ ...s, mobile: { ...s.mobile, textMaxLineHeight: value } }))}
            onApplySliderPreset={(vals) => {
              releaseImportedNumericAxis?.('lineHeight');
              setSettings((s: any) => ({ ...s, [activeMode]: { ...s[activeMode], ...vals } }));
            }}
            onLineHeightPresetOrCurveChange={() => releaseImportedNumericAxis?.('lineHeight')}
            isOpen={openSections.lineHeight}
            onToggleOpen={() => toggleSection('lineHeight')}
            headlineDotValues={headlineDotValues}
            textLineHeightDotValues={textLineHeightDotValues}
            IconComponent={IconComponent} // Pass the Icon component
            RangeSliderComponent={RangeSliderComponent} // Pass the RangeSlider component
            getSliderAnchorLabels={getSliderAnchorLabels}
            handleSliderAnchorAdjustment={props.handleSliderAnchorAdjustment}
        />
        {/* --- END MODIFIED: Line Height Section --- */}

        {/* --- NEW: Baseline Section --- */}
        <div className={`section ${openSections.rounding ? 'section-open' : ''}`}>
          <div className="section-header" tabIndex={0} role="button" onClick={() => toggleSection('rounding')} onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection('rounding'); } }}>
            <div className="section-header-titles-container section-header-left">
              <IconComponent name="navigate-forward-24" size={24} className={`section-header-chevron ${openSections.rounding ? 'open' : ''}`} />
              <span className="section-title">Baseline</span>
            </div>
            <div className="header-section-dropdown-container">
              <div className="custom-dropdown-container" ref={roundingDropdownRef}>
                <button
                  className="input dropdown-trigger-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsRoundingDropdownOpen(!isRoundingDropdownOpen);
                  }}
                >
                  <span className="dropdown-trigger-label">
                    {roundingGridSize === 0 ? 'Off' : `${roundingGridSize}px`}
                  </span>
                </button>
                {isRoundingDropdownOpen && (
                  <div
                    className="dropdown-list rounding-options-dropdown-list"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <div className="dropdown-items-container">
                      {[
                        { label: 'Off', value: 0 },
                        { label: '2px', value: 2 },
                        { label: '4px', value: 4 },
                      ].map(option => (
                        <button
                          key={option.label}
                          className={`dropdown-item ${roundingGridSize === option.value ? 'selected' : ''}`}
                          onMouseDown={() => {
                            setRoundingGridSize(option.value);
                            setIsRoundingDropdownOpen(false);
                            
                            // Show layout guides notification when baseline grid is enabled
                            if (option.value > 0) {
                              showLayoutGuidesNotification();
                            }
                            
                            // Emit UPDATE_PREVIEW if a preview exists
                            const systemToUpdate = option.value > 0 ? applyRoundingToSystem(fineTunedStyles, option.value) : fineTunedStyles;
                            emitUpdatePreview(systemToUpdate, {
                              showGrid: option.value > 0,
                              roundingGridSize: option.value,
                            });
                          }}
                        >
                          <span className="dropdown-item-text-content">{option.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {openSections.rounding && (
            <div className="section-content">
              <div className="control-row font-selection-control-row control-row-no-left-padding">
                <label className="control-label"></label>
                <div className="custom-dropdown-container font-style-dropdown">
                <div className="toggle-item-wrapper">
                  <label className="toggle-item">
                    <input
                      type="checkbox"
                      className="toggle-checkbox-input"
                        checked={lineHeightUnit === 'px'}
                      onChange={(e: TargetedEvent<HTMLInputElement, Event>) => {
                          const newUnit = e.currentTarget.checked ? 'px' : 'percent';
                          setLineHeightUnit(newUnit);
                          
                          // Update preview immediately if one exists - preserve rounding state
                        const systemToUpdate = roundingGridSize > 0 ? applyRoundingToSystem(fineTunedStyles, roundingGridSize) : fineTunedStyles;
                        emitUpdatePreview(systemToUpdate, {
                          lineHeightUnit: newUnit,
                        });
                      }}
                    />
                      <span className="toggle-text">Line height in px</span>
                  </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* --- END NEW: Baseline Section --- */}

        </Fragment>
        )}

        {/* --- Styles tab: StylesGridSection --- */}
        {generatorTab === 'styles' && (
        <StylesGridSection
          fineTunedStyles={fineTunedStyles}
          mobileStyles={mobileResponsiveStyles || undefined}
          isFluidMode={isFluidMode}
          isOpen={openSections.styles}
          onToggleOpen={() => toggleSection('styles')}
          IconComponent={IconComponent}
          baseSizeInPx={activeMode === 'desktop' ? desktop.baseSize : mobile.baseSize}
          _scalePoints={TYPOGRAPHY_SCALE_POINTS}
          getDisplayUIName={getDisplayUIName}
          handleFineTuneChange={handleFineTuneChange}
          handleGridKeyDown={handleGridKeyDown}
          availableStyles={availableStyles}
          openGridFontStyleDropdownKey={openGridFontStyleDropdownKey}
          setOpenGridFontStyleDropdownKey={setOpenGridFontStyleDropdownKey}
          gridDropdownsRef={gridDropdownsRef}
          emitUpdatePreview={emitUpdatePreview}
          selectedStyle={selectedStyle}
          desktopScaleRatio={desktop.scaleRatio}
          mobileScaleRatio={mobile.scaleRatio}
          applyRoundingToSystem={applyRoundingToSystem}
          showSpecLabels={showSpecLabels}
          namingConventionOptions={namingConventionOptions}
          onStyleHover={(styleName: string | null) => {
            // TODO: Implement style hover highlighting if needed
          }}
          showGrid={roundingGridSize > 0}
          primaryFontFamily={getEffectiveFontFamily()}
          primaryFontWeights={(() => {
            // Dynamic computation: get weights for the actual effective primary font
            const effectivePrimaryFont = getEffectiveFontFamily();
            const primaryWeights = actualAvailableFontsList
              .filter((f: any) => f.family === effectivePrimaryFont)
              .map((f: any) => f.style);
            return primaryWeights.length > 0 ? primaryWeights : ['Regular'];
          })()}
          secondaryFontFamily={getEffectiveSecondaryFontFamily()}
          secondaryFontWeights={(() => {
            // Dynamic computation: get weights for the actual effective secondary font
            const effectiveSecondaryFont = getEffectiveSecondaryFontFamily();
            const secondaryWeights = actualAvailableFontsList
              .filter((f: any) => f.family === effectiveSecondaryFont)
              .map((f: any) => f.style);
            return secondaryWeights.length > 0 ? secondaryWeights : ['Regular'];
          })()}
          onStyleFontSourceChange={onStyleFontSourceChange}
          onStyleWeightChange={onStyleWeightChange}
          onStyleCustomFontChange={onStyleCustomFontChange}
          onStyleFontRelock={onStyleFontRelock}
          availableFonts={availableFonts}
          actualAvailableFontsList={actualAvailableFontsList}
          // Pass style-specific preview functions for grid font preview
          onStylePreview={(styleKey: string, weight: string) => {
            // Create a temporary modified system with just this style changed
            const tempSystem = { ...fineTunedStyles };
            if (tempSystem[styleKey]) {
              tempSystem[styleKey] = { ...tempSystem[styleKey], fontStyle: weight };
            }
            
            // CRITICAL: Apply grid font source mappings before sending to canvas
            const systemWithMappings = applyGridFontSourceMappings ? applyGridFontSourceMappings(tempSystem) : tempSystem;
            
            // Emit preview update with modified system
            emitUpdatePreview(systemWithMappings);
          }}
          onStylePreviewStop={(styleKey: string) => {
            emitUpdatePreview(fineTunedStyles);
          }}
          onStyleFontPreview={(styleKey: string, fontFamily: string) => {
            const tempSystem = { ...fineTunedStyles };
            if (tempSystem[styleKey]) {
              tempSystem[styleKey] = { ...tempSystem[styleKey], fontFamily };
            }
            const systemWithMappings = applyGridFontSourceMappings ? applyGridFontSourceMappings(tempSystem) : tempSystem;
            emitUpdatePreview(systemWithMappings);
          }}
          onStyleFontPreviewStop={(styleKey: string) => {
            emitUpdatePreview(fineTunedStyles);
          }}
          onResetGridOverrides={handleResetGridOverrides}
          showResetAllOverrides={hasManualStyleTweaks}
        />
        )}

        {generatorTab === 'generate' && hasGeneratorDeviationFromPreset && (
          <div className="generator-reset-row">
            <div />
            <div className="generator-reset-row__actions">
              <button
                type="button"
                className="button-secondary-new"
                onClick={handleResetGeneratorDefaults}
              >
                Reset to defaults
              </button>
            </div>
          </div>
        )}

      </div>
      {/* --- Footer Structure --- */}
      <FooterSection
        activeLoadingCTA={activeLoadingCTA}
        isSpecimenLayoutListOpen={isSpecimenLayoutListOpen}
        setIsSpecimenLayoutListOpen={setIsSpecimenLayoutListOpen}
        selectedSpecimenPreset={selectedSpecimenPreset}
        setSelectedSpecimenPreset={setSelectedSpecimenPreset}
        specimenPresetOptions={specimenPresetOptions}
        selectedLayout={selectedLayout}
        setSelectedLayout={setSelectedLayout}
        previewTextAlign={previewTextAlign}
        setPreviewTextAlign={setPreviewTextAlign}
        isTextPresetListOpen={isTextPresetListOpen}
        setIsTextPresetListOpen={setIsTextPresetListOpen}
        textPresetDropdownContainerRef={textPresetDropdownContainerRef}
        selectedTextPreset={selectedTextPreset}
        setSelectedTextPreset={setSelectedTextPreset}
        textPresetOptions={textPresetOptions}
        setWaterfallText={setWaterfallText}
        fineTunedStyles={fineTunedStyles}
        selectedStyle={selectedStyle}
        availableStyles={availableStyles}
        desktopScaleRatio={desktop.scaleRatio}
        mobileScaleRatio={mobile.scaleRatio}
        applyRoundingToSystem={applyRoundingToSystem}
        handleGeneratePreview={handleGeneratePreview}
        handleCreateStyles={handleCreateStyles}
        handleUpdateStyles={handleUpdateStyles}
        handleGenerateSpecimen={handleGenerateSpecimen}
        emit={emit}
        emitUpdatePreview={emitUpdatePreview}
        IconComponent={IconComponent}
        specimenLayoutDropdownContainerRef={specimenLayoutDropdownContainerRef}
        isStylesDropdownOpen={isStylesDropdownOpen}
        setIsStylesDropdownOpen={setIsStylesDropdownOpen}
        selectedStylesAction={selectedStylesAction}
        setSelectedStylesAction={setSelectedStylesAction}
        stylesDropdownContainerRef={stylesDropdownContainerRef}
        isExportDropdownOpen={isExportDropdownOpen}
        setIsExportDropdownOpen={setIsExportDropdownOpen}
        exportDropdownContainerRef={exportDropdownContainerRef}
        showGrid={roundingGridSize > 0}
        hasActiveSpecimenContext={hasActiveSpecimenContext}
        hasScannedFrameOnly={hasScannedFrameOnly}
        suppressCtaHighlight={suppressCtaHighlight}
      />
      {/* --- End Footer Structure --- */}
    </Fragment>
  );
} 