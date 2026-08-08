# Deploy lên Coolify (Docker image / Docker Compose)

Hướng dẫn triển khai **Marketing Automation** lên [Coolify](https://coolify.io) — nền tảng PaaS tự host. Tài liệu bao gồm 2 cách: build từ **Dockerfile** hoặc dùng **Docker Compose**.

> Các file hạ tầng đã có sẵn trong repo: [`Dockerfile`](../Dockerfile), [`docker-compose.yml`](../docker-compose.yml), [`.dockerignore`](../.dockerignore).

---

## 1. Kiến trúc triển khai

```
┌─────────────────────────────┐        ┌──────────────────────┐
│  Coolify (VPS của bạn)      │        │  Neon Postgres       │
│  ┌───────────────────────┐  │  SQL   │  (serverless, ngoài) │
│  │  web (Next.js)        │──┼───────►│  POSTGRES_URL        │
│  │  Docker, cổng 3000    │  │        └──────────────────────┘
│  └───────────────────────┘  │
└─────────────────────────────┘
        ▲ HTTPS (Coolify tự cấp SSL + domain)

  Bot đăng Facebook (bot/) chạy RIÊNG — xem Mục 7.
```

Chỉ **web app** được deploy lên Coolify. **Database** dùng Neon Postgres bên ngoài (không cần container DB). **Bot** cần đăng nhập Facebook thủ công nên chạy riêng.

## 2. Chuẩn bị

| Yêu cầu | Ghi chú |
|---|---|
| Server Coolify đã cài | v4+ ([hướng dẫn cài Coolify](https://coolify.io/docs)) |
| Repo Git | GitHub/GitLab (repo này). Coolify kéo mã & tự build |
| Neon Postgres | Tạo project ở [console.neon.tech](https://console.neon.tech), lấy `POSTGRES_URL` |
| `APP_ENCRYPTION_KEY` | Sinh 1 lần: `openssl rand -hex 32` — **giữ cố định vĩnh viễn** |
| Khóa LLM (tùy chọn) | Có thể để trống, cấu hình sau trong `/manage/settings` |

## 3. Cách A — Deploy qua Dockerfile (khuyến nghị)

Đơn giản nhất: Coolify tự build `Dockerfile` trong repo.

1. **Coolify → Project → + New Resource → Application.**
2. Chọn nguồn Git (kết nối GitHub, chọn repo `Post-Automation`, nhánh `main`).
3. **Build Pack:** chọn **Dockerfile** (Coolify tự phát hiện `Dockerfile` ở gốc repo).
4. **Port:** đặt **`3000`** (mục *Ports Exposes*).
5. **Environment Variables:** thêm các biến ở [Mục 5](#5-biến-môi-trường) (tối thiểu `POSTGRES_URL` và `APP_ENCRYPTION_KEY`).
6. **Domain:** đặt domain trong *Domains* — Coolify tự cấp SSL (Let's Encrypt).
7. Bấm **Deploy**. Coolify build image (multi-stage, output standalone) rồi chạy container.

> Health check `/login` đã cấu hình sẵn trong `Dockerfile`; Coolify coi app "healthy" khi trang này trả về 200.

## 4. Cách B — Deploy qua Docker Compose

Dùng khi muốn khai báo cấu hình dạng compose (hoặc mở rộng thêm service sau này).

1. **Coolify → Project → + New Resource → Docker Compose.**
2. Chọn nguồn Git (repo + nhánh `main`).
3. Trỏ tới file **`docker-compose.yml`** ở gốc repo (Coolify tự nhận).
4. **Environment Variables:** thêm các biến ở [Mục 5](#5-biến-môi-trường). Compose tham chiếu chúng qua cú pháp `${...}`.
5. **Domain / Port:** service `web` expose cổng `3000`; gán domain trong Coolify.
6. Bấm **Deploy**.

> `docker-compose.yml` chỉ khai báo service `web`. DB là Neon ngoài; **không** thêm service Postgres trừ khi bạn muốn tự host DB (khi đó phải đổi `POSTGRES_URL` trỏ vào container đó).

## 5. Biến môi trường

Đặt trong tab **Environment Variables** của Coolify (không commit vào repo).

| Biến | Bắt buộc | Mô tả |
|---|:---:|---|
| `POSTGRES_URL` | ✅ | Chuỗi kết nối Neon Postgres |
| `APP_ENCRYPTION_KEY` | ✅ | `openssl rand -hex 32` — mã hóa secret trong DB + ký session. **Giữ cố định** |
| `LLM_PROVIDER` | ⬜ | `openai` (mặc định) hoặc `anthropic` |
| `LLM_BASE_URL` | ⬜ | Endpoint LLM (OpenAI-compatible) |
| `LLM_API_KEY` | ⬜ | Khóa LLM (viết bài). Có thể đặt ở `/manage/settings` thay vì đây |
| `LLM_MODEL` | ⬜ | Ví dụ `gpt-4o` hoặc `claude-sonnet-4-20250514` |
| `OPENAI_API_KEY` | ⬜ | TTS lồng tiếng video (chỉ OpenAI) |
| `RAPID_API_KEY` | ⬜ | Thu thập X/Twitter, Instagram |
| `BRAVE_API_KEY` | ⬜ | Tìm kiếm bổ sung |
| `FACEBOOK_PAGE_ID` / `FACEBOOK_ACCESS_TOKEN` / `FACEBOOK_USER_TOKEN` | ⬜ | Fallback đăng Page (khuyến nghị cấu hình Page ở `/manage/pages`) |

> Chỉ **2 biến bắt buộc** để app chạy. Phần lớn secret còn lại nên cấu hình trong giao diện `/manage/settings` (lưu mã hóa trong DB) — đổi khóa không cần redeploy.

> ⚠️ Vì app đặt cookie `Secure` khi `NODE_ENV=production`, **bắt buộc chạy sau HTTPS** (Coolify cấp sẵn). Nếu không sẽ không đăng nhập được.

## 6. Sau khi deploy

1. Mở domain của bạn → trang `/login`.
2. Database tự khởi tạo ở request đầu tiên và **seed tài khoản admin**:
   ```
   Email:    admin@local
   Password: admin123
   ```
3. **Đổi mật khẩu ngay** tại `/profile` (đổi mật khẩu sẽ thu hồi mọi phiên cũ).
4. Cấu hình khóa LLM/Facebook, nguồn tin, Page/Group trong `/manage/*`.

## 7. Bot đăng Facebook (chạy riêng)

Bot (`bot/`) chạy **tách khỏi** web app (đọc/ghi cùng database nên tự nhặt bài web app đẩy sang `ready_for_*`). Nó dùng Playwright `headless: false` + một **profile Chromium đã đăng nhập Facebook** (`bot/fb-profile/`). Có 2 cách chạy:

### Cách 1 — Máy có màn hình (đơn giản nhất)

Chạy trên máy bạn hoặc VPS có GUI, **cùng `POSTGRES_URL` và `APP_ENCRYPTION_KEY`** với web app:

```bash
cd bot
npm install
npm run install-browser     # tải Chromium cho Playwright (1 lần)
npm run login               # đăng nhập Facebook trong cửa sổ hiện ra (1 lần)
npm run post                # bot daemon: poll mỗi 60s, tự đăng
```

Dùng `pm2` / `systemd` để bot tự khởi động lại (chạy bền).

### Cách 2 — Linux KHÔNG có màn hình (Docker + Xvfb)

Bot **chạy được trên server headless** (kể cả cùng VPS Coolify) nhờ **Xvfb** (màn hình ảo). File [`bot/Dockerfile`](../bot/Dockerfile) đã dựng sẵn: dùng image Playwright chính thức (có sẵn Chromium + thư viện hệ thống + Xvfb) và chạy `xvfb-run npm run post` — giữ nguyên `headless: false` nên Facebook coi như trình duyệt thật.

```bash
# Build (context = thư mục bot/)
docker build -f bot/Dockerfile -t mkt-bot ./bot

# Chạy: truyền env + mount profile đã đăng nhập làm volume bền
docker run -d --name mkt-bot --restart unless-stopped \
  -e POSTGRES_URL="$POSTGRES_URL" \
  -e APP_ENCRYPTION_KEY="$APP_ENCRYPTION_KEY" \
  -e LLM_PROVIDER="$LLM_PROVIDER" -e LLM_BASE_URL="$LLM_BASE_URL" \
  -e LLM_API_KEY="$LLM_API_KEY" -e LLM_MODEL="$LLM_MODEL" \
  -v mkt-fb-profile:/app/fb-profile \
  mkt-bot
```

> Trên Coolify: tạo resource **Application → Dockerfile**, trỏ *Dockerfile Location* = `bot/Dockerfile`, *Base Directory* = `bot`; thêm env vars; gắn **Persistent Storage** vào `/app/fb-profile`. Không cần expose cổng (bot không phục vụ HTTP).

### Lấy phiên đăng nhập Facebook trên server headless

Container headless không tự mở cửa sổ để đăng nhập tay. Chọn 1 trong 3:

| Cách | Làm gì |
|---|---|
| **A. Copy profile (khuyến nghị)** | Chạy `npm run login` trên máy có màn hình → nén `bot/fb-profile/` → chép vào volume `mkt-fb-profile` của server (`docker cp` hoặc mount). Phiên bền qua redeploy. |
| **B. Cookie bootstrap** | Xuất cookie Facebook, lưu vào Page ở `/manage/pages`. Bot tự nạp cookie để xác thực profile trống (cơ chế bootstrap đã có sẵn trong bot) — không cần đăng nhập tay. |
| **C. VNC 1 lần** | Đổi lệnh chạy tạm sang `Xvfb + x11vnc`, VNC vào display ảo, đăng nhập, rồi quay lại lệnh thường. |

> ⚠️ Dù chạy Xvfb, Facebook vẫn có thể yêu cầu xác minh thiết bị mới (checkpoint) khi profile lần đầu hoạt động trên server lạ. **Cách A** (mang nguyên profile đã đăng nhập sang) tránh được điều này tốt nhất.

> Render video Reels (Remotion + FFmpeg) là module riêng, không bao gồm trong `bot/Dockerfile` tối giản này. Nếu cần, cài thêm FFmpeg (`apt-get install -y ffmpeg`) và dựng `bot/video-maker/`.

## 8. Cập nhật / redeploy

- **Coolify:** bật *Auto Deploy* để mỗi lần push `main` tự build lại; hoặc bấm **Redeploy** thủ công.
- **Bot:** `git pull` trên máy chạy bot rồi khởi động lại tiến trình (`pm2 restart` …).

## 9. Xử lý sự cố

| Triệu chứng | Cách xử lý |
|---|---|
| Build fail ở bước `npm ci` | Thiếu `package-lock.json`? Đảm bảo đã commit lockfile. |
| App chạy nhưng không đăng nhập được | Chưa có HTTPS → cookie `Secure` không gửi. Gán domain + SSL trong Coolify. |
| Lỗi `POSTGRES_URL is not defined` | Chưa thêm biến môi trường trong Coolify. |
| Lỗi giải mã secret / bị đăng xuất liên tục | `APP_ENCRYPTION_KEY` sai hoặc đã đổi. Đặt lại đúng key và **giữ cố định**. |
| Không viết được bài | Thiếu `LLM_API_KEY`/`LLM_MODEL`/`LLM_BASE_URL` (env hoặc `/manage/settings`). |
| Bot không đăng | Bot chạy riêng — kiểm tra đã `npm run login`, cùng DB + `APP_ENCRYPTION_KEY`, và bài ở trạng thái `ready_for_*` đã tới giờ hẹn. |
| Container restart liên tục | Xem log trong Coolify; health check `/login` fail nếu app chưa lắng nghe cổng 3000. |

## 10. Tham khảo thêm

- [README.md](../README.md) — Tổng quan dự án, kiến trúc, bảo mật.
- [HUONG-DAN-CAI-DAT.md](HUONG-DAN-CAI-DAT.md) — Cài đặt & chạy local.
- [huong-dan-su-dung.html](huong-dan-su-dung.html) — Hướng dẫn sử dụng giao diện.
