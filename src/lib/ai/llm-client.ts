import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { getConfig } from '@/lib/config-store';

interface ChatCompletionParams {
  system: string;
  userMessage: string;
  maxTokens?: number;
  temperature?: number;
}

export async function chatCompletion({ system, userMessage, maxTokens = 2048, temperature = 0.7 }: ChatCompletionParams): Promise<string> {
  const provider = (await getConfig('LLM_PROVIDER')) || 'openai';
  const apiKey = await getConfig('LLM_API_KEY');

  if (provider === 'anthropic') {
    const client = new Anthropic({ apiKey });
    const model = (await getConfig('LLM_MODEL')) || 'claude-sonnet-4-20250514';
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
    apiKey,
    baseURL: (await getConfig('LLM_BASE_URL')) || 'https://api.openai.com/v1',
  });
  const model = (await getConfig('LLM_MODEL')) || 'gpt-4o';
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
