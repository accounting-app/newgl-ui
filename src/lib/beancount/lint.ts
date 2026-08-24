import { syntaxTree } from "@codemirror/language";
import { linter, type Diagnostic } from "@codemirror/lint";
import type { EditorView } from "@codemirror/view";
import { parser } from "lezer-beancount";

// Syntax-only linting (see BEAN_FILE_EDITOR_PLAN.md "Decisions confirmed
// with the user"): this reports wherever lezer-beancount's parser couldn't
// make sense of the input -- malformed dates, unknown directive keywords,
// malformed amounts/currencies, unclosed strings, mismatched cost/price
// braces, misplaced metadata, etc. -- via Lezer's standard error-node
// mechanism. It does NOT check cross-reference/semantic rules (transaction
// balancing, undeclared accounts, currency constraints); that's real
// bean-check territory, explicitly out of scope for this v1 -- see the
// plan doc's "Future work".
function beancountDiagnostics(view: EditorView): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const tree = syntaxTree(view.state);

  tree.iterate({
    enter: (node) => {
      if (!node.type.isError) return;
      // Lezer error nodes are sometimes zero-width (an expected token was
      // simply missing) -- widen to at least one character so the
      // diagnostic is visible in the gutter/underline instead of
      // collapsing to nothing.
      const from = node.from;
      const to = node.to > node.from ? node.to : Math.min(node.from + 1, view.state.doc.length);
      diagnostics.push({
        from,
        to,
        severity: "error",
        message: "Syntax error -- this doesn't match any valid Beancount directive, posting, or expression here."
      });
    }
  });

  return diagnostics;
}

export const beancountLinter = linter(beancountDiagnostics);

/** Non-CodeMirror entry point -- same underlying parse, for the Save button's error count and the "N issues" status readout. */
export function countBeancountErrors(doc: string): number {
  const tree = parser.parse(doc);
  let count = 0;
  tree.iterate({
    enter: (node) => {
      if (node.type.isError) count += 1;
    }
  });
  return count;
}
