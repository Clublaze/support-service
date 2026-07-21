import mongoose from 'mongoose';
import { MESSAGE_AUTHOR_TYPE } from '../constants/support.constants.js';

const { Schema } = mongoose;

const ticketMessageSchema = new Schema(
  {
    ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
    authorId: { type: String, default: null }, // null when authorType is BOT
    authorType: { type: String, enum: Object.values(MESSAGE_AUTHOR_TYPE), required: true },
    body: { type: String, required: true, maxlength: 5000 },
    attachmentUrls: [{ type: String }],

    // Visible to admins only — never returned on the user-facing ticket
    // thread. Lets an admin leave a note like "waiting on club-service data"
    // without it showing up as a reply the requester receives an email about.
    isInternalNote: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ticketMessageSchema.index({ ticketId: 1, createdAt: 1 });

export default mongoose.model('TicketMessage', ticketMessageSchema);
