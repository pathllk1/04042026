// server/api/users/index.ts
import { defineEventHandler, readBody, createError } from 'h3';
import User from '../../models/User';
import { verifyToken } from '../../utils/auth';
import { getRoleId, getRoleName } from '../../utils/roles';
import { Types } from 'mongoose';

interface UserDocument {
  _id: Types.ObjectId;
  role: string;
  roleId?: string;
  status: number;
  save(): Promise<UserDocument>;
}

export default defineEventHandler(async (event) => {
  // Verify admin authentication for all requests
  const user = await verifyToken(event);
  if (user.role !== 'admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: Only admins can manage users'
    });
  }

  // Helper function to convert numeric status to string
  const getStatusString = (status: number | null): string => {
    switch (status) {
      case 1: return 'Approved';
      case -1: return 'Rejected';
      case 0: return 'Pending';
      default: return 'Pending';
    }
  };

  // GET - List all users
  if (event.node.req.method === 'GET') {
    const users = await User.find()
      .select('-password')
      .populate('firmId', 'name code')
      .sort({ createdAt: -1 });

    // Convert numeric status to string and roleId to role name in response
    const formattedUsers = await Promise.all(users.map(async user => {
      // Get the role name from the roleId if it exists
      let roleName = user.role; // Default to the legacy role field
      if (user.roleId) {
        roleName = await getRoleName(user.roleId);
      }

      return {
        ...user.toObject(),
        status: getStatusString(user.status),
        role: roleName // Return the role name (string) to the UI
      };
    }));

    return { users: formattedUsers };
  }

  // PUT - Update user role or status
  if (event.node.req.method === 'PUT') {
    const { id, role, status } = await readBody(event);

    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'User ID is required'
      });
    }

    // Find the user
    const targetUser = await User.findById(id) as UserDocument | null;
    if (!targetUser) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found'
      });
    }

    // Prevent changing own role
    if (targetUser._id.toString() === (user._id as Types.ObjectId).toString()) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Cannot modify your own role'
      });
    }

    // Update role if provided
    if (role) {
      // Validate role
      if (!['user', 'manager', 'admin'].includes(role)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid role'
        });
      }

      // Update both role and roleId
      targetUser.role = role;

      // Get the roleId for the role
      const roleId = await getRoleId(role);
      targetUser.roleId = roleId;
    }

    // Update status if provided
    if (status !== undefined) {
      // Validate status
      if (![-1, 0, 1].includes(status)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid status. Must be -1 (rejected), 0 (pending), or 1 (approved)'
        });
      }
      targetUser.status = status;
    }

    await targetUser.save();

    // Return user without password
    const updatedUser = await User.findById(id)
      .select('-password')
      .populate('firmId', 'name code');

    // Get the role name from the roleId if it exists
    let roleName = updatedUser.role; // Default to the legacy role field
    if (updatedUser.roleId) {
      roleName = await getRoleName(updatedUser.roleId);
    }

    return {
      message: 'User updated successfully',
      user: {
        ...updatedUser.toObject(),
        status: getStatusString(updatedUser.status),
        role: roleName // Return the role name (string) to the UI
      }
    };
  }

  // DELETE - Delete a user
  if (event.node.req.method === 'DELETE') {
    const { id } = await readBody(event);

    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'User ID is required'
      });
    }

    // Prevent self-deletion
    if (id === ((user as { _id: Types.ObjectId })._id).toString()) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Cannot delete your own account'
      });
    }

    const result = await User.findByIdAndDelete(id);
    if (!result) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found'
      });
    }

    return { message: 'User deleted successfully' };
  }
});