# BookLeaf support interface

The author dashboard and staff inbox mockups in .impeccable/mocks/redesign were approved together. The brand follows BookLeaf Publishing's public logo, coral, pale blush, and Lato, with deeper raspberry for readable interactive controls.

## Author workspace

A compact overview leads with computed book totals. The main column holds structured book panels with a typographic title placeholder, recorded publication state, sales, pending royalty, details disclosure, and contextual support action. The secondary column holds recent conversations and guided intake topics. Below 900px the columns stack. The summary reflows into two columns below 600px.

## Staff inbox

The desktop workspace uses a 300px queue, flexible conversation, and 300px context pane. The conversation includes author messages, staff replies, private notes, the AI suggestion, and editable composer. Evidence contains suggested triage, staff overrides, policy text, and a checklist of missing facts. Book and Activity tabs share this pane. Below 1280px context opens in a native modal drawer. Below 800px the queue and selected conversation are separate views.

## Shared system

Semantic color and font tokens live at the start of src/app/style.css. Panels use 12px corners, controls 9px, and compact badges 5px. Status is always text-labelled. Metadata uses tabular numerals where appropriate. Focus is immediate and visible, with reduced-motion support. Skeletons preserve content space during loading. Only the supplied logo is image-based. Typographic book placeholders are labelled, and totals come from stored records.

The public source references are Intercom Copilot, Front Copilot, and Amazon KDP's bookshelf/reporting guidance. The portal uses the BookLeaf identity throughout.
