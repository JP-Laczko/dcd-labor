import Navbar from "../components/Navbar";
import dcd1 from "../assets/images/DCDStory1.jpg";
import dcd2 from "../assets/images/DCDStory2.jpg";
import dcd3 from "../assets/images/dcd1.jpg";
import "../styles/OurStory.css";

export default function OurStory() {
  return (
    <div>
      <Navbar />
      <div className="our-story-page">
        <div className="story-container">
          <div className="story-header">
            <h1>FROM SMALL JOBS TO TRUSTED SERVICE — HERE'S HOW DCD LABOR GOT STARTED</h1>
          </div>

          <div className="story-content">
            <section className="story-section">
              <h2>HUMBLE BEGINNINGS</h2>
              <div className="story-section-content">
                <div className="story-text">
                  <p>DCD Labor started as an idea between a few hardworking friends who believed in doing great work for a fair price. What began as a few weekend yard cleanups quickly grew into a trusted local service — powered by respect, hustle, and results.</p>
                </div>
                <div className="story-image">
                  <img src={dcd1} alt="DCD Labor team at work" />
                </div>
              </div>
            </section>

            <section className="story-section">
              <h2>WHAT WE STAND FOR</h2>
              <div className="story-section-content reverse">
                <div className="story-text">
                  <p>We're not a big corporation — we're your neighbors. Every job we take on is done by a team of motivated, respectful young men who show up on time, work hard, and take pride in every detail. From mulch installs to garbage bin cleaning, our mission is simple:</p>
                  <p className="mission-statement">Make your life easier with labor you can trust.</p>
                </div>
                <div className="story-image">
                  <img src={dcd2} alt="DCD Labor community work" />
                </div>
              </div>
            </section>

            <section className="story-section">
              <h2>WHY CUSTOMERS CHOOSE US</h2>
              <div className="story-section-content">
                <div className="story-text">
                  <p>DCD Labor was built by local guys who grew up here, graduated from the local high schools, and care deeply about this community. When you hire us, you're supporting people who understand the value of trust, hard work, and looking out for one another.</p>
                  <p>We treat every job like it's at our own home — because in many cases, it's right down the street from where we live. Whether we're cleaning bins, spreading mulch, or helping with yard work, we show up with pride and purpose.</p>
                </div>
                <div className="story-image">
                  <img src={dcd3} alt="DCD Labor local team" />
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}