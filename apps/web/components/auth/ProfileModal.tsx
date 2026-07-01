'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/auth-context';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

interface College {
  id: string;
  code: string;
  name: string;
  durationYears: number;
}

interface Department {
  id: string;
  code: string;
  name: string;
}

export interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { user, refreshProfile, logout, updateAvatar } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [colleges, setColleges] = useState<College[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [currentLevel, setCurrentLevel] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const fetchColleges = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/colleges', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) setColleges(await res.json());
    } catch {}
  }, [supabase]);

  const fetchDepartments = useCallback(async (collegeId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`/api/colleges/${collegeId}/departments`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) setDepartments(await res.json());
    } catch {}
  }, [supabase]);

  useEffect(() => {
    if (!isOpen) return;
    fetchColleges();
  }, [isOpen, fetchColleges]);

  useEffect(() => {
    if (!selectedCollegeId) return;
    fetchDepartments(selectedCollegeId);
  }, [selectedCollegeId, fetchDepartments]);

  useEffect(() => {
    if (!isOpen || colleges.length === 0 || !user?.collegeCode) return;
    const matched = colleges.find((c) => c.code === user.collegeCode);
    if (matched && matched.id !== selectedCollegeId) {
      setSelectedCollegeId(matched.id);
    }
  }, [isOpen, colleges, user?.collegeCode]);

  const enterEditMode = () => {
    setCurrentLevel(user?.currentLevel || '');
    const matchedCollege = colleges.find((c) => c.code === user?.collegeCode);
    setSelectedCollegeId(matchedCollege?.id || '');
    const matchedDept = departments.find((d) => d.code === user?.departmentCode);
    setSelectedDeptId(matchedDept?.id || '');
    setError('');
    setIsEditing(true);
  };

  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Accepted formats: JPEG, PNG, GIF, WebP');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File too large. Maximum size is 5MB');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const formData = new FormData();
      formData.append('avatar', file);

      const res = await fetch('/api/user/avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to upload avatar');
      }

      const json = await res.json();
      updateAvatar(json.data.avatarUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload avatar');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [supabase, updateAvatar]);

  const cancelEdit = () => {
    setIsEditing(false);
    setError('');
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const body: Record<string, any> = {};
      if (currentLevel) body.currentLevel = currentLevel;
      if (selectedCollegeId) body.collegeId = selectedCollegeId;
      if (selectedDeptId) body.departmentId = selectedDeptId;

      console.log('[ProfileModal] Saving body:', JSON.stringify(body));

      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to save profile');
      }

      await refreshProfile();
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }, [supabase, currentLevel, selectedCollegeId, selectedDeptId, refreshProfile]);

  if (!isOpen || !user) return null;

  const initials = user.fullName?.charAt(0) ?? 'CS';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-blue-100 overflow-hidden animate-fade-in">
        <div className="bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 p-6 text-center">
          <div className="flex justify-center mb-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="relative group"
              title="Change photo"
            >
              <Avatar className="h-20 w-20 ring-4 ring-white/60 shadow-lg">
                <AvatarImage src={user.avatarUrl ?? undefined} alt={user.fullName} />
                <AvatarFallback className="bg-white text-2xl font-black text-gray-900">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 group-hover:bg-black/40 transition-colors">
                {uploading ? (
                  <svg className="animate-spin h-6 w-6 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>
          <h2 className="text-xl font-bold text-white">{user.fullName}</h2>
          <p className="text-sm text-white/80 mt-1">{user.email}</p>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {isEditing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">College</label>
                <select
                  value={selectedCollegeId}
                  onChange={(e) => {
                    setSelectedCollegeId(e.target.value);
                    setSelectedDeptId('');
                  }}
                  className="block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                >
                  <option value="">Select College</option>
                  {colleges.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">Department</label>
                <select
                  value={selectedDeptId}
                  onChange={(e) => setSelectedDeptId(e.target.value)}
                  disabled={!selectedCollegeId}
                  className="block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:opacity-50"
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">Level</label>
                <select
                  value={currentLevel}
                  onChange={(e) => setCurrentLevel(e.target.value)}
                  className="block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                >
                  <option value="">Select Level</option>
                  <option value="100L">100L</option>
                  <option value="200L">200L</option>
                  <option value="300L">300L</option>
                  <option value="400L">400L</option>
                  <option value="500L">500L</option>
                  <option value="Spillover">Spillover</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={cancelEdit}
                  disabled={saving}
                  className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {saving ? (
                    <svg className="animate-spin h-5 w-5 mx-auto" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <>
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
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Started</p>
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
                onClick={enterEditMode}
                className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-100 transition-colors"
              >
                Edit Profile
              </button>

              <button
                onClick={onClose}
                className="w-full rounded-xl bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 transition-opacity"
              >
                Close
              </button>

              <button
                onClick={async () => {
                  await logout();
                  onClose();
                }}
                className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100 transition-colors"
              >
                Sign Out
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
