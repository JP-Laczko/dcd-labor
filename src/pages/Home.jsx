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

      {/* CEO Message Section */}
      <section className="ceo-message-section">
        <div className="max-w-4xl mx-auto px-4">
          <div className="ceo-message-card">
            <div className="header-section">
              <h2>Why Choose Hourly with DCD?</h2>
              <h3>A Note from Our Co-Founders</h3>
            </div>
            
            <div className="message-content">
              <div className="message-paragraph">
                <div className="paragraph-icon">💭</div>
                <p>
                  We get it, "hourly landscaping" doesn't always have the best reputation. People assume they'll end up with slow, unmotivated workers just burning time. But at DCD, that couldn't be further from the truth.
                </p>
              </div>
              
              <div className="message-paragraph">
                <div className="paragraph-icon">🏡</div>
                <p>
                  When you choose DCD's hourly service, you're hiring a crew of hardworking, trustworthy young men who were raised right here in the community and care about doing the job well, and fast. We operate with a community-first mindset that values hustle, honesty, and high standards.
                </p>
              </div>
              
              <div className="message-paragraph">
                <div className="paragraph-icon">💰</div>
                <p>
                  In most cases, our clients pay much less with the hourly rate. That's because our crews don't waste time, we get in, get it done, and leave your yard looking better than ever. More importantly, we operate with a certification on our work, which is that we will come back and fix any mistake or missed spot for free.
                </p>
              </div>
              
              <div className="message-paragraph">
                <div className="paragraph-icon">⚡</div>
                <p>
                  And by booking directly online and choosing hourly, you help us skip the back-and-forth quoting process, so we can spend more time doing what we love: serving the great people of this community with the lowest rates and the highest quality work around.
                </p>
              </div>
            </div>
            
            <div className="founder-note">
              <div className="quote-icon">✨</div>
              <p className="closing-message">
                We built this company on hard work and integrity. Thanks for letting us prove it to you.
              </p>
              <p className="signature">
                — The DCD Co-Founders
              </p>
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
