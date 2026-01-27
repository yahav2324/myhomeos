import { OtpSender } from './otp-sender';

export class SmsOtpSender implements OtpSender {
  async sendOtp(toPhoneE164: string, code: string): Promise<void> {
    // TODO: implement SMS provider
    throw new Error('SmsOtpSender not implemented yet');
  }
}
