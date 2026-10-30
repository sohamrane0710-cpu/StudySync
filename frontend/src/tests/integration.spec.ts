import { describe, it, expect, beforeAll } from 'vitest';
import { setAuthToken } from '@/lib/api/client';
import { usersApi } from '@/lib/api/users';
import { preferencesApi } from '@/lib/api/preferences';
import { timerModesApi } from '@/lib/api/timer-modes';
import { timersApi } from '@/lib/api/timers';
import { studySessionsApi } from '@/lib/api/study-sessions';
import { categoriesApi } from '@/lib/api/categories';
import { labelsApi } from '@/lib/api/labels';
import { analyticsApi } from '@/lib/api/analytics';
import { roomsApi } from '@/lib/api/rooms';
import { collaborationApi } from '@/lib/api/collaboration';
import { chatApi } from '@/lib/api/chat';
import { invitationsApi } from '@/lib/api/invitations';

// Dev token for isolated test user 00000000-0000-4000-8000-000000000002
const TEST_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDIiLCJlbWFpbCI6ImUyZV90ZXN0QHN0dWR5c3luYy5sb2NhbCIsInVzZXJfbWV0YWRhdGEiOnsidXNlcm5hbWUiOiJlMmVfdGVzdCIsImZ1bGxfbmFtZSI6IlN0dWR5U3luYyBEZXZlbG9wZXIifSwiaWF0IjoxNzkzMzAwMjA1LCJleHAiOjE3OTM5MDUwMDV9.fZeCFB03oZa1tTmBaTxnCY1a7Y14EVYiljLRr4nt31I';

