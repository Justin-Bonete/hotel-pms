export declare function slugify(name: string): string;
/** Forms send '' for empty optional text. undefined = leave alone, '' / whitespace = clear (null). */
export declare function emptyToNull(value: string | null | undefined): string | null | undefined;
