// server/api/users/firm.ts
import { defineEventHandler, createError } from 'h3';
import User from '../../models/User';
import { verifyToken } from '../../utils/auth';
import { getRoleName } from '../../utils/roles';
import { requireManagerOrAdmin } from '../../utils/roleCheck';

export default defineEventHandler(async (event) => {
  try {
    // Verify authentication and ensure user is a manager or admin
    const currentUser = await requireManagerOrAdmin(event);

    // Helper function to convert numeric status to string
    const getStatusString = (status: number): string => {
      switch (status) {
        case 1: return 'Approved';
        case -1: return 'Rejected';
        case 0: return 'Pending';
        default: return 'Pending';
      }
    };

    // Get users from the same firm
    const users = await User.find({ firmId: currentUser.firmId })
      .select('-password')
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
  } catch (error) {
    throw error;
  }
});