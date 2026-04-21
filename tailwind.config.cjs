module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      keyframes: {
        'live-badge-pulse': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.88', transform: 'scale(1.035)' },
        },
        'score-goal-flash': {
          '0%': { filter: 'drop-shadow(0 0 0 transparent)' },
          '40%': { filter: 'drop-shadow(0 0 14px rgba(239,68,68,0.65))' },
          '100%': { filter: 'drop-shadow(0 0 0 transparent)' },
        },
      },
      animation: {
        'live-badge-pulse': 'live-badge-pulse 2.2s ease-in-out infinite',
        'score-goal-flash': 'score-goal-flash 0.35s ease-out 1',
      },
    },
  },
  plugins: [],
};
