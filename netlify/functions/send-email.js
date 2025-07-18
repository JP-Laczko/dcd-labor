// Netlify Function for sending emails via Resend API
// This function handles CORS and keeps the Resend API key secure

exports.handler = async (event, context) => {
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { bookingData } = JSON.parse(event.body);

    if (!bookingData) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Booking data is required' }),
      };
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const DCD_EMAIL = process.env.DCD_EMAIL;

    if (!RESEND_API_KEY || !DCD_EMAIL) {
      console.error('Missing environment variables');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server configuration error' }),
      };
    }

    // Send customer confirmation email
    const customerEmailResult = await sendCustomerConfirmation(bookingData, RESEND_API_KEY, DCD_EMAIL);
    
    // Send DCD notification email
    const dcdEmailResult = await sendDCDNotification(bookingData, RESEND_API_KEY, DCD_EMAIL);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Booking confirmation emails sent successfully',
        details: {
          customerEmail: customerEmailResult,
          dcdEmail: dcdEmailResult
        }
      }),
    };

  } catch (error) {
    console.error('Error sending emails:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to send confirmation emails',
        message: error.message
      }),
    };
  }
};

async function sendCustomerConfirmation(bookingData, apiKey, dcdEmail) {
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
        .header { background: #22c55e; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .booking-details { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .detail-label { font-weight: bold; }
        .services-list { margin: 10px 0; }
        .service-item { padding: 5px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>DCD Labor - Booking Confirmation</h1>
          <p>Thank you for choosing our landscaping services!</p>
        </div>
        
        <div class="content">
          <h2>Hello ${bookingData.name},</h2>
          <p>We've received your booking request and will contact you within 24 hours to confirm your appointment and process the 50% deposit.</p>
          
          <div class="booking-details">
            <h3>Booking Details</h3>
            
            <div class="detail-row">
              <span class="detail-label">Name:</span>
              <span>${bookingData.name}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Email:</span>
              <span>${bookingData.email}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Phone:</span>
              <span>${bookingData.phone}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Service Address:</span>
              <span>${bookingData.address}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Preferred Date:</span>
              <span>${new Date(bookingData.date).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Crew Size:</span>
              <span>${crewSizeLabels[bookingData.crewSize] || bookingData.crewSize}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Approximate Yard Acreage:</span>
              <span>${bookingData.yardAcreage}</span>
            </div>
            
            <div class="services-list">
              <div class="detail-label">Services Requested:</div>
              ${bookingData.services.map(service => `<div class="service-item">• ${service}</div>`).join('')}
            </div>
            
            ${bookingData.notes ? `
            <div class="detail-row">
              <span class="detail-label">Additional Notes:</span>
              <span>${bookingData.notes}</span>
            </div>
            ` : ''}
          </div>
          
          <h3>What's Next?</h3>
          <ul>
            <li>We'll call you within 24 hours to confirm your appointment</li>
            <li>A 50% deposit will be required to secure your booking</li>
            <li>We accept all major credit cards</li>
            <li>Final payment is due upon completion of services</li>
          </ul>
          
          <p>If you have any questions or need to make changes to your booking, please contact us at:</p>
          <p><strong>Email:</strong> ${dcdEmail}<br>
          <strong>Phone:</strong> (123) 456-7890</p>
          
          <p>Thank you for choosing DCD Labor!</p>
        </div>
        
        <div class="footer">
          <p>DCD Labor - Professional Landscaping Services<br>
          Athens, GA | ${dcdEmail}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const emailData = {
    from: `DCD Labor <${dcdEmail}>`,
    to: [bookingData.email],
    subject: 'Booking Confirmation - DCD Labor Services',
    html: htmlContent
  };

  return await sendEmail(emailData, apiKey);
}

async function sendDCDNotification(bookingData, apiKey, dcdEmail) {
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
        .header { background: #1f2937; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .booking-details { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .detail-label { font-weight: bold; }
        .services-list { margin: 10px 0; }
        .service-item { padding: 5px 0; }
        .urgent { background: #fee2e2; border: 1px solid #ef4444; padding: 15px; margin: 15px 0; border-radius: 8px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔔 New Booking Request</h1>
          <p>A new customer has submitted a booking request</p>
        </div>
        
        <div class="content">
          <div class="urgent">
            <strong>⚠️ Action Required:</strong> Contact customer within 24 hours to confirm appointment and process deposit.
          </div>
          
          <div class="booking-details">
            <h3>Customer Information</h3>
            
            <div class="detail-row">
              <span class="detail-label">Name:</span>
              <span>${bookingData.name}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Email:</span>
              <span><a href="mailto:${bookingData.email}">${bookingData.email}</a></span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Phone:</span>
              <span><a href="tel:${bookingData.phone}">${bookingData.phone}</a></span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Service Address:</span>
              <span>${bookingData.address}</span>
            </div>
          </div>
          
          <div class="booking-details">
            <h3>Service Details</h3>
            
            <div class="detail-row">
              <span class="detail-label">Preferred Date:</span>
              <span>${new Date(bookingData.date).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Crew Size:</span>
              <span>${crewSizeLabels[bookingData.crewSize] || bookingData.crewSize}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Approximate Yard Acreage:</span>
              <span>${bookingData.yardAcreage}</span>
            </div>
            
            <div class="services-list">
              <div class="detail-label">Services Requested:</div>
              ${bookingData.services.map(service => `<div class="service-item">• ${service}</div>`).join('')}
            </div>
            
            ${bookingData.notes ? `
            <div class="detail-row">
              <span class="detail-label">Additional Notes:</span>
              <span>${bookingData.notes}</span>
            </div>
            ` : ''}
          </div>
          
          <div class="booking-details">
            <h3>Next Steps</h3>
            <ul>
              <li>Contact customer at <a href="tel:${bookingData.phone}">${bookingData.phone}</a> or <a href="mailto:${bookingData.email}">${bookingData.email}</a></li>
              <li>Confirm availability for ${new Date(bookingData.date).toLocaleDateString()}</li>
              <li>Process 50% deposit payment</li>
              <li>Schedule crew and equipment</li>
              <li>Send final confirmation to customer</li>
            </ul>
          </div>
          
          <p><strong>Booking submitted at:</strong> ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="footer">
          <p>DCD Labor Admin System<br>
          This email was automatically generated from your booking system.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const emailData = {
    from: `DCD Labor System <${dcdEmail}>`,
    to: [dcdEmail],
    subject: `🔔 New Booking Request - ${bookingData.name} (${new Date(bookingData.date).toLocaleDateString()})`,
    html: htmlContent
  };

  return await sendEmail(emailData, apiKey);
}

async function sendEmail(emailData, apiKey) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(emailData)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
  }

  return await response.json();
}