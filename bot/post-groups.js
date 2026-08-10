/**
 * Facebook Group Poster — đăng AS Page
 * Chạy: node post-groups.js
 * Yêu cầu: cookies.json (từ account phụ), file .env.local có DATABASE_URL
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Thư mục profile Chromium cố định (persistent) — giữ phiên đăng nhập FB như trình
// duyệt thật, tránh bị FB coi là "thiết bị lạ" và đòi đăng nhập/checkpoint.
const FB_PROFILE_DIR = path.resolve(__dirname, 'fb-profile');
const { sql } = require('./lib/db');
const { PAGE_NAME, PAGE_URL, GROUPS, FB_API_VERSION } = require('./lib/config');
const { getPageById, getAccountByOwner, getSocialAccount, getGroupUrlsByIds, getActiveGroupUrlsForPage } = require('./lib/config-db');
const { llmChatCompletion } = require('./lib/llm-fetch');

async function spinContent(originalContent) {
  if (!process.env.LLM_API_KEY) return originalContent;
  try {
    console.log('   🔄 Đang spin lại nội dung khoảng 30%...');
    const result = await llmChatCompletion({
      messages: [{
        role: 'user',
        content: `Viết lại bài post Facebook sau đây. Giữ đúng ý nghĩa, định dạng, cách xuống dòng, độ dài và các hashtags. Chỉ viết lại khoảng 30% câu chữ (dùng từ đồng nghĩa, hoặc diễn đạt khác đi một chút) để bài viết mượt mà và không trùng lặp 100%. Trả về nguyên chuẩn văn bản bài post mới, KHÔNG THÊM CÂU CHÀO HAY MỞ ĐẦU.\n\nBài gốc:\n${originalContent}`
      }],
      temperature: 0.7,
    });
    return result.trim();
  } catch(e) {
    console.log('   ⚠️ Lỗi spin content:', e.message);
  }
  return originalContent;
}

const delay = (minSec, maxSec) =>
  new Promise(r => setTimeout(r, (Math.random() * (maxSec - minSec) + minSec) * 1000));

// Chặn một tác vụ treo vô thời hạn: nếu quá `ms` mili-giây chưa xong thì ném lỗi timeout.
// Dùng để bọc postToGroup — tránh việc một nhóm "kẹt" khiến cả bot đứng im mãi mãi.
function withTimeout(promise, ms, label = 'thao tác') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Quá thời gian chờ ${Math.round(ms / 1000)}s cho ${label}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Kiểm tra phiên FB còn hợp lệ trên `page`: dò URL login/checkpoint + ô mật khẩu.
// Trả về một hàm async (dùng lại cho cả context persistent lẫn context cá nhân).
function makeIsLoggedOut(page) {
  return async () => {
    const u = page.url();
    if (u.includes('login') || u.includes('checkpoint') || u.includes('/recover')) return true;
    try {
      return await page.locator('input[name="pass"], input[type="password"], form[action*="login"]')
        .first().isVisible({ timeout: 3000 }).catch(() => false);
    } catch { return false; }
  };
}

// Chuẩn hóa cookie (từ Cookie-Editor) sang định dạng Playwright addCookies.
function mapCookies(rawCookies) {
  return (rawCookies || []).map(c => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path || '/',
    expires: c.expirationDate || -1,
    httpOnly: c.httpOnly || false,
    secure: c.secure || false,
    sameSite: 'None',
  }));
}

async function switchToPage(page, pageName = PAGE_NAME) {
  try {
    // Tìm nút "Đang đăng với tư cách..." hoặc avatar/tên cá nhân
    const switchBtn = page.locator([
      '[aria-label*="Đang đăng với tư cách"]',
      '[aria-label*="Posting as"]',
      'div[role="button"]:has-text("Đang đăng")',
    ].join(', ')).first();

    await switchBtn.waitFor({ timeout: 8000 });
    await switchBtn.click();
    await delay(1, 2);

    // Trong dropdown chọn Page theo tên
    const pageOption = page.locator(`div[role="menuitem"]:has-text("${pageName}"), div[role="option"]:has-text("${pageName}")`).first();
    await pageOption.waitFor({ timeout: 8000 });
    await pageOption.click();
    await delay(1, 2);
    console.log(`   ✅ Đã chuyển sang đăng với tư cách: ${pageName}`);
    return true;
  } catch (err) {
    console.log(`   ⚠️  Không tìm thấy nút chuyển Page, sẽ đăng bằng account hiện tại. Lỗi: ${err.message}`);
    return false;
  }
}

async function postToGroup(page, groupUrl, content, imagePath, pageName = PAGE_NAME) {
  console.log(`\n📌 Nhóm: ${groupUrl}`);
  await page.goto(groupUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await delay(3, 6);

  // Bấm vào ô "Viết gì đó..." để mở composer
  const writeBoxSelectors = [
    '[aria-label*="Viết gì đó"]',
    '[aria-label*="Write something"]',
    '[aria-label*="Bạn viết gì đi"]',
    '[aria-label*="Create a public post"]',
    '[aria-label*="Tạo bài viết"]',
    'div[role="button"]:has-text("Viết gì đó")',
    'div[role="button"]:has-text("Write something")',
    'div[role="button"]:has-text("Bạn viết gì đi")',
    'span:has-text("Viết gì đó")',
    'span:has-text("Write something")',
    'span:has-text("Bạn viết gì đi")'
  ];

  let opened = false;
  for (const selector of writeBoxSelectors) {
    try {
      const el = page.locator(selector).first();
      await el.waitFor({ timeout: 10000 });
      await el.click();
      opened = true;
      console.log(`   ✅ Mở composer bằng: ${selector}`);
      break;
    } catch {}
  }

  if (!opened) {
    throw new Error('Không mở được ô viết bài');
  }

  await delay(2, 4);

  // Chuyển sang đăng AS Page
  await switchToPage(page, pageName);

  // Tìm ô soạn thảo thực sự (sau khi click mở)
  // Ưu tiên các ô soạn thảo NẰM TRONG BẢNG POP-UP (Modal/Dialog) để không bị click nhầm xuống Background Comment
  const editorSelectors = [
    'div[role="dialog"] [contenteditable="true"][role="textbox"]',
    'div[role="dialog"] [data-lexical-editor="true"]',
    '[aria-label*="Nội dung bài viết"]',
    '[aria-label*="Create a public post"]',
    '[aria-label*="What\'s on your mind"]',
    '[contenteditable="true"][role="textbox"]'
  ];

  let editor = null;
  for (const sel of editorSelectors) {
    try {
      const el = page.locator(sel).last(); // Dùng last() vì đôi khi Facebook lồng 2 thẻ dialog chồng nhau
      await el.waitFor({ state: 'visible', timeout: 5000 });
      editor = el;
      break;
    } catch {}
  }

  if (!editor) throw new Error('Không tìm thấy ô soạn thảo');

  await editor.click();
  await delay(1, 2);

  // Gõ nội dung (type từng dòng)
  const lines = content.split('\n');
  for (const line of lines) {
    await page.keyboard.type(line, { delay: 25 + Math.random() * 30 });
    await page.keyboard.press('Enter');
    await delay(0.2, 0.5);
  }

  await delay(1, 3);

  // Úp ảnh nếu có kiểu xịn đét giả lập người thật
  if (imagePath && fs.existsSync(imagePath)) {
    console.log(`   📸 Đang đính kèm ảnh gốc vào bài viết...`);
    try {
      // Tìm Nút bấm "Ảnh/video" nằm trong Modal
      const photoBtn = page.locator([
        'div[aria-label="Ảnh/video"]', 
        'div[aria-label="Photo/video"]',
        'div[aria-label*="Ảnh"]',
        'div[aria-label*="Photo"]'
      ].join(', ')).first();
      
      // Bắt sự kiện Window chờ mở bảng chọn File
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 10000 }),
        photoBtn.click()
      ]);
      
      // Bơm file vào họng nó
      await fileChooser.setFiles(imagePath);
      
      await delay(5, 8); // Chờ Facebook loading ảnh lên khung preview cho chắc cốp
      console.log(`   ✅ Ảnh đã được tải lên khung đăng và nằm chễm chệ!`);
    } catch(e) {
      console.log(`   ⚠️ Cảnh báo: Facebook chặn nút Ảnh, thử bơm ép đường cửa sau...`);
      try {
        const fileInput = page.locator('div[role="dialog"] input[type="file"][accept*="image"]').first();
        await fileInput.setInputFiles(imagePath);
        await delay(4, 7);
      } catch(err) {}
    }
  }

  await delay(2, 4);

  // Bấm nút Đăng
  const postBtnSelectors = [
    'div[aria-label="Đăng"]:not([aria-disabled="true"])',
    'div[aria-label="Post"]:not([aria-disabled="true"])',
    'button[aria-label="Đăng"]',
    'div[role="button"]:has-text("Đăng")',
  ];

  let posted = false;
  for (const sel of postBtnSelectors) {
    try {
      const btn = page.locator(sel).last();
      await btn.waitFor({ timeout: 5000 });
      await btn.click();
      posted = true;
      console.log(`   ✅ Đã bấm nút Đăng`);
      break;
    } catch {}
  }

  if (!posted) throw new Error('Không tìm thấy nút Đăng');

  await delay(4, 8);

  // Chụp màn hình
  fs.mkdirSync('screenshots', { recursive: true });
  const filename = `screenshots/${Date.now()}-${groupUrl.split('/groups/')[1] || 'group'}.png`;
  await page.screenshot({ path: filename });
  console.log(`   📸 Screenshot: ${filename}`);
}

// Chuyển hồ sơ ĐANG HOẠT ĐỘNG sang TRANG (Page). Với "Trang bản mới" của Facebook,
// composer "Bạn đang nghĩ gì?" CHỈ xuất hiện khi bạn đang ở tư cách Trang — nếu vẫn
// là hồ sơ cá nhân thì không có ô soạn bài để đăng AS Page.
// Sau khi bấm "Chuyển", Facebook thường bật modal xác nhận "Chuyển trang cá nhân"
// (Chuyển sang <Page> để dùng thêm tính năng...). Modal này che composer nếu không
// bấm nút "Chuyển" bên trong nó. Hàm này phát hiện & xác nhận modal đó.
async function confirmSwitchProfileModal(page) {
  try {
    const dialog = page.locator('div[role="dialog"]:has-text("Chuyển trang cá nhân")').first();
    await dialog.waitFor({ timeout: 4000 });
    // Nút xác nhận là "Chuyển" (nút xanh) NẰM TRONG dialog — dùng exact để không dính
    // tiêu đề "Chuyển trang cá nhân" hay link "Xem tất cả trang cá nhân".
    const confirmBtn = dialog.getByRole('button', { name: 'Chuyển', exact: true }).last();
    await confirmBtn.click();
    console.log('   🔀 Đã xác nhận modal "Chuyển trang cá nhân" → chuyển sang Page.');
    await delay(4, 7); // chờ FB tải lại giao diện dưới tư cách Page
    return true;
  } catch {
    return false;
  }
}

// Selector ô soạn bài của Page theo THỨ TỰ ƯU TIÊN (nhãn tin cậy nhất trước).
// KHÔNG gộp thành 1 locator .first(): .first() lấy theo thứ tự DOM nên dễ trúng
// tooltip "Chia sẻ suy nghĩ" gần avatar thay vì NÚT composer thật ở feed.
const COMPOSER_SELECTORS = [
  'div[role="button"]:has-text("Bạn đang nghĩ gì")',
  '[aria-label*="Bạn đang nghĩ gì"]',
  'div[role="button"]:has-text("Chia sẻ suy nghĩ")',
  '[aria-label*="Chia sẻ suy nghĩ"]',
  'div[role="button"]:has-text("What\'s on your mind")',
  '[aria-label*="What\'s on your mind"]',
];

// Thử mở composer theo thứ tự ưu tiên; click element VISIBLE đầu tiên.
// Trả về selector đã khớp (đã click) hoặc null.
async function tryOpenComposer(page, timeoutEach = 2500) {
  for (const sel of COMPOSER_SELECTORS) {
    try {
      const el = page.locator(sel).first();
      await el.waitFor({ state: 'visible', timeout: timeoutEach });
      await el.scrollIntoViewIfNeeded().catch(() => {});
      await el.click();
      return sel;
    } catch {}
  }
  return null;
}

async function switchToPageIdentity(page, pageName = PAGE_NAME) {
  // Modal "Chuyển trang cá nhân" có thể đã bật sẵn ngay khi vào Page → xác nhận trước.
  await confirmSwitchProfileModal(page);

  // Nếu composer đã sẵn → đang ở tư cách Trang rồi, bỏ qua. (Kiểm tra sự hiện diện —
  // gộp .first() ở đây chấp nhận được vì chỉ cần biết đã ở trên Page.)
  try {
    await page.locator(COMPOSER_SELECTORS.join(', ')).first().waitFor({ state: 'visible', timeout: 4000 });
    console.log('   ✅ Đang ở tư cách Trang (composer sẵn sàng).');
    return true;
  } catch {}

  // Bấm nút chuyển tư cách Trang (banner/khung hồ sơ). GỘP selector + timeout ngắn
  // để không tốn ~20s dò tuần tự khi không cần chuyển.
  try {
    const switchBtn = page.locator([
      'div[role="button"]:has-text("Chuyển ngay")',
      `div[role="button"]:has-text("Chuyển thành ${pageName}")`,
      'div[role="button"]:has-text("Chuyển")',
    ].join(', ')).first();
    await switchBtn.waitFor({ timeout: 4000 });
    await switchBtn.click();
    console.log('   🔄 Đã bấm chuyển sang tư cách Trang.');
    await delay(2, 3);
    await confirmSwitchProfileModal(page); // bấm "Chuyển" có thể mở modal xác nhận
    return true;
  } catch {
    console.log('   ⚠️ Không tìm thấy nút chuyển tư cách Trang — sẽ thử mở composer trực tiếp.');
    return false;
  }
}

// Đăng thẳng lên tường TRANG (Page) mà tài khoản đang quản trị — tư cách Page,
// dùng cookie (không cần token). Cơ chế giống postToGroup nhưng nhắm vào composer
// của Page ("Bạn đang nghĩ gì?") thay vì ô "Viết gì đó" của Nhóm.
async function postToPage(page, content, imagePath, pageName = PAGE_NAME, pageUrl = PAGE_URL) {
  console.log(`\n📄 Trang (Page): ${pageUrl}`);
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await delay(3, 6);

  // Bước quan trọng: chuyển sang tư cách Trang để composer xuất hiện
  await switchToPageIdentity(page, pageName);
  await delay(1, 2);

  // Mở composer — sau khi chuyển tư cách, FB thường RELOAD; nếu thử mở ngay sẽ trượt.
  // Thử lại vài lần: mỗi lần dọn modal (nếu bật lại) + chờ trang settle rồi mới mở.
  let opened = false;
  for (let attempt = 1; attempt <= 4 && !opened; attempt++) {
    await confirmSwitchProfileModal(page);
    const sel = await tryOpenComposer(page);
    if (sel) {
      opened = true;
      console.log(`   ✅ Mở composer Page (lần ${attempt}) bằng: ${sel}`);
    } else {
      console.log(`   ⏳ Composer chưa sẵn (lần ${attempt}) — chờ trang settle & thử lại...`);
      await delay(3, 5);
    }
  }

  if (!opened) {
    throw new Error('Không mở được ô soạn bài trên Page (kiểm tra: cookie có quyền quản trị Page? URL Page đúng?)');
  }

  await delay(2, 4);

  // Tìm ô soạn thảo trong dialog (đăng trên Page mặc định là AS Page nên không cần switchToPage)
  const editorSelectors = [
    'div[role="dialog"] [contenteditable="true"][role="textbox"]',
    'div[role="dialog"] [data-lexical-editor="true"]',
    '[aria-label*="Nội dung bài viết"]',
    '[aria-label*="What\'s on your mind"]',
    '[contenteditable="true"][role="textbox"]',
  ];

  let editor = null;
  for (const sel of editorSelectors) {
    try {
      const el = page.locator(sel).last();
      await el.waitFor({ state: 'visible', timeout: 5000 });
      editor = el;
      break;
    } catch {}
  }

  if (!editor) throw new Error('Không tìm thấy ô soạn thảo trên Page');

  await editor.click();
  await delay(1, 2);

  // Gõ nội dung
  const lines = content.split('\n');
  for (const line of lines) {
    await page.keyboard.type(line, { delay: 25 + Math.random() * 30 });
    await page.keyboard.press('Enter');
    await delay(0.2, 0.5);
  }

  await delay(1, 3);

  // Đính kèm ảnh nếu có
  if (imagePath && fs.existsSync(imagePath)) {
    console.log(`   📸 Đang đính kèm ảnh vào bài Page...`);
    try {
      const photoBtn = page.locator([
        'div[aria-label="Ảnh/video"]',
        'div[aria-label="Photo/video"]',
        'div[aria-label*="Ảnh"]',
        'div[aria-label*="Photo"]',
      ].join(', ')).first();

      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 10000 }),
        photoBtn.click(),
      ]);
      await fileChooser.setFiles(imagePath);
      await delay(5, 8);
      console.log(`   ✅ Ảnh đã lên khung đăng.`);
    } catch (e) {
      try {
        const fileInput = page.locator('div[role="dialog"] input[type="file"][accept*="image"]').first();
        await fileInput.setInputFiles(imagePath);
        await delay(4, 7);
      } catch (err) {}
    }
  }

  await delay(2, 4);

  // BƯỚC 1: Composer Page là luồng 2 bước — nếu có nút "Tiếp" thì bấm để sang
  // màn "Cài đặt bài viết" (nơi mới có nút "Đăng" thật sự).
  try {
    const nextBtn = page.locator([
      'div[aria-label="Tiếp"][role="button"]:not([aria-disabled="true"])',
      'div[role="button"]:has-text("Tiếp"):not([aria-disabled="true"])',
    ].join(', ')).last();
    await nextBtn.waitFor({ timeout: 5000 });
    await nextBtn.click();
    console.log(`   ➡️  Đã bấm "Tiếp" (sang bước cài đặt bài viết).`);
    await delay(2, 4);
  } catch {
    console.log(`   (Không thấy nút "Tiếp" — có thể composer 1 bước, thử bấm Đăng luôn.)`);
  }

  // BƯỚC 2: Bấm nút "Đăng"
  const postBtnSelectors = [
    'div[aria-label="Đăng"][role="button"]:not([aria-disabled="true"])',
    'div[aria-label="Post"][role="button"]:not([aria-disabled="true"])',
    'button[aria-label="Đăng"]',
    'div[role="button"]:has-text("Đăng"):not([aria-disabled="true"])',
  ];

  let posted = false;
  for (const sel of postBtnSelectors) {
    try {
      const btn = page.locator(sel).last();
      await btn.waitFor({ timeout: 5000 });
      await btn.click();
      posted = true;
      console.log(`   ✅ Đã bấm nút Đăng (Page)`);
      break;
    } catch {}
  }

  if (!posted) throw new Error('Không tìm thấy nút Đăng trên Page');

  // BƯỚC 3: Sau khi bấm "Đăng", FB Page hay chèn popup upsell chặn giữa chừng
  // ("Thêm nút Gọi ngay?" / "Trò chuyện trực tiếp..."). Phải bấm "Lúc khác" để
  // bỏ qua thì bài mới thực sự được đăng.
  await delay(2, 3);
  for (let i = 0; i < 2; i++) {
    try {
      const skip = page.locator([
        'div[role="button"]:has-text("Lúc khác")',
        'div[role="button"]:has-text("Không phải bây giờ")',
        'div[role="button"]:has-text("Để sau")',
      ].join(', ')).first();
      await skip.waitFor({ timeout: 4000 });
      await skip.click();
      console.log('   ✖️ Đã bỏ qua popup gợi ý ("Lúc khác") để hoàn tất đăng.');
      await delay(2, 3);
    } catch {
      break; // không còn popup nào chặn
    }
  }

  // BƯỚC 4 (QUAN TRỌNG): Chờ bài THỰC SỰ đăng xong.
  // Nếu đóng browser khi FB còn "Đang đăng" thì bài sẽ bị HỦY → không lên tường.
  // Đợi hộp thoại soạn bài đóng hẳn (dấu hiệu publish hoàn tất).
  try {
    await page.locator('div[role="dialog"]')
      .filter({ hasText: 'Cài đặt bài viết' })
      .first()
      .waitFor({ state: 'detached', timeout: 90000 });
    console.log('   ✅ Bài đã đăng xong (hộp thoại đã đóng).');
  } catch {
    console.log('   ⚠️ Chờ quá lâu chưa thấy hộp thoại đóng — có thể ảnh nặng/mạng chậm.');
  }
  await delay(4, 7); // để FB xử lý nốt phía server

  fs.mkdirSync('screenshots', { recursive: true });
  const filename = `screenshots/${Date.now()}-page.png`;
  await page.screenshot({ path: filename });
  console.log(`   📸 Screenshot: ${filename}`);
}

// Đăng lên TƯỜNG CÁ NHÂN của chính chủ bài. Chạy trên context riêng nạp cookie của
// owner (KHÔNG dùng profile cố định của bot). Đơn bước như postToGroup — KHÔNG chuyển
// tư cách Trang, KHÔNG bước "Tiếp", KHÔNG popup upsell. Audience giữ mặc định của user.
async function postToProfile(page, content, imagePath) {
  console.log(`\n🙍 Trang cá nhân: https://www.facebook.com/`);
  await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await delay(3, 6);

  // Mở composer "Bạn đang nghĩ gì?" (dùng chung COMPOSER_SELECTORS/tryOpenComposer).
  let opened = false;
  for (let attempt = 1; attempt <= 3 && !opened; attempt++) {
    const sel = await tryOpenComposer(page);
    if (sel) {
      opened = true;
      console.log(`   ✅ Mở composer cá nhân (lần ${attempt}) bằng: ${sel}`);
    } else {
      console.log(`   ⏳ Composer chưa sẵn (lần ${attempt}) — chờ trang settle & thử lại...`);
      await delay(3, 5);
    }
  }
  if (!opened) throw new Error('Không mở được ô soạn bài trên trang cá nhân');

  await delay(2, 4);

  // Ô soạn thảo trong dialog
  const editorSelectors = [
    'div[role="dialog"] [contenteditable="true"][role="textbox"]',
    'div[role="dialog"] [data-lexical-editor="true"]',
    '[aria-label*="Nội dung bài viết"]',
    '[aria-label*="What\'s on your mind"]',
    '[contenteditable="true"][role="textbox"]',
  ];

  let editor = null;
  for (const sel of editorSelectors) {
    try {
      const el = page.locator(sel).last();
      await el.waitFor({ state: 'visible', timeout: 5000 });
      editor = el;
      break;
    } catch {}
  }

  if (!editor) throw new Error('Không tìm thấy ô soạn thảo trên trang cá nhân');

  await editor.click();
  await delay(1, 2);

  // Gõ nội dung (type từng dòng)
  const lines = content.split('\n');
  for (const line of lines) {
    await page.keyboard.type(line, { delay: 25 + Math.random() * 30 });
    await page.keyboard.press('Enter');
    await delay(0.2, 0.5);
  }

  await delay(1, 3);

  // Đính kèm ảnh nếu có
  if (imagePath && fs.existsSync(imagePath)) {
    console.log(`   📸 Đang đính kèm ảnh vào bài cá nhân...`);
    try {
      const photoBtn = page.locator([
        'div[aria-label="Ảnh/video"]',
        'div[aria-label="Photo/video"]',
        'div[aria-label*="Ảnh"]',
        'div[aria-label*="Photo"]',
      ].join(', ')).first();

      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 10000 }),
        photoBtn.click(),
      ]);
      await fileChooser.setFiles(imagePath);
      await delay(5, 8);
      console.log(`   ✅ Ảnh đã lên khung đăng.`);
    } catch (e) {
      try {
        const fileInput = page.locator('div[role="dialog"] input[type="file"][accept*="image"]').first();
        await fileInput.setInputFiles(imagePath);
        await delay(4, 7);
      } catch (err) {}
    }
  }

  await delay(2, 4);

  // Bấm nút "Đăng" (ĐƠN BƯỚC — không có "Tiếp")
  const postBtnSelectors = [
    'div[aria-label="Đăng"][role="button"]:not([aria-disabled="true"])',
    'div[aria-label="Post"][role="button"]:not([aria-disabled="true"])',
    'button[aria-label="Đăng"]',
    'div[role="button"]:has-text("Đăng"):not([aria-disabled="true"])',
  ];

  let posted = false;
  for (const sel of postBtnSelectors) {
    try {
      const btn = page.locator(sel).last();
      await btn.waitFor({ timeout: 5000 });
      await btn.click();
      posted = true;
      console.log(`   ✅ Đã bấm nút Đăng (cá nhân)`);
      break;
    } catch {}
  }

  if (!posted) throw new Error('Không tìm thấy nút Đăng trên trang cá nhân');

  // Chờ hộp thoại soạn bài đóng hẳn (dấu hiệu publish hoàn tất) — tránh đóng browser
  // khi FB còn "Đang đăng" khiến bài bị hủy.
  await delay(2, 3);
  try {
    await page.locator('div[role="dialog"] [contenteditable="true"][role="textbox"]')
      .first()
      .waitFor({ state: 'detached', timeout: 90000 });
    console.log('   ✅ Bài đã đăng xong (hộp thoại đã đóng).');
  } catch {
    console.log('   ⚠️ Chờ quá lâu chưa thấy hộp thoại đóng — có thể ảnh nặng/mạng chậm.');
  }
  await delay(4, 7);

  fs.mkdirSync('screenshots', { recursive: true });
  const filename = `screenshots/${Date.now()}-page.png`;
  await page.screenshot({ path: filename });
  console.log(`   📸 Screenshot: ${filename}`);
}

// ===== X (Twitter) — automation trên context ephemeral nạp cookie của owner =====
// Đăng tweet: mở composer, gõ nội dung (CẮT ≤ 280 ký tự cho gói free), đính ảnh nếu
// có, bấm nút đăng. Selector dựa trên data-testid ổn định của X.
async function postToX(page, content, imagePath) {
  const text = (content || '').slice(0, 280);
  console.log(`\n𝕏 Đăng lên X (${text.length} ký tự)...`);
  await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await delay(3, 6);

  const editor = page.locator('[data-testid="tweetTextarea_0"]').first();
  await editor.waitFor({ state: 'visible', timeout: 15000 });
  await editor.click();
  await delay(1, 2);
  await page.keyboard.type(text, { delay: 15 + Math.random() * 25 });
  await delay(1, 2);

  if (imagePath && fs.existsSync(imagePath)) {
    console.log('   📸 Đính ảnh vào tweet...');
    try {
      const fileInput = page.locator('input[type="file"][accept*="image"], [data-testid="fileInput"]').first();
      await fileInput.setInputFiles(imagePath);
      await delay(4, 7);
    } catch (e) { console.log('   ⚠️ Không đính được ảnh vào X:', e.message); }
  }

  await delay(1, 2);
  const postBtn = page.locator('[data-testid="tweetButton"]').first();
  await postBtn.waitFor({ state: 'visible', timeout: 10000 });
  await postBtn.click();
  console.log('   ✅ Đã bấm nút đăng tweet.');
  await delay(5, 8);

  fs.mkdirSync('screenshots', { recursive: true });
  const filename = `screenshots/${Date.now()}-x.png`;
  await page.screenshot({ path: filename });
  console.log(`   📸 Screenshot: ${filename}`);
}

// ===== Instagram — automation web trên context ephemeral nạp cookie của owner =====
// BẮT BUỘC có ảnh. Luồng web: nút "New post" → upload ảnh → Next x2 (bỏ crop/filter)
// → dán caption (≤ 2200) → Share. Selector best-effort (UI IG hay đổi) — bọc try/catch.
async function postToInstagram(page, content, imagePath) {
  if (!imagePath || !fs.existsSync(imagePath)) {
    throw new Error('Instagram bắt buộc phải có ảnh — không có ảnh để đăng.');
  }
  const caption = (content || '').slice(0, 2200);
  console.log(`\n📸 Đăng lên Instagram (${caption.length} ký tự caption)...`);
  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await delay(4, 7);

  // Mở dialog tạo bài — nút "New post" (icon dấu cộng).
  const createBtn = page.locator('svg[aria-label="New post"], [aria-label="New post"], svg[aria-label="Bài viết mới"], [aria-label="Bài viết mới"]').first();
  await createBtn.waitFor({ state: 'visible', timeout: 15000 });
  await createBtn.click();
  await delay(2, 4);
  // Đôi khi có menu con "Post"/"Bài viết" cần bấm tiếp.
  try {
    const sub = page.locator('span:has-text("Post"), span:has-text("Bài viết")').first();
    await sub.waitFor({ state: 'visible', timeout: 3000 });
    await sub.click();
    await delay(1, 2);
  } catch {}

  // Upload ảnh qua input file trong dialog.
  const fileInput = page.locator('div[role="dialog"] input[type="file"], input[type="file"]').first();
  await fileInput.setInputFiles(imagePath);
  console.log('   📸 Đã upload ảnh — chờ IG xử lý...');
  await delay(4, 7);

  // Next hai lần: bỏ qua crop → bỏ qua filter/edit.
  for (let i = 0; i < 2; i++) {
    try {
      const next = page.locator('div[role="button"]:has-text("Next"), div[role="button"]:has-text("Tiếp"), button:has-text("Next"), button:has-text("Tiếp")').first();
      await next.waitFor({ state: 'visible', timeout: 8000 });
      await next.click();
      console.log(`   ➡️  Bấm Next (${i + 1}/2).`);
      await delay(2, 4);
    } catch (e) { console.log(`   ⚠️ Không thấy nút Next (${i + 1}):`, e.message); }
  }

  // Dán caption.
  try {
    const captionBox = page.locator('div[role="dialog"] [contenteditable="true"], textarea[aria-label*="caption"], textarea[aria-label*="chú thích"]').first();
    await captionBox.waitFor({ state: 'visible', timeout: 8000 });
    await captionBox.click();
    await page.keyboard.type(caption, { delay: 8 + Math.random() * 15 });
    await delay(1, 2);
  } catch (e) { console.log('   ⚠️ Không nhập được caption:', e.message); }

  // Share.
  const share = page.locator('div[role="button"]:has-text("Share"), div[role="button"]:has-text("Chia sẻ"), button:has-text("Share"), button:has-text("Chia sẻ")').first();
  await share.waitFor({ state: 'visible', timeout: 8000 });
  await share.click();
  console.log('   ✅ Đã bấm Share — chờ IG hoàn tất...');
  await delay(8, 12);

  fs.mkdirSync('screenshots', { recursive: true });
  const filename = `screenshots/${Date.now()}-instagram.png`;
  await page.screenshot({ path: filename });
  console.log(`   📸 Screenshot: ${filename}`);
}

// Đăng lên Threads qua API chính thức (KHÔNG browser). Tạo container rồi publish.
// Trả { ok, id } — id là creation/media id lưu vào facebook_post_id.
async function postToThreadsAPI(token, content, originalImageUrl) {
  const text = (content || '').slice(0, 500);
  const useImage = typeof originalImageUrl === 'string' && originalImageUrl.startsWith('http');

  // 1) Tạo media container.
  const createUrl = new URL('https://graph.threads.net/v1.0/me/threads');
  createUrl.searchParams.set('media_type', useImage ? 'IMAGE' : 'TEXT');
  createUrl.searchParams.set('text', text);
  if (useImage) createUrl.searchParams.set('image_url', originalImageUrl);
  createUrl.searchParams.set('access_token', token);

  const cRes = await fetch(createUrl.toString(), { method: 'POST' });
  const cData = await cRes.json();
  if (!cData.id) throw new Error('Threads tạo container lỗi: ' + JSON.stringify(cData));

  await delay(2, 4); // Threads khuyến nghị chờ trước khi publish.

  // 2) Publish container.
  const pubUrl = new URL('https://graph.threads.net/v1.0/me/threads_publish');
  pubUrl.searchParams.set('creation_id', cData.id);
  pubUrl.searchParams.set('access_token', token);

  const pRes = await fetch(pubUrl.toString(), { method: 'POST' });
  const pData = await pRes.json();
  if (!pData.id) throw new Error('Threads publish lỗi: ' + JSON.stringify(pData));
  return { ok: true, id: pData.id };
}

async function main() {
  // Lấy bài cần đăng từ DB
  let content = '';
  let postId = null;
  let imagePathLocal = null;
  let dest = 'groups';                 // đích đến: 'page' hoặc 'groups'
  let revertStatus = 'ready_for_groups'; // trạng thái để trả bài về khi thoát sớm/thất bại
  let pageCfg = null;                  // cấu hình Page đích (name/url/cookies) từ DB
  let targetGroupIdsRaw = null;        // JSON mảng id nhóm đích của bài
  let ownerId = null;                  // chủ bài — quyết định dùng phiên FB cá nhân của ai (đích profile)
  let originalImageUrl = null;         // URL ảnh gốc (http) — Threads API cần URL public

  if (sql) {
    // Lấy timestamp hiện tại (giây) để so sánh với scheduled_time
    const currentEpoch = Math.floor(Date.now() / 1000);

    // CLAIM nguyên tử theo ĐỘ ƯU TIÊN: Page trước, Nhóm sau.
    // Đổi ngay bài sang trạng thái tạm ('page_posting'/'groups_posting') để không
    // luồng/lần chạy nào khác nhặt lại cùng bài — chống ĐĂNG TRÙNG kể cả khi crash.
    let posts = await sql`
      UPDATE posts SET status = 'page_posting'
      WHERE id = (
        SELECT id FROM posts
        WHERE status = 'ready_for_page'
          AND (scheduled_time IS NULL OR scheduled_time <= ${currentEpoch})
        ORDER BY id ASC
        LIMIT 1
      )
      RETURNING *
    `;
    if (posts.length > 0) {
      dest = 'page';
      revertStatus = 'ready_for_page';
    } else {
      posts = await sql`
        UPDATE posts SET status = 'groups_posting'
        WHERE id = (
          SELECT id FROM posts
          WHERE status = 'ready_for_groups'
            AND (scheduled_time IS NULL OR scheduled_time <= ${currentEpoch})
          ORDER BY id ASC
          LIMIT 1
        )
        RETURNING *
      `;
      if (posts.length > 0) {
        dest = 'groups';
        revertStatus = 'ready_for_groups';
      } else {
        // Ưu tiên 3: đăng lên TƯỜNG CÁ NHÂN của chủ bài (dùng phiên FB riêng của họ).
        posts = await sql`
          UPDATE posts SET status = 'profile_posting'
          WHERE id = (
            SELECT id FROM posts
            WHERE status = 'ready_for_profile'
              AND (scheduled_time IS NULL OR scheduled_time <= ${currentEpoch})
            ORDER BY id ASC
            LIMIT 1
          )
          RETURNING *
        `;
        if (posts.length > 0) {
          dest = 'profile';
          revertStatus = 'ready_for_profile';
        }
      }
    }

    // Ưu tiên tiếp: các nền tảng khác (X / Threads / Instagram). Mỗi platform CLAIM
    // nguyên tử sang trạng thái tạm '<platform>_posting' để chống đăng trùng.
    if (posts.length === 0) {
      const socialClaims = [
        { ready: 'ready_for_x', posting: 'x_posting', dest: 'x' },
        { ready: 'ready_for_threads', posting: 'threads_posting', dest: 'threads' },
        { ready: 'ready_for_instagram', posting: 'instagram_posting', dest: 'instagram' },
      ];
      for (const c of socialClaims) {
        posts = await sql`
          UPDATE posts SET status = ${c.posting}
          WHERE id = (
            SELECT id FROM posts
            WHERE status = ${c.ready}
              AND (scheduled_time IS NULL OR scheduled_time <= ${currentEpoch})
            ORDER BY id ASC
            LIMIT 1
          )
          RETURNING *
        `;
        if (posts.length > 0) {
          dest = c.dest;
          revertStatus = c.ready;
          break;
        }
      }
    }

    if (posts.length === 0) {
      if (!global.hasLoggedGroupsQueue) {
        console.log('⏳ Chưa có bài nào tới lịch Đăng Page/Nhóm/Cá nhân (hoặc đang chờ tới giờ hẹn).');
        global.hasLoggedGroupsQueue = true;
      }
      return false;
    }
    const post = posts[0];
    global.hasLoggedGroupsQueue = false;
    postId = post.id;
    ownerId = post.owner_id;
    originalImageUrl = post.original_image_url;
    content = `${post.content}\n\n${post.hashtags}`;

    // Nạp cấu hình Page đích (đa Page) từ DB — cookie/token/tên/URL riêng cho bài này.
    pageCfg = await getPageById(post.target_page_id);
    targetGroupIdsRaw = post.target_group_ids;
    if (pageCfg) console.log(`🏷️  Page đích: ${pageCfg.name} (${pageCfg.cookies ? 'có cookie DB' : 'không cookie DB'})`);

    // Nếu có facebook_post_id, gọi Graph API để kiểm tra xem đã Public trên Page chưa và lấy nội dung chuẩn
    if (post.facebook_post_id && process.env.FACEBOOK_ACCESS_TOKEN) {
      console.log(`\n🔍 Đang kiểm tra trạng thái bài viết cực căng trên Page (FB_ID: ${post.facebook_post_id})...`);
      try {
        const fbRes = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${post.facebook_post_id}?fields=message,is_published&access_token=${process.env.FACEBOOK_ACCESS_TOKEN}`);
        const fbData = await fbRes.json();
        
        if (fbData.is_published === false) {
          console.log(`⏳ Bài này hẹn giờ NHƯNG chưa thực sự xuất hiện chễm chệ trên Page chính. Bot sẽ hoãn lại chờ Page lên sóng trước nhé!`);
          await sql`UPDATE posts SET status = ${revertStatus} WHERE id = ${postId}`; // nhả claim để lượt sau xử lý lại
          return;
        }
        
        if (fbData.message) {
          console.log(`✅ KAK! Đã lụm được nguyên si bài Public chuẩn trên Page. Dùng cái này làm gốc để Spin!!`);
          content = fbData.message;
        }
      } catch (e) {
        console.log(`⚠️ Lỗi check mạng FB, sẽ backup dùng nguyên nội dung từ DB để spin.`);
      }
    }

    console.log(`📝 NỘI DUNG GỐC ĐỂ SPIN (ID: ${postId}):\n${content.substring(0, 150)}...\n`);
    
    // Tải ảnh chuẩn chỉ mà User đã tích chọn trên Vercel để Up Group
    const imgUrl = post.selected_image_url || post.generated_image_url || post.original_image_url;
    if (imgUrl) {
      console.log(`📥 Lấy đúng chuẩn ảnh User đã soi để up Group...`);
      try {
        const res = await fetch(imgUrl);
        const buffer = await res.arrayBuffer();
        imagePathLocal = `screenshots/img_group_${postId}.jpg`;
        fs.writeFileSync(imagePathLocal, Buffer.from(buffer));
      } catch(e) {
        console.log(`⚠️ Lỗi tải ảnh cho Group:`, e.message);
      }
    }

  } else {
    // Test mode: dùng nội dung mẫu
    content = 'Test post từ bot Playwright. #AI #agent';
    console.log('⚠️  Chạy test mode (không có DATABASE_URL)');
  }

  // ===== ĐÍCH = PROFILE: đăng lên TƯỜNG CÁ NHÂN của chủ bài (owner) =====
  // Xử lý TRƯỚC khi mở context persistent dùng chung: đăng cá nhân phải dùng phiên FB
  // RIÊNG của owner (không phải tài khoản bot). Mở một context EPHEMERAL nạp cookie của
  // owner, đăng xong rồi ĐÓNG — hoàn toàn tách biệt luồng Page/Nhóm bên dưới.
  if (dest === 'profile') {
    const account = await getAccountByOwner(ownerId);
    const profileCookies = mapCookies(account?.cookies);
    if (!profileCookies.length) {
      console.error('❌ Chủ bài chưa kết nối Facebook cá nhân (không có cookie) — cần vào /manage/account để kết nối.');
      if (postId && sql) await sql`UPDATE posts SET status = 'ready_for_profile' WHERE id = ${postId}`;
      return true;
    }

    const pBrowser = await chromium.launch({ headless: false, args: ['--lang=vi-VN'] });
    const pContext = await pBrowser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: 'vi-VN',
    });
    try { await pContext.addCookies(profileCookies); } catch {}
    const pPage = await pContext.newPage();
    const pIsLoggedOut = makeIsLoggedOut(pPage);

    await pPage.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded' });
    await delay(3, 5);

    if (await pIsLoggedOut()) {
      console.error('❌ Cookie Facebook cá nhân của chủ bài đã hết hạn (hoặc bị checkpoint) — trả bài về hàng đợi.');
      if (postId && sql) await sql`UPDATE posts SET status = 'ready_for_profile' WHERE id = ${postId}`;
      await pBrowser.close();
      return true;
    }
    console.log('✅ Phiên cá nhân hợp lệ (cookie của chủ bài).\n');

    let profileOk = 0;
    try {
      const spunContent = await spinContent(content);
      await withTimeout(
        postToProfile(pPage, spunContent, imagePathLocal),
        4 * 60 * 1000,
        'đăng trang cá nhân',
      );
      profileOk = 1;
    } catch (err) {
      console.error('❌ Lỗi đăng trang cá nhân:', err.message);
      try {
        fs.mkdirSync('screenshots', { recursive: true });
        await pPage.screenshot({ path: `screenshots/error-profile-${Date.now()}.png` });
      } catch {}
    }

    if (postId && sql) {
      if (profileOk > 0) {
        await sql`UPDATE posts SET status = 'posted' WHERE id = ${postId}`;
        console.log(`\n✅ Cập nhật DB: bài ${postId} → posted (đã lên trang cá nhân)\n`);
      } else {
        await sql`UPDATE posts SET status = 'ready_for_profile' WHERE id = ${postId}`;
        console.log(`\n↩️  Không đăng được trang cá nhân — trả bài ${postId} về 'ready_for_profile' để thử lại.\n`);
      }
    }

    await pBrowser.close();
    console.log(`\n🎉 Hoàn tất Đăng trang cá nhân (${profileOk > 0 ? 'THÀNH CÔNG' : 'THẤT BẠI'}). Sang bài tiếp theo...`);
    return true;
  }

  // ===== ĐÍCH = THREADS: đăng qua API chính thức (KHÔNG browser) =====
  // Xử lý TRƯỚC khi mở Chromium (giống profile) — chỉ cần access token của owner.
  if (dest === 'threads') {
    const account = await getSocialAccount(ownerId, 'threads');
    const token = account?.token;
    if (!token) {
      console.error('❌ Chủ bài chưa kết nối Threads (không có access token) — vào /manage/social để kết nối.');
      if (postId && sql) await sql`UPDATE posts SET status = 'ready_for_threads' WHERE id = ${postId}`;
      return true;
    }
    let threadsOk = 0, threadsId = null;
    try {
      const spunContent = await spinContent(content);
      const res = await withTimeout(
        postToThreadsAPI(token, spunContent, originalImageUrl),
        4 * 60 * 1000,
        'đăng Threads (API)',
      );
      if (res && res.ok) { threadsOk = 1; threadsId = res.id; }
    } catch (err) {
      console.error('❌ Lỗi đăng Threads:', err.message);
    }
    if (postId && sql) {
      if (threadsOk > 0) {
        await sql`UPDATE posts SET status = 'posted', facebook_post_id = ${threadsId} WHERE id = ${postId}`;
        console.log(`\n✅ Cập nhật DB: bài ${postId} → posted (đã lên Threads, id=${threadsId})\n`);
      } else {
        await sql`UPDATE posts SET status = 'ready_for_threads' WHERE id = ${postId}`;
        console.log(`\n↩️  Không đăng được Threads — trả bài ${postId} về 'ready_for_threads' để thử lại.\n`);
      }
    }
    console.log(`\n🎉 Hoàn tất Đăng Threads (${threadsOk > 0 ? 'THÀNH CÔNG' : 'THẤT BẠI'}). Sang bài tiếp theo...`);
    return true;
  }

  // ===== ĐÍCH = X hoặc INSTAGRAM: automation trên context Chromium EPHEMERAL =====
  // Nạp cookie RIÊNG của owner cho platform tương ứng, đăng xong rồi ĐÓNG — tách biệt
  // hoàn toàn khỏi profile cố định của bot (giống nhánh profile).
  if (dest === 'x' || dest === 'instagram') {
    const platform = dest; // 'x' | 'instagram'
    const homeUrl = platform === 'x' ? 'https://x.com/home' : 'https://www.instagram.com/';
    const account = await getSocialAccount(ownerId, platform);
    const socialCookies = mapCookies(account?.cookies);
    if (!socialCookies.length) {
      console.error(`❌ Chủ bài chưa kết nối ${platform.toUpperCase()} (không có cookie) — vào /manage/social để kết nối.`);
      if (postId && sql) await sql`UPDATE posts SET status = ${revertStatus} WHERE id = ${postId}`;
      return true;
    }
    // Instagram bắt buộc có ảnh — nếu không có thì revert luôn, khỏi mở browser.
    if (platform === 'instagram' && !imagePathLocal) {
      console.error('❌ Instagram bắt buộc phải có ảnh — bài này không có ảnh. Trả về hàng đợi.');
      if (postId && sql) await sql`UPDATE posts SET status = 'ready_for_instagram' WHERE id = ${postId}`;
      return true;
    }

    const sBrowser = await chromium.launch({ headless: false });
    const sContext = await sBrowser.newContext({ viewport: { width: 1280, height: 800 } });
    try { await sContext.addCookies(socialCookies); } catch {}
    const sPage = await sContext.newPage();
    const sIsLoggedOut = makeIsLoggedOut(sPage);

    await sPage.goto(homeUrl, { waitUntil: 'domcontentloaded' });
    await delay(3, 5);

    if (await sIsLoggedOut()) {
      console.error(`❌ Cookie ${platform.toUpperCase()} của chủ bài đã hết hạn (hoặc bị checkpoint) — trả bài về hàng đợi.`);
      if (postId && sql) await sql`UPDATE posts SET status = ${revertStatus} WHERE id = ${postId}`;
      await sBrowser.close();
      return true;
    }
    console.log(`✅ Phiên ${platform.toUpperCase()} hợp lệ (cookie của chủ bài).\n`);

    let socialOk = 0;
    try {
      const spunContent = await spinContent(content);
      const fn = platform === 'x' ? postToX : postToInstagram;
      await withTimeout(fn(sPage, spunContent, imagePathLocal), 4 * 60 * 1000, `đăng ${platform}`);
      socialOk = 1;
    } catch (err) {
      console.error(`❌ Lỗi đăng ${platform.toUpperCase()}:`, err.message);
      try {
        fs.mkdirSync('screenshots', { recursive: true });
        await sPage.screenshot({ path: `screenshots/error-${platform}-${Date.now()}.png` });
      } catch {}
    }

    if (postId && sql) {
      if (socialOk > 0) {
        await sql`UPDATE posts SET status = 'posted' WHERE id = ${postId}`;
        console.log(`\n✅ Cập nhật DB: bài ${postId} → posted (đã lên ${platform.toUpperCase()})\n`);
      } else {
        await sql`UPDATE posts SET status = ${revertStatus} WHERE id = ${postId}`;
        console.log(`\n↩️  Không đăng được ${platform.toUpperCase()} — trả bài ${postId} về '${revertStatus}' để thử lại.\n`);
      }
    }

    await sBrowser.close();
    console.log(`\n🎉 Hoàn tất Đăng ${platform.toUpperCase()} (${socialOk > 0 ? 'THÀNH CÔNG' : 'THẤT BẠI'}). Sang bài tiếp theo...`);
    return true;
  }

  // Cookie (từ DB theo Page, hoặc file) — CHỈ dùng để "bootstrap" lần đầu nếu profile
  // chưa đăng nhập. Không bắt buộc: profile cố định mới là nguồn phiên chính.
  let rawCookies = pageCfg?.cookies || null;
  if (!rawCookies && fs.existsSync('cookies.json')) {
    try { rawCookies = JSON.parse(fs.readFileSync('cookies.json', 'utf8')); } catch {}
  }
  const cookies = mapCookies(rawCookies);

  // Dùng PROFILE CỐ ĐỊNH (persistent) thay cho context trống + nhét cookie:
  // FB tin như trình duyệt thật (giữ localStorage/fingerprint), không đòi login lại.
  const context = await chromium.launchPersistentContext(FB_PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 800 },
    locale: 'vi-VN',
    args: ['--lang=vi-VN'],
  });
  const browser = context.browser(); // để các lệnh browser.close() cũ vẫn chạy
  const page = context.pages()[0] || await context.newPage();

  // Kiểm tra cookies còn hợp lệ — không chỉ dò URL 'login' mà còn dò trang
  // checkpoint/đăng nhập (ô mật khẩu, nút "Đăng nhập") vì FB hay chặn bot bằng
  // checkpoint có URL không chứa 'login'.
  const isLoggedOut = makeIsLoggedOut(page);

  await page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded' });
  await delay(3, 5);

  // Nếu profile chưa đăng nhập → thử nạp cookie (bootstrap) một lần.
  if (await isLoggedOut() && cookies.length) {
    console.log('   🔑 Profile chưa đăng nhập — thử bootstrap bằng cookie...');
    try { await context.addCookies(cookies); } catch {}
    await page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded' });
    await delay(3, 5);
  }

  if (await isLoggedOut()) {
    console.error('❌ Profile của bot CHƯA đăng nhập Facebook (hoặc bị checkpoint).');
    console.error('👉 Chạy 1 lần:  node scripts/login.js  → đăng nhập FB trong cửa sổ đó (vượt xác minh nếu có) → đóng cửa sổ. Rồi chạy lại bot.');
    if (postId && sql) await sql`UPDATE posts SET status = ${revertStatus} WHERE id = ${postId}`; // nhả claim
    await browser.close();
    return;
  }
  console.log('✅ Phiên hợp lệ (profile đã đăng nhập).\n');

  let successCount = 0;
  // Tên/URL Page đích: từ DB nếu có, fallback config.js.
  const pageName = pageCfg?.name || PAGE_NAME;
  const pageUrl = pageCfg?.url || PAGE_URL;

  // ===== ĐÍCH = PAGE: đăng thẳng lên Trang (tư cách Page, dùng cookie) =====
  if (dest === 'page') {
    try {
      const spunContent = await spinContent(content);
      await withTimeout(
        postToPage(page, spunContent, imagePathLocal, pageName, pageUrl),
        4 * 60 * 1000,
        `đăng Page ${pageUrl}`,
      );
      successCount = 1;
    } catch (err) {
      console.error(`❌ Lỗi đăng Page:`, err.message);
      try {
        fs.mkdirSync('screenshots', { recursive: true });
        await page.screenshot({ path: `screenshots/error-page-${Date.now()}.png` });
      } catch {}
    }

    if (postId && sql) {
      if (successCount > 0) {
        await sql`UPDATE posts SET status = 'posted' WHERE id = ${postId}`;
        console.log(`\n✅ Cập nhật DB: bài ${postId} → posted (đã lên Page)\n`);
      } else {
        await sql`UPDATE posts SET status = 'ready_for_page' WHERE id = ${postId}`;
        console.log(`\n↩️  Không đăng được Page — trả bài ${postId} về 'ready_for_page' để thử lại.\n`);
      }
    }

    console.log(`\n🎉 Hoàn tất Đăng Page (${successCount > 0 ? 'THÀNH CÔNG' : 'THẤT BẠI'}). Sang bài tiếp theo...`);
    await browser.close();
    return true;
  }

  // ===== ĐÍCH = NHÓM: đăng lên các nhóm ĐÍCH của bài (chỉ nhóm ĐANG BẬT trong DB) =====
  let groupUrls = [];
  if (targetGroupIdsRaw) {
    // getGroupUrlsByIds đã lọc active=1 → nhóm đã tắt sẽ KHÔNG được đăng.
    try { groupUrls = await getGroupUrlsByIds(JSON.parse(targetGroupIdsRaw)); } catch {}
  }
  if (!groupUrls.length && pageCfg) groupUrls = await getActiveGroupUrlsForPage(pageCfg.id);
  // CHỈ fallback về config.js khi CHƯA có Page trong DB (chế độ legacy).
  // Nếu đã dùng DB mà không nhóm nào bật → KHÔNG đăng nhóm nào (tôn trọng việc tắt nhóm).
  if (!groupUrls.length && !pageCfg) groupUrls = GROUPS;

  if (groupUrls.length === 0) {
    console.log('⚪ Không có nhóm nào đang bật cho bài này — bỏ qua đăng nhóm (đánh dấu xong).');
    if (postId && sql) await sql`UPDATE posts SET status = 'groups_posted' WHERE id = ${postId}`;
    await browser.close();
    return true;
  }

  console.log(`👥 Đăng vào ${groupUrls.length} nhóm (tư cách ${pageName}).`);

  for (const groupUrl of groupUrls) {
    try {
      const spunContent = await spinContent(content);
      // Bọc timeout 4 phút: nếu một nhóm bị kẹt (vd đích đến không phải group,
      // UI đổi, mất mạng...) thì ném lỗi để nhảy sang nhóm sau thay vì treo mãi.
      await withTimeout(
        postToGroup(page, groupUrl, spunContent, imagePathLocal, pageName),
        4 * 60 * 1000,
        `đăng nhóm ${groupUrl}`,
      );
      successCount++;
    } catch (err) {
      console.error(`❌ Lỗi nhóm ${groupUrl}:`, err.message);
      try {
        fs.mkdirSync('screenshots', { recursive: true });
        await page.screenshot({ path: `screenshots/error-${Date.now()}.png` });
      } catch {}
    }

    if (groupUrls.indexOf(groupUrl) < groupUrls.length - 1) {
      const waitMin = 60; // 1 phút
      const waitMax = 300; // 5 phút
      const wait = waitMin + Math.random() * (waitMax - waitMin);
      console.log(`   ⏳ Chờ ${Math.round(wait)}s trước nhóm tiếp theo...`);
      await delay(wait, wait + 10);
    }
  }

  // Cập nhật DB (bài đang ở trạng thái tạm 'groups_posting' do đã CLAIM ở trên)
  if (postId && sql) {
    if (successCount > 0) {
      await sql`UPDATE posts SET status = 'groups_posted' WHERE id = ${postId}`;
      console.log(`\n✅ Cập nhật DB: bài ${postId} → groups_posted\n`);
    } else {
      // Không nhóm nào thành công → CHƯA đăng gì → trả về hàng đợi để thử lại sau.
      await sql`UPDATE posts SET status = 'ready_for_groups' WHERE id = ${postId}`;
      console.log(`\n↩️  Không đăng được nhóm nào — trả bài ${postId} về 'ready_for_groups' để thử lại.\n`);
    }
  }

  console.log(`\n🎉 Hoàn tất! ${successCount}/${groupUrls.length} nhóm thành công. Sàng lọc sang bài tiếp theo...`);
  await browser.close();
  return true;
}

async function uploadReelsGraphAPI(videoPath, description, scheduledTime) {
  const token = process.env.FACEBOOK_ACCESS_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;
  if (!token || !pageId) throw new Error("Chưa có FACEBOOK_ACCESS_TOKEN hoặc PAGE_ID để up Reels");

  console.log("   👉 1. Khởi tạo phiên Upload Reels...");
  const initRes = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${pageId}/video_reels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ upload_phase: 'start', access_token: token })
  });
  const initData = await initRes.json();
  if (!initData.video_id) throw new Error("Lỗi khởi tạo Reels: " + JSON.stringify(initData));

  console.log("   👉 2. Bắn file MP4 lên Mây nhà Zucc (Offset: 0)...");
  const stats = fs.statSync(videoPath);
  const videoBuffer = fs.readFileSync(videoPath);
  
  await fetch(initData.upload_url, {
    method: 'POST',
    headers: {
      'Authorization': `OAuth ${token}`,
      'offset': '0',
      'file_size': stats.size.toString(),
      'Content-Type': 'application/octet-stream'
    },
    body: videoBuffer
  });

  console.log("   👉 3. Publish Reels lên Page...");
  const finishPayload = {
    upload_phase: 'finish',
    video_id: initData.video_id,
    description: description,
    access_token: token,
    video_state: scheduledTime ? 'SCHEDULED' : 'PUBLISHED'
  };
  
  if (scheduledTime) {
    // Đảm bảo hẹn giờ cách hiện tại > 15 phút theo chuẩn Meta 
    const minTime = Math.floor(Date.now() / 1000) + 16 * 60;
    finishPayload.scheduled_publish_time = Math.max(scheduledTime, minTime);
  }

  const finishRes = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${pageId}/video_reels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(finishPayload)
  });
  const finishData = await finishRes.json();
  if (finishData.success) {
    if (scheduledTime) {
      console.log(`   ✅ SẮC NÉT! Đã chốt sổ Reels LÊN LỊCH THÀNH CÔNG (Sẽ xuất hiện đúng khung giờ bạn hẹn).`);
    } else {
      console.log(`   ✅ SẮC NÉT! Đã chốt sổ Reels ĐĂNG NGAY (Khoảng 5 phút sau Video sẽ nổi trên Page do hệ thống cần xử lý HD).`);
    }
    return true;
  } else {
    console.log(`   ❌ Lỗi chốt Reels:`, finishData);
    return false;
  }
}

// Hàm AI tự động Tóm tắt nội dung dài sang Kịch bản Video giật gân, Không xưng ngôi, Trân thuật khách quan
async function rewriteForVideo(rawContent) {
  if (!process.env.LLM_API_KEY) {
    console.log("⚠️ Thiếu LLM_API_KEY, chuyển sang dùng Gemini...");
    return rewriteForVideoGemini(rawContent);
  }
  try {
    const result = await llmChatCompletion({
      messages: [{
        role: 'user',
        content: `Dựa vào bài viết sau, hãy viết hoàn thiện thành một KỊCH BẢN VIDEO REELS cực kỳ chi tiết, độ dài khoảng từ 1000 đến 1200 ký tự. BẮT BUỘC: \n- Đọc dạng thông báo giật gân, ngôi kể trần thuật khách quan.\n- Tuyệt đối KHÔNG có đại từ xưng hô, KHÔNG xưng tên (kể cả tên Phương, tôi, mình, chúng tôi).\n- LƯU Ý PHÁT ÂM: Nếu viết về Trí tuệ nhân tạo, BẮT BUỘC phải viết là "A.I". Tuyệt đối không viết là "AI" để tránh máy đọc nhầm. Còn chữ "ai" (chỉ người) thì vẫn viết bình thường.\n- Đảm bảo kịch bản hoàn chỉnh từ đầu đến cuối, không bị cắt cụt giữa chừng.\n- Không gạch đầu dòng, không in đậm, viết thành một khối văn liên tục, mạch lạc, cuốn hút.\n- Chia nội dung thành 8-10 câu ngắn để dễ hiển thị caption.\n\nNội dung gốc:\n${rawContent}`
      }],
      temperature: 0.7,
    });
    return result.trim().replace(/[*_#]/g, '');
  } catch(e) {
    console.log("⚠️ Lỗi LLM, dùng tạm Gemini...", e.message);
    return rewriteForVideoGemini(rawContent);
  }
}

async function rewriteForVideoGemini(rawContent) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) { console.error('Missing GEMINI_API_KEY'); return rawContent.substring(0, 500); }
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-2.0-flash'}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `Dựa vào bài viết sau, hãy viết lại thành một KỊCH BẢN VIDEO REELS dài từ 1200 đến 1600 ký tự. Đọc dạng thông báo giật gân, ngôi kể trần thuật khách quan. Không xưng hô. Viết liên tục không gạch đầu dòng.\n\nNội dung gốc:\n${rawContent}` }] }]
      })
    });
    const data = await res.json();
    return data.candidates[0].content.parts[0].text.trim().replace(/[*_#]/g, '');
  } catch(e) {
    return rawContent.substring(0, 500);
  }
}

async function checkAndProcessVideos() {
  if (!sql) return false;
  
  // Dùng ASC để xử lý tuần tự từ bài chọn trước tới bài chọn sau
  const posts = await sql`
    SELECT * FROM posts 
    WHERE create_video = true 
    AND video_status = 'pending'
    ORDER BY id ASC 
    LIMIT 1
  `;
  if (posts.length === 0) {
      if (!global.hasLoggedVideoQueue) {
        console.log('🕵️‍♂️ Hàng đợi Render Video đã được dọn sạch.');
        global.hasLoggedVideoQueue = true;
      }
      return false;
  }
  
  const post = posts[0];
  global.hasLoggedVideoQueue = false;
  console.log(`\n====== 🎬 PHÁT HIỆN LỆNH LÀM VIDEO CHO BÀI: ${post.id} ======`);
  
  try {
    // Trích xuất đúng câu Hook (câu đầu tiên có chữ)
    const lines = post.content.split('\n');
    let hook = lines.find(l => l.trim().length > 0) || 'Video AI Content';
    if (hook.length > 200) hook = hook.substring(0, 197) + '...'; // Tránh dài quá
    const description = `${hook}\n\n${post.hashtags}`;
    
    // Gọi AI bóp ngắn nội dung để phù hợp quay Video Tiktok siêu nhanh (Trần thuật, Không có tên)
    // Bóp kịch bản
    console.log("🎬 Đang đưa cho GPT-4o soạn lại Kịch bản Video ngắn giật gân (Trần thuật, Không xưng hô)...");
    const videoScript = await rewriteForVideo(post.content);
    console.log(`📝 KỊCH BẢN RÚT GỌN CHỐT HẠ CHO VIDEO:\n"${videoScript}"`);
    
    fs.writeFileSync('./video-maker/temp-text.txt', videoScript);
    
    // Template Stat Hero dùng gradient cố định, không cần background.jpg nữa
    
    console.log("🔄 Đang quất máy Render Stat Hero (Remotion + TTS)... Vui lòng chờ...");
    try {
      execSync('node render-cmd.js cli', { cwd: './video-maker', stdio: 'inherit' });
    } catch(renderErr) {
      console.error("❌ Máy Render hoặc TTS báo lỗi cứng. Hủy bỏ phiên này và đánh dấu lỗi!");
      await sql`UPDATE posts SET video_status = 'error' WHERE id = ${post.id}`;
      return true; // Để chạy bài khác
    }
    
    const outPath = './video-maker/out/video.mp4';
    if (fs.existsSync(outPath)) {
      console.log("🔄 Render MP4 thành công! Tiến hành đẩy lên kho Reels của Page...");
      const success = await uploadReelsGraphAPI(outPath, description, post.scheduled_time);
      if (success) {
        await sql`UPDATE posts SET video_status = 'completed' WHERE id = ${post.id}`;
      } else {
        await sql`UPDATE posts SET video_status = 'error' WHERE id = ${post.id}`;
      }
    }
    return true; // Báo hiệu đã làm xong 1 cái, bảo loop quét tiếp
  } catch (err) {
    console.log("❌ Lỗi đứt ruột trong quá trình Video:", err.message);
    await sql`UPDATE posts SET video_status = 'error' WHERE id = ${post.id}`;
    return true;
  }
}


async function startBot() {
  console.log("🤖 BOT NỀN ĐÃ KHỞI ĐỘNG CỰC MẠNH!");
  
  // DỌN RÁC THÔNG MINH – Chỉ xoá bài ĐÃ QUÁ GIỜ HẸN mà vẫn chưa chạy
  // KHÔNG XOÁ bài có scheduled_time trong tương lai (đang chờ đúng giờ)
  if (sql) {
    try {
      console.log('🧹 Đang kiểm tra bài tồn đọng...');
      const currentEpoch = Math.floor(Date.now() / 1000);
      const expiredThreshold = currentEpoch - 2 * 60 * 60; // Quá giờ hẹn 2 tiếng mới dọn
      
      // Video: Đừng xoá 'pending' vì nhỡ user vừa bấm tạo trên một bài báo đã cũ (thời gian cào created_at sinh ra lâu rồi).
      // Chỉ xoá 'error' nếu nó đã nghẽn quá lâu.
      const res1 = await sql`
        UPDATE posts SET video_status = 'completed' 
        WHERE video_status = 'error' 
        AND (scheduled_time IS NULL OR scheduled_time < ${expiredThreshold})
        AND EXTRACT(EPOCH FROM created_at) < ${currentEpoch - 15 * 60}
        RETURNING id
      `;
      
      // Groups: Chỉ xoá bài ready_for_groups mà KHÔNG có lịch hẹn tương lai
      const res2 = await sql`
        UPDATE posts SET status = 'groups_posted' 
        WHERE status = 'ready_for_groups' 
        AND (scheduled_time IS NULL OR scheduled_time < ${expiredThreshold})
        AND EXTRACT(EPOCH FROM created_at) < ${currentEpoch - 15 * 60}
        RETURNING id
      `;
      
      // Đếm bài đang chờ đúng giờ
      const waiting = await sql`
        SELECT COUNT(*) as cnt FROM posts 
        WHERE (status = 'ready_for_groups' OR (create_video = true AND video_status = 'pending'))
        AND scheduled_time IS NOT NULL AND scheduled_time > ${currentEpoch}
      `;
      const waitingCount = Number(waiting[0]?.cnt || 0);
      
      if (res1.length > 0 || res2.length > 0) {
        console.log(`🗑️  Đã dọn ${res1.length} video + ${res2.length} bài nhóm QUÁ HẠN.`);
      }
      if (waitingCount > 0) {
        console.log(`⏰ Đang giữ ${waitingCount} bài CÓ LỊCH HẸN trong tương lai – sẽ chạy đúng giờ!`);
      }
      if (res1.length === 0 && res2.length === 0 && waitingCount === 0) {
        console.log('✨ Không có bài tồn đọng nào.');
      }
    } catch(e) {}
  }
  
  // Khóa chống chạy chồng: nếu chu kỳ trước chưa xong, bỏ qua chu kỳ mới
  // để tránh 2 vòng cùng nhặt 1 bài ready_for_groups và ĐĂNG TRÙNG nhiều lần.
  let isLoopRunning = false;

  const loop = async () => {
    if (isLoopRunning) {
      console.log('⏭️  Chu kỳ trước còn đang chạy — bỏ qua lượt này để tránh đăng trùng.');
      return;
    }
    isLoopRunning = true;
    try {
      let isVideoProcessing = true;
      let isGroupProcessing = true;

      while (isVideoProcessing) {
        isVideoProcessing = await checkAndProcessVideos();
      }

      while (isGroupProcessing) {
        isGroupProcessing = await main();
      }

    } catch (err) {
      console.error('💥 Lỗi không mong đợi trong quá trình quét:', err.message);
    } finally {
      isLoopRunning = false;
    }
  };

  // Chạy luôn lần đầu
  await loop();
  // Treo lặp lại mỗi 1 phút (60000ms) thay vì 10 phút để bot bắt bài mới nhanh hơn
  setInterval(loop, 1 * 60 * 1000);
}

startBot();
