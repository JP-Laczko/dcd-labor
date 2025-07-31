import { useState, useEffect } from 'react';
import { FaCalculator, FaMoneyBillWave, FaCheckCircle, FaExclamationTriangle, FaCreditCard } from 'react-icons/fa';
import '../styles/FinalPaymentModal.css';

export default function SquareFinalPayment({ 
  isOpen, 
  onClose, 
  booking, 
  onSuccess,
  rates = {} 
}) {
  console.log('🎯 SquareFinalPayment component rendered. isOpen:', isOpen);
  const [step, setStep] = useState(1); // 1: calculation, 2: confirmation, 3: result
  const [chargeData, setChargeData] = useState({
    materialsCost: '',
    serviceHours: '',
    crewRate: 0
  });
  const [paymentResult, setPaymentResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Update crew rate when booking or rates change
  useEffect(() => {
    if (booking && rates) {
      const storedRate = booking.service?.hourlyRate;
      const crewSizeKey = `${booking.service?.crewSize || 2}Man`;
      const fallbackRate = rates[crewSizeKey] || 0;
      const finalRate = storedRate || fallbackRate;
      
      console.log('💰 Setting crew rate for booking:', booking.bookingId);
      
      setChargeData(prev => ({
        ...prev,
        crewRate: finalRate
      }));
    }
  }, [booking, rates]);

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
    
    console.log('💰 calculateTotal completed for final amount:', finalAmount);
    
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
    console.log('🎯 handleProcessPayment called!');
    setIsProcessing(true);
    
    try {
      const totals = calculateTotal();
      
      // If there's a final amount to charge, try to charge stored card or mark as manual
      if (totals.finalAmount > 0) {
        
        // Check if we have a stored card to charge
        if (booking?.paymentInfo?.customerId) {
        console.log('🎯 CHARGE BUTTON CLICKED - Initiating final payment charge for booking:', booking.bookingId);
        
        const requestPayload = {
          customerId: booking.paymentInfo.customerId,
          amount: Math.round(totals.finalAmount * 100), // Convert to cents
          currency: 'USD',
          description: `Final payment for landscaping service - Booking ${booking.bookingId}`,
          locationId: import.meta.env.VITE_SQUARE_LOCATION_ID
        };
        
        console.log('🎯 Request Payload prepared for amount:', totals.finalAmount);
        
        const response = await fetch('/api/square/charge-card-on-file', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestPayload),
        });

        console.log('🎯 API Response received, status:', response.status);

        if (!response.ok) {
          console.log('🎯❌ HTTP Error - Response not OK');
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const paymentResult = await response.json();
        
        console.log('🎯 Payment Result received, success:', paymentResult.success);
        
        if (!paymentResult.success) {
          console.log('🎯❌ Payment failed according to result:', paymentResult.error);
          throw new Error(paymentResult.error || 'Payment failed');
        }

        console.log('🎯✅ Final payment successful! Payment ID:', paymentResult.payment?.id);
        
        // Complete the booking after successful payment
        await handleCompleteBooking();
        
        setPaymentResult({
          success: true,
          paymentInfo: { 
            status: 'COMPLETED', 
            amount: totals.finalAmount * 100,
            paymentId: paymentResult.payment.id
          },
          totals
        });
        } else {
          // No stored card available - mark as manual collection required
          console.log('🎯❌ No stored card available - manual collection required for booking:', booking.bookingId);
          
          // Complete the booking but mark payment as manual
          await handleCompleteBooking();
          
          setPaymentResult({
            success: true,
            paymentInfo: { 
              status: 'MANUAL_COLLECTION_REQUIRED', 
              amount: totals.finalAmount * 100,
              message: 'Payment must be collected manually - no stored card available'
            },
            totals
          });
        }
      } else {
        // No final payment needed - just complete booking
        console.log('💳 No final payment needed');
        await handleCompleteBooking();
        setPaymentResult({
          success: true,
          paymentInfo: { status: 'COMPLETED', amount: 0 },
          totals
        });
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
    console.log('🎯 handleCompleteBooking called for booking:', booking.bookingId);
    
    // Send review email before deleting the booking
    let emailSent = false;
    try {
      console.log('📧 Attempting to send review email for booking:', booking.bookingId);
      const totals = calculateTotal();
      
      // Create enhanced booking data with payment details for review email
      const bookingDataWithTotals = {
        ...booking,
        finalPaymentDetails: {
          materialsCost: parseFloat(chargeData.materialsCost) || 0,
          serviceHours: parseFloat(chargeData.serviceHours) || 0,
          crewRate: chargeData.crewRate || 0,
          laborCost: totals.laborCost,
          subtotal: totals.subtotal,
          deposit: totals.deposit,
          finalAmount: totals.finalAmount,
          totalPaid: totals.deposit + totals.finalAmount
        }
      };
      
      console.log('📧 Sending review email request...');
      const reviewEmailResponse = await fetch('/api/send-review-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookingData: bookingDataWithTotals
        }),
      });

      if (reviewEmailResponse.ok) {
        const result = await reviewEmailResponse.json();
        console.log('✅ Review email sent successfully:', result);
        emailSent = true;
      } else {
        const errorText = await reviewEmailResponse.text();
        console.error('❌ Review email failed to send. Status:', reviewEmailResponse.status, 'Response:', errorText);
        // Continue with booking deletion even if email fails
      }
    } catch (error) {
      console.error('❌ Review email error:', error.message, error);
      // Continue with booking deletion even if email fails
    }

    // Only delete the booking after attempting to send the email
    console.log('🗑️ Now deleting booking after email attempt. Email sent:', emailSent);
    
    try {
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

      console.log('✅ Booking deleted successfully');

      // Notify parent component
      onSuccess({
        bookingId: booking.bookingId,
        totals: calculateTotal(),
        emailSent: emailSent
      });
    } catch (error) {
      console.error('❌ Error deleting booking:', error);
      throw error;
    }
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
  
  console.log('🎯💳 SquareFinalPayment - Stored card check for booking:', booking?.bookingId, 'hasStoredCard:', hasStoredCard);
  
  console.log('🎯💳 Payment processing initialized');
  
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

        <div className="payment-method">
          <FaCreditCard className="card-icon" />
          <div className="payment-method-text">
            {hasStoredCard && totals.finalAmount > 0 ? (
              <>
                <p><strong>Payment Method:</strong> Stored card on file</p>
                <p>The card used for your deposit will be charged for the final payment.</p>
              </>
            ) : totals.finalAmount > 0 ? (
              <>
                <p><strong>Payment Method:</strong> Manual card entry required</p>
                <p>No stored card available. You can enter card details below or collect payment manually.</p>
              </>
            ) : (
              <>
                <p><strong>Payment Method:</strong> No additional payment needed</p>
                <p>Your deposit covers the full service cost.</p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="modal-actions">
        <button onClick={handleBackToCalculation} className="cancel-button">
          Back
        </button>
        <button 
          onClick={handleProcessPayment}
          className="continue-button"
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <div className="button-spinner"></div>
              Processing...
            </>
          ) : totals.finalAmount <= 0 ? (
            'Complete Booking'
          ) : hasStoredCard ? (
            `Charge $${totals.finalAmount.toFixed(2)}`
          ) : (
            `Mark Complete (Manual: $${totals.finalAmount.toFixed(2)})`
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