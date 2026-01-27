import { OtpSender } from './otp-sender';

export class WhatsAppOtpSender implements OtpSender {
  async sendOtp(toPhoneE164: string, code: string): Promise<void> {
    // TODO: implement via Meta Cloud API
    throw new Error('WhatsAppOtpSender not implemented yet');
  }
}
