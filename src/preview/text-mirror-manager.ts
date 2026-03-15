// src/preview/text-mirror-manager.ts
// Manages text mirroring across style groups in preview frames

import { FIGMA_NODE_NAMES, ALL_HEADING_DISPLAY_NAMES, ALL_TEXT_DISPLAY_NAMES } from '../core/constants';

/**
 * Determines if a node is a headline or text style based on its name.
 * Works with ALL naming conventions (Default, Tailwind, Bootstrap, Relume, Lumos).
 */
export function getStyleCategory(nodeName: string): 'headline' | 'text' | 'none' {
  const prefix = FIGMA_NODE_NAMES.EXAMPLE_TEXT_PREFIX.toLowerCase();
  const lowerName = nodeName.toLowerCase();

  if (!lowerName.startsWith(prefix)) {
    return 'none';
  }

  const suffix = lowerName.slice(prefix.length).trim();
  if (ALL_HEADING_DISPLAY_NAMES.has(suffix)) return 'headline';
  if (ALL_TEXT_DISPLAY_NAMES.has(suffix)) return 'text';
  return 'none';
}

/**
 * Mirrors text content across all nodes in the same style category
 */
export async function mirrorTextAcrossCategory(
  frame: FrameNode,
  editedNode: TextNode,
  newText: string,
  category: 'headline' | 'text'
): Promise<void> {
  console.log(`[TextMirror] Mirroring "${newText.substring(0, 30)}..." to all ${category} nodes`);
  
  const allTextNodes = frame.findAllWithCriteria({ types: ['TEXT'] }) as TextNode[];
  let mirroredCount = 0;
  
  for (const node of allTextNodes) {
    if (node.id === editedNode.id) continue;
    
    const nodeCategory = getStyleCategory(node.name);
    if (nodeCategory !== category) continue;
    if (node.removed) continue;
    
    try {
      await figma.loadFontAsync(node.fontName as FontName);
      // Auto-resize to prevent text truncation
      node.textAutoResize = "WIDTH_AND_HEIGHT";
      node.characters = newText;
      mirroredCount++;
      console.log(`[TextMirror] Updated: ${node.name}`);
    } catch (error) {
      console.warn(`[TextMirror] Failed to update ${node.name}:`, error);
    }
  }
  
  console.log(`[TextMirror] Mirrored text to ${mirroredCount} ${category} nodes`);
}

/**
 * Extracts the current custom text from a preview frame
 */
export function extractCustomText(frame: FrameNode): { headline: string | null; text: string | null } {
  const allTextNodes = frame.findAllWithCriteria({ types: ['TEXT'] }) as TextNode[];
  
  let headlineText: string | null = null;
  let textContent: string | null = null;
  
  for (const node of allTextNodes) {
    if (node.removed) continue;
    
    const category = getStyleCategory(node.name);
    
    if (category === 'headline' && !headlineText) {
      headlineText = node.characters;
    } else if (category === 'text' && !textContent) {
      textContent = node.characters;
    }
    
    if (headlineText && textContent) break;
  }
  
  return { headline: headlineText, text: textContent };
}
