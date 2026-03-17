/**
 * Tiptap StyledParagraph extension — custom block node with styleKey attribute.
 * Replaces the default Paragraph node in the schema.
 */
import { Node, mergeAttributes } from '@tiptap/core';

export interface StyledParagraphOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    styledParagraph: {
      /** Set the styleKey for the current paragraph */
      setStyleKey: (styleKey: string) => ReturnType;
    };
  }
}

export const StyledParagraph = Node.create<StyledParagraphOptions>({
  name: 'styledParagraph',
  group: 'block',
  content: 'inline*',
  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      styleKey: {
        default: 'textMain',
        parseHTML: (el) => el.getAttribute('data-style-key') || 'textMain',
        renderHTML: (attrs) => ({ 'data-style-key': attrs.styleKey }),
      },
      storyIndex: {
        default: 0,
        parseHTML: (el) => parseInt(el.getAttribute('data-story-index') || '0', 10),
        renderHTML: (attrs) => ({ 'data-story-index': String(attrs.storyIndex) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-style-key]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setStyleKey:
        (styleKey: string) =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, { styleKey });
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      // Enter splits the paragraph — new paragraph inherits 'textMain' for headings
      Enter: ({ editor }) => {
        const { state } = editor;
        const { $from } = state.selection;
        const node = $from.parent;
        if (node.type.name !== this.name) return false;

        const currentStyle = node.attrs.styleKey as string;
        const isHeading = ['display', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(currentStyle);

        // Split the block
        const didSplit = editor.commands.splitBlock();
        if (!didSplit) return false;

        // If we were in a heading, change the new paragraph to body text
        if (isHeading) {
          editor.commands.updateAttributes(this.name, { styleKey: 'textMain' });
        }

        return true;
      },
    };
  },
});
