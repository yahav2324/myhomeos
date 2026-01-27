export interface SmsSender {
  sendSms(toPhoneE164: string, message: string): Promise<void>;
}

export class ConsoleSmsSender implements SmsSender {
  async sendSms(toPhoneE164: string, message: string): Promise<void> {
    // DEV: prints to server log so you can test instantly
    // eslint-disable-next-line no-console
    console.log(`[SMS to ${toPhoneE164}] ${message}`);
  }
}
