import { Counter } from './models.js';

export async function nextSeq(name) {
  const doc = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return doc.seq;
}

export async function nextMemberCode() {
  const n = await nextSeq('member');
  return `APX-${n}`;
}

export async function nextInvoice() {
  const n = await nextSeq('invoice');
  return `INV-${n}`;
}
