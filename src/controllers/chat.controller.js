import { answerSupportQuestion } from '../services/supportChat/index.js';
import ticketService from '../services/ticket.service.js';
import { TICKET_TYPE, TICKET_SOURCE } from '../constants/support.constants.js';

const transcriptToDescription = (history, additionalDetails) => {
  const transcript = history
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');
  return additionalDetails ? `${additionalDetails}\n\n— Chat transcript —\n${transcript}` : `— Chat transcript —\n${transcript}`;
};

class ChatController {
  async sendMessage(req, res, next) {
    try {
      const result = await answerSupportQuestion({
        universityId: req.universityId,
        message: req.body.message,
        history: req.body.history,
      });
      res.success(result);
    } catch (err) {
      next(err);
    }
  }

  // One-click "turn this conversation into a ticket" — the chatbot couldn't
  // help, or the user just wants a human, and re-typing everything they
  // already explained to the bot is exactly the kind of friction that makes
  // people give up on a help page.
  async escalate(req, res, next) {
    try {
      const { history, category, additionalDetails } = req.body;
      const firstUserMessage = history.find((m) => m.role === 'user')?.content || 'Chat escalated to a ticket';

      const ticket = await ticketService.createTicket({
        universityId: req.universityId,
        requesterId: req.user.id,
        type: TICKET_TYPE.SUPPORT, // chat never escalates directly into a grievance — see supportChat/prompt.js
        category,
        subject: firstUserMessage.slice(0, 140),
        description: transcriptToDescription(history, additionalDetails),
        source: TICKET_SOURCE.CHATBOT,
      });

      res.success(ticket, 'Ticket created from chat', 201);
    } catch (err) {
      next(err);
    }
  }
}

export default new ChatController();
