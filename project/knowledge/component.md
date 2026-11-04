# 🧩 Shared components

> คอมโพเนนต์กลางที่หน้าอื่นเอาไปใช้ต่อได้ — เพิ่ม/เปลี่ยนพฤติกรรมจดไว้ที่นี่
> Append-only via `/memo`.

<!-- toc -->
**Contents** (5)
- components/aoo
- components/shared
- components/checkin (เพิ่ม 4 ก.ย. 69)
- lib/utils
- PWA / push (components/push · lib/push)
<!-- /toc -->

---

## components/aoo

- **`SelectMenu`** — dropdown กลางของระบบ · `size` md(40px ปริยาย ตั้งแต่ 4 พ.ย. 69 — ฟอร์ม/ตัวกรอง)/sm(32px ตาราง/แถบเครื่องมือเล็ก ต้องส่งเอง) · `variant` boxed(ฟอร์ม)/flat(ตารางหลายสิบช่อง) · `clearable` · `searchThreshold` (ค่าเริ่มต้น 8) · **`onCreate` (เพิ่ม 4 ก.ย. 69) = สร้างตัวเลือกใหม่ได้** พิมพ์แล้วไม่ตรงอันไหน มีแถว "+ เพิ่ม …" ให้กด · ใส่ `onCreate` แล้วช่องค้นหาโผล่เสมอ (ดู learning.md)

- **`ChoiceTiles`** (3 พ.ย. 69) — การ์ดเลือก 1 ตัวมีไอคอน/โลโก้ · `columns`/`mobileColumns` · `stacked` · `scroll` = แถวเดียวเลื่อนซ้ายขวา ไม่มีกรอบ ไอคอนใหญ่
- **`Lightbox`** (3 พ.ย. 69, ยกจาก aoosocial) — ดูรูป/วิดีโอเต็มจอ `media[]` + `index` + `onIndexChange` ลูกศร/Esc · portal + `Z.lightbox`
- **`StatusTabs`** (3 พ.ย. 69, ยกจาก aoocommerce หน้าคำสั่งซื้อ) — แท็บ ป้ายชื่อ + ตัวเลข · `fill` กว้างเท่ากัน · `compact` ชิปบรรทัดเดียว (ชื่อ + จำนวน)
- **`MoneyInput`** (ปรับ 3 พ.ย. 69) — หน้าตาอยู่ในตัวเท่านั้น: `variant` boxed (ปริยาย ฟอร์ม · `suffix="฿"` · `alignRight`) / cell (ตาราง · `flat` · `error`) · className = ความกว้างเท่านั้น
- **expenses** (`components/expenses/`) — `ClaimDetailModal` (ซ้ายรูป ขวาข้อมูล) · `ReceiptGallery` · `ClaimThumb` + `useFirstReceiptUrls` · `ExpenseSectionField` · `ClaimEditModal` · `expenseVisuals.ts` (ไอคอนหมวด + `thb()`)

## components/shared

- **`PersonalReport`** (4 ก.ย. 69 — `components/reports/PersonalReport.tsx`) — รายงานรายคนทั้งช่วง ลงรายวัน · รับ `rows` (ทุกวันของคนนั้น) + `summary` (แถวจากแท็บสรุป) ไม่ query เอง · ใช้ในหน้ารายงานเช็คอิน กดชื่อคนแล้วเด้ง
- **`SwapDayPrompt`** (`components/checkin/SwapDayPrompt.tsx`) — ถามวันหยุดชดเชยทันทีหลังเช็คอินตรงวันหยุด · **ปิดไม่ได้** ต้องตอบเท่านั้น

## components/checkin (เพิ่ม 4 ก.ย. 69)

- **`BurstCamera`** — กล้องหลัง ถ่ายรัวหลายรูปในเซสชันเดียว ย่อรูปให้เอง (`resizeImage`) แล้วส่ง `Blob[]` กลับทาง `onDone` · รับ `uploading` + `progress {done,total}` ไว้โชว์ตัวนับ · **ไม่มี fallback เลือกไฟล์** (ตัดออก 4 ก.ย. ตามคำสั่ง) กล้องบล็อก = บอกให้เปิดสิทธิ์แล้วลองใหม่ · ปิด stream ด้วย ref ตอน unmount (กันบั๊กกล้องล็อกบน Android)
- **`StockPhotoCard`** — การ์ดรูปประจำวัน 2 แถว (หน้าร้าน/สต็อก) ✓/✗ + thumbnail + ถ่ายเพิ่ม/ลบของวันนี้ · โผล่เฉพาะ `userData.requiresStockPhotos` และต้องอยู่ในกิ่ง "เช็คอินอยู่" ของ `CheckInButton`
- **⚠️ `CheckInButton` มี early return ตามสถานะ** — modal/การ์ดที่ต้องโผล่ตอนเช็คอินอยู่ ต้องวางในกิ่ง `if (currentCheckIn)` ไม่ใช่ท้ายไฟล์

