/** @type {import('next').NextConfig} */
const nextConfig = {
  // Old account URLs stay alive: NOWPayments returns to them (PORTAL_SUCCESS_URL / PORTAL_CANCEL_URL).
  async redirects() {
    return [
      { source: '/api-access', destination: '/dashboard/billing', permanent: false },
      { source: '/billing', destination: '/dashboard/billing', permanent: false },
    ];
  },
};

export default nextConfig;
