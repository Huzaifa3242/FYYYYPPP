import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Loader2 } from 'lucide-react';
import { useUser } from '../../context/UserContext';
import './Logout.css';

const Logout = () => {
  const navigate = useNavigate();
  const { clearUser } = useUser();
  const [isConfirming, setIsConfirming] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (isLoggingOut) {
      const timer = setTimeout(() => {
        navigate('/login');
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [isLoggingOut, navigate]);

  const handleConfirm = () => {
    localStorage.removeItem('access_token');
    clearUser();
    setIsConfirming(false);
    setIsLoggingOut(true);
  };

  const handleCancel = () => {
    navigate(-1); // Go back to the previous page
  };

  return (
    <div className="logout-page">
      <div className="logout-glow-bg"></div>
      
      {isConfirming ? (
        <div className="logout-card confirm-view">
          <div className="logout-icon-wrapper warning">
            <LogOut size={48} className="logout-icon" />
          </div>
          <h1>Confirm Logout</h1>
          <p>Are you sure you want to end your session? You will need to login again to access your dashboard.</p>
          
          <div className="confirm-actions">
            <button className="btn-confirm" onClick={handleConfirm}>Yes, Log Out</button>
            <button className="btn-cancel" onClick={handleCancel}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="logout-card logout-view">
          <div className="logout-icon-wrapper">
            <LogOut size={48} className="logout-icon" />
          </div>
          <h1>Logging Out</h1>
          <p>Saving your session and securing your data...</p>
          
          <div className="logout-progress-container">
            <div className="logout-progress-bar"></div>
          </div>

          <div className="logout-footer">
            <Loader2 size={18} className="spinner-icon" />
            <span>Redirecting to login shortly</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Logout;
