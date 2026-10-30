import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { categoriesApi } from '@/lib/api/categories';
import { labelsApi } from '@/lib/api/labels';
import type { TimerPhase } from '@/types/timer';
import { Target, Tag, Folder, Edit3, X, Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface SessionIntention {
  goalTitle: string;
  categoryId: string | null;
  labelIds: string[];
}

interface SessionIntentionBarProps {
  intention: SessionIntention;
  onChangeIntention: (intention: SessionIntention) => void;
  isActive: boolean; // isRunning || isPaused
  phase: TimerPhase;
}

export const SessionIntentionBar: React.FC<SessionIntentionBarProps> = ({
  intention,
  onChangeIntention,
  isActive,
  phase,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Queries for categories and labels
  const { data: categories = [], isLoading: isCategoriesLoading, isError: isCategoriesError } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.getCategories,
    staleTime: 1000 * 60 * 5,
  });

  const { data: labels = [], isLoading: isLabelsLoading } = useQuery({
    queryKey: ['labels', intention.categoryId],
    queryFn: () => labelsApi.getLabels(intention.categoryId || undefined),
    staleTime: 1000 * 60 * 5,
  });

  // Local draft state when popover is open
  const [draftGoal, setDraftGoal] = useState(intention.goalTitle);
  const [draftCategory, setDraftCategory] = useState<string | null>(intention.categoryId);
  const [draftLabels, setDraftLabels] = useState<string[]>(intention.labelIds);

  // Sync draft state with props whenever popover opens or intention changes
  useEffect(() => {
    setDraftGoal(intention.goalTitle);
    setDraftCategory(intention.categoryId);
    setDraftLabels(intention.labelIds);
  }, [isOpen, intention]);

  // Click outside and Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSave = () => {
    onChangeIntention({
      goalTitle: draftGoal.trim(),
      categoryId: draftCategory,
      labelIds: draftLabels,
    });
    setIsOpen(false);
  };

  const handleClear = () => {
    setDraftGoal('');
    setDraftCategory(null);
    setDraftLabels([]);
    onChangeIntention({
      goalTitle: '',
      categoryId: null,
      labelIds: [],
    });
    setIsOpen(false);
  };

  const toggleDraftLabel = (labelId: string) => {
    setDraftLabels((prev) =>
      prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId]
    );
  };

  // Resolved entities
  const selectedCategory = categories.find((c) => c.id === intention.categoryId);
  const selectedLabels = labels.filter((l) => intention.labelIds.includes(l.id));

  const hasIntention = Boolean(
    intention.goalTitle.trim() || selectedCategory || selectedLabels.length > 0
  );

  const isBreak = phase.includes('BREAK');

  return (
    <div className="relative inline-block text-left w-full max-w-lg mx-auto z-30" ref={popoverRef}>
      {/* Intention Pill Trigger */}
      <div className="flex items-center justify-center w-full">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label="Set session intention"
          className={cn(
            'flex items-center gap-2 px-3.5 py-1.5 rounded-full backdrop-blur-xl border transition-all text-xs max-w-full truncate',
            // Active vs Idle styling
            isActive
              ? 'bg-[#101319]/80 border-white/10 text-zinc-300 shadow-md py-1 px-3 text-[11px]'
              : 'bg-[#101319]/90 border-white/[0.08] hover:border-white/20 text-zinc-200 shadow-lg',
            hasIntention && !isActive && 'border-amber-500/20'
          )}
        >
          {/* Target Icon */}
          <Target
            className={cn(
              'w-3.5 h-3.5 shrink-0 transition-colors',
              hasIntention
                ? isBreak
                  ? 'text-teal-400'
                  : 'text-amber-400'
                : 'text-zinc-500'
            )}
          />

          {/* Intention details or placeholder */}
          {hasIntention ? (
            <div className="flex items-center gap-2 truncate">
              {/* Category chip */}
              {selectedCategory && (
                <span
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0"
                  style={{
                    backgroundColor: `${selectedCategory.color}20`,
                    color: selectedCategory.color,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: selectedCategory.color }}
                  />
                  <span>{selectedCategory.name}</span>
                </span>
              )}

              {/* Goal title */}
              {intention.goalTitle ? (
                <span className="font-medium text-zinc-200 truncate">
                  {intention.goalTitle}
                </span>
              ) : (
                <span className="text-zinc-400 italic">No goal title</span>
              )}

              {/* Label chips count if any */}
              {selectedLabels.length > 0 && (
                <div className="hidden sm:flex items-center gap-1 shrink-0">
                  {selectedLabels.slice(0, 2).map((lbl) => (
                    <span
                      key={lbl.id}
                      className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-zinc-400 border border-white/10"
                    >
                      #{lbl.name}
                    </span>
                  ))}
                  {selectedLabels.length > 2 && (
                    <span className="text-[10px] text-zinc-500">
                      +{selectedLabels.length - 2}
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <span className="text-zinc-400 font-normal">
              {isCategoriesLoading
                ? 'Loading workspace...'
                : 'Set session goal or topic...'}
            </span>
          )}

          {/* Edit icon */}
          <Edit3 className="w-3 h-3 text-zinc-500 ml-1 shrink-0" />
        </button>
      </div>

      {/* Popover Selection Modal / Dropdown */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Session Intention Selector"
          className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-[#12151A] border border-white/10 rounded-2xl p-4 shadow-2xl backdrop-blur-2xl z-50 animate-scale-up"
        >
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
                Session Intention
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-zinc-500 hover:text-zinc-300 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col gap-3.5 mt-3">
            {/* Goal Input */}
            <div>
              <label className="text-[11px] font-medium text-zinc-400 mb-1 block">
                Session Goal / Task
              </label>
              <input
                type="text"
                value={draftGoal}
                onChange={(e) => setDraftGoal(e.target.value)}
                placeholder="e.g. Linear Algebra, Read Chapter 4"
                maxLength={120}
                className="w-full px-3 py-2 text-xs rounded-xl bg-black/40 border border-white/10 focus:border-amber-500/50 focus:outline-none text-zinc-100 placeholder-zinc-600 transition-colors"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSave();
                  }
                }}
              />
            </div>

            {/* Category Selection */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
                  <Folder className="w-3 h-3 text-zinc-500" />
                  Category
                </label>
                {draftCategory && (
                  <button
                    onClick={() => setDraftCategory(null)}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300"
                  >
                    Clear category
                  </button>
                )}
              </div>

              {isCategoriesLoading ? (
                <div className="text-[11px] text-zinc-500 py-1">Loading categories...</div>
              ) : isCategoriesError ? (
                <div className="text-[11px] text-red-400 py-1">Failed to load categories</div>
              ) : categories.length === 0 ? (
                <div className="text-[11px] text-zinc-500 italic py-1">
                  No categories created yet (create one in Settings).
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                  {categories.map((cat) => {
                    const isSelected = draftCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() =>
                          setDraftCategory(isSelected ? null : cat.id)
                        }
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border',
                          isSelected
                            ? 'border-white/30 text-white shadow-sm'
                            : 'border-white/5 text-zinc-400 hover:border-white/10 hover:text-zinc-200 bg-white/[0.02]'
                        )}
                        style={
                          isSelected
                            ? {
                                backgroundColor: `${cat.color}25`,
                                borderColor: `${cat.color}60`,
                                color: cat.color,
                              }
                            : {}
                        }
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span>{cat.name}</span>
                        {isSelected && <Check className="w-3 h-3 ml-0.5" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Labels Multi-Selection */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
                  <Tag className="w-3 h-3 text-zinc-500" />
                  Labels
                </label>
                {draftLabels.length > 0 && (
                  <button
                    onClick={() => setDraftLabels([])}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300"
                  >
                    Clear labels
                  </button>
                )}
              </div>

              {isLabelsLoading ? (
                <div className="text-[11px] text-zinc-500 py-1">Loading labels...</div>
              ) : labels.length === 0 ? (
                <div className="text-[11px] text-zinc-500 italic py-1">
                  No labels found.
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                  {labels.map((lbl) => {
                    const isSelected = draftLabels.includes(lbl.id);
                    return (
                      <button
                        key={lbl.id}
                        type="button"
                        onClick={() => toggleDraftLabel(lbl.id)}
                        className={cn(
                          'px-2 py-0.5 rounded-md text-[11px] font-medium transition-all border',
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                            : 'bg-white/[0.02] border-white/5 text-zinc-400 hover:border-white/10 hover:text-zinc-200'
                        )}
                      >
                        #{lbl.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/10">
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Reset
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 transition-colors shadow-md"
              >
                Set Intention
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
