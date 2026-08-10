# Marketing Automation

**Pipeline tự động hóa content marketing: Thu thập tin &rarr; Viết bài bằng AI &rarr; Render video &rarr; Đăng Facebook.**

Hệ thống đa người dùng (multi-user), có đăng nhập & phân quyền, cấu hình chạy được từ giao diện — không phải sửa file `.env` mỗi lần đổi khóa.

---

## Tổng quan

Pipeline 3 bước khép kín cho content creator và marketer:

1. **Thu thập tin** &mdash; Crawl tin từ RSS, Brave Search và RapidAPI (X/Twitter, Instagram) theo nguồn cấu hình sẵn.
2. **Chọn & Viết bài** &mdash; AI viết bài tiếng Việt theo giọng văn cá nhân (format **POV** hoặc **News**), tự sinh ảnh minh họa.
3. **Duyệt & Đăng** &mdash; Duyệt/chỉnh nội dung rồi đăng lên **Facebook (Page / Group / Reels / Trang cá nhân)** và **X · Threads · Instagram**, đăng ngay hoặc hẹn lịch, kèm video Reels tự render. Ảnh minh họa có thể **tạo lại** ngay trên thẻ bài nếu lần sinh đầu lỗi.

Ngoài pipeline chính, hệ thống còn có:

- **Đăng nhập & phân quyền** (`admin` / `user`) — mỗi người dùng chỉ thấy dữ liệu của mình; admin thấy tất cả.
- **Kết nối tài khoản cá nhân** — `/manage/account` (Facebook cá nhân) và `/manage/social` (X · Threads · Instagram): mỗi người dùng dán cookie/token của **chính mình**, lưu **mã hóa** trong DB; bot đăng dưới danh nghĩa tài khoản đó qua phiên trình duyệt riêng (ephemeral).
- **Trang quản trị** `/manage/*` — cấu hình Nguồn tin, Facebook Page/Group, người dùng và **secret hệ thống ngay trong DB** (không cần sửa `.env`).
- **Bot daemon** (`bot/`) — tiến trình chạy nền, tự đăng Facebook Group / Trang cá nhân + **X · Instagram** (Playwright) và **Threads** (API), render/đăng video Reels theo hàng đợi trạng thái trong DB.

## Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 18, TypeScript |
| Database | Neon Postgres (serverless) |
| Auth | Tự xây: mật khẩu scrypt, session ký HMAC (cookie `mkt_session`) |
| Mã hóa | AES-256-GCM cho secret trong DB (`app_config`, token/cookie Page) |
| AI / LLM | Đa provider: OpenAI, Anthropic Claude, Groq, Together, Ollama |
| Image Gen | DALL-E 3 hoặc provider tương thích |
| Video | Remotion + FFmpeg, OpenAI TTS |
| Social | Facebook Graph API v21.0 · Threads Graph API · Playwright automation (Group / cá nhân · X · Instagram) |
| Scraping | Brave Search API, RapidAPI, RSS Parser |
| Deploy | Docker (web `standalone` + bot Playwright/Xvfb), Coolify (self-host) |

## Cài đặt nhanh

> 📖 **Hướng dẫn cài đặt & chạy chi tiết:** [docs/HUONG-DAN-CAI-DAT.md](docs/HUONG-DAN-CAI-DAT.md) ([bản HTML](docs/huong-dan-cai-dat.html)) — yêu cầu hệ thống, khởi tạo DB, đăng nhập lần đầu, cấu hình bot & video, xử lý sự cố.

```bash
git clone https://github.com/dongphuongman/Post-Automation.git
cd Post-Automation
npm install
cp .env.example .env.local   # rồi điền giá trị (xem bên dưới)
npm run dev                  # http://localhost:3000
```

### Đăng nhập lần đầu

Database tự khởi tạo ở lần gọi API đầu tiên và **seed sẵn một tài khoản admin**:

```
Email:    admin@local
Password: admin123
```

> ⚠️ Đổi mật khẩu ngay sau khi đăng nhập (trang `/profile`). Tạo thêm người dùng ở `/manage/users`.

### Cấu hình `.env.local`

Chỉ **2 biến là bắt buộc** để khởi động — phần lớn secret còn lại nên đặt trong giao diện `/manage/settings` (lưu mã hóa trong DB), `.env` chỉ là phương án dự phòng.

