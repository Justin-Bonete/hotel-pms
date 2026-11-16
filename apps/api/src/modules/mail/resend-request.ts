export interface ResendMessage {
  to: string;
  subject: string;
  text: string;
}

export interface ResendRequest {
  url: string;
  init: { method: 'POST'; headers: Record<string, string>; body: string };
}

/** Builds the request for resend.com's API. Kept separate from sending so it can be tested without the network. */
export function buildResendRequest(apiKey: string, from: string, message: ResendMessage): ResendRequest {
  return {
    url: 'https://api.resend.com/emails',
    init: { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text }) },
  };
}
