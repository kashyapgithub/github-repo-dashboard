// overlay/modules/ai/openai.js
//
// Talks to OpenAI's chat completions endpoint. Exposes exactly one
// function so index.js can treat every provider identically.

export async function generateWithOpenAI({ apiKey, prompt }) {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    throw new Error('OpenAI API key is missing. Please configure it in Settings.');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cleanKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini', // small, fast model
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 220,
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const errData = await response.json();
      detail = errData.error?.message || '';
    } catch {
      // not JSON
    }
    throw new Error(detail ? `OpenAI: ${detail}` : describeError(response.status));
  }

  const data = await response.json();
  return (data.choices?.[0]?.message?.content ?? '').trim();
}

function describeError(status) {
  if (status === 401) return 'OpenAI rejected the API key (401).';
  if (status === 429) return 'OpenAI rate limit hit (429) — check your usage or quota.';
  return `OpenAI API error: ${status}`;
}
