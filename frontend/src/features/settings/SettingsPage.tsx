import React, { useState } from 'react';
import { useAuth } from '@/features/auth/auth-context';
import { usePreferences } from '@/hooks/use-preferences';
import { usersApi } from '@/lib/api/users';
import { timerModesApi } from '@/lib/api/timer-modes';
import { categoriesApi } from '@/lib/api/categories';
import { labelsApi } from '@/lib/api/labels';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { soundEngine } from '@/lib/audio/sound';
import { formatSecondsToHuman, isValidHexColor } from '@/lib/utils/format';
import type { TimerFace, AmbientPreset } from '@/types/preferences';
import {
  Settings as SettingsIcon,
  User,
  Sliders,
  Volume2,
  FolderPlus,
  Plus,
  Trash2,
  Copy,
  Sparkles,
  Check,
  AlertTriangle,
  Loader2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export const SettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { profile, refreshProfile } = useAuth();
  const { preferences, updatePreferences } = usePreferences();

  // Profile form state with dirty tracking
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [isProfileDirty, setIsProfileDirty] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Global action error state for deletions/duplications
  const [actionError, setActionError] = useState<string | null>(null);

  // Synchronize form when profile becomes available or updates (without overwriting uncommitted edits)
  React.useEffect(() => {
    if (profile && !isProfileDirty) {
      setDisplayName(profile.displayName || '');
      setAvatarUrl(profile.avatarUrl || '');
      setBio(profile.bio || '');
    }
  }, [profile, isProfileDirty]);

  // Custom Mode Modal state
  const [isModeModalOpen, setIsModeModalOpen] = useState(false);
  const [modeName, setModeName] = useState('');
  const [focusMins, setFocusMins] = useState(25);
  const [shortBreakMins, setShortBreakMins] = useState(5);
  const [longBreakMins, setLongBreakMins] = useState(15);

  // Category Modal state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState('#6366F1');

  // Label Modal state
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [labelName, setLabelName] = useState('');
  const [labelColor, setLabelColor] = useState('#10B981');
  const [labelCatId, setLabelCatId] = useState<string>('');

  // Queries
  const { data: modes = [] } = useQuery({
    queryKey: ['timer-modes'],
    queryFn: timerModesApi.getTimerModes,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.getCategories,
  });

  const { data: labels = [] } = useQuery({
    queryKey: ['labels'],
    queryFn: () => labelsApi.getLabels(),
  });

  // Profile mutation
  const profileMutation = useMutation({
    mutationFn: () =>
      usersApi.updateMe({
        displayName: displayName.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
        bio: bio.trim() || undefined,
      }),
    onSuccess: async (updated) => {
      setProfileError(null);
      await refreshProfile();
      if (updated) {
        setDisplayName(updated.displayName || '');
        setAvatarUrl(updated.avatarUrl || '');
        setBio(updated.bio || '');
      }
      setIsProfileDirty(false);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    },
    onError: (err: any) => {
      setProfileError(err?.message || 'Failed to update profile');
    },
  });

  // Delete / Archive Mode Mutation
  const deleteModeMutation = useMutation({
    mutationFn: (id: string) => timerModesApi.deleteTimerMode(id),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['timer-modes'] });
    },
    onError: (err: any) => {
      setActionError(err?.message || 'Failed to archive timer mode');
    },
  });

  // Duplicate Mode Mutation
  const duplicateModeMutation = useMutation({
    mutationFn: (id: string) => timerModesApi.duplicateTimerMode(id),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['timer-modes'] });
    },
    onError: (err: any) => {
      setActionError(err?.message || 'Failed to duplicate timer mode');
    },
  });

  // Delete Category Mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => categoriesApi.deleteCategory(id),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['labels'] });
    },
    onError: (err: any) => {
      setActionError(err?.message || 'Failed to delete category');
    },
  });

  // Delete Label Mutation
  const deleteLabelMutation = useMutation({
    mutationFn: (id: string) => labelsApi.deleteLabel(id),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['labels'] });
    },
    onError: (err: any) => {
      setActionError(err?.message || 'Failed to delete label');
    },
  });

  // Create Mode Mutation
  const createModeMutation = useMutation({
    mutationFn: () =>
      timerModesApi.createTimerMode({
        name: modeName,
        focusDuration: focusMins * 60,
        shortBreakDuration: shortBreakMins * 60,
        longBreakDuration: longBreakMins * 60,
        longBreakInterval: 4,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timer-modes'] });
      setIsModeModalOpen(false);
      setModeName('');
    },
  });

  // Create Category Mutation
  const createCategoryMutation = useMutation({
    mutationFn: () =>
      categoriesApi.createCategory({
        name: catName,
        color: isValidHexColor(catColor) ? catColor : '#6366F1',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setIsCategoryModalOpen(false);
      setCatName('');
    },
  });

  // Create Label Mutation
  const createLabelMutation = useMutation({
    mutationFn: () =>
      labelsApi.createLabel({
        name: labelName,
        color: isValidHexColor(labelColor) ? labelColor : '#10B981',
        categoryId: labelCatId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels'] });
      setIsLabelModalOpen(false);
      setLabelName('');
    },
  });

  const handleTestChime = () => {
    soundEngine.playChime(preferences?.soundVolume ?? 0.7, true);
  };

  const handleAmbientChange = (preset: AmbientPreset) => {
    updatePreferences({ ambientPreset: preset });
    soundEngine.setAmbient(
      preset,
      preferences?.soundVolume ?? 0.5,
      preferences?.soundEnabled ?? true
    );
  };

  return (
    <div className="flex flex-col gap-10 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-amber-400" />
          Settings & Customization
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Personalize your focus workspace, timer aesthetics, audio ambience, and study taxonomy.
        </p>
      </div>

      {/* 1. Profile Section */}
      <section className="flex flex-col gap-4 p-6 bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-xl">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
          <User className="w-4 h-4 text-amber-400" />
          <span>User Profile</span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            profileMutation.mutate();
          }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-1"
        >
          {profileError && (
            <div className="sm:col-span-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{profileError}</span>
              </div>
              <button
                type="button"
                onClick={() => setProfileError(null)}
                className="text-red-400 hover:text-red-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <Input
            label="Display Name"
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              setIsProfileDirty(true);
            }}
            placeholder="Your name"
          />
          <Input
            label="Avatar Image URL"
            value={avatarUrl}
            onChange={(e) => {
              setAvatarUrl(e.target.value);
              setIsProfileDirty(true);
            }}
            placeholder="https://..."
          />
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-400">Bio</label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => {
                setBio(e.target.value);
                setIsProfileDirty(true);
              }}
              placeholder="What are you mastering?"
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 resize-none"
            />
          </div>

          <div className="sm:col-span-2 flex items-center justify-between pt-2 border-t border-white/5">
            {profileSaved ? (
              <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                <Check className="w-3.5 h-3.5" /> Profile updated successfully!
              </span>
            ) : <span />}
            <Button variant="primary" type="submit" isLoading={profileMutation.isPending}>
              Save Profile
            </Button>
          </div>
        </form>
      </section>

      {/* 2. Workspace & Timer Preferences */}
      <section className="flex flex-col gap-5 p-6 bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-xl">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
          <Sliders className="w-4 h-4 text-amber-400" />
          <span>Timer & Workspace Appearance</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Default Timer Face */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-zinc-400">Default Timer Face</label>
            <div className="grid grid-cols-2 gap-2">
              {(['ring', 'digital', 'flip', 'minimal'] as TimerFace[]).map((face) => (
                <button
                  key={face}
                  type="button"
                  onClick={() => updatePreferences({ timerFace: face })}
                  className={cn(
                    'px-3 py-2 rounded-xl text-xs font-medium border capitalize transition-all text-center',
                    preferences?.timerFace === face
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 font-semibold'
                      : 'border-white/10 text-zinc-400 hover:text-zinc-200'
                  )}
                >
                  {face}
                </button>
              ))}
            </div>
          </div>

          {/* Theme Preset */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-zinc-400">Theme Atmosphere</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'dark-glass', label: 'Dark Glass' },
                { id: 'nord', label: 'Nord Midnight' },
              ].map((th) => (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => updatePreferences({ theme: th.id })}
                  className={cn(
                    'px-3 py-2 rounded-xl text-xs font-medium border transition-all text-center',
                    preferences?.theme === th.id
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 font-semibold'
                      : 'border-white/10 text-zinc-400 hover:text-zinc-200'
                  )}
                >
                  {th.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Audio & Sound Experience */}
      <section className="flex flex-col gap-5 p-6 bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Volume2 className="w-4 h-4 text-amber-400" />
            <span>Audio & Ambient Sound</span>
          </div>
          <Button size="sm" variant="glass" onClick={handleTestChime}>
            Test Bell Chime
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Sound Enabled & Volume */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-300">Sound Alerts Enabled</span>
              <input
                type="checkbox"
                checked={preferences?.soundEnabled ?? true}
                onChange={(e) => updatePreferences({ soundEnabled: e.target.checked })}
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Alert Volume</span>
                <span className="font-mono">{Math.round((preferences?.soundVolume ?? 0.7) * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={preferences?.soundVolume ?? 0.7}
                onChange={(e) => updatePreferences({ soundVolume: parseFloat(e.target.value) })}
                className="accent-amber-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Ambient Noise Presets */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-zinc-400">Ambient Background Preset</label>
            <div className="flex flex-wrap gap-1.5">
              {(['none', 'rain', 'waves', 'cafe', 'white-noise'] as AmbientPreset[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleAmbientChange(preset)}
                  className={cn(
                    'px-2.5 py-1.5 rounded-lg text-xs capitalize border transition-all',
                    preferences?.ambientPreset === preset || (!preferences?.ambientPreset && preset === 'none')
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 font-semibold'
                      : 'border-white/10 text-zinc-400 hover:text-zinc-200'
                  )}
                >
                  {preset.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4. Timer Modes Manager */}
      <section className="flex flex-col gap-4 p-6 bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Timer Modes</span>
          </div>
          <Button size="sm" variant="glass" onClick={() => setIsModeModalOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Custom Mode
          </Button>
        </div>

        {actionError && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="text-red-400 hover:text-red-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {modes.map((mode) => {
            const isSystem = mode.userId === null;
            const isDuplicating = duplicateModeMutation.isPending && duplicateModeMutation.variables === mode.id;
            const isDeleting = deleteModeMutation.isPending && deleteModeMutation.variables === mode.id;

            return (
              <div
                key={mode.id}
                className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between gap-3"
              >
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-200 truncate">{mode.name}</span>
                    {isSystem && (
                      <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                        Default
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-zinc-500 mt-0.5 font-mono">
                    {formatSecondsToHuman(mode.focusDuration)} focus / {formatSecondsToHuman(mode.shortBreakDuration)} break
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={duplicateModeMutation.isPending || deleteModeMutation.isPending}
                    isLoading={isDuplicating}
                    onClick={() => duplicateModeMutation.mutate(mode.id)}
                    title="Duplicate mode"
                    className="w-7 h-7 text-zinc-400"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                  {!isSystem && (
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={deleteModeMutation.isPending || duplicateModeMutation.isPending}
                      isLoading={isDeleting}
                      onClick={() => deleteModeMutation.mutate(mode.id)}
                      title="Archive mode"
                      className="w-7 h-7 text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. Categories & Labels Manager */}
      <section className="flex flex-col gap-4 p-6 bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <FolderPlus className="w-4 h-4 text-amber-400" />
            <span>Categories & Labels</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="glass" onClick={() => setIsCategoryModalOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Category
            </Button>
            <Button size="sm" variant="glass" onClick={() => setIsLabelModalOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Label
            </Button>
          </div>
        </div>

        {/* Categories List */}
        <div className="flex flex-wrap gap-2 pt-1">
          {categories.map((cat) => {
            const isDeletingCat = deleteCategoryMutation.isPending && deleteCategoryMutation.variables === cat.id;

            return (
              <div
                key={cat.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border backdrop-blur-md text-xs font-medium"
                style={{
                  backgroundColor: `${cat.color}15`,
                  borderColor: `${cat.color}35`,
                  color: cat.color,
                }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                <span>{cat.name}</span>
                <button
                  type="button"
                  disabled={deleteCategoryMutation.isPending || deleteLabelMutation.isPending}
                  onClick={() => deleteCategoryMutation.mutate(cat.id)}
                  className="opacity-60 hover:opacity-100 transition-opacity ml-1 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Delete category"
                >
                  {isDeletingCat ? (
                    <Loader2 className="w-3 h-3 animate-spin text-current" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                </button>
              </div>
            );
          })}
          {categories.length === 0 && (
            <span className="text-xs text-zinc-500">No categories created yet. Click "+ Category" to add one.</span>
          )}
        </div>

        {/* Labels List */}
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/5">
          {labels.map((lbl) => {
            const isDeletingLbl = deleteLabelMutation.isPending && deleteLabelMutation.variables === lbl.id;

            return (
              <div
                key={lbl.id}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-medium"
                style={{
                  backgroundColor: `${lbl.color}15`,
                  borderColor: `${lbl.color}30`,
                  color: lbl.color,
                }}
              >
                <span>#{lbl.name}</span>
                <button
                  type="button"
                  disabled={deleteLabelMutation.isPending || deleteCategoryMutation.isPending}
                  onClick={() => deleteLabelMutation.mutate(lbl.id)}
                  className="opacity-60 hover:opacity-100 transition-opacity ml-0.5 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Delete label"
                >
                  {isDeletingLbl ? (
                    <Loader2 className="w-2.5 h-2.5 animate-spin text-current" />
                  ) : (
                    <Trash2 className="w-2.5 h-2.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Create Mode Modal */}
      <Modal
        isOpen={isModeModalOpen}
        onClose={() => setIsModeModalOpen(false)}
        title="Create Custom Timer Mode"
        maxWidth="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createModeMutation.mutate();
          }}
          className="flex flex-col gap-4 mt-2"
        >
          <Input
            label="Mode Name"
            placeholder="e.g. Ultra Sprint, Reading Block"
            value={modeName}
            onChange={(e) => setModeName(e.target.value)}
            required
          />
          <div className="grid grid-cols-3 gap-2">
            <Input
              type="number"
              label="Focus (min)"
              value={focusMins}
              onChange={(e) => setFocusMins(Number(e.target.value))}
              min={1}
              required
            />
            <Input
              type="number"
              label="Short (min)"
              value={shortBreakMins}
              onChange={(e) => setShortBreakMins(Number(e.target.value))}
              min={1}
              required
            />
            <Input
              type="number"
              label="Long (min)"
              value={longBreakMins}
              onChange={(e) => setLongBreakMins(Number(e.target.value))}
              min={1}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
            <Button variant="ghost" type="button" onClick={() => setIsModeModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={createModeMutation.isPending}>
              Create Mode
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Category Modal */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title="Create Category"
        maxWidth="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createCategoryMutation.mutate();
          }}
          className="flex flex-col gap-4 mt-2"
        >
          <Input
            label="Category Name"
            placeholder="e.g. Mathematics, System Design"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            required
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-400">Color (Hex)</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={catColor}
                onChange={(e) => setCatColor(e.target.value)}
                className="w-9 h-9 rounded-xl bg-transparent border-0 cursor-pointer"
              />
              <Input
                value={catColor}
                onChange={(e) => setCatColor(e.target.value)}
                placeholder="#6366F1"
                className="font-mono text-xs"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
            <Button variant="ghost" type="button" onClick={() => setIsCategoryModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={createCategoryMutation.isPending}>
              Create Category
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Label Modal */}
      <Modal
        isOpen={isLabelModalOpen}
        onClose={() => setIsLabelModalOpen(false)}
        title="Create Label"
        maxWidth="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createLabelMutation.mutate();
          }}
          className="flex flex-col gap-4 mt-2"
        >
          <Input
            label="Label Name"
            placeholder="e.g. leetcode, chapter-1"
            value={labelName}
            onChange={(e) => setLabelName(e.target.value)}
            required
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-400">Color (Hex)</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={labelColor}
                onChange={(e) => setLabelColor(e.target.value)}
                className="w-9 h-9 rounded-xl bg-transparent border-0 cursor-pointer"
              />
              <Input
                value={labelColor}
                onChange={(e) => setLabelColor(e.target.value)}
                placeholder="#10B981"
                className="font-mono text-xs"
              />
            </div>
          </div>
          {categories.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-400">Parent Category (Optional)</label>
              <select
                value={labelCatId}
                onChange={(e) => setLabelCatId(e.target.value)}
                className="w-full bg-[#12151A] border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-100"
              >
                <option value="">None (Independent)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
            <Button variant="ghost" type="button" onClick={() => setIsLabelModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={createLabelMutation.isPending}>
              Create Label
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
