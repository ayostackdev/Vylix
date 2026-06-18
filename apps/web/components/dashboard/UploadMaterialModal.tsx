'use client';

import { useRef, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

interface UploadMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
const MAX_SIZE = 50 * 1024 * 1024;

export function UploadMaterialModal({ isOpen, onClose, onSuccess }: UploadMaterialModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [isPastQuestion, setIsPastQuestion] = useState(false);
  const [examYear, setExamYear] = useState('');
  const [semester, setSemester] = useState<'FIRST' | 'SECOND' | ''>('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const reset = () => {
    setFile(null);
    setTitle('');
    setCourseCode('');
    setIsPastQuestion(false);
    setExamYear('');
    setSemester('');
    setProgress(0);
    setError(null);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const validateFile = (f: File): string | null => {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      return 'Only PDF, JPEG, and PNG files are accepted.';
    }
    if (f.size > MAX_SIZE) {
      return 'File size must be under 50 MB.';
    }
    return null;
  };

  const handleFileSelect = (f: File) => {
    const err = validateFile(f);
    if (err) {
      setError(err);
      setFile(null);
      return;
    }
    setError(null);
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  };

  const handleUpload = async () => {
    if (!file || !title.trim()) {
      setError('Please select a file and enter a title.');
      return;
    }

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('You must be signed in to upload.');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title.trim());
      if (courseCode.trim()) formData.append('courseCode', courseCode.trim().toUpperCase());
      if (isPastQuestion) {
        formData.append('isPastQuestion', 'true');
        if (examYear) formData.append('examYear', examYear);
        if (semester) formData.append('semester', semester);
      }

      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      await new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            try {
              const body = JSON.parse(xhr.responseText);
              reject(new Error(body.message || body.error || 'Upload failed'));
            } catch {
              reject(new Error(`Upload failed (${xhr.status})`));
            }
          }
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.onabort = () => reject(new Error('Upload cancelled'));

        xhr.open('POST', '/api/materials/upload');
        xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
        xhr.send(formData);
      });

      setProgress(100);
      setTimeout(() => {
        reset();
        onSuccess();
        onClose();
      }, 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-blue-100 animate-scale-in">
        <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50 to-emerald-50/35 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 bg-clip-text text-transparent">
                Upload Material
              </h2>
              <p className="cp-body text-sm mt-1">Share study resources with your department.</p>
            </div>
            <button
              onClick={handleClose}
              disabled={uploading}
              className="text-2xl text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-40"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="space-y-5 p-6">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800 border border-red-200 font-medium">
              ⚠️ {error}
            </div>
          )}

          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            className={`relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all ${
              dragOver
                ? 'border-blue-400 bg-blue-50'
                : file
                  ? 'border-emerald-300 bg-emerald-50/30'
                  : 'border-blue-200 bg-blue-50/50 hover:border-blue-300 hover:bg-blue-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
            />
            {file ? (
              <div className="space-y-2">
                <span className="text-3xl">📄</span>
                <p className="font-semibold text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-500">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  className="text-xs text-red-600 hover:text-red-800 font-medium"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <span className="text-4xl">📁</span>
                <p className="font-semibold text-gray-700">
                  Drop a file here or click to browse
                </p>
                <p className="text-xs text-gray-500">
                  PDF, JPEG, or PNG — max 50 MB
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="cp-label block mb-1.5 text-gray-900">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. CSC 311 Lecture Notes — Week 5"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              disabled={uploading}
            />
          </div>

          <div>
            <label className="cp-label block mb-1.5 text-gray-900">
              Course Code <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              placeholder="e.g. CSC311"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              disabled={uploading}
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isPastQuestion"
              checked={isPastQuestion}
              onChange={(e) => setIsPastQuestion(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              disabled={uploading}
            />
            <label htmlFor="isPastQuestion" className="text-sm font-medium text-gray-700">
              Mark as past question
            </label>
          </div>

          {isPastQuestion && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="cp-label block mb-1.5 text-gray-900">Year</label>
                <select
                  value={examYear}
                  onChange={(e) => setExamYear(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  disabled={uploading}
                >
                  <option value="">Select year</option>
                  {Array.from({ length: 15 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="cp-label block mb-1.5 text-gray-900">Semester</label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value as 'FIRST' | 'SECOND')}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  disabled={uploading}
                >
                  <option value="">Select</option>
                  <option value="FIRST">First Semester</option>
                  <option value="SECOND">Second Semester</option>
                </select>
              </div>
            </div>
          )}

          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">Uploading...</span>
                <span className="text-gray-500">{progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full progress-bar-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleClose}
              disabled={uploading}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || !file || !title.trim()}
              className="flex-1 rounded-lg bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 px-4 py-2.5 text-sm font-bold text-white transition-all hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed press-effect"
            >
              {uploading ? `Uploading ${progress}%` : 'Upload'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
