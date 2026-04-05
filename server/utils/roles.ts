// server/utils/roles.ts
import Role from '../models/Role';

// Define role constants for use throughout the application
export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  USER: 'user',
  SUB_CONTRACTOR: 'sub-contractor'
};

// Role hierarchy (higher index = higher privileges)
export const ROLE_HIERARCHY = [
  ROLES.SUB_CONTRACTOR,
  ROLES.USER,
  ROLES.MANAGER,
  ROLES.ADMIN
];

// Default role UUIDs - these will be used if the roles don't exist in the database
export const DEFAULT_ROLES = {
  USER: {
    id: '8a9b5cde-f123-45g6-h789-0i1j2k3l4m5n',
    name: ROLES.USER,
    description: 'Regular user with limited permissions'
  },
  MANAGER: {
    id: '9b0c6def-g234-56h7-i890-1j2k3l4m5n6o',
    name: ROLES.MANAGER,
    description: 'Manager with elevated permissions to manage users and resources'
  },
  ADMIN: {
    id: '0c1d7efg-h345-67i8-j901-2k3l4m5n6o7p',
    name: ROLES.ADMIN,
    description: 'Administrator with full system access'
  },
  SUB_CONTRACTOR: {
    id: '1d2e8fgh-i456-78j9-k012-3l4m5n6o7p8q',
    name: ROLES.SUB_CONTRACTOR,
    description: 'Sub-contractor with access to their own expenses and transactions'
  }
};

// Cache for role mappings to avoid frequent database queries
let roleCache: { [key: string]: any } = {};
let roleCacheInitialized = false;

/**
 * Initialize the roles in the database if they don't exist
 */
export async function initializeRoles() {
  try {
    // Check if roles already exist
    const existingRoles = await Role.find();

    if (existingRoles.length === 0) {
      // Create default roles if none exist
      await Role.create([
        DEFAULT_ROLES.USER,
        DEFAULT_ROLES.MANAGER,
        DEFAULT_ROLES.ADMIN,
        DEFAULT_ROLES.SUB_CONTRACTOR
      ]);
    } else {
    }

    // Populate the cache
    await refreshRoleCache();

  } catch (error) {
    console.error('Error initializing roles:', error);
    throw error;
  }
}

/**
 * Refresh the role cache from the database
 */
export async function refreshRoleCache() {
  try {
    const roles = await Role.find();

    // Reset the cache
    roleCache = {};

    // Populate the cache with id -> name and name -> id mappings
    roles.forEach(role => {
      roleCache[role.id] = role.name;
      roleCache[role.name] = role.id;
    });

    roleCacheInitialized = true;

    return roleCache;
  } catch (error) {
    console.error('Error refreshing role cache:', error);
    throw error;
  }
}

/**
 * Get the role ID from a role name
 * @param roleName The name of the role (e.g., 'user', 'manager', 'admin')
 * @returns The UUID of the role
 */
export async function getRoleId(roleName: string): Promise<string> {
  if (!roleCacheInitialized) {
    await refreshRoleCache();
  }

  // Return the cached role ID if available
  if (roleCache[roleName]) {
    return roleCache[roleName];
  }

  // If not in cache, try to find in database
  const role = await Role.findOne({ name: roleName });
  if (role) {
    // Update cache
    roleCache[roleName] = role.id;
    roleCache[role.id] = roleName;
    return role.id;
  }

  // If role not found, return the default ID
  const defaultRole = Object.values(DEFAULT_ROLES).find(r => r.name === roleName);
  return defaultRole ? defaultRole.id : DEFAULT_ROLES.USER.id; // Default to USER if not found
}

/**
 * Get the role name from a role ID
 * @param roleId The UUID of the role
 * @returns The name of the role (e.g., 'user', 'manager', 'admin')
 */
export async function getRoleName(roleId: string): Promise<string> {
  if (!roleCacheInitialized) {
    await refreshRoleCache();
  }

  // Return the cached role name if available
  if (roleCache[roleId]) {
    return roleCache[roleId];
  }

  // If not in cache, try to find in database
  const role = await Role.findOne({ id: roleId });
  if (role) {
    // Update cache
    roleCache[roleId] = role.name;
    roleCache[role.name] = roleId;
    return role.name;
  }

  // If role not found, return 'user' as default
  return 'user';
}

/**
 * Check if a role has equal or higher privileges than another role
 *
 * @param role The role to check
 * @param requiredRole The minimum required role
 * @returns True if the role has equal or higher privileges than the required role
 */
export function hasRolePrivilege(role: string, requiredRole: string): boolean {
  const roleIndex = ROLE_HIERARCHY.indexOf(role);
  const requiredRoleIndex = ROLE_HIERARCHY.indexOf(requiredRole);

  // If either role is not found in the hierarchy, return false
  if (roleIndex === -1 || requiredRoleIndex === -1) {
    return false;
  }

  // Return true if the role has equal or higher privileges
  return roleIndex >= requiredRoleIndex;
}

/**
 * Get all roles from the database
 * @returns Array of role objects
 */
export async function getAllRoles() {
  return await Role.find();
}
