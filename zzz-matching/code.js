// Show UI
figma.showUI(__html__, { width: 480, height: 600 });

// --- Configuration ---
// Properties to check
const PROPERTIES_TO_CHECK = [
  // Auto Layout Spacing
  'itemSpacing',
  // Padding
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  // Text
  'fontSize',
  // Border
  'strokeWeight',
  // Border Radius
  'cornerRadius'
];

// --- NEW Global Helper Location ---
// Cache resolved values to avoid redundant lookups across different calls
const resolvedValueCache = new Map();

async function getResolvedVariableValue(variableId, depth = 0) {
    if (depth > 10) { // Safety break for potential cycles
        console.warn(`[Resolve Var] Max recursion depth reached for ${variableId}`);
        return { value: 'Error: Max Depth', type: 'ERROR' };
    }
    // Check cache using a combination of variableId and depth? Or assume same varId always resolves same?
    // For simplicity, let's assume same varId resolves same within a single plugin run cycle
    if (resolvedValueCache.has(variableId)) {
        // console.log(`[Resolve Var] Cache hit for ${variableId}`);
        return resolvedValueCache.get(variableId);
    }

    try {
        const variable = await figma.variables.getVariableByIdAsync(variableId);
        if (!variable) {
            console.warn(`[Resolve Var] Variable not found: ${variableId}`);
            return { value: 'Error: Not Found', type: 'ERROR' };
        }

        const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
        if (!collection || !collection.defaultModeId) {
            console.warn(`[Resolve Var] Could not get default mode for ${variable.name} (Collection ID: ${variable.variableCollectionId}). Using fallback value.`);
            const fallbackValue = variable.valuesByMode[Object.keys(variable.valuesByMode)[0]];
            console.log(`[Resolve Var] Fallback value for ${variable.name}:`, fallbackValue);
            const result = { value: fallbackValue, type: variable.resolvedType };
            resolvedValueCache.set(variableId, result); // Cache fallback result
            console.log(`[Resolve Var] -> Returning fallback result for ${variableId}:`, result);
            return result;
        }
        const modeId = collection.defaultModeId;

        const modeValue = variable.valuesByMode[modeId];
        console.log(`[Resolve Var] Value for ${variable.name} in mode ${modeId}:`, modeValue);

        if (modeValue?.type === 'VARIABLE_ALIAS') {
            console.log(`[Resolve Var] Following alias from ${variable.name} (${variableId}) to ${modeValue.id}`);
            const resolvedAlias = await getResolvedVariableValue(modeValue.id, depth + 1);
            console.log(`[Resolve Var] Alias resolved for ${variable.name} (${variableId}), result:`, resolvedAlias);
            resolvedValueCache.set(variableId, resolvedAlias);
            return resolvedAlias;
        } else {
            console.log(`[Resolve Var] Resolved ${variable.name} (${variableId}) to primitive:`, modeValue, `Type: ${variable.resolvedType}`);
            const result = { value: modeValue, type: variable.resolvedType };
            resolvedValueCache.set(variableId, result);
            console.log(`[Resolve Var] -> Returning primitive result for ${variableId}:`, result);
            return result;
        }
    } catch (e) {
        console.error(`[Resolve Var] Error resolving variable ${variableId}:`, e);
        return { value: 'Error: Exception', type: 'ERROR' };
    }
}
// --- END Global Helper Location ---

// --- Core Functions ---

