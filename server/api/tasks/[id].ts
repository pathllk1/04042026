import { defineEventHandler, createError, readBody } from 'h3';
import { getFirestore } from 'firebase-admin/firestore';
import type { UpdateTaskDto } from '../../models/Task';

// Sanitize text content
function sanitizeText(text: string): string {
  if (!text) return '';

  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
}

export default defineEventHandler(async (event) => {
  const userId = event.context.userId;
  if (!userId) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    });
  }

  const id = event.context.params?.id;
  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Task ID is required'
    });
  }

  const db = getFirestore();
  const taskRef = db.collection('tasks').doc(id);

  // GET - Get a specific task
  if (event.method === 'GET') {
    const doc = await taskRef.get();
    if (!doc.exists) {
      throw createError({
        statusCode: 404,
        message: 'Task not found'
      });
    }

    const task = doc.data();
    if (task.userId !== userId) {
      throw createError({
        statusCode: 403,
        message: 'Access denied'
      });
    }

    return {
      id: doc.id,
      ...task
    };
  }

  // PUT - Update a task
  if (event.method === 'PUT') {
    const doc = await taskRef.get();
    if (!doc.exists) {
      throw createError({
        statusCode: 404,
        message: 'Task not found'
      });
    }

    const task = doc.data();
    if (task.userId !== userId) {
      throw createError({
        statusCode: 403,
        message: 'Access denied'
      });
    }

    const body = await readBody(event) as UpdateTaskDto;
    const updates: any = {
      updatedAt: new Date()
    };

    // Only update fields that are provided
    if (body.title !== undefined) {
      updates.title = sanitizeText(body.title);
    }

    if (body.description !== undefined) {
      updates.description = sanitizeText(body.description);
    }

    if (body.dueDate !== undefined) {
      updates.dueDate = body.dueDate;
    }

    if (body.priority !== undefined) {
      updates.priority = body.priority;
    }

    if (body.status !== undefined) {
      updates.status = body.status;
    }

    await taskRef.update(updates);
    const updatedDoc = await taskRef.get();

    return {
      id: updatedDoc.id,
      ...updatedDoc.data()
    };
  }

  // DELETE - Delete a task
  if (event.method === 'DELETE') {
    const doc = await taskRef.get();
    if (!doc.exists) {
      throw createError({
        statusCode: 404,
        message: 'Task not found'
      });
    }

    const task = doc.data();
    if (task.userId !== userId) {
      throw createError({
        statusCode: 403,
        message: 'Access denied'
      });
    }

    await taskRef.delete();
    return { success: true };
  }

  throw createError({
    statusCode: 405,
    message: 'Method not allowed'
  });
});
