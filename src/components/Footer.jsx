import "../styles/Footer.css";
import { FaFacebook, FaInstagram, FaTiktok } from "react-icons/fa";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="follow-us-section">
          <h3>FOLLOW US</h3>
          <div className="social-links">
            <a href="https://facebook.com/DCDLabor" target="_blank" rel="noopener noreferrer" className="social-link">
              <div className="social-icon"><FaFacebook /></div>
              <span>@DCDLabor</span>
            </a>
            <a href="https://instagram.com/dcdlabor" target="_blank" rel="noopener noreferrer" className="social-link">
              <div className="social-icon"><FaInstagram /></div>
              <span>@dcdlabor</span>
            </a>
            <a href="https://tiktok.com/@dcdlabor" target="_blank" rel="noopener noreferrer" className="social-link">
              <div className="social-icon"><FaTiktok /></div>
              <span>@dcdlabor</span>
            </a>
          </div>
        </div>
        
        <div className="footer-info">
          <p>&copy; 2024 DCD Labor. All rights reserved.</p>
          <p className="tagline">Local. Reliable. Trusted.</p>
          <div className="developer-credit">
            <p className="developer-highlight">
              ⚡ Premium full-stack website built by{' '}
              <a 
                href="https://jpldev.co" 
                target="_blank" 
                rel="noopener noreferrer"
                className="developer-link"
              >
                <strong>JPLDev.co</strong>
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}