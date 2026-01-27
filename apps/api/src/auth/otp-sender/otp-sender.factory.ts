import { OtpSender } from './otp-sender';
import { ConsoleOtpSender } from './otp-sender.console';
import { WhatsAppOtpSender } from './otp-sender.whatsapp';
import { SmsOtpSender } from './otp-sender.sms';

export function createOtpSender(): OtpSender {
  const provider = process.env.OTP_PROVIDER ?? 'console';

  switch (provider) {
    case 'whatsapp':
      return new WhatsAppOtpSender();
    case 'sms':
      return new SmsOtpSender();
    case 'console':
    default:
      return new ConsoleOtpSender();
  }
}
