import mongoose from 'mongoose';
import { TICKET_TYPE, TICKET_STATUS, TICKET_PRIORITY, TICKET_SOURCE } from '../constants/support.constants.js';

const { Schema } = mongoose;

const ticketSchema = new Schema(
  {
    universityId: { type: Schema.Types.ObjectId, required: true, index: true },
    requesterId: { type: String, required: true, index: true }, // auth-service userId (String, matching authServiceClient's contract)

    type: { type: String, enum: Object.values(TICKET_TYPE), default: TICKET_TYPE.SUPPORT, index: true },
    category: { type: String, required: true },
    subject: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, required: true, maxlength: 5000 },

    status: { type: String, enum: Object.values(TICKET_STATUS), default: TICKET_STATUS.OPEN, index: true },
    priority: { type: String, enum: Object.values(TICKET_PRIORITY), default: TICKET_PRIORITY.MEDIUM },
    source: { type: String, enum: Object.values(TICKET_SOURCE), default: TICKET_SOURCE.FORM },

    // Grievances only. requesterId is still always stored (abuse prevention,
    // and so a real person can still follow up) — the redaction happens in
    // ticket.service.js's serializer, not here. See README "Anonymity" section
    // before changing who is allowed to see requesterId when this is true.
    isAnonymous: { type: Boolean, default: false },

    attachmentUrls: [{ type: String }],
    assignedTo: { type: String, default: null, index: true }, // auth-service userId of the admin

    lastActivityAt: { type: Date, default: Date.now, index: true },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ticketSchema.index({ universityId: 1, status: 1, createdAt: -1 });
ticketSchema.index({ universityId: 1, type: 1, status: 1 });
ticketSchema.index({ universityId: 1, requesterId: 1, createdAt: -1 });
ticketSchema.index({ subject: 'text', description: 'text' });

export default mongoose.model('Ticket', ticketSchema);
