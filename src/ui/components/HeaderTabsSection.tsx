import { h, ComponentType } from "preact";
import { emit } from "@create-figma-plugin/utilities";
import { useAppStore } from "../store/appStore";

interface IconProps { name: string; size: number; className?: string; }

export interface HeaderTabsSectionProps {
  IconComponent: ComponentType<IconProps>;
  stylesCount?: number;
}

export function HeaderTabsSection({
  IconComponent,
  stylesCount = 0,
}: HeaderTabsSectionProps) {
  const { currentView, generatorTab, setGeneratorTab } = useAppStore();
  
  return (
    <div class="header-tabs-section">
      <div class="tab-row">
        <div class="header-title-group"> 
          {/* Generate / Styles tabs - only on main view */}
          {currentView === 'main' && (
            <div class="tabs-container">
              <button
                className={`tab-button ${generatorTab === 'generate' ? 'active' : ''}`}
                onClick={() => setGeneratorTab('generate')}
              >
                Generate
              </button>
              <button
                className={`tab-button ${generatorTab === 'styles' ? 'active' : ''}`}
                onClick={() => setGeneratorTab('styles')}
              >
                <span>Styles</span>
                <span className="tab-button-count tab-button-count--sup">{stylesCount}</span>
              </button>
            </div>
          )}
        </div>
        <div className="header-actions-group">
          <button
            className="ghost-button"
            onClick={() => {
              console.log('[HeaderTabsSection] Smart import activated');
              emit('REQUEST_SMART_IMPORT');
            }}
            aria-label="Import from selected frame"
            data-tooltip="Import from selected frame"
          >
            <IconComponent name="true" size={24} />
          </button>
        </div>
      </div>
    </div>
  );
} 