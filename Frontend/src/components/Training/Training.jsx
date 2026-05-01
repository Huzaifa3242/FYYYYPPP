import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Upload, 
  FileText, 
  BookOpen, 
  Phone, 
  Settings, 
  LogOut, 
  ChevronRight,
  Play,
  CheckCircle,
  XCircle,
  ArrowLeft,
  ArrowRight,
  HelpCircle,
  AlertCircle,
  MessageSquare
} from 'lucide-react';
import './Training.css';
import videoData from '../../../videos/info.json';

const Training = () => {
  const navigate = useNavigate();
  const [currentScenarioIndex, setCurrentScenarioIndex] = useState(0);
  const [selectedNormality, setSelectedNormality] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [stats, setStats] = useState({ completed: 0, total: videoData.length });

  const currentScenario = videoData[currentScenarioIndex];

  useEffect(() => {
    // Reset state when scenario changes
    setSelectedNormality(null);
    setSelectedType(null);
    setIsSubmitted(false);
    setIsCorrect(false);
  }, [currentScenarioIndex]);

  const handleSubmit = () => {
    if (!selectedNormality || (selectedNormality === 'abnormal' && !selectedType)) return;

    const correctNormality = currentScenario.normality;
    const correctType = currentScenario.correctLabel;

    const isNormalityCorrect = selectedNormality === correctNormality;
    const isTypeCorrect = selectedNormality === 'normal' || selectedType === correctType;

    const correct = isNormalityCorrect && isTypeCorrect;
    setIsCorrect(correct);
    setIsSubmitted(true);
    
    if (correct) {
      setStats(prev => ({ ...prev, completed: Math.min(prev.completed + 1, prev.total) }));
    }
  };

  const handleNext = () => {
    if (currentScenarioIndex < videoData.length - 1) {
      setCurrentScenarioIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentScenarioIndex > 0) {
      setCurrentScenarioIndex(prev => prev - 1);
    }
  };

  const incidentTypes = [
    "Arrest", "Robbery", "Fighting", "Burglary", "Explosion", "Vandalism"
  ];

  return (
    <div className="training-layout">
      {/* Sidebar (Consistent with Dashboard) */}
      <aside className="sidebar">
        <div className="sidebar-logo" onClick={() => navigate('/dashboard')}>
          <div className="logo-square"></div>
          <span>SecureVision AI</span>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-item" onClick={() => navigate('/dashboard')}>
            <LayoutDashboard size={20} /> Dashboard
          </div>
          <div className="nav-item" onClick={() => navigate('/upload')}>
            <Upload size={20} /> Upload
          </div>

          <div className="nav-item" onClick={() => navigate('/chat')}>
            <MessageSquare size={20} /> AI Assistant
          </div>
          <div className="nav-item active">
            <BookOpen size={20} /> Training Module
          </div>

          <div className="nav-item" onClick={() => navigate('/settings')}>
            <Settings size={20} /> Settings
          </div>
          <div className="nav-item logout-nav" onClick={() => navigate('/logout')}>
            <LogOut size={20} /> Log Out
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="training-main">
        <header className="training-header">
          <div className="header-text">
            <h1>Training Module</h1>
            <p>Learn to identify abnormal events from surveillance footage</p>
          </div>
          <div className="progress-stats">
            <div className="stat-item">
              <p className="stat-label">Completed</p>
              <p className="stat-value">{stats.completed} / {stats.total}</p>
            </div>
            <div className="stat-item">
              <p className="stat-label">Progress</p>
              <p className="stat-value">{Math.round((stats.completed / stats.total) * 100)}%</p>
            </div>
          </div>
        </header>

        <div className="training-content-grid">
          {/* Left Section: Video Scenario */}
          <section className="video-section">
            <div className="video-card">
              <div className="video-player-wrapper">
                <video 
                  key={currentScenario.videoUrl} 
                  controls 
                  poster="/assets/video-placeholder.png"
                >
                  <source src={currentScenario.videoUrl} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>
              <div className="video-info">
                <h2>{isSubmitted ? currentScenario.title : `Scenario Analysis`}</h2>
                <p>
                  {isSubmitted 
                    ? currentScenario.description 
                    : "Please watch the surveillance footage carefully and identify the nature of the activity using the assessment panel."}
                </p>
              </div>
            </div>
          </section>

          {/* Right Section: Quiz */}
          <section className="quiz-section">
            <div className="quiz-card">
              <h3><HelpCircle size={20} className="text-teal" /> Assessment</h3>
              
              <div className="quiz-question">
                <span className="question-label">1. Is this activity Normal or Abnormal?</span>
                <div className="options-group">
                  {['normal', 'abnormal'].map(option => (
                    <div 
                      key={option}
                      className={`option-item ${selectedNormality === option ? 'selected' : ''} ${isSubmitted ? 'disabled' : ''}`}
                      onClick={() => !isSubmitted && setSelectedNormality(option)}
                    >
                      <div className="option-radio"></div>
                      <span className="option-text">{option.charAt(0).toUpperCase() + option.slice(1)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedNormality === 'abnormal' && (
                <div className="quiz-question">
                  <span className="question-label">2. If abnormal, what type best matches the scene?</span>
                  <div className="options-group">
                    {incidentTypes.slice(0, 4).map(type => (
                      <div 
                        key={type}
                        className={`option-item ${selectedType === type ? 'selected' : ''} ${isSubmitted ? 'disabled' : ''}`}
                        onClick={() => !isSubmitted && setSelectedType(type)}
                      >
                        <div className="option-radio"></div>
                        <span className="option-text">{type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!isSubmitted ? (
                <button 
                  className="submit-btn" 
                  onClick={handleSubmit}
                  disabled={!selectedNormality || (selectedNormality === 'abnormal' && !selectedType)}
                >
                  Submit Answer
                </button>
              ) : (
                <div className="feedback-section">
                  <div className={`result-banner ${isCorrect ? 'correct' : 'incorrect'}`}>
                    {isCorrect ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                    <span>{isCorrect ? 'Correct Answer!' : 'Incorrect Identification'}</span>
                  </div>
                  
                  <div className="explanation-card">
                    <h4>Learning Explanation</h4>
                    <p>{currentScenario.explanation}</p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        <footer className="training-footer">
          <div className="scenario-counter">
            Scenario {currentScenarioIndex + 1} of {videoData.length}
          </div>
          <div className="nav-buttons">
            <button 
              className="nav-btn" 
              onClick={handlePrevious} 
              disabled={currentScenarioIndex === 0}
            >
              <ArrowLeft size={18} /> Previous
            </button>
            <button 
              className="nav-btn" 
              onClick={handleNext} 
              disabled={currentScenarioIndex === videoData.length - 1}
            >
              Next <ArrowRight size={18} />
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default Training;
