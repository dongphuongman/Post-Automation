const LLM_PROVIDER = process.env.LLM_PROVIDER || 'openai';
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
const LLM_API_KEY = process.env.LLM_API_KEY;
const LLM_MODEL = process.env.LLM_MODEL || (LLM_PROVIDER === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-4o');

async function llmChatCompletion({ messages, temperature = 0.7, maxTokens = 2048, jsonMode = false }) {
  if (!LLM_API_KEY) throw new Error('Missing LLM_API_KEY');

  if (LLM_PROVIDER === 'anthropic') {
    const systemParts = [];
    const chatMessages = [];
    for (const m of messages) {
      if (m.role === 'system') systemParts.push(m.content);
      else chatMessages.push({ role: m.role, content: m.content });
    }

    const body = {
      model: LLM_MODEL,
      max_tokens: maxTokens,
      temperature,
      messages: chatMessages,
    };
    if (systemParts.length) body.system = systemParts.join('\n\n');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': LLM_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.content[0].text;
  }

  const body = {
    model: LLM_MODEL,
    messages,
    temperature,
    max_tokens: maxTokens,
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  // Một số proxy trả JSON hoàn chỉnh NHƯNG kèm dòng thừa kiểu SSE ("data: [DONE]")
  // ở cuối, khiến res.json() ném "non-whitespace after JSON". Đọc text rồi parse
  // an toàn: thử nguyên chuỗi, nếu hỏng thì bóc dòng bắt đầu bằng '{' (object JSON).
  const raw = await res.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    const line = raw.split('\n').find((l) => l.trim().startsWith('{'));
    if (!line) throw new Error('Không parse được phản hồi LLM: ' + raw.slice(0, 200));
    data = JSON.parse(line);
  }
  if (data.error) throw new Error(data.error.message);
  return data.choices[0].message.content;
}

module.exports = { llmChatCompletion };