function findUnassignedProperties(nodes, availableVariables, textStyles) {
  const unassigned = [];
  
  // Extract valid style IDs outside the recursion for performance
  const validStyleIds = textStyles ? textStyles.map(style => style.id) : [];

  function findRecursively(node) {
    console.log(`[Debug Simple] Running findRecursively for Node: ${node.name} (Type: ${node.type}, ID: ${node.id})`);

    // --- Skip VECTOR nodes entirely ---
    if (node.type === 'VECTOR') {
        console.log(`[Skip] Skipping VECTOR node: ${node.name}`);
        return; // Don't process vectors
    }

    // --- TEXT DEBUG --- 
    if (node.type === 'TEXT') {
      // Simplified logging to avoid any potential bundling issues
      const textPreview = node.characters ? node.characters.substring(0, 30) : '';
      const hasStyle = node.textStyleId ? true : false;
      console.log(`[Text Debug] Text: "${textPreview}", Style: ${hasStyle}, Size: ${node.fontSize}`);
    }

    // Handle Auto Layout Spacing
    if ('itemSpacing' in node && node.itemSpacing !== figma.mixed) {
      const value = node.itemSpacing;
      if (typeof value === 'number' && value > 0) {
        let isBound = false;
        try {
          if (node.boundVariables && node.boundVariables.itemSpacing) {
            isBound = true;
          }
        } catch (e) { /* Ignore */ }
        
        if (!isBound) {
          // Determine spacing category based on layout mode
          const category = node.layoutMode === 'VERTICAL' ? 'al.spacing-vertical' : 'al.spacing-horizontal';
          unassigned.push({ 
            nodeId: node.id, 
            propertyName: 'itemSpacing', 
            value: value, 
            category: category 
          });
        }
      }
    }

    // Handle Padding
    const paddingProps = {
      paddingTop: 'al.padding-top',
      paddingRight: 'al.padding-right',
      paddingBottom: 'al.padding-bottom',
      paddingLeft: 'al.padding-left'
    };

    // First check for combined padding cases
    if (node.paddingTop === node.paddingRight &&
        node.paddingRight === node.paddingBottom &&
        node.paddingBottom === node.paddingLeft &&
        typeof node.paddingTop === 'number' &&
        node.paddingTop > 0) {
      // All sides are equal
      let isBound = false;
      try {
        if (node.boundVariables && (
          node.boundVariables.paddingTop ||
          node.boundVariables.paddingRight ||
          node.boundVariables.paddingBottom ||
          node.boundVariables.paddingLeft
        )) {
          isBound = true;
        }
      } catch (e) { /* Ignore */ }
      
      if (!isBound) {
        unassigned.push({
          nodeId: node.id,
          propertyName: 'paddingTop', // Use any side as they're all equal
          value: node.paddingTop,
          category: 'al.padding-all'
        });
      }
    } else {
      // Check for vertical/horizontal pairs
      const hasEqualVertical = node.paddingTop === node.paddingBottom && 
                              typeof node.paddingTop === 'number' && 
                              node.paddingTop > 0;
      const hasEqualHorizontal = node.paddingLeft === node.paddingRight && 
                                typeof node.paddingLeft === 'number' && 
                                node.paddingLeft > 0;

      if (hasEqualVertical) {
        let isBoundVertical = false;
        try {
          if (node.boundVariables && (
            node.boundVariables.paddingTop ||
            node.boundVariables.paddingBottom
          )) {
            isBoundVertical = true;
          }
        } catch (e) { /* Ignore */ }
        
        if (!isBoundVertical) {
          unassigned.push({
            nodeId: node.id,
            propertyName: 'paddingTop',
            value: node.paddingTop,
            category: 'al.padding-vertical'
          });
        }
      }

      if (hasEqualHorizontal) {
        let isBoundHorizontal = false;
        try {
          if (node.boundVariables && (
            node.boundVariables.paddingLeft ||
            node.boundVariables.paddingRight
          )) {
            isBoundHorizontal = true;
          }
        } catch (e) { /* Ignore */ }
        
        if (!isBoundHorizontal) {
          unassigned.push({
            nodeId: node.id,
            propertyName: 'paddingLeft',
            value: node.paddingLeft,
            category: 'al.padding-horizontal'
          });
        }
      }

      // Only add individual padding values if they're not part of an equal pair
      for (const [prop, category] of Object.entries(paddingProps)) {
        if (prop in node && node[prop] !== figma.mixed) {
          const value = node[prop];
          if (typeof value === 'number' && value > 0) {
            // Skip if this padding is part of an equal pair
            if ((prop === 'paddingTop' || prop === 'paddingBottom') && hasEqualVertical) continue;
            if ((prop === 'paddingLeft' || prop === 'paddingRight') && hasEqualHorizontal) continue;

            let isBound = false;
            try {
              if (node.boundVariables && node.boundVariables[prop]) {
                isBound = true;
              }
            } catch (e) { /* Ignore */ }
            
            if (!isBound) {
              unassigned.push({
                nodeId: node.id,
                propertyName: prop,
                value: value,
                category: category
              });
            }
          }
        }
      }
    }

    // Handle Font Size
    if ('fontSize' in node && node.type === 'TEXT' && node.fontSize !== figma.mixed) {
      const value = node.fontSize;
      if (typeof value === 'number' && value > 0) {
        // Always treat TEXT nodes with a font size as something that *can* be assigned a style,
        // regardless of whether they currently have a style ID or not.
        // The concept of 'bound' here isn't useful like it is for variables.
        console.log(`[fontSize Detect] Node: ${node.id}, Type: ${node.type}, Size: ${value}, Style ID: ${node.textStyleId}. Adding to list.`);
        unassigned.push({
          nodeId: node.id,
          propertyName: 'fontSize',
          value: value,
          category: 'fontSize'
        });
      }
    }

    // Handle Stroke Weight
    if ('strokeWeight' in node && node.strokeWeight !== figma.mixed &&
        'strokes' in node && Array.isArray(node.strokes) && node.strokes.length > 0) {
      const value = node.strokeWeight;
      if (typeof value === 'number' && value > 0) {
        let isBoundDirectly = false;
        let matchingVariableExists = false;

        // 1. Check Direct Binding (might work for some nodes)
        try {
          if (node.boundVariables?.strokeWeight?.id) {
            isBoundDirectly = true;
          }
        } catch (e) { /* Ignore */ }

        // 2. Fallback: Check for matching variable value if not directly bound
        if (!isBoundDirectly && availableVariables && availableVariables.length > 0) {
            const tolerance = 0.001;
            matchingVariableExists = availableVariables.some(
              variable => Math.abs(variable.value - value) < tolerance
            );
        }

        // Only add if NOT directly bound AND no matching variable value found
        if (!isBoundDirectly && !matchingVariableExists) {
          unassigned.push({
            nodeId: node.id,
            propertyName: 'strokeWeight',
            value: value,
            category: 'strokeWeight'
          });
        }
      }
    }

    // Handle Border Radius
    if ('cornerRadius' in node && node.cornerRadius !== figma.mixed) {
      const value = node.cornerRadius; // We still want the main value if uniform
      if (typeof value === 'number' && value > 0) {
        let isBound = false;
        try {
          // Check main and individual corner bindings
          if (node.boundVariables && (
              node.boundVariables.cornerRadius ||
              node.boundVariables.topLeftRadius ||
              node.boundVariables.topRightRadius ||
              node.boundVariables.bottomLeftRadius ||
              node.boundVariables.bottomRightRadius
             )) {
            isBound = true;
          }
        } catch (e) { /* Ignore */ }
        
        if (!isBound) {
          // Only add if NO corner property is bound
          unassigned.push({ 
            nodeId: node.id, 
            propertyName: 'cornerRadius', // Still report as general corners
            value: value, 
            category: 'corners' 
          });
        }
      }
    }

    // Handle Width (only if Fixed)
    if ('width' in node && node.width !== figma.mixed && typeof node.width === 'number' && node.layoutSizingHorizontal === 'FIXED') {
      const value = node.width;
      let isBound = false;
      try {
        if (node.boundVariables?.width?.id) {
          isBound = true;
        }
      } catch (e) { /* Ignore */ }

      if (!isBound) {
        unassigned.push({ nodeId: node.id, propertyName: 'width', value: value, category: 'width' });
      }
    }

    // Handle Height (only if Fixed)
    if ('height' in node && node.height !== figma.mixed && typeof node.height === 'number' && node.layoutSizingVertical === 'FIXED') {
      const value = node.height;
      let isBound = false;
      try {
        if (node.boundVariables?.height?.id) {
          isBound = true;
        }
      } catch (e) { /* Ignore */ }

      if (!isBound) {
        unassigned.push({ nodeId: node.id, propertyName: 'height', value: value, category: 'height' });
      }
    }

    // Recurse through children
    if ('children' in node) {
      for (const child of node.children) {
        findRecursively(child);
      }
    }
  }

  // Start the recursive search
  nodes.forEach(selectedNode => {
    findRecursively(selectedNode);
  });

  // --- LOG BEFORE GROUPING ---
  console.log('[findUnassignedProperties] Finished recursion. Found unassigned items count:', unassigned.length);
  // --- END LOG ---

  // Group by category
  const groupedByCategory = unassigned.reduce((acc, item) => {
    try {
        const categoryKey = item.category;
        // console.log(`[Group Debug] Item: Cat=${categoryKey}, RawVal=${item.value}, Node=${item.nodeId}`);

        if (!acc[categoryKey]) {
          acc[categoryKey] = {};
          // console.log(`[Group Debug] Initialized category: ${categoryKey}`);
        }
        
        // Check if value is a number before processing
        if (typeof item.value !== 'number') {
            console.warn(`[Group Warn] Skipping item with non-numeric value:`, item);
            return acc; // Skip this item
        }

        const roundedValue = Math.round(item.value * 100) / 100; 
        const valueKey = roundedValue.toFixed(2); 
        // console.log(`[Group Debug] -> RoundedVal=${roundedValue}, ValueKey=${valueKey}`);
        
        if (!acc[categoryKey][valueKey]) {
          acc[categoryKey][valueKey] = { value: roundedValue, instances: [] }; 
          // console.log(`[Group Debug]   -> Initialized value key: ${valueKey} in category: ${categoryKey}`);
        } else {
          // console.log(`[Group Debug]   -> Adding instance to existing key: ${valueKey} in category: ${categoryKey}`);
        }
        acc[categoryKey][valueKey].instances.push({
          nodeId: item.nodeId,
          propertyName: item.propertyName
        });
    } catch (error) {
        console.error(`[Group Error] Failed to process item:`, item, 'Error:', error);
    }
    return acc;
  }, {});

  console.log('[Group Debug] Final grouped object count:', Object.keys(groupedByCategory).length);

  // Format for UI
  const formattedForUI = Object.entries(groupedByCategory).map(([category, values]) => ({
    category: category,
    items: Object.values(values).sort((a, b) => a.value - b.value)
  })).sort((a, b) => {
    const order = [
      // Auto Layout
      'al.spacing-vertical',
      'al.spacing-horizontal',
      'al.padding-all',
      'al.padding-vertical',
      'al.padding-horizontal',
      'al.padding-top',
      'al.padding-right',
      'al.padding-bottom',
      'al.padding-left',
      // Appearance
      'corners',
      'strokeWeight',
      // Typography
      'fontSize',
      // Width and Height
      'width',
      'height'
    ];
    return order.indexOf(a.category) - order.indexOf(b.category);
  });

  return formattedForUI;
}

