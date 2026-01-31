import { Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

export type GoogleProfile = {
  sub: string;
  email?: string | null;
  name?: string | null;
  picture?: string | null;
};

@Injectable()
export class GoogleAuthService {
  private client = new OAuth2Client();

  async verify(idToken: string): Promise<GoogleProfile> {
    const audience = process.env.GOOGLE_WEB_CLIENT_ID;
    if (!audience) throw new Error('Missing GOOGLE_WEB_CLIENT_ID');

    const ticket = await this.client.verifyIdToken({ idToken, audience });
    const payload = ticket.getPayload();
    if (!payload?.sub) throw new UnauthorizedException('Invalid Google token');

    return {
      sub: payload.sub,
      email: payload.email ?? null,
      name: payload.name ?? null,
      picture: payload.picture ?? null,
    };
  }
}
