'use client';

import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
  glass?: boolean;
  hoverable?: boolean;
  onClick?: () => void;
}

export function Card({ children, className = '', elevated = false, glass = false, hoverable = false, onClick }: CardProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={`${glass ? 'glass' : 'card'} ${elevated ? 'card-elevated' : ''} ${hoverable ? 'scale-hover cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title?: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}

export function CardHeader({ title, description, children, className = '' }: CardHeaderProps) {
  return (
    <div className={`mb-4 ${className}`}>
      {title && <h3 className="cp-card-title">{title}</h3>}
      {description && <p className="cp-body-sm text-gray-500 mt-1">{description}</p>}
      {children}
    </div>
  );
}

interface CardBodyProps {
  children: ReactNode;
  className?: string;
}

export function CardBody({ children, className = '' }: CardBodyProps) {
  return <div className={`space-y-4 ${className}`}>{children}</div>;
}

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return (
    <div className={`flex gap-3 pt-4 mt-4 border-t border-gray-200 ${className}`}>
      {children}
    </div>
  );
}
