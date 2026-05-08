import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HiPhone, HiMail, HiLocationMarker } from 'react-icons/hi';
import { FaFacebook, FaInstagram, FaTwitter, FaLinkedin } from 'react-icons/fa';
import './Contact.css';

const Contact = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    subject: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

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

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
    setFormData({ firstName: '', lastName: '', subject: '', message: '' });
  };

  return (
    <div className="contact-page">

      {/* Navbar */}
      <nav className="contact-navbar">
        <div className="contact-nav-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <div className="contact-logo-icon"></div>
          <span>SECUREVISION AI</span>
        </div>
        <button
          className="contact-mobile-nav-toggle"
          onClick={() => setIsMobileNavOpen((prev) => !prev)}
          aria-label="Toggle navigation menu"
          aria-expanded={isMobileNavOpen}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
        <ul className={`contact-nav-links ${isMobileNavOpen ? 'open' : ''}`}>
          <li><Link to="/home" onClick={() => setIsMobileNavOpen(false)}>Home</Link></li>
          <li><a href="/home#features" onClick={() => setIsMobileNavOpen(false)}>Features</a></li>
          <li><a href="/home#applications" onClick={() => setIsMobileNavOpen(false)}>Applications</a></li>
          <li><a href="/home#incidents" onClick={() => setIsMobileNavOpen(false)}>Incident</a></li>
          <li><Link to="/blog" onClick={() => setIsMobileNavOpen(false)}>Blog</Link></li>
          <li><Link to="/contact" className="active-link" onClick={() => setIsMobileNavOpen(false)}>Contact Us</Link></li>
          <li className="contact-mobile-login-link"><Link to="/login" onClick={() => setIsMobileNavOpen(false)}>Login</Link></li>
        </ul>
        <Link to="/login" className="contact-nav-login-btn">Login</Link>
      </nav>

      {/* Hero Section */}
      <section className="contact-hero">
        <div className="contact-hero-overlay"></div>
        <div className="contact-hero-content">
          <h1>CONTACT US</h1>
          <p>We'd love to show you how you can get more from our AI video assistant</p>
        </div>
      </section>

      {/* Form Section */}
      <section className="contact-form-section">
        <div className="contact-form-card">
          <h2 className="form-card-title">Contact us</h2>

          {submitted && (
            <div className="success-banner">
              ✅ Message sent successfully! We'll get back to you soon.
            </div>
          )}

          <form onSubmit={handleSubmit} className="contact-form" id="contact-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="firstName">First Name</label>
                <input
                  id="firstName"
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="Muhammad"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="lastName">Last Name</label>
                <input
                  id="lastName"
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Huzaifa"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="subject">Subject</label>
              <input
                id="subject"
                type="text"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                placeholder="How can we help you?"
                required
              />
            </div>


            <div className="form-group">
              <label htmlFor="message">Message</label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                placeholder="Write your message here..."
                rows={5}
                required
              ></textarea>
            </div>

            <button type="submit" className="contact-submit-btn" id="contact-submit-btn">
              Submit
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="contact-footer">
        <div className="contact-footer-content">
          <div className="contact-footer-brand">
            <h2 className="contact-footer-logo">SECUREVISION AI</h2>
            <p className="contact-footer-tagline">SHAPING TECHNOLOGY <br /> FOR THE FUTURE</p>
            <div className="contact-social-icons">
              <FaFacebook />
              <FaInstagram />
              <FaTwitter />
              <FaLinkedin />
            </div>
          </div>

          <div className="contact-footer-links-grid">
            <div className="contact-footer-col">
              <h3>Features</h3>
              <ul>
                <li>Uploads</li>
                <li>Summary Cards</li>
                <li>Module</li>
                <li>Quiz</li>
              </ul>
            </div>
            <div className="contact-footer-col">
              <h3>Applications</h3>
              <ul>
                <li>Safety</li>
                <li>Protection</li>
                <li>AI Integrated</li>
                <li>Language Explanation</li>
                <li>Content Creation</li>
              </ul>
            </div>
            <div className="contact-footer-col">
              <h3>Contact Us</h3>
              <ul>
                <li><HiPhone /> 051-123-4567</li>
                <li><HiMail /> demo@gmail.com</li>
                <li><HiLocationMarker /> Willowbrook Park - Greenwood</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="contact-footer-bottom">
          <p>All Copyrights are reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Contact;
