import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roomsApi } from '@/lib/api/rooms';
import { invitationsApi } from '@/lib/api/invitations';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Users2, Plus, KeyRound, Lock, Globe, ArrowRight } from 'lucide-react';
import type { Room } from '@/types/room';

export const RoomsDirectoryPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRedeemOpen, setIsRedeemOpen] = useState(false);

  // Create room form state
  const [roomName, setRoomName] = useState('');
  const [roomDesc, setRoomDesc] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState(25);

  // Invite token form state
  const [inviteToken, setInviteToken] = useState('');
  const [redeemError, setRedeemError] = useState<string | null>(null);

  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ['rooms'],
    queryFn: roomsApi.getRooms,
  });

  const createRoomMutation = useMutation({
    mutationFn: () =>
      roomsApi.createRoom({
        name: roomName.trim(),
        description: roomDesc.trim() || undefined,
        isPrivate,
        maxParticipants,
      }),
    onSuccess: (newRoom: Room) => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setIsCreateOpen(false);
      navigate(`/app/rooms/${newRoom.id}`);
    },
  });

  const redeemInviteMutation = useMutation({
    mutationFn: () => invitationsApi.acceptInvite(inviteToken.trim()),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setIsRedeemOpen(false);
      navigate(`/app/rooms/${res.room.id}`);
    },
    onError: (err: any) => {
      setRedeemError(err.message || 'Invalid or expired invitation token');
    },
  });

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Users2 className="w-6 h-6 text-amber-400" />
            Study Rooms
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Focus synchronously with peers, coordinate collaborative timers, and chat in deep work spaces.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="glass"
            onClick={() => {
              setInviteToken('');
              setRedeemError(null);
              setIsRedeemOpen(true);
            }}
          >
            <KeyRound className="w-3.5 h-3.5 mr-1.5 text-zinc-400" />
            Enter Invite Code
          </Button>
          <Button size="sm" variant="primary" onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Create Room
          </Button>
        </div>
      </div>

      {/* Rooms Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-44 bg-white/[0.02] border border-white/5 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white/[0.02] border border-white/5 rounded-3xl text-center">
          <Users2 className="w-12 h-12 text-zinc-600 mb-3" />
          <h2 className="text-sm font-semibold text-zinc-300">No rooms available yet</h2>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm">
            Create your first public study room or enter a private invite code to begin collaborative focus.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => {
            const isMember = Boolean(room.currentUserRole);

            return (
              <div
                key={room.id}
                className="p-5 bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 hover:border-white/10 rounded-3xl backdrop-blur-xl transition-all flex flex-col justify-between gap-4 group"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-zinc-500">/{room.slug}</span>
                    <div className="flex items-center gap-1.5">
                      {room.isPrivate ? (
                        <span className="flex items-center gap-1 text-[11px] text-zinc-400 font-medium">
                          <Lock className="w-3 h-3" /> Private
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] text-teal-400 font-medium">
                          <Globe className="w-3 h-3" /> Public
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="text-base font-semibold text-zinc-100 group-hover:text-amber-400 transition-colors">
                    {room.name}
                  </h3>

                  {room.description && (
                    <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                      {room.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 font-mono">
                      {room._count?.members || 1}/{room.maxParticipants} members
                    </span>
                    {room.currentUserRole && (
                      <Badge variant="outline" className="text-[10px] py-0 px-2 font-mono">
                        {room.currentUserRole}
                      </Badge>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant={isMember ? 'glass' : 'primary'}
                    onClick={() => navigate(`/app/rooms/${room.id}`)}
                    className="text-xs"
                  >
                    <span>{isMember ? 'Enter' : 'Join'}</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Room Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Study Room"
        description="Launch a collaborative focus space with shared synchronized timers and chat."
        maxWidth="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createRoomMutation.mutate();
          }}
          className="flex flex-col gap-4 mt-2"
        >
          <Input
            label="Room Name"
            placeholder="e.g. Distributed Systems Focus, Silent Library"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            required
            maxLength={80}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-400">Description (Optional)</label>
            <textarea
              rows={2}
              value={roomDesc}
              onChange={(e) => setRoomDesc(e.target.value)}
              placeholder="What is this room focused on?"
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 resize-none"
              maxLength={300}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-zinc-200">Private Room</span>
              <span className="text-[11px] text-zinc-500">Requires an invitation token to join</span>
            </div>
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="w-4 h-4 accent-amber-500 cursor-pointer"
            />
          </div>

          <Input
            type="number"
            label="Max Participants"
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(Number(e.target.value))}
            min={2}
            max={100}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
            <Button variant="ghost" type="button" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={createRoomMutation.isPending}>
              Create Room
            </Button>
          </div>
        </form>
      </Modal>

      {/* Redeem Invite Modal */}
      <Modal
        isOpen={isRedeemOpen}
        onClose={() => setIsRedeemOpen(false)}
        title="Redeem Room Invitation"
        description="Enter the 64-character invite token provided by the room moderator."
        maxWidth="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            redeemInviteMutation.mutate();
          }}
          className="flex flex-col gap-4 mt-2"
        >
          <Input
            label="Invite Token"
            placeholder="Paste 64-character token..."
            value={inviteToken}
            onChange={(e) => setInviteToken(e.target.value)}
            required
            className="font-mono text-xs"
            error={redeemError || undefined}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
            <Button variant="ghost" type="button" onClick={() => setIsRedeemOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={redeemInviteMutation.isPending}>
              Join Room
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
