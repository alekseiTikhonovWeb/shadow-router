// The one place for links to the other surfaces; env overrides are for domain transitions only.
export const CHAT_URL = process.env.NEXT_PUBLIC_CHAT_URL ?? 'https://chat.shadowrouter.ca';
export const API_URL = process.env.NEXT_PUBLIC_LITELLM_URL ?? 'https://api.shadowrouter.ca/v1';
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@wasd.digital';

// Host only, for the legal pages.
export const CHAT_HOST = new URL(CHAT_URL).host;
export const API_HOST = new URL(API_URL).host;
