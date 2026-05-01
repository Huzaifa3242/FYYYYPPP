import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HiEye, HiEyeOff } from 'react-icons/hi';
import './Signup.css';

const Signup = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
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
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          full_name: formData.username || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        showToast(data?.detail || 'Signup failed', 'error');
        return;
      }

      showToast('Account created. Please log in.', 'success');
      setTimeout(() => navigate('/login'), 600);
    } catch (error) {
      showToast('Signup failed. Please try again.', 'error');
    }
  };

  return (
    <div className="signup-container">
      {/* Left Panel - Plain welcome with diagonal edge */}
      <div className="signup-left">
        <h1 className="welcome-text">Welcome!</h1>
      </div>

      {/* Right Panel with form */}
      <div className="signup-right">
        <div className="signup-form-wrapper">
          <h2 className="signup-title">Register</h2>

          {toast ? (
            <div className="toast-container">
              <div className={`toast toast-${toast.type}`}>{toast.message}</div>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="signup-form">
            <div className="input-group">
              <input
                type="text"
                name="username"
                id="signup-username"
                placeholder="Username"
                value={formData.username}
                onChange={handleChange}
                required
                autoComplete="username"
              />
              <div className="input-line"></div>
            </div>

            <div className="input-group">
              <input
                type="email"
                name="email"
                id="signup-email"
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
                id="signup-password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                required
                autoComplete="new-password"
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

            <button type="submit" className="register-btn" id="signup-submit">
              <span>Register</span>
            </button>
          </form>

          <div className="signup-footer">
            <p>Already have an account ?</p>
            <Link to="/login" className="signin-link" id="signin-link">Sign In</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
