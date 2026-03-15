# Button & CTA Inconsistencies Audit

This document outlines the current state of button and Call-To-Action (CTA) styles across the Specimen UI, highlighting the inconsistencies that cause them to look and act differently.

## 1. Multiple Base Button Systems
The UI currently ships with multiple base button variants that are used inconsistently across different screens:

- **Legacy Buttons (`.button-primary`, `.button-secondary`)**
  - Found in: `TextInputScreen.tsx`, `TextStyleAssignmentScreen.tsx`, `UnifiedUpdateScreen.tsx`
  - Characteristics: Traditional button styling.
- **New Buttons (`.button-primary-new`, `.button-secondary-new`)**
  - Found in: `GeneratorScreen.tsx`, `FooterSection.tsx`, `FontControlSection.tsx`, modal actions.
  - Characteristics: Includes specific hover pseudo-elements (`::before`), different flex-alignments (`justify-content: flex-start`), and specialized border treatments.
- **Ghost Buttons (`.ghost-button`)**
  - Found in: Grid rows, section headers, tab rows.
  - Characteristics: No borders, subtle background on hover, icon-centric.
- **Icon Buttons (`.icon-button`)**
  - Found in: Grids, segmented inputs.

## 2. Structural & Semantic Inconsistencies
Not all CTAs are actual `<button>` elements, which breaks native focus, active, and disabled states:

- **Footer Primary CTAs ("Generate", "Create Styles")**
  - Built using `<div>` elements with `.combo-input` and `.combo-input-value` classes.
  - They mimic buttons but lack native button behaviors (keyboard navigation is simulated or missing, disabled state handling is custom).
  - Background hover/active states are handled differently than standard `.button` classes.
- **Header Section Triggers**
  - Built using `<div class="section-header" role="button" tabIndex={0}>`.
  - While they have ARIA roles, they behave differently under the hood compared to standard buttons.

## 3. Context-Specific Overrides (The "Where you are" problem)
Button appearance changes based on where the button is placed due to aggressive CSS scoping:

- **Footer Secondary Buttons**
  - In `layout.css`, `.footer-secondary-button-group .button-secondary-new` completely removes borders and backgrounds:
    ```css
    .footer-secondary-button-group .button-secondary-new {
      background-color: transparent;
      border: none;
    }
    ```
  - This makes a `.button-secondary-new` in the footer look like a `.ghost-button`, while the exact same class in the `GeneratorScreen` modal looks like an outlined button.
- **Control Row Buttons**
  - `.font-selection-control-row .button-secondary-new.full-width-button` has overrides forcing left alignment and custom hover backgrounds, drifting from the base component styles.

## 4. State Management (Hover, Focus, Disabled)
Because of the multiple systems, interactive states are fractured:

- **Hover States:**
  - `button-primary-new` uses an opacity transition on a `::before` pseudo-element for its hover state.
  - `combo-input` relies on wrapper class changes.
  - `ghost-button` uses a simple `background-color` swap.
- **Disabled States:**
  - True buttons use `opacity: var(--opacity-disabled)` and `cursor: not-allowed`.
  - Dropdown trigger buttons specifically override disabled states to maintain full opacity (`opacity: 1 !important`) but change the background color instead.
- **Focus Rings:**
  - Some buttons rely on standard `box-shadow: var(--focus-ring-shadow)`, but footer combo inputs use custom outline logic (e.g., `.cta-highlighted` uses `box-shadow: 0 0 0 1px var(--border-accent)`).

## Recommendation for Normalization
To fix this, a global refactoring pass is needed:

1. **Unify HTML:** Convert all `div.combo-input-value` and custom interactive `div` wrappers to semantic `<button>` elements.
2. **Consolidate Classes:** Deprecate `*-new` suffixes. Standardize on `.button-primary`, `.button-secondary`, and `.button-ghost`.
3. **Remove Context Overrides:** Remove location-based styles (like `.footer-secondary-button-group .button-secondary-new`) and instead use proper utility classes or variants (e.g., explicit `.button-ghost` in the footer).
4. **Standardize States:** Ensure all buttons use the exact same CSS variables for hover overlays, focus rings, and disabled opacities.
