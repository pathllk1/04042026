/**
 * User role and permissions utility
 * This composable provides functions to check user roles and permissions
 */
import { useCookie } from '#app';

// Import role constants and hierarchy
const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  USER: 'user',
  SUB_CONTRACTOR: 'sub-contractor'
};

// Role hierarchy (higher index = higher privileges)
const ROLE_HIERARCHY = [
  ROLES.SUB_CONTRACTOR,
  ROLES.USER,
  ROLES.MANAGER,
  ROLES.ADMIN
];

export default function useUserRole() {
  const tokenCookie = useCookie('access_token');

  /**
   * Decode the JWT token to get the payload
   * @param {string} token - The JWT token to decode
   * @returns {object|null} - The decoded token payload or null
   */
  const decodeToken = (token) => {
    if (!token) return null;

    try {
      // For client-side
      if (process.client) {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(base64));
      }
      // For server-side
      else {
        const base64 = token.split('.')[1];
        return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
      }
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  };

  /**
   * Get the current user's role from the token
   * @returns {string|null} - The user's role or null if not authenticated
   */
  const getUserRole = () => {
    const token = tokenCookie.value;
    if (!token) return null;

    const payload = decodeToken(token);
    return payload?.role || null;
  };

  /**
   * Check if the current user has a specific role
   * @param {string|string[]} roles - The role(s) to check
   * @returns {boolean} - True if the user has any of the specified roles
   */
  const hasRole = (roles) => {
    const userRole = getUserRole();
    if (!userRole) return false;

    if (Array.isArray(roles)) {
      return roles.includes(userRole);
    }

    return userRole === roles;
  };

  /**
   * Check if the current user has a role with equal or higher privileges
   * @param {string} requiredRole - The minimum required role
   * @returns {boolean} - True if the user has equal or higher privileges
   */
  const hasRolePrivilege = (requiredRole) => {
    const userRole = getUserRole();
    if (!userRole) return false;

    const userRoleIndex = ROLE_HIERARCHY.indexOf(userRole);
    const requiredRoleIndex = ROLE_HIERARCHY.indexOf(requiredRole);

    // If either role is not found in the hierarchy, return false
    if (userRoleIndex === -1 || requiredRoleIndex === -1) {
      return false;
    }

    // Return true if the user's role has equal or higher privileges
    return userRoleIndex >= requiredRoleIndex;
  };

  /**
   * Check if the current user is a sub-contractor
   * @returns {boolean} - True if the user is a sub-contractor
   */
  const isSubContractor = () => {
    return hasRole('sub-contractor');
  };

  /**
   * Check if the current user is a manager
   * @returns {boolean} - True if the user is a manager
   */
  const isManager = () => {
    return hasRole('manager');
  };

  /**
   * Check if the current user is an admin
   * @returns {boolean} - True if the user is an admin
   */
  const isAdmin = () => {
    return hasRole('admin');
  };

  /**
   * Get the current user's ID from the token
   * @returns {string|null} - The user's ID or null if not authenticated
   */
  const getUserId = () => {
    const token = tokenCookie.value;
    if (!token) return null;

    const payload = decodeToken(token);
    return payload?.userId || null;
  };

  /**
   * Get the current user's fullname from the token
   * @returns {string|null} - The user's fullname or null if not authenticated
   */
  const getUserFullname = () => {
    const token = tokenCookie.value;
    if (!token) return null;

    const payload = decodeToken(token);
    return payload?.fullname || null;
  };

  return {
    getUserRole,
    hasRole,
    hasRolePrivilege,
    isSubContractor,
    isManager,
    isAdmin,
    getUserId,
    getUserFullname,
    ROLES
  };
}
