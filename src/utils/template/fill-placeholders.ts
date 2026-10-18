/**
 * Replaces `{{name}}` placeholders with their values by plain string substitution, so templates need no engine.
 * Unknown names and GitHub's `${{ expressions }}` stay as they are.
 * @param text the template text
 * @param values placeholder values by name
 */
export const fillPlaceholders = (text: string, values: Readonly<Record<string, string>>): string =>
  text.replaceAll(/\{\{(\w+)\}\}/gu, (placeholder, name: string) => values[name] ?? placeholder);
