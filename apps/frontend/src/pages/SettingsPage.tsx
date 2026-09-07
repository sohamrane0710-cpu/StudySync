import { useState, useEffect } from 'react';
import { getTimerCategories, createTimerCategory, updateTimerCategory, deleteTimerCategory } from '../api.js';
import type { TimerCategory } from '../api.js';
import { Plus, Trash2, Edit2, X, Check } from 'lucide-react';

export function SettingsPage() {
  const [categories, setCategories] = useState<TimerCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await getTimerCategories();
      setCategories(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    try {
      setError(null);
      await createTimerCategory({ name: newCategoryName.trim() });
      setNewCategoryName('');
      await loadCategories();
    } catch (err: any) {
      setError(err.message || 'Failed to create category');
    }
  };

  const handleStartEdit = (category: TimerCategory) => {
    setEditingId(category.id);
    setEditName(category.name);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;

    try {
      setError(null);
      await updateTimerCategory(editingId, { name: editName.trim() });
      setEditingId(null);
      await loadCategories();
    } catch (err: any) {
      setError(err.message || 'Failed to update category');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    try {
      setError(null);
      await deleteTimerCategory(id);
      await loadCategories();
    } catch (err: any) {
      if (err.message?.includes('409') || err.message?.includes('history') || err.message?.includes('use')) {
         setError('Cannot delete category. It is used in an existing TimerMode or has historical session data.');
      } else {
         setError(err.message || 'Failed to delete category');
      }
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-8 text-slate-800">Settings</h1>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Timer Categories</h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage categories used to classify your timer stages. Categories with historical data cannot be deleted.
          </p>
        </div>

        <div className="p-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 border border-red-100 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleCreate} className="flex gap-3 mb-8">
            <input
              type="text"
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              placeholder="New category name (e.g. Reading, Code)"
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <button
              type="submit"
              disabled={!newCategoryName.trim()}
              className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </form>

          {loading ? (
            <div className="text-center text-slate-500 py-8">Loading categories...</div>
          ) : (
            <div className="space-y-3">
              {categories.map(category => (
                <div key={category.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
                  {editingId === category.id ? (
                    <div className="flex flex-1 items-center gap-3">
                      <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="flex-1 px-3 py-1.5 border border-slate-300 rounded outline-none focus:border-emerald-500"
                        autoFocus
                      />
                      <button onClick={handleSaveEdit} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded">
                        <Check className="w-5 h-5" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:bg-slate-200 rounded">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="font-medium text-slate-700">{category.name}</div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleStartEdit(category)}
                          className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(category.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
