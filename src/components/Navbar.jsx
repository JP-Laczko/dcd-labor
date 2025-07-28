import { Link, useLocation } from "react-router-dom";
import "../styles/Navbar.css";

export default function Navbar() {
  const location = useLocation();

  return (
    <nav className="navbar">
      <div className="logo">
        <Link to="/">
          <img src="/DCDLaborFavicon.png" alt="DCD Labor" className="logo-icon" />
          DCD Labor
        </Link>
      </div>
      <ul className="nav-links">
        <li className={location.pathname === "/" ? "active" : ""}>
          <Link to="/">
            Home
          </Link>
        </li>
        <li className={location.pathname === "/schedule-service" ? "active" : ""}>
          <Link to="/schedule-service">
            Schedule Service
          </Link>
        </li>
        <li className={location.pathname === "/schedule" ? "active" : ""}>
          <Link to="/schedule">
            Request a quote
          </Link>
        </li>
        <li className={location.pathname === "/our-story" ? "active" : ""}>
          <Link to="/our-story">
            Our Story
          </Link>
        </li>
        <li className={location.pathname === "/contact" ? "active" : ""}>
          <Link to="/contact">
            Contact
          </Link>
        </li>
      </ul>
    </nav>
  );
}