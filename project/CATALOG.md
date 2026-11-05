# project/ — catalog

> Generated with INDEX.md. Every note file and every rule file, for lookup only.

## Rules and shared code (`.claude/rules/`, auto-loaded by `paths:`)
| Rule file | About |
|---|---|
| `agd-workspace.md` | AGD brand work + Hermes bots — run from this repo (owner 2026-10-30) |
| `domains/bot-api.md` | Bot API (/api/bot) — rules |
| `domains/dev-tracker.md` | Dev tracker (UAT · later bugs/releases) — rules (owner, 3 Nov 2569) |
| `domains/expenses.md` | Expenses — reimburse + supplier payments (owner, 3 Nov 2026) |
| `domains/import-do-not-order.md` | Import — models we must never order again (owner rule, 29 Oct 2026) |
| `domains/import.md` | Import module (สั่งของนำเข้า) — 29 Oct 2026 |
| `domains/labels.md` | Thai OCPB (สคบ.) labels — 30 Oct 2026 |
| `domains/ui-design-system.md` | UI design system — conventions (owner, 28 Oct 2026) |
| `queue.md` | งานเบื้องหลังต้องใช้คิวกลาง (เจ้าของสั่ง 8 ต.ค. 69) |
| `seo-rank-rules.md` | กติกาอันดับ + แจ้งเตือน SEO (อ่านก่อนแก้ทุกครั้ง) |

## Files

### (root)/
| File | KB | Sections | About |
|---|---|---|---|
| [uat.md](uat.md) | 1 | 0 | Cases are not kept in this repo: `/uat` and `/memo` use the amgo dev tracker. Case ids go on the topic’s done  |

### bugs/
| File | KB | Sections | About |
|---|---|---|---|
| [bugs.md](bugs/bugs.md) | 1 | 0 | One entry: `## YYYY-MM-DD · area · symptom` + what is known. Fixed → move it to `bugs_fixed.md` with root caus |
| [bugs_fixed.md](bugs/bugs_fixed.md) | 94 | 22 | Traps we keep re-hitting: symptom → root cause → fix → file links, |

### features/
| File | KB | Sections | About |
|---|---|---|---|
| [app-features.md](features/app-features.md) | 2 | 2 | By module: what it does · what it uses · limits · package · since. Customer wording, English. Not drafted yet. |
| [platforms.md](features/platforms.md) | 1 | 2 | One row per outside system, grouped by type, status live / partial / planned / paused / none. Not drafted yet. |

### jobs/
| File | KB | Sections | About |
|---|---|---|---|
| [devplan.md](jobs/devplan.md) | 131 | 52 | คิวงาน + สิ่งที่ทำเสร็จแล้ว · Append-only via `/memo` |
| [followups.md](jobs/followups.md) | 1 | 0 | Never block closing a topic. `/todo` lists the ones due. Format: `- [ ] YYYY-MM-DD · <topic> · <check> → <acti |
| [ideas.md](jobs/ideas.md) | 5 | 4 | Quick thoughts that don't fit devplan / learning / rules / component. |
| [owner-checks.md](jobs/owner-checks.md) | 1 | 1 | Checks only the owner can do (real shop · real money · real device). Never block closing a topic. |
| [todo.md](jobs/todo.md) | 1 | 1 | Starting a topic = move its section to `doing/<topic>.md`. Every report ends with one line: ✅ ปิดจ๊อบได้ · ⏳ ป |

### jobs/doing/
| File | KB | Sections | About |
|---|---|---|---|
| [dev-tracker.md](jobs/doing/dev-tracker.md) | 5 | 2 | - [ ] Replace the private `Lightbox` in components/dev/UatCaseModal.tsx with the shared `Lightbox` from compon |
| [expenses.md](jobs/doing/expenses.md) | 3 | 2 | - [x] Built + pushed 7c50694 bf6d206 (migrations 20261103120000 / 140000 / 160000 run by owner). Rules: .claud |
| [hermes-bots.md](jobs/doing/hermes-bots.md) | 2 | 3 | - [ ] SEO/AEO accuracy: owner says amgo ranks don't match the adayfresh website project — ask what to compare  |

### jobs/done/
| File | KB | Sections | About |
|---|---|---|---|
| [2026-11.md](jobs/done/2026-11.md) | 1 | 2 | Finished topics, newest first. History only. |

### knowledge/
| File | KB | Sections | About |
|---|---|---|---|
| [component.md](knowledge/component.md) | 17 | 5 | คอมโพเนนต์กลางที่หน้าอื่นเอาไปใช้ต่อได้ — เพิ่ม/เปลี่ยนพฤติกรรมจดไว้ที่นี่ |
| [moved-paths.md](knowledge/moved-paths.md) | 1 | 0 | Notes moved to project/ on 2026-11-04. Old mentions in code comments or migrations may still use the old path. |
| [rules-notes.md](knowledge/rules-notes.md) | 44 | 16 | Hard rules Claude MUST follow in this repo — "always X", "never Y". |

### knowledge/learning/
| File | KB | Sections | About |
|---|---|---|---|
| [general.md](knowledge/learning/general.md) | 58 | 28 | สิ่งที่เพิ่งรู้ / pattern ที่น่าจำ · Newest at the bottom · Append-only via `/memo` |
