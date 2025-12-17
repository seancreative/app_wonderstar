import React from 'react';
import { Shield, Users, Scan } from 'lucide-react';
import { ROLE_LABELS, ROLE_DESCRIPTIONS, ROLE_COLORS, type StaffRole } from '../utils/staffPermissions';

interface RoleSelectorProps {
  selectedRole: StaffRole;
  onChange: (role: StaffRole) => void;
  disabled?: boolean;
}

const RoleSelector: React.FC<RoleSelectorProps> = ({ selectedRole, onChange, disabled = false }) => {
  const roles: StaffRole[] = ['manager', 'staff', 'star_scanner'];

  const roleIcons: Record<StaffRole, React.ReactNode> = {
    manager: <Shield className="w-5 h-5" />,
    staff: <Users className="w-5 h-5" />,
    star_scanner: <Scan className="w-5 h-5" />
  };

  return (
    <div className="space-y-3">
      {roles.map((role) => (
        <label
          key={role}
          className={`
            flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all
            ${selectedRole === role
              ? 'border-blue-500 bg-blue-50 shadow-md'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input
            type="radio"
            name="role"
            value={role}
            checked={selectedRole === role}
            onChange={() => !disabled && onChange(role)}
            disabled={disabled}
            className="mt-1 w-4 h-4 text-blue-600"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`${selectedRole === role ? 'text-blue-600' : 'text-gray-600'}`}>
                {roleIcons[role]}
              </span>
              <span className="font-semibold text-gray-900">{ROLE_LABELS[role]}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${ROLE_COLORS[role]}`}>
                {role}
              </span>
            </div>
            <p className="text-sm text-gray-600">{ROLE_DESCRIPTIONS[role]}</p>
          </div>
        </label>
      ))}
    </div>
  );
};

export default RoleSelector;
