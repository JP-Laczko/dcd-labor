// Email service using Netlify Functions
// This avoids CORS issues by sending emails through a serverless function

import config from '../config/environment.js';

// Determine the API URL based on environment
const getApiUrl = () => {
  if (config.isDevelopment) {
    return 'http://localhost:3001/api';
  }
  // In production, use deployed backend URL from environment variable
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
};

export const emailService = {
  async sendBookingConfirmation(bookingData) {
    try {
      const apiUrl = `${getApiUrl()}/send-email`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookingData })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

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