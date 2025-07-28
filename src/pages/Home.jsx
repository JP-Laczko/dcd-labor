import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import HeroCarousel from "../components/HeroCarousel";
import BookingSection from "../components/BookingSection";
import TestimonialsSection from "../components/TestimonialsSection";
import Footer from "../components/Footer";
import "../styles/ServiceFlow.css";

export default function Home() {
  return (
    <>
      <Navbar />
      <HeroCarousel />
      
      {/* Two side-by-side service sections */}
      <section className="service-flow-section">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid">
            
            {/* Hourly Services Section */}
            <div className="service-card hourly">
              <div>
                <h2>Hourly Services</h2>
                <p>
                  Simple tasks charged by the hour. Book directly onto our calendar.
                </p>
                <ul>
                  <li>Leaf Removal</li>
                  <li>Weeding</li>
                  <li>General yard cleanup</li>
                  <li>Fast and efficient service</li>
                </ul>
              </div>
              <Link 
                to="/schedule-service" 
                className="cta-button"
              >
                Schedule Now
              </Link>
            </div>

            {/* Project-Based Services Section */}
            <div className="service-card complex">
              <div>
                <h2>Project-Based Services</h2>
                <p>
                  Projects that need evaluation and custom pricing. We'll provide a detailed quote.
                </p>
                <ul>
                  <li>Mulching</li>
                  <li>Brush removal</li>
                  <li>Log splitting</li>
                  <li>Landscape design</li>
                </ul>
              </div>
              <Link 
                to="/schedule" 
                className="cta-button"
              >
                Request Quote
              </Link>
            </div>
            
          </div>
        </div>
      </section>

      <BookingSection />
      <TestimonialsSection />
      <Footer />
    </>
  );
}
