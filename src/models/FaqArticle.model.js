import mongoose from 'mongoose';

const { Schema } = mongoose;

const faqArticleSchema = new Schema(
  {
    universityId: { type: Schema.Types.ObjectId, default: null, index: true }, // null = platform-wide
    category: { type: String, required: true, index: true },
    question: { type: String, required: true, trim: true, maxlength: 300 },
    answer: { type: String, required: true, maxlength: 8000 }, // markdown
    tags: [{ type: String, trim: true, lowercase: true }],

    isPublished: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0 },

    viewCount: { type: Number, default: 0 },
    helpfulCount: { type: Number, default: 0 },
    notHelpfulCount: { type: Number, default: 0 },

    createdBy: { type: String, default: null }, // admin userId
    updatedBy: { type: String, default: null },
  },
  { timestamps: true }
);

// A single compound text index — Mongo only allows one per collection, so
// question/answer/tags all have to share this one rather than each getting
// their own.
faqArticleSchema.index({ question: 'text', answer: 'text', tags: 'text' }, { weights: { question: 5, tags: 3, answer: 1 } });
faqArticleSchema.index({ universityId: 1, category: 1, isPublished: 1, order: 1 });

export default mongoose.model('FaqArticle', faqArticleSchema);
