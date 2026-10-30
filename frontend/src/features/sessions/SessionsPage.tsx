import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studySessionsApi } from '@/lib/api/study-sessions';
import { formatSecondsToHuman, formatDate } from '@/lib/utils/format';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import type { StudySession, StudySessionStatus } from '@/types/study-session';
import { History, Clock, Calendar, Trash2, Edit3, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';

export const SessionsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StudySessionStatus | undefined>(undefined);
  const [editingSession, setEditingSession] = useState<StudySession | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  // Form state for editing
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['study-sessions', page, statusFilter],
    queryFn: () =>
      studySessionsApi.getStudySessions({
        page,
        limit: 10,
        status: statusFilter,
      }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { title?: string; notes?: string } }) =>
      studySessionsApi.updateStudySession(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-sessions'] });
      setEditingSession(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => studySessionsApi.deleteStudySession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      setDeletingSessionId(null);
    },
  });

  const sessions = data?.data || [];
  const meta = data?.meta;

  const openEditModal = (session: StudySession) => {
    setEditingSession(session);
    setEditTitle(session.title || '');
    setEditNotes(session.notes || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession) return;
    await updateMutation.mutateAsync({
      id: editingSession.id,
      data: {
        title: editTitle.trim() || undefined,
        notes: editNotes.trim() || undefined,
      },
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <History className="w-6 h-6 text-amber-400" />
            Study History
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Authoritative records of your completed and focused study sessions.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-white/[0.03] border border-white/10 rounded-xl">
          <button
            onClick={() => { setStatusFilter(undefined); setPage(1); }}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              !statusFilter ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => { setStatusFilter('COMPLETED'); setPage(1); }}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              statusFilter === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-300' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Completed
          </button>
          <button
            onClick={() => { setStatusFilter('INTERRUPTED'); setPage(1); }}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              statusFilter === 'INTERRUPTED' ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Interrupted
          </button>
        </div>
      </div>

      {/* Sessions List */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-20 bg-white/[0.02] border border-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white/[0.02] border border-white/5 rounded-3xl text-center">
          <Inbox className="w-12 h-12 text-zinc-600 mb-3" />
          <h2 className="text-sm font-semibold text-zinc-300">No study sessions recorded</h2>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm">
            Start a focus timer in the Focus Workspace and complete your study block to see your records appear here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map((session) => {
            const isCompleted = session.status === 'COMPLETED';

            return (
              <div
                key={session.id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-5 bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 hover:border-white/10 rounded-2xl backdrop-blur-xl transition-all"
              >
                <div className="flex flex-col gap-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-100 truncate">
                      {session.title || 'Focus Session'}
                    </span>
                    <Badge variant={isCompleted ? 'success' : 'focus'}>
                      {session.status}
                    </Badge>
                    <span className="text-[11px] font-mono text-zinc-500 uppercase">
                      {session.phase.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-zinc-500" />
                      <strong className="text-zinc-200 font-semibold">
                        {formatSecondsToHuman(session.actualDuration)}
                      </strong>{' '}
                      credited
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1 text-zinc-500">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(session.startedAt)}
                    </span>
                  </div>

                  {/* Attached categories and labels */}
                  {(session.categories?.length || session.labels?.length) ? (
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {session.categories?.map(({ category }) => (
                        <span
                          key={category.id}
                          className="px-2 py-0.5 rounded text-[11px] font-medium border"
                          style={{
                            backgroundColor: `${category.color}20`,
                            borderColor: `${category.color}40`,
                            color: category.color,
                          }}
                        >
                          {category.name}
                        </span>
                      ))}
                      {session.labels?.map(({ label }) => (
                        <span
                          key={label.id}
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium border"
                          style={{
                            backgroundColor: `${label.color}15`,
                            borderColor: `${label.color}30`,
                            color: label.color,
                          }}
                        >
                          #{label.name}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {session.notes && (
                    <p className="text-xs text-zinc-400 italic mt-1 bg-white/[0.02] p-2 rounded-lg border border-white/5">
                      "{session.notes}"
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openEditModal(session)}
                    className="w-8 h-8 text-zinc-400 hover:text-zinc-200"
                    title="Edit session details"
                  >
                    <Edit3 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setDeletingSessionId(session.id)}
                    className="w-8 h-8 text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                    title="Delete session"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Footer */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-white/5 text-xs text-zinc-400">
          <span>
            Page {meta.page} of {meta.totalPages} ({meta.total} sessions)
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="glass"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Previous
            </Button>
            <Button
              size="sm"
              variant="glass"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit Session Modal */}
      <Modal
        isOpen={Boolean(editingSession)}
        onClose={() => setEditingSession(null)}
        title="Edit Study Session"
        maxWidth="sm"
      >
        <form onSubmit={handleSaveEdit} className="flex flex-col gap-4 mt-2">
          <Input
            label="Title"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Session title"
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-400">Notes</label>
            <textarea
              rows={3}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 resize-none"
              placeholder="Session reflections"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
            <Button variant="ghost" type="button" onClick={() => setEditingSession(null)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={updateMutation.isPending}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deletingSessionId)}
        onClose={() => setDeletingSessionId(null)}
        title="Delete Session Record?"
        description="This will permanently delete this study session and adjust your analytics totals accordingly."
        maxWidth="sm"
      >
        <div className="flex justify-end gap-2 pt-4 border-t border-white/5">
          <Button variant="ghost" onClick={() => setDeletingSessionId(null)}>
            Keep Session
          </Button>
          <Button
            variant="danger"
            onClick={() => deletingSessionId && deleteMutation.mutate(deletingSessionId)}
            isLoading={deleteMutation.isPending}
          >
            Delete Permanently
          </Button>
        </div>
      </Modal>
    </div>
  );
};
