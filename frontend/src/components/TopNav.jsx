import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from 'antd';

export default function TopNav({ backendUp }) {
  const nav = useNavigate();
  const loc = useLocation();

  return (
    <div className="topnav">
      {/* Left: Title */}
      <div className="title">AI INTERVIEW ASSISTANT</div>

      {/* Center: Nav Buttons */}
      <div className="nav-buttons">
        <Button
          type={loc.pathname.startsWith('/interview') ? 'primary' : 'default'}
          onClick={() => nav('/interview')}
        >
          Interview
        </Button>
        <Button
          type={loc.pathname.startsWith('/dashboard') ? 'primary' : 'default'}
          onClick={() => nav('/dashboard')}
        >
          Dashboard
        </Button>
      </div>

      {/* Right: Backend Status */}
      <div className="backend-status">
        {backendUp === null
          ? 'Checking...'
          : backendUp
          ? 'Backend: OK'
          : 'Backend: Down'}
      </div>
    </div>
  );
}
