import { useState } from 'react';
import type { TimerMode, TimerStageConfig, TimerCategory } from '../../api.js';
import { Plus, Trash2, X } from 'lucide-react';

interface TimerModeFormProps {
  initialData?: TimerMode;
  categories: TimerCategory[];
  onSubmit: (data: Partial<TimerMode>) => Promise<void>;
  onCancel: () => void;
}

export function TimerModeForm({ initialData, categories, onSubmit, onCancel }: TimerModeFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [loop, setLoop] = useState(initialData?.loop ?? false);
  
  const defaultFocusCategory = categories.find(c => c.name === 'Focus')?.id || categories[0]?.id || '';
  const defaultRestCategory = categories.find(c => c.name === 'Rest')?.id || categories[0]?.id || '';

  // Convert backend durationSeconds back to minutes for the UI
  const [stagesConfig, setStagesConfig] = useState<{ categoryId: string; durationMinutes: string }[]>(
    initialData?.stagesConfig 
      ? initialData.stagesConfig.map(s => ({
          categoryId: s.categoryId,
          durationMinutes: Math.floor(s.durationSeconds / 60).toString()
        }))
      : [{ categoryId: defaultFocusCategory, durationMinutes: '45' }, { categoryId: defaultRestCategory, durationMinutes: '15' }]
  );

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddStage = () => {
    setStagesConfig([...stagesConfig, { categoryId: defaultFocusCategory, durationMinutes: '45' }]);
  };

  const handleRemoveStage = (index: number) => {
    if (stagesConfig.length <= 1) return; // Enforce at least one stage
    const newStages = [...stagesConfig];
    newStages.splice(index, 1);
    setStagesConfig(newStages);
  };

  const handleStageChange = (index: number, field: 'categoryId' | 'durationMinutes', value: string) => {
    const newStages = [...stagesConfig];
    newStages[index][field] = value;
    setStagesConfig(newStages);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name is required.');
      return;
    }

    if (stagesConfig.length === 0) {
      setError('At least one stage is required.');
      return;
    }

    const processedStages: TimerStageConfig[] = [];

    for (let i = 0; i < stagesConfig.length; i++) {
      const stage = stagesConfig[i];
      const mins = parseInt(stage.durationMinutes, 10);
      
      if (isNaN(mins) || mins < 1) {
        setError(`Stage ${i + 1} duration must be at least 1 minute.`);
        return;
      }

      processedStages.push({
        categoryId: stage.categoryId,
        durationSeconds: mins * 60,
      });
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        name,
        description,
        loop,
        stagesConfig: processedStages,
      });
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-800">
            {initialData ? 'Edit Timer Mode' : 'Create Timer Mode'}
          </h2>
          <button onClick={onCancel} className="text-slate-500 hover:text-slate-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 border border-red-100">
              {error}
            </div>
          )}

          <form id="timerModeForm" onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                placeholder="e.g. Deep Work 90m"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all resize-none"
                placeholder="e.g. Long focus blocks with substantial breaks"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="loopCheckbox"
                checked={loop}
                onChange={e => setLoop(e.target.checked)}
                className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
              />
              <label htmlFor="loopCheckbox" className="text-sm font-medium text-slate-700">
                Loop these stages continuously
              </label>
            </div>

            <hr className="border-slate-200" />

            <div>
              <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-medium text-slate-700">Timer Stages</label>
                <button
                  type="button"
                  onClick={handleAddStage}
                  className="text-sm font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add Stage
                </button>
              </div>

              <div className="space-y-3">
                {stagesConfig.map((stage, idx) => (
                  <div key={idx} className="flex gap-4 items-center bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div className="font-medium text-slate-400 w-6 text-center">{idx + 1}</div>
                    
                    <div className="flex-1">
                      <select
                        value={stage.categoryId}
                        onChange={e => handleStageChange(idx, 'categoryId', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                      >
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="w-32 relative">
                      <input
                        type="number"
                        min="1"
                        value={stage.durationMinutes}
                        onChange={e => handleStageChange(idx, 'durationMinutes', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="Mins"
                      />
                      <span className="absolute right-3 top-2.5 text-sm text-slate-400 pointer-events-none">min</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveStage(idx)}
                      disabled={stagesConfig.length <= 1}
                      className="p-2 text-slate-400 hover:text-red-500 disabled:opacity-50 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end gap-3 bg-slate-50 rounded-b-xl">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="timerModeForm"
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : initialData ? 'Save Changes' : 'Create Mode'}
          </button>
        </div>
      </div>
    </div>
  );
}
