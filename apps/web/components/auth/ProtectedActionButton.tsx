'use client';

import React from 'react';
import { useAuth } from '@/context/auth-context';

interface ActionButtonProps {
  icon?: string;
  label: string;
  action: string;
  onClick?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary';
}

/**
 * Component that shows action buttons for authenticated users,
 * or login prompts for non-authenticated users
 */
export function ProtectedActionButton({
  icon,
  label,
  action,
  onClick,
  className = '',
  variant = 'primary',
}: ActionButtonProps) {
  const { user, isAuthenticated, promptLogin } = useAuth();
  const isAlumni = user?.status === 'ALUMNI';

  if (isAlumni) {
    return (
      <button
        disabled
        className={`flex items-center gap-2 rounded-lg px-4 py-2 font-semibold opacity-50 cursor-not-allowed ${
          variant === 'primary'
            ? 'bg-gray-300 text-gray-500'
            : 'bg-white text-gray-400 border border-gray-200'
        } ${className}`}
        title="Alumni accounts are read-only"
      >
        {icon && <span>{icon}</span>}
        <span>{label}</span>
        <span className="ml-1 text-xs opacity-75">Read Only</span>
      </button>
    );
  }

  if (!isAuthenticated) {
    return (
      <button
        onClick={() => promptLogin(action)}
        className={`flex items-center gap-2 rounded-lg px-4 py-2 font-semibold transition-all ${
          variant === 'primary'
            ? 'bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 text-white hover:shadow-md'
            : 'bg-white text-transparent bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 bg-clip-text hover:bg-blue-50 border border-blue-200'
        } ${className}`}
        title={`Sign in to ${action.toLowerCase()}`}
      >
        {icon && <span>{icon}</span>}
        <span>{label}</span>
        <span className="ml-1 text-xs opacity-75">→ Sign In</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 font-semibold transition-all ${
        variant === 'primary'
          ? 'bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 text-white hover:shadow-md'
          : 'bg-white text-transparent bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 bg-clip-text hover:bg-blue-50 border border-blue-200'
      } ${className}`}
      title={label}
    >
      {icon && <span>{icon}</span>}
      <span>{label}</span>
    </button>
  );
}
