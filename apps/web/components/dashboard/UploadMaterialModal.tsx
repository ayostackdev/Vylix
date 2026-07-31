'use client';

import { useRef, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import { queryClient } from '@/lib/query-client';
import { useAuth } from '@/context/auth-context';

interface UploadMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
const MAX_SIZE = 50 * 1024 * 1024;

function titleFromFilename(name: string): string {
  return name
    .replace(/\.[^/.]+$/, '')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function UploadMaterialModal({ isOpen, onClose, onSuccess }: UploadMaterialModalProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [courseCode, setCourseCode] = useState('');
  const [isPastQuestion, setIsPastQuestion] = useState(false);
  const [examYear, setExamYear] = useState('');
  const [semester, setSemester] = useState<'FIRST' | 'SECOND' | ''>('');
  const [uploading, setUploading] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const reset = () => {
    setFiles([]);
    setCourseCode('');
    setIsPastQuestion(false);
    setExamYear('');
    setSemester('');
    setCurrentFileIndex(0);
    setProgress(0);
    setError(null);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const validateFiles = (incoming: FileList | File[]): File[] => {
    const valid: File[] = [];
    for (const f of incoming) {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        setError(`"${f.name}" is not an accepted format. Only PDF, JPEG, and PNG.`);
        return [];
      }
      if (f.size > MAX_SIZE) {
        setError(`"${f.name}" exceeds the 50 MB limit.`);
        return [];
      }
      valid.push(f);
    }
    return valid;
  };

  const handleFilesChosen = (incoming: FileList | File[]) => {
    const valid = validateFiles(incoming);
    if (valid.length === 0) return;
    setError(null);
    setFiles((prev) => [...prev, ...valid]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFilesChosen(e.dataTransfer.files);
    }
  };

  const uploadSingle = async (
    file: File,
    index: number,
    total: number,
    sessionToken: string,
  ): Promise<void> => {
    const formData = new FormData();
    formData.append('file', file);
    const autoTitle = titleFromFilename(file.name);
    formData.append('title', autoTitle);
    if (courseCode.trim()) formData.append('courseCode', courseCode.trim().toUpperCase());
    if (user?.departmentCode) formData.append('departmentCode', user.departmentCode);
    if (isPastQuestion) {
      formData.append('isPastQuestion', 'true');
      if (examYear) formData.append('examYear', examYear);
      if (semester) formData.append('semester', semester);
    }

    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const fileProgress = Math.round((e.loaded / e.total) * 100);
          const overall = Math.round((index / total) * 100 + fileProgress / total);
          setProgress(Math.min(overall, 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          try {
            const body = JSON.parse(xhr.responseText);
            reject(new Error(body.message || body.error || `"${file.name}" failed`));
          } catch {
            reject(new Error(`"${file.name}" failed (${xhr.status})`));
          }
        }
      };

      xhr.onerror = () => reject(new Error(`Network error uploading "${file.name}"`));
      xhr.onabort = () => reject(new Error(`Upload of "${file.name}" cancelled`));

      xhr.open('POST', '/api/materials/upload');
      xhr.setRequestHeader('Authorization', `Bearer ${sessionToken}`);
      xhr.send(formData);
    });
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError('Please select at least one file.');
      return;
    }

    setUploading(true);
    setCurrentFileIndex(0);
    setProgress(0);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('You must be signed in to upload.');
      }

      for (let i = 0; i < files.length; i++) {
        setCurrentFileIndex(i);
        await uploadSingle(files[i], i, files.length, session.access_token);
      }

      setProgress(100);
      queryClient.invalidateQueries({ queryKey: ['vault-materials'] });
      queryClient.invalidateQueries({ queryKey: ['past-questions'] });
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
                : files.length > 0
                  ? 'border-emerald-300 bg-emerald-50/30'
                  : 'border-blue-200 bg-blue-50/50 hover:border-blue-300 hover:bg-blue-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFilesChosen(e.target.files);
                }
              }}
            />
            {files.length > 0 ? (
              <div className="space-y-2">
                <span className="text-3xl">📄</span>
                <p className="font-semibold text-gray-900">{files.length} file(s) selected</p>
                <ul className="mx-auto max-w-sm space-y-1 text-left text-xs text-gray-600">
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 rounded-md bg-white/60 px-2 py-1">
                      <span className="truncate">{f.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-gray-400">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                        {!uploading && (
                          <button
                            onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                            className="text-red-500 hover:text-red-700 font-bold text-xs"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                {!uploading && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setFiles([]); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="text-xs text-red-600 hover:text-red-800 font-medium"
                  >
                    Clear all
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <span className="text-4xl">📁</span>
                <p className="font-semibold text-gray-700">
                  Drop files here or click to browse
                </p>
                <p className="text-xs text-gray-500">
                  PDF, JPEG, or PNG — max 50 MB each — select multiple
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="cp-label block mb-1.5 text-gray-900">
              Course Code <span className="text-gray-400 font-normal">(optional — auto-detected from filename)</span>
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
                <span className="font-medium text-gray-700">
                  Uploading {currentFileIndex + 1} of {files.length}
                </span>
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
              disabled={uploading || files.length === 0}
              className="flex-1 rounded-lg bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 px-4 py-2.5 text-sm font-bold text-white transition-all hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed press-effect"
            >
              {uploading ? `Uploading ${currentFileIndex + 1}/${files.length}` : `Upload ${files.length > 0 ? `(${files.length} file${files.length > 1 ? 's' : ''})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
