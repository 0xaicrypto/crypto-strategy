/**
 * Strategy Configuration & Thresholds
 */

export const STRATEGY_CONFIG = {
  // Base DCA amount (in USD per period, e.g., weekly $500)
  baseDcaAmountUsd: 500,

  // Risk budget limits: Maximum allowable allocation per asset class
  allocationCaps: {
    btcMax: 0.85,
    ethMax: 0.35,
    singleAltcoinMax: 0.05, // e.g., Starknet (STRK) must NOT exceed 5%
    totalAltcoinsMax: 0.15, // all alts combined <= 15%
    cashMinInBull: 0.10,    // always keep at least 10% cash/stables
    cashMaxInPeak: 0.70,    // at cycle peak, scale cash up to 70%
  },

  // Cycle Temperature thresholds (0 - 100)
  cycleThresholds: {
    capitulationMax: 25,    // 0 - 25: Extreme undervaluation / Deep Bear
    accumulationMax: 48,    // 26 - 48: Healthy accumulation / Early Bull
    markupMax: 72,          // 49 - 72: Main bull markup / Fair to hot
    distributionMin: 73,    // 73 - 100: Overheated / Bubble / Exit zone
  },

  // Dynamic DCA Multipliers
  multipliers: {
    deepCapitulation: 2.5,  // Temp < 20
    accumulationHigh: 1.5,  // Temp 20 - 35
    accumulationNormal: 1.0,// Temp 35 - 48
    markupLow: 0.5,         // Temp 49 - 60
    neutralHold: 0.0,       // Temp 61 - 72 (stop buying, hold)
    scaleOutSmall: -0.15,   // Temp 73 - 85 (sell 15% of spot)
    scaleOutAggressive: -0.35, // Temp > 85 (sell 35% of spot)
  },

  // Altcoin (e.g. STRK) Specific Safety Thresholds
  altcoinThresholds: {
    minFloatRatio: 0.20,             // Float < 20% incurs heavy dilution penalty
    maxMonthlyUnlockPct: 0.04,       // Monthly unlock > 4% of circ supply is high risk
    maxFdvToTvlRatio: 15.0,          // FDV / TVL > 15 is considered overpriced for L2
    strkHardCapPortfolioPct: 0.03,   // STRK strictly capped at 3%
  },

  // Public Free API Endpoints
  apis: {
    coingeckoBase: 'https://api.coingecko.com/api/v3',
    fearGreedEndpoint: 'https://api.alternative.me/fng/?limit=90',
    defillamaBase: 'https://api.llama.fi',
    defillamaFeesBase: 'https://api.llama.fi/overview/fees',
  },
};
