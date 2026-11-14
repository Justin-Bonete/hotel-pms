export interface SseMessage {
    event: string;
    data: string;
}
/**
 * Incremental Server-Sent-Events parser for fetch() streams (EventSource cannot send an Authorization header).
 * Feed it text chunks as they arrive; it returns the complete messages found so far.
 * Handles \r\n and \n, comment lines (": keep-alive"), multi-line data, and frames split across chunks.
 */
export declare class SseParser {
    private buffer;
    push(chunk: string): SseMessage[];
}
