// Simple rate service for managing team rates
// In production, this would be replaced with actual API calls

const DEFAULT_RATES = {
  twoMan: 70,
  threeMan: 100,
  fourMan: 130
};

export const rateService = {
  // Get current rates
  getRates: () => {
    const savedRates = localStorage.getItem('teamRates');
    if (savedRates) {
      const parsed = JSON.parse(savedRates);
      
      // Check if we have old format and migrate it
      if (parsed.twoMan && typeof parsed.twoMan === 'object' && parsed.twoMan.high) {
        console.log('Migrating old rate format to new single-rate format');
        const migratedRates = {
          twoMan: parsed.twoMan.high || 70,
          threeMan: parsed.threeMan.high || 100,
          fourMan: parsed.fourMan.high || 130
        };
        // Save the migrated format
        localStorage.setItem('teamRates', JSON.stringify(migratedRates));
        return migratedRates;
      }
      
      return parsed;
    }
    return DEFAULT_RATES;
  },

  // Save rates
  saveRates: (rates) => {
    localStorage.setItem('teamRates', JSON.stringify(rates));
    return Promise.resolve(rates);
  },

  // Get formatted rate string for display
  getFormattedRate: (teamSize) => {
    const rates = rateService.getRates();
    const rateKey = `${teamSize}Man`;
    
    if (rates[rateKey]) {
      return `$${rates[rateKey]}/hour`;
    }
    return 'Contact for pricing';
  }
};

export default rateService;