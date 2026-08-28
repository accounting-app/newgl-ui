"use client";

import { useEffect, useRef } from "react";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { indentOnInput, bracketMatching } from "@codemirror/language";
import { lintGutter } from "@codemirror/lint";
import { beancount } from "@/lib/beancount/language";
import { beancountLinter } from "@/lib/beancount/lint";
import { beancountTheme } from "@/lib/beancount/theme";

type BeanEditorProps = {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  /** Pixel floor for the editor's height. Defaults to 480 (the full-page Ledger editor); pass a smaller value for compact contexts like a modal. */
  minHeight?: number;
};

// Ref-based mount/teardown wrapping a CodeMirror 6 EditorView, since
// CodeMirror owns its own DOM subtree and React's virtual-DOM diffing
// should never touch it directly -- the standard pattern for embedding
// CodeMirror (or any non-React editor) inside a React tree.
export function BeanEditor({ value, onChange, readOnly = false, minHeight = 480 }: BeanEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!hostRef.current) return;

    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      history(),
      indentOnInput(),
      bracketMatching(),
      lintGutter(),
      beancount(),
      beancountLinter,
      beancountTheme(),
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      EditorView.lineWrapping,
      EditorState.readOnly.of(readOnly),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current(update.state.doc.toString());
        }
      })
    ];

    const view = new EditorView({
      state: EditorState.create({ doc: value, extensions }),
      parent: hostRef.current
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Intentionally mount once -- `value` here only seeds the initial
    // document. External updates (e.g. loading a different version) are
    // applied via the effect below rather than by remounting the whole
    // editor, which would destroy undo history and cursor position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
  }, [value]);

  return (
    <div
      ref={hostRef}
      className="h-full overflow-auto rounded-lg border border-[var(--color-divider-tertiary)]"
      style={{ minHeight }}
    />
  );
}
