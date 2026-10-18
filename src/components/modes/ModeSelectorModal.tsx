import React, { useState } from 'react';
import { useTimer } from '../../context/TimerContext';
import type { ModeDefinition } from '../../types/timer';
import { ModeService } from '../../services/modeService';
import { ModeEditorModal } from './ModeEditorModal';
import { formatHumanDuration } from '../../utils/timeFormat';

export interface ModeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModeSelectorModal: React.FC<ModeSelectorModalProps> = ({ isOpen, onClose }) => {
  const { allModes, activeMode, selectMode, saveCustomMode, deleteCustomMode, snapshot } = useTimer();

  const [editingMode, setEditingMode] = useState<ModeDefinition | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  if (!isOpen) return null;

  const isTimerBusy = snapshot.state === 'running' || snapshot.state === 'paused';

  const handleSelect = (mode: ModeDefinition) => {
    if (isTimerBusy) return;
    selectMode(mode.id);
    onClose();
  };

  const handleDuplicate = (mode: ModeDefinition, e: React.MouseEvent) => {
    e.stopPropagation();
    const copy = ModeService.duplicateMode(mode);
    saveCustomMode(copy);
  };

  const handleEdit = (mode: ModeDefinition, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingMode(mode);
    setIsEditorOpen(true);
  };

  const handleDelete = (modeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteCustomMode(modeId);
  };

  const handleCreateNew = () => {
    const blank = ModeService.createBlankCustomMode();
    setEditingMode(blank);
    setIsEditorOpen(true);
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mode-selector-title"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}
        onClick={onClose}
      >
        <div
          className="glass-l3"
          style={{
            width: '100%',
            maxWidth: '520px',
            maxHeight: '85vh',
            background: 'rgba(18, 21, 26, 0.98)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 48px rgba(0, 0, 0, 0.7)',
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              padding: '18px 24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <h2 id="mode-selector-title" style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff' }}>
                Study Modes & Sequences
              </h2>
              <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                Choose a built-in rhythm or create a customized sequence.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close modal"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Mode List */}
          <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {isTimerBusy && (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  color: 'var(--color-alert)',
                  fontSize: '11px',
                  marginBottom: '4px',
                }}
              >
                Timer is currently active. Stop or reset the session before switching modes.
              </div>
            )}

            {allModes.map((mode) => {
              const isSelected = mode.id === activeMode.id;
              const estimatedTotal = ModeService.calculateEstimatedDuration(mode);

              return (
                <div
                  key={mode.id}
                  onClick={() => handleSelect(mode)}
                  style={{
                    background: isSelected ? 'rgba(0, 210, 255, 0.06)' : 'rgba(255, 255, 255, 0.03)',
                    border: isSelected ? '1px solid var(--color-focus)' : '1px solid rgba(255, 255, 255, 0.07)',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    cursor: isTimerBusy ? 'default' : 'pointer',
                    transition: 'all var(--transition-fast)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>
                        {mode.name}
                      </span>
                      {mode.isBuiltIn ? (
                        <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                          Preset
                        </span>
                      ) : (
                        <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '4px', background: 'var(--color-focus-bg)', color: 'var(--color-focus)', textTransform: 'uppercase' }}>
                          Custom
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        title="Duplicate mode"
                        onClick={(e) => handleDuplicate(mode, e)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: 'none',
                          color: 'var(--color-text-secondary)',
                          fontSize: '11px',
                          cursor: 'pointer',
                        }}
                      >
                        Copy
                      </button>

                      {!mode.isBuiltIn && (
                        <>
                          <button
                            type="button"
                            title="Edit custom mode"
                            onClick={(e) => handleEdit(mode, e)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: 'none',
                              color: 'var(--color-text-secondary)',
                              fontSize: '11px',
                              cursor: 'pointer',
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            title="Delete custom mode"
                            onClick={(e) => handleDelete(mode.id, e)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: 'none',
                              color: '#f87171',
                              fontSize: '11px',
                              cursor: 'pointer',
                            }}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    {mode.description}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    <span>
                      {mode.steps.length} {mode.steps.length === 1 ? 'step' : 'steps'}
                    </span>
                    <span>•</span>
                    <span>
                      {mode.loopCount === 0 ? 'Infinite repetition' : `${mode.loopCount} ${mode.loopCount === 1 ? 'loop' : 'loops'}`}
                    </span>
                    <span>•</span>
                    <span style={{ color: 'var(--color-focus)' }}>
                      Total: {formatHumanDuration(estimatedTotal)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Action to Create New */}
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              onClick={handleCreateNew}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <span>+ Create Custom Mode</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: 'none',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: 'var(--color-text-secondary)',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {isEditorOpen && editingMode && (
        <ModeEditorModal
          isOpen={isEditorOpen}
          initialMode={editingMode}
          onSave={saveCustomMode}
          onClose={() => {
            setIsEditorOpen(false);
            setEditingMode(null);
          }}
        />
      )}
    </>
  );
};
