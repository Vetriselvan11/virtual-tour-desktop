import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import DashboardLayout from './features/dashboard/components/DashboardLayout';
import ToursPage from './features/dashboard/pages/ToursPage';
import CreateTourPage from './features/dashboard/pages/CreateTourPage';
import AnalyticsDashboardPage from './features/dashboard/pages/AnalyticsDashboardPage';
import Heatmap360Page from './features/dashboard/pages/Heatmap360Page';
import EditorPage from './features/editor/pages/EditorPage';
import ViewerPage from './features/viewer/pages/ViewerPage';

import { AuthProvider } from './context/AuthProvider';
import ProtectedRoute from './routes/ProtectedRoute';
import { ResponsiveProvider } from './context/ResponsiveProvider';

import { antdTheme } from './constants/theme';
import InitialSplashLoader from './components/common/InitialSplashLoader';
import LandingPage from './features/landing/pages/LandingPage';

// Route Guard to ensure user MUST see & click Landing Page first on site visit
function StudioGate() {
  const hasEntered = typeof window !== 'undefined' && sessionStorage.getItem('wox_entered_studio') === 'true';
  if (!hasEntered) {
    return <Navigate to="/" replace />;
  }
  return <ProtectedRoute />;
}

export default function App() {
  if (window.__TOUR_CONFIG__) {
    return (
      <ConfigProvider theme={antdTheme}>
        <ResponsiveProvider>
          <InitialSplashLoader>
            <BrowserRouter>
              <ViewerPage />
            </BrowserRouter>
          </InitialSplashLoader>
        </ResponsiveProvider>
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider theme={antdTheme}>
      <ResponsiveProvider>
        <AuthProvider>
          <InitialSplashLoader>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <Routes>
                {/* Public Landing & Viewer Routes */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/home" element={<LandingPage />} />
                <Route path="/viewer/:tourId" element={<ViewerPage />} />
                <Route path="/tour/:slug" element={<ViewerPage />} />
                <Route path="/view/:tourId" element={<ViewerPage />} />
                <Route path="/view/:tourId/:versionId" element={<ViewerPage />} />

                {/* Studio Routes — Protected until button click on Landing Page */}
                <Route element={<StudioGate />}>
                  <Route path="/dashboard" element={<DashboardLayout />}>
                    <Route index element={<ToursPage />} />
                    <Route path="tours" element={<ToursPage />} />
                    <Route path="create" element={<CreateTourPage />} />
                    <Route path="analytics" element={<AnalyticsDashboardPage />} />
                  </Route>
                  <Route path="/dashboard/analytics/heatmap/:tourId/:sceneId" element={<Heatmap360Page />} />
                  <Route path="/editor/:tourId" element={<EditorPage />} />
                  <Route path="/settings" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/media" element={<Navigate to="/dashboard" replace />} />
                </Route>

                {/* Fallback to Landing Page */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </InitialSplashLoader>
        </AuthProvider>
      </ResponsiveProvider>
    </ConfigProvider>
  );
}
