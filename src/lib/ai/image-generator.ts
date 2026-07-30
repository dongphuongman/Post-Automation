import OpenAI from 'openai';

export async function generateImageResponse(topic: string): Promise<string | null> {
  const apiKey = process.env.IMAGE_API_KEY || process.env.LLM_API_KEY;
  if (!apiKey) return null;

  try {
    const openai = new OpenAI({
      apiKey,
      baseURL: process.env.IMAGE_BASE_URL || process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    });
    const imagePrompt = `Create an illustration for a social media post about: "${topic}".
STYLE: Cinematic concept art or Ghibli-inspired painterly illustration.
COMPOSITION: Square image (1:1).
REQUIREMENTS: Very little to no text, absolutely no charts, graphs, bullet points, or icons. The scene must visually capture the core essence of the topic in an epic, professional, and visually stunning way.`;

    const imgRes = await openai.images.generate({
      model: process.env.IMAGE_MODEL || 'dall-e-3',
      prompt: imagePrompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    });

    return imgRes.data?.[0]?.url || null;
  } catch (error) {
    console.error('Image generation error:', error);
    return null;
  }
}
