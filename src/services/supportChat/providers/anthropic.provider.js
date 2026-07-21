import AppError from '../../../utils/AppError.js';
import logger from '../../../utils/logger.js';
import env from '../../../config/env.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

// Same shape as club-service's academicCalendarExtraction/providers/anthropic.provider.js —
// a direct fetch call rather than the SDK, so this has no dependency beyond
// what's already in package.json.
export async function getChatCompletion({ systemPrompt, messages }) {
  if (!env.ai.anthropicApiKey) {
    throw new AppError('The support assistant is not configured yet. Please raise a ticket instead.', 503);
  }

  let response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ai.anthropicApiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: env.ai.chatModel,
        max_tokens: env.ai.maxTokens,
        system: systemPrompt,
        messages,
      }),
      signal: AbortSignal.timeout(env.ai.timeoutMs),
    });
  } catch (err) {
    logger.error(`[supportChat] Anthropic request failed to send: ${err.message}`);
    throw new AppError('The support assistant is temporarily unavailable. Please try again or raise a ticket.', 502);
  }

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    logger.error(`[supportChat] Anthropic returned ${response.status}: ${errBody}`);
    throw new AppError('The support assistant is temporarily unavailable. Please try again or raise a ticket.', 502);
  }

  const data = await response.json();
  const text = data.content?.find((block) => block.type === 'text')?.text;
  if (!text) {
    logger.warn('[supportChat] Anthropic response had no text content block');
    throw new AppError('The support assistant could not generate a reply. Please try again or raise a ticket.', 502);
  }

  return text;
}