// --- NEW: Function for Match Mode ---
async function findAppliedImportedVariables(nodes) {
  // Final structure: Map<importedVarId, { importedVariable: {...}, localMatches: [...], nodes: [...] }>
  const foundImportedMap = new Map(); 

  // Keep track of nodes per variable instance to avoid duplicates within a single var check
  const nodeVariableTracker = new Map(); // Key: nodeId, Value: Set<importedVarId_property>

  const visitedNodes = new Set();

  async function findRecursively(node) {
    if (!node || visitedNodes.has(node.id)) {
      return;
    }
    visitedNodes.add(node.id);
    console.log(`[Match Mode] Processing Node: ${node.name} (ID: ${node.id})`);

    // --- Get Bound Variables for this node ---
    let boundVarDetails = [];
    try {
      // Use the getBoundVariables method for a more comprehensive list
      boundVarDetails = Object.entries(node.boundVariables || {}).map(([property, binding]) => {
        // Ensure binding is an object and has an id before proceeding
        if (binding && typeof binding === 'object' && binding.id) {
          return { property, variableId: binding.id }; // Need to fetch variable details later
        } 
        return null;
      }).filter(Boolean); // Filter out null entries
    } catch (e) {
      console.warn(`[Match Mode] Error getting boundVariables for ${node.name}:`, e);
    }
    
    console.log(`[Match Mode] Raw bound variables for ${node.name}:`, boundVarDetails);

    // --- Get Text Style ID --- 
    let textStyleId = null;
    if (node.type === 'TEXT' && node.textStyleId && typeof node.textStyleId === 'string') {
      textStyleId = node.textStyleId;
      console.log(`[Match Mode] Text Style ID found for ${node.name}:`, textStyleId);
    }

    // Helper to add node to tracker
    const trackNodeVar = (nodeId, varId, property) => {
        const key = `${varId}_${property}`;
        if (!nodeVariableTracker.has(nodeId)) {
            nodeVariableTracker.set(nodeId, new Set());
        }
        if (nodeVariableTracker.get(nodeId).has(key)) {
            return false; // Already processed this var on this node
        }
        nodeVariableTracker.get(nodeId).add(key);
        return true;
    };

    // Helper to resolve variable value (simplified for now)
    const resolveVarValue = (variable) => {
        // Basic fallback - needs refinement for modes
        // For COLOR, this returns an RGBA object {r, g, b, a}
        return variable?.valuesByMode?.[Object.keys(variable.valuesByMode)[0]] ?? 'N/A'; 
    };

    // --- NEW: Helper to convert Figma RGBA to Hex ---
    const figmaColorToHex = (rgba) => {
        if (!rgba || typeof rgba !== 'object' || rgba === 'N/A') return 'N/A';
        const toHex = (c) => {
            const hex = Math.round(c * 255).toString(16);
            return hex.length === 1 ? "0" + hex : hex;
        };
        // Ignore alpha for simplicity in display
        return `#${toHex(rgba.r)}${toHex(rgba.g)}${toHex(rgba.b)}`.toUpperCase();
    };
    // --- END HELPER ---

    // --- Filter for IMPORTED variables ---
    for (const detail of boundVarDetails) {
        try {
            const variable = await figma.variables.getVariableByIdAsync(detail.variableId);
            if (!variable) {
                console.warn(`[Match Detail] Variable not found for ID: ${detail.variableId}`);
                continue;
            }

            const isLocal = localVariableCollectionIds.has(variable.variableCollectionId);
            const varType = variable.resolvedType;

            // Detailed Log for every bound variable found
            console.log(`[Match Detail] Node: ${node.name}, Prop: ${detail.property}, Var Name: ${variable.name}, Var Type: ${varType}, Var Collection ID: ${variable.variableCollectionId}, Is Local: ${isLocal}`);

            if (variable && !localVariableCollectionIds.has(variable.variableCollectionId)) {
                // Imported Variable Found
                if (!trackNodeVar(node.id, variable.id, detail.property)) continue; // Skip if already processed

                console.log(`[Match Mode] Adding IMPORTED Variable ${variable.name} (Type: ${varType}) for Node: ${node.name}`);
                
                // Use the new resolver function
                const resolvedResult = await getResolvedVariableValue(variable.id);
                const key = variable.id;

                if (!foundImportedMap.has(key)) {
                    foundImportedMap.set(key, {
                        type: 'variable', 
                        variableType: resolvedResult.type, // Use resolved type
                        importedVariable: { 
                            id: variable.id, 
                            name: variable.name, 
                            value: resolvedResult.type === 'COLOR' ? figmaColorToHex(resolvedResult.value) : resolvedResult.value // Use resolved value
                        },
                        nodes: []
                    });
                }
                foundImportedMap.get(key).nodes.push({ nodeId: node.id, property: detail.property });

            } else if (variable) {
                // console.log(`[Match Mode] Detected LOCAL Variable ${variable.name} on ${node.name}`);
            }
        } catch(e) {
            console.warn(`[Match Mode] Error fetching variable details for ID ${detail.variableId}:`, e);
        }
    }

    // --- Filter for IMPORTED Text Styles ---
    if (textStyleId) {
        const isLocal = localTextStyleIds.has(textStyleId);
        // Detailed Log for text style
        console.log(`[Match Detail] Node: ${node.name}, Style ID: ${textStyleId}, Is Local: ${isLocal}`);

        if (!localTextStyleIds.has(textStyleId)) {
            // Imported Style Found
            if (!trackNodeVar(node.id, textStyleId, 'textStyleId')) { /* Skip if already processed */ } else {
                console.log(`[Match Mode] Adding IMPORTED Text Style ${textStyleId} for Node: ${node.name}.`);
                const key = textStyleId;
                
                // Need to fetch style name
                let styleName = 'Imported Style'; 
                try {
                    const style = await figma.getStyleByIdAsync(textStyleId);
                    if (style) styleName = style.name;
                } catch(e) { console.warn("Could not fetch style name for", textStyleId); }

                if (!foundImportedMap.has(key)) {
                    foundImportedMap.set(key, {
                        type: 'textStyle',
                        importedVariable: { // Use similar structure for consistency
                            id: textStyleId,
                            name: styleName,
                            value: null // Styles don't have a single value like vars
                        },
                        nodes: []
                    });
                }
                foundImportedMap.get(key).nodes.push({ nodeId: node.id, property: 'textStyleId' });
            }
        } else {
            // console.log(`[Match Mode] Detected LOCAL Text Style ${textStyleId} on ${node.name}.`);
        }
    }

    // Recurse through children
    if ('children' in node) {
      for (const child of node.children) {
        await findRecursively(child); // Use await if making async calls inside
      }
    }
  }

  // Clear the value cache before starting a new scan for this mode
  resolvedValueCache.clear(); 
  
  // Start the recursive search for each selected node
  for (const selectedNode of nodes) {
    await findRecursively(selectedNode);
  }

  // Convert map to array for UI
  const formattedForUI = Array.from(foundImportedMap.values()); 

  console.log('[Match Mode] Final formatted list:', formattedForUI);
  return formattedForUI; // Return the structured data
}
// --- END: Function for Match Mode ---

async function getFloatVariables() {
  let allVars = [];
  try {
      allVars = await figma.variables.getLocalVariablesAsync();
  } catch (e) {
      console.error("Error fetching local variables:", e);
      figma.notify("Error fetching variables. See console.", { error: true });
      return [];
  }
  
  const floatVars = allVars.filter(v => v.resolvedType === 'FLOAT');
  if (floatVars.length === 0) return [];

  // Clear the value cache before starting a new fetch
  resolvedValueCache.clear();
  const resolvedVarsPromises = floatVars.map(async v => {
    const resolvedResult = await getResolvedVariableValue(v.id);
    // Only return if resolution was successful and type is FLOAT
    if (resolvedResult.type === 'FLOAT') {
      return {
        id: v.id,
        name: v.name,
        value: resolvedResult.value // Use the final resolved primitive value
      };
    } else {
      console.warn(`[getFloatVariables] Could not resolve variable ${v.name} (ID: ${v.id}) to a FLOAT value. Resolved:`, resolvedResult);
      return null; // Exclude unresolved or non-float vars
    }
  });

  const resolvedVars = (await Promise.all(resolvedVarsPromises)).filter(Boolean); // Wait for all promises and filter out nulls

  // --- Sort variables alphabetically by name ---
  resolvedVars.sort((a, b) => a.name.localeCompare(b.name));
  // --- End sorting ---

  return resolvedVars;
}

// --- NEW FUNCTION: Get Color Variables ---
async function getColorVariables() {
  let allVars = [];
  try {
      allVars = await figma.variables.getLocalVariablesAsync();
  } catch (e) {
      console.error("Error fetching local variables for color:", e);
      // Don't notify for every type, just log error
      return [];
  }
  
  // Filter for COLOR variables
  const colorVars = allVars.filter(v => v.resolvedType === 'COLOR');
  if (colorVars.length === 0) return [];

  // We just need ID and name for the dropdown
  const formattedVars = colorVars.map(v => ({ id: v.id, name: v.name }));

  // Sort alphabetically
  formattedVars.sort((a, b) => a.name.localeCompare(b.name));
  return formattedVars;
}
// --- END NEW FUNCTION ---

