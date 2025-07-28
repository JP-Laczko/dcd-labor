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
            <li>2-Man Team - ${rates.twoMan || 85}/hour</li>
            <li>3-Man Team - ${rates.threeMan || 117}/hour</li>
            <li>4-Man Team - ${rates.fourMan || 140}/hour</li>
          </ul>
          <p><em>Final rates may vary based on job complexity and duration</em></p>
        </div>
  
        <div className="contact-info">
          <h3>Contact Us</h3>
          <p>Email: <a href="mailto:nickdargel@dcdlabor.com">nickdargel@dcdlabor.com</a></p>
          <p>Phone: <a href="tel:+19739452076">(973) 945-2076</a></p>
          <p>Service Area: Morris County, New Jersey</p>
          <p>Hours: Mon-Fri 9AM-5PM, Sat 9AM-1PM, Sun Not Available</p>
        </div>
      </section>
    );
  }
  