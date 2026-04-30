import Counter from '../models/Counter.js';

const USER_COUNTER_ID = 'user';

/** Next global user record number (1, 2, 3, …). Safe under concurrent invites. */
export async function nextUserIncrementalId() {
  const doc = await Counter.findByIdAndUpdate(
    USER_COUNTER_ID,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return doc.seq;
}
