import FaqArticle from '../models/FaqArticle.model.js';
import AppError from '../utils/AppError.js';
import auditServiceClient from '../utils/auditServiceClient.js';
import { SUPPORT_CATEGORIES, AUDIT_ENTITY, AUDIT_ACTION } from '../constants/support.constants.js';

const scopeFilter = (universityId) => ({ $or: [{ universityId }, { universityId: null }] });

class FaqService {
  async list(universityId, { category, q, page, limit }) {
    const filter = { isPublished: true, ...scopeFilter(universityId) };
    if (category) filter.category = category;

    let query = FaqArticle.find(filter);
    if (q) {
      filter.$text = { $search: q };
      query = FaqArticle.find(filter, { score: { $meta: 'textScore' } }).sort({ score: { $meta: 'textScore' } });
    } else {
      query = FaqArticle.find(filter).sort({ order: 1, helpfulCount: -1 });
    }

    const [faqs, total] = await Promise.all([
      query.skip((page - 1) * limit).limit(limit).lean(),
      FaqArticle.countDocuments(filter),
    ]);

    return { faqs, page, limit, total, pages: Math.ceil(total / limit) || 1 };
  }

  async categories(universityId) {
    const used = await FaqArticle.distinct('category', { isPublished: true, ...scopeFilter(universityId) });
    // Always return the full known list, not just categories with content yet —
    // the frontend can grey out empty ones instead of a chip disappearing.
    return SUPPORT_CATEGORIES.map((value) => ({ value, hasArticles: used.includes(value) }));
  }

  async getOne(universityId, id) {
    const faq = await FaqArticle.findOne({ _id: id, ...scopeFilter(universityId) });
    if (!faq) throw new AppError('Help article not found.', 404);

    faq.viewCount += 1;
    await faq.save();
    return faq.toObject();
  }

  async feedback(universityId, id, helpful) {
    const faq = await FaqArticle.findOne({ _id: id, ...scopeFilter(universityId) });
    if (!faq) throw new AppError('Help article not found.', 404);

    if (helpful) faq.helpfulCount += 1;
    else faq.notHelpfulCount += 1;
    await faq.save();

    return { helpfulCount: faq.helpfulCount, notHelpfulCount: faq.notHelpfulCount };
  }

  // Powers the "before you submit a ticket, did any of these help?" deflection
  // prompt, and doubles as the retrieval step for the chatbot in supportChat/.
  async suggest(universityId, text, limitCount = 5) {
    return FaqArticle.find(
      { isPublished: true, ...scopeFilter(universityId), $text: { $search: text } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(limitCount)
      .lean();
  }

  async listForAdmin(universityId, { category, page, limit }) {
    const filter = scopeFilter(universityId);
    if (category) filter.category = category;

    const [faqs, total] = await Promise.all([
      FaqArticle.find(filter).sort({ order: 1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      FaqArticle.countDocuments(filter),
    ]);
    return { faqs, page, limit, total, pages: Math.ceil(total / limit) || 1 };
  }

  async create(universityId, adminId, data) {
    const faq = await FaqArticle.create({
      ...data,
      universityId: data.universityId ?? universityId, // admins can still explicitly pass null to publish platform-wide, if authorized to
      createdBy: adminId,
      updatedBy: adminId,
    });

    // Audited against the acting admin's university, never the article's own
    // scope — a platform-wide article has universityId null, and the audit log
    // needs to know which tenant's admin published it.
    auditServiceClient.record({
      universityId,
      entityType: AUDIT_ENTITY.FAQ,
      entityId: faq._id.toString(),
      action: AUDIT_ACTION.FAQ_CREATED,
      performedBy: adminId,
      metadata: {
        category: faq.category,
        question: faq.question,
        isPublished: faq.isPublished,
        platformWide: faq.universityId === null,
      },
    });

    return faq.toObject();
  }

  async update(universityId, adminId, id, data) {
    const faq = await FaqArticle.findOneAndUpdate(
      { _id: id, ...scopeFilter(universityId) },
      { ...data, updatedBy: adminId },
      { new: true, runValidators: true }
    );
    if (!faq) throw new AppError('Help article not found.', 404);

    auditServiceClient.record({
      universityId,
      entityType: AUDIT_ENTITY.FAQ,
      entityId: faq._id.toString(),
      action: AUDIT_ACTION.FAQ_UPDATED,
      performedBy: adminId,
      // Field names only, not values: enough to see what was touched without
      // duplicating article bodies into the audit log on every edit.
      metadata: { fields: Object.keys(data), question: faq.question },
    });

    return faq.toObject();
  }

  async remove(universityId, adminId, id) {
    // Read before delete so the audit entry can say what was removed — after
    // deleteOne there is nothing left to describe.
    const faq = await FaqArticle.findOne({ _id: id, ...scopeFilter(universityId) }).lean();
    const result = await FaqArticle.deleteOne({ _id: id, ...scopeFilter(universityId) });
    if (result.deletedCount === 0) throw new AppError('Help article not found.', 404);

    auditServiceClient.record({
      universityId,
      entityType: AUDIT_ENTITY.FAQ,
      entityId: id,
      action: AUDIT_ACTION.FAQ_DELETED,
      performedBy: adminId,
      metadata: { category: faq?.category, question: faq?.question },
    });
  }
}

export default new FaqService();
