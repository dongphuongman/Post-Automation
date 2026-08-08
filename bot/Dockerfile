# syntax=docker/dockerfile:1
# Dockerfile cho BOT đăng Facebook — chạy trên Linux KHÔNG cần màn hình thật.
# Dùng image Playwright chính thức (đã có Chromium + mọi thư viện hệ thống + Xvfb),
# và chạy bot trong màn hình ảo Xvfb nên vẫn giữ được headless:false (giống trình duyệt thật).
#
# Build context = thư mục bot/ :  docker build -f bot/Dockerfile -t mkt-bot ./bot
# ⚠️ Tag image PHẢI khớp version "playwright" mà npm cài (image bundle sẵn browser cho đúng version đó).
FROM mcr.microsoft.com/playwright:v1.59.1-jammy

WORKDIR /app

# Cài dependency (đã tách để tận dụng cache layer)
COPY package.json package-lock.json ./
RUN npm ci
# Bảo hiểm nếu version playwright lệch với base image: tải đúng browser cho version đã cài.
RUN npx playwright install chromium

# Mã nguồn bot
COPY . .

ENV NODE_ENV=production
# Bot đọc secret từ biến môi trường container (POSTGRES_URL, APP_ENCRYPTION_KEY, LLM_*...).
# .env.local ở repo gốc KHÔNG tồn tại trong container này → dotenv bỏ qua, dùng process.env.

# Phiên đăng nhập Facebook: mount thư mục fb-profile ĐÃ ĐĂNG NHẬP vào /app/fb-profile
# (volume), HOẶC lưu cookie FB trong Page ở /manage/pages để bot tự bootstrap.
VOLUME ["/app/fb-profile"]

# Chạy trong màn hình ảo Xvfb → headless:false vẫn hoạt động trên server không GUI.
CMD ["xvfb-run", "-a", "--server-args=-screen 0 1280x800x24 -ac", "npm", "run", "post"]
