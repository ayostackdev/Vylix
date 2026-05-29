'use client';

import { ReactNode } from 'react';

interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  children: ReactNode;
  onClose?: () => void;
  className?: string;
}

const icons = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ⓘ',
};

export function Alert({ type, title, children, onClose, className = '' }: AlertProps) {
  return (
    <div className={`alert alert-${type} ${className}`}>
      <span className="flex-shrink-0 text-lg font-bold">{icons[type]}</span>
      <div className="flex-1">
        {title && <p className="font-semibold mb-1">{title}</p>}
        <div className="text-sm">{children}</div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="flex-shrink-0 text-lg leading-none opacity-60 hover:opacity-100 transition"
        >
          ✕
        </button>
      )}
    </div>
  );
}
