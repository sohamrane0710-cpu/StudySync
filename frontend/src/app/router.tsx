import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '@/features/auth/LoginPage';
import { SignUpPage } from '@/features/auth/SignUpPage';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { FocusPage } from '@/features/focus/FocusPage';
import { SessionsPage } from '@/features/sessions/SessionsPage';
import { AnalyticsPage } from '@/features/analytics/AnalyticsPage';
import { RoomsDirectoryPage } from '@/features/rooms/RoomsDirectoryPage';
import { RoomDetailPage } from '@/features/rooms/RoomDetailPage';
import { SettingsPage } from '@/features/settings/SettingsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/app/focus" replace />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/signup',
    element: <SignUpPage />,
  },
  {
    path: '/app',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/app/focus" replace />,
      },
      {
        path: 'focus',
        element: <FocusPage />,
      },
      {
        path: 'sessions',
        element: <SessionsPage />,
      },
      {
        path: 'analytics',
        element: <AnalyticsPage />,
      },
      {
        path: 'rooms',
        element: <RoomsDirectoryPage />,
      },
      {
        path: 'rooms/:roomId',
        element: <RoomDetailPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
