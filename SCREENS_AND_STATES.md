# Screens And State Map

## Scope
- This document maps the UI architecture in `src/ui/`.
- It lists:
  - all screen components,
  - what each screen does,
  - how users reach each screen,
  - the state that drives each screen.

## Current Reality
- The plugin currently boots to `currentView: 'main'` (generator-first flow).
- `landing` still exists in code but is not part of normal user flow.

---

## 1) Top-Level Navigation State

### `currentView` (global, Zustand)
Defined in `src/ui/store/appStore.ts`:
- `landing`
- `main`
- `scanResults`
- `textInput`
- `textStyleAssignment`
- `smartMatchResults`

### `activeFlow` (global, Zustand)
- `generator`
- `structuredText`
- `frameScan`

This is a workflow context flag (not the renderer route by itself).

### `generatorTab` (global, Zustand)
- `generate`
- `styles`

Only relevant while `currentView === 'main'`.

---

## 2) Screen Inventory

## Active/Primary Screens

### `GeneratorScreen` (`src/ui/screens/GeneratorScreen.tsx`)
- **Route:** `currentView === 'main'`
- **Purpose:** Main product surface for generating specimen typography systems.
- **Primary functions:**
  - adjust typography controls (base, ratio, line, spacing, font),
  - manage style visibility and style grid edits,
  - create specimen,
  - create/update styles,
  - open scan/match flow via wand icon.
- **Create Styles folder behavior:**
  - styles are created as versioned sets under `Specimen / <Typeface> / <Preset Label> / <Style Name>`,
  - preset label is derived from the selected profile chip (`Desktop`, `Mobile`, `Social`, `Deck`, `Product`),
  - when a set already exists for the same typeface + preset label, create appends a numeric suffix (`Desktop 2`, `Desktop 3`, ...).
- **Unit behavior in Styles grid:**
  - size can be displayed/edited in `px`, `em`, `rem` and always resolves to Figma-supported `px` on style write,
  - letter spacing can be displayed/edited in `%`, `px`, `em`, `rem`; `em`/`rem`/`px` are converted into canonical `%` before style writes,
  - line-height in percent mode writes integer `%` to match grid display; px mode writes pixel values.
- **Letter spacing control behavior (Generate tab):**
  - starts in linked mode with one shared slider,
  - auto-splits into separate heading/text sliders when heading and text settings diverge (e.g. secondary heading font enabled or generator-level heading/text case differs),
  - when linked mode is restored, split slider values are merged back into the shared slider anchors.
- **Header behavior:**
  - on `main`, header shows `Generate` / `Styles` tabs and import action only,
  - no back arrow is shown in Generator header (prevents jumping back into scan history from main).
- **Sub-modes:**
  - `generatorTab = 'generate'` shows controls.
  - `generatorTab = 'styles'` shows styles grid.
  - Styles tab renders the grid as a standalone surface (not inside the accordion section shell used in Generate tab), so section-open spacing rules do not apply there.
- **Reset CTA behavior:**
  - Generator tab shows `Reset to defaults` in a dedicated bottom row only when current generator values deviate from the selected preset baseline.
  - Styles tab header shows `Reset style tweaks` only when manual style tweaks exist (shared signal with Generate-tab overwrite modal).
  - Confirming the Generate-tab overwrite modal clears manual style tweaks and hides the Styles reset CTA until new manual grid tweaks happen again.
- **Override classification:**
  - Style visibility changes (hiding/showing rows) are NOT overrides. Hidden rows are an obvious, easily reversible UI preference that does not trigger the override modal or the Reset style tweaks CTA.
  - Generator-level text case (set via font control dropdowns on Generate tab) is NOT an override. It is tracked separately (`generatorHeadingCase` / `generatorTextCase` in `ui.tsx`) and preserved through grid-override resets.
  - Per-style text case (set individually via the Styles grid) IS an override if it differs from the generator-level case for that group.

### `ScanResultsScreen` (`src/ui/screens/ScanResultsScreen.tsx`)
- **Route:** `currentView === 'scanResults'`
- **Purpose:** Scan selected frame typography and map detected sizes to system styles.
- **Primary functions:**
  - scan frame,
  - auto-map detected sizes,
  - user-correct mappings in dropdowns,
  - apply mapped styles back to frame,
  - send inferred ratio/base and mapped style names back to main UI.
- **Header/data-role clarity:**
  - in-screen title text is removed; top row is back/navigation only,
  - mapping list has explicit column labels: left = scanned size, right = assign plugin style.
- **Apply-complete state behavior:**
  - in scan flow, apply acts as UI-import (`applyToFrame: false`): plugin controls are updated from scanned metadata (`baseSize`, `ratio`, max size, global font) while the scanned frame is not mutated,
  - when scanned mappings contain distinct body vs heading font families, main-font controls keep body as primary and automatically enable/unlink secondary font controls to store heading font family/style,
  - after successful import, navigation returns to `main` and auto-opens the `styles` tab so imported overrides are immediately visible,
  - imported scan styles are treated as manual grid edits; switching from `styles` to `generate` shows the overwrite-warning modal and only clears override preservation after user confirms,
  - the `0 nodes updated` error prompt only applies when frame-write mode is enabled.
