import { useState } from 'react';
import { FaCalculator, FaMoneyBillWave, FaCheckCircle, FaExclamationTriangle, FaCreditCard } from 'react-icons/fa';
import '../styles/FinalPaymentModal.css';

export default function SquareFinalPayment({ 
  isOpen, 
  onClose, 
  booking, 
  onSuccess,
  rates = {} 
}) {
  const [step, setStep] = useState(1); // 1: calculation, 2: confirmation, 3: result
  const [chargeData, setChargeData] = useState({
    materialsCost: '',
    serviceHours: '',
    crewRate: booking?.service?.hourlyRate || rates[`${booking?.service?.crewSize || 2}Man`] || 0
  });
  const [paymentResult, setPaymentResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleInputChange = (e) => {
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
    const deposit = booking?.paymentInfo?.depositAmount || 80;
    const finalAmount = Math.max(0, subtotal - deposit);
    
    return {
      materials,
      laborCost,
      subtotal,
      deposit,
      finalAmount
    };
  };

  const validateCalculation = () => {
    return chargeData.materialsCost !== '' && 
           chargeData.serviceHours !== '' && 
           parseFloat(chargeData.materialsCost) >= 0 && 
           parseFloat(chargeData.serviceHours) >= 0;
  };

  const handleContinueToPayment = () => {
    if (validateCalculation()) {
      setStep(2);
    }
  };

  const handleProcessPayment = async () => {
    setIsProcessing(true);
    
    try {
      const totals = calculateTotal();
      
      if (totals.finalAmount <= 0) {
        // No payment needed, just complete the booking
        await handleCompleteBooking();
        return;
      }

      // Charge the stored card
      const response = await fetch('/api/square/charge-card-on-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: booking.paymentInfo.customerId,
          amount: Math.round(totals.finalAmount * 100), // Convert to cents
          currency: 'USD',
          description: `Final payment for ${booking.customer?.name} - ${new Date(booking.service?.date).toLocaleDateString()}`,
          locationId: import.meta.env.VITE_SQUARE_LOCATION_ID
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        await handleCompleteBooking();
        setPaymentResult({
          success: true,
          paymentInfo: result.payment,
          totals
        });
      } else {
        throw new Error(result.error || 'Payment failed');
      }
    } catch (error) {
      console.error('Final payment error:', error);
      setPaymentResult({
        success: false,
        error: error.message || 'Payment failed'
      });
    } finally {
      setIsProcessing(false);
      setStep(3);
    }
  };

  const handleCompleteBooking = async () => {
    // Delete the booking after successful payment
    const response = await fetch(`/api/bookings/${booking.bookingId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to complete booking: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to complete booking');
    }

    // Notify parent component
    onSuccess({
      bookingId: booking.bookingId,
      totals: calculateTotal()
    });
  };

  const handleBackToCalculation = () => {
    setStep(1);
  };

  const handleClose = () => {
    setStep(1);
    setPaymentResult(null);
    setChargeData({
      materialsCost: '',
      serviceHours: '',
      crewRate: booking?.service?.hourlyRate || rates[`${booking?.service?.crewSize || 2}Man`] || 0
    });
    onClose();
  };

  if (!isOpen || !booking) return null;

  const totals = calculateTotal();
  const hasStoredCard = booking?.paymentInfo?.customerId;
  
  const getModalTitle = () => {
    switch (step) {
      case 1:
        return 'Calculate Final Payment';
      case 2:
        return 'Process Final Payment';
      case 3:
        return paymentResult?.success ? 'Payment Complete!' : 'Payment Failed';
      default:
        return 'Calculate Final Payment';
    }
  };

  const renderCalculationStep = () => (
    <div className="modal-body calculation-step">
      <div className="booking-header">
        <h3>Booking Details</h3>
        <div className="booking-info">
          <div className="info-item">
            <span>Customer:</span>
            <span>{booking.customer?.name}</span>
          </div>
          <div className="info-item">
            <span>Date:</span>
            <span>{new Date(booking.service?.date).toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</span>
          </div>
          <div className="info-item">
            <span>Crew Size:</span>
            <span>{booking.service?.crewSize}-Person Crew</span>
          </div>
          <div className="info-item">
            <span>Deposit Paid:</span>
            <span className="deposit-amount">${booking.paymentInfo?.depositAmount || 80}</span>
          </div>
        </div>

        {hasStoredCard && (
          <div className="stored-card-info">
            <FaCreditCard className="card-icon" />
            <span>Card on file will be used for final payment</span>
          </div>
        )}
      </div>

      <div className="calculation-form">
        <h3>
          <FaCalculator className="calc-icon" />
          Service Calculation
        </h3>
        
        <div className="form-group">
          <label htmlFor="materialsCost">Materials Cost ($)</label>
          <input
            type="number"
            id="materialsCost"
            name="materialsCost"
            value={chargeData.materialsCost}
            onChange={handleInputChange}
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
            onChange={handleInputChange}
            placeholder="0.0"
            min="0"
            step="0.5"
          />
        </div>

        <div className="form-group">
          <label>Crew Rate</label>
          <div className="crew-rate-display">
            ${chargeData.crewRate}/hour ({booking.service?.crewSize}-person crew)
          </div>
        </div>

        {chargeData.materialsCost !== '' && chargeData.serviceHours !== '' && (
          <div className="calculation-breakdown">
            <h4>Cost Breakdown</h4>
            <div className="breakdown-item">
              <span>Materials:</span>
              <span>${totals.materials.toFixed(2)}</span>
            </div>
            <div className="breakdown-item">
              <span>Labor ({chargeData.serviceHours} hrs × ${chargeData.crewRate}/hr):</span>
              <span>${totals.laborCost.toFixed(2)}</span>
            </div>
            <div className="breakdown-item subtotal">
              <span>Subtotal:</span>
              <span>${totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="breakdown-item">
              <span>Less Deposit:</span>
              <span>-${totals.deposit.toFixed(2)}</span>
            </div>
            <div className="breakdown-item total">
              <span><strong>Final Charge:</strong></span>
              <span><strong>${totals.finalAmount.toFixed(2)}</strong></span>
            </div>
          </div>
        )}
      </div>

      <div className="modal-actions">
        <button onClick={onClose} className="cancel-button">
          Cancel
        </button>
        <button 
          onClick={handleContinueToPayment}
          className="continue-button"
          disabled={!validateCalculation()}
        >
          {totals.finalAmount <= 0 ? 'Complete Booking' : `Charge $${totals.finalAmount.toFixed(2)}`}
        </button>
      </div>
    </div>
  );

  const renderConfirmationStep = () => (
    <div className="modal-body payment-step">
      <div className="payment-summary">
        <h3>
          <FaMoneyBillWave className="money-icon" />
          Confirm Final Payment
        </h3>
        
        <div className="summary-breakdown">
          <div className="summary-item">
            <span>Materials:</span>
            <span>${totals.materials.toFixed(2)}</span>
          </div>
          <div className="summary-item">
            <span>Labor:</span>
            <span>${totals.laborCost.toFixed(2)}</span>
          </div>
          <div className="summary-item">
            <span>Subtotal:</span>
            <span>${totals.subtotal.toFixed(2)}</span>
          </div>
          <div className="summary-item">
            <span>Less Deposit:</span>
            <span>-${totals.deposit.toFixed(2)}</span>
          </div>
          <div className="summary-item total">
            <span><strong>Amount to Charge:</strong></span>
            <span><strong>${totals.finalAmount.toFixed(2)}</strong></span>
          </div>
        </div>

        {hasStoredCard ? (
          <div className="payment-method">
            <FaCreditCard className="card-icon" />
            <div className="payment-method-text">
              <p><strong>Payment Method:</strong> Card on file</p>
              <p>The customer's saved card will be charged automatically.</p>
            </div>
          </div>
        ) : (
          <div className="no-card-warning">
            <FaExclamationTriangle className="warning-icon" />
            <p><strong>Warning:</strong> No saved card found. You'll need to collect payment manually.</p>
          </div>
        )}
      </div>

      <div className="modal-actions">
        <button onClick={handleBackToCalculation} className="cancel-button">
          Back
        </button>
        <button 
          onClick={handleProcessPayment}
          className="continue-button"
          disabled={isProcessing || (!hasStoredCard && totals.finalAmount > 0)}
        >
          {isProcessing ? (
            <>
              <div className="button-spinner"></div>
              Processing...
            </>
          ) : totals.finalAmount <= 0 ? (
            'Complete Booking'
          ) : (
            `Charge $${totals.finalAmount.toFixed(2)}`
          )}
        </button>
      </div>
    </div>
  );

  const renderResultStep = () => (
    <div className="modal-body confirmation-step">
      {paymentResult?.success ? (
        <>
          <div className="success-header">
            <FaCheckCircle className="success-icon" />
            <h3>Payment Complete!</h3>
          </div>
          
          <div className="completion-details">
            <p>The final payment has been processed successfully and the booking has been completed.</p>
            
            <div className="payment-summary-final">
              <div className="summary-item">
                <span>Customer:</span>
                <span>{booking.customer?.name}</span>
              </div>
              <div className="summary-item">
                <span>Final Payment:</span>
                <span>${paymentResult.totals.finalAmount.toFixed(2)}</span>
              </div>
              <div className="summary-item">
                <span>Total Service Cost:</span>
                <span>${paymentResult.totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="summary-item">
                <span>Total Paid:</span>
                <span>${(paymentResult.totals.deposit + paymentResult.totals.finalAmount).toFixed(2)}</span>
              </div>
            </div>

            <div className="completion-note">
              <p><strong>Note:</strong> The booking has been removed from your calendar as it is now complete.</p>
            </div>
          </div>

          <div className="modal-actions">
            <button onClick={handleClose} className="done-button">
              Done
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="error-header">
            <FaExclamationTriangle className="error-icon" />
            <h3>Payment Failed</h3>
          </div>
          
          <div className="error-details">
            <p>There was an issue processing the final payment:</p>
            <p className="error-message">{paymentResult?.error}</p>
            <p><strong>Important:</strong> The booking has NOT been deleted. Please try again or collect payment manually.</p>
          </div>

          <div className="modal-actions">
            <button onClick={handleBackToCalculation} className="retry-button">
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
      <div className={`modal-content final-payment-modal ${step === 2 ? 'payment-modal' : ''}`}>
        <div className="modal-header">
          <h2>{getModalTitle()}</h2>
          <button className="close-button" onClick={handleClose}>×</button>
        </div>

        {step === 1 && renderCalculationStep()}
        {step === 2 && renderConfirmationStep()}
        {step === 3 && renderResultStep()}
      </div>
    </div>
  );
}