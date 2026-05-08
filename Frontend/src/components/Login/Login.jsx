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

  const getErrorMessage = (detail) => {
    if (typeof detail === 'string') {
      return detail;
    }

    if (Array.isArray(detail) && detail.length > 0) {
      return detail
        .map((item) => item?.msg || item?.message)
        .filter(Boolean)
        .join('. ') || 'Invalid login details';
    }

    if (detail && typeof detail === 'object') {
      return detail.message || detail.msg || 'Invalid login details';
    }

    return 'Invalid credentials. Please try again.';
  };

  const showToast = (message, type = 'success') => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    setToast({ message, type, id: Date.now() });
    toastTimer.current = setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    setToast(null);

    const email = formData.email.trim();
    const password = formData.password;

    if (!email || !password) {
      showToast('Please enter email and password', 'error');
      return;
    }

    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Invalid credentials. Please try again.';
        try {
          const data = await response.json();
          errorMessage = getErrorMessage(data?.detail);
        } catch {
          errorMessage = 'Invalid credentials. Please try again.';
        }
        showToast(errorMessage, 'error');
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
      {toast ? (
        <div className="toast-container">
          <div key={toast.id} className={`toast toast-${toast.type}`}>{toast.message}</div>
        </div>
      ) : null}

      {/* Left Panel with form */}
      <div className="login-left">
        <div className="login-form-wrapper">
          <h2 className="login-title">Login</h2>

          <form onSubmit={handleSubmit} className="login-form" noValidate>
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
