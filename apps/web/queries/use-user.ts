'use client';

import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';

export interface UserDataExport {
  full_name: string;
  email: string | null;
  matric_number: string | null;
  entry_year: number | null;
  current_level: string | null;
  status: string;
  college_id: string | null;
  department_id: string | null;
  bio: string | null;
  contribution_score: number;
  created_at: string | null;
}

export function useExportData() {
  return useQuery({
    queryKey: ['export-data'],
    queryFn: () => authFetch('/api/user/export-data') as Promise<UserDataExport>,
    enabled: false,
  });
}
