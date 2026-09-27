// overlay/modules/ai/openai.js
//
// Talks to OpenAI's chat completions endpoint. Exposes exactly one
// function so index.js can treat every provider identically.

export async function generateWithOpenAI({ apiKey, prompt }) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini', // small, cheap model — plenty for a short repo summary
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 220,
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    throw new Error(describeError(response.status));
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

function describeError(status) {
  if (status === 401) return 'OpenAI rejected the API key.';
  if (status === 429) return 'OpenAI rate limit hit — try again shortly.';
  return `OpenAI API error: ${status}`;
}
