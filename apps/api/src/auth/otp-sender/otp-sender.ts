export interface OtpSender {
  sendOtp(toPhoneE164: string, code: string): Promise<void>;
}
