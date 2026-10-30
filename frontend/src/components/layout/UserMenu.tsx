import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/features/auth/auth-context';
import { LogOut, Sparkles } from 'lucide-react';

export const UserMenu: React.FC = () => {
  const { profile, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!profile) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 p-1.5 pr-3 rounded-full bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all text-left"
        aria-expanded={isOpen}
      >
        <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-300 font-semibold text-xs overflow-hidden">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt={profile.displayName || profile.username} className="w-full h-full object-cover" />
          ) : (
            (profile.displayName || profile.username).slice(0, 2).toUpperCase()
          )}
        </div>
        <div className="hidden md:flex flex-col">
          <span className="text-xs font-medium text-zinc-200 leading-tight">
            {profile.displayName || profile.username}
          </span>
          <span className="text-[10px] text-zinc-500 leading-tight">@{profile.username}</span>
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 bottom-full mb-2 md:bottom-auto md:top-full md:mt-2 w-56 bg-[#12151A] border border-white/10 rounded-2xl p-2 shadow-2xl backdrop-blur-xl z-50 animate-scale-up">
          <div className="px-3 py-2 border-b border-white/5 mb-1">
            <p className="text-xs font-semibold text-zinc-100">{profile.displayName || profile.username}</p>
            <p className="text-[11px] text-zinc-500 truncate">{profile.email || `@${profile.username}`}</p>
          </div>

          <div className="px-3 py-1.5 flex items-center gap-2 text-xs text-amber-400/90 font-medium bg-amber-500/10 rounded-lg my-1 border border-amber-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>StudySync Pro</span>
          </div>

          <button
            onClick={() => {
              setIsOpen(false);
              logout();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-red-400 hover:bg-red-500/10 transition-colors mt-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
};
