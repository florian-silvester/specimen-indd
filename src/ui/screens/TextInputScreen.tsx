import { h, Fragment } from "preact";
import { useState, useCallback, useEffect, useRef } from "preact/hooks";
import { Icon } from "../components/Icon";
import { emit, on } from "@create-figma-plugin/utilities";
import { useAppStore } from '../store/appStore';
import { TypographySystem, FontInfo } from "../../core/types"; // <<< ADDED TYPES IMPORT

// Copied from FrameFlowScreen
export interface SaveApiKeyEvent {
  apiKey: string;
}

interface ProcessUnformattedTextRequestEvent {
  unformattedText: string;
  selectedContentType: string;
  typeSystem: TypographySystem;
  selectedStyle: string;
  showSpecLabels: boolean;
  currentColorMode: 'light' | 'dark';
  availableFontsList: FontInfo[];
  baseFontFamily: string;
  activeScaleRatio: number;
  activeMode: 'desktop' | 'mobile';
}

// ADDED: Event interface for LLM response
interface ProcessUnformattedTextResponseEvent {
  success: boolean;
  error?: string;
  // If successful, we might not need to pass data back here if main.ts directly triggers frame creation
}

interface TextInputScreenProps {
  setCurrentView: (view: 'landing' | 'main' | 'scanResults' | 'textInput' | 'textStyleAssignment') => void;
  apiKeyFromStorage?: string | null; // ADDED: Prop to receive API key from parent
  typeSystem: TypographySystem;
  currentSelectedStyle: string;
  currentShowSpecLabels: boolean;
  currentColorMode: 'light' | 'dark';
  currentAvailableFontsList: FontInfo[];
  currentBaseFontFamily: string;
  currentActiveScaleRatio: number;
  // currentActiveMode is now managed by Zustand store
}

// Define content type options
const contentTypeOptions = [
  { label: "Article", value: "general" },
  { label: "Blog Post", value: "blog" },
  { label: "Marketing Page", value: "marketing" },
  // Add more options as needed
];

