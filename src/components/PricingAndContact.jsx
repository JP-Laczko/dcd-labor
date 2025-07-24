import { useState, useEffect } from "react";
import "../styles/PricingAndContact.css";
import rateService from "../services/rateService";
import mongoService from "../services/mongoService";

export default function PricingAndContact() {
    const [rates, setRates] = useState({});

    useEffect(() => {
      const loadRates = async () => {
        try {
          const ratesResult = await mongoService.getRates();
          if (ratesResult.success) {
            setRates(ratesResult.rates);
          } else {
            // Fallback to rateService
            const currentRates = rateService.getRates();
            setRates(currentRates);
          }
        } catch (error) {
          console.error('Error loading rates:', error);
          // Fallback to rateService
          const currentRates = rateService.getRates();
          setRates(currentRates);
        }
      };
      
      loadRates();
    }, []);

    return (
      <section className="pricing-contact-section">
        <h2>Pricing & Contact</h2>
  
        <div className="pricing-info">
          <h3>Team Pricing</h3>
          <ul>
            <li>2-Man Team - ${rates.twoMan || 70}/hour</li>
            <li>3-Man Team - ${rates.threeMan || 100}/hour</li>
            <li>4-Man Team - ${rates.fourMan || 130}/hour</li>
          </ul>
          <p><em>Final rates may vary based on job complexity and duration</em></p>
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
  