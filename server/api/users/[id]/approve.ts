// server/api/users/[id]/approve.ts
import { defineEventHandler, createError } from 'h3';
import User from '../../../models/User';
import { verifyToken } from '../../../utils/auth';
import { getRoleName } from '../../../utils/roles';
import { requireManagerOrAdmin } from '../../../utils/roleCheck';
import { Types } from 'mongoose';

export default defineEventHandler(async (event) => {
  console.log('Approve user endpoint called');
  // Verify authentication and role using the centralized role check utility
  const currentUser = await requireManagerOrAdmin(event);
  console.log('Current user:', currentUser);

  const id = event.context.params?.id;
  console.log('User ID to approve:', id);
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'User ID is required'
    });
  }

  try {
    // Find the user to approve
    console.log('Finding user by ID:', id);
    const targetUser = await User.findById(id);
    console.log('Target user found:', targetUser ? 'Yes' : 'No');

    if (!targetUser) {
      console.log('User not found');
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found'
      });
    }

    console.log('Target user details:', {
      id: targetUser._id,
      username: targetUser.username,
      role: targetUser.role,
      status: targetUser.status,
      firmId: targetUser.firmId
    });

    // If current user is a manager, they can only approve users in their firm
    if (currentUser.role === 'manager') {
      console.log('Current user is a manager, checking firm');
      console.log('Target user firmId:', targetUser.firmId.toString());
      console.log('Current user firmId:', currentUser.firmId.toString());

      // Check if the target user is in the same firm as the manager
      if (targetUser.firmId.toString() !== currentUser.firmId.toString()) {
        console.log('User is not in the same firm');
        throw createError({
          statusCode: 403,
          statusMessage: 'Forbidden: You can only approve users in your firm'
        });
      }

      // Managers can only approve users with 'user' role
      console.log('Checking if target user has user role');
      if (targetUser.role !== 'user') {
        console.log('Target user is not a user role');
        throw createError({
          statusCode: 403,
          statusMessage: 'Forbidden: Managers can only approve users with user role'
        });
      }
    }

    // Update user status to approved (1)
    console.log('Updating user status to approved (1)');
    targetUser.status = 1;
    await targetUser.save();
    console.log('User status updated successfully');

    // Helper function to convert numeric status to string
    const getStatusString = (status: number): string => {
      switch (status) {
        case 1: return 'Approved';
        case -1: return 'Rejected';
        case 0: return 'Pending';
        default: return 'Pending';
      }
    };

    // Return user without password
    console.log('Fetching updated user');
    const updatedUser = await User.findById(id)
      .select('-password')
      .populate('firmId', 'name code');

    // Get the role name from the roleId if it exists
    let roleName = updatedUser.role; // Default to the legacy role field
    if (updatedUser.roleId) {
      roleName = await getRoleName(updatedUser.roleId);
    }

    console.log('Returning response');
    return {
      message: 'User approved successfully',
      user: {
        ...updatedUser.toObject(),
        status: getStatusString(updatedUser.status),
        role: roleName // Return the role name (string) to the UI
      }
    };
  } catch (error: unknown) {
    console.log('Error in approve user endpoint:', error);
    if (error && typeof error === 'object' && 'name' in error && error.name === 'CastError') {
      console.log('CastError detected, invalid ID format');
      throw createError({ statusCode: 400, statusMessage: 'Invalid user ID format' });
    }
    console.log('Rethrowing error');
    throw error;
  }
});
