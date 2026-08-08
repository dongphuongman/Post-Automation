/**
 * login.js — Đăng nhập Facebook MỘT LẦN vào profile cố định của bot.
 * Chạy: node scripts/login.js  (hoặc: npm run login)  từ thư mục bot/
 *
 * Mở một cửa sổ Chromium dùng chung profile với bot (bot/fb-profile). Bạn đăng nhập
 * FB trong cửa sổ đó (vượt xác minh bảo mật nếu có), rồi ĐÓNG cửa sổ — phiên được lưu.
 * Sau đó bot (npm run post) sẽ chạy trên profile đã đăng nhập, không bị FB đòi login.
 *
 * LƯU Ý: Không chạy login.js khi bot đang chạy (cùng profile chỉ 1 tiến trình dùng được).
 */

const { chromium } = require('playwright');
const path = require('path');

const FB_PROFILE_DIR = path.resolve(__dirname, '../fb-profile');

(async () => {
  console.log('🔓 Đang mở trình duyệt (profile bot) để bạn đăng nhập Facebook...\n');
  const context = await chromium.launchPersistentContext(FB_PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 800 },
    locale: 'vi-VN',
    args: ['--lang=vi-VN'],
  });
  const page = context.pages()[0] || await context.newPage();
  await page.goto('https://www.facebook.com');

  console.log('👉 HÃY LÀM TRONG CỬA SỔ VỪA MỞ:');
  console.log('   1) Đăng nhập Facebook (vượt xác minh bảo mật/checkpoint nếu FB yêu cầu).');
  console.log('   2) (Khuyến nghị) Bấm "Chuyển sang Trang" của Page bạn muốn đăng.');
  console.log('   3) Khi xong → ĐÓNG cửa sổ trình duyệt. Phiên sẽ được lưu vào profile.\n');
  console.log('⏳ Đang chờ... (đóng cửa sổ để kết thúc)');

  await new Promise((resolve) => context.on('close', resolve));
  console.log('\n✅ Đã lưu phiên vào profile bot. Giờ chạy:  npm run post');
  process.exit(0);
})().catch((e) => { console.error('💥 Lỗi:', e.message); process.exit(1); });
