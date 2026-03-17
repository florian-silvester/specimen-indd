/**
 * Helpers for converting between Zustand store format and Tiptap/ProseMirror document.
 */
import type { JSONContent } from '@tiptap/core';

/** Convert store story blocks to Tiptap JSON document */
export function storyBlocksToDoc(
  blocks: { styleKey: string; text: string }[],
): JSONContent {
  return {
    type: 'doc',
    content: blocks.map((block, index) => ({
      type: 'styledParagraph',
      attrs: {
        styleKey: block.styleKey,
        storyIndex: index,
      },
      content: block.text
        ? [{ type: 'text', text: block.text }]
        : [],
    })),
  };
}

/** Extract story blocks from Tiptap editor document */
export function docToStoryBlocks(
  doc: { content: readonly { attrs?: any; textContent?: string; content?: { forEach: (fn: (node: any) => void) => void } }[] },
): { styleKey: string; text: string }[] {
  const blocks: { styleKey: string; text: string }[] = [];

  doc.content.forEach((node: any) => {
    if (node.type?.name === 'styledParagraph' || node.attrs?.styleKey) {
      let text = '';
      if (node.content) {
        node.content.forEach((child: any) => {
          text += child.text || '';
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

/** Create a plain-text clipboard parser that splits on newlines
 *  and creates StyledParagraph nodes */
export function createClipboardTextParser(schema: any) {
  return (text: string, $context: any) => {
    const paragraphs = text.split(/\n/).filter((line) => line.length > 0);
    const nodes = paragraphs.map((line) =>
      schema.nodes.styledParagraph.create(
        { styleKey: 'textMain', storyIndex: 0 },
        line ? [schema.text(line)] : [],
      ),
    );
    return schema.nodes.doc.create(null, nodes).slice(0);
  };
}
