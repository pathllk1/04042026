import { defineEventHandler, createError, readBody } from 'h3';
import type { UpdateTodoDto } from '../../models/Todo';
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

  const id = event.context.params?.id;
  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Todo ID is required'
    });
  }

  // GET - Get a specific todo
  if (event.method === 'GET') {
    try {
      const todo = await todoRedisRepository.getTodoById(userId, id);

      if (!todo) {
        throw createError({
          statusCode: 404,
          message: 'Todo not found'
        });
      }

      return todo;
    } catch (error) {
      if (error.statusCode === 404) {
        throw error;
      }

      throw createError({
        statusCode: 500,
        message: 'Failed to fetch todo'
      });
    }
  }

  // PUT - Update a todo
  if (event.method === 'PUT') {
    try {
      const body = await readBody(event) as UpdateTodoDto;
      const updates: UpdateTodoDto = {};

      // Only update fields that are provided
      if (body.content !== undefined) {
        updates.content = sanitizeText(body.content);
      }

      if (body.category !== undefined) {
        updates.category = sanitizeText(body.category);
      }

      if (body.completed !== undefined) {
        updates.completed = body.completed;
      }

      const updatedTodo = await todoRedisRepository.updateTodo(userId, id, updates);

      if (!updatedTodo) {
        throw createError({
          statusCode: 404,
          message: 'Todo not found'
        });
      }

      return updatedTodo;
    } catch (error) {
      if (error.statusCode === 404) {
        throw error;
      }

      throw createError({
        statusCode: 500,
        message: 'Failed to update todo'
      });
    }
  }

  // DELETE - Delete a todo
  if (event.method === 'DELETE') {
    try {
      const success = await todoRedisRepository.deleteTodo(userId, id);

      if (!success) {
        throw createError({
          statusCode: 404,
          message: 'Todo not found'
        });
      }

      return { success: true };
    } catch (error) {
      if (error.statusCode === 404) {
        throw error;
      }

      throw createError({
        statusCode: 500,
        message: 'Failed to delete todo'
      });
    }
  }

  throw createError({
    statusCode: 405,
    message: 'Method not allowed'
  });
});
