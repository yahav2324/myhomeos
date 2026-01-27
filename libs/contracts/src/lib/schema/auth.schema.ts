import { z } from 'zod';

export const PhoneE164Schema = z
  .string()
  .min(8)
  .regex(/^\+\d{8,15}$/, 'Phone must be E.164 format like +9725...');

export const OtpRequestSchema = z.object({
  phoneE164: PhoneE164Schema,
  channel: z.enum(['SMS']).default('SMS'),
});

export const OtpVerifySchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/, 'OTP code must be 6 digits'),
  deviceName: z.string().min(1).max(80).optional(),
});

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

export type OtpRequestDto = z.infer<typeof OtpRequestSchema>;
export type OtpVerifyDto = z.infer<typeof OtpVerifySchema>;
export type AuthTokensDto = z.infer<typeof AuthTokensSchema>;
