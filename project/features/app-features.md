# App features — what the app can do

> By module: what it does · what it uses · limits · package · since. Customer wording, English. Not drafted yet.

<!-- toc -->
**Contents** (9)
- Marketing plans per brand (แผนการตลาด) — since 2026-11-22
- Background job status board (สถานะงานระบบ) — since 2026-11-23
- Tasks on the phone + task notifications (งานของทีม) — since 2026-11-20
- Meeting recordings → tasks (เสียงประชุม → งาน) — since 2026-11-17
- UAT test cases: reference picture per step — since 2026-11-09
- Order plans: brand owners edit their own brand — since 2026-11-11
- Expenses (เบิกค่าใช้จ่าย) — since 2026-11-03
- Home screen quick actions — since 2026-11-05
- Password vault (รหัสบัญชี) — since 2026-11-05
<!-- /toc -->

---

## Marketing plans per brand (แผนการตลาด) — since 2026-11-22
- One plan per brand and period: action plan (tasks), KPI targets vs actual, key dates, post calendar.
- Actual numbers fill in daily: sales and pieces from aoocommerce, posts and followers/reach/views from aoosocial (Instagram: followers only). Admin links each brand to its aoo brand names, marketplace shops and social accounts at /marketing/settings.
- Access: admin + brand owners of that brand.

## Background job status board (สถานะงานระบบ) — since 2026-11-23
- Admin page /settings/system: a light per scheduled job and queue job type (ok · running · late · failing · never) with the last 30 runs.
- Scheduled jobs run in 3 groups (people · web · data); a failed job e-mails the owner via cron-job.org.

## Tasks on the phone + task notifications (งานของทีม) — since 2026-11-20
- Phone list grouped by urgency (overdue on a light red background), tabs ต้องทำ / กำลังทำ / เสร็จแล้ว, tap circle = done. Tapping a task opens a read view: status buttons save instantly, progress as a chat with photo upload; "แก้ไข" opens the full form.
- Quick add on the phone: title + due chips (today / tomorrow / Friday / pick) + who does it.
- Push to phones: assigned to you · someone updated your task (assignees + creator) · task closed · daily 08:30 (due today, follow-up day, appointment, overdue on day 1/3/7 then weekly). Edith (Discord) actions push too.
- Home screen "งานของฉัน" box after check-in: overdue + due today; checking in with such tasks lands on the home screen.
- Uses: Supabase tasks/task_updates, web push, central cron tick. Limit: push reaches only devices that turned notifications on.

## Meeting recordings → tasks (เสียงประชุม → งาน) — since 2026-11-17
- **What it does:** admin pastes a Plaud share link or uploads an audio file (iPhone Voice Memos .m4a, mp3, wav, ogg, webm, ≤ 50 MB) on /tasks/voice. The system transcribes it, drafts tasks (assignee, due date, brand, quote with timestamp) and waits for review: map speakers to staff, edit, accept or reject each draft; accepted drafts become normal tasks linked back to the recording. Runs in the background queue, so the page can be closed.
- **Uses:** Plaud share links · ElevenLabs Scribe (speech-to-text, webhook) · Claude Opus (batch) · private Supabase storage.
- **Limits:** admin only; audio deleted after 90 days (transcript kept); each transcription spends ElevenLabs credits (~1,240 per audio hour; credits left and per-clip usage shown on /tasks/voice, 2026-11-20). iPhone Share-Sheet shortcut "ส่งเข้า amgo" sends a Voice Memo straight in (bot key scope `voice`, 2026-11-19).
- **Package:** internal, not sold.

## UAT test cases: reference picture per step — since 2026-11-09
- Each step of a test case can carry a picture showing where to press. Testers see a small thumbnail beside the step on the board and tap it to enlarge (phone too).
- Pictures are added by developer bots (MCP `uat_upload_image`, bot API, CLI) or kept when a case is edited on the web. PNG, JPEG or WebP, up to 2 MB each.
- **Package:** internal, not sold.

## Order plans: brand owners edit their own brand — since 2026-11-11
- Staff who own a brand in the SRP Calculator (editor) can change carton quantities and see purchase cost on that brand's import order plans; other brands stay hidden. Viewers stay read-only without cost.
- Search in order plans (since 2026-11-17): type words in any order, symbols ignored (® ™ ² ⁵), Thai and English mixed — "tripp natural chair" or "set2 pink" finds the line. Stock shown = sellable stock in the main warehouse only.

## Expenses (เบิกค่าใช้จ่าย) — since 2026-11-03
- **What it does:** staff claim money they paid themselves, or ask the company to pay a supplier directly (bill/invoice attached). Pick the company first, pick the accounting category as icon tiles (auto-suggested from the description), attach up to 10 photos/PDFs. Finance approves once, exports one SCB bulk-transfer file per company, the owner approves the transfer in the SCB app, finance attaches the slip and marks it paid. Staff see each stage on their claim and get a Discord @mention when paid or rejected.
- **For finance:** stage tabs with counts (awaiting approval · awaiting bank file · awaiting transfer · paid this month), filters (search · person · company · category), detail view with large receipt gallery, edit category/details/files before paying, bulk approve, re-download any exported bank file, month-end Excel in the company's EXPENSES REIMBURSEMENT form.
- **Uses:** SCB Business Anywhere upload file (CPX Toolkit format) · Discord webhook · Supabase storage for receipts/slips/files.
- **Limits:** the bank file pays SCB accounts only (other banks are skipped and listed); no withholding tax (handled in aoo); no SMS/email to payees.

## Home screen quick actions — since 2026-11-05
- **What it does:** the first screen gives staff two big cards for what they do most: check in/out (shows whether they are in, since when, or done for the day) and expenses (shows money waiting to come back). Leave and everything else stay in the menu.
- **Limits:** staff who don't need to check in see only the expense card. If not checked in, the first open of the day still goes straight to the check-in page.

## Password vault (รหัสบัญชี) — since 2026-11-05
- **What it does:** one place for shared shop and service logins (user, password, OTP phone, note), locked per account. Admins choose who can view, edit or delete each account, one at a time or across many. People with no access do not see the account exists. Every opening, edit and permission change is logged.
- **What it uses:** paste rows straight from a Google Sheet to import, filter by platform logo, search by platform, brand, email or phone.
- **Limits:** logins are encrypted, so losing the key loses them. Someone with view access can still copy a password; change it when they leave. All admins have full access.
- **Package:** internal, not sold.

