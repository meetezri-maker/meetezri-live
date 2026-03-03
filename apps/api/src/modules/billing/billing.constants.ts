export const STRIPE_PRICE_IDS = {
  core: 'price_1SzbZVBt6JG9FijPPF89RTfX',
  pro: 'price_1T45gWBt6JG9FijPOV0hXeF3',
} as const;

export const PLAN_LIMITS = {
  trial: {
    credits: 30, // 30 minutes hard cap
    features: [
      'Landing + How Ezri Works',
      'Signup / Login / Verification',
      'FaceTime Basic',
      'Session Start/End Protocol',
      'Minutes Deduction Tracking'
    ],
    payAsYouGoRate: null, // No PAYG
  },
  core: {
    credits: 200, // 200 minutes
    features: [
      'Full FaceTime',
      'Daily mood check-in & history',
      'Unlimited journals',
      'Curated wellness tools',
      'Avatar customization',
      'Usage dashboard'
    ],
    payAsYouGoRate: 0.20, // $5 per 25 mins
  },
  pro: {
    credits: 400, // 400 minutes
    features: [
      'Everything in Core',
      'Priority system handling',
      '90-day mood trend',
      'Export-ready journaling',
      'Full wellness library',
      'Detailed session logs'
    ],
    payAsYouGoRate: 0.20, // $5 per 25 mins
  },
};

export const PAYG_PACKAGES = [
  { minutes: 25, price: 5 },
];
