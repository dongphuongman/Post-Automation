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

- Khi ứng dụng gọi API `research` hoặc `stats` (ví dụ: lần đầu mở trang chính hoặc bấm "Thu thập tin"), hàm `initDb()` sẽ tự động tạo 3 bảng: `sources`, `articles`, `posts`.
- Hàm `seedDb()` tự động thêm sẵn 6 nguồn RSS mặc định (TechCrunch, NFX, Indie Hackers, a16z, Crunchbase News, TechStartups).

Bạn chỉ cần đảm bảo biến `POSTGRES_URL` trong `.env.local` trỏ đúng tới database Neon còn hoạt động.

> **Lấy connection string:** Đăng nhập [Neon Console](https://console.neon.tech) → tạo project → copy chuỗi kết nối dạng `postgresql://user:password@host/dbname` vào biến `POSTGRES_URL`.

---

## 4. Cấu hình biến môi trường (`.env.local`)

### 4.1. Bắt buộc

```env
# Database — Neon Postgres (bắt buộc)
POSTGRES_URL=postgresql://user:password@host/dbname

# Nhà cung cấp LLM: "openai" (mặc định) hoặc "anthropic"
LLM_PROVIDER=openai

# Cấu hình LLM (bắt buộc để viết bài bằng AI)
LLM_BASE_URL=https://api.openai.com/v1     # Bỏ trống nếu dùng Anthropic
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o
```

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

Bot dùng Playwright để đăng bài vào Facebook Groups dưới danh nghĩa Page.

```bash
cd bot
npm install
npm run install-browser      # Cài trình duyệt Chromium cho Playwright
```

Bot dùng chung database với web app, nên cần biến `POSTGRES_URL` (đặt trong file `.env` của thư mục `bot/` hoặc biến môi trường hệ thống — bot nạp qua `dotenv`).

Các lệnh có sẵn:

```bash
npm run post          # Chạy bot đăng bài (node post-groups.js)
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

1. **Thu thập tin** — Bấm thu thập để crawl tin tức từ RSS / Brave Search / RapidAPI theo nguồn.
2. **Chọn & Viết bài** — Chọn tin, AI viết bài theo giọng văn (format POV / News), tự sinh ảnh minh họa.
3. **Duyệt & Đăng** — Duyệt nội dung rồi đăng Facebook Page/Group (đăng ngay hoặc hẹn lịch), kèm video Reels nếu cần.

---

## 9. Xử lý sự cố thường gặp

| Triệu chứng | Nguyên nhân & cách xử lý |
|-------------|--------------------------|
| Cảnh báo `POSTGRES_URL is not defined` | Chưa cấu hình `POSTGRES_URL` trong `.env.local`. Thêm chuỗi kết nối Neon. |
| Không viết được bài / lỗi LLM | Kiểm tra `LLM_API_KEY`, `LLM_MODEL`, và `LLM_BASE_URL` (với OpenAI-compatible). |
| Không thu thập được tin mạng xã hội | Cần điền `RAPID_API_KEY` và/hoặc `BRAVE_API_KEY`. |
| Không đăng được Facebook | Kiểm tra `FACEBOOK_PAGE_ID`, `FACEBOOK_ACCESS_TOKEN`, `FACEBOOK_USER_TOKEN`. |
| Bot Playwright báo thiếu trình duyệt | Chạy `npm run install-browser` trong thư mục `bot/`. |
| Render video lỗi | Cài FFmpeg và chạy `npm install` trong `bot/video-maker/`. |
| Bảng DB chưa có | Gọi API `research`/`stats` (mở trang chính hoặc bấm "Thu thập tin") để tự tạo bảng. |

---

## 10. Tham khảo thêm

- **README.md** — Tổng quan dự án, tech stack, cấu trúc thư mục.
- **docs/huong-dan-su-dung.html** — Hướng dẫn sử dụng giao diện (tiếng Việt).
