'use client';

import { useState, useEffect } from 'react';
import { useDriveFolders, useDriveFiles, useDriveImport } from '@/queries/use-drive';


interface DriveFilePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Course {
  id: string;
  code: string;
  title: string;
}

export function DriveFilePickerModal({ isOpen, onClose, onSuccess }: DriveFilePickerModalProps) {
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const [folderPath, setFolderPath] = useState<{ id: string; name: string }[]>([{ id: 'root', name: 'My Drive' }]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: folders, isLoading: foldersLoading } = useDriveFolders(currentFolderId);
  const { data: files, isLoading: filesLoading } = useDriveFiles(currentFolderId);
  const importMutation = useDriveImport();

  useEffect(() => {
    if (isOpen) {
      fetchCourses();
      setCurrentFolderId('root');
      setFolderPath([{ id: 'root', name: 'My Drive' }]);
      setSelectedFiles(new Set());
      setSelectedCourseId('');
      setError(null);
    }
  }, [isOpen]);

  const fetchCourses = async () => {
    try {
      const res = await fetch(`/api/courses/my`);
      if (res.ok) {
        const data = await res.json();
        setCourses(data);
        if (data.length > 0) setSelectedCourseId(data[0].id);
      }
    } catch {
      // Non-critical
    }
  };

  const handleFolderClick = (folderId: string, folderName: string) => {
    setCurrentFolderId(folderId);
    setFolderPath((prev) => [...prev, { id: folderId, name: folderName }]);
    setSelectedFiles(new Set());
  };

  const handleBreadcrumbClick = (index: number) => {
    const target = folderPath[index];
    setCurrentFolderId(target.id);
    setFolderPath((prev) => prev.slice(0, index + 1));
    setSelectedFiles(new Set());
  };

  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const handleImport = async () => {
    if (selectedFiles.size === 0) {
      setError('Please select at least one file to import.');
      return;
    }
    if (!selectedCourseId) {
      setError('Please select a course to import into.');
      return;
    }

    setImporting(true);
    setError(null);

    try {
      await importMutation.mutateAsync({
        fileIds: Array.from(selectedFiles),
        topicId: selectedCourseId,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-blue-100 animate-scale-in max-h-[85vh] flex flex-col">
        <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50 to-emerald-50/35 px-6 py-4 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 bg-clip-text text-transparent">
                Import from Google Drive
              </h2>
              <p className="text-sm text-gray-500 mt-1">Browse and select files to import into your course.</p>
            </div>
            <button
              onClick={onClose}
              disabled={importing}
              className="text-2xl text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-40"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800 border border-red-200 font-medium">
              {error}
            </div>
          )}

          {/* Course Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Import to Course
            </label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              disabled={importing}
            >
              {courses.length === 0 ? (
                <option value="">No courses found</option>
              ) : (
                courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
                ))
              )}
            </select>
          </div>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 text-sm text-gray-500 flex-wrap">
            {folderPath.map((folder, index) => (
              <span key={folder.id} className="flex items-center gap-1">
                {index > 0 && <span className="text-gray-300">/</span>}
                <button
                  onClick={() => handleBreadcrumbClick(index)}
                  disabled={importing}
                  className={`hover:text-blue-600 transition-colors font-medium ${
                    index === folderPath.length - 1 ? 'text-gray-900' : ''
                  }`}
                >
                  {folder.name}
                </button>
              </span>
            ))}
          </div>

          {/* Loading State */}
          {(foldersLoading || filesLoading) && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-gray-400">
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm font-medium">Loading...</span>
              </div>
            </div>
          )}

          {/* Folders */}
          {!foldersLoading && folders && folders.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Folders</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => handleFolderClick(folder.id, folder.name)}
                    disabled={importing}
                    className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left disabled:opacity-50"
                  >
                    <svg className="w-5 h-5 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                    </svg>
                    <span className="text-sm text-gray-700 truncate">{folder.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Files */}
          {!filesLoading && files && files.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">PDF Files</h3>
              <div className="space-y-1.5">
                {files.map((file) => (
                  <label
                    key={file.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                      selectedFiles.has(file.id)
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFiles.has(file.id)}
                      onChange={() => toggleFileSelection(file.id)}
                      disabled={importing}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="w-8 h-10 rounded bg-gradient-to-br from-red-400 to-orange-400 flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                      PDF
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                      <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!foldersLoading && !filesLoading && ((!folders || folders.length === 0) && (!files || files.length === 0)) && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500">This folder is empty.</p>
            </div>
          )}

          {/* Selected Count */}
          {selectedFiles.size > 0 && (
            <div className="text-sm text-blue-600 font-medium">
              {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''} selected
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 px-6 py-4 flex gap-3 shrink-0">
          <button
            onClick={onClose}
            disabled={importing}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={importing || selectedFiles.size === 0}
            className="flex-1 rounded-lg bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 px-4 py-2.5 text-sm font-bold text-white transition-all hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {importing ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Importing...
              </span>
            ) : (
              `Import ${selectedFiles.size > 0 ? `(${selectedFiles.size} file${selectedFiles.size !== 1 ? 's' : ''})` : ''}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
