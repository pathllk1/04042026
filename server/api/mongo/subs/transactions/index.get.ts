import { defineEventHandler, getQuery, createError } from 'h3';
import { SubsModel, SubsTxnModel as SubsTxn } from '../../../../models/expenses/Subs.model';

export default defineEventHandler(async (event) => {
  const userId = (event as any).context.userId;
  const firmId = (event as any).context.user?.firmId;
  if (!userId || !firmId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  const q = getQuery(event);
  if (!q.subsModelId) throw createError({ statusCode: 400, statusMessage: 'subsModelId is required' });

  const subsModelId = String(q.subsModelId);

  // Fetch the sub to get its name for fallback matching
  let subName: string | undefined;
  try {
    const subDoc = await SubsModel().findOne({ _id: subsModelId, firmId: String(firmId) }).lean();
    subName = subDoc?.name;
  } catch {}

  // Primary match by subsModelId. Fallback by subName to accommodate legacy Firestore imports
  const orConditions: any[] = [{ subsModelId }];
  if (subName) {
    orConditions.push({ subName });
  }

  const txns = await SubsTxn()
    .find({ firmId: String(firmId), $or: orConditions })
    .sort({ date: -1 })
    .lean();

  return txns.map((doc: any) => ({ ...doc, id: String(doc._id) }));
});

