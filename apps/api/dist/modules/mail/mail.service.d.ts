import type { Env } from '../../config/env';
export interface MailMessage {
    to: string;
    subject: string;
    text: string;
}
export declare abstract class MailService {
    abstract send(message: MailMessage): Promise<void>;
}
/**
 * Development stand-in: prints the email to the API console so you can click the link.
 * In production it sends NOTHING and says so loudly. Email provider: connect integration (later phase).
 */
export declare class ConsoleMailService extends MailService {
    private readonly env;
    private readonly logger;
    constructor(env: Env);
    send(message: MailMessage): Promise<void>;
}
