import { Controller, Header, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { AccessContext } from '../../common/access/access-context';
import { Access, RequirePermission } from '../rbac/decorators/access.decorators';
import { RealtimeService } from './realtime.service';

const HEARTBEAT_MS = 25_000;
/** Shorter than the 15-minute access token, so a signed-out or disabled user's stream always ends and must re-authenticate. */
const MAX_STREAM_MS = 14 * 60_000;

@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  /** The browser keeps this open and reconnects when it ends. Only properties the caller can see are streamed. */
  @RequirePermission('room.read')
  @Header('X-Accel-Buffering', 'no')
  @Sse('stream')
  stream(@Access() access: AccessContext): Observable<{ type: string; data: unknown }> {
    return new Observable((subscriber) => {
      const stop = this.realtime.subscribe((organizationId, event) => {
        if (organizationId !== access.organizationId) return;
        if (!access.canSeeProperty(event.propertyId)) return;
        subscriber.next({ type: event.type, data: event });
      });
      subscriber.next({ type: 'ready', data: { at: new Date().toISOString() } });
      const beat = setInterval(() => subscriber.next({ type: 'ping', data: { at: new Date().toISOString() } }), HEARTBEAT_MS);
      const limit = setTimeout(() => subscriber.complete(), MAX_STREAM_MS);
      return () => {
        stop();
        clearInterval(beat);
        clearTimeout(limit);
      };
    });
  }
}
