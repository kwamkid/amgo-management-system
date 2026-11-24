# Chrome testing (Claude in Chrome)

> Traps when Claude presses the app in the owner's Chrome.

<!-- toc -->
**Contents** (1)
- 2026-11-24 — dnd-kit boards need a stepped synthetic drag
<!-- /toc -->

---

## 2026-11-24 — dnd-kit boards need a stepped synthetic drag
- `computer left_click_drag` does not trigger dnd-kit (MouseSensor needs moves past `distance: 4`). What works: `javascript_tool` dispatching `mousedown` on the card, ~15 `mousemove` on `document` 30 ms apart, then `mouseup` (used on /dev/bugs and /dev/releases). A real hand-drag still needs a human check.
- Screenshots right after a state change can show the previous frame (board looked unchanged after a status save, DOM was already right). Check the DOM or take a second screenshot before calling it a bug.
