/**
 * Verification Feature Module
 *
 * This module handles verification operations including:
 * - Password reset (forgot password, verify token, reset password)
 * - Email verification (send verification, verify email)
 * - Phone verification (send OTP, verify phone)
 * - Rate limiting for security
 */

import routes from './routes';
export { routes };
export { default as verificationRoutes } from './routes';
export * from './types';
// Note: schemas re-export types with same names, using explicit exports to avoid conflicts
export {
  forgotPasswordSchema,
  verifyResetTokenSchema,
  resetPasswordSchema,
  sendEmailVerificationSchema,
  verifyEmailSchema,
  sendPhoneVerificationSchema,
  verifyPhoneSchema,
} from './schemas/validation';

export default {
  routes
};
