/**
 * Replaces the text between a `<!-- BEGIN:id -->` / `<!-- END:id -->` pair, or appends the block when it's absent.
 * Text outside the markers is never touched, so blueprint, Next.js and the project can each own part of one file.
 * @param document the whole file
 * @param blockId the marker id, e.g. `blueprint-standards`
 * @param body the block's new content, without markers
 */
export const upsertMarkedBlock = (document: string, blockId: string, body: string): string => {
  const begin = `<!-- BEGIN:${blockId} -->`;
  const end = `<!-- END:${blockId} -->`;
  const block = `${begin}\n\n${body.trim()}\n\n${end}`;
  const beginAt = document.indexOf(begin);
  const endAt = beginAt === -1 ? -1 : document.indexOf(end, beginAt);
  if (endAt === -1) {
    const before = document.trimEnd();
    return before === "" ? `${block}\n` : `${before}\n\n${block}\n`;
  }
  return `${document.slice(0, beginAt)}${block}${document.slice(endAt + end.length)}`;
};
