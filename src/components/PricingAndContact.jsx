import "../styles/PricingAndContact.css";

export default function PricingAndContact() {
    return (
      <section className="pricing-contact-section">
        <h2>Pricing & Contact</h2>
  
        <div className="pricing-info">
          <h3>Pricing</h3>
          <ul>
            <li>Basic Lawn Mowing - $40 / visit</li>
            <li>Full Landscaping Service - $120 / visit</li>
            <li>Seasonal Cleanup - $80 / visit</li>
          </ul>
        </div>
  
        <div className="contact-info">
          <h3>Contact Us</h3>
          <p>Email: <a href="mailto:info@dcdlabor.com">info@dcdlabor.com</a></p>
          <p>Phone: <a href="tel:+1234567890">(123) 456-7890</a></p>
          <p>Address: 123 Greenway Blvd, Athens, GA</p>
        </div>
      </section>
    );
  }
  