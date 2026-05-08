import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import {
  Activity,
  ArrowLeft,
  BookOpen,
  Clock,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Settings,
  Shield,
  Upload,
  Video,
  X,
} from "lucide-react";
import "./Reports.css";

const Reports = () => {
  const navigate = useNavigate();
  const { reportId } = useParams();
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const fetchReports = async () => {
      const token = localStorage.getItem("access_token");
      if (!token) {
        navigate("/login");
        return;
      }

      try {
        setLoading(true);
        setError("");

        const endpoint = reportId
          ? `/api/v1/users/me/reports/${reportId}`
          : "/api/v1/users/me/reports";

        const response = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data?.detail || "Unable to load reports");
        }

        const data = await response.json();
        if (reportId) {
          setSelectedReport(data);
          setReports([]);
        } else {
          setReports(Array.isArray(data) ? data : []);
          setSelectedReport(null);
        }
      } catch (err) {
        setError(err.message || "Unable to load reports");
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [navigate, reportId]);

  const formatClass = (value) => {
    if (!value) return "Unknown";
    return value === "NormalVideosforEventRecognition" ? "Normal" : value;
  };

  const formatConfidence = (value) => {
    if (value === null || value === undefined) return "N/A";
    return `${(Number(value) * 100).toFixed(1)}%`;
  };

  const formatDuration = (value) => {
    if (value === null || value === undefined) return "N/A";
    return `${Number(value).toFixed(2)}s`;
  };

  const renderReportList = () => {
    if (reports.length === 0) {
      return (
        <div className="reports-empty">
          <FileText size={42} />
          <h2>No reports found</h2>
          <p>Upload and analyze a video to generate your first report.</p>
          <button onClick={() => navigate("/upload")}>Upload Video</button>
        </div>
      );
    }

    return (
      <div className="reports-grid">
        {reports.map((report) => (
          <button
            key={report.id}
            className="report-card"
            onClick={() => navigate(`/reports/${report.id}`)}
          >
            <div className="report-card-top">
              <div className="report-icon-wrap">
                <Video size={18} />
              </div>
              <span className={`report-status ${report.status}`}>{report.status}</span>
            </div>
            <h3>{report.filename}</h3>
            <div className="report-meta-row">
              <span>{formatClass(report.top_class)}</span>
              <span>{formatConfidence(report.confidence)}</span>
            </div>
            <div className="report-date">
              <Clock size={14} />
              {new Date(report.created_at).toLocaleString()}
            </div>
          </button>
        ))}
      </div>
    );
  };

  const renderReportDetail = () => {
    if (!selectedReport) return null;

    return (
      <div className="report-detail-card">
        <button className="back-button" onClick={() => navigate("/reports")}>
          <ArrowLeft size={16} /> Back to all reports
        </button>

        <div className="report-detail-header">
          <div>
            <p className="eyebrow">Analysis Report</p>
            <h2>{selectedReport.filename}</h2>
            <p className="detail-date">{new Date(selectedReport.created_at).toLocaleString()}</p>
          </div>
          <span className={`report-status ${selectedReport.status}`}>{selectedReport.status}</span>
        </div>

        <div className="detail-stats-grid">
          <div>
            <span>Classification</span>
            <strong>{formatClass(selectedReport.top_class)}</strong>
          </div>
          <div>
            <span>Confidence</span>
            <strong>{formatConfidence(selectedReport.confidence)}</strong>
          </div>
          <div>
            <span>Duration</span>
            <strong>{formatDuration(selectedReport.duration_sec)}</strong>
          </div>
        </div>

        <div className="markdown-report">
          <h3>LLM Generated Report</h3>
          {selectedReport.llm_report ? (
            <ReactMarkdown>{selectedReport.llm_report}</ReactMarkdown>
          ) : (
            <p>No LLM report was generated for this analysis.</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="reports-layout">
      {mobileMenuOpen && (
        <div className="reports-mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="reports-mobile-menu" onClick={(event) => event.stopPropagation()}>
            <div className="reports-mobile-menu-header">
              <span>SecureVision AI</span>
              <button className="reports-mobile-menu-close" onClick={() => setMobileMenuOpen(false)}>
                <X size={22} />
              </button>
            </div>
            <nav className="reports-mobile-nav">
              <div className="reports-mobile-nav-item" onClick={() => { navigate("/dashboard"); setMobileMenuOpen(false); }}><LayoutDashboard size={20} /> Dashboard</div>
              <div className="reports-mobile-nav-item" onClick={() => { navigate("/upload"); setMobileMenuOpen(false); }}><Upload size={20} /> Upload</div>
              <div className="reports-mobile-nav-item" onClick={() => { navigate("/chat"); setMobileMenuOpen(false); }}><MessageSquare size={20} /> AI Assistant</div>
              <div className="reports-mobile-nav-item" onClick={() => { navigate("/training"); setMobileMenuOpen(false); }}><BookOpen size={20} /> Training Module</div>
              <div className="reports-mobile-nav-item active" onClick={() => setMobileMenuOpen(false)}><FileText size={20} /> Reports</div>
              <div className="reports-mobile-nav-item" onClick={() => { navigate("/settings"); setMobileMenuOpen(false); }}><Settings size={20} /> Settings</div>
              <div className="reports-mobile-nav-item logout" onClick={() => { navigate("/logout"); setMobileMenuOpen(false); }}><LogOut size={20} /> Log Out</div>
            </nav>
          </div>
        </div>
      )}
      <aside className="sidebar">
        <div className="sidebar-logo" onClick={() => navigate("/dashboard")}>
          <div className="logo-square"></div>
          <span>SecureVision AI</span>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-item" onClick={() => navigate("/dashboard")}><LayoutDashboard size={20} /> Dashboard</div>
          <div className="nav-item" onClick={() => navigate("/upload")}><Upload size={20} /> Upload</div>
          <div className="nav-item" onClick={() => navigate("/chat")}><MessageSquare size={20} /> AI Assistant</div>
          <div className="nav-item" onClick={() => navigate("/training")}><BookOpen size={20} /> Training Module</div>
          <div className="nav-item active"><FileText size={20} /> Reports</div>
          <div className="nav-item" onClick={() => navigate("/settings")}><Settings size={20} /> Settings</div>
          <div className="nav-item logout-nav" onClick={() => navigate("/logout")}><LogOut size={20} /> Log Out</div>
        </nav>
      </aside>

      <main className="reports-main">
        <header className="reports-header">
          <button className="reports-mobile-menu-btn" onClick={() => setMobileMenuOpen(true)}>
            <Menu size={22} />
          </button>
          <div>
            <h1>{reportId ? "Report Details" : "All Reports"}</h1>
            <p>Review generated video anomaly analysis reports.</p>
          </div>
          <div className="reports-header-icon">
            <Shield size={22} />
          </div>
        </header>

        {loading ? (
          <div className="reports-loading">Loading reports...</div>
        ) : error ? (
          <div className="reports-error">{error}</div>
        ) : reportId ? (
          renderReportDetail()
        ) : (
          renderReportList()
        )}
      </main>
    </div>
  );
};

export default Reports;
