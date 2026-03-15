import { h, Fragment } from "preact";
import { useState, useRef, useEffect, useMemo } from "preact/hooks";
import { Icon } from "../components/Icon";

interface PluginStyle {
  systemKey: string;
  displayName: string;
  size: number;
  fontFamily: string;
  fontStyle: string;
}

interface FigmaStyle {
  styleId: string;
  styleName: string;
  fontSize: number;
  fontFamily: string;
}

interface StyleMappingData {
  pluginStyles: PluginStyle[];
  figmaStyles: FigmaStyle[];
  autoMapping: { [systemKey: string]: string };
  originalRequest: any;
}

interface UnifiedUpdateScreenProps {
  data: StyleMappingData;
  onSubmit: (mapping: { [systemKey: string]: string }) => void;
  onCancel: () => void;
}

const ADD_NEW_STYLE_SENTINEL = "__add_new_style__";
const FOLDER_DROPDOWN_KEY = "__folder_filter__";
const UNSORTED_OPTION = "__unsorted__";

function getStyleFolderPath(styleName: string): string {
  const parts = styleName
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return UNSORTED_OPTION;
  }

  return parts.slice(0, -1).join(" / ");
}

function getStyleTailLabel(styleName: string): string {
  const parts = styleName.split("/").map((part) => part.trim());
  return parts[parts.length - 1] || styleName;
}

