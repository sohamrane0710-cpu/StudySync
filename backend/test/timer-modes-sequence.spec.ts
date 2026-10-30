import { INestApplication } from '@nestjs/common';
import { TimerDirection, TimerPhase, TimerStatus, TimerStepType } from '@prisma/client';
import * as request from 'supertest';
import { PrismaService } from '../src/database/prisma.service';
import { cleanDatabase, createDevToken, createTestApp } from './test-helper';

describe('Stage B: Sequence-Based Timer Modes and Steps Model', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const userA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const userB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    const testSetup = await createTestApp();
    app = testSetup.app;
    prisma = testSetup.prisma;

    tokenA = createDevToken(userA, 'user_a@example.com', 'user_a');
    tokenB = createDevToken(userB, 'user_b@example.com', 'user_b');

    // Ensure profiles exist
    await prisma.profile.upsert({
      where: { id: userA },
      update: {},
      create: { id: userA, username: 'user_a', displayName: 'User A' },
    });
    await prisma.profile.upsert({
      where: { id: userB },
      update: {},
      create: { id: userB, username: 'user_b', displayName: 'User B' },
    });
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  describe('1. Migration and Default Seed Conversion', () => {
    it('verifies all 3 standard system templates have correctly converted ordered steps', async () => {
      const systemModes = await prisma.timerMode.findMany({
        where: { userId: null },
        include: { steps: { orderBy: { order: 'asc' } } },
      });

      expect(systemModes.length).toBeGreaterThanOrEqual(3);

      // Standard Pomodoro (Interval 4 -> 8 steps)
      const pomodoro = systemModes.find((m) => m.name === 'Standard Pomodoro');
      expect(pomodoro).toBeDefined();
      expect(pomodoro!.steps).toHaveLength(8);
      expect(pomodoro!.isLooping).toBe(true);
      expect(pomodoro!.defaultDirection).toBe(TimerDirection.COUNTDOWN);

      expect(pomodoro!.steps[0]).toMatchObject({
        name: 'Focus 1',
        type: TimerStepType.FOCUS,
        duration: 1500,
        order: 0,
      });
      expect(pomodoro!.steps[1]).toMatchObject({
        name: 'Short Rest 1',
        type: TimerStepType.REST,
        duration: 300,
        order: 1,
      });
      expect(pomodoro!.steps[6]).toMatchObject({
        name: 'Focus 4',
        type: TimerStepType.FOCUS,
        duration: 1500,
        order: 6,
      });
      expect(pomodoro!.steps[7]).toMatchObject({
        name: 'Long Rest',
        type: TimerStepType.REST,
        duration: 900,
        order: 7,
      });

      // Deep Work 50/10 (Interval 3 -> 6 steps)
      const deepWork = systemModes.find((m) => m.name === 'Deep Work 50/10');
      expect(deepWork).toBeDefined();
      expect(deepWork!.steps).toHaveLength(6);
      expect(deepWork!.steps[0]).toMatchObject({
        name: 'Focus 1',
        type: TimerStepType.FOCUS,
        duration: 3000,
        order: 0,
      });
      expect(deepWork!.steps[5]).toMatchObject({
        name: 'Long Rest',
        type: TimerStepType.REST,
        duration: 1800,
        order: 5,
      });

      // Quick Sprint 15/3 (Interval 4 -> 8 steps)
      const sprint = systemModes.find((m) => m.name === 'Quick Sprint 15/3');
      expect(sprint).toBeDefined();
      expect(sprint!.steps).toHaveLength(8);
      expect(sprint!.steps[0]).toMatchObject({
        name: 'Focus 1',
        type: TimerStepType.FOCUS,
        duration: 900,
        order: 0,
      });
      expect(sprint!.steps[7]).toMatchObject({
        name: 'Long Rest',
        type: TimerStepType.REST,
        duration: 600,
        order: 7,
      });
    });
  });

  describe('2. Custom Mode Sequence Creation and Validation', () => {
    it('creates a custom mode with explicit steps, isLooping, and defaultDirection', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/timer-modes')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Hyperfocus Sequence',
          description: 'Custom alternating sprint',
          isLooping: false,
          defaultDirection: 'COUNT_UP',
          steps: [
            { name: 'Sprint 1', type: 'FOCUS', duration: 1800 },
            { name: 'Recovery 1', type: 'REST', duration: 300 },
            { name: 'Sprint 2', type: 'FOCUS', duration: 2400 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Hyperfocus Sequence');
      expect(res.body.isLooping).toBe(false);
      expect(res.body.defaultDirection).toBe('COUNT_UP');
      expect(res.body.steps).toHaveLength(3);
      expect(res.body.steps[0]).toMatchObject({ name: 'Sprint 1', type: 'FOCUS', duration: 1800, order: 0 });
      expect(res.body.steps[1]).toMatchObject({ name: 'Recovery 1', type: 'REST', duration: 300, order: 1 });
      expect(res.body.steps[2]).toMatchObject({ name: 'Sprint 2', type: 'FOCUS', duration: 2400, order: 2 });

      // Verifies legacy compatibility fields are automatically populated
      expect(res.body.focusDuration).toBe(1800);
      expect(res.body.shortBreakDuration).toBe(300);
    });

    it('rejects an empty steps array with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/timer-modes')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Empty Mode',
          steps: [],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('at least one step');
    });

    it('rejects a sequence containing zero FOCUS steps with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/timer-modes')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'All Rest Mode',
          steps: [
            { name: 'Nap 1', type: 'REST', duration: 600 },
            { name: 'Nap 2', type: 'REST', duration: 1200 },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('at least one FOCUS step');
    });

    it('rejects steps with invalid durations (<10s or >86400s) with 400 Bad Request', async () => {
      const resTooShort = await request(app.getHttpServer())
        .post('/api/v1/timer-modes')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Too Short Step',
          steps: [{ name: 'Tiny Focus', type: 'FOCUS', duration: 5 }],
        });

      expect(resTooShort.status).toBe(400);

      const resTooLong = await request(app.getHttpServer())
        .post('/api/v1/timer-modes')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Too Long Step',
          steps: [{ name: 'Eternal Focus', type: 'FOCUS', duration: 100000 }],
        });

      expect(resTooLong.status).toBe(400);
    });

    it('supports legacy payload without steps and auto-generates the sequence', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/timer-modes')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Legacy Style Mode',
          focusDuration: 1200,
          shortBreakDuration: 240,
          longBreakDuration: 720,
          longBreakInterval: 2,
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Legacy Style Mode');
      expect(res.body.steps).toHaveLength(4); // 2 focus * 2 = 4 steps
      expect(res.body.steps[0]).toMatchObject({ name: 'Focus 1', duration: 1200, order: 0 });
      expect(res.body.steps[1]).toMatchObject({ name: 'Short Rest 1', duration: 240, order: 1 });
      expect(res.body.steps[2]).toMatchObject({ name: 'Focus 2', duration: 1200, order: 2 });
      expect(res.body.steps[3]).toMatchObject({ name: 'Long Rest', duration: 720, order: 3 });
    });
  });

  describe('3. Ownership and Authorization', () => {
    let modeAId: string;
    let systemModeId: string;

    beforeAll(async () => {
      const created = await prisma.timerMode.create({
        data: {
          userId: userA,
          name: "User A's Private Mode",
          focusDuration: 1500,
          shortBreakDuration: 300,
          longBreakDuration: 900,
          steps: {
            create: [
              { name: 'Focus 1', type: 'FOCUS', duration: 1500, order: 0 },
              { name: 'Rest 1', type: 'REST', duration: 300, order: 1 },
            ],
          },
        },
      });
      modeAId = created.id;

      const system = await prisma.timerMode.findFirst({ where: { userId: null } });
      systemModeId = system!.id;
    });

    it('prevents user B from accessing or updating user A private mode (403 Forbidden)', async () => {
      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/timer-modes/${modeAId}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(getRes.status).toBe(403);

      const patchRes = await request(app.getHttpServer())
        .patch(`/api/v1/timer-modes/${modeAId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ name: 'Hacked Mode' });
      expect(patchRes.status).toBe(403);

      const deleteRes = await request(app.getHttpServer())
        .delete(`/api/v1/timer-modes/${modeAId}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(deleteRes.status).toBe(403);
    });

    it('prevents any user from modifying or archiving system default modes (403 Forbidden)', async () => {
      const patchRes = await request(app.getHttpServer())
        .patch(`/api/v1/timer-modes/${systemModeId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Modified Standard' });
      expect(patchRes.status).toBe(403);

      const deleteRes = await request(app.getHttpServer())
        .delete(`/api/v1/timer-modes/${systemModeId}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(deleteRes.status).toBe(403);
    });
  });

  describe('4. Step Operations: Add, Edit, Duplicate, Delete, and Reorder', () => {
    let modeId: string;
    let step0Id: string;
    let step1Id: string;

    beforeEach(async () => {
      const mode = await prisma.timerMode.create({
        data: {
          userId: userA,
          name: 'Workflow Steps Test',
          steps: {
            create: [
              { name: 'Step 1 Focus', type: 'FOCUS', duration: 1500, order: 0 },
              { name: 'Step 2 Break', type: 'REST', duration: 300, order: 1 },
            ],
          },
        },
        include: { steps: { orderBy: { order: 'asc' } } },
      });
      modeId = mode.id;
      step0Id = mode.steps[0].id;
      step1Id = mode.steps[1].id;
    });

    it('adds a step at end of sequence', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/timer-modes/${modeId}/steps`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Step 3 Long Break',
          type: 'REST',
          duration: 900,
        });

      expect(res.status).toBe(201);
      expect(res.body.steps).toHaveLength(3);
      expect(res.body.steps[2]).toMatchObject({
        name: 'Step 3 Long Break',
        type: 'REST',
        duration: 900,
        order: 2,
      });
    });

    it('adds a step inserted in middle and shifts subsequent steps cleanly', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/timer-modes/${modeId}/steps`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Inserted Mid Step',
          type: 'FOCUS',
          duration: 1200,
          order: 1,
        });

      expect(res.status).toBe(201);
      expect(res.body.steps).toHaveLength(3);
      expect(res.body.steps[0].name).toBe('Step 1 Focus');
      expect(res.body.steps[1].name).toBe('Inserted Mid Step');
      expect(res.body.steps[1].order).toBe(1);
      expect(res.body.steps[2].name).toBe('Step 2 Break');
      expect(res.body.steps[2].order).toBe(2);
    });

    it('updates an individual step', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/timer-modes/${modeId}/steps/${step0Id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Renamed Focus',
          duration: 1800,
        });

      expect(res.status).toBe(200);
      expect(res.body.steps[0]).toMatchObject({
        name: 'Renamed Focus',
        duration: 1800,
      });
    });

    it('duplicates an individual step', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/timer-modes/${modeId}/steps/${step0Id}/duplicate`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(201);
      expect(res.body.steps).toHaveLength(3);
      expect(res.body.steps[0].name).toBe('Step 1 Focus');
      expect(res.body.steps[1].name).toBe('Step 1 Focus (Copy)');
      expect(res.body.steps[1].order).toBe(1);
      expect(res.body.steps[2].name).toBe('Step 2 Break');
      expect(res.body.steps[2].order).toBe(2);
    });

    it('reorders steps and ensures order consistency', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/timer-modes/${modeId}/steps/reorder`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          stepIds: [step1Id, step0Id], // Invert order
        });

      expect(res.status).toBe(200);
      expect(res.body.steps).toHaveLength(2);
      expect(res.body.steps[0].id).toBe(step1Id);
      expect(res.body.steps[0].order).toBe(0);
      expect(res.body.steps[1].id).toBe(step0Id);
      expect(res.body.steps[1].order).toBe(1);
    });

    it('rejects step reordering with duplicate step IDs (400 Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/timer-modes/${modeId}/steps/reorder`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          stepIds: [step0Id, step0Id], // Duplicate step ID
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('without duplicates');
    });

    it('rejects adding a step with empty name (400 Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/timer-modes/${modeId}/steps`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: '   ',
          duration: 300,
        });

      expect(res.status).toBe(400);
    });

    it('prevents user B from performing step operations on user A mode (403 Forbidden)', async () => {
      // Attempt add step
      const addRes = await request(app.getHttpServer())
        .post(`/api/v1/timer-modes/${modeId}/steps`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ name: 'Hacked Step', duration: 600 });
      expect(addRes.status).toBe(403);

      // Attempt delete step
      const delRes = await request(app.getHttpServer())
        .delete(`/api/v1/timer-modes/${modeId}/steps/${step0Id}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(delRes.status).toBe(403);
    });

    it('synchronizes parent mode legacy fields when steps are modified', async () => {
      // Add a third step with new focus duration
      const addRes = await request(app.getHttpServer())
        .post(`/api/v1/timer-modes/${modeId}/steps`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Super Focus',
          type: 'FOCUS',
          duration: 3600,
          order: 0,
        });

      expect(addRes.status).toBe(201);
      expect(addRes.body.focusDuration).toBe(3600); // Updated to match first focus step
      expect(addRes.body.longBreakInterval).toBe(2); // 2 focus steps now
    });

    it('deletes a step and re-compacts orders', async () => {
      // Add a third step first
      await prisma.timerModeStep.create({
        data: { timerModeId: modeId, name: 'Step 3', type: 'REST', duration: 900, order: 2 },
      });

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/timer-modes/${modeId}/steps/${step0Id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.steps).toHaveLength(2);
      expect(res.body.steps[0].id).toBe(step1Id);
      expect(res.body.steps[0].order).toBe(0);
      expect(res.body.steps[1].name).toBe('Step 3');
      expect(res.body.steps[1].order).toBe(1);
    });

    it('prevents deleting the last remaining step (400 Bad Request)', async () => {
      // Delete step 1
      await request(app.getHttpServer())
        .delete(`/api/v1/timer-modes/${modeId}/steps/${step1Id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      // Attempt to delete step 0 (the only step left)
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/timer-modes/${modeId}/steps/${step0Id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('at least one step');
    });

    it('duplicates an entire mode along with all ordered steps', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/timer-modes/${modeId}/duplicate`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Workflow Steps Test (Copy)');
      expect(res.body.steps).toHaveLength(2);
      expect(res.body.steps[0].name).toBe('Step 1 Focus');
      expect(res.body.steps[1].name).toBe('Step 2 Break');
      expect(res.body.id).not.toBe(modeId);
    });
  });

  describe('5. Active Session Reference Safeguards', () => {
    let modeId: string;
    let stepId: string;
    let activeSessionId: string;

    beforeEach(async () => {
      const mode = await prisma.timerMode.create({
        data: {
          userId: userA,
          name: 'Guarded Active Mode',
          steps: {
            create: [
              { name: 'Active Step 1', type: 'FOCUS', duration: 1500, order: 0 },
              { name: 'Active Step 2', type: 'REST', duration: 300, order: 1 },
            ],
          },
        },
        include: { steps: { orderBy: { order: 'asc' } } },
      });
      modeId = mode.id;
      stepId = mode.steps[0].id;

      // Create an active timer session running on this mode and step
      const session = await prisma.timerSession.create({
        data: {
          userId: userA,
          timerModeId: modeId,
          stepId,
          stepIndex: 0,
          stepName: 'Active Step 1',
          stepType: TimerStepType.FOCUS,
          totalSteps: 2,
          phase: TimerPhase.FOCUS,
          status: TimerStatus.RUNNING,
          targetDuration: 1500,
          remainingSeconds: 1500,
          startedAt: new Date(),
          expectedEndTime: new Date(Date.now() + 1500 * 1000),
        },
      });
      activeSessionId = session.id;
    });

    afterEach(async () => {
      await prisma.timerSession.deleteMany({ where: { id: activeSessionId } });
      await prisma.timerMode.deleteMany({ where: { id: modeId } });
    });

    it('prevents archiving or deleting a mode that has an active timer session (400 Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/timer-modes/${modeId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('active timer session');
    });

    it('prevents deleting a step that is actively referenced by a running timer (400 Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/timer-modes/${modeId}/steps/${stepId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('in use by an active timer session');
    });

    it('prevents adding a step to a mode with an active session (400 Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/timer-modes/${modeId}/steps`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Sneaky Step', duration: 600 });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('active timer session');
    });

    it('prevents duplicating a step in a mode with an active session (400 Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/timer-modes/${modeId}/steps/${stepId}/duplicate`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('active timer session');
    });

    it('prevents replacing all sequence steps while a session is actively running on the mode (400 Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/timer-modes/${modeId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          steps: [
            { name: 'Replacement 1', type: 'FOCUS', duration: 1200 },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('active timer session is running');
    });

    it('prevents reordering steps while a session is actively running on the mode (400 Bad Request)', async () => {
      const steps = await prisma.timerModeStep.findMany({ where: { timerModeId: modeId } });
      const res = await request(app.getHttpServer())
        .put(`/api/v1/timer-modes/${modeId}/steps/reorder`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          stepIds: [steps[1].id, steps[0].id],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('is actively running on this mode');
    });
  });

  describe('6. Historical Study Records and ID Preservation', () => {
    it('preserves existing mode IDs, study sessions, and category/label associations', async () => {
      // 1. Create mode, category, label
      const mode = await prisma.timerMode.create({
        data: {
          userId: userA,
          name: 'Historical Mode',
          steps: {
            create: [{ name: 'Focus 1', type: 'FOCUS', duration: 1500, order: 0 }],
          },
        },
      });

      const category = await prisma.sessionCategory.create({
        data: { userId: userA, name: 'History Cat' },
      });

      const label = await prisma.sessionLabel.create({
        data: { userId: userA, name: 'history_lbl', categoryId: category.id },
      });

      // 2. Create study session linked to category and label
      const studySession = await prisma.studySession.create({
        data: {
          userId: userA,
          title: 'Historical Session',
          stepName: 'Focus 1',
          stepIndex: 0,
          targetDuration: 1500,
          actualDuration: 1500,
          startedAt: new Date(Date.now() - 1500 * 1000),
          endedAt: new Date(),
          categories: { create: [{ categoryId: category.id }] },
          labels: { create: [{ labelId: label.id }] },
        },
        include: {
          categories: { include: { category: true } },
          labels: { include: { label: true } },
        },
      });

      expect(studySession.id).toBeDefined();
      expect(studySession.stepName).toBe('Focus 1');
      expect(studySession.categories).toHaveLength(1);
      expect(studySession.labels).toHaveLength(1);

      // Verify mode ID is preserved
      const retrievedMode = await prisma.timerMode.findUnique({
        where: { id: mode.id },
        include: { steps: true },
      });
      expect(retrievedMode).toBeDefined();
      expect(retrievedMode!.id).toBe(mode.id);
      expect(retrievedMode!.steps).toHaveLength(1);
    });
  });
});