- **Readability detail:**
  - per-row `instances` meta text uses larger UI text size for better scanability.

### `TextInputScreen` (`src/ui/screens/TextInputScreen.tsx`)
- **Route:** `currentView === 'textInput'`
- **Purpose:** Structured text flow entry (API/content-type based).
- **Primary functions:**
  - collect raw text,
  - pick content type,
  - trigger text processing pipeline.

### `TextStyleAssignmentScreen` (`src/ui/screens/TextStyleAssignmentScreen.tsx`)
- **Route:** `currentView === 'textStyleAssignment'`
- **Purpose:** Placeholder/early implementation for assigning styles to processed text segments.
- **Primary functions:**
  - preview parsed text,
  - show placeholder assignment controls.

### `SmartMatchResultsScreen` (`src/ui/screens/SmartMatchResultsScreen.tsx`)
- **Route:** `currentView === 'smartMatchResults'`
- **Purpose:** Transitional screen for smart-match result confirmation.
- **Primary functions:**
  - choose headline weight,
  - apply matched styles.

---

## Dialog/Modal-Like Screens (mounted from `ui.tsx` state, not `currentView`)

### `UnifiedUpdateScreen` (`src/ui/screens/UnifiedUpdateScreen.tsx`)
- **Trigger state:** `unifiedUpdateDialog.isOpen`
- **Purpose:** Map plugin system styles to local Figma text styles before update.
- **Primary functions:** mapping dropdowns, cancel, submit update, variable update opt-in.
- **Update mapping options:**
  - each row can map to an existing local style, `None`, or `Add new style`,
  - `Add new style` creates the missing style in the selected mode folder (`Desktop`/`Mobile`) during update apply.
- **Target set filter row:**
  - the update table shows a `Choose Folder` row under the `Local Styles` -> `Specimen Styles` header row,
  - folder options include discovered folder paths plus `Unsorted` (top-level styles with no folder path),
  - selecting a folder scopes local-style dropdown options to that folder context,
  - if a previously mapped style falls outside the selected folder, mapping is auto-normalized to an exact name match within the selected folder (or cleared when unavailable).
- **Column layout:**
  - left column = Local Styles (dropdown), right column = Specimen Styles (name + px size),
  - left-to-right reading: "this local style will receive these specimen values".
- **Variable checkbox:**
  - shown only when font-family or font-weight variables are detected on auto-matched local styles,
  - checkbox label: "Update N connected font variables", checked by default,
  - when checked, `variableHandlingMode = 'update'` is sent with the mapping,
  - when unchecked, `variableHandlingMode = 'disconnect'` disconnects variable bindings.
- **Submit behavior:**
  - after clicking "Update N Styles", the update screen stays open (no navigation back to main),
  - variable handling mode is determined by the checkbox (no modal),
  - only after the operation completes does the screen close and the success modal appear.

### `WeightMappingScreen` (`src/ui/screens/WeightMappingScreen.tsx`)
- **Trigger state:** `weightMappingDialog.isOpen`
- **Purpose:** Resolve missing font weights when updating style systems.
- **Primary functions:** map missing weights to available weights, submit/cancel.

### `VariableMappingScreen` (`src/ui/screens/VariableMappingScreen.tsx`)
- **Trigger state:** `variableMappingDialog.isOpen`
- **Purpose:** Resolve variable-bound typography conflicts (font family/weight variables).
- **Primary functions:** choose update/preserve/disconnect style actions per variable.

### `VariableUpdateDecisionModal` — REMOVED
- Replaced by inline checkbox on `UnifiedUpdateScreen`.
- Variable handling mode is now determined by the "Update N connected font variables" checkbox before submit.

---

## Legacy/Unreachable By Default

### `LandingScreen` (`src/ui/screens/LandingScreen.tsx`)
- **Route exists:** `currentView === 'landing'`
- **Reachability in normal flow:** not reachable by default (boot is `main`).
- **Status:** legacy fallback route; not part of current generator-first UX.

---

## 3) Navigation Graph (Practical)

- App start -> `main`
- `main` -> `scanResults` (wand flow)
- `scanResults` -> `main` (back/cancel/apply complete)
- `main` -> `textInput` (currently mostly dormant path)
- `textInput` -> `textStyleAssignment` (processing flow)
- `textStyleAssignment` -> `textInput` (back)
- `main` -> `smartMatchResults` (smart-match event path)
- `smartMatchResults` -> `main` (apply)
- `main` can open any of:
  - `UnifiedUpdateScreen` dialog
  - `WeightMappingScreen` dialog
  - `VariableMappingScreen` dialog

---

## 4) Global App State (Zustand)

Defined in `src/ui/store/appStore.ts`.

