import { describe, it, expect } from 'vitest';
import { BUILT_IN_MODES, ModeService } from './modeService';

describe('ModeService Unit Tests', () => {
  it('includes all required built-in presets with correct configurations', () => {
    expect(BUILT_IN_MODES).toHaveLength(4);

    const pomodoro = BUILT_IN_MODES.find((m) => m.id === 'classic_pomodoro');
    expect(pomodoro).toBeDefined();
    expect(pomodoro?.loopCount).toBe(4);
    expect(pomodoro?.steps[0].durationSeconds).toBe(25 * 60);
    expect(pomodoro?.steps[1].durationSeconds).toBe(5 * 60);

    const deepWork = BUILT_IN_MODES.find((m) => m.id === 'deep_work');
    expect(deepWork).toBeDefined();
    expect(deepWork?.loopCount).toBe(2);
    expect(deepWork?.steps[0].durationSeconds).toBe(50 * 60);
    expect(deepWork?.steps[1].durationSeconds).toBe(10 * 60);

    const ultradian = BUILT_IN_MODES.find((m) => m.id === 'ultradian_rhythm');
    expect(ultradian).toBeDefined();
    expect(ultradian?.loopCount).toBe(1);
    expect(ultradian?.steps[0].durationSeconds).toBe(90 * 60);
    expect(ultradian?.steps[1].durationSeconds).toBe(20 * 60);

    const sprint = BUILT_IN_MODES.find((m) => m.id === 'quick_sprint');
    expect(sprint).toBeDefined();
    expect(sprint?.loopCount).toBe(3);
    expect(sprint?.steps[0].durationSeconds).toBe(15 * 60);
    expect(sprint?.steps[1].durationSeconds).toBe(3 * 60);
  });

  it('validates invalid modes correctly', () => {
    const invalidEmpty = ModeService.validateMode({});
    expect(invalidEmpty.length).toBeGreaterThan(0);
    expect(invalidEmpty.some((e) => e.field === 'name')).toBe(true);
    expect(invalidEmpty.some((e) => e.field === 'steps')).toBe(true);

    const invalidNoFocus = ModeService.validateMode({
      name: 'Only Rest',
      loopCount: 1,
      steps: [{ id: '1', type: 'rest', label: 'Rest', durationSeconds: 60 }],
    });
    expect(invalidNoFocus.some((e) => e.message.includes('focus step'))).toBe(true);

    const invalidShortDuration = ModeService.validateMode({
      name: 'Too Short',
      loopCount: 1,
      steps: [{ id: '1', type: 'focus', label: 'Focus', durationSeconds: 2 }],
    });
    expect(invalidShortDuration.some((e) => e.message.includes('5 seconds'))).toBe(true);
  });

  it('calculates estimated duration accurately for finite and infinite modes', () => {
    const pomodoro = BUILT_IN_MODES.find((m) => m.id === 'classic_pomodoro')!;
    // (25 + 5) * 4 = 120 minutes = 7200 seconds
    expect(ModeService.calculateEstimatedDuration(pomodoro)).toBe(7200);

    const infiniteMode = {
      ...pomodoro,
      loopCount: 0,
    };
    // For infinite loop (0), estimates for 1 loop = 1800 seconds
    expect(ModeService.calculateEstimatedDuration(infiniteMode)).toBe(1800);
  });

  it('duplicates modes cleanly with unique IDs and (Copy) label', () => {
    const pomodoro = BUILT_IN_MODES.find((m) => m.id === 'classic_pomodoro')!;
    const duplicate = ModeService.duplicateMode(pomodoro);

    expect(duplicate.id).not.toBe(pomodoro.id);
    expect(duplicate.name).toBe('Classic Pomodoro (Copy)');
    expect(duplicate.isBuiltIn).toBe(false);
    expect(duplicate.steps).toHaveLength(pomodoro.steps.length);
    expect(duplicate.steps[0].id).not.toBe(pomodoro.steps[0].id);
  });
});
