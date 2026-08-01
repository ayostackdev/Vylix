'use client';

import { useDrive } from '@/context/drive-context';
import { useAuth } from '@/context/auth-context';

export function DriveSyncBanner() {
  const { driveConnected, isLoading, connectDrive, driveError, clearError } = useDrive();
  const { isAuthenticated, promptLogin } = useAuth();

  if (isLoading || driveConnected) return null;

  return (
    <div className="mb-4 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-50 to-sky-50 border border-blue-100/60 ring-1 ring-blue-200/30 premium-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-sky-500 flex items-center justify-center shrink-0 shadow-md shadow-blue-600/20">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-gray-900">Your workspace is empty</h3>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
            Sync your Google Drive to let our backend index your course slides and make your entire semester searchable instantly.
          </p>
          {driveError && (
            <p className="text-xs text-red-600 mt-1.5 font-medium">{driveError}</p>
          )}
        </div>
        <button
          onClick={() => !isAuthenticated ? promptLogin('connect Google Drive') : connectDrive()}
          className="shrink-0 inline-flex items-center gap-1.5 text-xs px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white font-bold btn-glow hover:shadow-lg hover:shadow-blue-600/25 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 min-h-[38px]"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {isAuthenticated ? 'Sync My Google Drive' : 'Sign in to Sync'}
        </button>
      </div>
    </div>
  );
}
