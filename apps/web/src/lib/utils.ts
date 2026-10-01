import clsx, { type ClassValue } from 'clsx';

export const cn = (...inputs: ClassValue[]): string => clsx(inputs);

export const initials = (first: string, last: string): string =>
  `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
