const env = require('../../config/env');
const { ApiError } = require('../../utils/ApiError');

const GROQ_BASE = 'https://api.groq.com/openai/v1';

function assertConfigured() {
  if (!env.groqApiKey) {
    throw new ApiError(
      503,
      'Voice assignment is not configured on this server yet. Set GROQ_API_KEY to enable it — the manual add-task flow still works as always.'
    );
  }
}

/**
 * Speech-to-text via Groq's Whisper endpoint. Only called when the client
 * sends raw audio instead of an already-transcribed string.
 */
async function transcribeAudio(buffer, mimeType) {
  assertConfigured();

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType || 'audio/webm' }), 'command.webm');
  form.append('model', env.groqTranscribeModel);
  form.append('response_format', 'json');

  let res;
  try {
    res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.groqApiKey}` },
      body: form,
    });
  } catch (err) {
    throw new ApiError(502, 'Could not reach the voice transcription service. Please try again or use the manual form.');
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('Groq transcription error:', res.status, detail);
    throw new ApiError(502, 'Voice transcription failed. Please try again or use the manual form.');
  }

  const data = await res.json();
  return (data.text || '').trim();
}

/**
 * Sends the extraction prompt to a Groq chat model and returns the raw
 * text content of the response (expected to be a JSON string — parsing
 * and validating that is voice.parser's job, not this client's).
 */
async function extractTaskFields(prompt) {
  assertConfigured();

  let res;
  try {
    res = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.groqModel,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
      }),
    });
  } catch (err) {
    throw new ApiError(502, 'Could not reach the voice parsing service. Please try again or use the manual form.');
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('Groq extraction error:', res.status, detail);
    throw new ApiError(502, 'Voice parsing failed. Please try again or use the manual form.');
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new ApiError(502, 'Voice parsing service returned an empty response. Please try again or use the manual form.');
  }
  return content;
}

module.exports = { transcribeAudio, extractTaskFields };