### UI/System Display
- `colorMode`
- `showSpecLabels`
- `previewExists`
- `lineHeightUnit`
- `roundingGridSize`
- `lineHeightCurve`
- `letterSpacingCurve`
- `activeMode`
- `namingConvention`

### Navigation/Workflow
- `currentView`
- `activeFlow`
- `generatorTab`
- `viewHistory`

### Editing/Authoring
- `hasManualTextEdits`
- `hasManualGridEdits`
- `styleVisibility`
- `styleFontSources` (values: `'primary'` | `'secondary'` | `'custom'`)
- `styleWeightLocked`
- `showGoogleFonts` (default: `false` — Google Fonts hidden by default in font dropdowns)

Behavior note:
- during specimen snapshot restore, `hasManualGridEdits` is enabled when snapshot styles are loaded, so recalc effects preserve restored numeric style values (size/line-height/letter-spacing) instead of regenerating them.
- selecting a preset profile in `GeneratorScreen` now clears override-preservation mode (`hasManualGridEdits`) so preset defaults can immediately re-apply after sampled/imported specimen restore.
- every `UPDATE_PREVIEW` now carries a full specimen snapshot payload from UI, and frame pluginData (`specimen-snapshot`) is overwritten atomically (not partially patched) so per-frame preset/mode/UI state stays exact when sampled later.
- snapshot payload persists/restores `selectedLayout` and `waterfallText` as legacy compatibility fields for older specimen frames; current generator behavior is preset-driven.

### Debug/Meta
- `featureFlags`
- `resetLog`
- `uiPanels.openSections`

---

## 5) High-Impact Local State In `ui.tsx`

`ui.tsx` is the orchestration layer; besides Zustand state, it maintains many transient states.

### Typography Runtime Data
- `fineTunedStyles`
- `debounceTimer`
- `googleFontsList`

### Specimen/Text Preset UI
- `selectedLayout` (legacy compatibility value restored from sampled frames)
- `previewTextAlign` (`'left' | 'center' | 'right'`; controls specimen heading alignment mode from footer ghost buttons)
- `waterfallText` (legacy compatibility value; not actively user-controlled in current UI)
- `selectedSpecimenPreset`
- `selectedTextPreset`
- `selectedPresetProfile` (Desktop/Mobile/Social/Deck/Product profile chips; persisted in specimen snapshot)
- dropdown-open booleans for specimen/text presets

### Styles CTA / Export UI
- `isStylesDropdownOpen`
- `selectedStylesAction`
- `isExportDropdownOpen`
- `activeLoadingCTA`
- `hasActiveSpecimenContext` (main-thread runtime signal indicating the current tweak target is a specimen preview frame)

### Scan Flow Bridge State
- `scannedFrameTextStyles`
- `loadedApiKey`
- `explicitTargetSystemForScan`
- `autoScanOnMatchOpen`
- `useSampledStyleVisibility`

### Structured Text / Smart Match Bridge
- `unformattedTextToStyle`
- `unformattedTextContentType`
- `smartMatchResults`

### Mapping Dialog States
- `weightMappingDialog`
- `variableMappingDialog`
- `unifiedUpdateDialog`
- `variableUpdateDecisionDialog` — REMOVED (replaced by checkbox in UnifiedUpdateScreen)

### Section Open/Close Local Mirror
- `openSections` (mirrors `uiPanels.openSections`)

---

## 6) Per-Screen Local State Summary

### GeneratorScreen
- `showOverrideModal`

### ScanResultsScreen
- `foundStylesData`
- `isApplyingMatches`
- `isScanning`
- `selectedSystem`
- dropdown positioning/open refs/state for mapping controls
- `detectedScaleRatioRef`

### TextInputScreen
- `text`
- `isLoading`
- `selectedContentTypeState`
- `isContentTypeDropdownOpen`
- API key modal state (`isApiKeyModalOpen`, `footerApiKey`)

### TextStyleAssignmentScreen
- `processedText`

### SmartMatchResultsScreen
- `headlineWeight`

### UnifiedUpdateScreen
- `mapping`
- `openDropdownKey`
- `dropdownPosition`

### WeightMappingScreen
- `weightMapping`
- `openDropdownKey`
- `dropdownPosition`

### VariableMappingScreen
- `variableMapping`
- `openDropdownKey`
- `dropdownPosition`

---

## 7) Screen Intent By Workflow

### Generator Workflow (primary)
- `main` (`generate` / `styles` tabs)
- optional wand -> `scanResults` -> apply -> back to `main`

### Structured Text Workflow (secondary / partial)
- `textInput` -> `textStyleAssignment`

### Update/Conflict Resolution Workflow (modal)
- `main` + one of:
  - `UnifiedUpdateScreen`
  - `WeightMappingScreen`
  - `VariableMappingScreen`

---

## 8) Cleanup Candidates (Architecture Debt)

- `landing` route remains in type + renderer despite generator-first product direction.
- `SmartMatchResultsScreen` is minimal and may be merged back into main flow.
- `TextStyleAssignmentScreen` is still placeholder-heavy.
- Some footer rows are present for layout consistency but include inactive actions.

