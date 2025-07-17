import { useState, useEffect } from "react";
import "../styles/PricingAndContact.css";
import rateService from "../services/rateService";

export default function PricingAndContact() {
    const [rates, setRates] = useState({});

    useEffect(() => {
      const currentRates = rateService.getRates();
      setRates(currentRates);
    }, []);

    return (
      <section className="pricing-contact-section">
        <h2>Pricing & Contact</h2>
  
        <div className="pricing-info">
          <h3>Team Pricing</h3>
          <ul>
            <li>2-Man Team - ${rates.twoMan?.low} - ${rates.twoMan?.high}/hour</li>
            <li>3-Man Team - ${rates.threeMan?.low} - ${rates.threeMan?.high}/hour</li>
            <li>4-Man Team - ${rates.fourMan?.low} - ${rates.fourMan?.high}/hour</li>
          </ul>
          <p><em>Rates vary based on job complexity and duration</em></p>
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
  