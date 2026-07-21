// Seeds a starter set of platform-wide FAQs (universityId: null) so the help
// center has real content on day one instead of an empty state. Safe to run
// more than once — it upserts on the question text rather than duplicating.
//
// Usage: npm run seed:faqs

import mongoose from 'mongoose';
import env from '../src/config/env.js';
import FaqArticle from '../src/models/FaqArticle.model.js';

const STARTER_FAQS = [
  {
    category: 'ACCOUNT_LOGIN',
    question: 'How do I reset my password?',
    answer: 'Go to the login page and select "Forgot password". Enter your university email and you\'ll receive a reset link valid for 30 minutes. If you don\'t see the email, check your spam folder before raising a ticket.',
    tags: ['password', 'login', 'reset'],
  },
  {
    category: 'ACCOUNT_LOGIN',
    question: 'Why does it say my account is deactivated?',
    answer: 'Accounts are deactivated by a university admin, usually after a student graduates or a role changes. If you believe this is a mistake, raise a ticket with your roll number so an admin can review it.',
    tags: ['account', 'deactivated', 'login'],
  },
  {
    category: 'EVENTS_APPROVALS',
    question: 'Why is my event approval stuck in pending?',
    answer: 'Events move through your club\'s configured approval chain one step at a time. Check the event\'s timeline to see who the pending approver is — if it has been more than a few days, a polite nudge to that approver usually resolves it faster than a ticket.',
    tags: ['event', 'approval', 'pending'],
  },
  {
    category: 'EVENTS_APPROVALS',
    question: 'Why can\'t I submit my event completion report?',
    answer: 'Event completion reports can only be submitted after the event\'s scheduled end date/time has passed, and only by the event\'s original organizer or a club lead. Double check both before raising a ticket.',
    tags: ['ecr', 'event completion report', 'submit'],
  },
  {
    category: 'BUDGETS_SETTLEMENTS',
    question: 'Why isn\'t my budget reflecting after settlement?',
    answer: 'Settlement amounts are applied once a treasurer or admin marks the settlement as approved, not at the moment you submit receipts. This can take a few days depending on your club\'s review cycle.',
    tags: ['budget', 'settlement', 'reimbursement'],
  },
  {
    category: 'CLUBS_MEMBERSHIP',
    question: 'How long does a membership application take to review?',
    answer: 'This depends entirely on your club\'s process — some clubs auto-approve, others review manually. Check your application\'s status on your dashboard; if it has been pending for over two weeks, it\'s worth reaching out to the club directly.',
    tags: ['membership', 'application', 'join'],
  },
  {
    category: 'LEADERBOARD_BADGES',
    question: 'How does leaderboard XP get calculated?',
    answer: 'XP is awarded automatically for actions like attending events, organizing approved events, and completing your profile. The exact scoring rules are set per university by admins, so totals can vary between universities.',
    tags: ['leaderboard', 'xp', 'points', 'badges'],
  },
  {
    category: 'ROLES_PERMISSIONS',
    question: 'What\'s the difference between a Coordinator and a Club Lead?',
    answer: 'A Club Lead has full control over their club, including budgets and membership. A Coordinator is a more limited role, typically scoped to specific events or tasks a Club Lead assigns them. Ask your Club Lead if you\'re unsure which you have.',
    tags: ['roles', 'permissions', 'coordinator', 'club lead'],
  },
  {
    category: 'TECHNICAL_ISSUE',
    question: 'The page won\'t load or looks broken — what should I try first?',
    answer: 'Try a hard refresh (Ctrl+Shift+R or Cmd+Shift+R), then clearing your browser cache if that doesn\'t help. If you\'re on a university network, some campus wifi setups block parts of the app — trying mobile data can confirm whether that\'s the cause.',
    tags: ['bug', 'broken', 'not loading', 'technical'],
  },
];

async function run() {
  await mongoose.connect(env.mongoUri);
  console.log(`Connected. Seeding ${STARTER_FAQS.length} starter FAQs...`);

  for (const faq of STARTER_FAQS) {
    await FaqArticle.findOneAndUpdate(
      { question: faq.question, universityId: null },
      { $set: { ...faq, universityId: null, isPublished: true } },
      { upsert: true, new: true }
    );
    console.log(`  ✓ ${faq.question}`);
  }

  console.log('Done.');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
