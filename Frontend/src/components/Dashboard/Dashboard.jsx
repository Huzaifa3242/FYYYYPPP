import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield,
  Video,
  AlertTriangle,
  CheckCircle,
  Activity,
  Upload,
  Clock,
  Search,
  Bell,
  HelpCircle,
  ChevronRight,
  LayoutDashboard,
  FileText,
  BookOpen,
  Settings,
  LogOut,
  Phone,
  MessageSquare
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useUser } from "../../context/UserContext";
import "./Dashboard.css";

const STAT_CARDS = [
  { icon: Video, label: "Total Analyses", value: "24", color: "text-teal" },
  { icon: AlertTriangle, label: "Anomalies Detected", value: "7", color: "text-red" },
  { icon: CheckCircle, label: "Normal Results", value: "17", color: "text-green" },
  { icon: Activity, label: "System Uptime", value: "99.9%", color: "text-orange" },
];

const TREND_DATA = [
  { date: "Oct 16", anomalies: 2, total: 8 },
  { date: "Oct 17", anomalies: 1, total: 12 },
  { date: "Oct 18", anomalies: 4, total: 15 },
  { date: "Oct 19", anomalies: 2, total: 10 },
  { date: "Oct 20", anomalies: 5, total: 18 },
  { date: "Oct 21", anomalies: 3, total: 14 },
  { date: "Oct 22", anomalies: 7, total: 24 },
];

const RECENT_ACTIVITY = [
  { file: "parking_lot_cam4.mp4", status: "abnormal", cls: "Robbery", time: "2 min ago" },
  { file: "entrance_cam1.mp4", status: "normal", cls: "Normal", time: "15 min ago" },
  { file: "warehouse_cam2.mp4", status: "abnormal", cls: "Stealing", time: "1 hour ago" },
  { file: "lobby_cam3.mp4", status: "normal", cls: "Normal", time: "3 hours ago" },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useUser();

  const [stats, setStats] = useState({
    total_analyses: "0",
    anomalies_detected: "0",
    normal_results: "0",
    system_uptime: "99.9%",
  });
  const [activity, setActivity] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      const token = localStorage.getItem("access_token");
      if (!token) return;

      try {
        const [statsRes, activityRes, trendRes] = await Promise.all([
          fetch("/api/v1/users/me/stats", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/v1/users/me/activity", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/v1/users/me/trend", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }
        if (activityRes.ok) {
          const activityData = await activityRes.json();
          setActivity(activityData);
        }
        if (trendRes.ok) {
          const trendData = await trendRes.json();
          setTrendData(trendData);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchDashboardData();
  }, []);

  const dynamicStatCards = [
    { icon: Video, label: "Total Analyses", value: stats.total_analyses.toString(), color: "text-teal" },
    { icon: AlertTriangle, label: "Anomalies Detected", value: stats.anomalies_detected.toString(), color: "text-red" },
    { icon: CheckCircle, label: "Normal Results", value: stats.normal_results.toString(), color: "text-green" },
    { icon: Activity, label: "System Uptime", value: stats.system_uptime, color: "text-orange" },
  ];

  const userName = user?.full_name || user?.email || '';
  const userAvatar = user?.avatar_url || null;

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo" onClick={() => navigate('/dashboard')}>
          <div className="logo-square"></div>
          <span>SecureVision AI</span>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-item active"><LayoutDashboard size={20} /> Dashboard</div>
          <div className="nav-item" onClick={() => navigate('/upload')}><Upload size={20} /> Upload</div>

          <div className="nav-item" onClick={() => navigate('/chat')}>
            <MessageSquare size={20} /> AI Assistant
          </div>
          <div className="nav-item" onClick={() => navigate('/training')}>
            <BookOpen size={20} /> Training Module
          </div>

          <div className="nav-item" onClick={() => navigate('/settings')}><Settings size={20} /> Settings</div>
          <div className="nav-item logout-nav" onClick={() => navigate('/logout')}><LogOut size={20} /> Log Out</div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* TopBar (Header) */}
        <header className="dashboard-header">
          <div className="header-spacer"></div>

          <div className="header-actions">
            <HelpCircle size={22} />
            <Bell size={22} />
            <div className="user-profile">
              {userAvatar ? (
                <img src={userAvatar} alt="User" />
              ) : (
                <div className="user-avatar-fallback">{(userName || 'U')[0].toUpperCase()}</div>
              )}
              <div className="user-info">
                <span className="user-name">{userName || 'User'}</span>
                <span className="user-role">Admin</span>
              </div>
            </div>
          </div>
        </header>

        <div className="dashboard-content">
          <h1 className="page-title">Dashboard</h1>

          {/* Stats grid */}
          <div className="stats-grid">
            {dynamicStatCards.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="stat-card">
                  <div className="stat-card-content">
                    <div>
                      <p className="stat-label">{s.label}</p>
                      <p className="stat-value-large">{s.value}</p>
                    </div>
                    <div className={`stat-icon-wrapper ${s.color}`}>
                      <Icon size={20} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="main-grid">
            {/* Chart */}
            <div className="chart-card-large">
              <div className="card-header">
                <h3 className="card-title">
                  <Activity size={16} className="text-teal" />
                  Anomaly Detection Trend
                </h3>
              </div>
              <div className="chart-container-inner">
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={trendData.length > 0 ? trendData : TREND_DATA}>
                    <defs>
                      <linearGradient id="colorAnomalies" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ff4d4d" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ff4d4d" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#24606B" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#24606B" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "#888" }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "#888" }}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0D242C', border: '1px solid #1a3a45', color: '#fff' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      name="Total Analyses"
                      stroke="#24606B"
                      fillOpacity={1}
                      fill="url(#colorTotal)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="anomalies"
                      name="Anomalies"
                      stroke="#ff4d4d"
                      fillOpacity={1}
                      fill="url(#colorAnomalies)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent activity */}
            <div className="activity-card">
              <div className="card-header">
                <h3 className="card-title">
                  <Clock size={16} /> Recent Activity
                </h3>
              </div>
              <div className="activity-list">
                {activity.length === 0 ? (
                  <div className="no-activity">No recent analyses found</div>
                ) : (
                  activity.map((item, i) => (
                    <div key={item.id || i} className="activity-item">
                      <div className="activity-main">
                        <Video size={14} className="activity-icon" />
                        <div className="activity-info">
                          <p className="activity-file">{item.filename}</p>
                          <p className="activity-time">
                            {new Date(item.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="activity-status">
                        <span className="activity-cls">
                          {item.top_class === "NormalVideosforEventRecognition" ? "Normal" : item.top_class}
                        </span>
                        <span className={`status-badge ${item.status}`}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <button
                onClick={() => navigate("/dashboard")}
                className="view-all-btn"
              >
                View All Reports
              </button>
            </div>
          </div>

          {/* Quick actions */}
          <div className="quick-actions-grid">
            <div className="action-card" onClick={() => navigate("/upload")}>
              <div className="action-icon-bg">
                <Upload size={24} className="text-teal" />
              </div>
              <div>
                <h3 className="action-title">Upload & Analyze</h3>
                <p className="action-subtitle">Upload a video for anomaly detection</p>
              </div>
            </div>

            <div className="action-card" onClick={() => navigate("/chat")}>
              <div className="action-icon-bg">
                <Shield size={24} className="text-teal" />
              </div>
              <div>
                <h3 className="action-title">AI Chat Assistant</h3>
                <p className="action-subtitle">Ask questions about detections</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
