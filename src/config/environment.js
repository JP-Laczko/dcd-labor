// Environment configuration for DCD Labor

const config = {
  // Base URL Configuration
  BASE_URL: import.meta.env.BASE_URL || '/',
  
  // API Configuration - dynamically match current domain in production
  API_BASE_URL: (() => {
    // Use env var if set (for development)
    if (import.meta.env.VITE_API_BASE_URL) {
      return import.meta.env.VITE_API_BASE_URL;
    }
    
    // In production, use current domain
    if (import.meta.env.PROD && typeof window !== 'undefined') {
      return `${window.location.protocol}//${window.location.host}`;
    }
    
    // Fallback for development
    return 'http://localhost:3001';
  })(),
  
  // External Service Keys (placeholders - replace with actual values)
  STRIPE_PUBLISHABLE_KEY: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder',
  EMAILJS_SERVICE_ID: import.meta.env.VITE_EMAILJS_SERVICE_ID || 'service_placeholder',
  EMAILJS_TEMPLATE_ID: import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'template_placeholder',
  EMAILJS_PUBLIC_KEY: import.meta.env.VITE_EMAILJS_PUBLIC_KEY || 'public_key_placeholder',
  
  // MongoDB Configuration (for reference)
  MONGODB_URI: import.meta.env.VITE_MONGODB_URI || 'mongodb://localhost:27017/dcd-labor',
  
  // Application Settings
  APP_NAME: 'DCD Labor',
  COMPANY_EMAIL: 'contact@dcdlabor.com',
  COMPANY_PHONE: '(555) 123-4567',
  
  // Development/Production flags
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
};

export default config;