// --- NEW FUNCTION: Get Text Styles ---
async function getTextStyles() {
    let styles = [];
    try {
        styles = await figma.getLocalTextStylesAsync();
        console.log(`[getTextStyles] Fetched ${styles.length} local text styles from Figma.`); 
    } catch (e) {
        console.error("Error fetching local text styles:", e);
        figma.notify("Error fetching text styles. See console.", { error: true });
        return [];
    }
    // Format for consistency with variables, INCLUDING FONT SIZE AND FONT NAME
    const formattedStyles = styles.map(style => ({ 
        id: style.id.replace(/,$/, '').trim(),
        name: style.name,
        fontSize: style.fontSize === figma.mixed ? null : style.fontSize,
        fontName: style.fontName === figma.mixed ? null : style.fontName 
    })).sort((a, b) => a.name.localeCompare(b.name)); 
    
    console.log('[getTextStyles] Formatted styles being returned (normalized IDs):', JSON.stringify(formattedStyles, null, 2));

    return formattedStyles; 
}
// --- END NEW FUNCTION ---

// --- NEW HELPERS for Identifying Local Collections/Styles ---
let localVariableCollectionIds = new Set();
let localTextStyleIds = new Set();

async function cacheLocalIds() {
  try {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    localVariableCollectionIds = new Set(collections.map(col => col.id));
    console.log('[Cache] Local Variable Collection IDs:', localVariableCollectionIds);
  } catch (e) {
    console.error("Error fetching local variable collections:", e);
    localVariableCollectionIds = new Set(); // Reset on error
  }

  try {
    const styles = await figma.getLocalTextStylesAsync();
    localTextStyleIds = new Set(styles.map(style => style.id));
    console.log('[Cache] Local Text Style IDs:', localTextStyleIds);
  } catch (e) {
    console.error("Error fetching local text styles:", e);
    localTextStyleIds = new Set(); // Reset on error
  }
}
// --- END NEW HELPERS ---

async function updateUI() {
  const selection = figma.currentPage.selection;
  if (!selection || selection.length === 0) {
    // Only clear if there's no selection at all
    figma.ui.postMessage({ 
      type: 'selection-data', 
      unassignedValues: [], 
      floatVariables: [], 
      textStyles: [],
      shouldClear: true // New flag to indicate full clear
    });
    return;
  }
  try {
    // Clear the value cache before starting a new fetch
    resolvedValueCache.clear();
    // Get variables first
    const floatVariables = await getFloatVariables();
    const textStyles = await getTextStyles(); // Get text styles

    // Pass variables AND textStyles to findUnassignedProperties
    const unassigned = findUnassignedProperties(selection, floatVariables, textStyles);

    // Post all data to UI
    figma.ui.postMessage({
      type: 'selection-data',
      unassignedValues: unassigned,
      floatVariables: floatVariables, // Send the list for the dropdown
      textStyles: textStyles, // Send text styles for the dropdown
      shouldClear: false
    });
  } catch (error) {
    console.error("Error during UI update process:", error);
    figma.notify("Error updating data. See console.", { error: true });
    figma.ui.postMessage({ 
      type: 'selection-data', 
      unassignedValues: [], 
      floatVariables: [], 
      textStyles: [],
      shouldClear: true
    });
  }
}

// --- State for highlight tracking ---
let selectionSetByPlugin = false; // Flag to track if selection was changed by hover
let originalSelection = null; // Store original selection before hover
// --- End State ---

// --- Event Handlers ---

figma.on('selectionchange', () => {
    // Check the flag
    if (selectionSetByPlugin) {
        // This change was caused by the plugin's highlight hover.
        // Reset the flag and ignore this event.
        selectionSetByPlugin = false;
        console.log('[selectionchange] Event ignored (triggered by plugin hover).');
        return; 
    }

    // Store the new selection as original when it's a manual change
    originalSelection = figma.currentPage.selection;
    // Otherwise, it's a manual selection change.
    console.log('[selectionchange] Manual selection detected. Updating UI.');
    updateUI();
});

