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
  const { user } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';

  const [isEditing, setIsEditing] = useState(false);
  const [colleges, setColleges] = useState<College[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [matricNumber, setMatricNumber] = useState('');
  const [entryYear, setEntryYear] = useState('');
  const [currentLevel, setCurrentLevel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchColleges = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${apiBaseUrl}/api/colleges`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) setColleges(await res.json());
    } catch {}
  }, [apiBaseUrl, supabase]);

  const fetchDepartments = useCallback(async (collegeId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${apiBaseUrl}/api/colleges/${collegeId}/departments`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) setDepartments(await res.json());
    } catch {}
  }, [apiBaseUrl, supabase]);

  useEffect(() => {
    if (!isOpen) return;
    fetchColleges();
  }, [isOpen, fetchColleges]);

  useEffect(() => {
    if (!selectedCollegeId) return;
    fetchDepartments(selectedCollegeId);
  }, [selectedCollegeId, fetchDepartments]);

  const enterEditMode = () => {
    setMatricNumber(user?.matricNumber || '');
    setEntryYear(user?.entryYear?.toString() || '');
    setCurrentLevel(user?.currentLevel || '');
    const matchedCollege = colleges.find((c) => c.code === user?.collegeCode);
    setSelectedCollegeId(matchedCollege?.id || '');
    const matchedDept = departments.find((d) => d.code === user?.departmentCode);
    setSelectedDeptId(matchedDept?.id || '');
    setError('');
    setIsEditing(true);
  };

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
      if (matricNumber) body.matricNumber = matricNumber;
      if (entryYear) body.entryYear = parseInt(entryYear, 10);
      if (currentLevel) body.currentLevel = currentLevel;
      if (selectedCollegeId) body.collegeId = selectedCollegeId;
      if (selectedDeptId) body.departmentId = selectedDeptId;

      const res = await fetch(`${apiBaseUrl}/api/user/profile`, {
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

      setIsEditing(false);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }, [apiBaseUrl, supabase, matricNumber, entryYear, currentLevel, selectedCollegeId, selectedDeptId]);

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
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {isEditing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">Matric Number</label>
                <input
                  type="text"
                  value={matricNumber}
                  onChange={(e) => setMatricNumber(e.target.value)}
                  placeholder="e.g. 20/1234"
                  className="block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm placeholder-gray-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">Entry Year</label>
                <input
                  type="number"
                  value={entryYear}
                  onChange={(e) => setEntryYear(e.target.value)}
                  placeholder="e.g. 2020"
                  className="block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm placeholder-gray-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>
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
                  {saving ? 'Saving...' : 'Save'}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
