import { BRAND, MEMBER_NOUN, MEMBER_NOUN_PLURAL } from '../../apps/web/src/lib/brand';

export { BRAND, MEMBER_NOUN, MEMBER_NOUN_PLURAL };

// Keep sign-in hidden until the application is live. Mike confirmed the enquiry mailbox.
export const appUrl = import.meta.env.PUBLIC_APP_URL || '';
export const contactEmail = import.meta.env.PUBLIC_CONTACT_EMAIL || 'mike@tumblebase.com';
export const monthlyPrice = import.meta.env.PUBLIC_MONTHLY_PRICE_GBP || '';
