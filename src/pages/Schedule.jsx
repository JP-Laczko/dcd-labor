import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import "../styles/Schedule.css";

export default function Schedule() {
  const location = useLocation();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    services: [],
    date: "",
    crewSize: "",
    yardAcreage: "",
    notes: ""
  });


  useEffect(() => {
    // Check if date is passed via URL params
    const urlParams = new URLSearchParams(location.search);
    const dateParam = urlParams.get('date');
    
    if (dateParam) {
      setFormData(prev => ({
        ...prev,
        date: dateParam
      }));
    }
  }, [location]);

  const [errors, setErrors] = useState({});

  const services = [
    "Leaf Removal",
    "Lawn Mowing",
    "Hedge Trimming",
    "Tree Removal",
    "Landscaping Design",
    "Mulching",
    "Garden Maintenance",
    "Pressure Washing"
  ];

  const crewSizes = [
    { value: "2", label: "2-Man Crew", rate: "$80/hour" },
    { value: "3", label: "3-Man Crew", rate: "$120/hour" },
    { value: "4", label: "4-Man Crew", rate: "$160/hour" }
  ];


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ""
      }));
    }
  };

  const handleServiceChange = (e) => {
    const { value, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      services: checked 
        ? [...prev.services, value]
        : prev.services.filter(service => service !== value)
    }));
    // Clear error when user selects a service
    if (errors.services) {
      setErrors(prev => ({
        ...prev,
        services: ""
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    if (!formData.phone.trim()) newErrors.phone = "Phone is required";
    if (!formData.address.trim()) newErrors.address = "Address is required";
    if (formData.services.length === 0) newErrors.services = "Please select at least one service";
    if (!formData.date) newErrors.date = "Date is required";
    if (!formData.crewSize) newErrors.crewSize = "Please select crew size";
    if (!formData.yardAcreage.trim()) newErrors.yardAcreage = "Yard acreage is required";

    // Email validation
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email";
    }

    // Phone validation
    if (formData.phone && !/^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/.test(formData.phone)) {
      newErrors.phone = "Please enter a valid phone number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // Here you would integrate with Stripe for payment processing
    console.log("Form submitted:", formData);
    alert("Booking request submitted! We'll contact you soon to confirm and process payment.");
  };

  return (
    <div>
      <Navbar />
      <div className="schedule-page">
        <div className="schedule-container">
          <div className="schedule-header">
            <h1>Schedule Your Service</h1>
            <p>Fill out the form below to book your landscaping service. We'll contact you to confirm your appointment and process payment.</p>
          </div>

          <form onSubmit={handleSubmit} className="schedule-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="name">Full Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={errors.name ? "error" : ""}
                />
                {errors.name && <span className="error-text">{errors.name}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="email">Email Address *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={errors.email ? "error" : ""}
                />
                {errors.email && <span className="error-text">{errors.email}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="phone">Phone Number *</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="(555) 123-4567"
                  className={errors.phone ? "error" : ""}
                />
                {errors.phone && <span className="error-text">{errors.phone}</span>}
              </div>

              <div className="form-group">
                <label>Services Needed * (select at least one)</label>
                <div className="checkbox-group">
                  {services.map((service, index) => (
                    <label key={index} className="checkbox-label">
                      <input
                        type="checkbox"
                        value={service}
                        checked={formData.services.includes(service)}
                        onChange={handleServiceChange}
                      />
                      <span>{service}</span>
                    </label>
                  ))}
                </div>
                {errors.services && <span className="error-text">{errors.services}</span>}
              </div>
            </div>

            <div className="form-group full-width">
              <label htmlFor="address">Service Address *</label>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="123 Main St, City, State 12345"
                className={errors.address ? "error" : ""}
              />
              {errors.address && <span className="error-text">{errors.address}</span>}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="date">Preferred Date *</label>
                <input
                  type="date"
                  id="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  min={new Date().toISOString().split('T')[0]}
                  className={errors.date ? "error" : ""}
                />
                {errors.date && <span className="error-text">{errors.date}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="yardAcreage">Approximate Yard Acreage *</label>
                <input
                  type="text"
                  id="yardAcreage"
                  name="yardAcreage"
                  value={formData.yardAcreage}
                  onChange={handleInputChange}
                  placeholder="e.g., 0.5 acres, 1/4 acre"
                  className={errors.yardAcreage ? "error" : ""}
                />
                {errors.yardAcreage && <span className="error-text">{errors.yardAcreage}</span>}
              </div>
            </div>

            {formData.services.length > 0 && (
              <div className="form-group full-width">
                <label htmlFor="crewSize">Crew Size & Hourly Rate *</label>
                <select
                  id="crewSize"
                  name="crewSize"
                  value={formData.crewSize}
                  onChange={handleInputChange}
                  className={errors.crewSize ? "error" : ""}
                >
                  <option value="">Select crew size</option>
                  {crewSizes.map((crew, index) => (
                    <option key={index} value={crew.value}>
                      {crew.label} - {crew.rate}
                    </option>
                  ))}
                </select>
                {errors.crewSize && <span className="error-text">{errors.crewSize}</span>}
              </div>
            )}

            <div className="form-group full-width">
              <label htmlFor="notes">Additional Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="Any special instructions or details about your property..."
                rows="4"
              />
            </div>

            <div className="payment-info">
              <h3>Payment Information</h3>
              <p>A 50% deposit will be required to confirm your booking. We accept all major credit cards and will process payment securely after we confirm your appointment details.</p>
            </div>

            <button type="submit" className="submit-button">
              Submit Booking Request
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}