
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { LandingPage } from './pages/LandingPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { OnboardingPage } from './pages/OnboardingPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { ProfilePage } from './pages/ProfilePage.js';
import { RoomsPage } from './pages/RoomsPage.js';
import { CommunitiesPage } from './pages/CommunitiesPage.js';
import { AnalyticsPage } from './pages/AnalyticsPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { AuthShell } from './layouts/AuthShell.js';

function ProtectedRoute({ children, requireOnboarded }: { children: React.ReactNode, requireOnboarded: boolean }) {
  const { user, loading } = useAuth();
  
  if (loading) return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50">
      <div className="text-slate-500 font-medium">Loading...</div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;

  if (requireOnboarded && !user.onboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
  }

  if (!requireOnboarded && user.onboardingCompleted) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50">
      <div className="text-slate-500 font-medium">Loading...</div>
    </div>
  );
  if (user) {
    if (user.onboardingCompleted) {
      return <Navigate to="/dashboard" replace />;
    } else {
      return <Navigate to="/onboarding" replace />;
    }
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/onboarding" element={<ProtectedRoute requireOnboarded={false}><OnboardingPage /></ProtectedRoute>} />
      
      {/* Authenticated Shell Routes */}
      <Route element={<ProtectedRoute requireOnboarded={true}><AuthShell /></ProtectedRoute>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/rooms" element={<RoomsPage />} />
        <Route path="/communities" element={<CommunitiesPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
