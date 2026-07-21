import faqService from '../services/faq.service.js';

class FaqController {
  async list(req, res, next) {
    try {
      const result = await faqService.list(req.universityId, req.query);
      res.success(result);
    } catch (err) {
      next(err);
    }
  }

  async categories(req, res, next) {
    try {
      const result = await faqService.categories(req.universityId);
      res.success(result);
    } catch (err) {
      next(err);
    }
  }

  async getOne(req, res, next) {
    try {
      const faq = await faqService.getOne(req.universityId, req.params.id);
      res.success(faq);
    } catch (err) {
      next(err);
    }
  }

  async feedback(req, res, next) {
    try {
      const result = await faqService.feedback(req.universityId, req.params.id, req.body.helpful);
      res.success(result, 'Thanks for the feedback');
    } catch (err) {
      next(err);
    }
  }

  async suggest(req, res, next) {
    try {
      const faqs = await faqService.suggest(req.universityId, req.body.text);
      res.success(faqs);
    } catch (err) {
      next(err);
    }
  }

  // ── Admin ──────────────────────────────────────────────────────────────
  async listForAdmin(req, res, next) {
    try {
      const result = await faqService.listForAdmin(req.universityId, req.query);
      res.success(result);
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const faq = await faqService.create(req.universityId, req.user.id, req.body);
      res.success(faq, 'Help article created', 201);
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const faq = await faqService.update(req.universityId, req.user.id, req.params.id, req.body);
      res.success(faq, 'Help article updated');
    } catch (err) {
      next(err);
    }
  }

  async remove(req, res, next) {
    try {
      await faqService.remove(req.universityId, req.params.id);
      res.success(null, 'Help article deleted');
    } catch (err) {
      next(err);
    }
  }
}

export default new FaqController();
