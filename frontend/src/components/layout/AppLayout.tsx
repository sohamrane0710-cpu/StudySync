import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Timer, History, BarChart3, Users2, Settings, Zap } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { UserMenu } from './UserMenu';
import { useActiveTimer } from '@/hooks/use-active-timer';

export const AppLayout: React.FC = () => {
  const location = useLocation();
  const { currentPhase, isRunning } = useActiveTimer();

  const navItems = [
    { label: 'Focus', path: '/app/focus', icon: Timer },
    { label: 'Sessions', path: '/app/sessions', icon: History },
    { label: 'Analytics', path: '/app/analytics', icon: BarChart3 },
    { label: 'Rooms', path: '/app/rooms', icon: Users2 },
    { label: 'Settings', path: '/app/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#0B0D11] text-zinc-100 flex flex-col md:flex-row relative overflow-x-hidden selection:bg-amber-500/30 selection:text-amber-200">
      {/* Dynamic ambient optical glow */}
      <div
        className={cn(
          'fixed -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full blur-[140px] pointer-events-none transition-all duration-1000 -z-0 opacity-40',
          currentPhase === 'FOCUS' && isRunning
            ? 'bg-amber-500/25'
            : currentPhase.includes('BREAK') && isRunning
            ? 'bg-teal-500/25'
            : 'bg-zinc-700/10'
        )}
      />

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col justify-between w-64 border-r border-white/5 bg-[#101319]/80 backdrop-blur-2xl p-5 sticky top-0 h-screen z-20">
        <div className="flex flex-col gap-8">
          {/* Brand */}
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-black font-bold shadow-lg shadow-amber-500/20">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h1 className="font-semibold text-base tracking-tight text-white flex items-center gap-1.5">
                StudySync
              </h1>
              <span className="text-[10px] text-zinc-500 tracking-wider uppercase font-medium">
                Focus Engine
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex flex-col gap-1.5" aria-label="Main Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
                    isActive
                      ? 'bg-white/[0.08] text-white font-semibold border border-white/10 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
                  )}
                >
                  <Icon
                    className={cn(
                      'w-4 h-4 transition-transform group-hover:scale-110',
                      isActive ? 'text-amber-400' : 'text-zinc-500'
                    )}
                  />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Footer Account */}
        <div className="pt-4 border-t border-white/5 flex items-center justify-between">
          <UserMenu />
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-6 relative z-10">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#101319]/90 backdrop-blur-xl sticky top-0 z-30">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center text-black font-bold">
              <Zap className="w-4 h-4 fill-current" />
            </div>
            <span className="font-semibold text-sm text-white">StudySync</span>
          </div>
          <UserMenu />
        </header>

        {/* Page View */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 border-t border-white/10 bg-[#101319]/95 backdrop-blur-2xl px-2 py-2 flex items-center justify-around z-40"
        aria-label="Mobile Navigation"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.path);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all',
                isActive ? 'text-amber-400 font-semibold' : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="text-[10px]">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
