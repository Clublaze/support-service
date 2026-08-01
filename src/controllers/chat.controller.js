import { answerSupportQuestion } from '../services/supportChat/index.js';
import ticketService from '../services/ticket.service.js';
import chatSessionRepo from '../repositories/chatSession.repo.js';
import AppError from '../utils/AppError.js';
import { TICKET_TYPE, TICKET_SOURCE } from '../constants/support.constants.js';

const transcriptToDescription = (history, additionalDetails) => {
  const transcript = history
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');
  return additionalDetails ? `${additionalDetails}\n\n— Chat transcript —\n${transcript}` : `— Chat transcript —\n${transcript}`;
};

class ChatController {
  // The transcript is held server-side, keyed by sessionId + req.user.id
  // (M13) — the client sends only { sessionId, message }, never history, so
  // a fabricated assistant turn can no longer talk the model out of its
  // grounding rules or make it "say" something under UniHub's name it never
  // actually said.
  async sendMessage(req, res, next) {
    try {
      const userId = req.user.id;
      const sessionId = req.body.sessionId || chatSessionRepo.newSessionId();
      const history = await chatSessionRepo.getHistory(userId, sessionId);

      const result = await answerSupportQuestion({
        universityId: req.universityId,
        message: req.body.message,
        history,
      });

      await chatSessionRepo.appendTurns(userId, sessionId, [
        { role: 'user', content: req.body.message },
        { role: 'assistant', content: result.reply },
      ]);

      res.success({ ...result, sessionId });
    } catch (err) {
      next(err);
    }
  }

  // One-click "turn this conversation into a ticket" — the chatbot couldn't
  // help, or the user just wants a human, and re-typing everything they
  // already explained to the bot is exactly the kind of friction that makes
  // people give up on a help page. Reads the transcript from the server-side
  // session rather than trusting a client-supplied one (M13) — otherwise a
  // fabricated transcript could land in a real ticket under the user's name.
  async escalate(req, res, next) {
    try {
      const userId = req.user.id;
      const { sessionId, category, additionalDetails } = req.body;
      const history = await chatSessionRepo.getHistory(userId, sessionId);
      if (history.length === 0) {
        throw new AppError('Nothing to escalate yet — send a message first', 400);
      }

      const firstUserMessage = history.find((m) => m.role === 'user')?.content || 'Chat escalated to a ticket';

      const ticket = await ticketService.createTicket({
        universityId: req.universityId,
        requesterId: userId,
        type: TICKET_TYPE.SUPPORT, // chat never escalates directly into a grievance — see supportChat/prompt.js
        category,
        subject: firstUserMessage.slice(0, 140),
        description: transcriptToDescription(history, additionalDetails),
        source: TICKET_SOURCE.CHATBOT,
      });

      await chatSessionRepo.clearSession(userId, sessionId);

      res.success(ticket, 'Ticket created from chat', 201);
    } catch (err) {
      next(err);
    }
  }
}

export default new ChatController();
