import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Upload, 
  BookOpen, 
  Settings, 
  LogOut, 
  CheckCircle,
  XCircle,
  ArrowLeft,
  ArrowRight,
  HelpCircle,
  MessageSquare,
  RefreshCw,
  Menu,
  X
} from 'lucide-react';
import './Training.css';
import { useUser } from '../../context/UserContext';

const API_BASE = '/api/v1';

function authHeaders() {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const Training = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  
  // Session state
  const [scenarios, setScenarios] = useState([]);
  const [currentScenarioIndex, setCurrentScenarioIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0); // Which question we're on (0, 1, 2)
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [questionResult, setQuestionResult] = useState(null);
  const [scenarioComplete, setScenarioComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Progress stats
  const [progress, setProgress] = useState({
    total_attempts: 0,
    correct_attempts: 0,
    accuracy: 0,
  });
  
  // Get user_id from authenticated user or fallback
  const userId = user?.email || user?.id || localStorage.getItem('training_user_id') || 'anonymous';
  
  useEffect(() => {
    if (user?.email || user?.id) {
      localStorage.setItem('training_user_id', userId);
    }
  }, [user, userId]);

  const currentScenario = scenarios[currentScenarioIndex] || null;

  const fetchSession = async (limit = 3) => {
    setLoading(true);
    try {
      const url = `${API_BASE}/training/session?limit=${limit}${userId ? `&user_id=${encodeURIComponent(userId)}` : ''}`;
      const res = await fetch(url, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setScenarios(data.scenarios || []);
        setCurrentScenarioIndex(0);
        setCurrentQuestionIndex(0);
        resetQuestionState();
      }
    } catch (err) {
      console.error('Failed to fetch session:', err);
    }
    setLoading(false);
  };

  const resetQuestionState = () => {
    setSelectedAnswer(null);
    setIsSubmitted(false);
    setQuestionResult(null);
    setScenarioComplete(false);
  };

  const fetchProgress = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_BASE}/training/progress?user_id=${encodeURIComponent(userId)}`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setProgress({
          total_attempts: data.total_attempts || 0,
          correct_attempts: data.correct_attempts || 0,
          accuracy: data.accuracy || 0,
        });
      }
    } catch (err) {
      console.error('Failed to fetch progress:', err);
    }
  };

  useEffect(() => {
    fetchSession(3);
    fetchProgress();
  }, []);

  // Reset question state when scenario or question index changes
  useEffect(() => {
    resetQuestionState();
  }, [currentScenarioIndex, currentQuestionIndex, scenarios]);

  const handleOptionSelect = (option) => {
    if (isSubmitted) return;
    setSelectedAnswer(option);
  };

  const handleSubmit = async () => {
    if (!selectedAnswer || !currentScenario) return;

    const currentQuestion = currentScenario.questions[currentQuestionIndex];
    const isCorrect = selectedAnswer === currentQuestion.correct_answer;
    
    // Record to backend (only for first question of scenario)
    try {
      if (currentQuestionIndex === 0) {
        await fetch(`${API_BASE}/training/answer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(),
          },
          body: JSON.stringify({
            user_id: userId,
            scenario_id: currentScenario.id,
            selected_label: selectedAnswer,
          }),
        });
        fetchProgress();
      }
    } catch (err) {
      console.error('Failed to record answer:', err);
    }

    setIsSubmitted(true);
    setQuestionResult({
      isCorrect,
      message: isCorrect 
        ? 'Correct!' 
        : `Incorrect. The correct answer was: ${currentQuestion.correct_answer}`
    });
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < currentScenario.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      // All questions answered for this scenario
      setScenarioComplete(true);
    }
  };

  const handleNextScenario = () => {
    if (currentScenarioIndex < scenarios.length - 1) {
      setCurrentScenarioIndex(prev => prev + 1);
      setCurrentQuestionIndex(0);
    }
  };

  const handleNext = () => {
    if (currentScenarioIndex < scenarios.length - 1) {
      setCurrentScenarioIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentScenarioIndex > 0) {
      setCurrentScenarioIndex(prev => prev - 1);
    }
  };

  const handleNewSession = () => {
    fetchSession(3);
  };

  const getVideoUrl = (filename) => {
    return `/training-videos/${filename}`;
  };

  const currentQuestion = currentScenario?.questions?.[currentQuestionIndex];
  const questionNumber = currentQuestionIndex + 1;
  const totalQuestions = currentScenario?.questions?.length || 0;

  if (loading && scenarios.length === 0) {
    return (
      <div className="training-layout">
        <aside className="sidebar">
          <div className="sidebar-logo" onClick={() => navigate('/dashboard')}>
            <div className="logo-square"></div>
            <span>SecureVision AI</span>
          </div>
        </aside>
        <main className="training-main">
          <div className="loading-state">Loading training scenarios...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="training-layout">
      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-menu" onClick={e => e.stopPropagation()}>
            <div className="mobile-menu-header">
              <span>Menu</span>
              <button className="mobile-menu-close" onClick={() => setMobileMenuOpen(false)}>
                <X size={24} />
              </button>
            </div>
            <nav className="mobile-nav">
              <div className="mobile-nav-item" onClick={() => { navigate('/dashboard'); setMobileMenuOpen(false); }}>
                <LayoutDashboard size={20} /> Dashboard
              </div>
              <div className="mobile-nav-item" onClick={() => { navigate('/upload'); setMobileMenuOpen(false); }}>
                <Upload size={20} /> Upload
              </div>
              <div className="mobile-nav-item" onClick={() => { navigate('/chat'); setMobileMenuOpen(false); }}>
                <MessageSquare size={20} /> AI Assistant
              </div>
              <div className="mobile-nav-item active" onClick={() => setMobileMenuOpen(false)}>
                <BookOpen size={20} /> Training Module
              </div>
              <div className="mobile-nav-item" onClick={() => { navigate('/settings'); setMobileMenuOpen(false); }}>
                <Settings size={20} /> Settings
              </div>
              <div className="mobile-nav-item" onClick={() => { navigate('/logout'); setMobileMenuOpen(false); }}>
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
        {/* Mobile Header */}
        <div className="mobile-header">
          <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(true)}>
            <Menu size={24} />
          </button>
          <span className="mobile-title">Training</span>
          <div className="mobile-spacer"></div>
        </div>

        <header className="training-header">
          <div className="header-text">
            <h1>Training Module</h1>
            <p>Learn to identify and respond to security events</p>
          </div>
          <div className="progress-stats">
            <div className="stat-item">
              <p className="stat-label">Completed</p>
              <p className="stat-value">{progress.correct_attempts} / {progress.total_attempts}</p>
            </div>
            <div className="stat-item">
              <p className="stat-label">Accuracy</p>
              <p className="stat-value">{Math.round(progress.accuracy)}%</p>
            </div>
            <button className="new-session-btn" onClick={handleNewSession}>
              <RefreshCw size={16} /> New Session
            </button>
          </div>
        </header>

        {currentScenario ? (
          <div className="training-content-grid">
            {/* Left Section: Video Scenario */}
            <section className="video-section">
              <div className="video-card">
                <div className="video-player-wrapper">
                  <video 
                    key={currentScenario.id}
                    controls 
                    poster="/assets/video-placeholder.png"
                    style={{ width: '100%', maxHeight: '400px' }}
                  >
                    <source src={getVideoUrl(currentScenario.video_filename)} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                </div>
                <div className="video-info">
                  <h2>{currentScenario.title}</h2>
                  <p>{currentScenario.description}</p>
                </div>
              </div>
            </section>

            {/* Right Section: Single Question at a time */}
            <section className="quiz-section">
              <div className="quiz-card">
                <div className="assessment-header">
                  <h3><HelpCircle size={18} /> Assessment</h3>
                  <div className="question-counter">
                    Question {questionNumber} of {totalQuestions}
                  </div>
                </div>

                {currentQuestion && !scenarioComplete && (
                  <div className="quiz-question single">
                    <span className="question-label">
                      {currentQuestion.question_text}
                    </span>
                    <div className="options-group">
                      {currentQuestion.options.map(option => (
                        <div 
                          key={option}
                          className={`option-item ${selectedAnswer === option ? 'selected' : ''} ${isSubmitted ? 'disabled' : ''}`}
                          onClick={() => handleOptionSelect(option)}
                        >
                          <div className="option-item-content">
                            <div className="option-radio"></div>
                            <span className="option-text">{option}</span>
                          </div>
                          <CheckCircle size={20} className="option-check" />
                        </div>
                      ))}
                    </div>

                    {!isSubmitted ? (
                      <button 
                        className="submit-btn" 
                        onClick={handleSubmit}
                        disabled={!selectedAnswer}
                      >
                        Submit Answer
                      </button>
                    ) : (
                      <div className="feedback-section">
                        <div className={`result-banner ${questionResult?.isCorrect ? 'correct' : 'incorrect'}`}>
                          {questionResult?.isCorrect ? <CheckCircle size={20} /> : <XCircle size={20} />}
                          <span>{questionResult?.message}</span>
                        </div>
                        <button 
                          className="submit-btn next-btn" 
                          onClick={handleNextQuestion}
                          style={{ marginTop: '1rem' }}
                        >
                          {currentQuestionIndex < totalQuestions - 1 ? 'Next Question →' : 'Finish Scenario →'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {scenarioComplete && (
                  <div className="scenario-complete">
                    <div className="complete-banner">
                      <CheckCircle size={24} />
                      <span>Scenario Complete! All {totalQuestions} questions answered.</span>
                    </div>
                    {currentScenarioIndex < scenarios.length - 1 && (
                      <button 
                        className="submit-btn next-scenario-btn" 
                        onClick={handleNextScenario}
                        style={{ marginTop: '1rem' }}
                      >
                        Next Scenario →
                      </button>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>
        ) : (
          <div className="no-scenarios">
            <p>No training scenarios available. Try starting a new session.</p>
            <button className="submit-btn" onClick={handleNewSession}>
              <RefreshCw size={16} /> Start New Session
            </button>
          </div>
        )}

        {scenarios.length > 0 && (
          <footer className="training-footer">
            <div className="scenario-counter">
              Scenario {currentScenarioIndex + 1} of {scenarios.length}
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
                disabled={currentScenarioIndex === scenarios.length - 1}
              >
                Next <ArrowRight size={18} />
              </button>
            </div>
          </footer>
        )}
      </main>
    </div>
  );
};

export default Training;
