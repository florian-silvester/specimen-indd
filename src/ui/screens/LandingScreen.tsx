import { h, Fragment } from "preact";
import { useState, useCallback } from "preact/hooks"; // Added useCallback
import { emit, on } from "@create-figma-plugin/utilities";
import { Icon } from "../components/Icon";
import { TargetedEvent } from 'preact/compat'; // <<< ADD IMPORT HERE

interface LandingScreenProps {
  setCurrentView: (view: 'landing' | 'main' | 'scanResults' | 'textInput' | 'textStyleAssignment') => void;
  // Add other props to pass data to the main UI if needed for different flows
}

export function LandingScreen({ setCurrentView }: LandingScreenProps) {
  const handleOptionClick = useCallback((flow: 'specimen' | 'frame' | 'text', event?: TargetedEvent<HTMLElement, MouseEvent>) => {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    console.log(`[LandingScreen] Option clicked: ${flow}`);
    if (flow === 'frame') {
      setCurrentView('scanResults');
    } else if (flow !== 'text') {
      setCurrentView('main');
    }
  }, [setCurrentView]);

  return (
    <Fragment>
      {/* Header (Reused - ui.tsx will handle conditional rendering of its parts) */}
      {/* Footer (Reused - ui.tsx will handle conditional rendering of its parts) */}

      {/* Main Content for Landing Screen */}
      <div class="main-content"> {/* Standard main content wrapper */}
        {/* Intro Wrap - Styled to match Figma node 1027527:8299 */}
        <div
          className="landing-intro-wrap"
        >
          {/* Header Logo section */}
          <div
            className="landing-header-logo-group"
          >
            <Icon name="logo" size={72} />
          </div>

          {/* Header Text section */}
          <div
            className="landing-header-text-group"
          >
            <p
              className="landing-intro-text" // Styles for this class are in ui-styles.css
              style={{ color: "var(--text-secondary)" }}
            >
              Create consistent typography scales, generate design tokens, and export them for use in your design system.
            </p>
          </div>
        </div>

        {/* Option: Start from Specimen */}
        <div class="section landing-option-section">
          <div className="section-header" tabIndex={0} role="button" onClick={(e) => handleOptionClick('specimen', e)} onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOptionClick('specimen'); } }}>
            <div class="section-header-titles-container section-header-left">
              <span class="section-title">Start from Specimen</span>
            </div>
            <div className="icon-wrap-right">
              <Icon name="navigate-forward-24" size={24} />
            </div>
          </div>
        </div>

        {/* Option: Start from Selected Frame */}
        <div class="section landing-option-section">
          <div className="section-header" tabIndex={0} role="button" onClick={(e) => handleOptionClick('frame', e)} onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOptionClick('frame'); } }}>
            <div class="section-header-titles-container section-header-left">
                              <span class="section-title">Start from selected frame</span>
            </div>
            <div className="icon-wrap-right">
              <Icon name="navigate-forward-24" size={24} />
            </div>
          </div>
        </div>

        {/* NEW Option: Start from unformatted text - DISABLED (kept for future use) */}
        {/* <div class="section landing-option-section">
          <div className="section-header" onClick={(e) => {
            if (e) { e.stopPropagation(); e.preventDefault(); }
            setCurrentView('textInput');
            handleOptionClick('text', e);
          }}>
            <div class="section-header-titles-container section-header-left">
                              <span class="section-title">Start from text input</span>
            </div>
            <div className="icon-wrap-right">
              <Icon name="navigate-forward-24" size={24} />
            </div>
          </div>
        </div> */}

      </div>

      {/* Footer */}
      <div className="footer-fixed">
        <div className="footer-row footer-bottom-row">
          <div className="footer-button-group footer-secondary-button-group">
            <button className="button-secondary-new icon-only" disabled>
              <Icon name="play-small-24" size={24} />
            </button>
            <button className="button-secondary-new" disabled>
              Dark
            </button>
            <button className="button-secondary-new" disabled>
              Hide specs
            </button>
          </div>
          <button className="button-secondary-new with-icon" disabled>
            <Icon name="export-small-24" size={24} />
            Export
          </button>
        </div>
      </div>
    </Fragment>
  );
} 