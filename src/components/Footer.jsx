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
          <p>Local. Reliable. Trusted.</p>
        </div>
      </div>
    </footer>
  );
}