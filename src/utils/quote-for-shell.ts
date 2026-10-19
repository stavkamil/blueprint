const shellSafe = /^[\w@%+=:,./-]+$/u;

/**
 * Quotes one argument of a command the user will copy into a shell, so paths and descriptions with spaces or quotes
 * survive. Blueprint's own commands run without a shell and never need this.
 * @param arg the argument to quote
 */
export const quoteForShell = (arg: string): string =>
  shellSafe.test(arg) ? arg : `'${arg.replaceAll("'", String.raw`'\''`)}'`;