export function TextInputScreen({
  setCurrentView,
  apiKeyFromStorage,
  typeSystem,
  currentSelectedStyle,
  currentShowSpecLabels,
  currentColorMode,
  currentAvailableFontsList,
  currentBaseFontFamily,
  currentActiveScaleRatio,
}: TextInputScreenProps) {
  // Get state from Zustand store
  const { activeMode } = useAppStore();
  
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedContentTypeState, setSelectedContentTypeState] = useState<string>(contentTypeOptions[0].value);
  const [isContentTypeDropdownOpen, setIsContentTypeDropdownOpen] = useState(false);
  const contentTypeDropdownRef = useRef<HTMLDivElement>(null);

  // --- API Key Modal State and Handlers (Copied from FrameFlowScreen) ---
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [footerApiKey, setFooterApiKey] = useState("");

  useEffect(() => {
    if (apiKeyFromStorage) {
      setFooterApiKey(apiKeyFromStorage);
      console.log('[TextInputScreen] API key set from prop:', apiKeyFromStorage);
    }
  }, [apiKeyFromStorage]);

  const toggleApiKeyModal = () => {
    setIsApiKeyModalOpen(!isApiKeyModalOpen);
  };

  const handleClearApiKey = () => setFooterApiKey("");
  const handleApplyApiKeyInModal = () => {
    console.log("[TextInputScreen] Saving and Applying API Key from modal:", footerApiKey);
    emit("SAVE_API_KEY", { apiKey: footerApiKey } as SaveApiKeyEvent);
    toggleApiKeyModal();
  };
  // --- End API Key Modal State and Handlers ---

  const handleContinue = useCallback(() => {
    if (text.trim() === "") {
      console.warn("[TextInputScreen] Text is empty, not proceeding.");
      return;
    }
    setIsLoading(true);
    console.log("[TextInputScreen] Continue clicked. Emitting PROCESS_UNFORMATTED_TEXT_REQUEST.");
    
    emit('PROCESS_UNFORMATTED_TEXT_REQUEST', {
      unformattedText: text,
      selectedContentType: selectedContentTypeState,
      typeSystem: typeSystem,
      selectedStyle: currentSelectedStyle,
      showSpecLabels: currentShowSpecLabels,
      currentColorMode: currentColorMode,
      availableFontsList: currentAvailableFontsList,
      baseFontFamily: currentBaseFontFamily,
      activeScaleRatio: currentActiveScaleRatio,
      activeMode: activeMode
    } as ProcessUnformattedTextRequestEvent);

  }, [
    text, 
    selectedContentTypeState, 
    typeSystem,
    currentSelectedStyle,
    currentShowSpecLabels,
    currentColorMode,
    currentAvailableFontsList,
    currentBaseFontFamily,
    currentActiveScaleRatio,
    activeMode
  ]);

  // ADDED: Listener for LLM processing response
  useEffect(() => {
    const handleProcessResponse = on('PROCESS_UNFORMATTED_TEXT_RESPONSE', (data: ProcessUnformattedTextResponseEvent) => {
      console.log("[TextInputScreen] Received PROCESS_UNFORMATTED_TEXT_RESPONSE:", data);
      setIsLoading(false);
      if (!data.success) {
        console.error("[TextInputScreen] LLM processing failed:", data.error);
      }
    });

    return () => {
      handleProcessResponse();
    };
  }, []);

  // ADDED: useEffect for Content Type Dropdown Outside Click
  useEffect(() => {
    if (!isContentTypeDropdownOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (contentTypeDropdownRef.current && !contentTypeDropdownRef.current.contains(event.target as Node)) {
        setIsContentTypeDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isContentTypeDropdownOpen]);
  // --- END ADDED useEffect ---

  const currentSelectedContentTypeLabel = contentTypeOptions.find(opt => opt.value === selectedContentTypeState)?.label || selectedContentTypeState;

  return (
    <Fragment>
      <div class="header-tabs-section">
        <div class="tab-row">
          <div class="header-title-group">
            <button
              className="ghost-button"
              onClick={() => setCurrentView("landing")}
              aria-label="Back to landing screen"
            >
              <Icon name="return-24" size={24} />
            </button>
                          <span class="section-title" style={{ fontWeight: "var(--font-weight-strong)"}}>Text input</span>
          </div>
          {/* Placeholder for potential future header controls */}
        </div>
      </div>

      <div class="main-content"> {/* Remove custom padding styles */}
        <div class="section section-open"> {/* Add section-open class, remove borderTop override */}
          <div class="section-header" style={{ cursor: "default" }}>
            <div className="section-header-titles-container section-header-left">
              <span class="section-title">Add text to generate content for layout types</span>
            </div>
          </div>
          <div class="section-content"> {/* Use standard section-content padding */}
            <textarea
              className="input text-input-area-large" // Added new class for styling
              value={text}
              onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
              placeholder="Paste text here..."
              rows={10} // Adjust as needed
              style={{ minHeight: "200px", height: "auto", resize: "vertical"}}
            />
          </div>
        </div>

        <div class="section section-open"> {/* Add section-open class, remove custom styles */}
          <div class="section-header" style={{ cursor: "default" }}>
            <div className="section-header-titles-container section-header-left">
              <span className="section-title">Layout</span>
            </div>
            <div
              ref={contentTypeDropdownRef}
              className="custom-dropdown-container header-section-dropdown-container"
            >
              <button
                className="input dropdown-trigger-button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsContentTypeDropdownOpen(!isContentTypeDropdownOpen);
                }}
                aria-label="Select layout"
              >
                <span className="dropdown-trigger-label">
                  {currentSelectedContentTypeLabel}
                </span>
              </button>
              {isContentTypeDropdownOpen && (
                <div
                  className="dropdown-list base-size-preset-dropdown-list"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <div className="dropdown-items-container base-size-items-container">
                    {contentTypeOptions.map(option => (
                      <button
                        key={option.value}
                        className={`dropdown-item ${selectedContentTypeState === option.value ? 'selected' : ''}`}
                        onMouseDown={() => {
                          setSelectedContentTypeState(option.value);
                          setIsContentTypeDropdownOpen(false);
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
      </div>

      <div className="footer-fixed">
        <div className="footer-row footer-top-row">
          <div className="footer-button-group">
            <button
              className="button button-primary"
              onClick={handleContinue}
              disabled={isLoading || text.trim() === ""}
            >
              {isLoading ? (
                <Icon name="loading-small-24" size={20} className="loading-svg" />
              ) : (
                "Continue"
              )}
            </button>
          </div>
        </div>
        <div className="footer-row footer-bottom-row">
          <div style={{ flexGrow: 1 }}></div> 
          <button className="button-secondary-new with-icon" onClick={toggleApiKeyModal}> 
            <Icon name="key-small-24" size={24} /> 
                          API key
          </button>
        </div>
      </div>

      {isApiKeyModalOpen && (
        <div className="modal-overlay" onClick={toggleApiKeyModal}> 
          <div className="modal-content" onClick={(e) => e.stopPropagation()}> 
            <div className="modal-header-row" style={{ display: 'flex', alignItems: 'center', paddingBottom: 'var(--sizing-default-spacers-spacer-2)' }}>
              <span className="section-title" style={{ flexGrow: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Enter API key</span>
                              <button className="icon-button" onClick={toggleApiKeyModal} aria-label="Close API key modal" style={{ marginLeft: 'auto' }}>
                <Icon name="close-24" size={24} />
              </button>
            </div>
            <div className="control-row" style={{ marginBottom: 'var(--sizing-default-spacers-spacer-3)' }}>
              <div style={{ width: '100%' }}> 
                <input 
                  type="text" 
                  className="input input-api-key-style"
                  value={footerApiKey}
                  onInput={(e: any) => setFooterApiKey(e.currentTarget.value)}
                  placeholder="sk-f1ct10nAlOp3nAIk3yxxxxxxxxxxxxxxxxxx"
                  style={{ width: '100%' }} 
                />
              </div>
            </div>
            <div className="footer-button-group">
              <button className="button button-secondary" onClick={toggleApiKeyModal}>
                Cancel
              </button>
              <button className="button button-secondary" onClick={handleClearApiKey}>
                Clear
              </button>
              <button className="button button-primary" onClick={handleApplyApiKeyInModal}>
                Apply key
              </button>
            </div>
          </div>
        </div>
      )}
    </Fragment>
  );
} 