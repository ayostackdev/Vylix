'use client';

import React from 'react';
import { EmailLinkingModal } from '@/components/auth/EmailLinkingModal';
import { useEmailLinkingModal } from '@/hooks/useEmailLinkingModal';
import { useAuth } from '@/context/auth-context';

type EventItem = {
  id: number;
  title: string;
  desc: string;
};

const sampleEvents: EventItem[] = [
  {
    id: 1,
    title: 'Welcome Week Mixer',
    desc: 'Meet fellow students, clubs, and faculty at the annual welcome mixer.'
  },
  {
    id: 2,
    title: 'Career Fair: Tech & Design',
    desc: 'Connect with top companies hiring interns and graduates this summer.'
  },
  {
    id: 3,
    title: 'Research Symposium',
    desc: 'Student poster session and lightning talks showcasing ongoing research.'
  }
];

export default function StudentDashboard(): JSX.Element {
  const { user } = useAuth();
  const { shouldShowModal, primaryEmail, dismissModal, onSuccess } = useEmailLinkingModal();

  return (
    <>
      {/* Email Linking Modal - Progressive Onboarding */}
      {user && (
        <EmailLinkingModal
          isOpen={shouldShowModal}
          userId={user.id}
          currentEmail={user.email || primaryEmail}
          onClose={dismissModal}
          onSuccess={onSuccess}
        />
      )}

      <div className="min-h-screen flex bg-blue-100 text-slate-800">
        <aside className="w-64 flex-shrink-0 bg-slate-50 p-6 border-r border-blue-50">
          <div className="mb-6">
            <h2 className="text-blue-950 font-bold text-lg">Campus</h2>
            <p className="text-slate-800 text-sm mt-1">Student Portal</p>
          </div>

          <nav className="space-y-2">
            <a className="block rounded-md px-3 py-2 text-slate-800 hover:bg-blue-50" href="#">
              Dashboard
            </a>
            <a className="block rounded-md px-3 py-2 text-slate-800 hover:bg-blue-50" href="#">
              Events
            </a>
            <a className="block rounded-md px-3 py-2 text-slate-800 hover:bg-blue-50" href="#">
              Calendar
            </a>
            <a className="block rounded-md px-3 py-2 text-slate-800 hover:bg-blue-50" href="#">
              Clubs
            </a>
          </nav>
        </aside>

      <main className="flex-1 p-8">
        <header className="mb-6">
          <h1 className="text-2xl font-extrabold text-blue-950">Student Dashboard</h1>
          <p className="mt-1 text-slate-800">Upcoming events and campus highlights</p>
        </header>

        <section>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {sampleEvents.map((event) => (
              <article
                key={event.id}
                className="relative flex flex-col rounded-xl border border-blue-200 bg-blue-50 p-6 shadow-sm"
                aria-labelledby={`event-${event.id}-title`}
              >
                <div className="absolute -right-3 -top-3">
                  <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
                    New
                  </span>
                </div>

                <div className="flex-1">
                  <h3 id={`event-${event.id}-title`} className="mb-2 text-lg font-bold text-blue-950">
                    {event.title}
                  </h3>
                  <p className="text-sm text-slate-800">{event.desc}</p>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    className="inline-flex items-center rounded-md bg-green-500 px-4 py-2 font-medium text-white hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-300"
                  >
                    RSVP
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
    </>
  );
}
