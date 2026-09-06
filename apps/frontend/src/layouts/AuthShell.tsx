import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';

export function AuthShell() {
  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans text-slate-900">
      <Sidebar />
      <main className="flex-1 h-full overflow-y-auto pb-16 md:pb-0">
        <div className="w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
