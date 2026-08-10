# Hướng dẫn Cài đặt & Chạy ứng dụng

Tài liệu này hướng dẫn chi tiết cách cài đặt, cấu hình và chạy hệ thống **Marketing Automation** — pipeline tự động hóa content marketing: *Thu thập tin → Viết bài bằng AI → Render video → Đăng Facebook*.

---

## 1. Yêu cầu hệ thống

| Thành phần | Yêu cầu | Ghi chú |
|-----------|---------|---------|
| **Node.js** | >= 18 (khuyến nghị 20 LTS) | Next.js 16 yêu cầu Node 18.18+ |
| **npm** | Đi kèm Node.js | Có thể dùng pnpm/yarn nếu muốn |
| **Git** | Bất kỳ | Để clone mã nguồn |
| **Neon Postgres** | Tài khoản miễn phí | Database serverless — [neon.tech](https://neon.tech) |
| **FFmpeg** | (Tùy chọn) | Chỉ cần khi render video Reels |

> Ứng dụng gồm **3 phần độc lập**: web app chính (`/`), bot đăng Facebook Groups (`bot/`), và module render video (`bot/video-maker/`). Bạn có thể chỉ cài phần web app để bắt đầu.

---

## 2. Cài đặt web app chính

### 2.1. Tải mã nguồn & cài dependency

```bash
git clone https://github.com/dongphuongman/Post-Automation.git
cd Post-Automation
npm install
```

### 2.2. Tạo file cấu hình môi trường

Sao chép file mẫu `.env.example` thành `.env.local`:

```bash
cp .env.example .env.local
```

Sau đó mở `.env.local` và điền các giá trị (xem chi tiết ở **Mục 4**).

### 2.3. Chạy ứng dụng

```bash
npm run dev        # Chạy chế độ dev tại http://localhost:3000
```

Các lệnh khác:

```bash
npm run build      # Build bản production
npm run start      # Chạy bản production đã build
npm run lint       # Kiểm tra lint
```

Mở trình duyệt tại **http://localhost:3000** để bắt đầu.

---

## 3. Khởi tạo Database

**Không cần chạy migration thủ công.** Database tự khởi tạo:

- Ở lần gọi API đầu tiên (mở trang chính hoặc đăng nhập), hàm `initDb()` tự tạo **7 bảng**: `sources`, `articles`, `posts`, `facebook_pages`, `facebook_groups`, `app_config` (lưu secret mã hóa), `users`.
- `initDb()` cũng **seed sẵn một tài khoản admin** (xem Mục 3.1).
- Hàm `seedDb()` thêm sẵn 6 nguồn RSS mặc định (TechCrunch, NFX, Indie Hackers, a16z, Crunchbase News, TechStartups).

Bạn chỉ cần đảm bảo biến `POSTGRES_URL` trong `.env.local` trỏ đúng tới database Neon còn hoạt động.

> **Lấy connection string:** Đăng nhập [Neon Console](https://console.neon.tech) → tạo project → copy chuỗi kết nối dạng `postgresql://user:password@host/dbname` vào biến `POSTGRES_URL`.

### 3.1. Đăng nhập lần đầu & tài khoản admin

Hệ thống có xác thực đa người dùng. Tài khoản admin được seed tự động:

```
Email:    admin@local
Password: admin123
```

- ⚠️ **Đổi mật khẩu ngay** sau khi đăng nhập tại trang **`/profile`**.
- Tạo thêm người dùng, phân quyền (`admin` / `user`) tại **`/manage/users`** (chỉ admin).
- Mỗi người dùng chỉ thấy dữ liệu của mình (`owner_id`); admin thấy tất cả.

Đăng nhập yêu cầu biến `APP_ENCRYPTION_KEY` đã được đặt (dùng để ký session) — xem Mục 4.

---

## 4. Cấu hình biến môi trường (`.env.local`)

### 4.1. Bắt buộc

```env
# Database — Neon Postgres (bắt buộc)
POSTGRES_URL=postgresql://user:password@host/dbname

# Khóa mã hóa (BẮT BUỘC) — mã hóa secret trong DB (AES-256-GCM) + ký session đăng nhập
# Sinh 1 lần rồi GIỮ CỐ ĐỊNH:  openssl rand -hex 32
APP_ENCRYPTION_KEY=

# Nhà cung cấp LLM: "openai" (mặc định) hoặc "anthropic"
LLM_PROVIDER=openai

# Cấu hình LLM (bắt buộc để viết bài bằng AI — có thể đặt ở /manage/settings thay vì đây)
LLM_BASE_URL=https://api.openai.com/v1     # Bỏ trống nếu dùng Anthropic
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o
```

> 💡 **Mẹo:** Phần lớn secret (LLM, image, Facebook, scraping) có thể cấu hình ngay trong giao diện **`/manage/settings`** — được lưu **mã hóa** trong DB (bảng `app_config`). Khi đó `.env` chỉ cần `POSTGRES_URL` và `APP_ENCRYPTION_KEY`; các biến còn lại chỉ là phương án dự phòng.

### 4.2. Tùy chọn

```env
# Sinh ảnh minh họa — mặc định dùng LLM_API_KEY nếu không set riêng
# IMAGE_BASE_URL=https://api.openai.com/v1
# IMAGE_API_KEY=sk-...
# IMAGE_MODEL=dall-e-3

# TTS lồng tiếng cho video Reels (hiện chỉ hỗ trợ OpenAI)
OPENAI_API_KEY=sk-...

# Gemini — dùng làm phương án dự phòng khi LLM chính lỗi
# GEMINI_API_KEY=
# GEMINI_MODEL=gemini-2.0-flash

# Thu thập tin từ mạng xã hội (X/Twitter, Instagram)
RAPID_API_KEY=
BRAVE_API_KEY=

# Đăng Facebook (Graph API v21.0)
FACEBOOK_PAGE_ID=
FACEBOOK_ACCESS_TOKEN=
FACEBOOK_USER_TOKEN=
```

### 4.3. Bảng tra cứu các biến

| Biến | Bắt buộc | Mô tả |
|------|:--------:|-------|
| `POSTGRES_URL` | ✅ | Chuỗi kết nối Neon Postgres |
| `APP_ENCRYPTION_KEY` | ✅ | Khóa mã hóa secret trong DB + ký session. **Giữ cố định** — đổi = hỏng hết secret & session |
| `LLM_PROVIDER` | ✅ | `openai` (mặc định) hoặc `anthropic` |
| `LLM_API_KEY` | ✅ | API key của nhà cung cấp LLM |
| `LLM_BASE_URL` | ⚠️ | Bắt buộc với OpenAI-compatible; **không cần** với Anthropic |
| `LLM_MODEL` | ⚠️ | Model dùng để viết bài (vd `gpt-4o`) |
| `OPENAI_API_KEY` | ❌ | Cần khi lồng tiếng TTS cho video |
| `IMAGE_*` | ❌ | Cấu hình riêng cho sinh ảnh; mặc định dùng LLM |
| `GEMINI_*` | ❌ | Fallback khi LLM chính lỗi |
| `RAPID_API_KEY`, `BRAVE_API_KEY` | ❌ | Thu thập tin từ mạng xã hội & tìm kiếm |
| `FACEBOOK_*` | ❌ | Đăng bài lên Facebook Page/Group |

---

## 5. Chọn nhà cung cấp LLM

Chuyển đổi provider chỉ bằng biến `LLM_PROVIDER`, **không cần sửa code**.

### OpenAI (mặc định)

```env
LLM_PROVIDER=openai
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o
```

### Anthropic Claude

```env
LLM_PROVIDER=anthropic
LLM_API_KEY=sk-ant-...
LLM_MODEL=claude-sonnet-4-20250514
```

### Các provider OpenAI-compatible khác

| Provider | `LLM_BASE_URL` | Model ví dụ |
|----------|----------------|-------------|
| Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |
| Together | `https://api.together.xyz/v1` | `meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo` |
| Ollama (local) | `http://localhost:11434/v1` | `llama3.1` |

> Lưu ý: Sinh ảnh (Image) và TTS vẫn dùng OpenAI riêng qua `OPENAI_API_KEY`, độc lập với LLM viết bài.

---

## 6. Cài đặt Bot đăng Facebook Groups (tùy chọn)

Bot là một **tiến trình daemon chạy nền** dùng Playwright để đăng bài vào Facebook Groups dưới danh nghĩa Page, đồng thời render & đăng video Reels. Nó poll database mỗi **60 giây**, nhặt các bài theo trạng thái trong hàng đợi.

```bash
cd bot
npm install
npm run install-browser      # Cài trình duyệt Chromium cho Playwright
```

Bot dùng chung database với web app, nên cần biến kết nối DB — chấp nhận `DATABASE_URL` **hoặc** `POSTGRES_URL` (đặt trong file `.env` của thư mục `bot/` hoặc biến môi trường hệ thống — bot nạp qua `dotenv`). Bot dùng chung `APP_ENCRYPTION_KEY` để giải mã cookie/token Page đã lưu, nên key này **phải giống hệt** web app.

**Đăng nhập Facebook (chạy một lần trước khi bot làm việc):**

```bash
npm run login        # Mở Chromium (không headless) → tự đăng nhập Facebook thủ công
```

Cửa sổ Chromium mở ra profile cố định tại `bot/fb-profile/`. Đăng nhập Facebook (qua mọi bước xác minh), rồi đóng cửa sổ — phiên đăng nhập được lưu lại để bot chạy dưới danh nghĩa tài khoản đó.

> ⚠️ Không chạy `login` khi bot đang chạy: cả hai dùng chung một profile.

**Cơ chế hàng đợi:** web app đặt bài sang trạng thái `ready_for_<đích>` (kèm `scheduled_time`), bot nhặt, chuyển sang `<đích>_posting` rồi `posted` (hoặc `groups_posted`); nếu lỗi / không xác nhận đăng được sẽ trả về `ready_*` để thử lại. Các đích: `page`, `groups`, `profile` (Facebook cá nhân), `x`, `threads`, `instagram`. **Threads** đăng qua Graph API (không mở trình duyệt); **X / Instagram / cá nhân** mở phiên Chromium ephemeral nạp cookie riêng của chủ bài. Video Reels đi theo cột `video_status`: `pending → completed`.

Các lệnh có sẵn:

```bash
npm run post          # Chạy bot daemon (node post-groups.js) — loop mỗi 60s
npm run login         # Đăng nhập Facebook thủ công (lưu vào bot/fb-profile/)
npm run check-db      # Kiểm tra 5 bài đăng gần nhất trong DB
npm run fix-db        # Sửa/đồng bộ schema DB
npm run flush         # Xóa dữ liệu (dùng thận trọng)
```

---

## 7. Cài đặt Module Render Video (tùy chọn)

Module dùng **Remotion** để render video Reels tự động.

```bash
cd bot/video-maker
npm install
```

Lệnh có sẵn:

```bash
npm run start         # Mở Remotion Studio để xem/chỉnh video
npm run build         # Render video ra out/video.mp4
```

Tham khảo file `bot/video-maker/render-cmd.js` để biết cách truyền tham số render.

> Yêu cầu **FFmpeg** cài trên máy để render. Trên macOS: `brew install ffmpeg`.

---

## 8. Quy trình sử dụng (3 bước)

Sau khi chạy `npm run dev` và mở http://localhost:3000:

0. **Đăng nhập** — dùng `admin@local` / `admin123` (đổi mật khẩu ngay ở `/profile`).
1. **Thu thập tin** — Bấm thu thập để crawl tin tức từ RSS / Brave Search / RapidAPI theo nguồn.
2. **Chọn & Viết bài** — Chọn tin, AI viết bài theo giọng văn (format POV / News), tự sinh ảnh minh họa.
3. **Duyệt & Đăng** — Duyệt nội dung rồi đăng **Facebook (Page / Group / Reels / cá nhân)** hoặc **X / Threads / Instagram** (đăng ngay hoặc hẹn lịch), kèm video Reels nếu cần. Ảnh AI lỗi có thể bấm **🔄 Tạo lại ảnh** ngay trên thẻ bài. Lưu ý: **Instagram bắt buộc có ảnh**; X cắt ≤ 280 ký tự, Threads ≤ 500, Instagram ≤ 2200.

> 🔗 **Kết nối tài khoản trước khi đăng cá nhân/X/Threads/IG:** vào `/manage/account` dán cookie Facebook cá nhân, và `/manage/social` dán cookie X (`auth_token`+`ct0`) / Instagram (`sessionid`) / access token Threads. Mỗi người dùng kết nối tài khoản của **chính mình**; nếu chưa kết nối (hoặc cookie hết hạn) bot sẽ trả bài về hàng đợi kèm log rõ.

### 8.1. Trang quản trị (`/manage/*`)

| Trang | Chức năng |
|-------|-----------|
| `/manage/sources` | Quản lý nguồn thu thập tin (RSS / social) |
| `/manage/pages` | Quản lý Facebook Page — lưu access token & cookie (mã hóa) |
| `/manage/groups` | Quản lý Facebook Group gắn với Page |
| `/manage/account` | Kết nối **Facebook cá nhân** của bạn (cookie, mã hóa) để đăng lên tường cá nhân |
| `/manage/social` | Kết nối **X · Threads · Instagram** của bạn (cookie/token, mã hóa) |
| `/manage/settings` | Cấu hình secret hệ thống (LLM, image, scraping…) lưu mã hóa trong DB — **chỉ admin** |
| `/manage/users` | Quản lý người dùng & phân quyền — **chỉ admin** |
| `/dashboard` | Theo dõi hàng đợi bot: số bài theo trạng thái, bài gần đây |

> Nhờ có `/manage/settings`, bạn có thể đổi khóa LLM/Facebook mà không cần sửa `.env` hay khởi động lại — secret được lưu mã hóa bằng `APP_ENCRYPTION_KEY`.

---

## 9. Xử lý sự cố thường gặp

| Triệu chứng | Nguyên nhân & cách xử lý |
|-------------|--------------------------|
| Cảnh báo `POSTGRES_URL is not defined` | Chưa cấu hình `POSTGRES_URL` trong `.env.local`. Thêm chuỗi kết nối Neon. |
| Lỗi liên quan `APP_ENCRYPTION_KEY` / không giải mã được secret | Chưa đặt `APP_ENCRYPTION_KEY`, hoặc đã đổi key sau khi lưu secret. Đặt key và **giữ cố định**; nếu lỡ đổi, phải nhập lại secret ở `/manage/settings`. |
| Đăng nhập không được / bị đăng xuất liên tục | `APP_ENCRYPTION_KEY` thay đổi khiến session cũ vô hiệu. Đăng nhập lại; giữ key cố định. Quên mật khẩu admin? Xóa/khôi phục hàng `users` để `initDb()` seed lại `admin@local`. |
| Không viết được bài / lỗi LLM | Kiểm tra `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL` (trong `.env` hoặc `/manage/settings`). |
| Không thu thập được tin mạng xã hội | Cần điền `RAPID_API_KEY` và/hoặc `BRAVE_API_KEY`. |
| Không đăng được Facebook Page | Kiểm tra Page ở `/manage/pages` (token/cookie) hoặc `FACEBOOK_*` trong `.env`. |
| Bot không đăng Group / không nhặt bài | Đảm bảo bot đang chạy (`npm run post`), đã `npm run login`, dùng cùng DB + cùng `APP_ENCRYPTION_KEY` với web app, và bài đã ở trạng thái `ready_for_groups` với `scheduled_time` đã đến hạn. |
| Không đăng được X / Threads / Instagram / cá nhân | Chủ bài chưa kết nối tài khoản ở `/manage/social` (hoặc `/manage/account`), hoặc cookie/token đã hết hạn/bị checkpoint → bot trả bài về `ready_for_*`. Kết nối lại cookie/token mới. **Instagram**: bài phải có ảnh. **Threads**: cần access token (không phải cookie) và ảnh phải là URL public. Xem ảnh chụp lỗi trong `bot/screenshots/`. |
| Bài đăng lên Page/Group nhưng **thiếu ảnh** | Ảnh phải nằm ở `selected_image_url`/`generated_image_url`/`original_image_url`. Nếu ảnh AI lỗi (ô "AI tạo" trống), bấm **🔄 Tạo lại ảnh** ở bước 3. Bot chạy trong CWD có quyền ghi thư mục `screenshots/`. |
| Bot Playwright báo thiếu trình duyệt | Chạy `npm run install-browser` trong thư mục `bot/`. |
| Render video lỗi | Cài FFmpeg và chạy `npm install` trong `bot/video-maker/`. |
| Bảng DB chưa có | Gọi API bất kỳ (mở trang chính / đăng nhập) để `initDb()` tự tạo 7 bảng. |

---

## 10. Tham khảo thêm

- **README.md** — Tổng quan dự án, tech stack, cấu trúc thư mục.
- **docs/DEPLOY-COOLIFY.md** — Triển khai lên Coolify qua Docker / Docker Compose; chạy bot headless (Playwright + Xvfb) và đăng nhập Facebook qua VNC.
- **docs/huong-dan-su-dung.html** — Hướng dẫn sử dụng giao diện (tiếng Việt).
