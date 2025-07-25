// Email service using Netlify Functions
// This avoids CORS issues by sending emails through a serverless function

import config from '../config/environment.js';

// Determine the API URL based on environment
const getApiUrl = () => {
  // Use environment variable if set, otherwise default to localhost
  const baseUrl = import.meta.env.VITE_API_BASE_URL || config.API_BASE_URL || 'http://localhost:3001';
  return `${baseUrl}/api`;
};

export const emailService = {
  async sendBookingConfirmation(bookingData) {
    try {
      const apiUrl = `${getApiUrl()}/send-email`;
      console.log('🔍 Email API URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookingData })
      });

      if (!response.ok) {
        console.error('❌ HTTP Error:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('❌ Response body:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      return { success: true, message: result.message, details: result.details };
    } catch (error) {
      console.error('Error sending booking confirmation emails:', error);
      return { 
        success: false, 
        message: 'Failed to send confirmation emails',
        error: error.message 
      };
    }
  },

};

export default emailService;