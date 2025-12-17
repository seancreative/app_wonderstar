export type StaffRole = 'manager' | 'staff' | 'star_scanner';

export type Resource =
  | 'dashboard'
  | 'products'
  | 'orders'
  | 'redemptions'
  | 'star_scanner'
  | 'reports'
  | 'staff'
  | 'settings'
  | 'profile';

export type Action = 'read' | 'create' | 'update' | 'delete' | 'manage' | 'use' | 'redeem';

export type PermissionMap = Record<string, string[]>;

export const DEFAULT_PERMISSIONS: Record<StaffRole, PermissionMap> = {
  manager: {
    dashboard: ['read'],
    products: ['read', 'create', 'update'],
    orders: ['read', 'update'],
    redemptions: ['read', 'update', 'redeem'],
    star_scanner: ['use'],
    reports: ['read'],
    staff: ['read', 'create', 'update'],
    settings: ['read', 'update'],
    profile: ['read', 'update']
  },
  staff: {
    orders: ['read', 'update'],
    redemptions: ['read', 'update', 'redeem'],
    star_scanner: ['use'],
    profile: ['read', 'update']
  },
  star_scanner: {
    star_scanner: ['use'],
    profile: ['read', 'update']
  }
};

export const ROLE_LABELS: Record<StaffRole, string> = {
  manager: 'Manager',
  staff: 'Staff',
  star_scanner: 'Star Scanner'
};

export const ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  manager: 'Full access to products, orders, reports, and staff management within assigned outlet',
  staff: 'Access to orders, redemptions, and star scanner for daily operations',
  star_scanner: 'Limited access to star scanner only for customer check-ins'
};

export const ROLE_COLORS: Record<StaffRole, string> = {
  manager: 'bg-purple-100 text-purple-800 border-purple-300',
  staff: 'bg-blue-100 text-blue-800 border-blue-300',
  star_scanner: 'bg-green-100 text-green-800 border-green-300'
};

export function getDefaultPermissions(role: StaffRole): PermissionMap {
  return DEFAULT_PERMISSIONS[role] || {};
}

export function checkPermission(
  userPermissions: PermissionMap,
  resource: Resource | string,
  action: Action | string
): boolean {
  const resourcePermissions = userPermissions[resource] || [];
  return (
    resourcePermissions.includes(action) ||
    resourcePermissions.includes('manage')
  );
}

export function hasAnyPermission(
  userPermissions: PermissionMap,
  resource: Resource | string
): boolean {
  const resourcePermissions = userPermissions[resource] || [];
  return resourcePermissions.length > 0;
}

export function mergePermissions(
  defaultPermissions: PermissionMap,
  customPermissions: PermissionMap
): PermissionMap {
  const merged = { ...defaultPermissions };

  Object.keys(customPermissions).forEach((resource) => {
    const customActions = customPermissions[resource];
    if (customActions && customActions.length > 0) {
      merged[resource] = [...new Set([...(merged[resource] || []), ...customActions])];
    }
  });

  return merged;
}

export function getPermissionsForRole(
  role: StaffRole,
  customPermissions?: any
): PermissionMap {
  const defaultPerms = getDefaultPermissions(role);

  // If no custom permissions or not a manager, return defaults
  if (!customPermissions || Object.keys(customPermissions).length === 0) {
    return defaultPerms;
  }

  // Handle granular permissions from database (boolean flags)
  if (role === 'manager' && typeof customPermissions === 'object') {
    const granularPerms: PermissionMap = {};

    // Map boolean permissions to resource permissions
    const sectionMap: Record<string, { resource: string; actions: string[] }> = {
      dashboard: { resource: 'dashboard', actions: ['read'] },
      orders: { resource: 'orders', actions: ['read', 'update'] },
      products: { resource: 'products', actions: ['read', 'create', 'update'] },
      customers: { resource: 'staff', actions: ['read'] }, // customers = staff in CMS
      redemptions: { resource: 'redemptions', actions: ['read', 'update', 'redeem'] },
      rewards: { resource: 'reports', actions: ['read'] }, // rewards = reports access
      marketing: { resource: 'products', actions: ['read', 'create', 'update'] }, // marketing = products
      analytics: { resource: 'reports', actions: ['read'] },
      finance: { resource: 'reports', actions: ['read'] },
      settings: { resource: 'settings', actions: ['read', 'update'] }
    };

    // Build permissions based on enabled sections
    Object.entries(customPermissions).forEach(([section, enabled]) => {
      if (enabled === true && sectionMap[section]) {
        const { resource, actions } = sectionMap[section];
        if (!granularPerms[resource]) {
          granularPerms[resource] = [];
        }
        // Merge actions
        granularPerms[resource] = [...new Set([...granularPerms[resource], ...actions])];
      }
    });

    // Always include profile permissions
    granularPerms.profile = ['read', 'update'];

    return granularPerms;
  }

  // Legacy: merge with default permissions
  return mergePermissions(defaultPerms, customPermissions);
}

export function getRoleFromPermissions(permissions: PermissionMap): StaffRole | null {
  const permissionKeys = Object.keys(permissions).sort().join(',');

  for (const [role, defaultPerms] of Object.entries(DEFAULT_PERMISSIONS)) {
    const defaultKeys = Object.keys(defaultPerms).sort().join(',');
    if (permissionKeys === defaultKeys) {
      return role as StaffRole;
    }
  }

  return null;
}

export const RESOURCE_LABELS: Record<Resource, string> = {
  dashboard: 'Dashboard',
  products: 'Products',
  orders: 'Orders',
  redemptions: 'Redemptions',
  star_scanner: 'Star Scanner',
  reports: 'Reports',
  staff: 'Staff Management',
  settings: 'Settings',
  profile: 'Profile'
};

export const ACTION_LABELS: Record<Action, string> = {
  read: 'View',
  create: 'Create',
  update: 'Edit',
  delete: 'Delete',
  manage: 'Full Control',
  use: 'Use',
  redeem: 'Redeem'
};

export function formatPermissions(permissions: PermissionMap): string {
  const resources = Object.keys(permissions);
  if (resources.length === 0) return 'No permissions';
  if (resources.length === 1) return RESOURCE_LABELS[resources[0] as Resource] || resources[0];
  return `${resources.length} resources`;
}

export function generatePassword(length: number = 12): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';
  const all = uppercase + lowercase + numbers + special;

  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  for (let i = password.length; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  return password.split('').sort(() => Math.random() - 0.5).join('');
}

export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
