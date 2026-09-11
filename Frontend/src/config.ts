/**
 * Frontend Configuration.
 * Single source of truth for backend API base URL.
 */

export const config = {
  apiBaseUrl: (import.meta as any).env?.VITE_API_BASE_URL || 'http://127.0.0.1:3000',
};
