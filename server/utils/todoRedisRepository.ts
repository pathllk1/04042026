import { getRedisClient, getTodoKey, getUserTodosKey } from './redis';
import type { Todo, CreateTodoDto, UpdateTodoDto } from '../models/Todo';
import { v4 as uuidv4 } from 'uuid';

export const todoRedisRepository = {
  // Get all todos for a user
  async getAllTodos(userId: string): Promise<Todo[]> {
    const redis = getRedisClient();
    const userTodosKey = getUserTodosKey(userId);

    try {
      // Get all todo IDs for this user
      const todoIds = await redis.smembers(userTodosKey);

      if (!todoIds.length) {
        return [];
      }

      // Get each todo individually
      const todos: Todo[] = [];

      for (const id of todoIds) {
        try {
          const todoKey = getTodoKey(userId, id);
          const todoData = await redis.hgetall(todoKey);

          if (todoData && Object.keys(todoData).length > 0) {
            todos.push({
              id: id,
              content: String(todoData.content || ''),
              completed: String(todoData.completed) === 'true',
              category: String(todoData.category || ''),
              userId: userId,
              createdAt: new Date(String(todoData.createdAt || Date.now())),
              updatedAt: new Date(String(todoData.updatedAt || Date.now()))
            });
          } else {
            // Remove the orphaned ID from the set
            await redis.srem(userTodosKey, id);
          }
        } catch (todoError) {
          // Continue with the next todo
        }
      }

      return todos;
    } catch (error) {
      return [];
    }
  },

  // Get a single todo
  async getTodoById(userId: string, todoId: string): Promise<Todo | null> {
    const redis = getRedisClient();
    const todoKey = getTodoKey(userId, todoId);

    try {
      // First check if the todo ID exists in the user's set
      const userTodosKey = getUserTodosKey(userId);
      const isMember = await redis.sismember(userTodosKey, todoId);

      if (!isMember) {
        return null;
      }

      // Get the todo data
      const todoData = await redis.hgetall(todoKey);

      if (!todoData || Object.keys(todoData).length === 0) {
        // Remove the orphaned ID from the set
        await redis.srem(userTodosKey, todoId);
        return null;
      }

      // Convert the todo data to a Todo object
      const todo: Todo = {
        id: todoId,
        content: String(todoData.content || ''),
        completed: String(todoData.completed) === 'true',
        category: String(todoData.category || ''),
        userId: userId,
        createdAt: new Date(String(todoData.createdAt || Date.now())),
        updatedAt: new Date(String(todoData.updatedAt || Date.now()))
      };

      return todo;
    } catch (error) {
      return null;
    }
  },

  // Create a new todo
  async createTodo(userId: string, todoData: CreateTodoDto): Promise<Todo> {
    try {
      const redis = getRedisClient();
      const todoId = uuidv4();

      const todoKey = getTodoKey(userId, todoId);
      const userTodosKey = getUserTodosKey(userId);

      const now = new Date();

      // Create the todo object with all fields as strings for Redis
      const todoForRedis = {
        content: todoData.content,
        completed: todoData.completed ? 'true' : 'false',
        category: todoData.category || '',
        userId: userId,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };

      // Set the hash and add to user's set
      await redis.hset(todoKey, todoForRedis);
      await redis.sadd(userTodosKey, todoId);

      // Return the todo object with proper types
      return {
        id: todoId,
        content: todoData.content,
        completed: todoData.completed || false,
        category: todoData.category || '',
        userId: userId,
        createdAt: now,
        updatedAt: now
      };
    } catch (error) {
      throw error;
    }
  },

  // Update a todo
  async updateTodo(userId: string, todoId: string, updates: UpdateTodoDto): Promise<Todo | null> {
    const redis = getRedisClient();
    const todoKey = getTodoKey(userId, todoId);

    try {
      // Check if todo exists and belongs to user
      const existingTodo = await this.getTodoById(userId, todoId);
      if (!existingTodo) {
        return null;
      }

      const updateData: Record<string, string> = {
        updatedAt: new Date().toISOString()
      };

      if (updates.content !== undefined) {
        updateData.content = updates.content;
      }

      if (updates.category !== undefined) {
        updateData.category = updates.category || '';
      }

      if (updates.completed !== undefined) {
        updateData.completed = updates.completed ? 'true' : 'false';
      }

      // Update the todo fields
      await redis.hset(todoKey, updateData);

      // Get the updated todo
      return this.getTodoById(userId, todoId);
    } catch (error) {
      return null;
    }
  },

  // Delete a todo
  async deleteTodo(userId: string, todoId: string): Promise<boolean> {
    const redis = getRedisClient();
    const todoKey = getTodoKey(userId, todoId);
    const userTodosKey = getUserTodosKey(userId);

    try {
      // First check if the todo ID exists in the user's set
      const isMember = await redis.sismember(userTodosKey, todoId);

      if (!isMember) {
        return false;
      }

      // Delete the todo hash
      await redis.del(todoKey);

      // Remove the todo ID from the user's set
      await redis.srem(userTodosKey, todoId);

      return true;
    } catch (error) {
      return false;
    }
  },

  // Toggle todo completion status
  async toggleTodoCompletion(userId: string, todoId: string, completed: boolean): Promise<Todo | null> {
    return this.updateTodo(userId, todoId, { completed });
  }
};
