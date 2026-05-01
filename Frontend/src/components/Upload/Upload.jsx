import React, { useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  FileText, 
  Phone, 
  Mail, 
  MapPin 
} from 'lucide-react';
import './Upload.css';

const Upload = () => {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [result, setResult] = useState(null);
  const [report, setReport] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  const addFiles = (newFiles) => {
    const valid = newFiles.filter(
      (file) => file.type.startsWith('video/') || file.name.match(/\.(mp4|avi|mov|mkv)$/i),
    );
    if (!valid.length) {
      setErrorMessage('Unsupported file format. Please upload a video.');
      return;
    }

    setErrorMessage('');
    setFiles((prev) => [
      ...prev,
      ...valid.map((file) => ({
        file,
        status: 'idle',
        progress: 0,
      })),
    ]);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    if (event.dataTransfer.files) {
      addFiles(Array.from(event.dataTransfer.files));
    }
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (index === 0) {
      setResult(null);
      setReport('');
    }
  };

  const analyzeVideo = (file, onProgress) => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/v1/predict/video');
    
    const token = localStorage.getItem('access_token');
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const pct = Math.round((event.loaded / event.total) * 100);
        onProgress(pct);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (error) {
          reject(new Error('Invalid server response'));
        }
      } else {
        try {
          const data = JSON.parse(xhr.responseText);
          reject(new Error(data?.detail || 'Analysis failed'));
        } catch (error) {
          reject(new Error('Analysis failed'));
        }
      }
    };
    xhr.onerror = () => reject(new Error('Upload failed'));

    const formData = new FormData();
    formData.append('file', file);
    xhr.send(formData);
  });

  const handleAnalyze = async () => {
    if (!files.length || analyzing) return;
    setAnalyzing(true);
    setErrorMessage('');
    setResult(null);
    setReport('');

    setFiles((prev) => prev.map((item, i) => (
      i === 0 ? { ...item, status: 'uploading', progress: 0 } : item
    )));

    try {
      const response = await analyzeVideo(files[0].file, (pct) => {
        setFiles((prev) => prev.map((item, i) => (
          i === 0
            ? {
              ...item,
              progress: pct,
              status: pct < 100 ? 'uploading' : 'analyzing',
            }
            : item
        )));
      });

      setResult(response);
      setReport(response?.llm_report || '');
      setFiles((prev) => prev.map((item, i) => (
        i === 0 ? { ...item, status: 'done', progress: 100 } : item
      )));
    } catch (error) {
      setErrorMessage(error?.message || 'Analysis failed');
      setFiles((prev) => prev.map((item, i) => (
        i === 0 ? { ...item, status: 'error' } : item
      )));
    }

    setAnalyzing(false);
  };

  const segments = result?.chunks?.flatMap((chunk) => chunk.segments || []) || [];

  return (
    <div className="upload-page">
      {/* Navigation */}
      <nav className="top-nav">
        <div className="logo" onClick={() => navigate('/dashboard')}>
          <div className="logo-icon"></div>
          <span>SecureVision AI</span>
        </div>
        <div className="nav-links">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/upload" className="active">Upload</Link>
          <Link to="/chat">Chat</Link>
          <Link to="/training">Training</Link>
        </div>
      </nav>

      {/* Main Content Card */}
      <div className="upload-container">
        <div className="upload-card">
          <div
            className="drop-zone"
            onDrop={handleDrop}
            onDragOver={(event) => event.preventDefault()}
            onClick={() => inputRef.current?.click()}
          >
            <p>Drag and Drop To upload files</p>
            <p>or</p>
            <p className="click-text">Click To Select Files</p>
            <p className="helper-text">Supports .mp4, .avi, .mov, .mkv</p>
            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,video/avi,video/quicktime,video/x-matroska,.mp4,.avi,.mov,.mkv"
              multiple
              onChange={(event) => event.target.files && addFiles(Array.from(event.target.files))}
              className="file-input"
            />
          </div>

          {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

          <div className="action-buttons">
            <button className="analyze-btn" onClick={handleAnalyze} disabled={analyzing || !files.length}>
              {analyzing ? 'Analyzing...' : 'Click to Analyze'}
            </button>
          </div>

          <div className="file-list">
            {files.map((item, index) => (
              <div key={index} className={`file-item ${item.status !== 'idle' ? 'active-item' : ''}`}>
                <div className="file-info">
                  <FileText size={20} />
                  <span className="file-name">{item.file.name}</span>
                </div>
                <div className="progress-container">
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${item.progress}%` }}></div>
                  </div>
                  <div className="progress-status">
                    <span>
                      {item.status === 'idle' && 'Ready'}
                      {item.status === 'uploading' && 'Uploading'}
                      {item.status === 'analyzing' && 'Analyzing'}
                      {item.status === 'done' && 'Complete'}
                      {item.status === 'error' && 'Error'}
                    </span>
                    <span>{Math.round(item.progress)}%</span>
                  </div>
                </div>
                {item.status !== 'analyzing' && (
                  <button className="remove-btn" onClick={() => removeFile(index)}>
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          {result && (
            <div className="results">
              <div className="result-card">
                <h3>Analysis Result</h3>
                <div className="result-grid">
                  <div>
                    <p className="result-label">Classification</p>
                    <p className="result-value">
                      {result?.overall_summary?.top_class === "NormalVideosforEventRecognition" 
                        ? "Normal" 
                        : result?.overall_summary?.top_class?.replace(/_/g, ' ') || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="result-label">Confidence</p>
                    <p className="result-value">
                      {result?.overall_summary?.confidence != null
                        ? `${(result.overall_summary.confidence * 100).toFixed(1)}%`
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="result-label">Status</p>
                    <span
                      className={`status-pill ${
                        result?.overall_summary?.status === 'abnormal' ? 'status-bad' : 'status-good'
                      }`}
                    >
                      {result?.overall_summary?.status || 'unknown'}
                    </span>
                  </div>
                </div>
              </div>

              {segments.length > 0 && (
                <div className="result-card">
                  <h3>Anomaly Segments</h3>
                  <div className="segment-list">
                    {segments.map((segment, i) => (
                      <div key={i} className="segment-item">
                        <span className="segment-time">
                          {segment.start_time_sec.toFixed(1)}s - {segment.end_time_sec.toFixed(1)}s
                        </span>
                        <span
                          className={`segment-label ${
                            segment.class_name.includes('Normal') ? 'segment-good' : 'segment-bad'
                          }`}
                        >
                          {segment.class_name === "NormalVideosforEventRecognition" 
                            ? "Normal" 
                            : segment.class_name.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <span className="segment-confidence">
                          {(segment.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="result-card">
                <h3>Expert Security Report</h3>
                {report ? (
                  <p className="report-text">{report}</p>
                ) : (
                  <p className="report-empty">No anomaly detected — report not generated.</p>
                )}
              </div>
            </div>
          )}

          <div className="ai-ask-container">
            <button className="ask-ai-btn" onClick={() => navigate('/chat')}>Ask from AI</button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-top">
          <div className="newsletter">
            <input type="email" placeholder="Email" className="footer-input" />
            <input type="text" placeholder="Name" className="footer-input" />
            <button className="subscribe-btn">Subscribe</button>
          </div>
        </div>

        <div className="footer-main">
          <div className="footer-brand">
            <h2 className="footer-logo">SECUREVISION AI</h2>
            <p className="footer-tagline">SHAPING TECHNOLOGY FOR THE FUTURE</p>
            <div className="social-icons">
              {/* Social icons removed due to library version issues */}
            </div>
          </div>

          <div className="footer-links">
            <h3>Features</h3>
            <ul>
              <li>Uploads</li>
              <li>Summary Cards</li>
              <li>Module</li>
              <li>Quiz</li>
            </ul>
          </div>

          <div className="footer-links">
            <h3>Applications</h3>
            <ul>
              <li>Safety</li>
              <li>Protection</li>
              <li>AI Integrated</li>
              <li>Language Expalantaion</li>
              <li>Content Creation</li>
            </ul>
          </div>

          <div className="footer-contact">
            <h3>Contact Us</h3>
            <ul>
              <li><Phone size={16} /> 051-123-4567</li>
              <li><Mail size={16} /> demo@gmail.com</li>
              <li><MapPin size={16} /> Willowbrook Park - Greenwood</li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>All Copyrights are reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Upload;
