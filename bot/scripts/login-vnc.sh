#!/usr/bin/env bash
# login-vnc.sh — Đăng nhập Facebook cho bot TRÊN SERVER HEADLESS qua VNC.
#
# Dùng trong container (image bot). Khởi động màn hình ảo Xvfb + x11vnc, rồi mở
# scripts/login.js (Chromium headed trên profile /app/fb-profile). Bạn VNC vào,
# đăng nhập FB, ĐÓNG cửa sổ Chromium → phiên lưu thẳng vào volume fb-profile.
#
# Cách chạy (trên server):
#   docker run --rm -it -p 127.0.0.1:5900:5900 \
#     -v mkt-fb-profile:/app/fb-profile mkt-bot bash scripts/login-vnc.sh
# Trên máy bạn:
#   ssh -L 5900:127.0.0.1:5900 user@server   # rồi mở VNC client tới localhost:5900
#
# Bảo mật: mặc định x11vnc bó -localhost (chỉ nhận qua SSH tunnel). Đặt VNC_PASSWORD
# nếu muốn mở cổng trực tiếp có mật khẩu (kém an toàn hơn tunnel).
set -euo pipefail

export DISPLAY=:99
SCREEN_GEOMETRY="${SCREEN_GEOMETRY:-1280x800x24}"
VNC_PORT="${VNC_PORT:-5900}"

echo "🖥️  Khởi động Xvfb (${SCREEN_GEOMETRY}) trên ${DISPLAY}..."
Xvfb :99 -screen 0 "${SCREEN_GEOMETRY}" -ac >/tmp/xvfb.log 2>&1 &
sleep 2

echo "🪟  Khởi động window manager (fluxbox)..."
fluxbox >/tmp/fluxbox.log 2>&1 &
sleep 1

if [ -n "${VNC_PASSWORD:-}" ]; then
  echo "🔐 x11vnc: dùng mật khẩu VNC_PASSWORD, cổng ${VNC_PORT} (mọi interface)."
  x11vnc -display :99 -forever -shared -rfbport "${VNC_PORT}" -passwd "${VNC_PASSWORD}" >/tmp/x11vnc.log 2>&1 &
else
  echo "🔐 x11vnc: KHÔNG mật khẩu nhưng bó -localhost (chỉ qua SSH tunnel), cổng ${VNC_PORT}."
  echo "   → Mở tunnel:  ssh -L ${VNC_PORT}:127.0.0.1:${VNC_PORT} <user>@<server>"
  x11vnc -display :99 -forever -shared -localhost -rfbport "${VNC_PORT}" -nopw >/tmp/x11vnc.log 2>&1 &
fi
sleep 1

echo ""
echo "✅ VNC sẵn sàng ở cổng ${VNC_PORT}. HÃY:"
echo "   1) Kết nối VNC client tới localhost:${VNC_PORT} (qua SSH tunnel)."
echo "   2) Đăng nhập Facebook trong cửa sổ Chromium (vượt checkpoint nếu có)."
echo "   3) (Khuyến nghị) Chuyển sang Trang cần đăng."
echo "   4) ĐÓNG cửa sổ Chromium → phiên được lưu vào /app/fb-profile (volume)."
echo ""

# login.js chờ context 'close' rồi lưu phiên & thoát.
exec node scripts/login.js
