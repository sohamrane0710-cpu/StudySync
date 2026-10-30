import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatApi } from '@/lib/api/chat';
import { useAuth } from '@/features/auth/auth-context';
import { formatTime } from '@/lib/utils/format';
import { Button } from '@/components/ui/Button';
import { Send, Edit2, Trash2, Check, X, MessageSquare, Loader2 } from 'lucide-react';
import type { ChatMessage } from '@/types/chat';
import { cn } from '@/lib/utils/cn';

interface RoomChatWidgetProps {
  roomId: string;
  currentUserRole?: string | null;
}

export const RoomChatWidget: React.FC<RoomChatWidgetProps> = ({ roomId, currentUserRole }) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['room-chat', roomId],
    queryFn: () => chatApi.getMessages(roomId, { limit: 50 }),
    refetchInterval: 6000, // REST chat periodic sync
  });

  const messages: ChatMessage[] = data?.messages || [];

  const sendMutation = useMutation({
    mutationFn: (text: string) => chatApi.sendMessage(roomId, { content: text }),
    onSuccess: (newMsg) => {
      setContent('');
      queryClient.setQueryData(['room-chat', roomId], (prev: any) => ({
        ...prev,
        messages: [...(prev?.messages || []), newMsg],
      }));
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ messageId, text }: { messageId: string; text: string }) =>
      chatApi.editMessage(roomId, messageId, { content: text }),
    onSuccess: (updated) => {
      setEditingMsgId(null);
      queryClient.setQueryData(['room-chat', roomId], (prev: any) => ({
        ...prev,
        messages: (prev?.messages || []).map((m: ChatMessage) =>
          m.id === updated.id ? updated : m
        ),
      }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (messageId: string) => chatApi.deleteMessage(roomId, messageId),
    onSuccess: (_, messageId) => {
      queryClient.setQueryData(['room-chat', roomId], (prev: any) => ({
        ...prev,
        messages: (prev?.messages || []).filter((m: ChatMessage) => m.id !== messageId),
      }));
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || sendMutation.isPending) return;
    sendMutation.mutate(content.trim());
  };

  const handleSaveEdit = (messageId: string) => {
    if (!editingText.trim()) return;
    editMutation.mutate({ messageId, text: editingText.trim() });
  };

  return (
    <div className="flex flex-col h-[520px] bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5 bg-[#12151A]/60">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-zinc-100">Room Focus Chat</span>
        </div>
        <span className="text-[10px] text-zinc-500 font-mono">REST-synced</span>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-xs text-zinc-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500">
            <MessageSquare className="w-8 h-8 text-zinc-700 mb-2" />
            <p className="text-xs">No messages yet. Send a greeting to start your focus session!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderId === profile?.id;
            const canDelete = isMine || currentUserRole === 'OWNER' || currentUserRole === 'MODERATOR';
            const isEditing = editingMsgId === msg.id;

            return (
              <div
                key={msg.id}
                className={cn(
                  'flex flex-col max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed transition-all group',
                  isMine
                    ? 'self-end bg-amber-500/10 border border-amber-500/20 text-zinc-100'
                    : 'self-start bg-white/[0.03] border border-white/5 text-zinc-200'
                )}
              >
                {/* Author row */}
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="font-semibold text-[11px] text-amber-300">
                    {msg.sender.displayName || msg.sender.username}
                  </span>
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                    <span>{formatTime(msg.createdAt)}</span>
                    {msg.isEdited && <span className="italic">(edited)</span>}
                  </div>
                </div>

                {/* Content or Edit form */}
                {isEditing ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    <input
                      type="text"
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveEdit(msg.id)}
                      className="p-1 text-emerald-400 hover:text-emerald-300"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingMsgId(null)}
                      className="p-1 text-zinc-400 hover:text-zinc-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <p className="break-words select-text">{msg.content}</p>
                )}

                {/* Hover Action controls */}
                {!isEditing && (
                  <div className="opacity-0 group-hover:opacity-100 flex items-center justify-end gap-1.5 mt-1 pt-1 border-t border-white/5 transition-opacity">
                    {isMine && (
                      <button
                        onClick={() => {
                          setEditingMsgId(msg.id);
                          setEditingText(msg.content);
                        }}
                        className="p-1 text-zinc-400 hover:text-zinc-200"
                        title="Edit message"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => deleteMutation.mutate(msg.id)}
                        className="p-1 text-zinc-500 hover:text-red-400"
                        title="Delete message"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Composer */}
      <form onSubmit={handleSend} className="p-3 border-t border-white/5 bg-[#12151A]/80 flex gap-2">
        <input
          type="text"
          placeholder="Share progress or encourage peers..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={2000}
          className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
        />
        <Button
          size="sm"
          variant="primary"
          type="submit"
          disabled={!content.trim() || sendMutation.isPending}
          className="px-3"
        >
          <Send className="w-3.5 h-3.5" />
        </Button>
      </form>
    </div>
  );
};
