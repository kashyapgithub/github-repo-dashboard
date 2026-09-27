// overlay/modules/ai/gemini.js
//
// Talks to Google's Gemini API. Exposes exactly one function so
// index.js can treat every provider identically.
//
// Gemini is the free-tier-friendly option of the three: Google AI
// Studio issues a free API key with generous daily quotas on the
// Flash / Flash-Lite models, which is what makes this whole
// "cache aggressively + throttle concurrency" approach viable at
// zero cost. If Google renames or retires this model string, this is
// the one line to update.

const MODEL = 'gemini-2.5-flash-lite';

export async function generateWithGemini({ apiKey, prompt }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 220, temperature: 0.4 },
    }),
  });

  if (!response.ok) {
    throw new Error(describeError(response.status));
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

function describeError(status) {
  if (status === 400) return 'Gemini rejected the request — check the API key.';
  if (status === 429) return 'Gemini rate limit hit — try again shortly.';
  return `Gemini API error: ${status}`;
}
