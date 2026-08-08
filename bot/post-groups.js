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
const { getPageById, getGroupUrlsByIds, getActiveGroupUrlsForPage } = require('./lib/config-db');
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
async function switchToPageIdentity(page, pageName = PAGE_NAME) {
  // Nếu composer đã sẵn → đang ở tư cách Trang rồi, bỏ qua.
  try {
    await page.locator('[aria-label*="Bạn đang nghĩ gì"], [aria-label*="What\'s on your mind"]')
      .first().waitFor({ timeout: 4000 });
    console.log('   ✅ Đang ở tư cách Trang (composer sẵn sàng).');
    return true;
  } catch {}

  // Thử lần lượt các nút chuyển tư cách Trang (banner onboarding + nút ở khung hồ sơ).
  const switchSelectors = [
    'div[role="button"]:has-text("Chuyển ngay")',
    `div[role="button"]:has-text("Chuyển thành ${pageName}")`,
    `div[role="button"][aria-label*="${pageName}"]:has-text("Chuyển")`,
    'div[role="button"]:has-text("Chuyển")',
  ];
  for (const sel of switchSelectors) {
    try {
      const el = page.locator(sel).first();
      await el.waitFor({ timeout: 5000 });
      await el.click();
      console.log(`   🔄 Đã bấm chuyển sang tư cách Trang.`);
      await delay(4, 7); // chờ FB tải lại giao diện Trang
      return true;
    } catch {}
  }
  console.log('   ⚠️ Không tìm thấy nút chuyển tư cách Trang — sẽ thử mở composer trực tiếp.');
  return false;
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

  // Mở composer của Page
  const composerSelectors = [
    '[aria-label*="Bạn đang nghĩ gì"]',
    '[aria-label*="What\'s on your mind"]',
    '[aria-label*="Tạo bài viết"]',
    '[aria-label*="Create a post"]',
    'div[role="button"]:has-text("Bạn đang nghĩ gì")',
    'div[role="button"]:has-text("What\'s on your mind")',
    'div[role="button"]:has-text("Viết bài")',
    'span:has-text("Bạn đang nghĩ gì")',
    'span:has-text("What\'s on your mind")',
  ];

  let opened = false;
  for (const selector of composerSelectors) {
    try {
      const el = page.locator(selector).first();
      await el.waitFor({ timeout: 10000 });
      await el.click();
      opened = true;
      console.log(`   ✅ Mở composer Page bằng: ${selector}`);
      break;
    } catch {}
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

async function main() {
  // Lấy bài cần đăng từ DB
  let content = '';
  let postId = null;
  let imagePathLocal = null;
  let dest = 'groups';                 // đích đến: 'page' hoặc 'groups'
  let revertStatus = 'ready_for_groups'; // trạng thái để trả bài về khi thoát sớm/thất bại
  let pageCfg = null;                  // cấu hình Page đích (name/url/cookies) từ DB
  let targetGroupIdsRaw = null;        // JSON mảng id nhóm đích của bài

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
    }
    if (posts.length === 0) {
      if (!global.hasLoggedGroupsQueue) {
        console.log('⏳ Chưa có bài nào tới lịch Đăng Page/Nhóm (hoặc đang chờ tới giờ hẹn).');
        global.hasLoggedGroupsQueue = true;
      }
      return false;
    }
    const post = posts[0];
    global.hasLoggedGroupsQueue = false;
    postId = post.id;
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

  // Cookie (từ DB theo Page, hoặc file) — CHỈ dùng để "bootstrap" lần đầu nếu profile
  // chưa đăng nhập. Không bắt buộc: profile cố định mới là nguồn phiên chính.
  let rawCookies = pageCfg?.cookies || null;
  if (!rawCookies && fs.existsSync('cookies.json')) {
    try { rawCookies = JSON.parse(fs.readFileSync('cookies.json', 'utf8')); } catch {}
  }
  const cookies = (rawCookies || []).map(c => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path || '/',
    expires: c.expirationDate || -1,
    httpOnly: c.httpOnly || false,
    secure: c.secure || false,
    sameSite: 'None',
  }));

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
  const isLoggedOut = async () => {
    const u = page.url();
    if (u.includes('login') || u.includes('checkpoint') || u.includes('/recover')) return true;
    try {
      return await page.locator('input[name="pass"], input[type="password"], form[action*="login"]')
        .first().isVisible({ timeout: 3000 }).catch(() => false);
    } catch { return false; }
  };

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
