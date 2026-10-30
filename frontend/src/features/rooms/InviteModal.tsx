import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invitationsApi } from '@/lib/api/invitations';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { KeyRound, Copy, Check, Trash2 } from 'lucide-react';
import type { RoomInvite } from '@/types/invitation';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
}

export const InviteModal: React.FC<InviteModalProps> = ({ isOpen, onClose, roomId }) => {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  // Form options
  const [expiresInHours, setExpiresInHours] = useState<number>(24);
  const [maxUses, setMaxUses] = useState<number>(10);

  const { data: invites = [] } = useQuery({
    queryKey: ['room-invites', roomId],
    queryFn: () => invitationsApi.getInvites(roomId),
    enabled: isOpen,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      invitationsApi.createInvite(roomId, {
        expiresInHours: expiresInHours > 0 ? expiresInHours : null,
        maxUses: maxUses > 0 ? maxUses : null,
      }),
    onSuccess: (newInvite: RoomInvite) => {
      queryClient.invalidateQueries({ queryKey: ['room-invites', roomId] });
      if (newInvite.token) {
        setCreatedToken(newInvite.token);
      }
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (inviteId: string) => invitationsApi.deleteInvite(roomId, inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-invites', roomId] });
    },
  });

  const handleCopy = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Room Invitations"
      description="Generate cryptographic invite tokens to allow members into this study room."
      maxWidth="md"
    >
      <div className="flex flex-col gap-5 mt-2">
        {/* Token Alert after creation */}
        {createdToken && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
              <KeyRound className="w-4 h-4 text-amber-400" />
              <span>New Invite Token Generated</span>
            </div>
            <p className="text-[11px] text-zinc-400">
              This token is shown only once. Copy and share it with your study partner:
            </p>
            <div className="flex items-center gap-2 bg-black/60 p-2 rounded-xl border border-white/10">
              <span className="font-mono text-xs text-zinc-200 truncate select-all flex-1">
                {createdToken}
              </span>
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleCopy(createdToken)}
                className="text-xs shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1 text-black" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Create new invite generator */}
        <div className="flex flex-col gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
          <span className="text-xs font-semibold text-zinc-200">Generate New Token</span>
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              label="Expires In (Hours)"
              value={expiresInHours}
              onChange={(e) => setExpiresInHours(Number(e.target.value))}
              min={1}
              max={720}
            />
            <Input
              type="number"
              label="Max Redemptions"
              value={maxUses}
              onChange={(e) => setMaxUses(Number(e.target.value))}
              min={1}
              max={1000}
            />
          </div>
          <div className="flex justify-end pt-1">
            <Button
              size="sm"
              variant="primary"
              onClick={() => createMutation.mutate()}
              isLoading={createMutation.isPending}
            >
              Generate Token
            </Button>
          </div>
        </div>

        {/* Existing Active Invites List */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-zinc-300">Active Invitations</span>
          {invites.length === 0 ? (
            <span className="text-xs text-zinc-500">No active invites for this room.</span>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
              {invites.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-xs"
                >
                  <div className="flex flex-col">
                    <span className="text-zinc-300 font-mono text-[11px]">
                      Uses: {inv.usesCount || 0} / {inv.maxUses || 'Unlimited'}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {inv.expiresAt
                        ? `Expires: ${new Date(inv.expiresAt).toLocaleDateString()}`
                        : 'Never expires'}
                    </span>
                  </div>

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => revokeMutation.mutate(inv.id)}
                    className="w-7 h-7 text-zinc-500 hover:text-red-400"
                    title="Revoke invitation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
