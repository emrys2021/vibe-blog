import { visit } from 'unist-util-visit';
import type { Root, Blockquote, Paragraph } from 'mdast';

const CALLOUT_RE = /^\[!(\w+)\]([+-]?)[ \t]*([^\n]*)/;

/**
 * Transforms Obsidian-style callouts into styled divs.
 *
 *   > [!info]+ Optional title
 *   > Body content goes here.
 *
 * Becomes:
 *
 *   <div class="callout callout-info" data-callout="info">
 *     <div class="callout-title">Optional title</div>
 *     <p>Body content goes here.</p>
 *   </div>
 *
 * The `+` / `-` fold markers are recognized for compatibility but ignored —
 * blog posts are static, so there is nothing to collapse. Titles render as
 * plain text (no inline markdown); omit the title to fall back to the
 * capitalized type name.
 */
export function remarkCallout() {
  return (tree: Root) => {
    visit(tree, 'blockquote', (node: Blockquote) => {
      const first = node.children[0];
      if (!first || first.type !== 'paragraph') return;
      const firstChild = first.children[0];
      if (!firstChild || firstChild.type !== 'text') return;

      const match = firstChild.value.match(CALLOUT_RE);
      if (!match) return;

      const [whole, rawType, , rawTitle] = match;
      const type = rawType.toLowerCase();
      const title =
        rawTitle.trim() || type.charAt(0).toUpperCase() + type.slice(1);

      // strip the marker and the newline that ended the title line
      const remainder = firstChild.value.slice(whole.length).replace(/^\n/, '');
      if (remainder === '') {
        first.children.shift();
      } else {
        firstChild.value = remainder;
      }
      if (first.children.length === 0) {
        node.children.shift();
      }

      node.data ??= {};
      node.data.hName = 'div';
      node.data.hProperties = {
        className: ['callout', `callout-${type}`],
        'data-callout': type,
      };

      const titleNode: Paragraph = {
        type: 'paragraph',
        data: {
          hName: 'div',
          hProperties: { className: ['callout-title'] },
        },
        children: [{ type: 'text', value: title }],
      };
      node.children.unshift(titleNode);
    });
  };
}
