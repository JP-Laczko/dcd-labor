import { useState, useEffect } from 'react';
import mongoService from '../services/mongoService';
import emailService from '../services/emailService';
import rateService from '../services/rateService';
import timeSlotUtils from '../utils/timeSlotUtils';
import SquarePayment from './SquarePayment';
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
  const [step, setStep] = useState(1); // 1: booking form, 2: payment, 3: confirmation
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
  const [availabilityCheck, setAvailabilityCheck] = useState({ checking: false, available: true, error: null });

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

  const depositAmount = 80; // Fixed deposit amount

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setStep(preFilledData ? 2 : 1); // Skip to payment if pre-filled data provided
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
      
      // If coming from Schedule page with pre-filled data, start with availability check
      if (preFilledData && selectedDate) {
        setAvailabilityCheck({ checking: true, available: true, error: null });
      } else {
        setAvailabilityCheck({ checking: false, available: true, error: null });
      }

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
      
      // If pre-filled data, immediately check availability
      if (preFilledData && selectedDate) {
        checkAvailability();
      }
    }
  }, [isOpen, preFilledData]);

  // Check availability when step changes to payment
  useEffect(() => {
    if (step === 2 && selectedDate) {
      checkAvailability();
    }
  }, [step, selectedDate]);

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

  const checkAvailability = async () => {
    setAvailabilityCheck({ checking: true, available: true, error: null });
    
    try {
      const dateString = selectedDate.toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      
      console.log('🗓️ Checking availability for:', {
        selectedDate: selectedDate,
        dateString: dateString,
        today: today,
        month: selectedDate.getMonth() + 1, // 1-based month
        isAugust: selectedDate.getMonth() === 7 // August is month 7 (0-based)
      });
      
      // FIRST CHECK: Block same-day booking
      if (dateString === today) {
        console.log('🗓️❌ Blocked: Same-day booking');
        setAvailabilityCheck({ 
          checking: false, 
          available: false, 
          error: 'Same-day booking is not available. Please select a future date.' 
        });
        return;
      }
      
      // Get current availability
      const availabilityResult = await mongoService.getAllCalendarAvailability();
      const bookingsResult = await mongoService.getBookings();
      
      console.log('🗓️ Raw availability result:', {
        success: availabilityResult.success,
        availabilityCount: availabilityResult.availability?.length || 0,
        allDates: availabilityResult.availability?.map(entry => ({
          date: entry.date,
          bookings: entry.bookings,
          isAugust: entry.date?.startsWith('2024-08') || entry.date?.startsWith('2025-08')
        })) || []
      });
      
      if (!availabilityResult.success || !bookingsResult.success) {
        console.log('🗓️❌ Failed to get availability or bookings data');
        throw new Error('Failed to check availability');
      }

      // Calculate availability for the selected date
      const calendarEntry = availabilityResult.availability
        .find(entry => entry.date === dateString);
      const allowedBookings = calendarEntry?.bookings || 0;
      
      console.log('🗓️ Calendar entry for date:', {
        dateString: dateString,
        calendarEntry: calendarEntry,
        allowedBookings: allowedBookings,
        foundInCalendar: !!calendarEntry
      });
      
      const existingBookings = bookingsResult.bookings
        .filter(booking => {
          const bookingDate = new Date(booking.service?.date || booking.date);
          const bookingDateString = bookingDate.toISOString().split('T')[0];
          const matches = bookingDateString === dateString;
          if (matches) {
            console.log('🗓️ Found existing booking for this date:', {
              bookingId: booking.bookingId,
              customerName: booking.customer?.name,
              bookingDate: bookingDateString
            });
          }
          return matches;
        }).length;

      const slotsRemaining = allowedBookings - existingBookings;
      
      console.log('🗓️ Availability calculation:', {
        dateString: dateString,
        allowedBookings: allowedBookings,
        existingBookings: existingBookings,
        slotsRemaining: slotsRemaining,
        available: slotsRemaining > 0
      });
      
      if (slotsRemaining <= 0) {
        setAvailabilityCheck({ 
          checking: false, 
          available: false, 
          error: 'This date is no longer available. Please select a different date.' 
        });
      } else {
        setAvailabilityCheck({ checking: false, available: true, error: null });
      }
    } catch (error) {
      console.error('Error checking availability:', error);
      setAvailabilityCheck({ 
        checking: false, 
        available: false, 
        error: 'Unable to verify availability. Please try again.' 
      });
    }
  };

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

  const handleContinueToPayment = async () => {
    if (validateForm()) {
      setStep(2);
    }
  };

  const handlePaymentSuccess = async (paymentData) => {
    setIsSubmitting(true);
    
    try {
      const bookingData = {
        customer: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          address: formData.address
        },
        service: {
          date: selectedDate.toISOString().split('T')[0],
          timeSlot: formData.timeSlot || selectedTimeSlot,
          displayTime: formData.displayTime || (selectedTimeSlot ? timeSlotUtils.formatTimeForDisplay(selectedTimeSlot) : ''),
          serviceType: formData.serviceType || 'hourly',
          crewSize: parseInt(formData.crewSize),
          hourlyRate: calculateHourlyRate(parseInt(formData.crewSize)),
          yardAcreage: formData.yardAcreage,
          services: formData.services,
          notes: formData.notes,
          leafHaul: formData.leafHaul
        }
      };

      // Create booking with payment confirmation using the payment-aware endpoint
      const response = await fetch('/api/create-booking-with-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookingData,
          paymentInfo: paymentData
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HTTP error! status: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }

      const result = await response.json();
      
      if (result.success) {
        // Send confirmation emails
        await emailService.sendBookingConfirmation(bookingData);
        
        // Set success result and go to confirmation
        setPaymentResult({
            success: true,
            bookingId: result.bookingId,
            paymentInfo: paymentData
          });
          setStep(3);
          onBookingChange();
        } else {
          setPaymentResult({
            success: false,
            error: result.error || 'Failed to create booking'
          });
          setStep(3);
        }
      } catch (error) {
        console.error('Error creating booking:', error);
        setPaymentResult({
          success: false,
          error: error.message || 'Failed to create booking'
        });
        setStep(3);
      } finally {
        setIsSubmitting(false);
      }
  };

  const handlePaymentError = (error) => {
    console.error('Payment error:', error);
    setPaymentResult({
      success: false,
      error: error || 'Payment failed'
    });
    setStep(3);
  };

  const handleBackToForm = () => {
    setStep(1);
    setAvailabilityCheck({ checking: false, available: true, error: null });
  };

  const handleClose = () => {
    setStep(1);
    setPaymentResult(null);
    setAvailabilityCheck({ checking: false, available: true, error: null });
    onClose();
  };

  if (!isOpen) return null;

  const getModalTitle = () => {
    switch (step) {
      case 1:
        return 'Book Your Service';
      case 2:
        return 'Secure Payment';
      case 3:
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

        <div className="deposit-info">
          <h4>Payment Required</h4>
          <p>A ${depositAmount} deposit is required to secure your booking. The deposit will be deducted from your final payment{formData.leafHaul ? '. Yard waste removal ($280) will be charged with the final payment' : ''}.</p>
        </div>

        {errors.submit && (
          <div className="error-text submit-error">{errors.submit}</div>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onClose} className="cancel-button">
            Cancel
          </button>
          <button 
            type="button" 
            onClick={handleContinueToPayment}
            className="submit-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Processing...' : 'Continue to Payment'}
          </button>
        </div>
      </form>
    </div>
  );

  const renderPaymentStep = () => (
    <div className="modal-body payment-step">
      {availabilityCheck.checking ? (
        <div className="availability-checking">
          <div className="loading-spinner"></div>
          <p>Checking availability...</p>
        </div>
      ) : !availabilityCheck.available ? (
        <div className="availability-error">
          <FaExclamationTriangle className="error-icon" />
          <h3>Date No Longer Available</h3>
          <p>{availabilityCheck.error}</p>
          <button 
            onClick={handleClose} 
            className="back-button"
          >
            Select Different Date
          </button>
        </div>
      ) : (
        <>
          <div className="booking-summary">
            <h3>Booking Summary</h3>
            <div className="summary-item">
              <span>Date:</span>
              <span>{selectedDate.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
            <div className="summary-item">
              <span>Name:</span>
              <span>{formData.name}</span>
            </div>
            <div className="summary-item">
              <span>Email:</span>
              <span>{formData.email}</span>
            </div>
            <div className="summary-item">
              <span>Phone:</span>
              <span>{formData.phone}</span>
            </div>
            <div className="summary-item">
              <span>Crew Size:</span>
              <span>{formData.crewSize}-Person Crew</span>
            </div>
            <div className="summary-item">
              <span>Services:</span>
              <span>{formData.services.join(', ')}</span>
            </div>
            {formData.leafHaul && (
              <div className="summary-item leaf-haul-item">
                <span>Yard Waste Removal:</span>
                <span>+$280</span>
              </div>
            )}
            <div className="summary-item">
              <span>Deposit:</span>
              <span>${depositAmount}</span>
            </div>
            <div className="summary-item total-item">
              <span><strong>Deposit Payment:</strong></span>
              <span><strong>${depositAmount}</strong></span>
            </div>
            {formData.leafHaul && (
              <div className="summary-note">
                <small>* Yard waste removal ($280) will be charged with final payment</small>
              </div>
            )}
          </div>

          <div className="payment-section">
            <SquarePayment
            amount={depositAmount}
            description={`$${depositAmount} deposit for landscaping service on ${selectedDate.toLocaleDateString()}`}
            customerInfo={{
              name: formData.name,
              email: formData.email,
              phone: formData.phone
            }}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
            onCancel={handleBackToForm}
            isProcessing={isSubmitting}
            saveCard={true}
          />
          </div>
        </>
      )}
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
            <p>Your booking has been successfully created and your payment has been processed.</p>
            
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
              <div className="info-item">
                <strong>Deposit Paid:</strong> ${paymentResult.paymentInfo?.amount || 80}
              </div>
            </div>

            <div className="next-steps">
              <h4>What's Next?</h4>
              <ul>
                <li>A confirmation email has been sent to {formData.email}</li>
                <li><strong>Payment:</strong> Your deposit has been successfully charged</li>
                <li>In production: We would text you within 24 hours to confirm appointment time</li>
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
            <h3>{paymentResult?.isAvailabilityError ? 'Date No Longer Available' : 'Booking Failed'}</h3>
          </div>
          
          <div className="error-details">
            {paymentResult?.isAvailabilityError ? (
              <>
                <p><strong>Your payment was processed, but the date is no longer available:</strong></p>
                <p className="error-message">{paymentResult?.error}</p>
                <p><strong>Important:</strong> Your deposit will be refunded automatically. Please select a different date for your booking.</p>
                <p>If you have any questions, please contact us and reference your payment confirmation.</p>
              </>
            ) : (
              <>
                <p>There was an issue processing your booking:</p>
                <p className="error-message">{paymentResult?.error}</p>
                <p>Please try again or contact us for assistance.</p>
              </>
            )}
          </div>

          <div className="modal-actions">
            {paymentResult?.isAvailabilityError ? (
              <button onClick={handleClose} className="cancel-button">
                Select Different Date
              </button>
            ) : (
              <>
                <button onClick={handleBackToForm} className="back-button">
                  Try Again
                </button>
                <button onClick={handleClose} className="cancel-button">
                  Close
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="modal-overlay">
      <div className={`modal-content payment-booking-modal ${step === 2 ? 'payment-modal' : ''}`}>
        <div className="modal-header">
          <h2>{getModalTitle()}</h2>
          <button className="close-button" onClick={handleClose}>×</button>
        </div>

        {step === 1 && renderBookingForm()}
        {step === 2 && renderPaymentStep()}
        {step === 3 && renderConfirmationStep()}
      </div>
    </div>
  );
}