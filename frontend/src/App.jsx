import React, { useState, useEffect } from 'react';
import { Layout, Spin, Alert } from 'antd';
import { Routes, Route, Navigate } from 'react-router-dom';
import TopNav from './components/TopNav';
import InterviewPage from './pages/InterviewPage';
import DashboardPage from './pages/DashboardPage';
import './App.css';
import { API_BASE } from './api';

const { Content, Footer } = Layout;

export default function App() {
  const [backendUp, setBackendUp] = useState(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${API_BASE}/health`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Network response not ok');
        const data = await res.json();
        setBackendUp(Boolean(data?.ok));
      } catch (err) {
        console.error('Health check failed', err);
        setBackendUp(false);
      }
    };
    checkHealth();
  }, []);

  return (
    <Layout className="app-layout">
      <TopNav backendUp={backendUp} />
      <Content className="content-wrapper">
        <div className="content-inner">
          {backendUp === null ? (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
              <Spin tip="Checking backend..." />
            </div>
          ) : backendUp === false ? (
            <Alert
              message="Backend Unreachable"
              description={`The backend server is not responding${API_BASE ? ' at ' + API_BASE : ''}. Ensure the backend is running.`}
              type="error"
              showIcon
            />
          ) : (
            <Routes>
              <Route path="/" element={<Navigate to="/interview" replace />} />
              <Route path="/interview" element={<InterviewPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="*" element={<div>Page not found</div>} />
            </Routes>
          )}
        </div>
      </Content>
      <Footer className="app-footer">AI Interview Assistant</Footer>
    </Layout>
  );
}
