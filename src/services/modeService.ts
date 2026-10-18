import type { ModeDefinition } from '../types/timer';

export const BUILT_IN_MODES: ModeDefinition[] = [
  {
    id: 'classic_pomodoro',
    name: 'Classic Pomodoro',
    description: 'Traditional 25-minute focus intervals with 5-minute restorative breaks.',
    loopCount: 4,
    isBuiltIn: true,
    steps: [
      { id: 'pom_f1', type: 'focus', label: 'Deep Focus', durationSeconds: 25 * 60 },
      { id: 'pom_r1', type: 'rest', label: 'Short Rest', durationSeconds: 5 * 60 },
    ],
  },
  {
    id: 'deep_work',
    name: 'Deep Work',
    description: 'Extended 50-minute cognitive immersion with 10-minute mental recalibration.',
    loopCount: 2,
    isBuiltIn: true,
    steps: [
      { id: 'dw_f1', type: 'focus', label: 'Immersive Focus', durationSeconds: 50 * 60 },
      { id: 'dw_r1', type: 'rest', label: 'Recovery Rest', durationSeconds: 10 * 60 },
    ],
  },
  {
    id: 'ultradian_rhythm',
    name: 'Ultradian Rhythm',
    description: 'Peak 90-minute biological focus cycle followed by 20 minutes of restorative recovery.',
    loopCount: 1,
    isBuiltIn: true,
    steps: [
      { id: 'ur_f1', type: 'focus', label: 'Ultradian Immersion', durationSeconds: 90 * 60 },
      { id: 'ur_r1', type: 'rest', label: 'Full Restoration', durationSeconds: 20 * 60 },
    ],
  },
  {
    id: 'quick_sprint',
    name: 'Quick Sprint',
    description: 'Rapid 15-minute bursts with brief 3-minute pauses for high-tempo task clearing.',
    loopCount: 3,
    isBuiltIn: true,
    steps: [
      { id: 'qs_f1', type: 'focus', label: 'Quick Sprint', durationSeconds: 15 * 60 },
      { id: 'qs_r1', type: 'rest', label: 'Micro Pause', durationSeconds: 3 * 60 },
    ],
  },
];

export interface ModeValidationError {
  field: string;
  message: string;
}

export class ModeService {
  /**
   * Validates a mode definition. Returns an array of error messages (empty if valid).
   */
  public static validateMode(mode: Partial<ModeDefinition>): ModeValidationError[] {
    const errors: ModeValidationError[] = [];

    if (!mode.name || mode.name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Mode name is required.' });
    } else if (mode.name.trim().length > 50) {
      errors.push({ field: 'name', message: 'Mode name cannot exceed 50 characters.' });
    }

    if (mode.loopCount === undefined || mode.loopCount < 0) {
      errors.push({ field: 'loopCount', message: 'Loop count must be 0 (infinite) or greater.' });
    }

    if (!mode.steps || mode.steps.length === 0) {
      errors.push({ field: 'steps', message: 'Mode must contain at least one step.' });
    } else {
      const hasFocusStep = mode.steps.some((s) => s.type === 'focus');
      if (!hasFocusStep) {
        errors.push({ field: 'steps', message: 'Mode must contain at least one focus step.' });
      }

      mode.steps.forEach((step, idx) => {
        if (!step.label || step.label.trim().length === 0) {
          errors.push({ field: `steps[${idx}].label`, message: `Step ${idx + 1} requires a label.` });
        }
        if (!step.durationSeconds || step.durationSeconds < 5) {
          errors.push({
            field: `steps[${idx}].durationSeconds`,
            message: `Step ${idx + 1} duration must be at least 5 seconds.`,
          });
        } else if (step.durationSeconds > 12 * 60 * 60) {
          errors.push({
            field: `steps[${idx}].durationSeconds`,
            message: `Step ${idx + 1} duration cannot exceed 12 hours.`,
          });
        }
      });
    }

    return errors;
  }

  /**
   * Calculates total estimated duration in seconds for a mode sequence.
   * If loopCount is 0 (infinite), estimates for 1 loop.
   */
  public static calculateEstimatedDuration(mode: ModeDefinition): number {
    const singleLoopSeconds = mode.steps.reduce((sum, step) => sum + step.durationSeconds, 0);
    const loops = mode.loopCount === 0 ? 1 : mode.loopCount;
    return singleLoopSeconds * loops;
  }

  /**
   * Creates a duplicate of an existing mode with a new ID and '(Copy)' label.
   */
  public static duplicateMode(mode: ModeDefinition): ModeDefinition {
    return {
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: `${mode.name} (Copy)`,
      description: mode.description,
      loopCount: mode.loopCount,
      isBuiltIn: false,
      steps: mode.steps.map((s) => ({
        id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: s.type,
        label: s.label,
        durationSeconds: s.durationSeconds,
      })),
    };
  }

  /**
   * Creates an empty new custom mode template.
   */
  public static createBlankCustomMode(): ModeDefinition {
    return {
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: 'Custom Mode',
      description: 'Custom focus sequence',
      loopCount: 2,
      isBuiltIn: false,
      steps: [
        {
          id: `step_${Date.now()}_1`,
          type: 'focus',
          label: 'Focus',
          durationSeconds: 25 * 60,
        },
        {
          id: `step_${Date.now()}_2`,
          type: 'rest',
          label: 'Rest',
          durationSeconds: 5 * 60,
        },
      ],
    };
  }
}