figma.ui.onmessage = async (message) => {
    const msg = message.pluginMessage || message;
    if (!msg || typeof msg !== 'object' || !msg.type) {
        console.warn("Invalid or missing message payload.", msg);
        return;
    }

    if (msg.type === 'apply-bulk-mappings') {
        const mappings = msg.mappings;
        if (!mappings || !Array.isArray(mappings) || mappings.length === 0) {
            console.warn("Received apply-bulk-mappings message with invalid or empty mappings.");
            figma.notify("No valid mappings to apply.");
            return;
        }
        
        // Store current selection before applying changes
        // const currentSelection = figma.currentPage.selection; // Maybe not needed if we refresh after
        
        let applyCount = 0;
        let errorCount = 0;
        const nodesToProcess = []; // Array of { nodeId: string, targetStyleId: string }
        const fontsToLoadKeys = new Set(); // Use Set with string keys for unique FontNames
        const fontMap = new Map(); // Map string key back to FontName object

        // --- PASS 1: Prepare data and collect fonts ---
        console.log("[Pass 1] Preparing data and collecting fonts...");
        const localTextStyles = await getTextStyles(); // Fetch styles once for this pass

        for (const mapping of mappings) {
            const { variableId, instances } = mapping;
            if (!variableId || !Array.isArray(instances) || instances.length === 0) continue;

            // --- Handle Text Style Mappings ---
            const isFontSizeMapping = instances[0]?.propertyName === 'fontSize';
            if (isFontSizeMapping) {
                const targetStyle = localTextStyles.find(style => style.id === variableId);
                if (!targetStyle) {
                    console.warn(`[Pass 1] Target style ${variableId} not found for instances:`, instances.map(i=>i.nodeId));
                    errorCount += instances.length;
                    continue;
                }

                // Check and add target font
                if (targetStyle.fontName && typeof targetStyle.fontName === 'object' && targetStyle.fontName.family && targetStyle.fontName.style) {
                    const fontKey = `${targetStyle.fontName.family}|${targetStyle.fontName.style}`;
                    if (!fontsToLoadKeys.has(fontKey)) {
                        fontsToLoadKeys.add(fontKey);
                        fontMap.set(fontKey, targetStyle.fontName); // Store object
                    }
                } else {
                    console.warn(`[Pass 1] Target style ${targetStyle.name} has invalid fontName. Skipping instances:`, instances.map(i=>i.nodeId));
                    errorCount += instances.length;
                    continue; // Skip applying this style if font is invalid
                }

                // Add nodes and their current fonts
                for (const instance of instances) {
                    try {
                        const node = await figma.getNodeByIdAsync(instance.nodeId);
                        if (node && node.type === 'TEXT') {
                            nodesToProcess.push({ nodeId: instance.nodeId, targetStyleId: variableId });

                            // Add node's current font(s)
                            const nodeFonts = node.getRangeAllFontNames(0, node.characters.length);
                            for (const fn of nodeFonts) {
                                if (fn && typeof fn === 'object' && fn.family && fn.style) {
                                    const fontKey = `${fn.family}|${fn.style}`;
                                    if (!fontsToLoadKeys.has(fontKey)) {
                                        fontsToLoadKeys.add(fontKey);
                                        fontMap.set(fontKey, fn);
                                    }
                                }
                            }
                        } else {
                             console.warn(`[Pass 1] Node ${instance.nodeId} not found or not TEXT.`);
                            errorCount++;
                        }
                    } catch (e) {
                        console.error(`[Pass 1] Error processing node ${instance.nodeId}:`, e);
                        errorCount++;
                    }
                }
            } else {
                // --- Handle Non-Text-Style Mappings (Original Logic) ---
                let variable; 
                try {
                    variable = await figma.variables.getVariableByIdAsync(variableId);
                    if (!variable) throw new Error("Variable not found");
                } catch (e) {
                    console.error(`Error fetching variable ${variableId}:`, e);
                    errorCount += instances.length;
                    continue;
                }

                for (const instance of instances) {
                     let node;
                     try {
                        node = await figma.getNodeByIdAsync(instance.nodeId);
                        if (!node) {
                             console.error(`[Apply Var] Node not found: ${instance.nodeId}`);
                             errorCount++;
                             continue;
                        }
                        const prop = instance.propertyName;
                        console.log(`[Apply Var] Applying var ${variable.name} to prop ${prop} on node ${node.name}`);
                        // Apply non-text variable logic (simplified example)
                        if (typeof node.setBoundVariable === 'function') {
                            // Check if property exists before binding
                            if (prop in node.boundVariables || prop in node) { 
                                node.setBoundVariable(prop, variable);
                                applyCount++;
                            } else {
                                console.warn(`[Apply Var] Property ${prop} not found or bindable on node ${node.name} (${node.type}).`);
                                errorCount++;
                            }
                        } else {
                             console.warn(`[Apply Var] Node ${node.name} does not support setBoundVariable for ${prop}`);
                            errorCount++;
                        }
                     } catch (e) {
                         console.error(`[Apply Var] Error processing instance ${instance.nodeId}:`, e);
                         errorCount++;
                     }
                 }
            }
        }
        console.log(`[Pass 1] Preparation complete. Nodes for text style update: ${nodesToProcess.length}. Unique fonts to load: ${fontsToLoadKeys.size}. Non-text errors: ${errorCount}.`);

        // --- PASS 2: Load all collected fonts ---
        if (fontsToLoadKeys.size > 0) {
            console.log(`[Pass 2] Loading ${fontsToLoadKeys.size} fonts...`);
            const fontPromises = [];
            for (const fontKey of fontsToLoadKeys) {
                const fontName = fontMap.get(fontKey);
                if (fontName) { // Ensure font object exists
                    fontPromises.push(
                        figma.loadFontAsync(fontName)
                            .then(() => console.log(`[Pass 2] Font loaded: ${fontName.family} ${fontName.style}`))
                            .catch(e => {
                                console.warn(`[Pass 2] Failed to load font: ${fontName.family} ${fontName.style}`, e);
                                // We proceed even if some fonts fail, application might still work for others
                            })
                    );
                }
            }
            await Promise.all(fontPromises);
            console.log("[Pass 2] Font loading phase complete.");
        } else {
            console.log("[Pass 2] No unique fonts needed for text styles.");
        }


        // --- PASS 3: Apply text styles --- 
        console.log(`[Pass 3] Applying text styles to ${nodesToProcess.length} nodes...`);
        for (const { nodeId, targetStyleId } of nodesToProcess) {
             try {
                  const node = await figma.getNodeByIdAsync(nodeId);
                  if (!node || node.type !== 'TEXT') {
                      console.warn(`[Pass 3] Skipping node ${nodeId} as it's no longer valid or not TEXT.`);
                      continue; 
                  }

                  // Simplified async function for applying style
                  const applyStyleAsyncMinimal = async (targetNode, styleId) => {
                       try {
                            const currentNodeStyleId = targetNode.textStyleId;
                            console.log(`[Pass 3 Apply] Node ${targetNode.id}: Current ID = '${currentNodeStyleId}', Target ID = '${styleId}'`);

                            // --- Check if style is already applied --- 
                            if (currentNodeStyleId === styleId) {
                                console.log(`[Pass 3 Apply] Style ${styleId} already applied to node ${targetNode.id}. Skipping API call.`);
                                return true; // Already correct, count as success
                            }
                            // --- End check ---

                            await targetNode.setRangeTextStyleIdAsync(0, targetNode.characters.length, styleId);
                            const idAfterApply = targetNode.textStyleId;
                            console.log(`[Pass 3 Apply] API call finished for node ${targetNode.id}. ID after: '${idAfterApply}'`);
                            if (idAfterApply === styleId) {
                                console.log(`[Pass 3 Verify] SUCCESS for node ${targetNode.id}`);
                                return true;
                            } else {
                                 console.warn(`[Pass 3 Verify] FAILED for node ${targetNode.id}. Expected ${styleId}, got ${idAfterApply}`);
                                 return false;
                            }
                       } catch (e) {
                            console.error(`[Pass 3 Apply] Error setting style ${styleId} on node ${targetNode.id}`, e);
                            return false;
                       }
                  };

                  const success = await applyStyleAsyncMinimal(node, targetStyleId);
                  if (success) {
                       applyCount++;
                  } else {
                       errorCount++;
                  }

             } catch (e) {
                  console.error(`[Pass 3] Error retrieving node ${nodeId} for style application:`, e);
                  errorCount++; // Count error if node retrieval fails
             }
        }
        console.log("[Pass 3] Text style application phase complete.");

        // --- Final Notification ---
        if (applyCount > 0 && errorCount === 0) {
            figma.notify(`Applied ${applyCount} properties successfully.`);
        } else if (applyCount > 0 && errorCount > 0) {
            figma.notify(`Applied ${applyCount} properties, but ${errorCount} errors occurred. Check console.`, { error: true, timeout: 5000 });
        } else if (errorCount > 0) {
            figma.notify(`Failed to apply properties. ${errorCount} errors occurred. Check console.`, { error: true, timeout: 5000 });
        } else {
            figma.notify("No properties were mapped or applied.");
        }
        
        // Optionally refresh UI after applying
        // updateUI(); 

    } else if (msg.type === 'highlight-nodes') {
        const nodeIds = msg.nodeIds;
        if (nodeIds && Array.isArray(nodeIds) && nodeIds.length > 0) {
            if (!originalSelection) {
                originalSelection = figma.currentPage.selection;
            }

            const nodesToSelect = [];
            for (const id of nodeIds) {
                const node = await figma.getNodeByIdAsync(id);
                if (node) nodesToSelect.push(node);
            }
            if (nodesToSelect.length > 0) {
                selectionSetByPlugin = true;
                figma.currentPage.selection = nodesToSelect;
            }
        }
    } else if (msg.type === 'clear-highlight') {
        if (originalSelection) {
            selectionSetByPlugin = true;
            figma.currentPage.selection = originalSelection;
        }
    } else if (msg.type === 'refresh-rogue-data') { 
        console.log('[Message] Refreshing rogue data...');
        updateUI(); // Call the existing update function
    } else if (msg.type === 'scan-for-matches') { 
        console.log('[Message] Scanning selection for imported variables/styles...');
        const selection = figma.currentPage.selection;
        if (!selection || selection.length === 0) {
            // Send empty data back to UI if nothing selected
            figma.ui.postMessage({ type: 'match-data', matchedItems: [] });
            return;
        }
        // Call the function to find imported items
        const matchedItems = await findAppliedImportedVariables(selection);
        
        // Also fetch local variables/styles to send to UI for dropdowns
        const floatVariables = await getFloatVariables();
        const textStyles = await getTextStyles();
        const colorVariables = await getColorVariables();
        // TODO: Fetch local color/string vars
        
        // Send the results back to the UI 
        figma.ui.postMessage({ 
            type: 'match-data', 
            matchedItems: matchedItems, 
            floatVariables: floatVariables, // Send local vars for dropdown
            textStyles: textStyles, // Send local styles for dropdown
            colorVariables: colorVariables // Send local color vars for dropdown
        });
        
    } else if (msg.type === 'apply-variable-swaps') {
        const swaps = msg.swaps;
        if (!swaps || !Array.isArray(swaps) || swaps.length === 0) {
            console.warn("Received apply-variable-swaps with invalid data.");
            figma.notify("No valid swaps to apply.");
            return;
        }
        
        let applyCount = 0;
        let errorCount = 0;

        for (const swap of swaps) {
            const { localId, isTextStyle, nodesToUpdate } = swap;
            if (!localId || !Array.isArray(nodesToUpdate) || nodesToUpdate.length === 0) {
                console.warn("Skipping invalid swap item:", swap);
                errorCount += nodesToUpdate?.length || 1;
                continue;
            }

            let localVariable; // For float/color/string vars
            let localVariableAlias; // For float/color/string vars
            let localTextStyle; // For text styles

            try {
                if (isTextStyle) {
                    localTextStyle = { id: localId }; // Only need ID
                } else {
                    localVariable = await figma.variables.getVariableByIdAsync(localId);
                    if (!localVariable) throw new Error(`Local variable not found for ID: ${localId}`);
                    localVariableAlias = figma.variables.createVariableAlias(localVariable);
                }
            } catch (e) {
                console.error(`Error fetching local variable/style or creating alias for ID ${localId}:`, e);
                errorCount += nodesToUpdate.length;
                continue;
            }

            for (const nodeInfo of nodesToUpdate) {
                let node;
                try {
                    node = await figma.getNodeByIdAsync(nodeInfo.nodeId);
                    if (!node) throw new Error("Node not found.");
                    
                    const prop = nodeInfo.property; // e.g., 'paddingTop', 'textStyleId', 'fills'
                    
                    if (isTextStyle) {
                        // Apply Text Style
                        if (node.type === 'TEXT' && prop === 'textStyleId') {
                             if (node.type === 'TEXT') {
                                 try {
                                     const fontsInNode = node.getRangeAllFontNames(0, node.characters.length);
                                     for (const fn of fontsInNode) {
                                         await figma.loadFontAsync(fn);
                                     }
                                 } catch (fontErr) {
                                     console.warn(`Could not load existing fonts for node ${node.id}:`, fontErr);
                                 }

                                 console.log(`[Swap Style Debug] BEFORE swap, node ${node.id} textStyleId: ${node.textStyleId}`);
                                 // Apply the style using the async range API.
                                 await node.setRangeTextStyleIdAsync(0, node.characters.length, localTextStyle.id);
                                 console.log(`[Swap Style Debug] AFTER swap, node ${node.id} textStyleId: ${node.textStyleId}`);
                             } else {
                                 await node.setRangeTextStyleIdAsync(0, node.characters.length, localTextStyle.id);
                             }
                        } else {
                             console.warn(`Cannot apply text style to non-TEXT node or wrong property: ${node.name}, prop: ${prop}`);
                             errorCount++;
                        }
                    } else {
                        // Handle float/color/string variables
                        if (typeof node.setBoundVariable === 'function') {
                            // Use setBoundVariable when available (preferred)
                            node.setBoundVariable(prop, localVariable); 
                            applyCount++;
                        } else {
                            // Fallback attempt (might not work for all properties)
                            console.warn(`Node ${node.name} may not fully support setBoundVariable for ${prop}. Attempting direct assignment.`);
                            // Avoid direct assignment for complex properties like fills/strokes
                            if (prop !== 'fills' && prop !== 'strokes') { 
                                try {
                                    node[prop] = localVariableAlias;
                                    applyCount++;
                                } catch (assignError) {
                                    console.error(`Direct assignment failed for ${prop} on ${node.name}:`, assignError);
                                    errorCount++;
                                }
                            } else {
                                 console.warn(`Skipping direct assignment for complex property ${prop} on ${node.name}`);
                                errorCount++;
                            }
                        }
                    }
                } catch (e) {
                    console.error(`Error processing node swap: ${node?.name || nodeInfo.nodeId}`, e);
                    errorCount++;
                }
            }
        }
        
        // --- Notification Logic (similar to bulk apply) ---
        if (applyCount > 0) {
            figma.notify(`Swapped variables/styles for ${applyCount} properties.` + (errorCount > 0 ? ` Failed for ${errorCount}.` : ''));
        } else if (errorCount > 0) {
            figma.notify(`Failed to swap variables/styles for ${errorCount} properties.`, { error: true });
        } else {
            figma.notify("No variables/styles were swapped.");
        }
        // No need to re-scan automatically after swap
        
    } else if (msg.type === 'llm-suggest-match') {
        const { importedItem, localItems } = msg;
        console.log('[Message] Received llm-suggest-match', importedItem, localItems);

        const apiKey = await getOpenaiApiKey();

        if (!apiKey) {
            console.log("OpenAI API key not found. Requesting from UI.");
            // Ask UI to request the key
            figma.ui.postMessage({ 
                type: 'request-api-key', 
                importedId: importedItem.id // Send back importedId so UI knows which button triggered this
            }); 
            return;
        }

        // Format local items for the prompt
        const localItemsListString = localItems.map(item => {
            // Handle potential missing values, especially for text styles
            const valueStr = item.value === null || item.value === undefined ? 'N/A' : 
                             (importedItem.type === 'COLOR' ? item.value : // Assume color value is pre-formatted if needed
                             (importedItem.type === 'FLOAT' ? Number(item.value).toFixed(2) : item.value)); // Format float
            return `- Local Name: "${item.name}", Local ID: "${item.id}", Local Value: "${valueStr}"`;
        }).join('\n');

        // Format imported value
        const importedValueStr = importedItem.value === null || importedItem.value === undefined ? 'N/A' : 
                                 (importedItem.type === 'COLOR' ? String(importedItem.value) : // Use the value directly
                                 (importedItem.type === 'FLOAT' ? Number(importedItem.value).toFixed(2) : String(importedItem.value)));

        // Construct the prompt
        const prompt = `You are an expert design system assistant helping to match imported Figma styles/variables to local ones based on their details.

Find the single best local match for the following imported item:
- Imported Name: "${importedItem.name}"
- Imported Type: "${importedItem.type}"
- Imported Value: "${importedValueStr}"

From this list of local items (all of type ${importedItem.type}):
${localItemsListString}

Consider name similarity (e.g., ignoring paths like "Group/", matching core names), type compatibility (already filtered, but good context), and value closeness for numerical types (FLOAT).

Respond ONLY with the ID of the best matching local item from the list provided. Do not include any other text, explanation, or formatting. If no suitable match is found, respond with "NO_MATCH".

Best Matching Local ID:`;

        try {
            const suggestion = await callOpenaiApi(apiKey, prompt);
            // Send result back to UI
            figma.ui.postMessage({
                type: 'llm-suggestion-result',
                importedId: importedItem.id,
                suggestedLocalId: suggestion // Will be the ID string or "NO_MATCH"
            });
        } catch (error) {
            // Send error back to UI
            figma.ui.postMessage({
                type: 'llm-suggestion-result',
                importedId: importedItem.id,
                error: error.message || "An unknown error occurred calling the LLM API."
            });
        }

    } else if (msg.type === 'llm-suggest-batch') {
         const { items } = msg; 
         console.log('[Message] Received llm-suggest-batch', items);

         const apiKey = await getOpenaiApiKey();
         console.log(`[Debug SuggestBatch] Retrieved key for check: ${apiKey ? apiKey.substring(0,7) + '...' : 'null'}`);

         if (!apiKey) { 
             console.log("OpenAI API key not found in storage. Requesting UI modal.");
             figma.ui.postMessage({ type: 'request-api-key-modal' }); 
             return;
         }

         // Process ALL items individually with appropriate prompt
         try {
             console.log(`[Debug SuggestBatch] Processing ${items.length} items individually...`);
             for (const item of items) { 
                 const { dropdownId, importedItem, localItems } = item; 
                 
                 let suggestion = 'NO_MATCH'; // Default suggestion
                 let skipApiCall = false;

                 // --- NEW: Hybrid logic for TEXT_STYLE ---
                 if (importedItem.type === 'TEXT_STYLE') {
                     const rogueFontSize = Math.round(importedItem.value); 
                     console.log(`[Debug Hybrid] Checking TEXT_STYLE for rogue size: ${rogueFontSize}px`);

                     // Try to find an exact pixel match first using actual fontSize property
                     let exactMatchFound = false;
                     for (const localStyle of localItems) {
                         const localStyleFontSize = localStyle.fontSize; // NEW: Use actual property
                         console.log(`[Debug Hybrid] Comparing with local style: "${localStyle.name}" (Actual size: ${localStyleFontSize})`);
                         if (localStyleFontSize !== null && Math.round(localStyleFontSize) === rogueFontSize) { // Compare rounded values
                             suggestion = localStyle.id.replace(/,$/,'').trim(); 
                             skipApiCall = true;
                             exactMatchFound = true;
                             console.log(`[Debug Hybrid] Found EXACT pixel match: ${rogueFontSize}px -> ${localStyle.name} (ID: ${suggestion})`);
                             break; 
                         }
                     }

                     // If no exact match, prepare for API call (using hierarchy prompt)
                     if (!exactMatchFound) {
                         console.log(`[Debug Hybrid] No exact pixel match found for ${rogueFontSize}px. Preparing API call.`);
                         const localItemsListString = localItems.map(local => {
                             const cleanLocalId = local.id.replace(/,$/,'').trim();
                             // Include actual size in prompt for context, even if hierarchy is primary
                             const sizeInfo = local.fontSize ? `(${Math.round(local.fontSize)}px)` : ''; 
                             return `- Local Name: "${local.name}" ${sizeInfo}, Local ID: "${cleanLocalId}"`; 
                         }).join('\n');
                         const importedValueStr = importedItem.value.toFixed(0); 
                         prompt = `You are an expert design system assistant helping to match an observed Figma font size to a local text style based on hierarchy and naming conventions.\n\nFind the single best local text style match for the following observed font size:\n- Observed Size: ${importedValueStr}px\n(Derived from item named: "${importedItem.name}")\n\nFrom this list of available local text styles (font sizes provided for context only):\n${localItemsListString}\n\nYour task is to select the MOST appropriate local text style ID based primarily on hierarchy and naming convention (e.g., smaller sizes map to styles named 'Small' or 'Body', larger sizes map to 'H1', 'Display', etc.). Use the numeric value mainly for context, not exact matching. Prioritize finding a semantically meaningful match.\n\nRespond ONLY with the ID of the best matching local text style from the list provided. Do not include any other text, explanation, or formatting. If no suitable match is found, respond with "NO_MATCH".\n\nBest Matching Local ID:`;
                     } 
                 } else {
                    // Prepare the standard individual prompt for non-text types
                     const localItemsListString = localItems.map(local => {
                        const cleanLocalId = local.id.replace(/,$/,'').trim(); 
                        const valueStr = local.value === null || local.value === undefined ? 'N/A' : 
                                         (importedItem.type === 'COLOR' ? local.value : 
                                         (importedItem.type === 'FLOAT' ? Number(local.value).toFixed(2) : String(local.value))); 
                        return `- Local Name: "${local.name}", Local ID: "${cleanLocalId}", Local Value: "${valueStr}"`;
                    }).join('\n');
                      const importedValueStr = importedItem.value.toFixed(0); 
                      prompt = `You are an expert design system assistant helping to match imported Figma styles/variables to local ones based on their details.\n\nFind the single best local match for the following imported item:\n- Imported Name: "${importedItem.name}"\n- Imported Type: "${importedItem.type}"\n- Imported Value: "${importedValueStr}"\n\nFrom this list of local items (all of type ${importedItem.type}):\n${localItemsListString}\n\nConsider name similarity (e.g., ignoring paths like "Group/", matching core names), type compatibility (already filtered, but good context), and value closeness for numerical types (FLOAT).\n\nRespond ONLY with the ID of the best matching local item from the list provided. Do not include any other text, explanation, or formatting. If no suitable match is found, respond with "NO_MATCH".\n\nBest Matching Local ID:`;
                 }
                 // --- END Hybrid Logic ---

                 // Make API call ONLY if needed
                 if (!skipApiCall) {
                     console.log(`[Debug SuggestBatch] Calling API for ${importedItem.name}`);
                     try {
                         const rawSuggestion = await callOpenaiApi(apiKey, prompt);
                         // Validation for API response
                         if (rawSuggestion === 'NO_MATCH' || rawSuggestion?.startsWith('VariableID:') || rawSuggestion?.startsWith('S:')) {
                             suggestion = rawSuggestion.replace(/,$/,'').trim(); 
                         } else if (rawSuggestion) { 
                              console.warn(`[Debug API] Unexpected response format: "${rawSuggestion}" for prompt: ${prompt}`);
                         } // suggestion remains 'NO_MATCH' if validation fails
                         
                     } catch (error) {
                         console.error(`[Debug API] Error calling API for ${importedItem.name}:`, error);
                         // Keep suggestion as 'NO_MATCH' on error, send error message to UI
                         figma.ui.postMessage({
                             type: 'llm-suggestion-result',
                             dropdownId: dropdownId, 
                             error: error.message || `Error suggesting match for ${importedItem.name}`
                         });
                         // Continue loop even if one API call fails? Or break? Let's continue for now.
                         // Optionally add a longer delay on error?
                         await new Promise(resolve => setTimeout(resolve, 1000)); 
                         continue; // Skip posting the NO_MATCH suggestion from the error path below
                     }
                 }
                 
                 // Post the determined suggestion (either from exact match or API)
                 figma.ui.postMessage({
                     type: 'llm-suggestion-result',
                     dropdownId: dropdownId, 
                     suggestedLocalId: suggestion 
                 });
                
                 // Add delay if an API call was made, otherwise proceed faster
                 if (!skipApiCall) { 
                    await new Promise(resolve => setTimeout(resolve, 500)); 
                 }
             }
             console.log("[Debug SuggestBatch] Finished processing all items individually.");
             figma.ui.postMessage({ type: 'llm-batch-complete' });

         } catch (error) {
             // Catch errors from the setup/loop logic
             console.error("Error during individual item processing loop:", error);
             figma.ui.postMessage({
                 type: 'llm-batch-complete', 
                 error: error.message || "An error occurred during batch processing."
             });
         }
    } else if (msg.type === 'save-api-key') { 
        const { apiKey } = msg;
        if (apiKey && typeof apiKey === 'string' && apiKey.startsWith('sk-')) {
            await setOpenaiApiKey(apiKey); // Use the setter function
        } else {
            console.warn("Received invalid API key format to save.");
            figma.notify("Invalid API key format. Key not saved.", { error: true });
        }
    } else if (msg.type === 'clear-api-key') { // --- NEW: Handle clearing API key ---
        console.log("Received request to clear OpenAI API key...");
        try {
            await figma.clientStorage.deleteAsync(OPENAI_API_KEY_STORAGE_KEY);
            console.log("Stored OpenAI API key cleared via deleteAsync.");
            figma.notify("API key cleared.");
        } catch(e) {
            console.error("Error clearing API key:", e);
            figma.notify("Error clearing API key.", { error: true });
        }
    } else if (msg.type === 'apply-test-style') {
        const selectedStyleIdFromUI = msg.selectedStyleId; // Keep track of UI selection for logging
        console.log(`[Test Style] Received apply-test-style message. UI selected ID: ${selectedStyleIdFromUI}`);
        const selection = figma.currentPage.selection;
        if (!selection || selection.length === 0) {
            figma.notify("Select a text node first.");
            return;
        }

        const localStyles = await getTextStyles();
        
        // --- Get the FIRST style ID ---
        if (!localStyles || localStyles.length === 0) {
             console.error("[Test Style] No local text styles found at all. Cannot proceed.");
             figma.notify("Error: No local text styles found in the document.", { error: true });
             return;
        }
        const firstStyle = localStyles[0];
        const styleIdToApply = firstStyle.id; // Use the ID of the first style
        const styleNameToApply = firstStyle.name;
        console.log(`[Test Style] OVERRIDING UI SELECTION: Attempting to apply FIRST found style: ${styleNameToApply} (ID: ${styleIdToApply})`);
        // ---

        const testStyleFont = firstStyle.fontName; // Use the font from the first style

        let appliedCount = 0;
        let errorCount = 0;

        for (const node of selection) {
            if (node.type === 'TEXT') {
                try {
                    console.log(`[Test Style] Applying to node ${node.id} (${node.name})`);
                    console.log(`[Test Style] Node Details - Chars: ${node.characters.length}, ID: ${node.textStyleId}, Font: ${JSON.stringify(node.fontName)}, MissingFont: ${node.hasMissingFont}`);

                    // 1) Load fonts (existing and target)
                    let fontsLoaded = false;
                    try {
                         // Load existing fonts...
                         const fontsInNode = node.getRangeAllFontNames(0, node.characters.length);
                         for (const fn of fontsInNode) {
                             if (fn && typeof fn === 'object' && fn.family && fn.style) {
                                await figma.loadFontAsync(fn);
                             } else { console.warn(`[Test Style] Skipping invalid existing font object:`, fn); }
                         }
                         // Load target font (from the FIRST style)...
                         if (testStyleFont && typeof testStyleFont === 'object' && testStyleFont.family && testStyleFont.style) {
                             await figma.loadFontAsync(testStyleFont);
                             console.log(`[Test Style] Loaded target font (from first style): ${testStyleFont.family} ${testStyleFont.style}`);
                             fontsLoaded = true;
                         } else {
                              console.warn(`[Test Style] First style ('${styleNameToApply}') missing valid fontName.`);
                              fontsLoaded = false;
                         }
                    } catch (fontErr) {
                         console.error(`[Test Style] Error during font loading:`, fontErr);
                         fontsLoaded = false;
                    }

                    if (!fontsLoaded) {
                         console.error(`[Test Style] Aborting for node ${node.id} due to font loading issues.`);
                         errorCount++;
                         continue;
                    }
                    
                    // 3) Apply the FIRST Text Style ID Character by Character
                    const idBeforeApply = node.textStyleId; 
                    console.log(`[Test Apply Local Style] BEFORE loop apply, node ${node.id} textStyleId: ${idBeforeApply}`);
                    console.log(`[Test Style] Attempting to apply FIRST style ID (${styleIdToApply}) char-by-char...`);
                    
                    let appliedSuccessfully = true; 
                    let loopIndex = 0; 
                    try {
                        for (; loopIndex < node.characters.length; loopIndex++) {
                            await node.setRangeTextStyleIdAsync(loopIndex, loopIndex + 1, styleIdToApply); // Use the first style ID
                        }
                        console.log(`[Test Style] Finished char-by-char loop.`);
                    } catch (loopError) {
                         console.error(`[Test Style] Error during char-by-char application loop at index ${loopIndex}:`, loopError);
                         appliedSuccessfully = false;
                         errorCount++; 
                         continue; 
                    }

                    // 4) Verify
                    if (appliedSuccessfully) {
                        const idAfterApply = node.textStyleId;
                        console.log(`[Test Apply Local Style] AFTER loop apply, node ${node.id} textStyleId: ${idAfterApply}`);

                        if (idAfterApply === styleIdToApply) { // Compare against the first style ID
                            console.log(`[Test Style] Applied FIRST style successfully (char-by-char) and verified ID on node ${node.id}`);
                            appliedCount++;
                        } else {
                             console.warn(`[Test Style] Char-by-char loop finished but textStyleId did NOT match target for node ${node.id}. Before: ${idBeforeApply}, After: ${idAfterApply}, Target (First Style): ${styleIdToApply}.`);
                             if (errorCount === 0) errorCount++; 
                        }
                    }

                } catch (e) { 
                    console.error(`[Test Style] Error during main application setup process for node ${node.id}:`, e);
                    errorCount++;
                }
            } else {
                 console.log(`[Test Style] Skipping non-text node ${node.id} (${node.name})`);
            }
        } // end for loop

        // --- Adjust Notification Logic --- 
        const notifyStyleName = styleNameToApply || 'first style'; // Use name for notification
        if (appliedCount > 0 && errorCount === 0) {
             figma.notify(`Test applied '${notifyStyleName}' to ${appliedCount} text node(s).`);
        } else if (appliedCount > 0 && errorCount > 0) {
             figma.notify(`Applied '${notifyStyleName}' to ${appliedCount}, but failed for ${errorCount}. Check console.`, { error: true, timeout: 5000 });
        } else if (errorCount > 0) {
            figma.notify(`Failed to apply '${notifyStyleName}' to ${errorCount} node(s). Check console.`, { error: true, timeout: 5000 });
        } else {
            figma.notify("No text nodes selected to apply test style.");
        }
    } else if (msg.type === 'close') {
        figma.closePlugin();
    }
};