```env
# Bắt buộc
POSTGRES_URL=postgresql://user:password@host/dbname
APP_ENCRYPTION_KEY=            # openssl rand -hex 32 — GIỮ CỐ ĐỊNH, đổi = hỏng hết secret & session

# LLM (bắt buộc để viết bài — có thể đặt ở /manage/settings thay vì đây)
LLM_PROVIDER=openai            # "openai" (mặc định) hoặc "anthropic"
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o              # hoặc claude-sonnet-4-20250514

# Tùy chọn
OPENAI_API_KEY=sk-...         # TTS lồng tiếng cho video Reels (chỉ OpenAI)
# IMAGE_BASE_URL= / IMAGE_API_KEY= / IMAGE_MODEL=dall-e-3   # sinh ảnh; mặc định dùng LLM_API_KEY
# GEMINI_API_KEY= / GEMINI_MODEL=gemini-2.0-flash           # fallback khi trích xuất script video
RAPID_API_KEY=                # thu thập X/Twitter, Instagram
BRAVE_API_KEY=                # tìm kiếm bổ sung
FACEBOOK_PAGE_ID=             # fallback khi đăng Page (khuyến nghị cấu hình Page ở /manage/pages)
FACEBOOK_ACCESS_TOKEN=
FACEBOOK_USER_TOKEN=
```

> 🔑 Credential để đăng **Trang cá nhân Facebook, X, Threads, Instagram** KHÔNG đặt ở `.env` — mỗi người dùng tự kết nối tài khoản của mình tại `/manage/account` (cookie FB cá nhân) và `/manage/social` (cookie X/Instagram, access token Threads); tất cả lưu mã hóa trong DB.

## Triển khai (Docker / Coolify)

