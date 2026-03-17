/**
 * Custom ProseMirror NodeView for StyledParagraph.
 * Reads layout data from a shared registry and applies absolute positioning.
 */
import type { Node as PMNode } from '@tiptap/pm/model';
import type { EditorView, NodeView } from '@tiptap/pm/view';
import type { Decoration } from '@tiptap/pm/view';

export interface LayoutEntry {
  globalX: number;
  globalY: number;
  sizePx: number;
  leadingPx: number;
  letterSpacingEm: string;
  heightPx: number;
  fontFamily: string;
  fontWeight: number;
  textW: number;
  isOverflow: boolean;
}

/** Shared layout registry — maps storyIndex to positioning data */
export type LayoutRegistry = Map<number, LayoutEntry>;

export class StyledParagraphView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private node: PMNode;
  private registry: LayoutRegistry;

  constructor(
    node: PMNode,
    _view: EditorView,
    _getPos: (() => number | undefined) | boolean,
    registry: LayoutRegistry,
  ) {
    this.node = node;
    this.registry = registry;

    // Create DOM
    this.dom = document.createElement('div');
    this.dom.dataset.styleKey = node.attrs.styleKey;
    this.dom.dataset.storyIndex = String(node.attrs.storyIndex);

    // Content container — ProseMirror manages text content here
    this.contentDOM = this.dom;

    this.applyLayout();
  }

  /** Read layout from registry and apply styles */
  applyLayout() {
    const storyIndex = this.node.attrs.storyIndex as number;
    const layout = this.registry.get(storyIndex);

    if (layout) {
      const s = this.dom.style;
      s.position = 'absolute';
      s.left = `${layout.globalX}px`;
      s.top = `${layout.globalY}px`;
      s.width = `${layout.textW}px`;
      s.height = `${layout.heightPx}px`;
      s.overflow = 'hidden';
      s.fontSize = `${layout.sizePx}px`;
      s.lineHeight = `${layout.leadingPx}px`;
      s.letterSpacing = layout.letterSpacingEm;
      s.fontFamily = `"${layout.fontFamily}", serif`;
      s.fontWeight = String(layout.fontWeight);
      s.color = '#000';
    } else {
      // No layout data yet (e.g. block not visible) — hide it
      this.dom.style.position = 'absolute';
      this.dom.style.opacity = '0';
      this.dom.style.pointerEvents = 'none';
    }
  }

  update(node: PMNode, _decorations: readonly Decoration[]) {
    if (node.type.name !== 'styledParagraph') return false;
    this.node = node;
    this.dom.dataset.styleKey = node.attrs.styleKey;
    this.dom.dataset.storyIndex = String(node.attrs.storyIndex);
    this.applyLayout();
    return true;
  }

  // Let ProseMirror handle selection and mutations
  ignoreMutation(mutation: MutationRecord | { type: 'selection'; target: Element }) {
    if (mutation.type === 'selection') return false;
    if (mutation.type === 'attributes') {
      // We manage attributes ourselves
      return true;
    }
    return false;
  }
}
