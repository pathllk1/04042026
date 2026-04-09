import { NSE } from '../../models/NSE';
import { Folio } from '../../models/Folio';
import CNNoteModel, { CNNote } from '../../models/CNNote';

// Get all NSE records
export const GET = defineEventHandler(async (event) => {
  try {
    const nseRecords = await NSE.find();
    return nseRecords;
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: 'Error retrieving NSE records'
    });
  }
});

// Add or update NSE data
export const POST = defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { formData, recordsData } = body;

    // Create CN Note
    const cnNote = await CNNote.create({
      ...formData,
      user: event.context.auth?.user?.id
    });

    // Create Folio records
    const folioRecords = await Promise.all(
      recordsData.map(async (record: any) => {
        const folioData = {
          ...record,
          user: event.context.auth?.user?.id,
          cnNoteId: cnNote._id
        };
        return await Folio.create(folioData);
      })
    );

    // Update CN Note with Folio records
    await CNNote.findByIdAndUpdate(cnNote._id, {
      $push: { Folio_rec: { $each: folioRecords.map(r => r._id) } }
    });

    return {
      message: 'Data added successfully',
      cnNote,
      folioRecords
    };
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: 'Error adding NSE data'
    });
  }
});

// Update NSE data
export const PUT = defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { formData, recordsData } = body;

    // Update CN Note
    const cnNote = await CNNote.findByIdAndUpdate(
      formData.id,
      { ...formData, user: event.context.auth?.user?.id },
      { new: true }
    );

    // Update Folio records
    const folioRecords = await Promise.all(
      recordsData.map(async (record: any) => {
        if (record._id) {
          return await Folio.findByIdAndUpdate(
            record._id,
            { ...record, user: event.context.auth?.user?.id },
            { new: true }
          );
        } else {
          return await Folio.create({
            ...record,
            user: event.context.auth?.user?.id,
            cnNoteId: cnNote?._id
          });
        }
      })
    );

    return {
      message: 'Data updated successfully',
      cnNote,
      folioRecords
    };
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: 'Error updating NSE data'
    });
  }
});