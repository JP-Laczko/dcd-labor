// Email service using Resend API
// Replace 'YOUR_RESEND_API_KEY' with your actual API key

const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY || 'YOUR_RESEND_API_KEY';
const DCD_EMAIL = import.meta.env.VITE_DCD_EMAIL || 'info@dcdlabor.com';
const RESEND_API_URL = 'https://api.resend.com/emails';

export const emailService = {
  async sendBookingConfirmation(bookingData) {
    try {
      // Send email to customer
      await this.sendCustomerConfirmation(bookingData);
      
      // Send email to DCD team
      await this.sendDCDNotification(bookingData);
      
      return { success: true, message: 'Booking confirmation emails sent successfully' };
    } catch (error) {
      console.error('Error sending booking confirmation emails:', error);
      return { success: false, message: 'Failed to send confirmation emails' };
    }
  },

  async sendCustomerConfirmation(bookingData) {
    const crewSizeLabels = {
      '2': '2-Man Crew',
      '3': '3-Man Crew',
      '4': '4-Man Crew'
    };

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #22c55e; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 20px; background: #f9f9f9; }
          .booking-details { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; align-items: center; }
          .detail-label { font-weight: bold; display: flex; align-items: center; gap: 8px; }
          .services-list { margin: 10px 0; }
          .service-item { padding: 5px 0; display: flex; align-items: center; gap: 8px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
          .icon { font-size: 16px; }
          .header-icon { font-size: 24px; margin-bottom: 10px; }
          .next-steps { background: #e6f7ff; padding: 15px; border-radius: 8px; border-left: 4px solid #22c55e; margin: 15px 0; }
          .step-item { display: flex; align-items: center; gap: 10px; margin: 8px 0; }
          .contact-info { background: #f0f8ff; padding: 15px; border-radius: 8px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="header-icon">🌱</div>
            <h1>DCD Labor - Booking Confirmation</h1>
            <p>✅ Thank you for choosing our landscaping services!</p>
          </div>
          
          <div class="content">
            <h2>Hello ${bookingData.name},</h2>
            <p>We've received your booking request and will contact you within 24 hours to confirm your appointment and process the 50% deposit.</p>
            
            <div class="booking-details">
              <h3>📋 Booking Details</h3>
              
              <div class="detail-row">
                <span class="detail-label"><span class="icon">👤</span> Name:</span>
                <span>${bookingData.name}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label"><span class="icon">📧</span> Email:</span>
                <span>${bookingData.email}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label"><span class="icon">📞</span> Phone:</span>
                <span>${bookingData.phone}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label"><span class="icon">🏠</span> Service Address:</span>
                <span>${bookingData.address}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label"><span class="icon">📅</span> Preferred Date:</span>
                <span>${new Date(bookingData.date).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label"><span class="icon">👥</span> Crew Size:</span>
                <span>${crewSizeLabels[bookingData.crewSize] || bookingData.crewSize}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label"><span class="icon">🌿</span> Yard Acreage:</span>
                <span>${bookingData.yardAcreage}</span>
              </div>
              
              <div class="services-list">
                <div class="detail-label"><span class="icon">🛠️</span> Services Requested:</div>
                ${bookingData.services.map(service => `<div class="service-item">🔹 ${service}</div>`).join('')}
              </div>
              
              ${bookingData.notes ? `
              <div class="detail-row">
                <span class="detail-label"><span class="icon">📝</span> Additional Notes:</span>
                <span>${bookingData.notes}</span>
              </div>
              ` : ''}
            </div>
            
            <div class="next-steps">
              <h3>🚀 What's Next?</h3>
              <div class="step-item">📞 We'll call you within 24 hours to confirm your appointment</div>
              <div class="step-item">💳 A 50% deposit will be required to secure your booking</div>
              <div class="step-item">✅ We accept all major credit cards</div>
              <div class="step-item">🎯 Final payment is due upon completion of services</div>
            </div>
            
            <div class="contact-info">
              <p><strong>📞 Questions or changes?</strong> Contact us at:</p>
              <p><strong>📧 Email:</strong> ${DCD_EMAIL}<br>
              <strong>📞 Phone:</strong> (123) 456-7890</p>
            </div>
            
            <p>🙏 Thank you for choosing DCD Labor!</p>
          </div>
          
          <div class="footer">
            <p>🌱 DCD Labor - Professional Landscaping Services<br>
            📍 Athens, GA | 📧 ${DCD_EMAIL}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailData = {
      from: `DCD Labor <${DCD_EMAIL}>`,
      to: [bookingData.email],
      subject: 'Booking Confirmation - DCD Labor Services',
      html: htmlContent
    };

    return this.sendEmail(emailData);
  },

  async sendDCDNotification(bookingData) {
    const crewSizeLabels = {
      '2': '2-Man Crew',
      '3': '3-Man Crew',
      '4': '4-Man Crew'
    };

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1f2937; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 20px; background: #f9f9f9; }
          .booking-details { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; align-items: center; }
          .detail-label { font-weight: bold; display: flex; align-items: center; gap: 8px; }
          .services-list { margin: 10px 0; }
          .service-item { padding: 5px 0; display: flex; align-items: center; gap: 8px; }
          .urgent { background: #fee2e2; border: 1px solid #ef4444; padding: 15px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #ef4444; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
          .icon { font-size: 16px; }
          .header-icon { font-size: 32px; margin-bottom: 10px; }
          .action-steps { background: #f0f8ff; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 15px 0; }
          .step-item { display: flex; align-items: center; gap: 10px; margin: 8px 0; }
          .timestamp { background: #f3f4f6; padding: 10px; border-radius: 4px; text-align: center; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="header-icon">🚨</div>
            <h1>🔔 New Booking Request</h1>
            <p>⏰ A new customer has submitted a booking request</p>
          </div>
          
          <div class="content">
            <div class="urgent">
              <strong>⚠️ Action Required:</strong> Contact customer within 24 hours to confirm appointment and process deposit.
            </div>
            
            <div class="booking-details">
              <h3>👤 Customer Information</h3>
              
              <div class="detail-row">
                <span class="detail-label"><span class="icon">🏷️</span> Name:</span>
                <span>${bookingData.name}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label"><span class="icon">📧</span> Email:</span>
                <span><a href="mailto:${bookingData.email}">${bookingData.email}</a></span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label"><span class="icon">📞</span> Phone:</span>
                <span><a href="tel:${bookingData.phone}">${bookingData.phone}</a></span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label"><span class="icon">🏠</span> Service Address:</span>
                <span>${bookingData.address}</span>
              </div>
            </div>
            
            <div class="booking-details">
              <h3>🛠️ Service Details</h3>
              
              <div class="detail-row">
                <span class="detail-label"><span class="icon">📅</span> Preferred Date:</span>
                <span>${new Date(bookingData.date).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label"><span class="icon">👥</span> Crew Size:</span>
                <span>${crewSizeLabels[bookingData.crewSize] || bookingData.crewSize}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label"><span class="icon">🌿</span> Yard Acreage:</span>
                <span>${bookingData.yardAcreage}</span>
              </div>
              
              <div class="services-list">
                <div class="detail-label"><span class="icon">🔧</span> Services Requested:</div>
                ${bookingData.services.map(service => `<div class="service-item">🔹 ${service}</div>`).join('')}
              </div>
              
              ${bookingData.notes ? `
              <div class="detail-row">
                <span class="detail-label"><span class="icon">📝</span> Additional Notes:</span>
                <span>${bookingData.notes}</span>
              </div>
              ` : ''}
            </div>
            
            <div class="action-steps">
              <h3>🎯 Next Steps</h3>
              <div class="step-item">📞 Contact customer at <a href="tel:${bookingData.phone}">${bookingData.phone}</a> or <a href="mailto:${bookingData.email}">${bookingData.email}</a></div>
              <div class="step-item">✅ Confirm availability for ${new Date(bookingData.date).toLocaleDateString()}</div>
              <div class="step-item">💳 Process 50% deposit payment</div>
              <div class="step-item">👥 Schedule crew and equipment</div>
              <div class="step-item">📧 Send final confirmation to customer</div>
            </div>
            
            <div class="timestamp">
              <p><strong>⏰ Booking submitted at:</strong> ${new Date().toLocaleString()}</p>
            </div>
          </div>
          
          <div class="footer">
            <p>🏢 DCD Labor Admin System<br>
            🤖 This email was automatically generated from your booking system.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailData = {
      from: `DCD Labor System <${DCD_EMAIL}>`,
      to: [DCD_EMAIL],
      subject: `🔔 New Booking Request - ${bookingData.name} (${new Date(bookingData.date).toLocaleDateString()})`,
      html: htmlContent
    };

    return this.sendEmail(emailData);
  },

  async sendEmail(emailData) {
    // In development, just log the email instead of sending
    if (RESEND_API_KEY === 'YOUR_RESEND_API_KEY') {
      console.log('📧 Email would be sent:', emailData);
      return { success: true, message: 'Email logged (development mode)' };
    }

    try {
      const response = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`
        },
        body: JSON.stringify(emailData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return { success: true, data: result };
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }
};

export default emailService;