import { OtpSender } from './otp-sender';

export class ConsoleOtpSender implements OtpSender {
  async sendOtp(toPhoneE164: string, code: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[OTP][DEV] ${toPhoneE164} -> ${code}`);
  }
}
