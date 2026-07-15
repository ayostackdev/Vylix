'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';

export interface DriveFolder {
  id: string;
  name: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mime_type: string;
  size: number;
  created_time: string;
}

export interface DriveImportedFile {
  id: string;
  drive_file_id: string;
  file_name: string;
  status: string;
  material_id: string | null;
}

export interface DriveConnectionStatus {
  connected: boolean;
  email: string | null;
  connected_at: string | null;
}

export function useDriveStatus() {
  return useQuery({
    queryKey: ['drive-status'],
    queryFn: () => authFetch('/api/google-drive/status') as Promise<DriveConnectionStatus>,
  });
}

export function useDriveDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => authFetch('/api/google-drive/disconnect', { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drive-status'] });
    },
  });
}

export function useDriveFolders(folderId: string = 'root') {
  return useQuery({
    queryKey: ['drive-folders', folderId],
    queryFn: () => authFetch(`/api/google-drive/folders?folder_id=${folderId}`) as Promise<DriveFolder[]>,
    enabled: false,
  });
}

export function useDriveFiles(folderId: string | null) {
  return useQuery({
    queryKey: ['drive-files', folderId],
    queryFn: () => authFetch(`/api/google-drive/files?folder_id=${folderId}`) as Promise<DriveFile[]>,
    enabled: !!folderId,
  });
}

export function useDriveImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fileIds, topicId }: { fileIds: string[]; topicId: string }) =>
      authFetch('/api/google-drive/import', {
        method: 'POST',
        body: JSON.stringify({ file_ids: fileIds, topic_id: topicId }),
      }) as Promise<DriveImportedFile[]>,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drive-imports'] });
    },
  });
}

export function useDriveImports() {
  return useQuery({
    queryKey: ['drive-imports'],
    queryFn: () => authFetch('/api/google-drive/imports') as Promise<DriveImportedFile[]>,
  });
}
