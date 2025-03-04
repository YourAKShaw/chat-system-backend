import { CanActivate, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: any): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();

    try {
      const token = client.handshake.auth.token;
      if (!token) {
        throw new WsException('Unauthorized');
      }

      const payload = this.jwtService.verify(token);
      const userId = payload.sub;

      if (!userId) {
        throw new WsException('Invalid token');
      }

      // Attach user data to the socket
      client.data.userId = userId;

      return true;
    } catch (err) {
      throw new WsException('Unauthorized');
    }
  }
}