## lib/utils

- **`resizeImage(blob, {maxSide=1600, quality=0.82})`** — ย่อรูปบนเครื่องผู้ใช้ก่อนอัปโหลด · รูปที่เล็กอยู่แล้วและเป็น JPEG คืนตัวเดิม ไม่ย่อซ้ำ

## PWA / push (components/push · lib/push)
- `PwaRegister` — ใน root layout · register `/sw.js` + ล้างเลขบนไอคอนทุกครั้งที่กลับมาเห็นหน้าจอ · ไม่ขอสิทธิ์เอง
- `DeviceCard` — หน้าโปรไฟล์ · แถว "ติดตั้งเป็นแอป" (Android มีปุ่มจาก `beforeinstallprompt` · iOS บอกให้กดแชร์ · เปิดจากแอปอยู่ = ✓) + แถว "แจ้งเตือนบนอุปกรณ์นี้" (Toggle aoo + ปุ่มส่งทดสอบ) · iOS ยังไม่ติดตั้ง = บอกให้ติดตั้งก่อน
- `lib/push/client.ts` — `getPushState/enablePush/disablePush/clearAppBadge/isStandalone/isIos` · state: unsupported · ios-needs-install · denied · subscribed · unsubscribed
- `lib/push/notify.ts` — `pushNotify(input)` ฝั่งเบราว์เซอร์ fire-and-forget (`keepalive`) + `toYmd(Date|string)` ไม่ผ่าน toISOString
- `lib/push/events.ts` — กติกาล้วน: `PUSH_EVENTS` · `APPROVER_ROLES` · `recipientsOf` · `buildMessage` · `requiresApprover` · `thaiShort/dateRange` (เทสต์ `scripts/test-push.mjs`)
- `lib/push/send.ts` — server: `sendPushToUsers(ids, payload)` + `userIdsByRole(roles)` · ไม่ throw · ลบ endpoint ตาย
- routes: `/api/push/subscribe` (POST/DELETE) · `/api/push/test` · `/api/push/notify` (event → ข้อความ/ผู้รับ → ส่ง)
- `InstallBanner` — ใน (admin) layout ใต้ Navbar · โผล่เฉพาะมือถือที่ไม่ได้เปิดจากแอป · Android มี prompt = ปุ่ม "ติดตั้ง" · iOS = "ดูวิธี" → /install · ✕ = เงียบ 7 วัน (localStorage) · ไม่ขึ้นบน /install
- `lib/push/installPrompt.ts` — จับ `beforeinstallprompt` ครั้งเดียวที่ root (PwaRegister) แล้วแจกผ่าน `useInstallPrompt()` → `{canPrompt, prompt}` · ทุกปุ่มติดตั้งใช้ตัวนี้ ห้ามฟัง event เอง
- `lib/push/client.ts` เพิ่ม `isAndroid/isMobile/inAppBrowser()` (LINE/Facebook ฝัง = ไม่มีเมนูติดตั้ง ต้องบอกให้เปิดใน Safari/Chrome ก่อน) · `isIos` รู้จัก iPad ที่แกล้งเป็น Mac
- หน้า `/install` — ขั้นตอน iOS/Android (TabBar เลือกให้ตามเครื่อง) · กล่องเตือนถ้าเปิดใน LINE · กล่อง "เปิดจากแอปแล้ว" · ปุ่มคัดลอกลิงก์ให้ HR ส่งต่อ · เมนูผู้ใช้ใน Navbar มี "ติดตั้งแอป"
- ล็อกอินจากแอป: `lib/auth/pwaState.ts` (pure: `newNonce/buildLineState/parseLineState/handoffQuery`) · `lib/auth/pwaHandoff.ts` (client: `startPwaLogin/pendingPwaLogin/clearPwaLogin/offerHandoff/claimHandoff` — nonce ใน localStorage) · `/api/auth/handoff` POST ฝาก / GET หยิบ(ลบ) · หน้า login วนถามเมื่อมี pending + ไม่เปิด TechLoader ในแอป
- หน้าเช็คอิน (4 ก.ย. 69): มือถือต้องอยู่ใน 1 จอ — หัวหน้าแถวเดียว (`sm:hidden`) · แผนที่ `h-52 sm:h-[400px]` · การ์ด `p-4 sm:p-6` · **เช็คอินแล้ว**: StockPhotoCard ขึ้นก่อน (เฉพาะคนถูกตั้งค่า) → การ์ดเช็คเอาท์แถวเดียว (เซลฟี่ · เช็คอิน HH:mm · สถานที่ · ทำงานมา ชม./นาที · กะ | ปุ่มเช็คเอาท์) · ไม่มีแผนที่/วินาที · หมายเหตุซ่อนหลังลิงก์
- StockPhotoCard (4 ก.ย. 69): ปุ่มลบบนรูปโชว์ตลอด (ห้ามใช้ group-hover บนมือถือ) · กดแล้วลบทันทีไม่ถาม · `deleteMyPhotoToday` ลบแถว→ลบไฟล์ (storage policy ให้เจ้าของลบไฟล์โฟลเดอร์วันนี้ได้ — migration 20260904140000)
- หน้า /install (5 ก.ย. 69) ทำใหม่แบบ "ดูรูปแล้วกดตาม": `components/install/GuideIcons.tsx` (Safari · Chrome · LINE · แชร์ iOS · เพิ่มไปหน้าจอโฮม · ⋮ · ⋯ · ลูกศร — วาด SVG เอง) + `GuideMocks.tsx` (หน้าจอจำลอง: แถบล่าง Safari · เมนูแชร์ · ปุ่มเพิ่ม · หน้าจอโฮม · แถบบน/เมนู Chrome · กล่องติดตั้ง Android — วงส้มตรงที่ต้องกด) · ทุกขั้นเป็นการ์ด เลขใหญ่ ตัวหนังสือ 18px · กล่อง "ไม่เห็นเมนู?" ตอบเคส "ไม่มีรายการนี้"
- `SelectMenu` (5 ก.ย. 69) รับ `icon?: ReactNode` ต่อ option — โชว์หน้า label ทั้งในรายการและปุ่ม (ใช้กับโลโก้ธนาคาร) · `lib/constants/banks.ts` = `THAI_BANKS` 15 ธนาคาร (code/nameTh/color/logo) + `getBank(code)` · โลโก้ `public/bank_logo/*.svg` (จาก aoocommerce) · ฟอร์มพนักงาน แท็บเงินเดือน การ์ด "บัญชีรับเงินเดือน" (SelectMenu ธนาคาร + เลขบัญชี font-mono) · ตารางพนักงานโชว์โลโก้+ชื่อไทย
- aoo `Input` (5 ก.ย. 69) รับ `mono` (ฟอนต์ mono สำหรับเลขบัญชี/เบอร์โทร/เลขบัตร) · `UserEditForm` ย้ายทุกช่อง (11) จาก `components/ui/input` (shadcn 42px) มา aoo Input (40px = SelectMenu) — ไอคอนในช่องใช้ `prefix` แทน absolute+pl-10 · เจ้าของทักว่าสูงไม่เท่ากัน
- รูปสต็อก (7 ก.ย. 69): รูปเต็ม 1280px/q0.72 (≈120–180KB) + รูปย่อ 320px/q0.7 (`thumb_path`, ชื่อไฟล์เดียวกันต่อท้าย `_thumb`) · `withUrls` เซ็นทั้งคู่ในคำขอเดียว → `url`/`thumbUrl` · ตาราง/การ์ดใช้ `thumbUrl ?? url` + `loading="lazy"` · รายงานรายวันจัดกลุ่มต่อสาขา (`byLocation`) · cron/ลบ เก็บทั้งสองไฟล์ · `uploadImage` รับ `name` กำหนดชื่อไฟล์ได้
- `StorageStatusCard` (7 ก.ย. 69) บนหน้ารายงานรูปสต็อก — `GET /api/storage/usage` (hr/admin/manager) · แถบ % มีเส้น 85% · admin แก้โควตา (POST) · กติกา `lib/services/storageCapRules.ts` (HIGH 85 / LOW 75 · เทสต์ test-storage-cap) · วัดด้วย SQL function `storage_usage()` (service_role เท่านั้น) ผ่าน `lib/services/storageUsageService.ts`
- รายงานรูปสต็อก (7 ก.ย. 69): lightbox กด ←/→ (ปุ่ม+คีย์บอร์ด) ตามลำดับที่เห็นบนจอ · Esc/คลิกนอกรูปปิด · preload รูปถัดไป · ตัวนับ n/N · ปุ่มเลื่อนวัน h-10 เท่า DatePicker
- `DateRangePicker` (aoo, 7 ก.ย. 69) พอร์ตจาก aoocommerce = ตัวเดียวของทั้งระบบ: `value {since,until}|null` · ทางลัด 6 แบบ · เดสก์ท็อป 2 เดือน / มือถือ 1 เดือน+ชิปทางลัด popup fixed · `clearable={false}` สำหรับรายงานที่ต้องมีช่วงเสมอ · `DateRangeButton` = alias · ลบ `components/ui/date-range-picker` และ `aoo/date-range-button` แล้ว · ห้ามใช้ DatePicker 2 ช่องแทนช่วงวันที่
- ย้ายชุดเก่า→aoo (7 ก.ย. 69): Alert (variant→tone · ไอคอนตัวแรกในกล่องถูกตัด aoo วาดเอง · AlertDescription→div) · Badge→`Pill` (variant→tone ผ่าน `badgeTone()` สำหรับ expression) · Card→aoo Card `padding={0}` + `CardHeader/CardTitle/CardDescription/CardContent/CardFooter` (Tailwind padding ให้ className หน้าเรียกทับได้) · Button (outline→secondary · secondary→soft · destructive→danger · link→ghost · asChild+Link → Link ครอบ Button · class สีถูกตัดทิ้ง) · ลบ `components/ui/{alert,badge,card,input,textarea,checkbox,switch,label,progress,skeleton}` แล้ว
- ย้ายครบทั้งระบบ (7 ก.ย. 69, 8 commit): Select→native `Select` · Pagination→`TableFooter` (+ `onPageSizeChange`) · DropdownMenu→`ActionMenu` · Tabs→`TabBar/TabItem` · Popover→aoo `Popover`/`SelectMenu` · Dialog/AlertDialog→`Modal` (ปุ่มปิดเองหลัง action) · Table→`DataTable` 5 ตาราง · ฟอร์มขอลา: react-hook-form + `Controller` กับ `Field/Select/DatePicker/Textarea/Input/ConfirmDialog` · ลบ `components/ui/` ทั้งโฟลเดอร์
- (7 ก.ย. 69) ถอด `@radix-ui/*` 11 แพ็กเกจออกจาก package.json แล้ว (ไม่มีใคร import) — ถ้าจะใช้ dialog/popover/select ต้องใช้ของ aoo ไม่ติดตั้งกลับ
- (2026-10-28) `ImageDropzone` (aoo) — drag-drop/pick many images, drag-reorder (@dnd-kit), `coverLabel` badge on first, `readOnly`, `size sm|md`, HEIC accept; parent owns upload. Used by task images + timeline. Port of aoosocial MediaDropzone (images only).
- (2026-10-28) `RichTextEditor` / `RichText` (aoo) — B/U/I/bullets/numbers via execCommand, paste as plain text; stored HTML always through `sanitizeRichText` ([lib/utils/richText.ts](/lib/utils/richText.ts), also `richTextToPlain`, `isRichTextEmpty`). Used for task description.
- (2026-10-28) `StepSelect` (aoo) — arrow "funnel" steps, per-option `tone`; task status uses STATUS_TONE (todo warning · doing sky · done success) in components/tasks/taskUi.tsx.
- (2026-10-28) `.aoo-chip` toggle chips (globals.css) — candidate to become a component.
- (2026-10-30) `LanguageSwitcher` + `FlagIcon` (components/shared) — AOO-style round-flag menu, EN/中文/ไทย, flags in `public/flags/*.svg` (copied from aoocommerce). Used by the public label page.
- (2026-10-30) `lib/utils/printPdf.ts` (`printWithPreOpen`, `fetchPdf`, `showPdfPreview`) — AOO bill-print method: desktop hidden iframe → print dialog, mobile pre-opened tab. `lib/utils/bgDownload.ts` — fetch a slow file with a loading toast, saves itself, survives in-app navigation, per-language text. Don't print > ~300 pages via the browser (preview hangs).

