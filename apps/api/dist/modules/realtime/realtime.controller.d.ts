import { Observable } from 'rxjs';
import type { AccessContext } from '../../common/access/access-context';
import { RealtimeService } from './realtime.service';
export declare class RealtimeController {
    private readonly realtime;
    constructor(realtime: RealtimeService);
    /** The browser keeps this open and reconnects when it ends. Only properties the caller can see are streamed. */
    stream(access: AccessContext): Observable<{
        type: string;
        data: unknown;
    }>;
}
