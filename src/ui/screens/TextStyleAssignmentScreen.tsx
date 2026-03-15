import { h, Fragment } from "preact";
import { useState, useCallback, useEffect } from "preact/hooks";
import { Icon } from "../components/Icon";
import { TypographySystem } from "../../core/types"; // Assuming types are in ../types

interface TextStyleAssignmentScreenProps {
  setCurrentView: (view: 'landing' | 'main' | 'scanResults' | 'textInput' | 'textStyleAssignment') => void;
  unformattedText: string;
  typographySystem: TypographySystem; // To display available styles
  contentType: string; // <<< ADDED: To receive the content type
  // Add other necessary props, e.g., for applying styles, interacting with main UI state
}

export function TextStyleAssignmentScreen({
  setCurrentView,
  unformattedText,
  typographySystem,
  contentType, // <<< ADDED: Destructure the prop
}: TextStyleAssignmentScreenProps) {
  // For now, just display the text and a placeholder for style controls
  // In a future step, this screen will:
  // 1. Parse the unformattedText into manageable segments (e.g., paragraphs, lines).
  // 2. Display these segments.
  // 3. For each segment (or selected text), allow users to choose a style from typographySystem.
  // 4. Potentially generate a preview or apply these styles to new Figma text nodes.

  const [processedText, setProcessedText] = useState<string[]>([]);

  useEffect(() => {
    // Simple processing: split text by newlines for now
    // More sophisticated parsing will be needed (e.g., paragraphs, headings)
    console.log('[TextStyleAssignmentScreen] Received content type:', contentType); // Log the received content type
    setProcessedText(unformattedText.split('\n').filter(line => line.trim() !== ''));
  }, [unformattedText, contentType]); // Added contentType to dependency array

  const handleBack = useCallback(() => {
    setCurrentView("textInput"); // Go back to the text input screen
  }, [setCurrentView]);

  const handleApplyStyles = useCallback(() => {
    // This will eventually trigger the creation of Figma text nodes with assigned styles
    console.log("[TextStyleAssignmentScreen] Apply Styles clicked. (Not yet implemented)");
    // Potentially: emit('APPLY_TEXT_STYLES_FROM_UNFORMATTED', { styledSegments: ... });
    // For now, perhaps navigate back or to a success/next step screen
  }, []);

  return (
    <Fragment>
      <div class="header-tabs-section">
        <div class="tab-row">
          <div class="header-title-group">
            <button
              className="ghost-button"
              onClick={handleBack}
              aria-label="Back to text input"
            >
              <Icon name="return-24" size={24} />
            </button>
                          <span class="section-title" style={{ fontWeight: "var(--font-weight-strong)"}}>Assign styles to text</span>
          </div>
          {/* Placeholder for potential future header controls */}
        </div>
      </div>

      <div class="main-content" style={{ paddingTop: "calc(var(--size-header-height) + var(--sizing-default-spacers-spacer-2))", paddingBottom: "calc(var(--size-row-height) + var(--sizing-default-spacers-spacer-4))" }}>
        <div class="section text-assignment-preview-section" style={{ borderTop: "none", flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          <div class="section-header" style={{ cursor: "default" }}>
            <span class="section-title">Text preview</span>
          </div>
          <div class="section-content text-preview-area" style={{ flexGrow: 1, overflowY: 'auto', padding: 'var(--sizing-default-spacers-spacer-2) var(--sizing-default-spacers-spacer-3)'}}>
            {processedText.map((paragraph, index) => (
              <p key={index} style={{ marginBottom: 'var(--sizing-default-spacers-spacer-2)'}}>{paragraph}</p>
            ))}
            {processedText.length === 0 && <p>No text provided.</p>}
          </div>
        </div>

        {/* Placeholder for style assignment controls. This might be a sidebar or a panel below. */}
        {/* For now, we'll imagine it's similar to the main UI's style grid or fine-tuning section. */}
        <div class="section text-assignment-controls-section" style={{ flexShrink: 0 }}>
           <div class="section-header" style={{ cursor: "default" }}>
            <span class="section-title">Typography controls (placeholder)</span>
          </div>
          <div class="section-content" style={{ padding: 'var(--sizing-default-spacers-spacer-2) var(--sizing-default-spacers-spacer-3)'}}>
            <p>Style assignment controls will appear here. Users will select text segments above and assign styles from the typography system.</p>
            {/* Example: Displaying keys from the typographySystem */}
            {Object.keys(typographySystem).length > 0 ? (
              <ul>
                {Object.keys(typographySystem).map(styleKey => (
                  <li key={styleKey}>{styleKey}</li>
                ))}
              </ul>
            ) : (
              <p>Typography system not loaded or empty.</p>
            )}
          </div>
        </div>
      </div>

      <div className="footer-fixed">
        <div className="footer-row footer-top-row" style={{ justifyContent: "flex-end" }}>
          <div className="footer-button-group" style={{ width: "auto" }}>
            <button
              className="button button-primary"
              onClick={handleApplyStyles} // This will need actual implementation
              // disabled={!hasAssignments} // Example disabled state
              style={{ flexGrow: 0, minWidth: "120px" }}
            >
              Apply Styles
            </button>
          </div>
        </div>
      </div>
    </Fragment>
  );
} 