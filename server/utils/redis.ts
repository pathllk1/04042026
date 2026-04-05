import { Redis } from '@upstash/redis';
import { useRuntimeConfig } from '#imports';
// Initialize Redis client
export const getRedisClient = () => {
  try {
    const config = useRuntimeConfig();
    // Create a Redis client directly with the environment variables
    const redis = new Redis({
      url: config.UPSTASH_REDIS_REST_URL,
      token: config.UPSTASH_REDIS_REST_TOKEN,
    });

    return redis;
  } catch (error) {
    // Fallback to Redis.fromEnv() if direct initialization fails
    return Redis.fromEnv();
  }
};

// Generate a unique key for a todo item
export const getTodoKey = (userId: string, todoId: string) => {
  return `todo:${userId}:${todoId}`;
};

// Generate a key for the user's todo list
export const getUserTodosKey = (userId: string) => {
  return `todos:${userId}`;
};

// Generate a key for user's stock views
export const getUserStockViewsKey = (userId: string) => {
  return `stockviews:${userId}`;
};

// Generate a key for a specific stock view
export const getStockViewKey = (userId: string, viewId: string) => {
  return `stockview:${userId}:${viewId}`;
};
