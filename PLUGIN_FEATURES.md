# Specimen - Typography Plugin Features

## Core Typography System Generation

- Generate mathematically structured type scales from a base size and scale ratio.
- Produce a full style set (for example: display, headings, body, and tiny text tiers).
- Adjust global line-height behavior and letter-spacing behavior for the full system.
- Apply rounding/grid logic so output values stay consistent and design-system friendly.
- Configure naming conventions for generated style labels.

## Interactive Controls And Authoring

- Main generator workflow with dedicated `Generate` and `Styles` tabs.
- Fine-tune style-level values and visibility from the styles grid.
- Support manual style edits without losing broader system context.
- Configure font inputs and font-source behavior for styles.
- Toggle and manage UI sections/panels for focused editing.

## Specimen Canvas Creation And Preview

- Create a full typography specimen frame on the Figma canvas.
- Real-time preview updates as typography settings change.
- Specimen preset and text preset support for faster iteration.
- Waterfall/custom preview text controls to inspect readability and rhythm.
- `Play text` control that generates new content with typing animation for specimen headlines.
- Auto-play text cycling mode for continuous copy variation preview.
- One-click reset back to generated specimen text after manual text edits.
- Show/hide specimen labels for cleaner review or documentation output.

## Canvas Text Editing And Sync Behavior

- Directly editing preview text on canvas triggers live text mirroring across matching style categories.
- Debounced text mirroring keeps typing responsive while synchronizing related nodes.
- Manual text edits are detected and reflected back to the UI state.
- Recalculation is triggered after manual edits so canvas and control-driven preview stay aligned.
- Includes safeguards to prevent recursive/internal update loops during automated text operations.

## Figma Text Style Creation And Updating

- Create native Figma text styles from the current generated system.
- Update existing text styles from the plugin system.
- Unified style mapping workflow when updating local styles.
- Resolve missing weight conflicts via a dedicated weight-mapping flow.
- Resolve variable binding conflicts with update/preserve/disconnect choices.

## Frame Scan And Smart Matching Workflow

- Scan selected frames to detect existing typography usage.
- Auto-map detected text sizes to the plugin's system styles.
- Manually correct mappings using per-row assignment controls.
- Apply mapped styles back to the scanned frame.
- Send inferred scale/base and mapped style data back into the main generator flow.

## Structured Text Workflow (Secondary / Partial)

- Structured text input screen for text-based processing flows.
- Content-type selection and processing entry point.
- Text style assignment screen for mapping processed text segments (currently partial/placeholder).

## Theming And Display Modes

- Light/dark mode toggle in the UI footer.
- Theme switch applies to specimen canvas colors (background and text) in the active preview frame.
- Additional display/system state controls (for example responsive and mode-related toggles).
- Control units and display behavior for line-height presentation.

## Export And Action Controls

- Dedicated styles actions area (create/update style-related actions).
- Dedicated export action surface in the UI flow.
- Loading/CTA state handling to prevent conflicting user actions.
- Quick select action to select all preview text nodes on canvas for bulk editing operations.

## Library/Reuse Oriented Capabilities

- Generated specimen can serve as a reusable source of truth for future typography work.
- Existing specimen/state can be restored and reused in follow-up editing sessions.

## Legacy, Hidden, And Future-Ready Capabilities

- `landing` route exists as a legacy path but normal boot flow starts in `main`.
- Smart-match and structured-text paths are present but currently secondary/partial in UX.
- AI/LLM utilities exist in `src/api` but are currently disabled in production UI.

## Navigation Surfaces (Current Runtime)

- Primary screen: `GeneratorScreen` (`currentView: main`).
- Secondary routes: `ScanResultsScreen`, `TextInputScreen`, `TextStyleAssignmentScreen`, `SmartMatchResultsScreen`.
- Dialog workflows: `UnifiedUpdateScreen`, `WeightMappingScreen`, `VariableMappingScreen`.

