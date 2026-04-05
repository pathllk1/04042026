// server/utils/auth.ts
import { H3Event, createError } from 'h3';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { getRoleId, getRoleName } from './roles';
import { useRuntimeConfig } from '#imports';

interface JwtPayload {
  id: string;
  userId?: string;
  role?: string;
  roleId?: string;
  status?: number;
  sessionId?: string;
}

// Verify the JWT token from the request
export async function verifyToken(event: H3Event) {
  // Get token from cookie or authorization header
  const token = getCookie(event, 'token') || getRequestHeader(event, 'authorization')?.split(' ')[1];

  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: No token provided'
    });
  }

  try {
    const config = useRuntimeConfig();
    // Verify the token using process.env.JWT_SECRET directly instead of config.jwtSecret
    const secret = config.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }

    const decoded = jwt.verify(token, secret) as JwtPayload;

    // Get user from database - support both id and userId fields from token
    const userId = decoded.id || decoded.userId;
    const user = await User.findById(userId);
    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: User not found'
      });
    }

    // Additional session validation if sessionId is present
    if (decoded.sessionId) {
      if (!user.activeSessions || !user.activeSessions.includes(decoded.sessionId)) {
        throw createError({
          statusCode: 401,
          statusMessage: 'Unauthorized: Session expired or invalid'
        });
      }
    }

    // Get or create roleId if it doesn't exist
    if (!user.roleId) {
      // Get the roleId for the user's role
      user.roleId = await getRoleId(user.role);
      await user.save();
    }

    // Get the role name for the status check
    const roleName = await getRoleName(user.roleId);

    // Check user status - only allow approved users and managers to access protected routes
    // Admins are exempt from this restriction
    if (roleName !== 'admin') {
      // For users and managers, check if they are approved (status = 1)
      if (user.status !== 1) {
        if (user.status === 0) {
          throw createError({
            statusCode: 403,
            statusMessage: 'Your account is pending approval. Please contact your manager.'
          });
        } else if (user.status === -1) {
          throw createError({
            statusCode: 403,
            statusMessage: 'Your account has been rejected. Please contact your manager for assistance.'
          });
        } else {
          throw createError({
            statusCode: 403,
            statusMessage: 'Your account is not active. Please contact your manager.'
          });
        }
      }
    }

    return user;
  } catch (error: any) {
    console.error('Token verification error:', error.message || error);

    // Provide more specific error messages based on the type of JWT error
    if (error.name === 'TokenExpiredError') {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: Token has expired'
      });
    } else if (error.name === 'JsonWebTokenError') {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: Invalid token signature'
      });
    } else if (error.name === 'NotBeforeError') {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: Token not yet active'
      });
    } else {
      throw createError({
        statusCode: 401,
        statusMessage: `Unauthorized: ${error.message || 'Invalid token'}`
      });
    }
  }
}

// Check if user has required role
export async function checkRole(user: any, requiredRoles: string[]) {
  // Get the role name if we have a roleId
  let roleName = user.role;
  if (user.roleId) {
    roleName = await getRoleName(user.roleId);
  }

  if (!requiredRoles.includes(roleName)) {
    throw createError({
      statusCode: 403,
      statusMessage: `Forbidden: Requires ${requiredRoles.join(' or ')} role`
    });
  }
  return true;
}

// Get user from event
export async function getUserFromEvent(event: H3Event) {
  return await verifyToken(event);
}