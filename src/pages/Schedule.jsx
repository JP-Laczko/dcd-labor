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
    serviceType: "", // "hourly" or "estimate"
    services: [],
    date: "",
    crewSize: "",
    yardAcreage: "",
    notes: ""
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

  // Hourly Services (simple tasks)
  const hourlyServices = [
    "Leaf Removal",
    "Weeding"
  ];

  // Estimate Services (complex tasks requiring assessment)
  const estimateServices = [
    "Lawn Mowing",
    "Hedge Trimming", 
    "Tree Removal",
    "Landscaping Design",
    "Mulching",
    "Garden Maintenance",
    "Pressure Washing"
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

  const handleServiceTypeChange = (serviceType) => {
    // Clear existing services when switching type
    setSelectedServiceType(serviceType);
    setFormData(prev => ({
      ...prev,
      serviceType: serviceType,
      services: []
    }));
    // Clear service errors
    if (errors.services) {
      setErrors(prev => ({
        ...prev,
        services: ""
      }));
    }
  };

  const handleServiceChange = (e) => {
    const { value, checked } = e.target;
    
    // Only allow changes if a service type is selected
    if (!selectedServiceType) return;
    
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
    if (!formData.serviceType) newErrors.serviceType = "Please select service type";
    if (formData.services.length === 0) newErrors.services = "Please select at least one service";
    if (!formData.date) newErrors.date = "Date is required";
    if (!selectedTimeSlot) newErrors.timeSlot = "Please select a time slot";
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

    setIsSubmitting(true);

    try {
      // Check date availability before proceeding to payment
      const dateString = new Date(formData.date).toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      
      // FIRST CHECK: Block same-day booking
      if (dateString === today) {
        alert('Same-day booking is not available. Please select a future date.');
        setIsSubmitting(false);
        return;
      }
      
      const availabilityCheck = await mongoService.checkDateAvailability(dateString);
      
      if (!availabilityCheck.isAvailable) {
        alert(`Sorry, ${new Date(formData.date).toLocaleDateString()} is not available for booking. Please choose another date.`);
        setIsSubmitting(false);
        return;
      }

      // Set the selected date and open payment modal
      setSelectedDate(new Date(formData.date));
      setShowPaymentModal(true);
      
    } catch (error) {
      console.error("Error checking availability:", error);
      alert("There was an error checking availability. Please try again.");
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
      notes: ""
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
            <h1>Schedule Your Service</h1>
            <p>Fill out the form below to book your landscaping service. We'll contact you to confirm your appointment and process an $80 deposit to secure your booking.</p>
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
                <label>Service Type * (choose one)</label>
                
                {/* Service Type Selection */}
                <div className="service-type-selection">
                  <div 
                    className={`service-type-card ${selectedServiceType === 'hourly' ? 'selected' : ''}`}
                    onClick={() => handleServiceTypeChange('hourly')}
                  >
                    <h4>Hourly Services</h4>
                    <p>Simple tasks with set hourly rates</p>
                    <ul>
                      {hourlyServices.map((service, idx) => (
                        <li key={idx}>{service}</li>
                      ))}
                    </ul>
                  </div>
                  
                  <div 
                    className={`service-type-card ${selectedServiceType === 'estimate' ? 'selected' : ''}`}
                    onClick={() => handleServiceTypeChange('estimate')}
                  >
                    <h4>Estimate Services</h4>
                    <p>Complex tasks requiring assessment</p>
                    <ul>
                      {estimateServices.slice(0, 3).map((service, idx) => (
                        <li key={idx}>{service}</li>
                      ))}
                      {estimateServices.length > 3 && <li>+ {estimateServices.length - 3} more...</li>}
                    </ul>
                  </div>
                </div>
                {errors.serviceType && <span className="error-text">{errors.serviceType}</span>}
                
                {/* Service Selection (shown only after type is selected) */}
                {selectedServiceType && (
                  <div className="selected-services-section">
                    <label>Select Services * (choose from {selectedServiceType} services)</label>
                    <div className="checkbox-group">
                      {(selectedServiceType === 'hourly' ? hourlyServices : estimateServices).map((service, index) => (
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
                )}
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
                <label htmlFor="timeSlot">Preferred Time *</label>
                {formData.date ? (
                  loadingTimeSlots ? (
                    <div className="loading-time-slots">
                      <p>Loading available times...</p>
                    </div>
                  ) : availableTimeSlots.length > 0 ? (
                    <select
                      id="timeSlot"
                      name="timeSlot"
                      value={selectedTimeSlot}
                      onChange={(e) => setSelectedTimeSlot(e.target.value)}
                      className={errors.timeSlot ? "error" : ""}
                    >
                      <option value="">Select a time</option>
                      {availableTimeSlots.map(slot => (
                        <option key={slot.time} value={slot.time}>
                          {slot.displayTime}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="no-time-slots">
                      <p>No time slots available for this date</p>
                    </div>
                  )
                ) : (
                  <div className="select-date-first">
                    <p>Please select a date first</p>
                  </div>
                )}
                {errors.timeSlot && <span className="error-text">{errors.timeSlot}</span>}
              </div>

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
              <p>An $80 deposit is required to secure your booking. After submitting this form, you'll be prompted to complete the secure payment using Square's payment system.</p>
            </div>

            <button type="submit" className="submit-button" disabled={isSubmitting}>
              {isSubmitting ? 'Checking Availability...' : 'Continue to Payment'}
            </button>
          </form>
        </div>
      </div>

      {/* Payment Modal */}
      <PaymentBookingModal
        isOpen={showPaymentModal}
        onClose={handleClosePaymentModal}
        selectedDate={selectedDate}
        selectedTimeSlot={selectedTimeSlot}
        onBookingChange={handleBookingChange}
        preFilledData={formData}
      />
    </div>
  );
}