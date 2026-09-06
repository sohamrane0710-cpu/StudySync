const MOCK_PARTICIPANTS = [
  {
    id: 'p-1',
    displayName: 'Soham',
    username: 'soham',
    status: 'studying',
    sessionLabel: 'DSA',
    avatarUrl: null
  },
  {
    id: 'p-2',
    displayName: 'Alex',
    username: 'alex_dev',
    status: 'studying',
    sessionLabel: 'Operating Systems',
    avatarUrl: null
  },
  {
    id: 'p-3',
    displayName: 'Sarah',
    username: 'sarah99',
    status: 'idle',
    sessionLabel: null,
    avatarUrl: null
  }
];

export function ParticipantList() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 tracking-tight">Participants</h3>
        <span className="bg-slate-200 text-slate-700 text-xs font-bold px-2 py-0.5 rounded-full">
          {MOCK_PARTICIPANTS.length}
        </span>
      </div>
      <div className="p-2 space-y-1 overflow-y-auto max-h-[300px]">
        {MOCK_PARTICIPANTS.map(p => (
          <div key={p.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
            <div className="relative flex-shrink-0 mt-0.5">
              <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm border border-slate-300 uppercase">
                {p.displayName.charAt(0)}
              </div>
              <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${p.status === 'studying' ? 'bg-emerald-500' : 'bg-amber-400'}`}></div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{p.displayName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs text-slate-500 capitalize">{p.status}</span>
                {p.sessionLabel && (
                  <>
                    <span className="text-slate-300 text-xs">•</span>
                    <span className="text-xs text-slate-600 truncate font-medium bg-slate-100 px-1.5 py-0.5 rounded">
                      {p.sessionLabel}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
