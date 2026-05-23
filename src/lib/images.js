const OPENAI_URL = 'https://api.openai.com/v1/images/generations';

export function hasOpenAiKey() {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim());
}

export async function generateImageWithOpenAi(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      size: '1024x1536'
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI image request failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  const b64 = data?.data?.[0]?.b64_json;
  const url = data?.data?.[0]?.url;

  if (b64) return { kind: 'openai', url: `data:image/png;base64,${b64}` };
  if (url) return { kind: 'openai', url };

  throw new Error('OpenAI image response did not include image data');
}
