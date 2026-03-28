import React from 'react';
import { Routes, Route } from 'react-router-dom';
import MarketplacePage from './pages/MarketplacePage';
import AdminPage from './pages/AdminPage';
import { usePageTracking } from './hooks/useAnalytics';

function TrackedRoutes() {
  usePageTracking();
  return (
    <Routes>
      <Route path="/" element={<MarketplacePage />} />
      <Route path="/admin" element={<AdminPage />} />
    </Routes>
  );
}

export default function App() {
  return <TrackedRoutes />;
}
