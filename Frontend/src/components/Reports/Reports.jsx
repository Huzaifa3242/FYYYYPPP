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
  ZoomIn,
} from "lucide-react";
import "./Reports.css";

const formatTimelineTime = (value) => `${Math.round(Number(value) || 0)}s`;

const normalizeFramePath = (path) => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("/")) {
    return path;
  }
  return `/${path.replace(/^\/+/, "")}`;
};

const displayKeyframeCaption = (caption) => {
  if (!caption) return "Caption not generated for this keyframe.";
  if (caption.includes("HF_API_TOKEN") || caption.includes("caption service error")) {
    return caption;
  }
  return caption;
};

// Reports detail reads duration_sec and segment_explanations from /api/v1/users/me/reports/{id}; keyframe paths are expected to be backend-served URLs such as /explainability-frames/{file}.
const ExplainabilityTimeline = ({
  durationSec,
  segmentExplanations,
  activeSegmentIndex,
  onActiveSegmentChange,
  selectedKeyframe,
  onSelectedKeyframeChange,
}) => {
  const duration = Math.max(Number(durationSec) || 0, 1);

  if (!Array.isArray(segmentExplanations) || segmentExplanations.length === 0) {
    return (
      <section className="explainability-section">
        <div className="explainability-header">
          <div>
            <p className="eyebrow">Visual evidence</p>
            <h3>Explainability timeline</h3>
          </div>
        </div>
        <p className="explainability-empty">Explainability data is not available for this incident.</p>
      </section>
    );
  }

  const keyframes = segmentExplanations.flatMap((segment, segmentIndex) =>
    (segment.keyframes || []).map((keyframe, keyframeIndex) => ({
      ...keyframe,
      segment,
      segmentIndex,
      keyframeIndex,
      key: `${segmentIndex}-${keyframeIndex}`,
    }))
  );

  return (
    <section className="explainability-section">
      <div className="explainability-header">
        <div>
          <p className="eyebrow">Visual evidence</p>
          <h3>Explainability timeline</h3>
        </div>
        <span>{formatTimelineTime(durationSec)} total</span>
      </div>

      <div className="timeline-axis" aria-label="Explainability timeline">
        <span className="timeline-label start">0s</span>
        <span className="timeline-label end">{formatTimelineTime(durationSec)}</span>
        {segmentExplanations.map((segment, index) => {
          const start = Math.max(0, Number(segment.start_time_sec) || 0);
          const end = Math.max(start, Number(segment.end_time_sec) || start);
          const left = Math.min(100, (start / duration) * 100);
          const width = Math.max(2, Math.min(100 - left, ((end - start) / duration) * 100));

          return (
            <button
              key={`${segment.classname}-${index}`}
              type="button"
              className={`timeline-segment ${activeSegmentIndex === index ? "active" : ""}`}
              style={{ left: `${left}%`, width: `${width}%` }}
              onMouseEnter={() => onActiveSegmentChange(index)}
              onFocus={() => onActiveSegmentChange(index)}
              onMouseLeave={() => onActiveSegmentChange(null)}
              onBlur={() => onActiveSegmentChange(null)}
              title={`${segment.classname} ${formatTimelineTime(start)}-${formatTimelineTime(end)}`}
            >
              <span>{segment.classname}</span>
            </button>
          );
        })}
      </div>

      <div className="keyframe-grid">
        {keyframes.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`keyframe-card ${activeSegmentIndex === item.segmentIndex ? "active" : ""}`}
            onMouseEnter={() => onActiveSegmentChange(item.segmentIndex)}
            onFocus={() => onActiveSegmentChange(item.segmentIndex)}
            onMouseLeave={() => onActiveSegmentChange(null)}
            onBlur={() => onActiveSegmentChange(null)}
            onClick={() => onSelectedKeyframeChange(item)}
          >
            <div className="keyframe-thumb-wrap">
              <img src={normalizeFramePath(item.path)} alt={`Keyframe at ${formatTimelineTime(item.time_sec)}`} />
              <span><ZoomIn size={14} /> {formatTimelineTime(item.time_sec)}</span>
            </div>
            <div className="keyframe-copy">
              <strong>{item.segment.classname}</strong>
              <p>{displayKeyframeCaption(item.caption)}</p>
            </div>
          </button>
        ))}
      </div>

      {selectedKeyframe && (
        <div className="keyframe-detail-panel">
          <div className="keyframe-detail-image">
            <img
              src={normalizeFramePath(selectedKeyframe.path)}
              alt={`Selected keyframe at ${formatTimelineTime(selectedKeyframe.time_sec)}`}
            />
          </div>
          <div className="keyframe-detail-copy">
            <div className="keyframe-detail-top">
              <div>
                <p className="eyebrow">Selected keyframe</p>
                <h4>{selectedKeyframe.segment.classname}</h4>
              </div>
              <button type="button" onClick={() => onSelectedKeyframeChange(null)}>Close</button>
            </div>
            <p>{displayKeyframeCaption(selectedKeyframe.caption)}</p>
            <div className="keyframe-meta-grid">
              <span>Time: <strong>{formatTimelineTime(selectedKeyframe.time_sec)}</strong></span>
              <span>Confidence: <strong>{((Number(selectedKeyframe.segment.confidence) || 0) * 100).toFixed(1)}%</strong></span>
              <span>
                Segment: <strong>{formatTimelineTime(selectedKeyframe.segment.start_time_sec)} - {formatTimelineTime(selectedKeyframe.segment.end_time_sec)}</strong>
              </span>
            </div>
            <div className="ai-explanation-placeholder">
              <h5>AI explanation</h5>
              <p>LLM-based explanation will be added here later.</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

const Reports = () => {
  const navigate = useNavigate();
  const { reportId } = useParams();
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeExplainabilitySegment, setActiveExplainabilitySegment] = useState(null);
  const [selectedExplainabilityKeyframe, setSelectedExplainabilityKeyframe] = useState(null);

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
          setActiveExplainabilitySegment(null);
          setSelectedExplainabilityKeyframe(null);
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
          <div className="report-header-actions">
            <button 
              className="chat-report-btn"
              onClick={() => navigate(`/chat?reportId=${selectedReport.id}`)}
            >
              <MessageSquare size={16} /> Chat about this report
            </button>
            <span className={`report-status ${selectedReport.status}`}>{selectedReport.status}</span>
          </div>
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
          <h3>Security Analysis Report</h3>
          {selectedReport.llm_report ? (
            <ReactMarkdown>{selectedReport.llm_report}</ReactMarkdown>
          ) : (
            <p>No LLM report was generated for this analysis.</p>
          )}
        </div>

        <ExplainabilityTimeline
          durationSec={selectedReport.duration_sec}
          segmentExplanations={selectedReport.segment_explanations}
          activeSegmentIndex={activeExplainabilitySegment}
          onActiveSegmentChange={setActiveExplainabilitySegment}
          selectedKeyframe={selectedExplainabilityKeyframe}
          onSelectedKeyframeChange={setSelectedExplainabilityKeyframe}
        />
      </div>
    );
  };

  return (
    <div className="reports-layout">
      <aside className="sidebar">
        <div className="sidebar-logo" onClick={() => navigate("/dashboard")}>
          <div className="logo-square"></div>
          <span>SecureVision AI</span>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-item" onClick={() => navigate("/dashboard")}><LayoutDashboard size={20} /> Dashboard</div>
          <div className="nav-item" onClick={() => navigate("/upload")}><Upload size={20} /> Upload</div>
          <div className="nav-item" onClick={() => navigate("/chat")}><MessageSquare size={20} /> AI Assistant</div>
          <div className="nav-item active"><FileText size={20} /> Reports</div>
          <div className="nav-item" onClick={() => navigate("/training")}><BookOpen size={20} /> Training Module</div>
          <div className="nav-item" onClick={() => navigate("/settings")}><Settings size={20} /> Settings</div>
          <div className="nav-item logout-nav" onClick={() => navigate("/logout")}><LogOut size={20} /> Log Out</div>
        </nav>
      </aside>

      <main className="reports-main">
        <header className="reports-header">
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
