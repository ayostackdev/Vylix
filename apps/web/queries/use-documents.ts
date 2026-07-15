'use client';

import { useMutation } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';

export interface CompressResult {
  original_name: string;
  compressed_name: string;
  compressed_path: string;
}

export interface ParseResult {
  source_name: string;
  document_id: string;
  parser: string;
  markdown: string;
  chunk_count: number;
  chunks: string[];
}

export interface IngestResult {
  document_id: string;
  source_name: string;
  compressed_path: string;
  chunk_count: number;
  parser: string;
  department_code: string;
  summary: string;
  questions: string[];
  tips: string[];
}

export interface SearchHit {
  id: string;
  document_id: string;
  source_name: string;
  chunk_index: number;
  text: string;
  score: number;
}

export interface SearchResult {
  query: string;
  results: SearchHit[];
}

export interface OcrResult {
  source_name: string;
  extracted_text: string;
}

export interface ChatResult {
  answer: string;
  context_chunks: string[];
  follow_up_questions: string[];
}

export function useCompressPdf() {
  return useMutation({
    mutationFn: async ({ file }: { file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/documents/compress', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Compression failed');
      return res.json() as Promise<CompressResult>;
    },
  });
}

export function useParseDocument() {
  return useMutation({
    mutationFn: async ({ file }: { file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/documents/parse', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Parse failed');
      return res.json() as Promise<ParseResult>;
    },
  });
}

export function useIngestDocument() {
  return useMutation({
    mutationFn: async ({ file, departmentCode }: { file: File; departmentCode?: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      if (departmentCode) formData.append('department_code', departmentCode);
      const res = await fetch('/api/documents/ingest', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Ingest failed');
      return res.json() as Promise<IngestResult>;
    },
  });
}

export function useDocumentSearch() {
  return useMutation({
    mutationFn: async ({ query, departmentCode }: { query: string; departmentCode?: string }) => {
      const params = new URLSearchParams({ q: query });
      if (departmentCode) params.set('department_code', departmentCode);
      return authFetch(`/api/documents/search?${params}`) as Promise<SearchResult>;
    },
  });
}

export function useOcr() {
  return useMutation({
    mutationFn: async ({ file }: { file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/documents/ocr', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('OCR failed');
      return res.json() as Promise<OcrResult>;
    },
  });
}

export function useDocumentChat() {
  return useMutation({
    mutationFn: async ({ documentId, query }: { documentId: string; query: string }) => {
      return authFetch('/api/documents/chat', {
        method: 'POST',
        body: JSON.stringify({ document_id: documentId, query }),
      }) as Promise<ChatResult>;
    },
  });
}
