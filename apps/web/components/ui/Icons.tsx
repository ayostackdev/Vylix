import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

const sizeMap: Record<NonNullable<IconProps['size']>, string> = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-10 h-10',
};

function iconProps({ size = 'sm', className, ...rest }: IconProps) {
  return { className: `${sizeMap[size]} ${className ?? ''}`.trim(), ...rest };
}

export function SpinnerIcon({ size = 'sm', className, ...rest }: IconProps) {
  return (
    <svg {...iconProps({ size, className: `${className ?? ''} animate-spin` })} viewBox="0 0 24 24" fill="none" {...rest}>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function CloseIcon({ size = 'sm', className, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <svg {...iconProps({ size, className })} fill="none" stroke="currentColor" strokeWidth={strokeWidth} viewBox="0 0 24 24" {...rest}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export function LockIcon({ size = 'sm', className, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <svg {...iconProps({ size, className })} fill="none" stroke="currentColor" strokeWidth={strokeWidth} viewBox="0 0 24 24" {...rest}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

export function CheckIcon({ size = 'sm', className, strokeWidth = 2.5, ...rest }: IconProps) {
  return (
    <svg {...iconProps({ size, className })} fill="none" stroke="currentColor" strokeWidth={strokeWidth} viewBox="0 0 24 24" {...rest}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function UploadIcon({ size = 'sm', className, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <svg {...iconProps({ size, className })} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...rest}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

export function DownloadIcon({ size = 'sm', className, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <svg {...iconProps({ size, className })} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...rest}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

export function PlusIcon({ size = 'sm', className, strokeWidth = 2.5, ...rest }: IconProps) {
  return (
    <svg {...iconProps({ size, className })} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth} {...rest}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

export function SignInIcon({ size = 'sm', className, strokeWidth = 2.5, ...rest }: IconProps) {
  return (
    <svg {...iconProps({ size, className })} fill="none" stroke="currentColor" strokeWidth={strokeWidth} viewBox="0 0 24 24" {...rest}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
    </svg>
  );
}

export function LightbulbIcon({ size = 'sm', className, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <svg {...iconProps({ size, className })} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...rest}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}

export function BookIcon({ size = 'sm', className, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <svg {...iconProps({ size, className })} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...rest}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}

export function SendIcon({ size = 'sm', className, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <svg {...iconProps({ size, className })} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...rest}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

export function SearchIcon({ size = 'sm', className, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <svg {...iconProps({ size, className })} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...rest}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

export function DocumentIcon({ size = 'sm', className, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <svg {...iconProps({ size, className })} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...rest}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

export function ChevronLeftIcon({ size = 'sm', className, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <svg {...iconProps({ size, className })} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth} {...rest}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 'sm', className, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <svg {...iconProps({ size, className })} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth} {...rest}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h8m-4-4l4 4-4 4" />
    </svg>
  );
}

export function MenuIcon({ size = 'md', className, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <svg {...iconProps({ size, className })} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...rest}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function WarningIcon({ size = 'sm', className, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <svg {...iconProps({ size, className })} fill="none" stroke="currentColor" strokeWidth={strokeWidth} viewBox="0 0 24 24" {...rest}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  );
}

export function UsersIcon({ size = 'sm', className, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <svg {...iconProps({ size, className })} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...rest}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

export function CameraIcon({ size = 'md', className, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <svg {...iconProps({ size, className })} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...rest}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

export function EyeIcon({ size = 'sm', className, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <svg {...iconProps({ size, className })} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...rest}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

export function ChatBubbleIcon({ size = 'sm', className, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <svg {...iconProps({ size, className })} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...rest}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

export function ClipboardIcon({ size = 'sm', className, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <svg {...iconProps({ size, className })} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...rest}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

export function ArchiveIcon({ size = 'sm', className, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <svg {...iconProps({ size, className })} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...rest}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    </svg>
  );
}

export function MonitorIcon({ size = 'sm', className, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <svg {...iconProps({ size, className })} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...rest}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

export function BoltIcon({ size = 'sm', className, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <svg {...iconProps({ size, className })} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...rest}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

export function GoogleLogoIcon({ size = 'md', className, ...rest }: IconProps) {
  return (
    <svg {...iconProps({ size, className })} viewBox="0 0 24 24" {...rest}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export function GoogleDriveIcon({ size = 'sm', className, ...rest }: IconProps) {
  return (
    <svg {...iconProps({ size, className })} viewBox="0 0 24 24" fill="currentColor" {...rest}>
      <path d="M7.71 3.5L1.15 15l3.43 6h13.72l3.42-6L15.29 3.5H7.71zm4.58 2.28l4.14 7.22H4.71l4.14-7.22h3.44z" opacity="0.9" />
    </svg>
  );
}

export function PlusCircleIcon({ size = 'md', className, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <svg {...iconProps({ size, className })} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...rest}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
  );
}
