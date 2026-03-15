# Complete Specimen CTA & Button Classes Inventory

This is the definitive list of all CTA/button classes, wrappers, and overrides currently active in the Specimen CSS architecture.

## 1. Base Button Classes (The Core System)
These are defined primarily in `src/ui/styles/components/buttons.css` and `src/ui/styles/utils/_atoms-utilities.css`.

- **`.button`** 
  - The foundational class. Handles layout (inline-flex, alignments, padding) and typography.
- **`.button-primary`** 
  - Legacy solid button variant (black background, white text).
- **`.button-secondary`** 
  - Legacy outline button variant (transparent background, translucent border).
- **`.button-primary-new`** 
  - Newer solid button variant. Forces `justify-content: flex-start`. Uses `::before` pseudo-element for hover states.
- **`.button-secondary-new`** 
  - Newer outline button variant. Currently the most heavily used standard button.
- **`.ghost-button`** 
  - Icon-centric button with a transparent background that turns solid on hover.
- **`.icon-button`** 
  - Used purely for icons (mostly in the grid). No background transitions by default.
- **`.button-small`** 
  - A size modifier that forces the button down to 24px height instead of 32px.
- **`.button-secondary-new.icon-only` / `.icon-button-size`**
  - Modifiers that force the button into a square aspect ratio.
- **`.button-secondary-new.with-icon`**
  - A utility modifier ensuring proper gap spacing when an icon is paired with text.

## 2. Structural/Mock Buttons (The "Div" CTAs)
These are not real `<button>` elements, but act as the primary CTAs in the application.

- **`.combo-input`** 
  - The wrapper `div` used in the Footer for the primary actions ("Generate", "Create Styles").
- **`.combo-input-value`** 
  - The actual clickable text area of the primary footer CTA.
- **`.combo-input-trigger`** 
  - The clickable chevron/dropdown trigger attached to the side of the combo input.
- **`.combo-input.cta-highlighted`** 
  - A state modifier that wraps the CTA in an accent-colored border/box-shadow.

## 3. Top-Level Tab & Section Buttons
These control navigation and UI layout toggles.

- **`.tab-button`** 
  - Used in the main header for switching between "Generate" and "Styles".
- **`.toggle-button`** 
  - Used inside `.toggle-container` for segmented controls.
- **`.section-header`** 
  - Technically a `div`, but serves as a massive interactive `<button>` for opening/closing accordion sections.

## 4. Contextual Overrides (The specific, aggressive styles)
These are the rules that break or fundamentally change the base classes above based on where they are placed.

- **`.override-modal-actions .button-secondary-new`** 
  - (In `layout.css`) Forces the button to flex-grow and center itself in modals.
- **`.override-modal-actions .button-secondary-new.modal-load-button`** 
  - (In `layout.css`) Completely transforms a secondary (outline) button into a solid black primary button specifically for the "Load" action.
- **`.footer-secondary-button-group .button-secondary-new`** 
  - (In `layout.css`) Aggressively strips backgrounds and borders from secondary buttons in the footer bottom row, essentially turning them into ghost buttons.
- **`.font-selection-control-row .button-secondary-new.full-width-button`** 
  - (In `buttons.css`) Forces text to be left-aligned with custom padding for font-selection dropdowns.

## 5. State Classes
Instead of relying purely on CSS pseudo-classes (`:active`, `:focus`, `:hover`, `:disabled`), the UI often utilizes manual state classes applied via React/JavaScript.

- **`.active`** 
  - Appended via JS to manually force an active/pressed appearance.
- **`.selected`** 
  - Used predominantly in dropdown lists (`.dropdown-item.selected`).
- **`.disabled`** 
  - While `:disabled` is used, some elements have custom opacity rules overriding standard disabled states (e.g., dropdown triggers).