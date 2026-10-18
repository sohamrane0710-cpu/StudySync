import React, { useState } from 'react';
import type { ModeDefinition, StepDefinition } from '../../types/timer';
import { ModeService } from '../../services/modeService';
import { JogDial } from '../controls/JogDial';
import { formatHumanDuration } from '../../utils/timeFormat';

export interface ModeEditorModalProps {
  isOpen: boolean;
  initialMode: ModeDefinition;
  onSave: (mode: ModeDefinition) => void;
  onClose: () => void;
}

export const ModeEditorModal: React.FC<ModeEditorModalProps> = ({
  isOpen,
  initialMode,
  onSave,
  onClose,
}) => {
  const [name, setName] = useState(initialMode.name);
  const [description, setDescription] = useState(initialMode.description);
  const [loopCount, setLoopCount] = useState(initialMode.loopCount);
  const [steps, setSteps] = useState<StepDefinition[]>(initialMode.steps);
  const [selectedStepIndex, setSelectedStepIndex] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  if (!isOpen) return null;

  const currentStep = steps[selectedStepIndex] || steps[0];

  const handleAddStep = (type: 'focus' | 'rest') => {
    const newStep: StepDefinition = {
      id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      label: type === 'focus' ? 'Focus' : 'Short Rest',
      durationSeconds: type === 'focus' ? 25 * 60 : 5 * 60,
    };
    setSteps([...steps, newStep]);
    setSelectedStepIndex(steps.length);
  };

  const handleRemoveStep = (idx: number) => {
    if (steps.length <= 1) return;
    const updated = steps.filter((_, i) => i !== idx);
    setSteps(updated);
    setSelectedStepIndex(Math.max(0, idx - 1));
  };

  const handleMoveStep = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= steps.length) return;
    const updated = [...steps];
    const [moved] = updated.splice(idx, 1);
    updated.splice(targetIdx, 0, moved);
    setSteps(updated);
    setSelectedStepIndex(targetIdx);
  };

  const updateCurrentStep = (updates: Partial<StepDefinition>) => {
    setSteps(
      steps.map((s, i) => (i === selectedStepIndex ? { ...s, ...updates } : s)),
    );
  };

  const handleSave = () => {
    const draft: ModeDefinition = {
      id: initialMode.id || `custom_${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      loopCount,
      isBuiltIn: false,
      steps,
    };

    const validationErrors = ModeService.validateMode(draft);
    if (validationErrors.length > 0) {
      setErrors(validationErrors.map((e) => e.message));
      return;
    }

    onSave(draft);
    onClose();
  };

  const estimatedDuration = ModeService.calculateEstimatedDuration({
    id: 'draft',
    name,
    description,
    loopCount,
    isBuiltIn: false,
    steps,
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mode-editor-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        zIndex: 110,
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
          maxWidth: '560px',
          maxHeight: '90vh',
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
          <h2 id="mode-editor-title" style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff' }}>
            {initialMode.isBuiltIn ? `Customize: ${initialMode.name}` : 'Edit Sequence Mode'}
          </h2>
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

        {/* Content Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Errors list */}
          {errors.length > 0 && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#f87171',
                fontSize: '12px',
              }}
            >
              {errors.map((err, i) => (
                <div key={i}>• {err}</div>
              ))}
            </div>
          )}

          {/* Mode Name and Loop Count */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                Mode Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                Repetitions
              </label>
              <select
                value={loopCount}
                onChange={(e) => setLoopCount(parseInt(e.target.value, 10))}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  fontSize: '13px',
                  outline: 'none',
                }}
              >
                <option value={1} style={{ background: '#12151a' }}>1 Loop</option>
                <option value={2} style={{ background: '#12151a' }}>2 Loops</option>
                <option value={3} style={{ background: '#12151a' }}>3 Loops</option>
                <option value={4} style={{ background: '#12151a' }}>4 Loops</option>
                <option value={6} style={{ background: '#12151a' }}>6 Loops</option>
                <option value={8} style={{ background: '#12151a' }}>8 Loops</option>
                <option value={0} style={{ background: '#12151a' }}>Infinite (Continuous)</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={120}
              placeholder="Description of focus rhythm"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>

          {/* Sequence Steps Timeline */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                Sequence Steps ({steps.length})
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => handleAddStep('focus')}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: 'var(--color-focus-bg)',
                    border: '1px solid var(--color-focus)',
                    color: 'var(--color-focus)',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  + Focus
                </button>
                <button
                  type="button"
                  onClick={() => handleAddStep('rest')}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: 'var(--color-rest-bg)',
                    border: '1px solid var(--color-rest)',
                    color: 'var(--color-rest)',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  + Rest
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '6px' }}>
              {steps.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedStepIndex(idx)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    flexShrink: 0,
                    background: idx === selectedStepIndex ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                    border: idx === selectedStepIndex ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.06)',
                    color: idx === selectedStepIndex ? '#ffffff' : 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    fontSize: '11px',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: s.type === 'focus' ? 'var(--color-focus)' : 'var(--color-rest)',
                    }}
                  />
                  <span>{s.label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-muted)' }}>
                    {formatHumanDuration(s.durationSeconds)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Active Step Editor Card with JogDial */}
          {currentStep && (
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={currentStep.label}
                    onChange={(e) => updateCurrentStep({ label: e.target.value })}
                    maxLength={30}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: 600,
                      outline: 'none',
                    }}
                  />
                  <select
                    value={currentStep.type}
                    onChange={(e) => updateCurrentStep({ type: e.target.value as 'focus' | 'rest' })}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: currentStep.type === 'focus' ? 'var(--color-focus)' : 'var(--color-rest)',
                      fontSize: '11px',
                      fontWeight: 600,
                      outline: 'none',
                    }}
                  >
                    <option value="focus" style={{ background: '#12151a' }}>Focus</option>
                    <option value="rest" style={{ background: '#12151a' }}>Rest</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    aria-label="Move step up"
                    disabled={selectedStepIndex === 0}
                    onClick={() => handleMoveStep(selectedStepIndex, 'up')}
                    style={{
                      padding: '4px 6px',
                      borderRadius: '4px',
                      background: 'rgba(255,255,255,0.05)',
                      border: 'none',
                      color: selectedStepIndex === 0 ? 'var(--color-text-faint)' : 'var(--color-text-secondary)',
                      cursor: selectedStepIndex === 0 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="Move step down"
                    disabled={selectedStepIndex === steps.length - 1}
                    onClick={() => handleMoveStep(selectedStepIndex, 'down')}
                    style={{
                      padding: '4px 6px',
                      borderRadius: '4px',
                      background: 'rgba(255,255,255,0.05)',
                      border: 'none',
                      color: selectedStepIndex === steps.length - 1 ? 'var(--color-text-faint)' : 'var(--color-text-secondary)',
                      cursor: selectedStepIndex === steps.length - 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label="Delete step"
                    disabled={steps.length <= 1}
                    onClick={() => handleRemoveStep(selectedStepIndex)}
                    style={{
                      padding: '4px 6px',
                      borderRadius: '4px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: 'none',
                      color: '#f87171',
                      cursor: steps.length <= 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Rotary JogDial for Step Duration */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <JogDial
                  value={Math.round(currentStep.durationSeconds / 60)}
                  min={1}
                  max={120}
                  step={1}
                  largeStep={5}
                  label={`${currentStep.label} Duration`}
                  unit="min"
                  size={160}
                  onChange={(val) => updateCurrentStep({ durationSeconds: val * 60 })}
                />
              </div>
            </div>
          )}

          {/* Estimated duration summary */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            <span>Estimated Sequence Duration:</span>
            <span style={{ color: '#ffffff', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
              {formatHumanDuration(estimatedDuration)} {loopCount === 0 ? '(per loop)' : ''}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: 'var(--color-text-secondary)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              background: 'var(--color-focus)',
              color: '#000000',
              fontWeight: 600,
              fontSize: '12px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Save Mode
          </button>
        </div>
      </div>
    </div>
  );
};
