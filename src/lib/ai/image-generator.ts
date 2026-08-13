import OpenAI from 'openai';
import { getConfig } from '@/lib/config-store';

export async function generateImageResponse(topic: string): Promise<string | null> {
  const apiKey = (await getConfig('IMAGE_API_KEY')) || (await getConfig('LLM_API_KEY'));
  if (!apiKey) return null;

  try {
    // SDK OpenAI tự nối "/images/generations" vào baseURL. Chuẩn hóa để phòng khi
    // config lỡ đặt full path (…/v1/images/generations) → tránh nối đôi → 404.
    const rawBase = (await getConfig('IMAGE_BASE_URL')) || (await getConfig('LLM_BASE_URL')) || 'https://api.openai.com/v1';
    const baseURL = rawBase.replace(/\/+(images\/generations|images)\/?$/i, '').replace(/\/$/, '');
    // Fail nhanh: KHÔNG retry (mặc định SDK retry 429 và tuân Retry-After của provider
    // → treo tới vài phút, nút "Tạo lại ảnh" đứng hình). timeout 60s chặn kết nối treo.
    const openai = new OpenAI({ apiKey, baseURL, maxRetries: 0, timeout: 60_000 });
    const imagePrompt = `Create an illustration for a social media post about: "${topic}".
STYLE: Cinematic concept art or Ghibli-inspired painterly illustration.
COMPOSITION: Square image (1:1).
REQUIREMENTS: Very little to no text, absolutely no charts, graphs, bullet points, or icons. The scene must visually capture the core essence of the topic in an epic, professional, and visually stunning way.`;

    const imgRes = await openai.images.generate({
      model: (await getConfig('IMAGE_MODEL')) || 'dall-e-3',
      prompt: imagePrompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    });

    // Provider có thể trả `url` HOẶC `b64_json` (vd proxy/flux) — xử lý cả hai.
    const item = imgRes.data?.[0];
    if (item?.url) return item.url;
    if (item?.b64_json) {
      const mime = item.b64_json.startsWith('/9j/') ? 'image/jpeg' : 'image/png';
      return `data:${mime};base64,${item.b64_json}`;
    }
    return null;
  } catch (error) {
    const e = error as { status?: number; message?: string };
    console.error('Image generation error:', e.status || '', (e.message || String(error)).slice(0, 200));
    return null;
  }
}
