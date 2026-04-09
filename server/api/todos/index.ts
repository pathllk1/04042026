import { defineEventHandler, createError, readBody } from 'h3';
import type { CreateTodoDto } from '../../models/Todo';
import { todoRedisRepository } from '../../utils/todoRedisRepository';

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

  // GET - List all todos for the user
  if (event.method === 'GET') {
    try {
      const todos = await todoRedisRepository.getAllTodos(userId);
      return todos;
    } catch (error) {
      throw createError({
        statusCode: 500,
        message: 'Failed to fetch todos'
      });
    }
  }

  // POST - Create a new todo
  if (event.method === 'POST') {
    try {
      const body = await readBody(event) as CreateTodoDto;
      const { content, category, completed } = body;

      if (!content) {
        throw createError({
          statusCode: 400,
          message: 'Content is required'
        });
      }

      // Sanitize user input
      const sanitizedContent = sanitizeText(content);
      const sanitizedCategory = category ? sanitizeText(category) : '';

      const todoData = {
        content: sanitizedContent,
        category: sanitizedCategory,
        completed: completed || false
      };

      const newTodo = await todoRedisRepository.createTodo(userId, todoData);
      return newTodo;
    } catch (error) {
      throw createError({
        statusCode: 500,
        message: 'Failed to create todo'
      });
    }
  }

  throw createError({
    statusCode: 405,
    message: 'Method not allowed'
  });
});