// --- OpenAI API Integration --- 

const OPENAI_API_KEY_STORAGE_KEY = 'openaiApiKey'; // Re-add constant

// Re-add function to get the API key from client storage
async function getOpenaiApiKey() { 
    console.log("[Debug GetKey] Attempting to get key from storage key:", OPENAI_API_KEY_STORAGE_KEY);
    try {
        const key = await figma.clientStorage.getAsync(OPENAI_API_KEY_STORAGE_KEY);
        console.log(`[Debug GetKey] Value retrieved from storage: [${typeof key}] ${key ? key.substring(0,7)+'...' : 'null'}`);
        return key;
    } catch (e) {
        console.error("Error getting OpenAI API key from storage:", e);
        return null;
    }
}

// Re-add function to set the API key in client storage
async function setOpenaiApiKey(apiKey) { 
    console.log(`[Debug SetKey] Attempting to save key starting with: ${apiKey?.substring(0, 7)}... to storage key:`, OPENAI_API_KEY_STORAGE_KEY);
    try {
        await figma.clientStorage.setAsync(OPENAI_API_KEY_STORAGE_KEY, apiKey); 
        console.log("[Debug SetKey] setAsync finished successfully.");
        console.log("OpenAI API key stored.");
        figma.notify("OpenAI API key saved.");
    } catch (e) {
        console.error("Error setting OpenAI API key in storage:", e);
        figma.notify("Error saving API key.", { error: true });
    }
}