describe('End-to-End Live API Integration Audit', () => {
  beforeAll(() => {
    setAuthToken(TEST_TOKEN);
  });

  let createdModeId = '';
  let createdCategoryId = '';
  let createdLabelId = '';
  let completedStudySessionId = '';
  let manualSessionId = '';
  let createdRoomId = '';
  let createdMessageId = '';
  let createdInviteId = '';

  // 1. User & Profile
  it('Journey 1: retrieves and auto-provisions profile & preferences', async () => {
    const profile = await usersApi.getMe();
    expect(profile).toBeDefined();
    expect(profile.username).toBe('e2e_test');
    expect(profile.preferences).toBeDefined();

    const updatedProfile = await usersApi.updateMe({
      displayName: 'E2E Test User',
      bio: 'Auditing StudySync E2E integration',
    });
    expect(updatedProfile.displayName).toBe('E2E Test User');
    expect(updatedProfile.bio).toBe('Auditing StudySync E2E integration');
  });

  // 2. Preferences
  it('Journey 2: retrieves and updates user preferences', async () => {
    const prefs = await preferencesApi.getPreferences();
    expect(prefs).toBeDefined();

    const updated = await preferencesApi.updatePreferences({
      theme: 'dark-glass',
      timerFace: 'digital',
      soundVolume: 0.85,
      soundEnabled: true,
    });
    expect(updated.theme).toBe('dark-glass');
    expect(updated.timerFace).toBe('digital');
    expect(updated.soundVolume).toBe(0.85);
  });

  // 3. Custom Timer Modes
  it('Journey 3: creates, duplicates, and retrieves custom timer modes', async () => {
    const newMode = await timerModesApi.createTimerMode({
      name: 'E2E Sprint Mode',
      description: 'Test mode for automated audit',
      focusDuration: 900,
      shortBreakDuration: 180,
      longBreakDuration: 600,
      longBreakInterval: 4,
    });
    expect(newMode.id).toBeDefined();
    expect(newMode.name).toBe('E2E Sprint Mode');
    expect(newMode.focusDuration).toBe(900);
    createdModeId = newMode.id;

    const allModes = await timerModesApi.getTimerModes();
    expect(allModes.some((m) => m.id === createdModeId)).toBe(true);
  });

  // 4. Personal Timer Lifecycle & Recovery
  it('Journey 4: starts, verifies active recovery, pauses, resumes, and completes timer', async () => {
    // Check if any existing active timer is left, cancel it first
    const existing = await timersApi.getActiveTimer();
    if (existing) {
      await timersApi.cancelTimer({ savePartialRecord: false });
    }

    // Start timer with the created mode
    const started = await timersApi.startTimer({
      timerModeId: createdModeId,
      phase: 'FOCUS',
    });
    expect(started.status).toBe('RUNNING');
    expect(started.expectedEndTime).toBeDefined();

    // Verify recovery via getActiveTimer
    const recovered = await timersApi.getActiveTimer();
    expect(recovered).toBeDefined();
    expect(recovered?.id).toBe(started.id);
    expect(recovered?.status).toBe('RUNNING');
    expect(recovered?.authoritativeRemainingSeconds).toBeGreaterThan(0);

    // Pause timer
    const paused = await timersApi.pauseTimer();
    expect(paused.status).toBe('PAUSED');
    expect(paused.expectedEndTime).toBeNull();
    expect(paused.remainingSeconds).toBeGreaterThan(0);

    // Resume timer
    const resumed = await timersApi.resumeTimer();
    expect(resumed.status).toBe('RUNNING');
    expect(resumed.expectedEndTime).toBeDefined();
  });

  // 5. Taxonomy (Categories and Labels)
  let catName = `CS Audit ${Date.now()}`;
  let lblName = `Dist Sys ${Date.now()}`;

  it('Journey 5: creates and retrieves categories and labels', async () => {
    const category = await categoriesApi.createCategory({
      name: catName,
      color: '#6366F1',
    });
    expect(category.id).toBeDefined();
    expect(category.name).toBe(catName);
    expect(category.color).toBe('#6366F1');
    createdCategoryId = category.id;

    const label = await labelsApi.createLabel({
      name: lblName,
      color: '#10B981',
      categoryId: createdCategoryId,
    });
    expect(label.id).toBeDefined();
    expect(label.name).toBe(lblName);
    createdLabelId = label.id;
  });

  // 6. Complete Session with Tagging & verify history
  it('Journey 6: completes active timer with taxonomy tagging and verifies session record', async () => {
    const completeResult = await timersApi.completeTimer({
      title: 'Audited Focus Block',
      notes: 'Completed full lifecycle integration test',
      categoryIds: [createdCategoryId],
      labelIds: [createdLabelId],
      advanceToNextPhase: true,
    });

    expect(completeResult.timerSession.status).toBe('COMPLETED');

    // Create an explicit 25m credited focus session to test analytics aggregation
    const createdSession = await studySessionsApi.createStudySession({
      title: 'Manual Audited Study Block',
      phase: 'FOCUS',
      status: 'COMPLETED',
      targetDuration: 1500,
      actualDuration: 1500,
      startedAt: new Date(Date.now() - 1500 * 1000).toISOString(),
      endedAt: new Date().toISOString(),
      notes: 'Logged for analytics verification',
      categoryIds: [createdCategoryId],
      labelIds: [createdLabelId],
    });
    expect(createdSession.id).toBeDefined();
    manualSessionId = createdSession.id;

    // Verify in history
    const sessions = await studySessionsApi.getStudySessions({ limit: 10 });
    expect(sessions.data.length).toBeGreaterThan(0);
    const recorded = sessions.data.find((s) => s.id === manualSessionId);
    expect(recorded).toBeDefined();
    expect(recorded?.title).toBe('Manual Audited Study Block');
  });

  // 7. Analytics
  it('Journey 7: verifies aggregated study analytics', async () => {
    const summary = await analyticsApi.getSummary();
    expect(summary).toBeDefined();
    expect(summary.totalSessionsCount).toBeGreaterThan(0);
    expect(summary.totalFocusSeconds).toBeGreaterThan(0);

    const categories = await analyticsApi.getCategories();
    expect(categories).toBeDefined();
    expect(Array.isArray(categories)).toBe(true);
    expect(categories.some((c) => c.categoryId === createdCategoryId)).toBe(true);

    const labels = await analyticsApi.getLabels();
    expect(labels).toBeDefined();
    expect(Array.isArray(labels)).toBe(true);
    expect(labels.some((l) => l.labelId === createdLabelId)).toBe(true);
  });

  // 8. Study Rooms & Collaboration
  it('Journey 8: creates room, starts room timer, joins and leaves with participation credit', async () => {
    const room = await roomsApi.createRoom({
      name: 'E2E Collaborative Room',
      description: 'Room for automated end-to-end audit',
      isPrivate: false,
      maxParticipants: 10,
    });
    expect(room.id).toBeDefined();
    expect(room.name).toBe('E2E Collaborative Room');
    createdRoomId = room.id;

    // Start room timer (user is OWNER)
    const roomTimer = await collaborationApi.startRoomTimer(createdRoomId, {
      durationOverride: 1500,
      phase: 'FOCUS',
    });
    expect(roomTimer.status).toBe('RUNNING');

    // Join room timer
    const participant = await collaborationApi.joinRoomTimer(createdRoomId);
    expect(participant.roomStudySessionId || participant.roomTimerSessionId).toBe(roomTimer.id);

    // Leave room timer
    const leaveResult = await collaborationApi.leaveRoomTimer(createdRoomId);
    expect(leaveResult.leftAt).toBeDefined();

    // Cancel room timer to clean up
    await collaborationApi.cancelRoomTimer(createdRoomId);
  });

  // 9. Room Chat
  it('Journey 9: sends, edits, and deletes room chat messages', async () => {
    const msg = await chatApi.sendMessage(createdRoomId, {
      content: 'Hello StudySync audit team!',
    });
    expect(msg.id).toBeDefined();
    expect(msg.content).toBe('Hello StudySync audit team!');
    createdMessageId = msg.id;

    // Edit message
    const edited = await chatApi.editMessage(createdRoomId, createdMessageId, {
      content: 'Hello StudySync audit team! (updated)',
    });
    expect(edited.content).toBe('Hello StudySync audit team! (updated)');
    expect(edited.isEdited).toBe(true);

    // Delete message
    const deleted = await chatApi.deleteMessage(createdRoomId, createdMessageId);
    expect(deleted).toBeDefined();
  });

  // 10. Room Invitations
  it('Journey 10: creates, lists, and revokes room invitation', async () => {
    const invite = await invitationsApi.createInvite(createdRoomId, {
      expiresInHours: 48,
      maxUses: 5,
    });
    expect(invite.id).toBeDefined();
    expect(invite.token).toBeDefined();
    expect(invite.token?.length).toBe(64); // 256-bit hex token
    createdInviteId = invite.id;

    const list = await invitationsApi.getInvites(createdRoomId);
    expect(list.some((i) => i.id === createdInviteId)).toBe(true);

    // Revoke invite
    await invitationsApi.deleteInvite(createdRoomId, createdInviteId);
    const listAfterRevoke = await invitationsApi.getInvites(createdRoomId);
    expect(listAfterRevoke.some((i) => i.id === createdInviteId)).toBe(false);
  });

  // Clean-up
  it('Cleanup: safely cleans up created test resources', async () => {
    if (manualSessionId) {
      await studySessionsApi.deleteStudySession(manualSessionId);
    }
    if (completedStudySessionId) {
      await studySessionsApi.deleteStudySession(completedStudySessionId);
    }
    if (createdLabelId) {
      await labelsApi.deleteLabel(createdLabelId);
    }
    if (createdCategoryId) {
      await categoriesApi.deleteCategory(createdCategoryId);
    }
    if (createdModeId) {
      await timerModesApi.deleteTimerMode(createdModeId);
    }
    if (createdRoomId) {
      await roomsApi.deleteRoom(createdRoomId);
    }
  });
});
