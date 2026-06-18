'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

interface PastQuestion {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  examYear: number | null;
  semester: string | null;
  processingStatus: string;
  summary: string | null;
  uploadedAt: string;
  topic: {
    id: string;
    title: string;
    course: { id: string; code: string; title: string } | null;
  } | null;
  uploader: { id: string; fullName: string; avatarUrl: string | null };
}

export function PastQuestionsView() {
  const [items, setItems] = useState<PastQuestion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchCourse, setSearchCourse] = useState('');
  const [searchYear, setSearchYear] = useState('');
  const [searchSemester, setSearchSemester] = useState('');
  const limit = 20;

  const fetchPastQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', limit.toString());
      if (searchCourse) params.set('courseCode', searchCourse.toUpperCase());
      if (searchYear) params.set('year', searchYear);
      if (searchSemester) params.set('semester', searchSemester);

      const headers: Record<string, string> = {};
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const res = await fetch(`${apiBaseUrl}/api/materials/past-questions?${params.toString()}`, { headers });
      if (!res.ok) throw new Error('Failed to fetch past questions');
      const json = await res.json();
      setItems(json.items ?? []);
      setTotal(json.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load past questions');
    } finally {
      setLoading(false);
    }
  }, [page, searchCourse, searchYear, searchSemester]);

  useEffect(() => {
    fetchPastQuestions();
  }, [fetchPastQuestions]);

  const totalPages = Math.ceil(total / limit);

  return (
    <section className="space-y-5 sm:space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 p-[1px] shadow-sm">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 font-bold text-[11px] uppercase tracking-wider text-gray-900">
              Exam prep
            </span>
          </div>
          <h2 className="text-[clamp(1.5rem,3vw,2.2rem)] leading-[1.2] tracking-[-0.03em] font-black bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 bg-clip-text text-transparent mb-3">
            Past Questions
          </h2>
          <p className="cp-body max-w-2xl sm:text-base">
            Browse past exam questions by course, year, and semester.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Course code (e.g. CSC311)"
          value={searchCourse}
          onChange={(e) => { setSearchCourse(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm flex-1 min-w-[160px]"
        />
        <select
          value={searchYear}
          onChange={(e) => { setSearchYear(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All years</option>
          {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
        <select
          value={searchSemester}
          onChange={(e) => { setSearchSemester(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All semesters</option>
          <option value="FIRST">First Semester</option>
          <option value="SECOND">Second Semester</option>
        </select>
      </div>

      {/* Content */}
      <div className="rounded-[1.75rem] border border-sky-100 bg-white p-5 shadow-sm">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-200 border-t-blue-600" />
          </div>
        ) : error ? (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center">
            <span className="text-4xl">📝</span>
            <p className="mt-4 text-gray-600 font-semibold">No past questions found</p>
            <p className="text-sm text-gray-500 mt-1">Try adjusting your filters or upload one!</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 rounded-[1.25rem] border border-sky-100 bg-blue-50 p-4 transition-all hover:-translate-y-0.5 hover:border-sky-200 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="cp-card-title text-gray-900 truncate">{item.fileName}</p>
                    {item.examYear && (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                        {item.examYear}
                      </span>
                    )}
                    {item.semester && (
                      <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800">
                        {item.semester === 'FIRST' ? '1st Sem' : '2nd Sem'}
                      </span>
                    )}
                  </div>
                  {item.topic?.course && (
                    <p className="text-xs text-gray-500 mt-1">
                      {item.topic.course.code} — {item.topic.course.title}
                    </p>
                  )}
                  {item.summary && (
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{item.summary}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {(item.fileSize / 1024 / 1024).toFixed(1)} MB • Uploaded by {item.uploader.fullName}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={item.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 px-4 py-2 text-xs font-bold text-white hover:shadow-md transition-shadow"
                  >
                    📥 Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
