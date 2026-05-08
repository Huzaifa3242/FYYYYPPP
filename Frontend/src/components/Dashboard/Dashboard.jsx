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
  LayoutDashboard,
  BookOpen,
  Settings,
  LogOut,
  MessageSquare,
  Menu,
  X
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
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

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useUser();

  const [stats, setStats] = useState({
    total_analyses: "0",
    anomalies_detected: "0",
    normal_results: "0",
    anomaly_rate: 0,
  });
  const [activity, setActivity] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [intelligence, setIntelligence] = useState({
    threat_distribution: [],
    confidence_distribution: [],
    severity_queue: [],
    avg_confidence: 0,
    llm_coverage: 0,
    llm_generated: 0,
    total_reports: 0,
    total_footage_minutes: 0,
    latest_high_risk: null,
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const fetchDashboardData = async () => {
      const token = localStorage.getItem("access_token");
      if (!token) return;

      try {
        const [statsRes, activityRes, trendRes, intelligenceRes] = await Promise.all([
          fetch("/api/v1/users/me/stats", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/v1/users/me/activity", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/v1/users/me/trend", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/v1/users/me/intelligence", {
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
        if (intelligenceRes.ok) {
          const intelligenceData = await intelligenceRes.json();
          setIntelligence(intelligenceData);
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
    { icon: Activity, label: "Anomaly Rate", value: `${stats.anomaly_rate ?? 0}%`, color: "text-orange" },
  ];

  const userName = user?.full_name || user?.email || '';
  const userAvatar = user?.avatar_url || null;
  const latestHighRisk = intelligence.latest_high_risk;
  const chartColors = ["#24606B", "#ff4d4d", "#2ecc71", "#e67e22", "#8e44ad", "#3498db"];

  return (
    <div className="dashboard-layout">
      {mobileMenuOpen && (
        <div className="dashboard-mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="dashboard-mobile-menu" onClick={(event) => event.stopPropagation()}>
            <div className="dashboard-mobile-menu-header">
              <span>SecureVision AI</span>
              <button className="dashboard-mobile-menu-close" onClick={() => setMobileMenuOpen(false)}>
                <X size={22} />
              </button>
            </div>
            <nav className="dashboard-mobile-nav">
              <div className="dashboard-mobile-nav-item active" onClick={() => setMobileMenuOpen(false)}>
                <LayoutDashboard size={20} /> Dashboard
              </div>
              <div className="dashboard-mobile-nav-item" onClick={() => { navigate('/upload'); setMobileMenuOpen(false); }}>
                <Upload size={20} /> Upload
              </div>
              <div className="dashboard-mobile-nav-item" onClick={() => { navigate('/chat'); setMobileMenuOpen(false); }}>
                <MessageSquare size={20} /> AI Assistant
              </div>
              <div className="dashboard-mobile-nav-item" onClick={() => { navigate('/training'); setMobileMenuOpen(false); }}>
                <BookOpen size={20} /> Training Module
              </div>
              <div className="dashboard-mobile-nav-item" onClick={() => { navigate('/reports'); setMobileMenuOpen(false); }}>
                <Activity size={20} /> Reports
              </div>
              <div className="dashboard-mobile-nav-item" onClick={() => { navigate('/settings'); setMobileMenuOpen(false); }}>
                <Settings size={20} /> Settings
              </div>
              <div className="dashboard-mobile-nav-item logout" onClick={() => { navigate('/logout'); setMobileMenuOpen(false); }}>
                <LogOut size={20} /> Log Out
              </div>
            </nav>
          </div>
        </div>
      )}

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
          <button className="dashboard-mobile-menu-btn" onClick={() => setMobileMenuOpen(true)}>
            <Menu size={22} />
          </button>

          <div className="header-actions">
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
                {loadingStats ? (
                  <div className="chart-loading">Loading trend...</div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={trendData}>
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
                )}
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
                    <div
                      key={item.id || i}
                      className="activity-item"
                      onClick={() => navigate(`/reports/${item.id}`)}
                    >
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
              {activity.length > 0 && (
                <button
                  onClick={() => navigate("/reports")}
                  className="view-all-btn"
                >
                  View All Reports
                </button>
              )}
            </div>
          </div>

          <div className="intelligence-grid">
            <div className="intel-card intel-card-large">
              <div className="card-header">
                <h3 className="card-title">
                  <AlertTriangle size={16} className="text-red" />
                  Threat Class Distribution
                </h3>
              </div>
              <div className="intel-chart">
                {intelligence.threat_distribution.length === 0 ? (
                  <div className="chart-empty">No threat data available</div>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={intelligence.threat_distribution}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="class_name" tick={{ fontSize: 10, fill: "#777" }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#777" }} />
                      <Tooltip />
                      <Bar dataKey="count" name="Reports" fill="#24606B" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="intel-card">
              <div className="card-header">
                <h3 className="card-title">
                  <Shield size={16} className="text-teal" />
                  Confidence Quality
                </h3>
              </div>
              <div className="confidence-summary">
                <span>Average Confidence</span>
                <strong>{intelligence.avg_confidence}%</strong>
              </div>
              <div className="intel-chart small">
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie
                      data={intelligence.confidence_distribution}
                      dataKey="count"
                      nameKey="bucket"
                      innerRadius={42}
                      outerRadius={70}
                      paddingAngle={3}
                    >
                      {intelligence.confidence_distribution.map((entry, index) => (
                        <Cell key={entry.bucket} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="ops-grid">
            <div className="ops-card high-risk-card">
              <p className="ops-label">Latest High-Risk Event</p>
              {latestHighRisk ? (
                <>
                  <h3>{latestHighRisk.top_class}</h3>
                  <p className="ops-file">{latestHighRisk.filename}</p>
                  <div className="ops-metrics">
                    <span>Risk {latestHighRisk.risk_score}%</span>
                    <span>{(latestHighRisk.confidence * 100).toFixed(1)}% confidence</span>
                  </div>
                </>
              ) : (
                <p className="ops-empty">No abnormal events detected</p>
              )}
            </div>

            <div className="ops-card">
              <p className="ops-label">Severity Queue</p>
              <div className="severity-list">
                {intelligence.severity_queue.map((item) => (
                  <div key={item.severity} className={`severity-row ${item.severity.toLowerCase()}`}>
                    <span>{item.severity}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="ops-card">
              <p className="ops-label">LLM Report Coverage</p>
              <h3>{intelligence.llm_coverage}%</h3>
              <p className="ops-file">
                {intelligence.llm_generated} of {intelligence.total_reports} reports explained
              </p>
            </div>

            <div className="ops-card">
              <p className="ops-label">Footage Processed</p>
              <h3>{intelligence.total_footage_minutes} min</h3>
              <p className="ops-file">Total analyzed video duration</p>
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
