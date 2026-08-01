import 'dotenv/config';
import mongoose from 'mongoose';
import Ticket from '../src/models/Ticket.model.js';

// X19: the old text index ({ subject: 'text', description: 'text' }) has no
// universityId prefix, so every $text search scanned all tenants' tickets
// before the tenant filter applied. MongoDB allows only one text index per
// collection, so the old one must be dropped before the new compound one
// (ticket_tenant_text, defined on the schema) can be created.
//
// Usage: MONGODB_URI=<support-service connection string> node scripts/migrateTicketTextIndex.js

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected.');

  const collection = Ticket.collection;
  const existing = await collection.indexes();
  const oldTextIndex = existing.find((idx) => idx.textIndexVersion && idx.name !== 'ticket_tenant_text');

  if (oldTextIndex) {
    console.log(`Dropping old text index: ${oldTextIndex.name}`);
    await collection.dropIndex(oldTextIndex.name);
  } else {
    console.log('No old text index found (already migrated, or collection is new).');
  }

  console.log('Creating ticket_tenant_text ({ universityId: 1, subject: text, description: text })...');
  await Ticket.syncIndexes();

  const after = await collection.indexes();
  console.log('Current indexes:', after.map((i) => i.name));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
