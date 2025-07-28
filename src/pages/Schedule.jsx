import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import PaymentBookingModal from "../components/PaymentBookingModal";
import "../styles/Schedule.css";
import rateService from "../services/rateService";
import mongoService from "../services/mongoService";
import timeSlotUtils from "../utils/timeSlotUtils";

export default function Schedule() {
  const location = useLocation();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    serviceType: "estimate", // Only estimate services for quotes
    services: [],
    date: "",
    crewSize: "",
    yardAcreage: "",
    notes: "",
    leafHaul: false
  });
  
  const [selectedServiceType, setSelectedServiceType] = useState(""); // Track which section is selected

  const [rates, setRates] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("");
  const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
  const [loadingTimeSlots, setLoadingTimeSlots] = useState(false);

  useEffect(() => {
    // Initialize MongoDB connection and load rates
    const initializeSchedule = async () => {
      await mongoService.connect();
      
      // Check if date is passed via URL params
      const urlParams = new URLSearchParams(location.search);
      const dateParam = urlParams.get('date');
      
      if (dateParam) {
        setFormData(prev => ({
          ...prev,
          date: dateParam
        }));
      }

      // Load current rates from MongoDB
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
    
    initializeSchedule();
  }, [location]);

  const [errors, setErrors] = useState({});

  // Load available time slots for a selected date
  const loadTimeSlots = async (date) => {
    setLoadingTimeSlots(true);
    setSelectedTimeSlot(""); // Clear selected time slot
    
    try {
      const dateString = date.toISOString().split('T')[0];
      const availability = await mongoService.getAllCalendarAvailability();
      
      if (availability.success) {
        const dayData = availability.availability.find(day => day.date === dateString);
        if (dayData && dayData.availability && dayData.availability.timeSlots) {
          const availableSlots = dayData.availability.timeSlots
            .filter(slot => slot.isAvailable)
            .sort((a, b) => a.time.localeCompare(b.time));
          setAvailableTimeSlots(availableSlots);
        } else {
          // Generate default time slots for the date based on business rules
          const defaultSlots = timeSlotUtils.generateDefaultTimeSlots(date);
          setAvailableTimeSlots(defaultSlots);
        }
      } else {
        const defaultSlots = timeSlotUtils.generateTimeSlotsForDate(date);
        setAvailableTimeSlots(defaultSlots);
      }
    } catch (error) {
      console.error('Error loading time slots:', error);
      setAvailableTimeSlots([]);
    } finally {
      setLoadingTimeSlots(false);
    }
  };

  // Estimate Services (complex tasks requiring assessment)
  const estimateServices = [
    "Demolition & teardown (hot tubs, sheds, etc.)",
    "Furniture moving & lifting",
    "Mulching", 
    "Yard Cleanup",
    "Leaf cleanup (Fall prep)",
    "Hedge & bush trimming",
    "Weeding & flowerbed maintenance",
    "Seasonal yard prep (Spring/Fall cleanups)",
    "Log splitting & stacking",
    "Firewood delivery",
    "Brush clearing",
    "Equipment/material transport",
    "Help loading/unloading trucks",
    "Power washing (homes, patios, driveways)",
    "Gravel spreading",
    "Event setup & breakdown",
    "Fence & post removal",
    "Snow shoveling (winter seasonal)",
    "Odd jobs / one-off projects"
  ];

  
  const crewSizes = [
    { 
      value: "2", 
      label: "2-Man Crew", 
      rate: rates.twoMan ? `$${rates.twoMan}/hour` : "$85/hour"
    },
    { 
      value: "3", 
      label: "3-Man Crew", 
      rate: rates.threeMan ? `$${rates.threeMan}/hour` : "$117/hour"
    },
    { 
      value: "4", 
      label: "4-Man Crew", 
      rate: rates.fourMan ? `$${rates.fourMan}/hour` : "$140/hour"
    }
  ];


  const handleInputChange = async (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Load time slots when date changes
    if (name === 'date' && value) {
      await loadTimeSlots(new Date(value));
    }
    
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
    console.log('Form submitted with data:', formData);
    
    if (!validateForm()) {
      console.log('Form validation failed, errors:', errors);
      return;
    }

    console.log('Form validation passed, submitting...');
    setIsSubmitting(true);

    try {
      // Submit quote request via email (no calendar booking for quotes)
      const quoteData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        services: formData.services,
        yardAcreage: formData.yardAcreage,
        notes: formData.notes,
        leafHaul: formData.leafHaul,
        requestType: 'quote',
        submittedAt: new Date().toISOString()
      };
      
      // Send quote request email
      console.log('Sending quote request:', quoteData);
      const response = await fetch('/api/send-quote-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(quoteData)
      });
      
      console.log('Quote request response status:', response.status);
      console.log('Quote request response ok:', response.ok);
      
      if (response.ok) {
        const result = await response.json();
        console.log('Quote request result:', result);
        alert('Quote request submitted successfully! We\'ll get back to you within 24 hours.');
        // Reset form
        setFormData({
          name: "",
          email: "",
          phone: "",
          address: "",
          serviceType: "estimate",
          services: [],
          date: "",
          crewSize: "",
          yardAcreage: "",
          notes: "",
          leafHaul: false
        });
      } else {
        const errorText = await response.text();
        console.error('Quote request failed:', response.status, errorText);
        throw new Error(`Failed to submit quote request: ${response.status}`);
      }
      
    } catch (error) {
      console.error("Error submitting quote request:", error);
      alert("There was an error submitting your request. Please try again or call us directly.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBookingChange = () => {
    // Refresh any calendar data if needed
    console.log('Booking created successfully');
  };

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedDate(null);
    
    // Reset form after successful booking
    setFormData({
      name: "",
      email: "",
      phone: "",
      address: "",
      serviceType: "",
      services: [],
      date: "",
      crewSize: "",
      yardAcreage: "",
      notes: "",
      leafHaul: false
    });
    setSelectedServiceType("");
    setSelectedTimeSlot("");
    setAvailableTimeSlots([]);
  };

  return (
    <div>
      <Navbar />
      <div className="schedule-page">
        <div className="schedule-container">
          <div className="schedule-header">
            <h1>Request a Quote</h1>
            <p>Fill out the form below to request a quote for your project. We'll review your requirements and get back to you with a detailed estimate.</p>
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
            </div>

            <div className="form-group full-width">
              <label>Select Services * (choose all that apply)</label>
              <div className="checkbox-group">
                {estimateServices.map((service, index) => (
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

            {/* Leaf Haul Add-on */}
            <div className="form-group full-width leaf-haul-section">
              <div className="leaf-haul-checkbox">
                <input
                  type="checkbox"
                  id="leafHaul"
                  name="leafHaul"
                  checked={formData.leafHaul}
                  onChange={(e) => setFormData(prev => ({ ...prev, leafHaul: e.target.checked }))}
                />
                <label htmlFor="leafHaul" className="checkbox-label">
                  <span className="checkbox-text">Leaves hauled away</span>
                  <span className="addon-price">+$280</span>
                </label>
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

            <div className="quote-info">
              <h3>What happens next?</h3>
              <p>After submitting this form, we'll review your requirements and get back to you within 24 hours with a detailed quote for your project.</p>
            </div>

            <button type="submit" className="submit-button" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting Request...' : 'Request Quote'}
            </button>
          </form>
        </div>
      </div>

    </div>
  );
}