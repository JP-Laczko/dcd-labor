import Navbar from "../components/Navbar";
import dcdStory1 from "../assets/images/DCDStory1.jpg";
import dcdStory2 from "../assets/images/DCDStory2.jpg";
import dcdStory3 from "../assets/images/DCDStory3.jpg";
import dcdStory4 from "../assets/images/DCDStory4.jpg";
import dcdStory5 from "../assets/images/DCDStory5.jpg";
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
                  <img src={dcdStory1} alt="DCD Labor team at work" />
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
                  <img src={dcdStory2} alt="DCD Labor community work" />
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
                  <img src={dcdStory3} alt="DCD Labor local team" />
                </div>
              </div>
            </section>

            <section className="story-section">
              <h2>QUALITY WORK, FAIR PRICES</h2>
              <div className="story-section-content reverse">
                <div className="story-text">
                  <p>We believe everyone deserves access to quality landscaping services without breaking the bank. Our transparent pricing and efficient team approach means you get professional results at rates that make sense for your budget.</p>
                  <p>From seasonal cleanups to ongoing maintenance, we're committed to delivering exceptional value while building lasting relationships with our clients.</p>
                </div>
                <div className="story-image">
                  <img src={dcdStory4} alt="DCD Labor quality work" />
                </div>
              </div>
            </section>

            <section className="story-section">
              <h2>BUILDING OUR COMMUNITY</h2>
              <div className="story-section-content">
                <div className="story-text">
                  <p>Beyond individual jobs, DCD Labor is about strengthening our community. We support local events, help neighbors in need, and take pride in making our shared spaces more beautiful.</p>
                  <p>When you choose DCD Labor, you're not just getting a service — you're investing in young entrepreneurs who are committed to giving back and making a positive difference right here at home.</p>
                </div>
                <div className="story-image">
                  <img src={dcdStory5} alt="DCD Labor community involvement" />
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}