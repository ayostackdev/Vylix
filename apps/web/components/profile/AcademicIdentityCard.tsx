'use client';

import React from 'react';
import { useDynamicAcademicLevel, formatAcademicLevel, getLevelColor } from '@/hooks/useDynamicAcademicLevel';

export interface AcademicIdentityCardProps {
  fullName: string;
  matricNumber: string;
  entryYear: number;
  collegeName: string;
  collegeCode: string;
  departmentName: string;
  departmentCode: string;
  avatarUrl?: string;
  status: 'STUDENT' | 'ALUMNI' | 'GRADUATED';
}

/**
 * Academic Identity Card Component
 * Displays student's dynamic digital ID with auto-updating academic level
 */
export function AcademicIdentityCard({
  fullName,
  matricNumber,
  entryYear,
  collegeName,
  collegeCode,
  departmentName,
  departmentCode,
  avatarUrl,
  status,
}: AcademicIdentityCardProps) {
  const levelInfo = useDynamicAcademicLevel(entryYear);
  const levelColor = getLevelColor(levelInfo.level);

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Card Container */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl shadow-lg overflow-hidden text-white p-6">
        {/* Header with Logo/Icon */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h2 className="text-sm font-semibold opacity-90">FUNAAB</h2>
            <p className="text-xs opacity-75">Student Portal</p>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-bold ${
            status === 'ALUMNI' ? 'bg-purple-400' : status === 'GRADUATED' ? 'bg-gray-400' : 'bg-green-400'
          }`}>
            {status === 'ALUMNI' ? 'ALUMNI' : status === 'GRADUATED' ? 'GRADUATED' : 'ACTIVE'}
          </div>
        </div>

        {/* Profile Section */}
        <div className="flex items-center gap-4 mb-6">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={fullName}
              className="w-16 h-16 rounded-full border-3 border-white"
            />
          ) : (
            <div className="w-16 h-16 rounded-full border-3 border-white bg-blue-400 flex items-center justify-center">
              <span className="text-2xl font-bold">{fullName.charAt(0)}</span>
            </div>
          )}
          <div>
            <p className="text-xl font-bold">{fullName}</p>
            <p className="text-sm opacity-90">{matricNumber}</p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/20 my-6"></div>

        {/* Academic Information */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Level */}
          <div>
            <p className="text-xs opacity-75 mb-1">CURRENT LEVEL</p>
            <div className={`px-3 py-2 rounded-lg inline-block ${levelColor} font-bold text-sm`}>
              {levelInfo.levelDisplay}
            </div>
          </div>

          {/* Entry Year */}
          <div>
            <p className="text-xs opacity-75 mb-1">ENTRY YEAR</p>
            <p className="text-lg font-semibold">{entryYear}</p>
          </div>

          {/* College */}
          <div>
            <p className="text-xs opacity-75 mb-1">COLLEGE</p>
            <p className="text-sm font-semibold">{collegeCode}</p>
            <p className="text-xs opacity-90">{collegeName}</p>
          </div>

          {/* Department */}
          <div>
            <p className="text-xs opacity-75 mb-1">DEPARTMENT</p>
            <p className="text-sm font-semibold">{departmentCode}</p>
            <p className="text-xs opacity-90">{departmentName}</p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/20 my-6"></div>

        {/* Footer Info */}
        <div className="text-xs opacity-75 space-y-1">
          <p>• Level updates automatically at start of each session</p>
          <p>• No manual updates needed</p>
          <p>• Valid until graduation</p>
        </div>
      </div>

      {/* Info Section Below Card */}
      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm font-medium text-blue-900 mb-2">How Your Level Updates</p>
        <p className="text-xs text-blue-800">
          Your academic level automatically rolls forward each year on August 1st based on your entry year. 
          You'll be {formatAcademicLevel(levelInfo.level)} in session {levelInfo.currentAcademicSession}.
        </p>
      </div>
    </div>
  );
}