// Function to call the OpenAI API
async function callOpenaiApi(apiKey, prompt) {
    const API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
    const MODEL_NAME = 'gpt-4.1'; // Use gpt-4.1 based on user screenshot

    console.log(`Calling OpenAI API (${MODEL_NAME})...`); // Include model in log
    console.log("Prompt being sent (as system message):", prompt); 

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}` // OpenAI uses Bearer token
            },
            body: JSON.stringify({
                model: MODEL_NAME,
                messages: [
                    // Using the detailed prompt as a system message for clarity
                    { role: "system", content: prompt }
                    // Could potentially add a user message like "Provide the best match ID." 
                    // but the prompt already requests this directly.
                ],
                 temperature: 0.1, // Low temp for deterministic matching
                 max_tokens: 200, // Increase further for potentially large JSON response
                 // top_p: 1, // Default is usually fine
                 // frequency_penalty: 0, // Default
                 // presence_penalty: 0 // Default
            })
        });

        const data = await response.json(); // Always try to parse JSON first

        if (!response.ok) {
            console.error("OpenAI API Error Response:", data);
            // Try to get a specific error message from OpenAI's structure
            const errorMessage = data?.error?.message || `API request failed with status ${response.status}`;
            throw new Error(errorMessage);
        }

        console.log("OpenAI API Raw Response:", data);

        // Extract the text content from OpenAI's response structure
        let suggestion = data?.choices?.[0]?.message?.content?.trim();
        
        if (!suggestion) {
             console.warn("Could not extract suggestion from OpenAI response.");
             return 'NO_MATCH'; // Treat empty/invalid response as no match
        }
        
        console.log("OpenAI Suggestion Extracted (Raw):", suggestion);
        // Return the raw suggestion string. Caller function will handle parsing/validation.
        return suggestion;

    } catch (error) {
        console.error("Error calling OpenAI API:", error);
        // Check for network errors specifically
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
             throw new Error('Network error: Failed to connect to OpenAI API.');
        }
        throw error; // Re-throw other errors
    }
}

// --- END: OpenAI API Integration ---


// --- Initial Load ---
cacheLocalIds(); // Cache local IDs on startup
updateUI(); // Initial UI update for rogue mode