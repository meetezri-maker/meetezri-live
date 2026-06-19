// Centralized config used across billing sub-services.

export const CLIENT_URL =
  process.env.CLIENT_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://sub.talktosolace2.ai'
    : 'http://localhost:5173');

