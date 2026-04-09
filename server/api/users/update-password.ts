// server/api/users/update-password.ts
import { defineEventHandler, readBody, createError } from 'h3';
import { verifyToken } from '../../utils/auth';
import User from '../../models/User';
import bcrypt from 'bcryptjs';
import { passwordValidator } from '../../utils/passwordPolicy';
import { emailService } from '../../utils/emailService';

export default defineEventHandler(async (event) => {
  try {
    // Verify authentication
    const currentUser = await verifyToken(event);
    
    // Get request body
    const { currentPassword, newPassword } = await readBody(event);

    // Validate required fields
    if (!currentPassword || !newPassword) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Current password and new password are required'
      });
    }

    // Find the user in the database
    const user = await User.findById(currentUser.id);
    if (!user) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found'
      });
    }

    // Validate new password against policy
    const validationResult = passwordValidator.validatePassword(
      newPassword,
      {
        username: currentUser.username,
        email: currentUser.email,
        fullname: currentUser.fullname
      },
      user.passwordHistory
    );

    if (!validationResult.isValid) {
      throw createError({
        statusCode: 400,
        statusMessage: validationResult.errors.join('. ')
      });
    }

    
    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Current password is incorrect'
      });
    }
    
    // Hash the new password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Add current password to history before updating
    if (user.password) {
      if (!user.passwordHistory) {
        user.passwordHistory = [];
      }

      // Keep only last 5 passwords
      user.passwordHistory.unshift(user.password);
      if (user.passwordHistory.length > 5) {
        user.passwordHistory = user.passwordHistory.slice(0, 5);
      }
    }

    // Update the user's password and related fields
    user.password = hashedPassword;
    user.lastPasswordChange = new Date();

    // Clear all active sessions except current one (force re-login on other devices)
    const currentSessionId = (currentUser as any).sessionId;
    if (currentSessionId && user.activeSessions) {
      user.activeSessions = user.activeSessions.filter(id => id === currentSessionId);
    }

    await user.save();

    // Send password change notification
    try {
      await emailService.sendPasswordChangeNotification(user.email, user.fullname);
    } catch (emailError) {
      console.error('Failed to send password change notification:', emailError);
      // Don't fail the password change if email fails
    }
    
    return {
      success: true,
      message: 'Password updated successfully',
      passwordStrength: validationResult.strength
    };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to update password'
    });
  }
});
