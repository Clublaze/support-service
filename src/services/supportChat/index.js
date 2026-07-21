import faqService from '../faq.service.js';
import { getChatCompletion } from './providers/anthropic.provider.js';
import { buildSystemPrompt } from './prompt.js';
import { chatRequestsTotal } from '../../utils/metrics.js';

// A reply is treated as "couldn't really help" when no FAQ matched at all —
// used to nudge the frontend to surface the "raise a ticket" button more
// prominently, without needing a second model call just to classify itself.
export async function answerSupportQuestion({ universityId, message, history = [] }) {
  const faqs = await faqService.suggest(universityId, message, 5).catch(() => []);

  const systemPrompt = buildSystemPrompt(faqs);
  const messages = [...history.map((m) => ({ role: m.role, content: m.content })), { role: 'user', content: message }];

  try {
    const reply = await getChatCompletion({ systemPrompt, messages });
    chatRequestsTotal.inc({ status: 'success' });

    return {
      reply,
      matchedFaqs: faqs.map((f) => ({ id: f._id, question: f.question, category: f.category })),
      suggestEscalation: faqs.length === 0,
    };
  } catch (err) {
    chatRequestsTotal.inc({ status: 'error' });
    throw err;
  }
}
