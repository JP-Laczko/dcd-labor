import { useState, useEffect } from 'react';
import '../styles/BookingModal.css';

export default function CrewBookingModal({ 
  isOpen, 
  onClose, 
  selectedDate, 
  booking = null
}) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    crewSize: '2',
    yardAcreage: '',
    services: [],
    preferredHour: '',
    notes: ''
  });

  useEffect(() => {
    if (isOpen && booking) {
      setFormData({
        name: booking.customer?.name || '',
        email: booking.customer?.email || '',
        phone: booking.customer?.phone || '',
        address: booking.customer?.address || booking.service?.address || '',
        crewSize: booking.service?.crewSize?.toString() || '2',
        yardAcreage: booking.service?.yardAcreage || '',
        services: booking.service?.services || [],
        preferredHour: booking.service?.preferredHour || '',
        notes: booking.service?.notes || ''
      });
    }
  }, [isOpen, booking]);

  if (!isOpen || !booking) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Booking Details (View Only)</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <p className="selected-date">
            Date: {selectedDate?.toLocaleDateString('en-US', { 
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
                  <label>Hourly Rate:</label>
                  <span>${booking?.service?.hourlyRate || 'N/A'}/hour</span>
                </div>
                <div className="detail-item">
                  <label>Yard Acreage:</label>
                  <span>{formData.yardAcreage || 'Not specified'}</span>
                </div>
                <div className="detail-item full-width">
                  <label>Services:</label>
                  <span>{formData.services.join(', ')}</span>
                </div>
                {formData.preferredHour && (
                  <div className="detail-item">
                    <label>Preferred Hour:</label>
                    <span>{formData.preferredHour.charAt(0).toUpperCase() + formData.preferredHour.slice(1).replace('-', ' ')}</span>
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
                  <span className={`status-${booking?.status?.current || 'unknown'}`}>
                    {booking?.status?.current || 'unknown'}
                  </span>
                </div>
                <div className="detail-item">
                  <label>Booking ID:</label>
                  <span>{booking?.bookingId || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>Created:</label>
                  <span>{booking?.metadata?.createdAt ? new Date(booking.metadata.createdAt).toLocaleDateString() : 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Only a close button - no edit, charge, or delete buttons */}
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="cancel-button">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}