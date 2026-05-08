import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { HiArrowRight, HiOutlineBookmark, HiPhone, HiMail, HiLocationMarker } from 'react-icons/hi';
import { FaFacebook, FaInstagram, FaTwitter, FaLinkedin } from 'react-icons/fa';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();
  const [typedCount, setTypedCount] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const fullTitle = 'See The Unusual\nPrevent The\nUnlikely';
  const highlightRanges = [
    {
      start: fullTitle.indexOf('Unusual'),
      end: fullTitle.indexOf('Unusual') + 'Unusual'.length,
    },
    {
      start: fullTitle.lastIndexOf('Unlikely'),
      end: fullTitle.lastIndexOf('Unlikely') + 'Unlikely'.length,
    },
  ];

  useEffect(() => {
    let index = 0;
    const intervalId = setInterval(() => {
      index += 1;
      setTypedCount(index);
      if (index >= fullTitle.length) {
        clearInterval(intervalId);
        setIsTyping(false);
      }
    }, 70);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    document.getElementById('root')?.style.setProperty('overflow', 'visible');

    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.getElementById('root')?.style.removeProperty('overflow');
    };
  }, []);

  const renderTypedText = () => {
    const chars = fullTitle.split('');
    const nodes = [];

    for (let i = 0; i < typedCount; i += 1) {
      const char = chars[i];
      if (char === '\n') {
        nodes.push(<br key={`br-${i}`} />);
        continue;
      }

      const isHighlight = highlightRanges.some(
        (range) => i >= range.start && i < range.end,
      );

      nodes.push(
        <span
          key={`ch-${i}`}
          className={isHighlight ? 'typing-highlight' : undefined}
        >
          {char}
        </span>,
      );
    }

    return nodes;
  };

  const handleNavScroll = (event, targetId) => {
    event.preventDefault();
    const section = document.getElementById(targetId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setIsMobileNavOpen(false);
  };

  return (
    <div className="home-container">
      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-logo">
          <div className="logo-icon"></div>
          <span>SECUREVISION AI</span>
        </div>
        <button
          className="mobile-nav-toggle"
          onClick={() => setIsMobileNavOpen((prev) => !prev)}
          aria-label="Toggle navigation menu"
          aria-expanded={isMobileNavOpen}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
        <ul className={`home-nav-links ${isMobileNavOpen ? 'open' : ''}`}>
          <li><Link to="/home">Home</Link></li>
          <li><a href="#features" onClick={(event) => handleNavScroll(event, 'features')}>Features</a></li>
          <li><a href="#applications" onClick={(event) => handleNavScroll(event, 'applications')}>Applications</a></li>
          <li><a href="#incidents" onClick={(event) => handleNavScroll(event, 'incidents')}>Incident</a></li>
          <li><Link to="/blog">Blog</Link></li>
          <li><Link to="/contact">Contact Us</Link></li>
          <li className="mobile-login-link"><Link to="/login">Login</Link></li>
        </ul>
        <Link to="/login" className="nav-login-btn">Login</Link>
      </nav>

      {/* Hero Section */}
      <header className="hero">
        <div className="hero-content">
          <h1 className="hero-title typing-title">
            <span className="typing-text">{renderTypedText()}</span>
            {isTyping && <span className="typing-caret" aria-hidden="true" />}
          </h1>
          <p className="hero-subtitle">
            Elevate your management skills of cutting-edge technology, <br />
            join our courses for a comprehensive learning.
          </p>
          <button className="hero-btn" onClick={() => navigate('/login')}>Start Now</button>
        </div>
        <div className="hero-glow"></div>
      </header>

      {/* Feature Section */}
      <section id="features" className="features">
        <h2 className="section-title dark">Features</h2>
        <div className="feature-cards">
          <div className="feature-card">
            <div className="card-icon"><div className="icon-placeholder tech"></div></div>
            <h3>SMART TECHNOLOGY</h3>
            <p>Reliability and security for every device and each user within your system.</p>
          </div>
          <div className="feature-card highlighted">
            <h3>ANALYTICS ENGINE</h3>
            <p>Our thermal and infrared analytics allow for real-time monitoring and advanced detection of specialized objects.</p>
            <div className="card-badge">AI</div>
          </div>
          <div className="feature-card">
            <div className="card-icon"><div className="icon-placeholder support"></div></div>
            <h3>TRAINING & SUPPORT</h3>
            <p>Comprehensive video tutorials, field support and technical training at our facilities.</p>
          </div>
        </div>
      </section>

      {/* Applications Section */}
      <section id="applications" className="applications">
        <h2 className="section-title">Applications</h2>
        <div className="app-grid">
          {/* Card 01 */}
          <div className="app-card">
            <div className="app-image-wrapper arch-top">
              <img src="https://images.unsplash.com/photo-1557597774-9d273605dfa9?q=80&w=500&auto=format&fit=crop" alt="Safety" />
              <div className="app-icon-badge"></div>
            </div>
            <div className="app-content">
              <h3>Safety and Security</h3>
              <p>As opposed to using 'Content here, content here', making it look like readable English.</p>
            </div>
            <div className="app-footer">
              <span className="app-number">01</span>
              <div className="diagonal-line"></div>
            </div>
          </div>

          {/* Card 02 */}
          <div className="app-card">
            <div className="app-image-wrapper arch-top">
              <img src="https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=500&auto=format&fit=crop" alt="Business" />
              <div className="app-icon-badge"></div>
            </div>
            <div className="app-content">
              <h3>Small Business Protection</h3>
              <p>As opposed to using 'Content here, content here', making it look like readable English.</p>
            </div>
            <div className="app-footer">
              <span className="app-number">02</span>
              <div className="diagonal-line"></div>
            </div>
          </div>

          {/* Card 03 */}
          <div className="app-card">
            <div className="app-image-wrapper arch-top">
              <img src="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=500&auto=format&fit=crop" alt="Education" />
              <div className="app-icon-badge"></div>
            </div>
            <div className="app-content">
              <h3>Educational Training & Learning</h3>
              <p>As opposed to using 'Content here, content here', making it look like readable English.</p>
            </div>
            <div className="app-footer">
              <span className="app-number">03</span>
              <div className="diagonal-line"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Incidents Section */}
      <section id="incidents" className="incidents-section">
        <div className="incidents-container">
          <h2 className="incidents-title">Incidents</h2>
          <div className="incident-list">
            <div className="incident-card">
              <div className="incident-image">
                <img src="https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=300&auto=format&fit=crop" alt="Accident" />
              </div>
              <div className="incident-content">
                <div className="incident-header">
                  <h3>Road Accident</h3>
                  <HiOutlineBookmark className="bookmark-icon" />
                </div>
                <div className="incident-meta">
                  <span className="inc-id">#INC-1024</span>
                  <span className="inc-priority">HIGH</span>
                </div>
                <p>Physical Fight Detected</p>
                <p>Parking Area, Main Lobby</p>
                <Link to="#" className="learn-more-link">Learn More <HiArrowRight /></Link>
              </div>
            </div>

            <div className="incident-card">
              <div className="incident-image">
                <img src="https://images.unsplash.com/photo-1571260899304-425eee4c7efc?q=80&w=300&auto=format&fit=crop" alt="Fighting" />
              </div>
              <div className="incident-content">
                <div className="incident-header">
                  <h3>Fighting</h3>
                  <HiOutlineBookmark className="bookmark-icon" />
                </div>
                <div className="incident-meta">
                  <span className="inc-id">#INC-1024</span>
                  <span className="inc-priority">HIGH</span>
                </div>
                <p>Physical Fight Detected</p>
                <p>Parking Area, Main Lobby</p>
                <Link to="#" className="learn-more-link">Learn More <HiArrowRight /></Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="main-footer">
        <div className="subscribe-bar">
          <div className="subscribe-inputs">
            <input type="email" placeholder="Email" />
            <input type="text" placeholder="Name" />
          </div>
          <button className="subscribe-btn">Subscribe</button>
        </div>

        <div className="footer-content">
          <div className="footer-brand-section">
            <h2 className="footer-logo">SECUREVISION AI</h2>
            <p className="footer-tagline">SHAPING TECHNOLOGY <br /> FOR THE FUTURE</p>
            <div className="social-icons">
              <FaFacebook />
              <FaInstagram />
              <FaTwitter />
              <FaLinkedin />
            </div>
          </div>

          <div className="footer-links-grid">
            <div className="footer-col">
              <h3>Features</h3>
              <ul>
                <li>Uploads</li>
                <li>Summary Cards</li>
                <li>Module</li>
                <li>Quiz</li>
              </ul>
            </div>
            <div className="footer-col">
              <h3>Applications</h3>
              <ul>
                <li>Safety</li>
                <li>Protection</li>
                <li>AI Integrated</li>
                <li>Language Expalantaion</li>
                <li>Content Creation</li>
              </ul>
            </div>
            <div className="footer-col contact-col">
              <h3>Contact Us</h3>
              <ul>
                <li><HiPhone /> 051-123-4567</li>
                <li><HiMail /> demo@gmail.com</li>
                <li><HiLocationMarker /> Willowbrook Park - Greenwood</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="footer-bottom-bar">
          <p>All Copyrights are reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
