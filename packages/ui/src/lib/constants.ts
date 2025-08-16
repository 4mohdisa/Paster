
export const isProductionEnvironment = process.env.NODE_ENV === 'production';
export const isDevelopmentEnvironment = process.env.NODE_ENV === 'development';
export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT,
);

export const guestRegex = /^guest-\d+$/;

export const DUMMY_PASSWORD = "dummy-password";

export const XANO_BASE_URL = 'https://x9oo-fwyq-gkdq.n7.xano.io';
export const XANO_LICENSES_ENDPOINT = '/api:R0T9q1PH';
export const LEMON_SQUEEZY_API_URL = 'https://api.lemonsqueezy.com/v1';
export const LEMON_SQUEEZY_LICENSE_ENDPOINT =
  LEMON_SQUEEZY_API_URL + '/licenses/validate';
export const LEMON_STORE_ID = 121200;
export const LEMON_SUPPORTED_PRODUCT_IDS = [347214];

export const LINKS = {
  HOME: 'https://neutralbase.com',
  CALCOM_15_MINUTE_MEETING: 'https://go.neutralbase.com/15min',
  CALCOM_30_MINUTE_MEETING: 'https://go.neutralbase.com/30min',
  CONTACT: 'https://aisheet.com/support?openChatbox',
  DISCLAIMER: 'https://aisheet.com/terms-of-service',
  FAQ: 'https://neutralbase.com/affiliates/faq',
  NEUTRALBASE_HOME: 'https://neutralbase.com',
  NEUTRALBASE_LEARN_MORE: 'https://go.neutralbase.com/aisheet',
  PRIVACY: 'https://aisheet.com/privacy',
  PURCHASE_LINK: 'https://neutralbase.com/affiliates',
  SOCIALS: {
    FACEBOOK: 'https://www.facebook.com/neutralbase',
    LINKEDIN: 'https://www.linkedin.com/company/neutralbase',
    X: 'https://x.com/neutralbaseai',
  },
  SUPPORT: 'https://aisheet.com/support',
  TERMS: 'https://aisheet.com/terms-of-service',
};
