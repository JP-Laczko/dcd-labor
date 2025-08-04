import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import "../styles/Contact.css";

export default function Contact() {
  return (
    <div>
      <Navbar />
      <div className="contact-page">
        <div className="contact-container">
          <div className="contact-header">
            <h1>Contact Us</h1>
            <p>Get in touch with DCD Labor for all your landscaping needs. We're here to help!</p>
          </div>

          <div className="contact-content">
            <div className="contact-info-section">
              <div className="contact-card">
                <div className="contact-icon">📞</div>
                <h3>Phone</h3>
                <p>
                  <a href="tel:+19739452076">(973) 945-2076</a>
                </p>
              </div>

              <div className="contact-card">
                <div className="contact-icon">✉️</div>
                <h3>Email</h3>
                <p>
                  <a href="mailto:nickdargel@dcdlabor.com">nickdargel@dcdlabor.com</a>
                </p>
              </div>

              <div className="contact-card">
                <div className="contact-icon">📍</div>
                <h3>Service Area</h3>
                <p>North Jersey</p>
              </div>
            </div>


            <div className="hours-section">
              <h2>Business Hours</h2>
              <div className="hours-grid">
                <div className="hours-item">
                  <span className="day">Monday - Friday</span>
                  <span className="time">9:00 AM - 5:00 PM</span>
                </div>
                <div className="hours-item">
                  <span className="day">Saturday</span>
                  <span className="time">9:00 AM - 1:00 PM</span>
                </div>
                <div className="hours-item">
                  <span className="day">Sunday</span>
                  <span className="time">Not Available</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}