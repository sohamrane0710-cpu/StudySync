import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Users, BookOpen, BarChart3, UserCircle, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { fetchApi } from '../api.js';

export function Sidebar() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await fetchApi('/auth/logout', { method: 'POST' });
      await refreshUser();
      navigate('/');
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  const navItems = [
    { name: 'Dashboard', to: '/dashboard', icon: Home },
    { name: 'Study Rooms', to: '/rooms', icon: BookOpen },
    { name: 'Communities', to: '/communities', icon: Users },
    { name: 'Analytics', to: '/analytics', icon: BarChart3 },
    { name: 'Profile', to: '/profile', icon: UserCircle },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 h-full border-r border-slate-200 bg-white flex-shrink-0">
        <div className="p-6">
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">StudySync</h2>
        </div>
        
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-slate-100 text-slate-900' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-3 mb-4 px-2">
            {user?.avatarUrl ? (
              <img 
                src={user.avatarUrl} 
                alt="Avatar" 
                className="w-10 h-10 rounded-full object-cover border border-slate-200 flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold border border-slate-300 flex-shrink-0 uppercase">
                {(user?.displayName || user?.username || 'U').charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {user?.displayName || user?.username}
              </p>
              <p className="text-xs text-slate-500 truncate">@{user?.username}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 w-full bg-white border-t border-slate-200 z-50 flex justify-around items-center h-16 px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-full h-full space-y-1 ${
                isActive ? 'text-slate-900' : 'text-slate-500 hover:text-slate-900'
              }`
            }
          >
            <item.icon className="w-6 h-6" />
            <span className="text-[10px] font-medium">{item.name}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
