/**
 * Helpers for converting between Zustand store format and Tiptap/ProseMirror document.
 */
import type { JSONContent } from '@tiptap/core';

/** Convert store story blocks to Tiptap JSON document.
 *  Newlines in text become hardBreak nodes (Shift+Enter). */
export function storyBlocksToDoc(
  blocks: { styleKey: string; text: string }[],
): JSONContent {
  return {
    type: 'doc',
    content: blocks.map((block, index) => {
      // Split text on newlines to create interleaved text + hardBreak nodes
      const parts = block.text.split('\n');
      const content: JSONContent[] = [];
      for (let i = 0; i < parts.length; i++) {
        if (parts[i]) {
          content.push({ type: 'text', text: parts[i] });
        }
        if (i < parts.length - 1) {
          content.push({ type: 'hardBreak' });
        }
      }
      return {
        type: 'styledParagraph',
        attrs: {
          styleKey: block.styleKey,
          storyIndex: index,
        },
        content: content.length > 0 ? content : undefined,
      };
    }),
  };
}

/** Extract story blocks from Tiptap editor document.
 *  hardBreak nodes become newlines in the text. */
export function docToStoryBlocks(
  doc: { content: { forEach: (fn: (node: any) => void) => void } },
): { styleKey: string; text: string }[] {
  const blocks: { styleKey: string; text: string }[] = [];

  doc.content.forEach((node: any) => {
    if (node.type?.name === 'styledParagraph' || node.attrs?.styleKey) {
      let text = '';
      if (node.content) {
        node.content.forEach((child: any) => {
          if (child.type?.name === 'hardBreak') {
            text += '\n';
          } else {
            text += child.text || '';
          }
        });
      }
      blocks.push({
        styleKey: node.attrs?.styleKey || 'textMain',
        text,
      });
    }
  });

  return blocks;
}
