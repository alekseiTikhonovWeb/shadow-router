import { LogtoNextConfig } from '@logto/next';

// Same Logto tenant as the chat, so one SSO. Secrets (appSecret, cookieSecret) come from env only.
export const logtoConfig: LogtoNextConfig = {
  endpoint: process.env.LOGTO_ENDPOINT!,
  appId: process.env.LOGTO_APP_ID!,
  appSecret: process.env.LOGTO_APP_SECRET!,
  baseUrl: process.env.BASE_URL ?? 'http://localhost:3000',
  cookieSecret: process.env.LOGTO_COOKIE_SECRET!,
  cookieSecure: process.env.NODE_ENV === 'production',
  scopes: ['email', 'profile'],
};
