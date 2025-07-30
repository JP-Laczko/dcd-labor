import { useState, useEffect } from 'react';
import mongoService from '../services/mongoService';
import emailService from '../services/emailService';
import rateService from '../services/rateService';
import timeSlotUtils from '../utils/timeSlotUtils';
import '../styles/BookingModal.css';

export default function BookingModal({ 
  isOpen, 
  onClose, 
  selectedDate, 
  booking = null, // null for add, booking object for edit
  onBookingChange,
  onFinalPayment = null // Optional prop for final payment functionality
}) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    serviceType: 'hourly', // Default to hourly for admin bookings
    crewSize: '2',
    yardAcreage: '',
    services: [],
    timeSlot: '',
    displayTime: '',
    notes: '',
    leafHaul: false
  });

  const [rates, setRates] = useState({});
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [chargeData, setChargeData] = useState({
    materialsCost: '',
    serviceHours: '',
    crewRate: 0
  });
  const [mode, setMode] = useState('add'); // 'add', 'view', 'edit'
  const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
  const [loadingTimeSlots, setLoadingTimeSlots] = useState(false);

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

  // Load available time slots for a selected date
  const loadTimeSlots = async (date) => {
    setLoadingTimeSlots(true);
    
    try {
      const dateString = date.toISOString().split('T')[0];
      const availability = await mongoService.getAllCalendarAvailability();
      
      if (availability.success) {
        const dayData = availability.availability.find(day => day.date === dateString);
        
        if (dayData && dayData.availability && dayData.availability.timeSlots) {
          // For admin booking, show ALL time slots (admins can override availability)
          const allSlots = dayData.availability.timeSlots
            .sort((a, b) => a.time.localeCompare(b.time));
          setAvailableTimeSlots(allSlots);
        } else {
          // Generate default time slots for the date based on business rules
          const defaultSlots = timeSlotUtils.generateDefaultTimeSlots(date);
          setAvailableTimeSlots(defaultSlots);
        }
      } else {
        const defaultSlots = timeSlotUtils.generateDefaultTimeSlots(date);
        setAvailableTimeSlots(defaultSlots);
      }
    } catch (error) {
      console.error('Error loading time slots:', error);
      setAvailableTimeSlots([]);
    } finally {
      setLoadingTimeSlots(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Load rates
      const loadRates = async () => {
        try {
          const ratesResult = await mongoService.getRates();
          let currentRates;
          if (ratesResult.success) {
            currentRates = ratesResult.rates;
          } else {
            // Fallback to rateService
            currentRates = rateService.getRates();
          }
          
          setRates(currentRates);

          // Set crew rate for charge calculation if booking exists
          if (booking && booking.service?.crewSize) {
            // Use stored hourly rate from booking, or fallback to current rates
            const storedRate = booking.service?.hourlyRate;
            const crewSizeKey = `${booking.service.crewSize}Man`;
            const fallbackRate = currentRates[crewSizeKey] || 0;
            
            setChargeData(prev => ({
              ...prev,
              crewRate: storedRate || fallbackRate
            }));
          }
        } catch (error) {
          console.error('Error loading rates:', error);
          // Fallback to rateService
          const currentRates = rateService.getRates();
          setRates(currentRates);
        }
      };
      
      loadRates();

      // Determine initial mode
      if (booking) {
        setMode('view'); // Start in view mode for existing bookings
        setFormData({
          name: booking.customer?.name || '',
          email: booking.customer?.email || '',
          phone: booking.customer?.phone || '',
          address: booking.customer?.address || booking.service?.address || '',
          serviceType: 'hourly', // Admin bookings default to hourly
          crewSize: booking.service?.crewSize?.toString() || '2',
          yardAcreage: booking.service?.yardAcreage || '',
          services: booking.service?.services || [],
          timeSlot: booking.service?.timeSlot || '',
          displayTime: booking.service?.displayTime || '',
          notes: booking.service?.notes || '',
          leafHaul: booking.leafHaul || false
        });
      } else {
        setMode('add'); // Add mode for new bookings
        setFormData({
          name: '',
          email: '',
          phone: '',
          address: '',
          serviceType: 'hourly', // Admin bookings default to hourly
          crewSize: '2',
          yardAcreage: '',
          services: [],
          timeSlot: '',
          displayTime: '',
          notes: '',
          leafHaul: false
        });
      }
      setErrors({});
      
      // Load time slots if we have a selected date
      if (selectedDate) {
        loadTimeSlots(selectedDate);
      }
    }
  }, [isOpen, booking, selectedDate]);

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
    if (!formData.timeSlot) newErrors.timeSlot = 'Please select a time slot';
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
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
      // Calculate hourly rate based on crew size and current rates
      const crewSizeMap = {
        2: 'twoMan',
        3: 'threeMan', 
        4: 'fourMan'
      };
      const crewSizeKey = crewSizeMap[parseInt(formData.crewSize)];
      const hourlyRate = rates[crewSizeKey] || 0;

      const bookingData = {
        ...formData,
        date: selectedDate.toISOString().split('T')[0],
        displayTime: formData.timeSlot ? timeSlotUtils.formatTimeForDisplay(formData.timeSlot) : '',
        crewSize: parseInt(formData.crewSize),
        hourlyRate: hourlyRate
      };

      let result;
      if (booking) {
        // Update existing booking
        result = await mongoService.updateBooking(booking.bookingId, bookingData);
      } else {
        // Create new booking
        result = await mongoService.createBooking(bookingData);
        
        // Send confirmation emails for new bookings
        if (result.success) {
          await emailService.sendBookingConfirmation(bookingData);
        }
      }

      if (result.success) {
        onBookingChange(); // Refresh calendar
        onClose();
      } else {
        setErrors({ submit: result.error || 'Failed to save booking' });
      }
    } catch (error) {
      console.error('Error saving booking:', error);
      setErrors({ submit: 'Failed to save booking' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!booking) return;

    setIsSubmitting(true);
    try {
      const result = await mongoService.deleteBooking(booking.bookingId);
      if (result.success) {
        onBookingChange(); // Refresh calendar
        onClose();
      } else {
        setErrors({ submit: result.error || 'Failed to delete booking' });
      }
    } catch (error) {
      console.error('Error deleting booking:', error);
      setErrors({ submit: 'Failed to delete booking' });
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleChargeClick = () => {
    if (!booking) return;
    
    console.log('🎯 BookingModal: Charge & Complete clicked, calling onFinalPayment');
    
    if (onFinalPayment) {
      // Use the proper SquareFinalPayment component
      onFinalPayment(booking);
    } else {
      // Fallback to old behavior if onFinalPayment not provided
      const storedRate = booking.service?.hourlyRate;
      const crewSizeKey = `${booking.service?.crewSize || 2}Man`;
      const fallbackRate = rates[crewSizeKey] || 0;
      
      setChargeData({
        materialsCost: '',
        serviceHours: '',
        crewRate: storedRate || fallbackRate
      });
      setShowChargeModal(true);
    }
  };

  const handleChargeInputChange = (e) => {
    const { name, value } = e.target;
    setChargeData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const calculateTotal = () => {
    const materials = parseFloat(chargeData.materialsCost) || 0;
    const hours = parseFloat(chargeData.serviceHours) || 0;
    const rate = chargeData.crewRate || 0;
    const laborCost = hours * rate;
    const subtotal = materials + laborCost;
    const deposit = 80; // Fixed deposit amount
    const finalAmount = Math.max(0, subtotal - deposit);
    
    return {
      materials,
      laborCost,
      subtotal,
      deposit,
      finalAmount
    };
  };

  const handleCharge = async () => {
    if (!booking) return;

    // Validate inputs
    if (!chargeData.materialsCost || !chargeData.serviceHours) {
      alert('Please fill in both materials cost and service hours');
      return;
    }

    const totals = calculateTotal();
    
    setIsSubmitting(true);
    try {
      // Here you would integrate with your payment processing
      // For now, we'll just simulate the charge
      const confirmed = window.confirm(
        `Charge $${totals.finalAmount.toFixed(2)} to customer's card?
        
Breakdown:
Materials: $${totals.materials.toFixed(2)}
Labor (${chargeData.serviceHours} hours × $${chargeData.crewRate}/hr): $${totals.laborCost.toFixed(2)}
Subtotal: $${totals.subtotal.toFixed(2)}
Less Deposit: -$${totals.deposit.toFixed(2)}
Final Charge: $${totals.finalAmount.toFixed(2)}`
      );

      if (confirmed) {
        // Process payment and delete booking
        const result = await mongoService.deleteBooking(booking.bookingId);
        if (result.success) {
          alert('Payment processed successfully! Booking has been completed and removed.');
          onBookingChange(); // Refresh calendar
          onClose();
        } else {
          alert('Error processing charge: ' + result.error);
        }
      }
    } catch (error) {
      console.error('Error processing charge:', error);
      alert('Error processing charge: ' + error.message);
    } finally {
      setIsSubmitting(false);
      setShowChargeModal(false);
    }
  };

  const renderViewMode = () => (
    <div className="modal-body">
      <p className="selected-date">
        Date: {selectedDate.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}
        {formData.timeSlot && (
          <span className="selected-time">
            {' at '}{formData.displayTime || timeSlotUtils.formatTimeForDisplay(formData.timeSlot)}
          </span>
        )}
      </p>

      <div className="booking-details-view">
        <div className="detail-section">
          <h3>Customer Information</h3>
          <div className="detail-grid">
            <div className="detail-item">
              <label>Name:</label>
              <span>{formData.name}</span>
            </div>
            <div className="detail-item">
              <label>Email:</label>
              <span>{formData.email}</span>
            </div>
            <div className="detail-item">
              <label>Phone:</label>
              <span>{formData.phone}</span>
            </div>
            <div className="detail-item">
              <label>Address:</label>
              <span>{formData.address}</span>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <h3>Service Details</h3>
          <div className="detail-grid">
            <div className="detail-item">
              <label>Crew Size:</label>
              <span>{formData.crewSize}-Person Crew</span>
            </div>
            <div className="detail-item">
              <label>Hourly Rate:</label>
              <span>${(() => {
                const storedRate = booking?.service?.hourlyRate;
                const crewSizeMap = { 2: 'twoMan', 3: 'threeMan', 4: 'fourMan' };
                const crewSizeKey = crewSizeMap[parseInt(formData.crewSize)];
                const fallbackRate = rates[crewSizeKey];
                console.log('💰 Rate calculation debug:', {
                  storedRate,
                  crewSize: formData.crewSize,
                  crewSizeKey,
                  fallbackRate,
                  rates
                });
                return storedRate || fallbackRate || 'N/A';
              })()}/hour</span>
            </div>
            <div className="detail-item">
              <label>Yard Acreage:</label>
              <span>{formData.yardAcreage || 'Not specified'}</span>
            </div>
            <div className="detail-item full-width">
              <label>Services:</label>
              <span>
                {formData.services.join(', ')}
                {formData.leafHaul && (
                  <span className="addon-service">
                    {formData.services.length > 0 ? ', ' : ''}
                    Yard waste removal (+$280)
                  </span>
                )}
              </span>
            </div>
            {formData.timeSlot && (
              <div className="detail-item">
                <label>Scheduled Time:</label>
                <span>{formData.displayTime || timeSlotUtils.formatTimeForDisplay(formData.timeSlot)}</span>
              </div>
            )}
            {formData.serviceType && (
              <div className="detail-item">
                <label>Service Type:</label>
                <span>{formData.serviceType.charAt(0).toUpperCase() + formData.serviceType.slice(1)}</span>
              </div>
            )}
            {formData.notes && (
              <div className="detail-item full-width">
                <label>Notes:</label>
                <span>{formData.notes}</span>
              </div>
            )}
          </div>
        </div>

        <div className="detail-section">
          <h3>Booking Information</h3>
          <div className="detail-grid">
            <div className="detail-item">
              <label>Status:</label>
              <span className={`status-${booking?.status?.current || 'pending'}`}>
                {booking?.status?.current || 'pending'}
              </span>
            </div>
            <div className="detail-item">
              <label>Booking ID:</label>
              <span>{booking?.bookingId || 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="modal-actions">
        <button type="button" onClick={onClose} className="cancel-button">
          Close
        </button>
        <button 
          type="button" 
          onClick={() => setMode('edit')}
          className="edit-button"
        >
          Edit Booking
        </button>
        <button 
          type="button" 
          onClick={handleChargeClick}
          className="charge-button"
        >
          Charge & Complete
        </button>
        <button 
          type="button" 
          onClick={() => setShowDeleteConfirm(true)}
          className="delete-button"
        >
          Delete Booking
        </button>
      </div>
    </div>
  );

  if (!isOpen) return null;

  const getModalTitle = () => {
    if (mode === 'view') return 'View Booking';
    if (mode === 'edit') return 'Edit Booking';
    return 'Add New Booking';
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>{getModalTitle()}</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        {mode === 'view' ? renderViewMode() : (
          <div className="modal-body">
            <p className="selected-date">
              Date: {selectedDate.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
              {formData.timeSlot && (
                <span className="selected-time">
                  {' at '}{formData.displayTime || timeSlotUtils.formatTimeForDisplay(formData.timeSlot)}
                </span>
              )}
            </p>

            <form onSubmit={handleSubmit} className="booking-form">
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
                >
                  <option value="2">2-Man Crew</option>
                  <option value="3">3-Man Crew</option>
                  <option value="4">4-Man Crew</option>
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
              <label htmlFor="timeSlot">Preferred Time *</label>
              {selectedDate ? (
                loadingTimeSlots ? (
                  <div className="loading-time-slots">
                    <p>Loading available times...</p>
                  </div>
                ) : availableTimeSlots.length > 0 ? (
                  <select
                    id="timeSlot"
                    name="timeSlot"
                    value={formData.timeSlot}
                    onChange={(e) => {
                      const timeSlot = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        timeSlot: timeSlot,
                        displayTime: timeSlot ? timeSlotUtils.formatTimeForDisplay(timeSlot) : ''
                      }));
                      if (errors.timeSlot) {
                        setErrors(prev => ({ ...prev, timeSlot: '' }));
                      }
                    }}
                    className={errors.timeSlot ? "error" : ""}
                  >
                    <option value="">Select a time</option>
                    {availableTimeSlots.map(slot => (
                      <option key={slot.time} value={slot.time}>
                        {slot.displayTime}{!slot.isAvailable ? ' (Booked)' : ''}
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
                  <p>Selected date will be used to load available times</p>
                </div>
              )}
              {errors.timeSlot && <span className="error-text">{errors.timeSlot}</span>}
            </div>

            <div className="form-group">
              <label>Select Services *</label>
              <div className="services-grid">
                {hourlyServices.map(service => (
                  <div key={service} className="service-item">
                    <input
                      type="checkbox"
                      id={service}
                      checked={formData.services.includes(service)}
                      onChange={() => handleServiceChange(service)}
                    />
                    <label htmlFor={service}>{service}</label>
                  </div>
                ))}
                
                {/* Yard Waste Removal */}
                <div className="service-item">
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
              {errors.services && <span className="error-text">{errors.services}</span>}
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

            {errors.submit && (
              <div className="error-text submit-error">{errors.submit}</div>
            )}

              <div className="modal-actions">
                <button type="button" onClick={onClose} className="cancel-button">
                  Cancel
                </button>
                
                {mode === 'edit' && (
                  <button 
                    type="button" 
                    onClick={() => setMode('view')}
                    className="cancel-button"
                  >
                    Back to View
                  </button>
                )}
                
                {booking && mode === 'edit' && (
                  <button 
                    type="button" 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="delete-button"
                    disabled={isSubmitting}
                  >
                    Remove Booking
                  </button>
                )}
                
                <button 
                  type="submit" 
                  className="submit-button"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : (booking ? 'Update Booking' : 'Create Booking')}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content delete-confirm">
            <h3>Confirm Deletion</h3>
            <p>Are you sure you want to remove this booking? This action cannot be undone.</p>
            <div className="modal-actions">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="cancel-button"
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete}
                className="delete-button"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Deleting...' : 'Remove Booking'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Charge Modal */}
      {showChargeModal && (
        <div className="modal-overlay">
          <div className="modal-content charge-modal">
            <div className="modal-header">
              <h3>Charge & Complete Booking</h3>
              <button className="close-button" onClick={() => setShowChargeModal(false)}>&times;</button>
            </div>
            
            <div className="modal-body">
              <div className="charge-form">
                <div className="form-group">
                  <label htmlFor="materialsCost">Materials Cost ($)</label>
                  <input
                    type="number"
                    id="materialsCost"
                    name="materialsCost"
                    value={chargeData.materialsCost}
                    onChange={handleChargeInputChange}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="serviceHours">Service Hours</label>
                  <input
                    type="number"
                    id="serviceHours"
                    name="serviceHours"
                    value={chargeData.serviceHours}
                    onChange={handleChargeInputChange}
                    placeholder="0.0"
                    min="0"
                    step="0.5"
                  />
                </div>

                <div className="form-group">
                  <label>Crew Rate</label>
                  <div className="crew-rate-display">
                    ${chargeData.crewRate}/hour ({booking?.service?.crewSize || 2}-man crew)
                  </div>
                </div>

                {chargeData.materialsCost && chargeData.serviceHours && (
                  <div className="calculation-breakdown">
                    <h4>Cost Breakdown</h4>
                    <div className="breakdown-item">
                      <span>Materials:</span>
                      <span>${calculateTotal().materials.toFixed(2)}</span>
                    </div>
                    <div className="breakdown-item">
                      <span>Labor ({chargeData.serviceHours} hrs × ${chargeData.crewRate}/hr):</span>
                      <span>${calculateTotal().laborCost.toFixed(2)}</span>
                    </div>
                    <div className="breakdown-item subtotal">
                      <span>Subtotal:</span>
                      <span>${calculateTotal().subtotal.toFixed(2)}</span>
                    </div>
                    <div className="breakdown-item">
                      <span>Less Deposit:</span>
                      <span>-${calculateTotal().deposit.toFixed(2)}</span>
                    </div>
                    <div className="breakdown-item total">
                      <span><strong>Final Charge:</strong></span>
                      <span><strong>${calculateTotal().finalAmount.toFixed(2)}</strong></span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="btn-secondary" 
                onClick={() => setShowChargeModal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-primary charge-confirm-btn" 
                onClick={handleCharge}
                disabled={isSubmitting || !chargeData.materialsCost || !chargeData.serviceHours}
              >
                {isSubmitting ? 'Processing...' : 'Charge & Complete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}