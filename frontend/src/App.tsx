import React from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import FormWizardPage from './pages/FormWizardPage';
import ResultPage from './pages/ResultPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/apply" element={<FormWizardPage />} />
      <Route path="/result" element={<ResultPage />} />
    </Routes>
  );
}
