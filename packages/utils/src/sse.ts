export interface SseMessage {
  event: string;
  data: string;
}

/**
 * Incremental Server-Sent-Events parser for fetch() streams (EventSource cannot send an Authorization header).
 * Feed it text chunks as they arrive; it returns the complete messages found so far.
 * Handles \r\n and \n, comment lines (": keep-alive"), multi-line data, and frames split across chunks.
 */
export class SseParser {
  private buffer = '';

  push(chunk: string): SseMessage[] {
    this.buffer += chunk.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const messages: SseMessage[] = [];
    let end = this.buffer.indexOf('\n\n');
    while (end !== -1) {
      const frame = this.buffer.slice(0, end);
      this.buffer = this.buffer.slice(end + 2);
      const parsed = parseFrame(frame);
      if (parsed) messages.push(parsed);
      end = this.buffer.indexOf('\n\n');
    }
    return messages;
  }
}

function parseFrame(frame: string): SseMessage | null {
  let event = 'message';
  const data: string[] = [];
  for (const line of frame.split('\n')) {
    if (line === '' || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
  }
  return data.length === 0 ? null : { event, data: data.join('\n') };
}
