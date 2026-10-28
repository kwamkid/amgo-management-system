---
paths:
  - "app/**/*.tsx"
  - "components/**"
  - "app/globals.css"
---
# UI design system — conventions (owner, 28 Oct 2026)

- System colour = orange-red `#F03D0E` (`--accent` / `--brand-coral-500` / Tailwind `red-500`). Logo + PWA icons use it too (`scripts/generate-pwa-icons.mjs`).
- Buttons have 3 tiers, styled only in `.aoo-btn--*` (globals.css): **primary** solid (one per screen/modal) · **secondary** white + border (`soft` looks the same) · **ghost** text-only, muted. `danger` = ghost with red text, no border (Delete is never solid). Nothing but primary is solid.
- An item selected on a solid colour keeps its white text on hover — scope text-darkening hovers with `:not([aria-pressed="true"])` (or the selected attr) and only darken bg (`filter: brightness(.95)`).
- No card-in-card / boxed form inside a modal or card — bad on mobile; use dividers.
- In-modal tabs = `Segmented` full width (`.aoo-task-modal__tabs` pattern), not pill `TabItem`. Forward-moving statuses = `StepSelect` with a `tone` per step. A record's title can be the modal header, editable in place.
- Anything used in >1 place must be a shared component/class (components/aoo · components/shared · `.aoo-*`). Shared pieces added 28 Oct: `ImageDropzone`, `RichTextEditor`/`RichText` (+ `lib/utils/richText.ts` sanitizer), `StepSelect`, `.aoo-chip`.
