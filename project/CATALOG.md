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
| `domains/marketing.md` | Marketing plans (/marketing) — owner 2026-11-21 |
| `domains/ui-design-system.md` | UI design system — conventions (owner, 28 Oct 2026) |
| `domains/vault.md` | Vault (/vault): shop logins with per-account access (owner, 5 Nov 2569) |
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
| [bugs_fixed.md](bugs/bugs_fixed.md) | 99 | 28 | Traps we keep re-hitting: symptom → root cause → fix → file links, |

### business/
| File | KB | Sections | About |
|---|---|---|---|
| [cost.md](business/cost.md) | 1 | 2 | Infra cost / usage / billing: current state on top (update in place), dated log below. |

### features/
| File | KB | Sections | About |
|---|---|---|---|
| [app-features.md](features/app-features.md) | 7 | 9 | By module: what it does · what it uses · limits · package · since. Customer wording, English. Not drafted yet. |
| [platforms.md](features/platforms.md) | 1 | 2 | One row per outside system, grouped by type, status live / partial / planned / paused / none. Not drafted yet. |

### jobs/
| File | KB | Sections | About |
|---|---|---|---|
| [devplan.md](jobs/devplan.md) | 131 | 52 | คิวงาน + สิ่งที่ทำเสร็จแล้ว · Append-only via `/memo` |
| [followups.md](jobs/followups.md) | 2 | 0 | Never block closing a topic. `/todo` lists the ones due. Format: `- [ ] YYYY-MM-DD · <topic> · <check> → <acti |
| [ideas.md](jobs/ideas.md) | 5 | 4 | Quick thoughts that don't fit devplan / learning / rules / component. |
| [owner-checks.md](jobs/owner-checks.md) | 2 | 1 | Checks only the owner can do (real shop · real money · real device). Never block closing a topic. |
| [todo.md](jobs/todo.md) | 1 | 1 | Starting a topic = move its section to `doing/<topic>.md`. Every report ends with one line: ✅ ปิดจ๊อบได้ · ⏳ ป |

### jobs/doing/
| File | KB | Sections | About |
|---|---|---|---|
| [cron-monitor.md](jobs/doing/cron-monitor.md) | 3 | 2 | Read first: lib/cron/schedule.ts · lib/cron/runner.ts · aoocommerce lib/cron/groups.ts, app/api/cron/[group]/r |
| [dev-tracker.md](jobs/doing/dev-tracker.md) | 6 | 2 | - [ ] Replace the private `Lightbox` in components/dev/UatCaseModal.tsx with the shared `Lightbox` from compon |
| [expenses.md](jobs/doing/expenses.md) | 3 | 2 | - [x] Built + pushed 7c50694 bf6d206 (migrations 20261103120000 / 140000 / 160000 run by owner). Rules: .claud |
| [hermes-bots.md](jobs/doing/hermes-bots.md) | 2 | 3 | - [ ] SEO/AEO accuracy: owner says amgo ranks don't match the adayfresh website project — ask what to compare  |
| [jadore-launch.md](jobs/doing/jadore-launch.md) | 5 | 2 | AGD notes: `01-AGD/02-hape/_notes/jadore.md` (media, clip language check) · `02-hape/_notes/3-marketing/social |
| [marketing-plan.md](jobs/doing/marketing-plan.md) | 6 | 3 | Design: [project/jobs/plans/marketing-plan.md](../plans/marketing-plan.md) |
| [stokke-order.md](jobs/doing/stokke-order.md) | 6 | 2 | - [x] STK #5 draft round built from legacy dump + aoo live and pushed to amgo /import as `STK5-stokke` (16 lin |
| [tasks-edith.md](jobs/doing/tasks-edith.md) | 5 | 1 | Plan: [tasks-edith.md](../plans/tasks-edith.md). This file = open items only. |
| [voice-tasks.md](jobs/doing/voice-tasks.md) | 6 | 1 | Plan: [voice-tasks.md](../plans/voice-tasks.md) (decisions, Plaud API, STT bake-off). This file = open items o |

### jobs/done/
| File | KB | Sections | About |
|---|---|---|---|
| [2026-11.md](jobs/done/2026-11.md) | 4 | 6 | Finished topics, newest first. History only. |

### jobs/plans/
| File | KB | Sections | About |
|---|---|---|---|
| [marketing-plan.md](jobs/plans/marketing-plan.md) | 4 | 5 | Owner asks: simple marketing plan + action plan for our business, per brand, KPI tracker, synced with amgo tas |
| [tasks-edith.md](jobs/plans/tasks-edith.md) | 6 | 7 | Owner wants the task system (/tasks) easy enough that staff actually use it, working together with the Edith D |
| [voice-tasks.md](jobs/plans/voice-tasks.md) | 14 | 14 | Drafted 2026-11-17 from an owner chat (design first, build later in Claude Code). |

### knowledge/
| File | KB | Sections | About |
|---|---|---|---|
| [component.md](knowledge/component.md) | 17 | 5 | คอมโพเนนต์กลางที่หน้าอื่นเอาไปใช้ต่อได้ — เพิ่ม/เปลี่ยนพฤติกรรมจดไว้ที่นี่ |
| [moved-paths.md](knowledge/moved-paths.md) | 1 | 0 | Notes moved to project/ on 2026-11-04. Old mentions in code comments or migrations may still use the old path. |
| [optimized.md](knowledge/optimized.md) | 1 | 0 | One line each, newest on top: what was slow → what changed → commit. team-optimizer greps this before a review |
| [rules-notes.md](knowledge/rules-notes.md) | 44 | 16 | Hard rules Claude MUST follow in this repo — "always X", "never Y". |

### knowledge/learning/
| File | KB | Sections | About |
|---|---|---|---|
| [cross-repo.md](knowledge/learning/cross-repo.md) | 1 | 2 | Traps when an amgo chat touches another repo or its database. |
| [general.md](knowledge/learning/general.md) | 64 | 36 | สิ่งที่เพิ่งรู้ / pattern ที่น่าจำ · Newest at the bottom · Append-only via `/memo` |
| [local-html-pages.md](knowledge/learning/local-html-pages.md) | 1 | 1 | Traps when building standalone .html reports that the owner opens with `open file.html` (not via a server). |
