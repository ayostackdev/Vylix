'use client';

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/auth-context';

export interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { user } = useAuth();

  if (!isOpen || !user) return null;

  const initials = user.fullName?.charAt(0) ?? 'CS';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-blue-100 overflow-hidden animate-fade-in">
        <div className="bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 p-6 text-center">
          <div className="flex justify-center mb-3">
            <Avatar className="h-20 w-20 ring-4 ring-white/60 shadow-lg">
              <AvatarImage src={user.avatarUrl ?? undefined} alt={user.fullName} />
              <AvatarFallback className="bg-white text-2xl font-black text-gray-900">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
          <h2 className="text-xl font-bold text-white">{user.fullName}</h2>
          <p className="text-sm text-white/80 mt-1">{user.email}</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Status</p>
              <p className="mt-1 font-semibold text-gray-900">{user.status === 'ALUMNI' ? '🎓 Alumni' : '🎒 Student'}</p>
            </div>
            {user.currentLevel && (
              <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Level</p>
                <p className="mt-1 font-semibold text-gray-900">{user.currentLevel}</p>
              </div>
            )}
            {user.matricNumber && (
              <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Matric No</p>
                <p className="mt-1 font-semibold text-gray-900">{user.matricNumber}</p>
              </div>
            )}
            {user.entryYear && (
              <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Entry Year</p>
                <p className="mt-1 font-semibold text-gray-900">{user.entryYear}</p>
              </div>
            )}
            {user.collegeName && (
              <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 col-span-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">College</p>
                <p className="mt-1 font-semibold text-gray-900">{user.collegeName}</p>
              </div>
            )}
            {user.departmentName && (
              <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 col-span-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Department</p>
                <p className="mt-1 font-semibold text-gray-900">{user.departmentName}</p>
              </div>
            )}
            {user.schoolEmail && (
              <div className="rounded-xl bg-green-50 border border-green-200 p-3 col-span-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-green-700">University Email</p>
                <p className="mt-1 font-semibold text-gray-900">{user.schoolEmail}</p>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-full rounded-xl bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 transition-opacity"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
