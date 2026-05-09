import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Lock,
  Settings as SettingsIcon,
  Shield,
  Trash2,
  Camera,
  Save,
  ArrowLeft,
  LayoutDashboard,
  Check,
  AlertTriangle,
  Loader2,
  LogOut,
  Menu,
  Upload,
  MessageSquare,
  BookOpen,
  FileText,
  X
} from 'lucide-react';
import { useUser } from '../../context/UserContext';
import './Settings.css';

const API_BASE = '/api/v1';

function authHeaders() {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const Settings = () => {
  const navigate = useNavigate();
  const avatarInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { user, updateUser, refreshUser, clearUser } = useUser();

  // Local form state — seeded from context
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Seed form fields when user data arrives from context
  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setEmail(user.email || '');
      setAvatarUrl(user.avatar_url || null);
    }
  }, [user]);

  // Redirect if not logged in
  useEffect(() => {
    if (!localStorage.getItem('access_token')) {
      navigate('/login');
    }
  }, [navigate]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Avatar file selection
  const handleAvatarSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800 * 1024) {
      showToast('Image too large. Max 800 KB.', 'error');
      return;
    }

    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  // Save profile changes
  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      // Update name
      const res = await fetch(`${API_BASE}/users/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ full_name: fullName }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || 'Failed to update profile', 'error');
        setSaving(false);
        return;
      }

      // Optimistically update the shared context with the new name
      updateUser({ full_name: fullName });

      // Upload avatar if changed
      if (avatarFile) {
        const formData = new FormData();
        formData.append('file', avatarFile);
        const avatarRes = await fetch(`${API_BASE}/users/me/avatar`, {
          method: 'PUT',
          headers: authHeaders(),
          body: formData,
        });
        if (!avatarRes.ok) {
          const err = await avatarRes.json().catch(() => ({}));
          showToast(err.detail || 'Failed to upload avatar', 'error');
          setSaving(false);
          return;
        }
        const updatedUser = await avatarRes.json();
        setAvatarUrl(updatedUser.avatar_url);
        setAvatarFile(null);
        setAvatarPreview(null);

        // Push updated avatar to shared context
        updateUser({ avatar_url: updatedUser.avatar_url });
      }

      // Also do a full refresh from the DB to guarantee sync
      await refreshUser();

      setSaved(true);
      showToast('Profile updated successfully');
      setTimeout(() => setSaved(false), 3000);
    } catch {
      showToast('Something went wrong', 'error');
    }
    setSaving(false);
  };

  // Change password
  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      showToast('Please fill in all password fields', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showToast('New password must be at least 6 characters', 'error');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/users/me/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || 'Failed to change password', 'error');
        setSaving(false);
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSaved(true);
      showToast('Password changed successfully');
      setTimeout(() => setSaved(false), 3000);
    } catch {
      showToast('Something went wrong', 'error');
    }
    setSaving(false);
  };

  // Delete account
  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/users/me`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok && res.status !== 204) {
        showToast('Failed to delete account', 'error');
        setDeleting(false);
        return;
      }
      localStorage.removeItem('access_token');
      clearUser();
      showToast('Account deleted. Redirecting...');
      setTimeout(() => navigate('/login'), 1500);
    } catch {
      showToast('Something went wrong', 'error');
      setDeleting(false);
    }
  };

  const handleSave = () => {
    if (activeTab === 'profile') handleSaveProfile();
    else if (activeTab === 'security') handleChangePassword();
  };

  const displayAvatar = avatarPreview || avatarUrl;

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'danger', label: 'Account', icon: Shield },
  ];

  return (
    <div className="settings-layout">
      {mobileMenuOpen && (
        <div className="settings-mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="settings-mobile-menu" onClick={(event) => event.stopPropagation()}>
            <div className="settings-mobile-menu-header">
              <span>SecureVision AI</span>
              <button className="settings-mobile-menu-close" onClick={() => setMobileMenuOpen(false)}>
                <X size={22} />
              </button>
            </div>
            <nav className="settings-mobile-nav">
              <div className="settings-mobile-nav-item" onClick={() => { navigate('/dashboard'); setMobileMenuOpen(false); }}><LayoutDashboard size={20} /> Dashboard</div>
              <div className="settings-mobile-nav-item" onClick={() => { navigate('/upload'); setMobileMenuOpen(false); }}><Upload size={20} /> Upload</div>
              <div className="settings-mobile-nav-item" onClick={() => { navigate('/chat'); setMobileMenuOpen(false); }}><MessageSquare size={20} /> AI Assistant</div>
              <div className="settings-mobile-nav-item" onClick={() => { navigate('/reports'); setMobileMenuOpen(false); }}><FileText size={20} /> Reports</div>
              <div className="settings-mobile-nav-item" onClick={() => { navigate('/training'); setMobileMenuOpen(false); }}><BookOpen size={20} /> Training Module</div>
              <div className="settings-mobile-nav-item active" onClick={() => setMobileMenuOpen(false)}><SettingsIcon size={20} /> Settings</div>
              <div className="settings-mobile-nav-divider">Settings Sections</div>
              {tabs.map(tab => (
                <div
                  key={tab.id}
                  className={`settings-mobile-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => { setActiveTab(tab.id); setMobileMenuOpen(false); }}
                >
                  <tab.icon size={20} /> {tab.label}
                </div>
              ))}
              <div className="settings-mobile-nav-item logout" onClick={() => { navigate('/logout'); setMobileMenuOpen(false); }}><LogOut size={20} /> Log Out</div>
            </nav>
          </div>
        </div>
      )}
      {toast && (
        <div className={`settings-toast ${toast.type}`}>
          {toast.type === 'error' ? <AlertTriangle size={16} /> : <Check size={16} />}
          {toast.message}
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className="settings-sidebar">
        <div className="sidebar-header" onClick={() => navigate('/dashboard')}>
          <div className="logo-square-small"></div>
          <span>SecureVision AI</span>
        </div>

        <nav className="settings-nav">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`settings-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon size={20} />
              <span>{tab.label}</span>
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom-actions">
          <div className="settings-nav-item" onClick={() => navigate('/dashboard')}>
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </div>
          <div className="settings-nav-item" onClick={() => navigate('/chat')}>
            <MessageSquare size={20} />
            <span>AI Assistant</span>
          </div>
          <div className="settings-nav-item" onClick={() => navigate('/reports')}>
            <FileText size={20} />
            <span>Reports</span>
          </div>
          <div className="settings-nav-item logout" onClick={() => navigate('/logout')}>
            <LogOut size={20} />
            <span>Log Out</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="settings-content">
        <header className="settings-header">
          <div className="header-left">
            <button className="settings-mobile-menu-btn" onClick={() => setMobileMenuOpen(true)}>
              <Menu size={22} />
            </button>
            <button className="back-btn-circle" onClick={() => navigate('/dashboard')}>
              <ArrowLeft size={20} />
            </button>
            <h1>Settings</h1>
          </div>
          {activeTab !== 'danger' && (
            <button
              className={`save-btn ${saved ? 'saved' : ''}`}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <Loader2 size={18} className="spin" /> : saved ? <Check size={18} /> : <Save size={18} />}
              {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
            </button>
          )}
        </header>

        <div className="settings-body">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="settings-section animate-fade-in">
              <div className="profile-upload">
                <div className="avatar-preview" onClick={() => avatarInputRef.current?.click()}>
                  {displayAvatar ? (
                    <img src={displayAvatar} alt="Avatar" />
                  ) : (
                    <div className="avatar-placeholder">
                      <User size={36} />
                    </div>
                  )}
                  <div className="upload-overlay">
                    <Camera size={20} />
                  </div>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleAvatarSelect}
                    style={{ display: 'none' }}
                  />
                </div>
                <div className="upload-info">
                  <h3>Profile Picture</h3>
                  <p>JPG, PNG, GIF or WebP. Max 800 KB</p>
                  <button className="btn-outline-small" onClick={() => avatarInputRef.current?.click()}>
                    Upload New
                  </button>
                </div>
              </div>

              <div className="settings-form-grid">
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your name"
                  />
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input type="email" value={email} disabled />
                </div>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="settings-section animate-fade-in">
              <div className="section-info">
                <h3>Password Management</h3>
                <p>Ensure your account is using a long, random password to stay secure.</p>
              </div>
              <div className="settings-form-grid">
                <div className="form-group full-width">
                  <label>Current Password</label>
                  <input
                    type="password"
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>New Password</label>
                  <input
                    type="password"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Confirm Password</label>
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Account / Danger Zone Tab */}
          {activeTab === 'danger' && (
            <div className="settings-section animate-fade-in">
              <div className="section-info">
                <h3>Account Management</h3>
                <p>Manage your account status. These actions are permanent and cannot be reversed.</p>
              </div>

              <div className="danger-zone">
                <div className="danger-info">
                  <h3>
                    <AlertTriangle size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                    Delete Account
                  </h3>
                  <p>Permanently delete your account, profile picture, chat history, and all associated data. This action cannot be undone.</p>
                </div>
                {!showDeleteConfirm ? (
                  <button className="btn-danger" onClick={() => setShowDeleteConfirm(true)}>
                    <Trash2 size={18} />
                    Delete Account
                  </button>
                ) : (
                  <div className="delete-confirm-actions">
                    <p className="confirm-text">Are you absolutely sure?</p>
                    <button
                      className="btn-danger"
                      onClick={handleDeleteAccount}
                      disabled={deleting}
                    >
                      {deleting ? <Loader2 size={18} className="spin" /> : <Trash2 size={18} />}
                      {deleting ? 'Deleting...' : 'Yes, Delete Everything'}
                    </button>
                    <button
                      className="btn-outline-small"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Settings;