export function UnifiedUpdateScreen({ data, onSubmit, onCancel }: UnifiedUpdateScreenProps) {
  const { pluginStyles, figmaStyles, autoMapping } = data;

  const folderOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const style of figmaStyles) {
      const folderPath = getStyleFolderPath(style.styleName);
      counts.set(folderPath, (counts.get(folderPath) ?? 0) + 1);
    }

    const options: Array<{ id: string; label: string }> = [];

    if ((counts.get(UNSORTED_OPTION) ?? 0) > 0) {
      options.push({ id: UNSORTED_OPTION, label: "Unsorted" });
    }

    const sortedFolders = Array.from(counts.keys())
      .filter((folderPath) => folderPath !== UNSORTED_OPTION)
      .sort((a, b) => a.localeCompare(b));
    sortedFolders.forEach((folderPath) => options.push({ id: folderPath, label: folderPath }));

    return options;
  }, [figmaStyles]);

  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [mapping, setMapping] = useState<{ [systemKey: string]: string }>(() => ({ ...autoMapping }));
  const [openDropdownKey, setOpenDropdownKey] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top?: number;
    bottom?: number;
    left?: number;
    width?: number;
  } | null>(null);
  const dropdownListRef = useRef<HTMLDivElement>(null);
  const activeDropdownTriggerRef = useRef<HTMLButtonElement | null>(null);

  const filteredFigmaStyles = useMemo(() => {
    if (!selectedFolder) {
      return figmaStyles;
    }
    return figmaStyles.filter((style) => getStyleFolderPath(style.styleName) === selectedFolder);
  }, [figmaStyles, selectedFolder]);

  const toggleDropdown = (
    event: h.JSX.TargetedMouseEvent<HTMLButtonElement>,
    dropdownKey: string,
    optionCount: number
  ) => {
    const currentlyOpen = openDropdownKey === dropdownKey;

    if (currentlyOpen) {
      setOpenDropdownKey(null);
      setDropdownPosition(null);
      activeDropdownTriggerRef.current = null;
    } else {
      setOpenDropdownKey(dropdownKey);
      const button = event.currentTarget;
      activeDropdownTriggerRef.current = button;
      const buttonRect = button.getBoundingClientRect();

      const maxDropdownHeight = 240;
      const estimatedHeight = Math.min(Math.max(optionCount, 1) * 30, maxDropdownHeight);
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - buttonRect.bottom - 20;
      const spaceAbove = buttonRect.top - 20;
      const shouldOpenUpward = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

      const viewportWidth = window.innerWidth;
      const dropdownWidth = buttonRect.width;
      let leftPosition = buttonRect.left;

      if (leftPosition + dropdownWidth > viewportWidth - 20) {
        leftPosition = viewportWidth - dropdownWidth - 20;
      }
      if (leftPosition < 20) {
        leftPosition = 20;
      }

      const pos: typeof dropdownPosition = {
        left: leftPosition,
        width: dropdownWidth,
      };

      if (shouldOpenUpward) {
        pos.bottom = viewportHeight - buttonRect.top;
      } else {
        pos.top = buttonRect.bottom;
      }
      setDropdownPosition(pos);
    }
  };

  useEffect(() => {
    const allowedIds = new Set(filteredFigmaStyles.map((style) => style.styleId));
    setMapping((prev) => {
      let changed = false;
      const next = { ...prev };

      for (const pluginStyle of pluginStyles) {
        const currentId = next[pluginStyle.systemKey];
        if (!currentId || currentId === ADD_NEW_STYLE_SENTINEL) continue;
        if (allowedIds.has(currentId)) continue;

        const exactMatch = filteredFigmaStyles.find(
          (style) =>
            getStyleTailLabel(style.styleName).toLowerCase() === pluginStyle.displayName.toLowerCase()
        );

        if (exactMatch) {
          next[pluginStyle.systemKey] = exactMatch.styleId;
        } else {
          delete next[pluginStyle.systemKey];
        }
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [filteredFigmaStyles, pluginStyles]);

  const selectMapping = (systemKey: string, figmaStyleId: string) => {
    setMapping((prev) => ({ ...prev, [systemKey]: figmaStyleId }));
    setOpenDropdownKey(null);
    setDropdownPosition(null);
    activeDropdownTriggerRef.current = null;
  };

  const clearMapping = (systemKey: string) => {
    setMapping((prev) => {
      const next = { ...prev };
      delete next[systemKey];
      return next;
    });
    setOpenDropdownKey(null);
    setDropdownPosition(null);
    activeDropdownTriggerRef.current = null;
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!openDropdownKey) return;
      if (
        dropdownListRef.current && !dropdownListRef.current.contains(event.target as Node) &&
        activeDropdownTriggerRef.current && !activeDropdownTriggerRef.current.contains(event.target as Node)
      ) {
        setOpenDropdownKey(null);
        setDropdownPosition(null);
        activeDropdownTriggerRef.current = null;
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openDropdownKey]);

  const getFigmaStyleLabel = (styleId: string): string => {
    if (styleId === ADD_NEW_STYLE_SENTINEL) return "Add new style";
    const fs = figmaStyles.find((style) => style.styleId === styleId);
    if (!fs) return "None";
    return getStyleTailLabel(fs.styleName);
  };

  const mappedCount = Object.values(mapping).filter(Boolean).length;

  return (
    <Fragment>
      <div class="main-content">
        {/* Tab row — navigation only */}
        <div class="header-tabs-section">
          <div class="tab-row">
            <div class="header-title-group">
              <button className="ghost-button" onClick={onCancel} aria-label="Back">
                <Icon name="return-24" size={24} />
              </button>
            </div>
          </div>
        </div>

        {/* Section: Update Styles */}
        <div class="section section-open update-mapping-section">
          <div class="section-content update-mapping-content">
            <div class="control-row-with-dropdown update-mapping-columns-row">
              <div class="control-row-label-group">
                <span class="control-label" style={{ color: "var(--text-secondary)" }}>Local Styles</span>
                <span class="update-mapping-column-arrow">
                  <Icon name="navigate-forward-24" size={24} />
                </span>
              </div>
              <div class="control-row-label-group">
                <span class="control-label" style={{ color: "var(--text-secondary)" }}>Specimen Styles</span>
              </div>
            </div>
            <div class="control-row-with-dropdown update-mapping-folder-row">
              <div class="custom-dropdown-container header-section-dropdown-container">
                <button
                  className="input dropdown-trigger-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleDropdown(e, FOLDER_DROPDOWN_KEY, folderOptions.length);
                  }}
                >
                  <span className="dropdown-trigger-label">Choose Folder</span>
                </button>
              </div>
              <div />
            </div>
            {pluginStyles.map((pluginStyle) => {
              const selectedId = mapping[pluginStyle.systemKey];

              return (
                <div key={pluginStyle.systemKey} class="control-row-with-dropdown">
                  <div class="custom-dropdown-container header-section-dropdown-container">
                    <button
                      className="input dropdown-trigger-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDropdown(e, pluginStyle.systemKey, filteredFigmaStyles.length + 2);
                      }}
                    >
                      <span className="dropdown-trigger-label">
                        {selectedId ? getFigmaStyleLabel(selectedId) : "None"}
                      </span>
                    </button>
                  </div>

                  <div class="control-row-label-group">
                    <span class="control-label">{pluginStyle.displayName}</span>
                    <span class="control-row-arrow">{pluginStyle.size}px</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div class="footer-fixed">
        <div class="footer-row footer-top-row">
          <div class="footer-button-group">
            <div class="footer-main-cta" onClick={onCancel}>
              <div class="footer-main-cta-value">Cancel</div>
            </div>
            <div
              class={`footer-main-cta ${mappedCount > 0 ? "cta-highlighted" : ""}`}
              onClick={() => onSubmit(mapping)}
            >
              <div class="footer-main-cta-value">
                Update {mappedCount} Style{mappedCount !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
        </div>
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
          <button className="button-secondary-new with-icon">
            <Icon name="export-small-24" size={24} />
            Export
          </button>
        </div>
        <div className="footer-play-progress" />
      </div>

      {/* Top-level dropdown — fixed position */}
      {openDropdownKey && dropdownPosition && (() => {
        const isFolderDropdown = openDropdownKey === FOLDER_DROPDOWN_KEY;
        const selectedId = isFolderDropdown ? selectedFolder : mapping[openDropdownKey];

        return (
          <div
            ref={dropdownListRef}
            className="dropdown-list"
            style={{
              position: "fixed",
              top: dropdownPosition.top !== undefined ? `${dropdownPosition.top}px` : "auto",
              bottom: dropdownPosition.bottom !== undefined ? `${dropdownPosition.bottom}px` : "auto",
              left: dropdownPosition.left !== undefined ? `${dropdownPosition.left}px` : "auto",
              width: dropdownPosition.width !== undefined ? `${dropdownPosition.width}px` : "auto",
              maxHeight: "240px",
              overflowY: "auto",
              zIndex: 1000,
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="dropdown-items-container">
              {isFolderDropdown ? (
                folderOptions.map((option) => (
                  <button
                    key={option.id}
                    className={`dropdown-item ${selectedId === option.id ? "selected" : ""}`}
                    onMouseDown={() => {
                      setSelectedFolder(option.id);
                      setOpenDropdownKey(null);
                      setDropdownPosition(null);
                      activeDropdownTriggerRef.current = null;
                    }}
                  >
                    <span className="dropdown-item-text-content">{option.label}</span>
                  </button>
                ))
              ) : (
                <Fragment>
                  {filteredFigmaStyles.map((style) => {
                    const shortName = getStyleTailLabel(style.styleName);
                    return (
                      <button
                        key={style.styleId}
                        className={`dropdown-item ${selectedId === style.styleId ? "selected" : ""}`}
                        onMouseDown={() => selectMapping(openDropdownKey, style.styleId)}
                      >
                        <span className="dropdown-item-text-content">{shortName}</span>
                        <span className="control-row-arrow">{style.fontSize}px</span>
                      </button>
                    );
                  })}
                  <div className="dropdown-section-divider" />
                  <button
                    className={`dropdown-item ${selectedId === ADD_NEW_STYLE_SENTINEL ? "selected" : ""}`}
                    onMouseDown={() => selectMapping(openDropdownKey, ADD_NEW_STYLE_SENTINEL)}
                  >
                    <span className="dropdown-item-text-content">Add new style</span>
                  </button>
                  <button
                    className={`dropdown-item ${!selectedId ? "selected" : ""}`}
                    onMouseDown={() => clearMapping(openDropdownKey)}
                  >
                    <span className="dropdown-item-text-content">None</span>
                  </button>
                </Fragment>
              )}
            </div>
          </div>
        );
      })()}
    </Fragment>
  );
}
