import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useQuery } from '@tanstack/react-query';
import { categoriesApi } from '@/lib/api/categories';
import { labelsApi } from '@/lib/api/labels';
import { formatSecondsToHuman } from '@/lib/utils/format';
import type { CompleteTimerPayload, TimerPhase } from '@/types/timer';
import { CheckCircle2, Tag, Folder, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface CompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: Omit<CompleteTimerPayload, 'timerSessionId'>) => Promise<void>;
  targetDuration: number;
  phase: TimerPhase;
  isMutating: boolean;
  initialTitle?: string;
  initialCategoryId?: string | null;
  initialLabelIds?: string[];
}

export const CompletionModal: React.FC<CompletionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  targetDuration,
  phase,
  isMutating,
  initialTitle,
  initialCategoryId,
  initialLabelIds,
}) => {
  const [title, setTitle] = useState(initialTitle || '');
  const [notes, setNotes] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(initialCategoryId || null);
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>(initialLabelIds || []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPending = isMutating || isSubmitting;

  const prevIsOpenRef = useRef(false);

  // Trigger celebration confetti upon opening and initialize form state
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setTitle(initialTitle || '');
      setNotes('');
      setSelectedCategoryId(initialCategoryId || null);
      setSelectedLabelIds(initialLabelIds ? [...initialLabelIds] : []);
      setError(null);
      setIsSubmitting(false);

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#F59E0B', '#14B8A6', '#6366F1', '#10B981'],
      });
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, initialTitle, initialCategoryId, initialLabelIds]);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.getCategories,
    enabled: isOpen,
  });

  const { data: labels = [] } = useQuery({
    queryKey: ['labels', selectedCategoryId],
    queryFn: () => labelsApi.getLabels(selectedCategoryId || undefined),
    enabled: isOpen,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;

    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirm({
        title: title.trim() || undefined,
        notes: notes.trim() || undefined,
        categoryIds: selectedCategoryId ? [selectedCategoryId] : [],
        labelIds: selectedLabelIds.length > 0 ? selectedLabelIds : [],
        advanceToNextPhase: true,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to complete session. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipTagging = async () => {
    if (isPending) return;

    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirm({
        title: undefined,
        notes: undefined,
        categoryIds: [],
        labelIds: [],
        advanceToNextPhase: true,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to complete session. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleLabel = (labelId: string) => {
    setSelectedLabelIds((prev) =>
      prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId]
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Session Completed"
      description={`Great focus! You completed ${formatSecondsToHuman(targetDuration)} of ${(phase || 'focus').toLowerCase().replace('_', ' ')}.`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
        <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-amber-400" />
          <span>Credited to your personal study records. Tag it below to track in analytics.</span>
        </div>

        <Input
          label="Session Title"
          placeholder="e.g. Linear Algebra, React Hooks, Reading Chapter 4"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
        />

        {/* Categories selector */}
        {categories.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5" /> Category
            </span>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => {
                const isSelected = selectedCategoryId === cat.id;
                return (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(isSelected ? null : cat.id)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5',
                      isSelected
                        ? 'border-white/40 text-white shadow-sm'
                        : 'border-white/10 text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                    )}
                    style={{
                      backgroundColor: isSelected ? `${cat.color}25` : undefined,
                      borderColor: isSelected ? cat.color : undefined,
                    }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Labels selector */}
        {labels.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" /> Labels
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {labels.map((lbl) => {
                const isSelected = selectedLabelIds.includes(lbl.id);
                return (
                  <button
                    type="button"
                    key={lbl.id}
                    onClick={() => toggleLabel(lbl.id)}
                    className={cn(
                      'px-2 py-0.5 rounded-md text-[11px] font-medium border transition-all flex items-center gap-1',
                      isSelected
                        ? 'border-white/30 text-white'
                        : 'border-white/10 text-zinc-400 hover:text-zinc-200'
                    )}
                    style={{
                      backgroundColor: isSelected ? `${lbl.color}25` : undefined,
                      borderColor: isSelected ? lbl.color : undefined,
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: lbl.color }} />
                    {lbl.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Reflection Notes */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="notes" className="text-xs font-medium text-zinc-400">
            Notes & Reflections
          </label>
          <textarea
            id="notes"
            rows={3}
            placeholder="What did you achieve? Any blockers or next steps?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition-all resize-none"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/5">
          <Button
            variant="ghost"
            type="button"
            onClick={handleSkipTagging}
            disabled={isPending}
            isLoading={isSubmitting}
          >
            Skip Tagging
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={isPending}
            isLoading={isPending}
          >
            Save & Finish
          </Button>
        </div>
      </form>
    </Modal>
  );
};
