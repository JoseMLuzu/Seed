/** A visible checklist is the source of truth, including when all steps are empty. */
export function composerContent(content: string, checklist?: readonly { text: string }[]): string {
  return checklist
    ? checklist.map(todo => todo.text.trim()).filter(Boolean).join('\n')
    : content.trim();
}
