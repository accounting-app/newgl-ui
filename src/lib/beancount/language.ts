import { parser } from "lezer-beancount";
import { LRLanguage, LanguageSupport, indentNodeProp, foldNodeProp } from "@codemirror/language";

// lezer-beancount ships its own @lezer/highlight tags baked into the
// grammar (confirmed by running highlightTree against it directly -- no
// styleTags() mapping needed here), so wiring it into CodeMirror is just
// LRLanguage.define + a thin LanguageSupport wrapper. No language-server
// features (completion, etc.) are added -- see the plan doc's "Future
// work" for what's deliberately left out of this v1.
const beancountLanguage = LRLanguage.define({
  parser: parser.configure({
    props: [
      // Re-indent to the posting/metadata indent level when continuing a
      // multi-line directive (transaction postings, metadata blocks).
      indentNodeProp.add({
        PostingBlock: (context) => context.column(context.node.from) + context.unit,
        MetadataBlock: (context) => context.column(context.node.from) + context.unit
      }),
      foldNodeProp.add({
        Transaction: (node) => ({ from: node.from, to: node.to })
      })
    ]
  }),
  languageData: {
    commentTokens: { line: ";" }
  }
});

export function beancount(): LanguageSupport {
  return new LanguageSupport(beancountLanguage);
}

export { beancountLanguage };
