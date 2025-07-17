// Simple rate service for managing team rates
// In production, this would be replaced with actual API calls

const DEFAULT_RATES = {
  twoMan: { low: 50, high: 70 },
  threeMan: { low: 75, high: 100 },
  fourMan: { low: 100, high: 130 }
};

export const rateService = {
  // Get current rates
  getRates: () => {
    const savedRates = localStorage.getItem('teamRates');
    return savedRates ? JSON.parse(savedRates) : DEFAULT_RATES;
  },

  // Save rates
  saveRates: (rates) => {
    localStorage.setItem('teamRates', JSON.stringify(rates));
    return Promise.resolve(rates);
  },

  // Get formatted rate string for display
  getFormattedRate: (teamSize) => {
    const rates = this.getRates();
    const rateKey = `${teamSize}Man`;
    
    if (rates[rateKey]) {
      return `$${rates[rateKey].low} - $${rates[rateKey].high}/hour`;
    }
    return 'Contact for pricing';
  }
};

export default rateService;