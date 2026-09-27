// overlay/modules/ai/anthropic.js
//
// Talks to Anthropic's Messages API. Exposes exactly one function so
// index.js can treat every provider identically.

export async function generateWithAnthropic({ apiKey, prompt }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // Anthropic blocks direct browser calls by default, since API
      // keys aren't normally meant to sit in client-side code. Here
      // the user is knowingly pasting their own personal key into
      // local extension storage for a personal tool, so this header
      // is an accepted trade-off, not something to ship in a product
      // with untrusted users.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001', // fast, inexpensive — sized for a short summary task
      max_tokens: 220,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(describeError(response.status));
  }

  const data = await response.json();
  return data.content?.[0]?.text ?? '';
}

function describeError(status) {
  if (status === 401) return 'Anthropic rejected the API key.';
  if (status === 429) return 'Anthropic rate limit hit — try again shortly.';
  return `Anthropic API error: ${status}`;
}
