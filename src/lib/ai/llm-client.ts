import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

interface ChatCompletionParams {
  system: string;
  userMessage: string;
  maxTokens?: number;
  temperature?: number;
}

const provider = process.env.LLM_PROVIDER || 'openai';

export async function chatCompletion({ system, userMessage, maxTokens = 2048, temperature = 0.7 }: ChatCompletionParams): Promise<string> {
  if (provider === 'anthropic') {
    const client = new Anthropic({ apiKey: process.env.LLM_API_KEY });
    const model = process.env.LLM_MODEL || 'claude-sonnet-4-20250514';
    const res = await client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system,
      messages: [{ role: 'user', content: userMessage }],
    });
    const block = res.content[0];
    return block.type === 'text' ? block.text : '';
  }

  const client = new OpenAI({
    apiKey: process.env.LLM_API_KEY,
    baseURL: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
  });
  const model = process.env.LLM_MODEL || 'gpt-4o';
  const res = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userMessage },
    ],
  });
  return res.choices[0]?.message?.content || '';
}
