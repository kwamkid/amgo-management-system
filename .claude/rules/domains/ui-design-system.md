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
- `ChoiceTiles` (components/aoo, 3 Nov): pick-one cards with icon/logo (`.aoo-tile`) — use instead of a dropdown when there are few options and a visual helps (company logos, expense category, payout). Selected = brand border + soft fill, text colour unchanged.
- `Lightbox` (components/aoo, 3 Nov, ported from aoosocial): full-screen image/video viewer with arrows/Esc, portal + `Z.lightbox`. Use it for every image preview instead of opening a new tab.
- `MoneyInput` look lives in the component only (3 Nov): default `variant="boxed"` = same frame/font as `Input` (optional `suffix="฿"`, `alignRight`); tables use `variant="cell"` (`.aoo-money-cell`, 32px, right-aligned, `flat` = border on hover only, `error`). `className` = width/spacing only — never colours/borders. It used to be a bare `<input>` styled per page, so forms that forgot got no border.
- Money is shown as `1,234.50 ฿` (`thb()` in components/expenses/expenseVisuals.ts for the expense module).
- `StatusTabs` (components/aoo, 3 Nov, ported from aoocommerce orders page): compact tabs = label + big count (+ hint), soft tone when idle, solid when active, one scrolling row. Use it instead of big `StatCard`s when the cards act as tabs. Keep every tab the same content shape (no extra hint line on some) so heights match; `compact` = one-line pill (label + count badge) for sub-tabs inside a card; `fill` = equal widths across the row (page-level tabs).
- Form controls are 40px with body font by default (4 Nov): `Input`, `MoneyInput`, `SelectMenu` (default `size` now `md`; pass `size="sm"` only in tables/compact toolbars), `DatePicker`, `DateRangePicker`, `TimePicker`. Never mix heights in one row.
- `.aoo-quick-card` (5 Nov): solid tone home-screen action card (`components/dashboard/QuickActions.tsx`) — keep to the two most frequent staff actions (owner); everything else stays in the menu.
- **Dropdowns = `SelectMenu` / `MultiSelectMenu` only, never the native `Select` or `<select>` in new or edited code (owner, 5 Nov; repeated complaint).** The native panel is drawn by the OS and cannot be styled. Picking several = `MultiSelectMenu` (menu stays open, `summary` for the button text). Search appears by itself above 7 options, set once in `SelectMenu` (`searchThreshold`).
- **Type scale lives only in `:root` of globals.css (owner, 5 Nov).** `--fs-caption` 14 labels, hints, table heads · `--fs-body` 16 normal text, buttons, inputs · `--fs-h4` 18 · `--fs-h3` 22 · `--fs-stat` 26 · `--fs-h2` 32 · `--fs-h1` 44. Tailwind `text-xs` = 14, `text-sm`/`text-base` = 16, `text-lg` = 18, all bound to those tokens. Never write px, `text-[..px]` or numeric `fontSize` in a page. Text inputs stay at 16 or iPhone zooms on focus. Printed sheets (`#document-sheet`, `#contract-sheet`, `#certificate-sheet`) keep their own sizes: A4 layout is measured, do not scale them.
- `AvatarStack` (components/shared, 5 Nov): overlapping avatars, +N past `max`. `IconFilter`: round icon-only filter. Neither is exported from shared/index.ts yet.
- Dev server trap: text appended to globals.css may not be served until a further edit of the file.
