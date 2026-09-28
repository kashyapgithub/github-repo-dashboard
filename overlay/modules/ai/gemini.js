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

const CANDIDATE_MODELS = ['gemini-1.5-flash', 'gemini-2.0-flash'];

export async function generateWithGemini({ apiKey, prompt }) {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    throw new Error('Gemini API key is missing. Please configure it in Settings.');
  }

  let lastError = null;

  for (let i = 0; i < CANDIDATE_MODELS.length; i++) {
    const model = CANDIDATE_MODELS[i];
    const isLast = i === CANDIDATE_MODELS.length - 1;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 220, temperature: 0.4 },
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

        // If 404 (model endpoint not found) and another model is available, try fallback
        if (response.status === 404 && !isLast) {
          continue;
        }

        const fallbackMsg = describeError(response.status);
        throw new Error(detail ? `Gemini API: ${detail}` : fallbackMsg);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text && data.candidates?.[0]?.finishReason) {
        throw new Error(`Gemini finished with reason: ${data.candidates[0].finishReason}`);
      }
      return (text || '').trim();
    } catch (err) {
      lastError = err;
      if (!err.message?.includes('404') || isLast) {
        throw err;
      }
    }
  }

  throw lastError || new Error('Failed to generate summary with Gemini.');
}

function describeError(status) {
  if (status === 400) return 'Gemini rejected the request (400) — check the API key.';
  if (status === 403) return 'Gemini permission denied (403) — check API key permissions or quota.';
  if (status === 404) return 'Gemini model endpoint not found (404).';
  if (status === 429) return 'Gemini rate limit hit (429) — try again shortly.';
  return `Gemini API error: ${status}`;
}
