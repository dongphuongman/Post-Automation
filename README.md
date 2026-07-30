# Marketing Automation

**Pipeline tự động hóa content marketing: Thu thập tin &rarr; Viết bài bằng AI &rarr; Render video &rarr; Đăng Facebook.**

---

## Tổng quan

Hệ thống 3 bước khép kín cho content creator và marketer:

1. **Thu thập tin** &mdash; Crawl tin tức từ nhiều nguồn (RSS, Brave Search, RapidAPI) theo từ khóa
2. **Chọn & Viết bài** &mdash; AI viết bài theo giọng văn cá nhân, hỗ trợ format POV / News, tự động sinh ảnh minh họa
3. **Duyệt & Đăng** &mdash; Đăng Facebook Page/Group trực tiếp hoặc hẹn lịch, kèm video Reels tự động render

## Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| Frontend | Next.js 16, React 18, TypeScript |
| Database | Neon Postgres (serverless) |
| AI / LLM | Multi-provider: OpenAI, Anthropic Claude, Groq, Together, Ollama |
| Image Gen | DALL-E 3 hoặc provider tương thích |
| Video | Remotion + FFmpeg, OpenAI TTS |
| Social | Facebook Graph API v21.0, Playwright automation |
| Scraping | Brave Search API, RapidAPI, RSS Parser |

## Cài đặt

```bash
git clone https://github.com/dongphuongman/Post-Automation.git
cd Post-Automation
npm install
```

### Cấu hình env

Copy `.env.example` thành `.env.local` và điền các giá trị:

```env
# Database
POSTGRES_URL=postgresql://user:password@host/dbname

# LLM Provider: "openai" (default) hoặc "anthropic"
LLM_PROVIDER=openai

# LLM config
LLM_BASE_URL=https://api.openai.com/v1    # Không cần nếu dùng Anthropic
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o                          # Hoặc claude-sonnet-4-20250514

# Image (tùy chọn, mặc định dùng LLM_API_KEY)
# IMAGE_BASE_URL=
# IMAGE_API_KEY=
# IMAGE_MODEL=dall-e-3

# TTS cho video (hiện chỉ hỗ trợ OpenAI)
OPENAI_API_KEY=sk-...

# Gemini fallback
# GEMINI_API_KEY=
# GEMINI_MODEL=gemini-2.0-flash

# Scraping
RAPID_API_KEY=
BRAVE_API_KEY=

# Facebook
FACEBOOK_PAGE_ID=
FACEBOOK_ACCESS_TOKEN=
FACEBOOK_USER_TOKEN=
```

### Chạy

```bash
npm run dev        # Dev server tại http://localhost:3000
npm run build      # Production build
```

### Bot video (tùy chọn)

```bash
cd bot/video-maker
npm install
# Xem render-cmd.js để biết cách dùng
```

## Cấu trúc dự án

```
src/
├── app/                  # Next.js App Router
│   ├── api/              # API routes
│   │   ├── research/     # Crawl & tìm tin tức
│   │   ├── write/        # AI viết bài
│   │   ├── articles/     # CRUD bài viết
│   │   ├── posts/        # Quản lý bài đăng
│   │   ├── post-facebook/ # Đăng Facebook
│   │   └── stats/        # Thống kê
│   ├── globals.css       # Design system + responsive
│   └── page.tsx          # Trang chính (3-step pipeline)
├── components/
│   ├── layout/           # Sidebar, Stepper (mobile drawer)
│   └── pipeline/         # StepResearch, StepSelect, StepReview
├── hooks/                # usePosts, custom hooks
└── lib/
    ├── ai/               # llm-client.ts, writer.ts, image-generator.ts
    ├── db/               # Neon Postgres queries
    └── constants.ts

bot/
├── lib/                  # llm-fetch.js, config.js, db.js
├── post-groups.js        # Bot đăng bài vào groups
├── video-maker/          # Remotion video rendering
│   └── src/              # Video components (MainVideo, BlockVideo)
└── scripts/              # Utility scripts

docs/
└── huong-dan-su-dung.html  # Hướng dẫn sử dụng (tiếng Việt)
```

## LLM Provider

Chuyển đổi provider bằng env var `LLM_PROVIDER`, không cần sửa code:

### OpenAI-compatible (default)

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
| Ollama | `http://localhost:11434/v1` | `llama3.1` |

> Image generation và TTS vẫn dùng OpenAI riêng (qua `OPENAI_API_KEY`). Gemini dùng làm fallback khi LLM chính lỗi.

## Responsive

Giao diện hỗ trợ desktop & mobile:
- Desktop: sidebar cố định + 3-step pipeline
- Mobile: drawer sidebar, stepper thu gọn, layout xếp dọc, touch-friendly (44px targets)

## License

MIT
