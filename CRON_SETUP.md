# Auto-Checkout Cron Job Setup Guide

ระบบ Auto-Checkout จะทำงานอัตโนมัติทุกวันตอน **23:59** เพื่อเช็คเอาท์พนักงานที่ลืมเช็คเอาท์

---

## 🎯 แนะนำ: GitHub Actions (ฟรี + เชื่อถือได้)

### ขั้นตอนการตั้งค่า

#### 1. Push โค้ดขึ้น GitHub
```bash
git add .
git commit -m "Add auto-checkout cron job"
git push origin main
```

#### 2. ตั้งค่า GitHub Secrets

ไปที่ **GitHub Repository → Settings → Secrets and variables → Actions** แล้วเพิ่ม:

**Secret 1: `CRON_SECRET`**
```
Value: amgo_cron_secret_2025
```

**Secret 2: `VERCEL_DEPLOYMENT_URL`**
```
Value: https://your-app.vercel.app
```
(หรือใช้ production URL ของคุณ)

#### 3. ทดสอบ Workflow

1. ไปที่ **GitHub Repository → Actions**
2. เลือก workflow **"Auto-Checkout Cron Job"**
3. กด **"Run workflow"** → **"Run workflow"**
4. รอสักครู่แล้วดูผลลัพธ์

#### 4. ตรวจสอบการทำงาน

- Cron จะรันทุกวันตอน **23:59 เวลาไทย** (16:59 UTC)
- ดู logs ได้ที่ **Actions tab** ใน GitHub
- ถ้ามี error จะแสดงใน logs

---

## 🔄 ตัวเลือกอื่นๆ

### Option 2: Vercel Cron Jobs

**ข้อกำหนด:** ต้องเป็น **Vercel Pro Plan** ($20/เดือน)

#### ขั้นตอนการตั้งค่า:

1. **อัพเดท `vercel.json`** (ทำแล้ว ✅)
```json
{
  "crons": [
    {
      "path": "/api/cron/auto-checkout",
      "schedule": "59 23 * * *"
    }
  ]
}
```

2. **Deploy ขึ้น Vercel**
```bash
vercel --prod
```

3. **ตั้งค่า Environment Variable**
- ไปที่ **Vercel Dashboard → Settings → Environment Variables**
- เพิ่ม `CRON_SECRET=amgo_cron_secret_2025`

4. **ตรวจสอบการทำงาน**
- ไปที่ **Vercel Dashboard → Crons**
- ดู execution logs

**หมายเหตุ:** Hobby plan จะไม่มี Cron Jobs feature

---

### Option 3: cron-job.org (ฟรี + ไม่ต้องเขียนโค้ด)

1. **สมัครที่** https://cron-job.org
2. **Create New Cronjob**
   - URL: `https://your-app.vercel.app/api/cron/auto-checkout`
   - Schedule: `59 23 * * *` (23:59 ทุกวัน)
   - Method: POST
   - Headers: `Authorization: Bearer amgo_cron_secret_2025`
3. **Save & Enable**

**ข้อดี:**
- ฟรี 100%
- ตั้งค่าง่าย
- มี notification เมื่อ job failed

---

### Option 4: EasyCron (Freemium)

1. **สมัครที่** https://www.easycron.com
2. **Create New Cron Job**
   - URL: `https://your-app.vercel.app/api/cron/auto-checkout`
   - Cron Expression: `59 23 * * *`
   - HTTP Method: POST
   - Custom Headers: `Authorization: Bearer amgo_cron_secret_2025`
3. **Enable Cron**

**ข้อจำกัด Free Plan:**
- 80 executions/เดือน (เพียงพอสำหรับ daily job)

---

## 🧪 ทดสอบ Cron Job

### 1. ทดสอบผ่าน UI (แนะนำ)
```
http://localhost:3000/settings/auto-checkout
```
กดปุ่ม **"รัน Auto-Checkout ทันที"**

### 2. ทดสอบด้วย curl
```bash
# Local (ไม่ต้องใส่ Authorization ใน dev mode)
curl -X POST http://localhost:3000/api/cron/auto-checkout

# Production (ต้องใส่ Authorization)
curl -X POST https://your-app.vercel.app/api/cron/auto-checkout \
  -H "Authorization: Bearer amgo_cron_secret_2025"
```

### 3. ทดสอบผ่าน Postman
- Method: **POST**
- URL: `https://your-app.vercel.app/api/cron/auto-checkout`
- Headers:
  - `Authorization`: `Bearer amgo_cron_secret_2025`

---

## 📊 Monitoring & Logs

### Local Development
ดู logs ใน terminal ที่รัน `npm run dev`

### Production
- **GitHub Actions:** ดูใน Actions tab
- **Vercel:** ดูใน Functions → Logs
- **cron-job.org:** ดูใน Execution History

---

## ⚙️ Cron Expression

```
59 23 * * *
│  │  │ │ │
│  │  │ │ └─ Day of week (0-7, 0 & 7 = Sunday)
│  │  │ └─── Month (1-12)
│  │  └───── Day of month (1-31)
│  └──────── Hour (0-23)
└─────────── Minute (0-59)
```

**ตัวอย่าง:**
- `59 23 * * *` → 23:59 ทุกวัน
- `0 2 * * *` → 02:00 ทุกวัน
- `0 0 * * 0` → 00:00 ทุกวันอาทิตย์

---

## 🔐 Security

1. **เก็บ `CRON_SECRET` ปลอดภัย** - ห้ามใส่ใน code
2. **ใช้ HTTPS** - ป้องกัน man-in-the-middle attack
3. **เปลี่ยน secret เป็นครั้งคราว**
4. **Monitor logs** - ตรวจสอบ unauthorized access

---

## 🐛 Troubleshooting

### Cron ไม่ทำงาน?

1. **ตรวจสอบ timezone**
   - GitHub Actions ใช้ UTC
   - cron-job.org สามารถเลือก timezone ได้

2. **ตรวจสอบ Authorization header**
   ```bash
   # ทดสอบว่า API ทำงานหรือไม่
   curl -X POST http://localhost:3000/api/cron/auto-checkout
   ```

3. **ตรวจสอบ Firestore permissions**
   - ต้องใช้ Firebase Admin SDK
   - ตรวจสอบ `FIREBASE_ADMIN_PRIVATE_KEY`

4. **ดู error logs**
   - Local: ดูใน terminal
   - Production: ดูใน Vercel Functions logs

### API ตอบ 401 Unauthorized?

ใน production mode ต้องใส่ Authorization header:
```bash
-H "Authorization: Bearer YOUR_CRON_SECRET"
```

ใน development mode จะ skip authentication อัตโนมัติ

---

## 📚 Additional Resources

- [GitHub Actions Cron Syntax](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [Crontab Guru](https://crontab.guru/) - ตรวจสอบ cron expression

---

## ✅ Checklist

- [ ] Push code ขึ้น GitHub
- [ ] ตั้งค่า GitHub Secrets (`CRON_SECRET`, `VERCEL_DEPLOYMENT_URL`)
- [ ] ทดสอบ workflow ใน GitHub Actions
- [ ] ตรวจสอบว่ารันสำเร็จ
- [ ] ตั้งค่า monitoring/alerting (optional)
- [ ] บันทึก production URL และ secrets ไว้ปลอดภัย

---

**🎉 เสร็จแล้ว! ระบบ Auto-Checkout จะทำงานอัตโนมัติทุกวันตอน 23:59**
