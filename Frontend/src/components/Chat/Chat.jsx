import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Send, 
  Menu,
  Search,
  Settings,
  HelpCircle,
  Trash2,
  ChevronDown,
  Brain,
  X,
  FileText
} from 'lucide-react';
import './Chat.css';

/**
 * Parse <think>...</think> blocks from model output.
 * Returns { thinking: string | null, response: string }
 */
function parseThinkingTokens(text) {
  if (!text) return { thinking: null, response: '' };

  const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
  const thinkingParts = [];
  let match;

  while ((match = thinkRegex.exec(text)) !== null) {
    thinkingParts.push(match[1].trim());
  }

  // Remove all <think>...</think> blocks from the visible response
  let response = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // Also handle the case where <think> is opened but not yet closed (streaming)
  // e.g. "<think>partial thinking content" with no closing tag yet
  if (/<think>/i.test(response) && !/<\/think>/i.test(response)) {
    const openIdx = response.indexOf('<think>');
    const partialThinking = response.slice(openIdx + 7).trim();
    if (partialThinking) thinkingParts.push(partialThinking);
    response = response.slice(0, openIdx).trim();
  }

  return {
    thinking: thinkingParts.length > 0 ? thinkingParts.join('\n\n') : null,
    response,
  };
}

/** Collapsible thinking block component */
function ThinkingBlock({ content, isStreaming }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!content) return null;

  return (
    <div className={`thinking-block ${isOpen ? 'open' : ''}`}>
      <button
        className="thinking-toggle"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        <Brain size={15} className="thinking-icon" />
        <span className="thinking-label">
          {isStreaming ? 'Thinking…' : 'Thought process'}
        </span>
        <ChevronDown size={14} className={`thinking-chevron ${isOpen ? 'rotated' : ''}`} />
      </button>
      {isOpen && (
        <div className="thinking-content">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

const Chat = () => {
  const API_BASE = '/api/v1';
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isInitial, setIsInitial] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth > 720);
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [contextReportId, setContextReportId] = useState(null);
  const location = useLocation();
  const messagesRef = useRef(null);

  const formatTime = (value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const filteredThreads = threads.filter((thread) => {
    if (!searchQuery.trim()) return true;
    const title = (thread.title || '').toLowerCase();
    const query = searchQuery.trim().toLowerCase();
    return title.includes(query);
  });

  const getAuthHeaders = (includeJson = false) => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      navigate('/login');
      return null;
    }
    return includeJson
      ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      : { Authorization: `Bearer ${token}` };
  };

  const mapApiMessages = (items) => items.map((msg) => ({
    id: msg.id,
    sender: msg.role === 'assistant' ? 'ai' : 'user',
    text: msg.content,
    time: formatTime(msg.created_at),
  }));

  const fetchThreads = async () => {
    const headers = getAuthHeaders();
    if (!headers) return [];
    const response = await fetch(`${API_BASE}/chat/threads`, { headers });
    if (!response.ok) return [];
    return response.json();
  };

  const loadThread = async (threadId) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    const response = await fetch(`${API_BASE}/chat/threads/${threadId}`, { headers });
    if (!response.ok) return;
    const data = await response.json();
    setActiveThreadId(threadId);
    setMessages(mapApiMessages(data.messages || []));
    setIsInitial((data.messages || []).length === 0);
    if (window.innerWidth <= 720) setIsSidebarOpen(false);
  };

  const createThread = async () => {
    const headers = getAuthHeaders(true);
    if (!headers) return null;
    const response = await fetch(`${API_BASE}/chat/threads`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: null }),
    });
    if (!response.ok) return null;
    const thread = await response.json();
    setThreads((prev) => [thread, ...prev]);
    setActiveThreadId(thread.id);
    setMessages([]);
    setIsInitial(true);
    return thread.id;
  };

  const refreshThreads = async () => {
    const list = await fetchThreads();
    setThreads(list);
    return list;
  };

  const handleDeleteThread = async (event, threadId) => {
    event.stopPropagation();
    const headers = getAuthHeaders();
    if (!headers) return;
    await fetch(`${API_BASE}/chat/threads/${threadId}`, { method: 'DELETE', headers });
    const list = await refreshThreads();

    if (threadId === activeThreadId) {
      if (list.length > 0) {
        await loadThread(list[0].id);
      } else {
        setActiveThreadId(null);
        setMessages([]);
        setIsInitial(true);
      }
    }
  };

  const handleNewChat = () => {
    setActiveThreadId(null);
    setMessages([]);
    setIsInitial(true);
    if (window.innerWidth <= 720) setIsSidebarOpen(false);
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    const requestStartedAt = performance.now();
    console.log('[CHAT_TIMING][FE] request_start_ms=0');

    let threadId = activeThreadId;
    if (!threadId) {
      threadId = await createThread();
    }
    if (!threadId) return;

    const headers = getAuthHeaders(true);
    if (!headers) return;

    if (isInitial) setIsInitial(false);

    const userMessage = {
      id: Date.now(),
      text: input,
      sender: 'user',
      time: formatTime(Date.now()),
    };
    const assistantMessageId = Date.now() + 1;
    const assistantMessage = {
      id: assistantMessageId,
      text: '',
      sender: 'ai',
      time: formatTime(Date.now()),
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput('');
    setIsStreaming(true);

    const response = await fetch(`${API_BASE}/chat/threads/${threadId}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        content: userMessage.text,
        report_id: contextReportId 
      }),
    });
    console.log(`[CHAT_TIMING][FE] response_received_ms=${Math.round(performance.now() - requestStartedAt)}`);

    if (!response.ok || !response.body) {
      console.log(`[CHAT_TIMING][FE] stream_end_ms=${Math.round(performance.now() - requestStartedAt)} status=error_no_body`);
      setIsStreaming(false);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let firstChunkLogged = false;

    const appendDelta = (delta) => {
      setMessages((prev) => prev.map((msg) => (
        msg.id === assistantMessageId
          ? { ...msg, text: `${msg.text}${delta}` }
          : msg
      )));
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!firstChunkLogged) {
        firstChunkLogged = true;
        console.log(`[CHAT_TIMING][FE] first_chunk_ms=${Math.round(performance.now() - requestStartedAt)}`);
      }
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      parts.forEach((chunk) => {
        const lines = chunk.split('\n');
        let eventType = 'message';
        let dataLine = '';
        lines.forEach((line) => {
          if (line.startsWith('event:')) {
            eventType = line.replace('event:', '').trim();
          }
          if (line.startsWith('data:')) {
            dataLine = line.replace('data:', '').trim();
          }
        });

        if (!dataLine) return;
        try {
          const payload = JSON.parse(dataLine);
          if (eventType === 'meta') {
            // Diagnostic event from backend (provider + TTFT); useful for latency debugging.
            return;
          }
          if (eventType === 'error') {
            setMessages((prev) => prev.map((msg) => (
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    text: payload.detail || 'Request failed. Please try again.',
                    isStreaming: false,
                  }
                : msg
            )));
            return;
          }
          if (eventType === 'done') {
            setMessages((prev) => prev.map((msg) => (
              msg.id === assistantMessageId
                ? { ...msg, text: payload.content || msg.text, isStreaming: false }
                : msg
            )));
          } else if (payload.delta) {
            appendDelta(payload.delta);
          }
        } catch (error) {
          return;
        }
      });
    }

    console.log(`[CHAT_TIMING][FE] stream_end_ms=${Math.round(performance.now() - requestStartedAt)} status=ok`);
    setIsStreaming(false);
    await refreshThreads();
  };

  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  useEffect(() => {
    const init = async () => {
      const params = new URLSearchParams(location.search);
      const rid = params.get('reportId');
      
      if (rid) {
        // We have a report context: start a fresh chat
        setContextReportId(parseInt(rid, 10));
        setActiveThreadId(null);
        setMessages([]);
        setIsInitial(true);
      }

      const list = await refreshThreads();
      
      // Only auto-load the latest thread if we AREN'T coming from a specific report
      if (list.length > 0 && !rid && !activeThreadId) {
        await loadThread(list[0].id);
      }
    };
    init();
  }, [location.search]);

  useEffect(() => {
    const handleResize = () => {
      setIsSidebarOpen(window.innerWidth > 720);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className={`premium-chat-layout ${isSidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
      {isSidebarOpen && <div className="chat-sidebar-backdrop" onClick={() => setIsSidebarOpen(false)}></div>}
      {/* Premium Sidebar */}
      <aside className="premium-sidebar">
        <div className="sidebar-brand" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
          <div className="logo-square-alt"></div>
          <span>SecureVision AI</span>
        </div>

        <div className="sidebar-content">
          <div className="sidebar-actions">
            <button className="new-chat-action" onClick={handleNewChat}>
              <span className="plus-icon-alt">+</span> New Chat
            </button>
          </div>

          <div className="sidebar-main-nav">
            <div className="sidebar-search-wrapper">
              <Search size={14} className="sidebar-search-icon" />
              <input
                type="text"
                className="sidebar-search-input"
                placeholder="Search chats…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <p className="sidebar-nav-label">History</p>
            <div className="history-list">
              {filteredThreads.length === 0 && (
                <div className="sidebar-empty">{searchQuery ? 'No matches' : 'No history yet'}</div>
              )}
              {filteredThreads.map((thread) => (
                <div
                  key={thread.id}
                  className={`nav-link-item history-item ${thread.id === activeThreadId ? 'active-thread' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => loadThread(thread.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      loadThread(thread.id);
                    }
                  }}
                >
                  <span className="history-title">
                    <span>{thread.title || 'New chat'}</span>
                  </span>
                  <button
                    className="history-delete"
                    onClick={(event) => handleDeleteThread(event, thread.id)}
                    aria-label="Delete chat"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="sidebar-bottom-nav">
          <div className="nav-link-item bottom-item" onClick={() => { navigate('/dashboard'); if (window.innerWidth <= 720) setIsSidebarOpen(false); }}>
            <LayoutDashboard size={18} /> Dashboard
          </div>
          <div className="nav-link-item bottom-item" onClick={() => { navigate('/reports'); if (window.innerWidth <= 720) setIsSidebarOpen(false); }}>
            <FileText size={18} /> Reports
          </div>
          <div className="nav-link-item bottom-item" onClick={() => { navigate('/settings'); if (window.innerWidth <= 720) setIsSidebarOpen(false); }}>
            <Settings size={18} /> Settings
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="chat-viewport">
        {isInitial ? (
          <>
            <header className="chat-mobile-top-bar">
              <button
                className="sidebar-toggle"
                onClick={() => setIsSidebarOpen((prev) => !prev)}
                aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
              >
                <Menu size={20} />
              </button>
              <span className="topbar-brand">SecureVision AI</span>
              <div className="mobile-top-spacer"></div>
            </header>
            <div className="hero-welcome-state">
              <div className="welcome-glow-bg"></div>
              <h1 className="hero-title">Welcome To <span className="text-gradient">SecureVision AI</span></h1>
              <p className="hero-subtitle">Your intelligent security companion is ready to assist you.</p>
              
              <div className="hero-search-wrapper">
                <input 
                  type="text" 
                  placeholder="Ask Anything..." 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                />
                <button className="hero-send-btn" onClick={handleSend} aria-label="Send">
                  <Send size={22} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="active-chat-interface">
            <header className="chat-top-bar">
              <div className="top-bar-left">
                <button
                  className="sidebar-toggle"
                  onClick={() => setIsSidebarOpen((prev) => !prev)}
                  aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                >
                  <Menu size={20} />
                </button>
              </div>
              <div className="top-bar-center">
                <span className="topbar-brand">SecureVision AI</span>
              </div>
              <div className="top-bar-right">
                {contextReportId && (
                  <div className="context-badge">
                    <Brain size={14} /> Context Active
                    <button className="clear-context" onClick={() => setContextReportId(null)} title="Clear report context">
                      <X size={12} />
                    </button>
                  </div>
                )}
                <button className="icon-action" aria-label="Search">
                  <Search size={18} />
                </button>
                <button className="icon-action" aria-label="Help">
                  <HelpCircle size={18} />
                </button>
              </div>
            </header>

            <div className="messages-scroll-area" ref={messagesRef}>
              {messages.map((msg) => {
                const parsed = msg.sender === 'ai' ? parseThinkingTokens(msg.text) : null;
                const isThinking = msg.sender === 'ai' && msg.isStreaming && parsed?.thinking && !parsed?.response;

                return (
                  <div key={msg.id} className={`chat-message-row ${msg.sender}`}>
                    <div className="msg-bubble-premium">
                      {msg.sender === 'ai' ? (
                        <>
                          {/* Thinking toggle */}
                          {parsed?.thinking && (
                            <ThinkingBlock
                              content={parsed.thinking}
                              isStreaming={msg.isStreaming && !parsed.response}
                            />
                          )}

                          {/* Actual response */}
                          <div className={`markdown ${msg.isStreaming ? 'typing' : ''}`}>
                            {parsed?.response ? (
                              <ReactMarkdown>{parsed.response}</ReactMarkdown>
                            ) : null}

                            {/* Typing dots when no visible text yet (still thinking or waiting) */}
                            {msg.isStreaming && !parsed?.response ? (
                              <span className="typing-dots">
                                <span></span>
                                <span></span>
                                <span></span>
                              </span>
                            ) : null}

                            {/* Blinking cursor while streaming visible text */}
                            {msg.isStreaming && parsed?.response ? <span className="typing-cursor" /> : null}
                          </div>
                        </>
                      ) : (
                        <p className={msg.isStreaming ? 'typing' : ''}>
                          {msg.text}
                          {msg.isStreaming && !msg.text ? (
                            <span className="typing-dots">
                              <span></span>
                              <span></span>
                              <span></span>
                            </span>
                          ) : null}
                          {msg.isStreaming && msg.text ? <span className="typing-cursor" /> : null}
                        </p>
                      )}
                      <span className="msg-timestamp">{msg.time}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="sticky-input-container">
              <div className="premium-input-pill">
                <input 
                  type="text" 
                  placeholder="Ask Anything..." 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                />
                <button className="pill-send-btn" onClick={handleSend}>
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Chat;
