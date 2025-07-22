import { useState, useEffect } from 'react';
import mongoService from '../services/mongoService';
import emailService from '../services/emailService';
import rateService from '../services/rateService';
import '../styles/BookingModal.css';

export default function BookingModal({ 
  isOpen, 
  onClose, 
  selectedDate, 
  booking = null, // null for add, booking object for edit
  onBookingChange 
}) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    crewSize: '2',
    yardAcreage: '',
    services: [],
    notes: ''
  });

  const [rates, setRates] = useState({});
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [mode, setMode] = useState('add'); // 'add', 'view', 'edit'

  const services = [
    "Leaf Removal",
    "Lawn Mowing", 
    "Hedge Trimming",
    "Garden Cleanup",
    "Tree Pruning",
    "Mulching",
    "Weeding",
    "Other"
  ];

  useEffect(() => {
    if (isOpen) {
      // Load rates
      const currentRates = rateService.getRates();
      setRates(currentRates);

      // Determine initial mode
      if (booking) {
        setMode('view'); // Start in view mode for existing bookings
        setFormData({
          name: booking.customer?.name || '',
          email: booking.customer?.email || '',
          phone: booking.customer?.phone || '',
          address: booking.customer?.address || booking.service?.address || '',
          crewSize: booking.service?.crewSize?.toString() || '2',
          yardAcreage: booking.service?.yardAcreage || '',
          services: booking.service?.services || [],
          notes: booking.service?.notes || ''
        });
      } else {
        setMode('add'); // Add mode for new bookings
        setFormData({
          name: '',
          email: '',
          phone: '',
          address: '',
          crewSize: '2',
          yardAcreage: '',
          services: [],
          notes: ''
        });
      }
      setErrors({});
    }
  }, [isOpen, booking]);

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
      const bookingData = {
        ...formData,
        date: selectedDate.toISOString().split('T')[0],
        crewSize: parseInt(formData.crewSize)
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

  const renderViewMode = () => (
    <div className="modal-body">
      <p className="selected-date">
        Date: {selectedDate.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}
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
              <label>Yard Acreage:</label>
              <span>{formData.yardAcreage || 'Not specified'}</span>
            </div>
            <div className="detail-item full-width">
              <label>Services:</label>
              <span>{formData.services.join(', ')}</span>
            </div>
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
              <label>Services Needed *</label>
              <div className="services-grid">
                {services.map(service => (
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
    </div>
  );
}