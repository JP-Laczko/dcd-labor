import { useState, useEffect } from 'react';
import { 
  FaCreditCard, 
  FaLock, 
  FaShieldAlt, 
  FaCheckCircle,
  FaExclamationTriangle 
} from 'react-icons/fa';
import '../styles/SquarePayment.css';

export default function SquarePayment({ 
  amount, 
  description, 
  onSuccess, 
  onError, 
  onCancel,
  customerInfo = {},
  isProcessing = false,
  saveCard = true // Whether to save card for future charges
}) {
  const [payments, setPayments] = useState(null);
  const [card, setCard] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cardErrors, setCardErrors] = useState({});

  useEffect(() => {
    const initializeSquare = async () => {
      if (!window.Square) {
        console.error('Square.js failed to load');
        onError('Payment system failed to load. Please refresh the page.');
        return;
      }

      try {
        const paymentsInstance = window.Square.payments(
          import.meta.env.VITE_SQUARE_APPLICATION_ID,
          import.meta.env.VITE_SQUARE_LOCATION_ID
        );
        setPayments(paymentsInstance);
      } catch (error) {
        console.error('Failed to initialize Square payments:', error);
        onError('Failed to initialize payment system.');
      }
    };

    initializeSquare();
  }, [onError]);

  useEffect(() => {
    const initializeCard = async () => {
      if (!payments) return;

      try {
        const cardInstance = await payments.card({
          style: {
            '.input-container': {
              borderColor: '#d1d5db',
              borderRadius: '8px',
              borderWidth: '2px',
              padding: '12px'
            },
            '.input-container.is-focus': {
              borderColor: '#059669'
            },
            '.input-container.is-error': {
              borderColor: '#ef4444'
            },
            '.message-text': {
              color: '#ef4444',
              fontSize: '12px'
            },
            'input': {
              fontSize: '16px',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }
          }
        });

        await cardInstance.attach('#square-card-container');
        setCard(cardInstance);

        // Listen for card events
        cardInstance.addEventListener('cardBrandChanged', (event) => {
          console.log('Card brand changed:', event.cardBrand);
        });

        cardInstance.addEventListener('errorClassAdded', (event) => {
          setCardErrors(prev => ({
            ...prev,
            [event.field]: 'Invalid'
          }));
        });

        cardInstance.addEventListener('errorClassRemoved', (event) => {
          setCardErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[event.field];
            return newErrors;
          });
        });

      } catch (error) {
        console.error('Failed to initialize card:', error);
        onError('Failed to initialize card form.');
      }
    };

    initializeCard();

    return () => {
      if (card) {
        card.destroy();
      }
    };
  }, [payments, onError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!card || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Tokenize the card
      const tokenResult = await card.tokenize();
      
      if (tokenResult.status === 'OK') {
        console.log('Card tokenized:', tokenResult.token);
        
        // Create payment with token
        const response = await fetch('/api/square/create-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sourceId: tokenResult.token,
            amount: amount * 100, // Convert to cents
            currency: 'USD',
            description,
            customerInfo,
            saveCard,
            locationId: import.meta.env.VITE_SQUARE_LOCATION_ID
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
          onSuccess({
            paymentId: result.payment.id,
            amount: result.payment.amountMoney.amount / 100,
            currency: result.payment.amountMoney.currency,
            cardToken: result.cardToken, // For future charges
            customerId: result.customerId // Square customer ID
          });
        } else {
          throw new Error(result.error || 'Payment failed');
        }
      } else {
        // Handle tokenization errors
        let errorMessage = 'Card validation failed';
        if (tokenResult.errors) {
          errorMessage = tokenResult.errors.map(error => error.detail).join(', ');
        }
        onError(errorMessage);
      }
    } catch (error) {
      console.error('Payment error:', error);
      onError(error.message || 'Payment processing failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!payments) {
    return (
      <div className="square-loading">
        <div className="loading-spinner"></div>
        <p>Loading secure payment form...</p>
      </div>
    );
  }

  return (
    <div className="square-payment-container">
      {/* Security Header */}
      <div className="payment-security-header">
        <div className="security-badges">
          <div className="security-badge">
            <FaLock className="security-icon" />
            <span>SSL Encrypted</span>
          </div>
          <div className="security-badge">
            <FaShieldAlt className="security-icon" />
            <span>PCI Compliant</span>
          </div>
        </div>
        <div className="square-branding">
          <span>Powered by</span>
          <div className="square-logo">Square</div>
        </div>
      </div>

      {/* Payment Form */}
      <form onSubmit={handleSubmit} className="square-payment-form">
        <div className="payment-header">
          <FaCreditCard className="payment-icon" />
          <div className="payment-details">
            <h3>Secure Payment</h3>
            <p className="payment-amount">${amount.toFixed(2)} {saveCard ? 'Deposit' : 'Payment'}</p>
            <p className="payment-description">{description}</p>
          </div>
        </div>

        {/* Square Card Element */}
        <div className="form-group">
          <label>
            <FaCreditCard className="input-icon" />
            Payment Information
          </label>
          <div id="square-card-container" className="square-card-element">
            {/* Square.js will inject the card form here */}
          </div>
          {Object.keys(cardErrors).length > 0 && (
            <div className="card-errors">
              {Object.entries(cardErrors).map(([field, error]) => (
                <span key={field} className="error-text">
                  <FaExclamationTriangle /> {field}: {error}
                </span>
              ))}
            </div>
          )}
        </div>

        {saveCard && (
          <div className="save-card-notice">
            <FaShieldAlt className="shield-icon" />
            <div className="notice-text">
              <p>
                <strong>Card will be securely stored for final payment.</strong>
              </p>
              <p>
                Your card information is encrypted and stored securely by Square. 
                We'll use this card to process your final payment when the service is complete.
              </p>
            </div>
          </div>
        )}

        {/* Security Message */}
        <div className="security-message">
          <FaShieldAlt className="shield-icon" />
          <div className="security-text">
            <p>
              <strong>Your payment is secure and encrypted.</strong>
            </p>
            <p>
              We use Square, a PCI-compliant payment processor trusted by millions of businesses worldwide. 
              Your card information is never stored on our servers.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="payment-actions">
          <button
            type="button"
            onClick={onCancel}
            className="cancel-button"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="pay-button"
            disabled={isSubmitting || isProcessing}
          >
            {isSubmitting ? (
              <>
                <div className="button-spinner"></div>
                Processing...
              </>
            ) : (
              <>
                <FaLock className="lock-icon" />
                Pay ${amount.toFixed(2)} Securely
              </>
            )}
          </button>
        </div>
      </form>

      {/* Trust Indicators */}
      <div className="trust-indicators">
        <div className="trust-item">
          <FaCheckCircle className="check-icon" />
          <span>256-bit SSL encryption</span>
        </div>
        <div className="trust-item">
          <FaCheckCircle className="check-icon" />
          <span>PCI DSS compliant</span>
        </div>
        <div className="trust-item">
          <FaCheckCircle className="check-icon" />
          <span>Square secure processing</span>
        </div>
      </div>
    </div>
  );
}