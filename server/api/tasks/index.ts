import { defineEventHandler, createError, readBody } from 'h3';
import { getFirestore } from 'firebase-admin/firestore';
import type { Task, CreateTaskDto } from '../../models/Task';
import sanitizeHtml from 'sanitize-html';

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

  const db = getFirestore();

  // GET - List all tasks for the user
  if (event.method === 'GET') {
    const tasksRef = db.collection('tasks');
    const snapshot = await tasksRef.where('userId', '==', userId).get();

    if (snapshot.empty) {
      return [];
    }

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  // POST - Create a new task
  if (event.method === 'POST') {
    try {
      const body = await readBody(event) as CreateTaskDto;
      const { title, description, dueDate, priority, status } = body;

      if (!title) {
        throw createError({
          statusCode: 400,
          message: 'Title is required'
        });
      }

      // Sanitize user input
      const sanitizedTitle = sanitizeText(title);
      const sanitizedDescription = description ? sanitizeText(description) : '';

      const task: Task = {
        title: sanitizedTitle,
        description: sanitizedDescription,
        dueDate: dueDate || null,
        priority: priority || 'medium',
        status: status || 'pending',
        userId: userId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = await db.collection('tasks').add(task);
      const newTask = await docRef.get();

      const taskData = newTask.data();
      const response = {
        id: docRef.id,
        ...taskData
      };

      return response;
    } catch (error) {
      throw error;
    }
  }

  throw createError({
    statusCode: 405,
    message: 'Method not allowed'
  });
});
