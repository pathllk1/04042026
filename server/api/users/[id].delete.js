/**
 * API endpoint for deleting a user
 */
import { defineEventHandler, createError } from 'h3';
import { getUserFromEvent } from '../../utils/auth';
import User from '../../models/User';

export default defineEventHandler(async (event) => {
  try {
    // Get the authenticated user
    const user = await getUserFromEvent(event);
    if (!user) {
      throw createError({
        statusCode: 401,
        message: 'Unauthorized'
      });
    }

    // Check if user is a manager or admin
    if (user.role !== 'manager' && user.role !== 'admin') {
      throw createError({
        statusCode: 403,
        message: 'Forbidden: Only managers and admins can delete users'
      });
    }

    // Get the user ID from the URL
    const userId = event.context.params.id;
    if (!userId) {
      throw createError({
        statusCode: 400,
        message: 'User ID is required'
      });
    }

    // Check if the user is trying to delete themselves
    if (user._id.toString() === userId) {
      throw createError({
        statusCode: 400,
        message: 'You cannot delete your own account'
      });
    }

    // Find the user to delete
    const userToDelete = await User.findById(userId);
    if (!userToDelete) {
      throw createError({
        statusCode: 404,
        message: 'User not found'
      });
    }

    // Check if the user belongs to the same firm
    if (userToDelete.firmId.toString() !== user.firmId.toString()) {
      throw createError({
        statusCode: 403,
        message: 'Forbidden: You can only delete users in your own firm'
      });
    }

    // Check if trying to delete an admin (only admins can delete other admins)
    if (userToDelete.role === 'admin' && user.role !== 'admin') {
      throw createError({
        statusCode: 403,
        message: 'Forbidden: Only admins can delete other admins'
      });
    }

    // Check if a manager is trying to delete another manager
    if (user.role === 'manager' && userToDelete.role === 'manager') {
      throw createError({
        statusCode: 403,
        message: 'Forbidden: Managers cannot delete other managers'
      });
    }

    // Delete the user
    await User.findByIdAndDelete(userId);

    // Return success response
    return {
      success: true,
      message: 'User deleted successfully'
    };
  } catch (error) {
    console.error('Error in delete user API:', error);

    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error'
    });
  }
});
