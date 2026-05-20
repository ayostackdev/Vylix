const quickStats = [
  { label: 'Saved PDFs', value: '0' },
  { label: 'Available Offline', value: '0' },
  { label: 'Space Used', value: '0 MB' }
];

const recentItems = [
  { title: 'MTS 201 Tutorial Sheet', tag: 'PDF', state: 'Not cached yet' },
  { title: 'PHY 303 Past Questions', tag: 'Archive', state: 'Not cached yet' },
  { title: 'CSC 311 Lecture Notes', tag: 'Slides', state: 'Not cached yet' }
];

export function PrivateVaultView() {
  return (
    <section className="space-y-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm sm:space-y-8 sm:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-blue-950 sm:text-4xl">Private Vault</h2>
          <p className="max-w-2xl text-sm text-slate-800 sm:text-base">
          Your personal offline library for zero-interruption study sessions. Materials cached and ready when campus network drops.
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
          Offline-ready
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        {quickStats.map((stat) => (
          <article key={stat.label} className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm transition-all duration-300 hover:border-blue-300">
            <p className="text-xs font-black uppercase tracking-wider text-slate-800">{stat.label}</p>
            <p className="mt-3 text-3xl font-black text-blue-950">
              {stat.value}
            </p>
          </article>
        ))}
      </div>

      <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <h3 className="text-lg font-black text-blue-950">Recent Vault Materials</h3>
          <span className="rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
            Preview
          </span>
        </div>

        <div className="mt-5 grid gap-3">
          {recentItems.map((item) => (
            <div
              key={item.title}
              className="flex flex-col gap-2 rounded-xl border border-blue-200 bg-blue-50 p-4 transition-all duration-300 hover:border-blue-300 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-bold text-blue-950">{item.title}</p>
                <p className="text-xs text-slate-800">{item.state}</p>
              </div>
              <span className="w-fit rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
                {item.tag}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
