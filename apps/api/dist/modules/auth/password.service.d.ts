export declare class PasswordService {
    private dummyHash?;
    hash(plain: string): Promise<string>;
    verify(hash: string, plain: string): Promise<boolean>;
    /** Burn the same CPU time as a real check so unknown emails aren't distinguishable by speed. */
    spendVerifyTime(plain: string): Promise<void>;
}
