import { Link } from "react-router-dom";
import "../styles/BookingSection.css";

export default function BookingSection() {
  const services = [
    { name: "Manual Labor", description: "General outdoor work and heavy lifting tasks", icon: "💪" },
    { name: "Snow Removal", description: "Professional snow clearing and ice management", icon: "❄️" },
    { name: "Yard Cleanups", description: "Complete yard maintenance and debris removal", icon: "🍂" },
    { name: "Weeding", description: "Thorough weed removal and garden maintenance", icon: "🌱" },
    { name: "Mulching", description: "Professional mulch installation and spreading", icon: "🌳" },
    { name: "Log Splitting", description: "Firewood preparation and log processing", icon: "🪓" }
  ];

  return (
    <section className="booking-section">
      <h2>Our Professional Services</h2>
      <p>We provide comprehensive landscaping services to keep your property beautiful year-round.</p>
      
      <div className="services-showcase">
        {services.map((service, i) => (
          <div key={i} className="service-showcase-card">
            <div className="service-icon">{service.icon}</div>
            <h3>{service.name}</h3>
            <p>{service.description}</p>
          </div>
        ))}
      </div>

      <div className="additional-services">
        <h3>AND MUCH MORE!</h3>
        <p>Contact us for custom labor solutions and specialized services</p>
      </div>
    </section>
  );
}
