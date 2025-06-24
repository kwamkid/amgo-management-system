const fs = require("fs");
const path = require("path");

const folders = [
  "app/(auth)/login",
  "app/(auth)/register",
  "app/(dashboard)",
  "app/(dashboard)/checkin",
  "app/(dashboard)/leave",
  "app/(dashboard)/reports",
  "app/(dashboard)/admin",
  "app/api/auth",
  "app/api/checkin",
  "app/api/leave",
  "app/api/export",
  "app/api/discord",
  "app/liff/checkin",
  "components/ui",
  "components/auth",
  "components/checkin",
  "components/leave",
  "components/admin",
  "components/shared",
  "lib/firebase",
  "lib/line",
  "lib/discord",
  "lib/utils",
  "hooks",
  "types",
  "public/images",
];

folders.forEach((folder) => {
  const fullPath = path.join(process.cwd(), folder);
  fs.mkdirSync(fullPath, { recursive: true });
  console.log(`Created: ${folder}`);
});

console.log("✅ All folders created successfully!");
