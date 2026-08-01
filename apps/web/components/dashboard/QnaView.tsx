'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/context/auth-context';
import {
  useCourses,
  useTopics,
  useTopicQuestions,
  useTrendingQuestions,
  useSearchQuestions,
  useCreateQuestion,
  useCreateAnswer,
  useMarkHelpful,
  useAcceptAnswer,
  useTopAnswerers,
} from '@/queries/use-qna';
import type { CourseInfo, TopicInfo, QnaQuestion, QnaAnswer } from '@/queries/use-qna';

type View = 'browse' | 'questions' | 'detail';

export function QnaView() {
  const { user, isAuthenticated, promptLogin } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<CourseInfo | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<TopicInfo | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<QnaQuestion | null>(null);
  const [view, setView] = useState<View>('browse');
  const [showAskModal, setShowAskModal] = useState(false);
  const [askTitle, setAskTitle] = useState('');
  const [askContent, setAskContent] = useState('');
  const [answerContent, setAnswerContent] = useState('');
  const [searchBackView, setSearchBackView] = useState<View>('browse');

  const isSearching = debouncedSearch.trim().length >= 2;

  const { data: courses = [], isLoading: coursesLoading } = useCourses();
  const { data: topics = [], isLoading: topicsLoading } = useTopics(selectedCourse?.id ?? null);
  const { data: questions = [], isLoading: questionsLoading } = useTopicQuestions(selectedTopic?.id ?? null);
  const { data: trending = [], isLoading: trendingLoading } = useTrendingQuestions();
  const { data: searchResults = [], isLoading: searchLoading } = useSearchQuestions(debouncedSearch);
  const { data: topAnswerers = [] } = useTopAnswerers(selectedTopic?.id ?? null);

  const createQuestion = useCreateQuestion();
  const createAnswer = useCreateAnswer();
  const markHelpful = useMarkHelpful();
  const acceptAnswer = useAcceptAnswer();

  const handleSearch = useCallback((val: string) => {
    setSearchQuery(val);
    const timer = setTimeout(() => setDebouncedSearch(val), 400);
    return () => clearTimeout(timer);
  }, []);

  const handleCourseClick = useCallback((course: CourseInfo) => {
    setSelectedCourse(course);
    setSelectedTopic(null);
    setSelectedQuestion(null);
    setView('questions');
  }, []);

  const handleTopicClick = useCallback((topic: TopicInfo) => {
    setSelectedTopic(topic);
    setSelectedQuestion(null);
  }, []);

  const handleQuestionClick = useCallback((q: QnaQuestion) => {
    setSelectedQuestion(q);
    setSearchBackView(isSearching ? 'browse' : view);
    setView('detail');
    setAnswerContent('');
  }, [isSearching, view]);

  const handleBack = useCallback(() => {
    if (view === 'detail') {
      if (searchBackView === 'browse' && isSearching) {
        setSelectedQuestion(null);
        setView('browse');
        return;
      }
      setSelectedQuestion(null);
      setView('questions');
    } else if (view === 'questions') {
      setSelectedTopic(null);
      setSelectedCourse(null);
      setView('browse');
    }
  }, [view, searchBackView, isSearching]);

  const handleAskSubmit = useCallback(async () => {
    if (!selectedTopic || !askTitle.trim() || !askContent.trim()) return;
    try {
      await createQuestion.mutateAsync({
        topicId: selectedTopic.id,
        title: askTitle.trim(),
        content: askContent.trim(),
      });
      setAskTitle('');
      setAskContent('');
      setShowAskModal(false);
    } catch { toast.error('Failed to post question'); }
  }, [selectedTopic, askTitle, askContent, createQuestion]);

  const handleAnswerSubmit = useCallback(async () => {
    if (!selectedQuestion || !answerContent.trim()) return;
    try {
      await createAnswer.mutateAsync({
        questionId: selectedQuestion.id,
        content: answerContent.trim(),
      });
      setAnswerContent('');
    } catch { toast.error('Failed to post answer'); }
  }, [selectedQuestion, answerContent, createAnswer]);

  const handleMarkHelpful = useCallback(async (answerId: string) => {
    try { await markHelpful.mutateAsync(answerId); } catch { toast.error('Failed to mark as helpful'); }
  }, [markHelpful]);

  const handleAcceptAnswer = useCallback(async (answerId: string) => {
    if (!selectedQuestion) return;
    try {
      await acceptAnswer.mutateAsync({ questionId: selectedQuestion.id, answerId });
    } catch { toast.error('Failed to accept answer'); }
  }, [selectedQuestion, acceptAnswer]);

  const isOwner = (q: QnaQuestion) => user?.id === q.author.id;

  return (
    <section className="space-y-5 sm:space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-400 p-[1px] shadow-sm">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 font-bold text-[11px] uppercase tracking-wider text-gray-900">
              Help forum
            </span>
          </div>
          <h2 className="text-[clamp(1.5rem,3vw,2.2rem)] leading-[1.2] tracking-[-0.03em] font-black bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-400 bg-clip-text text-transparent mb-3">
            Q&A Forum
          </h2>
          <p className="cp-body max-w-2xl sm:text-base">
            Ask questions, get answers from classmates, and help each other learn.
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search questions..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm flex-1 min-w-[160px]"
        />
      </div>

      {isSearching ? (
        <div className="rounded-[1.75rem] border border-sky-100 bg-white p-5 shadow-sm">
          {searchLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-200 border-t-blue-600" />
            </div>
          ) : searchResults.length === 0 ? (
            <div className="py-8 text-center">
              <span className="text-3xl">🔍</span>
              <p className="mt-3 text-gray-600 font-semibold">No questions found</p>
              <p className="text-sm text-gray-500 mt-1">Try different search terms</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {searchResults.map((q) => (
                <SearchResultCard key={q.id} question={q} onClick={() => handleQuestionClick(q)} />
              ))}
            </div>
          )}
        </div>
      ) : view === 'browse' ? (
        <div className="space-y-6">
          {trending.length > 0 && (
            <div className="rounded-[1.75rem] border border-sky-100 bg-white p-5 shadow-sm">
              <h3 className="text-base font-black text-gray-900 mb-3 flex items-center gap-2">
                <span>🔥</span> Trending Questions
              </h3>
              {trendingLoading ? (
                <div className="flex justify-center py-4">
                  <div className="h-6 w-6 animate-spin rounded-full border-4 border-sky-200 border-t-blue-600" />
                </div>
              ) : (
                <div className="grid gap-2">
                  {trending.map((q) => (
                    <TrendingCard key={q.id} question={q} onClick={() => handleQuestionClick(q)} />
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="rounded-[1.75rem] border border-sky-100 bg-white p-5 shadow-sm">
            <h3 className="text-base font-black text-gray-900 mb-3">My Courses</h3>
            {coursesLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />
                ))}
              </div>
            ) : courses.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-gray-600 font-semibold">No courses found</p>
                <p className="text-sm text-gray-500 mt-1">
                  Set your level and department in your profile to see your courses.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {courses.map((course) => (
                  <button
                    key={course.id}
                    onClick={() => handleCourseClick(course)}
                    className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm text-left transition-all hover:shadow-md hover:-translate-y-0.5"
                  >
                    <p className="truncate text-sm font-black text-gray-900">{course.code}</p>
                    <p className="mt-0.5 truncate text-xs text-gray-600">{course.title}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">
                        L{course.level}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : view === 'questions' ? (
        <div className="rounded-[1.75rem] border border-sky-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={handleBack}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              ← Back
            </button>
            {selectedCourse && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{selectedCourse.code}</span>
                <span className="text-gray-400">—</span>
                <span className="truncate max-w-[200px]">{selectedCourse.title}</span>
              </div>
            )}
          </div>

          {topicsLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-200 border-t-blue-600" />
            </div>
          ) : topics.length === 0 ? (
            <div className="py-8 text-center">
              <span className="text-3xl">📂</span>
              <p className="mt-3 text-gray-600 font-semibold">No topics yet</p>
              <p className="text-sm text-gray-500 mt-1">This course has no discussion topics.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {topics.map((topic) => (
                <button
                  key={topic.id}
                  onClick={() => handleTopicClick(topic)}
                  className={`rounded-xl border p-4 shadow-sm text-left transition-all hover:shadow-md ${
                    selectedTopic?.id === topic.id
                      ? 'border-blue-300 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-blue-100 bg-white'
                  }`}
                >
                  <p className="text-sm font-black text-gray-900">{topic.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Last activity {new Date(topic.lastActivity).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          )}

          {selectedTopic && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-gray-900">
                  {selectedTopic.title}
                </h3>
                <button
                  onClick={() => setShowAskModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-400 px-4 py-2 text-xs font-bold text-white shadow-md hover:shadow-lg transition-all"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Ask Question
                </button>
              </div>

              {topAnswerers.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-500">Top contributors:</span>
                  {topAnswerers.map((a) => (
                    <span key={a.userId} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      {a.helpfulCount} helpful
                    </span>
                  ))}
                </div>
              )}

              {questionsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-200 border-t-blue-600" />
                </div>
              ) : questions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center">
                  <span className="text-3xl">💭</span>
                  <p className="mt-3 text-gray-600 font-semibold">No questions yet</p>
                  <p className="text-sm text-gray-500 mt-1">Be the first to ask a question in this topic!</p>
                </div>
              ) : (
                <div className="grid gap-2">
                  {questions.map((q) => (
                    <QuestionCard
                      key={q.id}
                      question={q}
                      onClick={() => handleQuestionClick(q)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-[1.75rem] border border-sky-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={handleBack}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              ← {searchBackView === 'browse' && isSearching ? 'Search Results' : 'Back'}
            </button>
            <span className="text-sm text-gray-500">Question</span>
          </div>

          {selectedQuestion && (
            <div className="space-y-6">
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {selectedQuestion.isResolved && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                          ✓ Resolved
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-black text-gray-900">{selectedQuestion.title}</h3>
                    <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{selectedQuestion.content}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
                  <span>Asked by {selectedQuestion.author.fullName}</span>
                  <span>{new Date(selectedQuestion.createdAt).toLocaleDateString()}</span>
                  <span>{selectedQuestion.viewCount} views</span>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-black text-gray-900">
                  Answers ({selectedQuestion.answers.length})
                </h4>
                {selectedQuestion.answers.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 py-6 text-center">
                    <p className="text-sm text-gray-500">No answers yet. Be the first to respond!</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {selectedQuestion.answers.map((answer) => (
                      <AnswerCard
                        key={answer.id}
                        answer={answer}
                        isOwner={isOwner(selectedQuestion)}
                        isAccepted={answer.isAccepted}
                        onMarkHelpful={() => handleMarkHelpful(answer.id)}
                        onAccept={() => handleAcceptAnswer(answer.id)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {isAuthenticated && (
                <div className="rounded-xl border border-gray-200 p-4">
                  <textarea
                    placeholder="Write your answer..."
                    value={answerContent}
                    onChange={(e) => setAnswerContent(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={handleAnswerSubmit}
                      disabled={!answerContent.trim() || createAnswer.isPending}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-400 px-4 py-2 text-xs font-bold text-white shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                    >
                      {createAnswer.isPending ? 'Posting...' : 'Post Answer'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showAskModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-[1.75rem] border border-blue-100 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-black text-gray-900 mb-4">Ask a Question</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Title</label>
                <input
                  type="text"
                  placeholder="What's your question?"
                  value={askTitle}
                  onChange={(e) => setAskTitle(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Details</label>
                <textarea
                  placeholder="Provide more context..."
                  value={askContent}
                  onChange={(e) => setAskContent(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => { setShowAskModal(false); setAskTitle(''); setAskContent(''); }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAskSubmit}
                disabled={!askTitle.trim() || !askContent.trim() || createQuestion.isPending}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-400 px-4 py-2 text-xs font-bold text-white shadow-md hover:shadow-lg transition-all disabled:opacity-50"
              >
                {createQuestion.isPending ? 'Posting...' : 'Post Question'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function TrendingCard({ question, onClick }: { question: QnaQuestion; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border border-blue-100 bg-white p-3 text-left transition-all hover:bg-blue-50 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {question.isResolved && <span className="text-emerald-600 text-xs">✓</span>}
            <p className="text-sm font-semibold text-gray-900 truncate">{question.title}</p>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{question.content}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-400">{question.helpCount} 👍</span>
          <span className="text-xs text-gray-400">{question.answers.length} 💬</span>
        </div>
      </div>
    </button>
  );
}

function SearchResultCard({ question, onClick }: { question: QnaQuestion; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border border-blue-100 bg-white p-4 text-left transition-all hover:bg-blue-50 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {question.isResolved && <span className="text-emerald-600 text-xs">✓</span>}
            <p className="text-sm font-semibold text-gray-900 truncate">{question.title}</p>
          </div>
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{question.content}</p>
          <p className="text-xs text-gray-400 mt-1">
            Asked by {question.author.fullName}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-gray-400">{question.helpCount} 👍</span>
          <span className="text-xs text-gray-400">{question.answers.length} 💬</span>
        </div>
      </div>
    </button>
  );
}

function QuestionCard({ question, onClick }: { question: QnaQuestion; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border border-blue-100 bg-white p-4 text-left transition-all hover:bg-blue-50 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {question.isResolved && (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                ✓ Resolved
              </span>
            )}
            <p className="text-sm font-semibold text-gray-900 truncate">{question.title}</p>
          </div>
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{question.content}</p>
          <p className="text-xs text-gray-400 mt-1">
            {question.author.fullName} · {new Date(question.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-xs text-gray-400">
          <span title="Helpful votes">{question.helpCount} 👍</span>
          <span title="Answers">{question.answers.length} 💬</span>
        </div>
      </div>
    </button>
  );
}

function AnswerCard({
  answer,
  isOwner,
  isAccepted,
  onMarkHelpful,
  onAccept,
}: {
  answer: QnaAnswer;
  isOwner: boolean;
  isAccepted: boolean;
  onMarkHelpful: () => void;
  onAccept: () => void;
}) {
  return (
    <div className={`rounded-xl border p-4 ${isAccepted ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100 bg-white'}`}>
      {isAccepted && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
            ✓ Accepted Answer
          </span>
        </div>
      )}
      <p className="text-sm text-gray-700 whitespace-pre-wrap">{answer.content}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          Answered by {answer.author.fullName} · {new Date(answer.createdAt).toLocaleDateString()}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={onMarkHelpful}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            👍 {answer.helpCount}
          </button>
          {isOwner && !isAccepted && (
            <button
              onClick={onAccept}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700 transition-colors"
            >
              ✓ Accept
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
