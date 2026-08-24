import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

// Values reference the app's existing --color-* CSS custom properties
// directly in the generated stylesheet (var(...) is a valid CSS color
// wherever a literal is), so this single theme automatically follows
// whichever of the 5 app themes (light/dark/modern/america250/pretty) is
// active -- no per-theme editor theme needed, same trick the Pretty theme's
// gradient tokens already rely on (UI_DESIGN_SYSTEM_PLAN.md-adjacent).
export const beancountEditorTheme = EditorView.theme({
  "&": {
    color: "var(--color-text-primary)",
    backgroundColor: "var(--color-container-background-primary)",
    fontSize: "13px",
    height: "100%"
  },
  ".cm-content": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    caretColor: "var(--color-text-primary)"
  },
  ".cm-gutters": {
    backgroundColor: "var(--color-container-background-accent)",
    color: "var(--color-icon-secondary)",
    border: "none",
    borderRight: "1px solid var(--color-divider-tertiary)"
  },
  ".cm-activeLine": {
    backgroundColor: "var(--color-action-passive-subtle-hover)"
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--color-action-passive-subtle-hover)"
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "var(--color-form-row-background)"
  },
  ".cm-lintRange-error": {
    backgroundImage: "none",
    textDecoration: "underline wavy #dc2626",
    textDecorationSkipInk: "none",
    textUnderlineOffset: "3px"
  },
  ".cm-gutter-lint .cm-gutterElement": {
    color: "#dc2626"
  },
  ".cm-tooltip.cm-tooltip-lint": {
    backgroundColor: "var(--color-container-background-primary)",
    border: "1px solid var(--color-divider-tertiary)",
    color: "var(--color-text-primary)"
  }
});

// lezer-beancount's tags come straight from @lezer/highlight's standard
// set (confirmed by inspecting highlightTree output against the raw
// parser) -- this maps that standard set onto three new --bean-accent-*
// tokens (added per-theme in tailwind-overrides.css) instead of pulling in
// a prebuilt CodeMirror highlight theme package. accent-1 tracks each
// theme's own brand accent (keywords are the most visually prominent
// token); accent-2/3 (strings/numbers) stay a fixed readable green/amber
// pair since they aren't brand-identity colors.
export const beancountHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: "var(--bean-accent-1)", fontWeight: 600 },
  { tag: t.literal, color: "var(--bean-accent-3)" },
  { tag: t.number, color: "var(--bean-accent-3)" },
  { tag: t.string, color: "var(--bean-accent-2)" },
  { tag: t.variableName, color: "var(--color-link-action)" },
  { tag: t.typeName, color: "var(--bean-accent-1)" },
  { tag: t.comment, color: "var(--color-icon-secondary)", fontStyle: "italic" },
  { tag: t.paren, color: "var(--color-icon-secondary)" },
  { tag: t.operator, color: "var(--color-icon-secondary)" },
  { tag: t.invalid, color: "#dc2626", textDecoration: "underline wavy" }
]);

export function beancountTheme() {
  return [beancountEditorTheme, syntaxHighlighting(beancountHighlightStyle)];
}