> 🚀 **Hướng dẫn deploy chi tiết:** [docs/DEPLOY-COOLIFY.md](docs/DEPLOY-COOLIFY.md) — deploy web app lên [Coolify](https://coolify.io) qua **Dockerfile** hoặc **Docker Compose**, chạy bot headless, đăng nhập FB qua VNC, và làm mới profile (không cần rebuild image).

- **Web app** — [`Dockerfile`](Dockerfile) (Next.js `output: "standalone"`, image gọn) + [`docker-compose.yml`](docker-compose.yml). DB dùng Neon Postgres bên ngoài (không cần container DB). Chạy sau HTTPS vì cookie `Secure` ở production.
- **Bot** — chạy được trên **Linux KHÔNG màn hình** nhờ [`bot/Dockerfile`](bot/Dockerfile) (image Playwright + **Xvfb** màn hình ảo), vẫn giữ `headless: false`. Đăng nhập Facebook trên server headless một lần qua **VNC** ([`bot/scripts/login-vnc.sh`](bot/scripts/login-vnc.sh)); profile lưu ở volume nên đổi profile không cần rebuild image.

```bash
# Web app
docker compose up -d                                   # hoặc để Coolify tự build Dockerfile

# Bot (Linux headless) — mount profile đã đăng nhập làm volume
docker build -f bot/Dockerfile -t mkt-bot ./bot
docker run -d --env-file .env.local -v mkt-fb-profile:/app/fb-profile mkt-bot
```

## Kiến trúc & luồng dữ liệu

```
Người dùng (đăng nhập)
   │
   ├─ /               Pipeline 3 bước: Research → Write → Review & Publish (tạo lại ảnh AI ở bước 3)
   ├─ /dashboard      Hàng đợi bot: đếm bài theo trạng thái, bài gần đây (tách Chưa đăng / Đã đăng)
   ├─ /manage/*       Sources · Pages · Groups · Account · Social · Users · Settings (secret trong DB)
   └─ /profile        Đổi tên / mật khẩu
        │
   Web app (Next.js)  ──►  Neon Postgres  ◄──  Bot daemon (Playwright + API)
   - viết bài (LLM)         posts.status         - poll mỗi 60s
   - sinh / tạo lại ảnh     = hàng đợi            - đăng Group / cá nhân / X / Instagram (trình duyệt)
   - đăng Page 'all' (Graph API)                  - đăng Threads (Graph API, không trình duyệt)
                                                  - render Reels (Remotion) → đăng
```

### Vòng đời trạng thái bài đăng (`posts.status`)

Web app đặt bài vào hàng đợi, bot nhặt theo trạng thái + `scheduled_time`; nếu lỗi/không xác nhận đăng được thì **trả về `ready_for_*` để thử lại** (không đánh dấu `posted` nhầm):

```
draft ─► ready_for_page      ─► page_posting      ─► posted          (Page — bot Playwright, profile cố định)
      ├► ready_for_groups    ─► groups_posting    ─► groups_posted   (Group — bot Playwright)
      ├► ready_for_profile   ─► profile_posting   ─► posted          (Facebook cá nhân — cookie riêng user)
      ├► ready_for_x         ─► x_posting         ─► posted          (X/Twitter — cookie riêng user)
      ├► ready_for_threads   ─► threads_posting   ─► posted          (Threads — access token, Graph API)
      └► ready_for_instagram ─► instagram_posting ─► posted          (Instagram — cookie riêng user, bắt buộc ảnh)
```

> Target `all` đăng Page ngay bằng **Graph API** (→ `posted`) đồng thời đẩy bài sang `ready_for_groups` cho bot. Video Reels đi theo cột riêng: `video_status` = `none → pending → completed` (hoặc `error`), gated bởi cờ `create_video`.

#### Đăng đa nền tảng — phương thức & giới hạn

| Nền tảng | Cách đăng | Credential (kết nối tại) | Ràng buộc |
|----------|-----------|--------------------------|-----------|
| Facebook Page | Bot Playwright (profile cố định `bot/fb-profile/`) | Page ở `/manage/pages` | — |
| Facebook Group | Bot Playwright (profile cố định) | Page/Group ở `/manage/{pages,groups}` | — |
| Facebook cá nhân | Bot Playwright (context ephemeral) | Cookie FB ở `/manage/account` | — |
| **X / Twitter** | Bot Playwright (context ephemeral) | Cookie `auth_token`+`ct0` ở `/manage/social` | Cắt **≤ 280** ký tự |
| **Threads** | **Graph API** (không trình duyệt) | Access token ở `/manage/social` | **≤ 500** ký tự; ảnh cần **URL public** (data-URI → đăng text-only) |
| **Instagram** | Bot Playwright (context ephemeral) | Cookie `sessionid` ở `/manage/social` | Caption **≤ 2200**; **bắt buộc có ảnh** |

> Bot xác nhận đăng thành công (toast X / màn "đã chia sẻ" IG) trước khi đánh `posted`; nếu không thấy tín hiệu → revert về `ready_for_*` kèm ảnh chụp lỗi trong `screenshots/`. Các phiên X/IG/cá nhân dùng cookie riêng của từng user nên dễ bị FB/X/IG yêu cầu checkpoint hơn profile cố định.

### Bảng dữ liệu (tự tạo qua `initDb()`)

`sources`, `articles`, `posts`, `facebook_pages`, `facebook_groups`, `facebook_accounts` (cookie FB cá nhân theo user), `social_accounts` (cookie/token X·Threads·Instagram theo user), `app_config` (secret mã hóa), `users`. Tất cả cookie/token đều mã hóa AES-256-GCM. `seedDb()` thêm 6 nguồn RSS mặc định (TechCrunch, NFX, Indie Hackers, a16z, Crunchbase News, TechStartups) và tài khoản admin.

## Cấu trúc dự án

```
src/
├── middleware.ts             # Gác auth mọi route + security headers + kiểm tra CSRF
├── app/
│   ├── api/                  # API routes (owner-scoped; settings/users chỉ admin)
│   │   ├── auth/{login,logout,me}/   # đăng nhập/đăng xuất/phiên hiện tại
│   │   ├── research/ write/          # crawl tin · AI viết bài + sinh ảnh
│   │   ├── articles/ posts/ stats/   # dữ liệu pipeline
│   │   ├── post-facebook/ ready-groups/  # đặt bài vào hàng đợi (Page/Group/cá nhân/X/Threads/IG)
│   │   ├── regenerate-image/         # tạo lại ảnh AI cho 1 bài (retry)
│   │   ├── account/ social-accounts/ # credential per-user: FB cá nhân · X/Threads/IG (mã hóa)
│   │   ├── dashboard/ image-proxy/   # hàng đợi bot · proxy ảnh (public)
│   │   ├── pages/ groups/ sources/   # CRUD cấu hình
│   │   └── settings/ users/          # quản trị (admin-only)
│   ├── login/ profile/ dashboard/    # trang xác thực & tổng quan
│   ├── manage/{sources,pages,groups,account,social,users,settings}/  # trang quản trị
│   └── page.tsx                      # pipeline 3 bước
├── components/{layout,pipeline}/     # Sidebar, Stepper · Step* + card (PostCard: chọn/tạo lại ảnh)
├── hooks/                            # usePosts, usePages, useGroups, useAccount, useSocial, ...
└── lib/
    ├── ai/                # llm-client · writer · image-generator
    ├── research/          # rss-scraper · social-scraper
    ├── facebook/          # poster (Graph API v21.0)
    ├── auth.ts crypto.ts  # scrypt + HMAC session · AES-256-GCM
    ├── db.ts config-store.ts  # Neon + initDb/seedDb · config DB-first (cache)
    └── constants.ts rate-limit.ts api-response.ts

bot/                       # Tiến trình daemon riêng (package.json riêng)
├── Dockerfile             # image bot headless: Playwright + Xvfb (+ x11vnc cho VNC login)
├── post-groups.js         # loop() poll mỗi 60s: đăng Page/Group/cá nhân/X/Instagram + Threads (API) + video
├── lib/                   # db · crypto (khớp src) · config-db (getSocialAccount/getAccountByOwner) · llm-fetch
├── scripts/               # login · login-vnc (đăng nhập FB qua VNC) · check-db · fix-db · flush
├── video-maker/           # Remotion: render Reels MP4 + OpenAI TTS
└── fb-profile/            # profile Chromium đã đăng nhập (Playwright persistent)

docs/                      # HUONG-DAN-CAI-DAT.md · DEPLOY-COOLIFY.md + bản HTML hướng dẫn

Dockerfile · docker-compose.yml · .dockerignore   # deploy web app lên Coolify
next.config.ts             # output: "standalone" (image Docker gọn)
```

## LLM Provider

Chuyển provider bằng biến `LLM_PROVIDER` (hoặc cấu hình ở `/manage/settings`), **không cần sửa code**:

### OpenAI-compatible (mặc định)

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

### Provider OpenAI-compatible khác

| Provider | `LLM_BASE_URL` | Model ví dụ |
|----------|----------------|-------------|
| Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |
| Together | `https://api.together.xyz/v1` | `meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo` |
| Ollama (local) | `http://localhost:11434/v1` | `llama3.1` |

> Sinh ảnh (Image) và TTS vẫn dùng OpenAI riêng qua `OPENAI_API_KEY`. Gemini dùng làm fallback khi trích xuất script video.

## Bảo mật

- **Xác thực**: mật khẩu băm bằng **scrypt** (salt riêng, `timingSafeEqual`); session là token **ký HMAC** trong cookie `mkt_session` (HttpOnly, SameSite=Lax, `Secure` ở production, hạn 7 ngày), hỗ trợ thu hồi session.
- **Mã hóa secret**: token/cookie Facebook Page, **cookie FB cá nhân (`facebook_accounts`)**, **cookie/token X·Threads·Instagram (`social_accounts`)** và các secret trong `app_config` đều mã hóa **AES-256-GCM** bằng `APP_ENCRYPTION_KEY`. API không bao giờ trả secret thô (chỉ trả `has_token`/`has_cookies`/`name`).
- **Middleware**: gác toàn bộ route (trừ `/login`), thêm security headers (X-Frame-Options, nosniff, HSTS, CSP), và **kiểm tra CSRF** cho request ghi `/api/*` (Origin phải khớp Host).
- **Rate limit**: `login` 5 lần/phút theo IP (chống brute-force), `research` & `write` 10 lần/phút theo người dùng — vượt ngưỡng trả `429`.
- **Phân tách dữ liệu theo `owner_id`**: user thường chỉ thấy dữ liệu của mình (articles, posts, pages, groups, sources, dashboard, stats); admin thấy tất cả.

> ⚠️ `APP_ENCRYPTION_KEY` phải được sinh một lần và **giữ cố định vĩnh viễn**. Đổi key sẽ khiến toàn bộ secret đã lưu và session hiện tại không giải mã được.

## Responsive

Giao diện hỗ trợ desktop & mobile:
- Desktop: sidebar cố định + pipeline 3 bước.
- Mobile: drawer sidebar, stepper thu gọn, layout xếp dọc, touch-friendly (44px targets).

## License

MIT
