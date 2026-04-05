// server/utils/roleCheck.ts
import { H3Event, createError, getRequestURL } from 'h3';
import { verifyToken } from './auth';
import { getRoleName } from './roles';

/**
 * Check if the user has the required role
 *
 * @param event The H3Event object
 * @param requiredRole The required role or array of roles
 * @returns The user object if the check passes
 * @throws 403 Forbidden error if the check fails
 */
export async function requireRole(event: H3Event, requiredRole: string | string[]) {
  // Get the user from the event context or verify token
  let user = event.context.user;

  if (!user) {
    try {
      user = await verifyToken(event);
    } catch (error: any) {
      throw createError({
        statusCode: 401,
        statusMessage: error.statusMessage || 'Unauthorized'
      });
    }
  }

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: User not found'
    });
  }

  // Get the role name from the roleId if it exists
  let roleName = user.role; // Default to the legacy role field
  if (user.roleId) {
    roleName = await getRoleName(user.roleId);
  }

  // Check if the user has the required role
  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

  if (!roles.includes(roleName)) {
    throw createError({
      statusCode: 403,
      statusMessage: `Forbidden: Requires ${roles.join(' or ')} role`
    });
  }

  return user;
}

/**
 * Check if the user is an admin
 *
 * @param event The H3Event object
 * @returns The user object if the user is an admin
 * @throws 403 Forbidden error if the user is not an admin
 */
export async function requireAdmin(event: H3Event) {
  return requireRole(event, 'admin');
}

/**
 * Check if the user is a manager or admin
 *
 * @param event The H3Event object
 * @returns The user object if the user is a manager or admin
 * @throws 403 Forbidden error if the user is not a manager or admin
 */
export async function requireManagerOrAdmin(event: H3Event) {
  return requireRole(event, ['manager', 'admin']);
}

/**
 * Check if the user is a specific role or admin
 * This is useful for endpoints that should be accessible by a specific role or admins
 *
 * @param event The H3Event object
 * @param role The role to check for (besides admin)
 * @returns The user object if the user has the required role or is an admin
 * @throws 403 Forbidden error if the user doesn't have the required role and is not an admin
 */
export async function requireRoleOrAdmin(event: H3Event, role: string) {
  return requireRole(event, [role, 'admin']);
}
