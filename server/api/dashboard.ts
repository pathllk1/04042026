// server/api/dashboard.ts
import { defineEventHandler, createError } from 'h3';
import User from '../models/User';
import { getRoleName } from '../utils/roles';

export default defineEventHandler(async (event) => {
  // User is already authenticated by the middleware
  // and available in event.context.userId
  const userId = event.context.userId;

  // Fetch the user data from the database using userId
  const user = await User.findById(userId);

  if (!user) {
    throw createError({
      statusCode: 404,
      message: 'User not found'
    });
  }

  // Get the role name from the roleId if it exists
  let roleName = user.role; // Default to the legacy role field
  if (user.roleId) {
    roleName = await getRoleName(user.roleId);
  }

  // Helper function to convert numeric status to string
  const getStatusString = (status: number): string => {
    switch (status) {
      case 1: return 'Approved';
      case -1: return 'Rejected';
      case 0: return 'Pending';
      default: return 'Pending';
    }
  };

  return {
    message: 'Authenticated',
    user: {
      id: userId,
      username: user.username,
      email: user.email,
      fullname: user.fullname,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      role: roleName, // Return the role name (string) to the UI
      roleId: user.roleId, // Include the roleId for internal use
      status: getStatusString(user.status) // Convert numeric status to string
    }
  };
});
