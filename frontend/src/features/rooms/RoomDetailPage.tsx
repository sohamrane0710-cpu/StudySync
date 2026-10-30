import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roomsApi } from '@/lib/api/rooms';
import { collaborationApi } from '@/lib/api/collaboration';
import { getCollaborationSocket } from '@/lib/socket/collaboration-socket';
import { useAuth } from '@/features/auth/auth-context';
import { formatSecondsToMMSS } from '@/lib/utils/format';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { RoomChatWidget } from '@/features/chat/RoomChatWidget';
import { InviteModal } from './InviteModal';
import {
  Lock,
  Globe,
  UserPlus,
  LogOut,
  Play,
  Pause,
  CheckCircle2,
  Square,
  Sparkles,
  ArrowLeft,
  UserCheck,
} from 'lucide-react';
import type { RoomTimerSession, RoomParticipant } from '@/types/room';
import { cn } from '@/lib/utils/cn';

export const RoomDetailPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isStartTimerModalOpen, setIsStartTimerModalOpen] = useState(false);
  const [customDurationMins, setCustomDurationMins] = useState(25);
  const [timerPhase, setTimerPhase] = useState<'FOCUS' | 'SHORT_BREAK'>('FOCUS');
  const [activeTab, setActiveTab] = useState<'timer' | 'chat' | 'members'>('timer');

  // Room metadata query
  const { data: room, isLoading: isRoomLoading, error: roomError } = useQuery({
    queryKey: ['room', roomId],
    queryFn: () => roomsApi.getRoom(roomId!),
    enabled: Boolean(roomId),
  });

  // Active room timer query
  const { data: roomTimer, refetch: refetchRoomTimer } = useQuery({
    queryKey: ['room-timer', roomId],
    queryFn: () => collaborationApi.getRoomTimer(roomId!),
    enabled: Boolean(roomId),
    staleTime: 5000,
  });

  const currentUserRole = room?.currentUserRole;
  const isModOrOwner = currentUserRole === 'OWNER' || currentUserRole === 'MODERATOR';

  // Local authoritative timer calculation
  const calculateRemaining = useCallback((timer: RoomTimerSession | null | undefined): number => {
    if (!timer) return 0;
    if (timer.status === 'PAUSED') return timer.remainingSeconds;
    if (timer.status === 'RUNNING' && timer.expectedEndTime) {
      const targetTime = new Date(timer.expectedEndTime).getTime();
      return Math.max(0, Math.round((targetTime - Date.now()) / 1000));
    }
    return timer.remainingSeconds;
  }, []);

  const [displaySeconds, setDisplaySeconds] = useState<number>(() => calculateRemaining(roomTimer));

  useEffect(() => {
    setDisplaySeconds(calculateRemaining(roomTimer));
  }, [roomTimer, calculateRemaining]);

  // Visual tick interval
  useEffect(() => {
    if (!roomTimer || roomTimer.status !== 'RUNNING' || !roomTimer.expectedEndTime) {
      return;
    }

    const interval = setInterval(() => {
      setDisplaySeconds(calculateRemaining(roomTimer));
    }, 250);

    return () => clearInterval(interval);
  }, [roomTimer, calculateRemaining]);

  // Socket.IO Room Collaboration Gateway Connection
  useEffect(() => {
    if (!roomId) return;

    const socket = getCollaborationSocket();
    if (!socket.connected) {
      socket.connect();
    }

    // Emit join_room
    socket.emit('join_room', { roomId });

    // Socket Event Listeners
    const handleTimerStarted = () => refetchRoomTimer();
    const handleTimerPaused = () => refetchRoomTimer();
    const handleTimerResumed = () => refetchRoomTimer();
    const handleTimerCompleted = () => refetchRoomTimer();
    const handleTimerCancelled = () => refetchRoomTimer();
    const handleParticipantJoined = () => refetchRoomTimer();
    const handleParticipantLeft = () => refetchRoomTimer();

    socket.on('timer:started', handleTimerStarted);
    socket.on('timer:paused', handleTimerPaused);
    socket.on('timer:resumed', handleTimerResumed);
    socket.on('timer:completed', handleTimerCompleted);
    socket.on('timer:cancelled', handleTimerCancelled);
    socket.on('participant:joined', handleParticipantJoined);
    socket.on('participant:left', handleParticipantLeft);

    return () => {
      socket.emit('leave_room', { roomId });
      socket.off('timer:started', handleTimerStarted);
      socket.off('timer:paused', handleTimerPaused);
      socket.off('timer:resumed', handleTimerResumed);
      socket.off('timer:completed', handleTimerCompleted);
      socket.off('timer:cancelled', handleTimerCancelled);
      socket.off('participant:joined', handleParticipantJoined);
      socket.off('participant:left', handleParticipantLeft);
    };
  }, [roomId, refetchRoomTimer]);

  // Room timer mutations
  const startTimerMutation = useMutation({
    mutationFn: (durationOverride: number) =>
      collaborationApi.startRoomTimer(roomId!, {
        durationOverride,
        phase: timerPhase,
      }),
    onSuccess: () => {
      refetchRoomTimer();
      setIsStartTimerModalOpen(false);
    },
  });

  const pauseTimerMutation = useMutation({
    mutationFn: () => collaborationApi.pauseRoomTimer(roomId!),
    onSuccess: () => refetchRoomTimer(),
  });

  const resumeTimerMutation = useMutation({
    mutationFn: () => collaborationApi.resumeRoomTimer(roomId!),
    onSuccess: () => refetchRoomTimer(),
  });

  const completeTimerMutation = useMutation({
    mutationFn: () => collaborationApi.completeRoomTimer(roomId!),
    onSuccess: () => {
      refetchRoomTimer();
      queryClient.invalidateQueries({ queryKey: ['study-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });

  const cancelTimerMutation = useMutation({
    mutationFn: () => collaborationApi.cancelRoomTimer(roomId!),
    onSuccess: () => refetchRoomTimer(),
  });

  const joinTimerMutation = useMutation({
    mutationFn: () => collaborationApi.joinRoomTimer(roomId!),
    onSuccess: () => refetchRoomTimer(),
  });

  const leaveTimerMutation = useMutation({
    mutationFn: () => collaborationApi.leaveRoomTimer(roomId!),
    onSuccess: () => {
      refetchRoomTimer();
      queryClient.invalidateQueries({ queryKey: ['study-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });

  const leaveRoomMutation = useMutation({
    mutationFn: () => roomsApi.leaveRoom(roomId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      navigate('/app/rooms');
    },
  });

  if (isRoomLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-zinc-400 text-xs">
        Connecting to study room...
      </div>
    );
  }

  if (roomError || !room) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-3">
        <h2 className="text-sm font-semibold text-zinc-200">Unable to enter study room</h2>
        <p className="text-xs text-zinc-500">
          This room may be private or you may need an invitation token to join.
        </p>
        <Button size="sm" variant="glass" onClick={() => navigate('/app/rooms')}>
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Return to Rooms
        </Button>
      </div>
    );
  }

  const isTimerRunning = roomTimer?.status === 'RUNNING';
  const isTimerPaused = roomTimer?.status === 'PAUSED';
  const hasActiveTimer = isTimerRunning || isTimerPaused;

  const participants: RoomParticipant[] = roomTimer?.participants || [];
  const isParticipating = participants.some((p) => p.userId === profile?.id && !p.leftAt);

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      {/* Room Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-xl">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/app/rooms')}
              className="p-1 rounded-lg text-zinc-400 hover:text-white transition-colors mr-1"
              title="Back to all rooms"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-xl font-bold tracking-tight text-white">{room.name}</h1>
            {room.isPrivate ? (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Lock className="w-3 h-3" /> Private
              </Badge>
            ) : (
              <Badge variant="break" className="text-[10px] gap-1">
                <Globe className="w-3 h-3" /> Public
              </Badge>
            )}
            {currentUserRole && (
              <Badge variant="focus" className="text-[10px]">
                {currentUserRole}
              </Badge>
            )}
          </div>
          {room.description && (
            <p className="text-xs text-zinc-400 max-w-xl">{room.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          {isModOrOwner && (
            <Button size="sm" variant="glass" onClick={() => setIsInviteModalOpen(true)}>
              <UserPlus className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
              Invite
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => leaveRoomMutation.mutate()}
            isLoading={leaveRoomMutation.isPending}
            className="text-zinc-500 hover:text-red-400 text-xs"
          >
            <LogOut className="w-3.5 h-3.5 mr-1" /> Leave Room
          </Button>
        </div>
      </div>

      {/* Tabs Switcher for Mobile / Compact views */}
      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
        <button
          onClick={() => setActiveTab('timer')}
          className={cn(
            'px-4 py-2 rounded-xl text-xs font-semibold transition-all',
            activeTab === 'timer'
              ? 'bg-white/10 text-white'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
          )}
        >
          Shared Timer & Presence
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={cn(
            'px-4 py-2 rounded-xl text-xs font-semibold transition-all',
            activeTab === 'chat'
              ? 'bg-white/10 text-white'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
          )}
        >
          Room Chat
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={cn(
            'px-4 py-2 rounded-xl text-xs font-semibold transition-all',
            activeTab === 'members'
              ? 'bg-white/10 text-white'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
          )}
        >
          Members ({room.members?.length || 0})
        </button>
      </div>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Collaborative Timer & Participants View */}
        <div
          className={cn(
            'lg:col-span-2 flex flex-col gap-6',
            activeTab !== 'timer' && 'hidden lg:flex'
          )}
        >
          {/* Synchronized Room Timer Card */}
          <div className="p-8 sm:p-12 bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-2xl flex flex-col items-center justify-center text-center relative overflow-hidden shadow-2xl">
            {/* Top Indicator */}
            <div className="flex items-center gap-2 mb-6">
              <span
                className={cn(
                  'w-2 h-2 rounded-full',
                  isTimerRunning ? 'bg-amber-400 animate-ping' : isTimerPaused ? 'bg-zinc-500' : 'bg-zinc-700'
                )}
              />
              <span className="text-xs uppercase tracking-widest font-semibold text-zinc-400">
                {hasActiveTimer
                  ? `${roomTimer?.phase} (${roomTimer?.status})`
                  : 'Room Timer Idle'}
              </span>
            </div>

            {/* Huge Digits */}
            <div className="my-2">
              <span className="text-6xl sm:text-7xl md:text-8xl font-bold font-mono text-zinc-100 tabular-nums">
                {hasActiveTimer ? formatSecondsToMMSS(displaySeconds) : '00:00'}
              </span>
            </div>

            {/* Room Timer Controls */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              {/* Participant Join/Leave */}
              {hasActiveTimer && (
                <>
                  {isParticipating ? (
                    <Button
                      variant="secondary"
                      onClick={() => leaveTimerMutation.mutate()}
                      isLoading={leaveTimerMutation.isPending}
                    >
                      <UserCheck className="w-4 h-4 mr-1 text-emerald-400" />
                      Leave Focus Block
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={() => joinTimerMutation.mutate()}
                      isLoading={joinTimerMutation.isPending}
                    >
                      <Sparkles className="w-4 h-4 mr-1" />
                      Join Focus Block
                    </Button>
                  )}
                </>
              )}

              {/* Moderator / Owner Controls */}
              {isModOrOwner && (
                <>
                  {!hasActiveTimer && (
                    <Button
                      variant="primary"
                      onClick={() => setIsStartTimerModalOpen(true)}
                    >
                      <Play className="w-4 h-4 mr-1 fill-current" />
                      Start Room Timer
                    </Button>
                  )}

                  {isTimerRunning && (
                    <Button
                      variant="secondary"
                      onClick={() => pauseTimerMutation.mutate()}
                      isLoading={pauseTimerMutation.isPending}
                    >
                      <Pause className="w-4 h-4 mr-1" /> Pause
                    </Button>
                  )}

                  {isTimerPaused && (
                    <Button
                      variant="primary"
                      onClick={() => resumeTimerMutation.mutate()}
                      isLoading={resumeTimerMutation.isPending}
                    >
                      <Play className="w-4 h-4 mr-1 fill-current" /> Resume
                    </Button>
                  )}

                  {hasActiveTimer && (
                    <>
                      <Button
                        variant="secondary"
                        onClick={() => completeTimerMutation.mutate()}
                        isLoading={completeTimerMutation.isPending}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Complete
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => cancelTimerMutation.mutate()}
                        isLoading={cancelTimerMutation.isPending}
                        title="Cancel timer"
                      >
                        <Square className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Active participation status info */}
            {isParticipating && (
              <span className="text-xs text-emerald-400 font-medium mt-4 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> You are actively participating in this block.
              </span>
            )}
          </div>

          {/* Active Participants List */}
          <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-200">
                Active Participants ({participants.filter((p) => !p.leftAt).length})
              </span>
              <span className="text-[11px] text-zinc-500 font-mono">Real-time sync</span>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {participants.filter((p) => !p.leftAt).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs"
                >
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-[10px]">
                    {p.user.displayName?.[0] || p.user.username[0]}
                  </div>
                  <span className="text-zinc-200 font-medium">
                    {p.user.displayName || p.user.username}
                  </span>
                </div>
              ))}
              {participants.filter((p) => !p.leftAt).length === 0 && (
                <span className="text-xs text-zinc-500">No members studying in this block yet.</span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Chat & Members Directory */}
        <div className="flex flex-col gap-6">
          {/* Chat Widget */}
          <div className={cn(activeTab === 'members' && 'hidden lg:block')}>
            <RoomChatWidget roomId={roomId!} currentUserRole={currentUserRole} />
          </div>

          {/* Members List */}
          <div
            className={cn(
              'p-5 bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-xl flex flex-col gap-3',
              activeTab !== 'members' && 'hidden lg:flex'
            )}
          >
            <span className="text-xs font-semibold text-zinc-200">Room Members</span>
            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
              {room.members?.map((m) => (
                <div key={m.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-300 font-semibold">
                      {m.user.displayName?.[0] || m.user.username[0]}
                    </div>
                    <span className="text-zinc-300 truncate">
                      {m.user.displayName || m.user.username}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">
                    {m.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Start Room Timer Modal (Moderators/Owners) */}
      <Modal
        isOpen={isStartTimerModalOpen}
        onClose={() => setIsStartTimerModalOpen(false)}
        title="Start Synchronized Room Timer"
        description="Set the focus or break duration for all members of this study room."
        maxWidth="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startTimerMutation.mutate(customDurationMins * 60);
          }}
          className="flex flex-col gap-4 mt-2"
        >
          <div className="flex items-center gap-2 p-1 bg-white/[0.03] border border-white/10 rounded-xl">
            <button
              type="button"
              onClick={() => setTimerPhase('FOCUS')}
              className={cn(
                'flex-1 py-1.5 rounded-lg text-xs font-semibold',
                timerPhase === 'FOCUS' ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-400'
              )}
            >
              Focus Block
            </button>
            <button
              type="button"
              onClick={() => setTimerPhase('SHORT_BREAK')}
              className={cn(
                'flex-1 py-1.5 rounded-lg text-xs font-semibold',
                timerPhase === 'SHORT_BREAK' ? 'bg-teal-500/20 text-teal-300' : 'text-zinc-400'
              )}
            >
              Break
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[15, 25, 50].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => setCustomDurationMins(mins)}
                className={cn(
                  'py-2 rounded-xl text-xs font-mono font-medium border transition-all',
                  customDurationMins === mins
                    ? 'bg-white/10 text-white border-white/30'
                    : 'border-white/5 text-zinc-400 hover:text-white'
                )}
              >
                {mins} mins
              </button>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
            <Button variant="ghost" type="button" onClick={() => setIsStartTimerModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={startTimerMutation.isPending}>
              Start Timer
            </Button>
          </div>
        </form>
      </Modal>

      {/* Invite Modal */}
      <InviteModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        roomId={roomId!}
      />
    </div>
  );
};
