import { useState, useEffect } from 'react';
import mongoService from '../services/mongoService';
import emailService from '../services/emailService';
import rateService from '../services/rateService';
import timeSlotUtils from '../utils/timeSlotUtils';
import { FaCalendarAlt, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import '../styles/BookingModal.css';

export default function PaymentBookingModal({ 
  isOpen, 
  onClose, 
  selectedDate, 
  selectedTimeSlot = null,
  onBookingChange,
  preFilledData = null
}) {
  const [step, setStep] = useState(1); // 1: booking form, 2: confirmation
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    crewSize: '2',
    yardAcreage: '',
    services: [],
    timeSlot: '',
    displayTime: '',
    notes: '',
    leafHaul: false
  });

  const [rates, setRates] = useState({});
  
  // Calculate hourly rate based on crew size and current rates
  const calculateHourlyRate = (crewSize) => {
    const crewSizeMap = {
      2: 'twoMan',
      3: 'threeMan', 
      4: 'fourMan'
    };
    const crewSizeKey = crewSizeMap[crewSize];
    return rates[crewSizeKey] || 0;
  };
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentResult, setPaymentResult] = useState(null);

  // Hourly Services (simple tasks)
  const hourlyServices = [
    "Leaf Cleanup",
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


  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setStep(1); // Always start with booking form
      // Set form data with time slot information
      const baseFormData = {
        name: '',
        email: '',
        phone: '',
        address: '',
        serviceType: 'hourly', // Default to hourly for calendar bookings
        crewSize: '2',
        yardAcreage: '',
        services: [],
        timeSlot: selectedTimeSlot || '',
        displayTime: selectedTimeSlot ? timeSlotUtils.formatTimeForDisplay(selectedTimeSlot) : '',
        notes: '',
        leafHaul: false
      };
      
      setFormData({
        ...baseFormData,
        ...preFilledData
      });
      setErrors({});
      setPaymentResult(null);

      // Load rates
      const loadRates = async () => {
        try {
          const ratesResult = await mongoService.getRates();
          let currentRates;
          if (ratesResult.success) {
            currentRates = ratesResult.rates;
          } else {
            currentRates = rateService.getRates();
          }
          setRates(currentRates);
        } catch (error) {
          console.error('Error loading rates:', error);
          const currentRates = rateService.getRates();
          setRates(currentRates);
        }
      };
      
      loadRates();
    }
  }, [isOpen, preFilledData]);

  // Remove payment step availability check

  // Prevent body scroll and shaking when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }

    // Cleanup on unmount
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isOpen]);


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
        [name]: ''
      }));
    }
  };


  const handleServiceChange = (service) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service]
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    if (!formData.phone.trim()) newErrors.phone = 'Phone is required';
    if (!formData.address.trim()) newErrors.address = 'Address is required';
    if (formData.services.length === 0) newErrors.services = 'Please select at least one service';
    if (!formData.timeSlot && !selectedTimeSlot) newErrors.timeSlot = 'Time slot is required';
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmitBooking = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Debug logging
      console.log('🔍 Booking submission debug:', {
        selectedDate,
        selectedTimeSlot,
        formDataTimeSlot: formData.timeSlot,
        formDataDisplayTime: formData.displayTime
      });

      // Validate selectedDate
      if (!selectedDate || !(selectedDate instanceof Date) || isNaN(selectedDate.getTime())) {
        console.error('❌ Invalid selectedDate:', selectedDate);
        setPaymentResult({
          success: false,
          error: 'Invalid date selected. Please refresh and try again.'
        });
        setStep(2);
        setIsSubmitting(false);
        return;
      }

      const dateString = selectedDate.toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      
      // Block same-day booking
      if (dateString === today) {
        setPaymentResult({
          success: false,
          error: 'Same-day booking is not available. Please select a future date.'
        });
        setStep(2);
        setIsSubmitting(false);
        return;
      }

      const bookingData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        date: dateString,
        timeSlot: formData.timeSlot || selectedTimeSlot,
        displayTime: formData.displayTime || (selectedTimeSlot ? (timeSlotUtils.formatTimeForDisplay ? timeSlotUtils.formatTimeForDisplay(selectedTimeSlot) : selectedTimeSlot) : ''),
        serviceType: formData.serviceType || 'hourly',
        crewSize: parseInt(formData.crewSize),
        yardAcreage: formData.yardAcreage,
        services: formData.services,
        notes: formData.notes,
        leafHaul: formData.leafHaul
      };

      // Create booking directly without payment
      const result = await mongoService.createBooking(bookingData);
      
      if (result.success) {
        // Send confirmation emails
        await emailService.sendBookingConfirmation(bookingData);
        
        // Set success result and go to confirmation
        setPaymentResult({
          success: true,
          bookingId: result.bookingId
        });
        setStep(2);
        onBookingChange();
      } else {
        setPaymentResult({
          success: false,
          error: result.error || 'Failed to create booking'
        });
        setStep(2);
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      setPaymentResult({
        success: false,
        error: error.message || 'Failed to create booking'
      });
      setStep(2);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToForm = () => {
    setStep(1);
  };

  const handleClose = () => {
    setStep(1);
    setPaymentResult(null);
    onClose();
  };

  if (!isOpen) return null;

  const getModalTitle = () => {
    switch (step) {
      case 1:
        return 'Book Your Service';
      case 2:
        return paymentResult?.success ? 'Booking Confirmed!' : 'Booking Failed';
      default:
        return 'Book Your Service';
    }
  };

  const renderBookingForm = () => (
    <div className="modal-body">
      <div className="booking-date-header">
        <FaCalendarAlt className="calendar-icon" />
        <div>
          <h3>Selected Date & Time</h3>
          <p className="selected-date">
            {selectedDate.toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
            {(formData.displayTime || (selectedTimeSlot && timeSlotUtils.formatTimeForDisplay(selectedTimeSlot))) && (
              <span className="selected-time">
                {' at '}{formData.displayTime || timeSlotUtils.formatTimeForDisplay(selectedTimeSlot)}
              </span>
            )}
          </p>
        </div>
      </div>

      <form className="booking-form">
        <div className="form-group">
          <label>Select Services *</label>
          <div className="services-grid">
            {hourlyServices.map(service => (
              <div key={service} className="leaf-haul-section">
                <div className="leaf-haul-checkbox">
                  <input
                    type="checkbox"
                    id={service}
                    checked={formData.services.includes(service)}
                    onChange={() => handleServiceChange(service)}
                  />
                  <label htmlFor={service} className="checkbox-label">
                    <span className="checkbox-text">{service}</span>
                  </label>
                </div>
              </div>
            ))}
            
            {/* Yard Waste Removal */}
            <div className="leaf-haul-section">
              <div className="leaf-haul-checkbox">
                <input
                  type="checkbox"
                  id="leafHaul"
                  name="leafHaul"
                  checked={formData.leafHaul}
                  onChange={(e) => setFormData(prev => ({ ...prev, leafHaul: e.target.checked }))}
                />
                <label htmlFor="leafHaul" className="checkbox-label">
                  <span className="checkbox-text">Yard waste removal</span>
                  <span className="addon-price">+$280</span>
                </label>
              </div>
            </div>
          </div>
          {errors.services && <span className="error-text">{errors.services}</span>}
        </div>

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
              className={errors.phone ? "error" : ""}
            />
            {errors.phone && <span className="error-text">{errors.phone}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="crewSize">Crew Size *</label>
            <select
              id="crewSize"
              name="crewSize"
              value={formData.crewSize}
              onChange={handleInputChange}
              className="form-select-styled"
            >
              <option value="2">2-Man Crew (${rates.twoMan || 70}/hr)</option>
              <option value="3">3-Man Crew (${rates.threeMan || 100}/hr)</option>
              <option value="4">4-Man Crew (${rates.fourMan || 130}/hr)</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="address">Service Address *</label>
          <input
            type="text"
            id="address"
            name="address"
            value={formData.address}
            onChange={handleInputChange}
            className={errors.address ? "error" : ""}
          />
          {errors.address && <span className="error-text">{errors.address}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="yardAcreage">Approximate Yard Acreage</label>
          <input
            type="text"
            id="yardAcreage"
            name="yardAcreage"
            value={formData.yardAcreage}
            onChange={handleInputChange}
            placeholder="e.g., 0.5 acres, 1/4 acre"
          />
        </div>

        <div className="form-group">
          <label htmlFor="notes">Additional Notes</label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            rows="3"
            placeholder="Any specific instructions or requests..."
          />
        </div>

        <div className="payment-info-section">
          <div className="payment-info-header">
            <h4>💳 Payment Information</h4>
          </div>
          <div className="payment-info-content">
            <p><strong>In-Person Payment:</strong> Payment will be collected when your service is completed.</p>
            <p>We'll contact you within 24 hours to confirm your booking and arrange all the details.</p>
          </div>
        </div>

        {errors.submit && (
          <div className="error-text submit-error">{errors.submit}</div>
        )}

        <div className="modal-actions booking-modal-actions">
          <button type="button" onClick={onClose} className="cancel-button">
            Cancel
          </button>
          <button 
            type="button" 
            onClick={handleSubmitBooking}
            className="submit-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating Booking...' : 'Book Service'}
          </button>
        </div>
      </form>
    </div>
  );


  const renderConfirmationStep = () => (
    <div className="modal-body confirmation-step">
      {paymentResult?.success ? (
        <>
          <div className="success-header">
            <FaCheckCircle className="success-icon" />
            <h3>Booking Confirmed!</h3>
          </div>
          
          <div className="confirmation-details">
            <p>Your booking has been successfully created.</p>
            
            <div className="booking-info">
              <div className="info-item">
                <strong>Booking ID:</strong> {paymentResult.bookingId}
              </div>
              <div className="info-item">
                <strong>Date:</strong> {selectedDate.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </div>
            </div>

            <div className="next-steps">
              <h4>What's Next?</h4>
              <ul>
                <li>A confirmation email has been sent to {formData.email}</li>
                <li><strong>Payment:</strong> Payment will be collected in person when service is complete</li>
                <li>We will contact you within 24 hours to confirm appointment details</li>
              </ul>
            </div>
          </div>

          <div className="modal-actions">
            <button onClick={handleClose} className="submit-button">
              Done
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="error-header">
            <FaExclamationTriangle className="error-icon" />
            <h3>Booking Failed</h3>
          </div>
          
          <div className="error-details">
            <p>There was an issue processing your booking:</p>
            <p className="error-message">{paymentResult?.error}</p>
            <p>Please try again or contact us for assistance.</p>
          </div>

          <div className="modal-actions">
            <button onClick={handleBackToForm} className="back-button">
              Try Again
            </button>
            <button onClick={handleClose} className="cancel-button">
              Close
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="modal-overlay">
      <div className={`modal-content payment-booking-modal`}>
        <div className="modal-header">
          <h2>{getModalTitle()}</h2>
          <button className="close-button" onClick={handleClose}>×</button>
        </div>

        {step === 1 && renderBookingForm()}
        {step === 2 && renderConfirmationStep()}
      </div>
    </div>
  );
}