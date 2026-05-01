import { useRef, useState } from 'react';
import { HiEye, HiEyeOff } from 'react-icons/hi';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const { refreshUser } = useUser();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    toastTimer.current = setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setToast(null);

    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        showToast(data?.detail || 'Login failed', 'error');
        return;
      }

      const data = await response.json();
      if (data?.access_token) {
        localStorage.setItem('access_token', data.access_token);
        await refreshUser();
      }
      showToast('Login successful', 'success');
      setTimeout(() => navigate('/dashboard'), 600);
    } catch (error) {
      showToast('Login failed. Please try again.', 'error');
    }
  };

  return (
    <div className="login-container">
      {/* Left Panel with form */}
      <div className="login-left">
        <div className="login-form-wrapper">
          <h2 className="login-title">Login</h2>

          {toast ? (
            <div className="toast-container">
              <div className={`toast toast-${toast.type}`}>{toast.message}</div>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="input-group">
              <input
                type="email"
                name="email"
                id="login-email"
                placeholder="Email"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
              />
              <div className="input-line"></div>
            </div>

            <div className="input-group password-group">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                id="login-password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <HiEye /> : <HiEyeOff />}
              </button>
              <div className="input-line"></div>
            </div>

            <button type="submit" className="login-btn" id="login-submit">
              <span>Login</span>
            </button>
          </form>

          <div className="login-footer">
            <p>Don't have an account ?</p>
            <Link to="/signup" className="signup-link" id="signup-link">Sign Up</Link>
          </div>
        </div>
      </div>

      {/* Right Panel - Plain welcome with diagonal edge reversed */}
      <div className="login-right">
        <h1 className="welcome-back-text">Welcome <br /> Back !</h1>
      </div>
    </div>
  );
};

export default Login;
