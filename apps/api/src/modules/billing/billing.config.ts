// Centralized config used across billing sub-services.

export const CLIENT_URL =
  process.env.CLIENT_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://meetezri-live-web.vercel.app'
    : 'http://localhost:5173');

