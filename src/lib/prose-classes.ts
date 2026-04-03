// ---------------------------------------------------------------------------
// Shared Tailwind prose class string for rendered markdown
// ---------------------------------------------------------------------------

/**
 * Tailwind CSS classes for rendering markdown content with prose styles.
 * Apply this to the wrapper div around a <ReactMarkdown> or similar component.
 */
export const PROSE_CLASSES =
  "prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_code:not(pre_code)]:rounded [&_code:not(pre_code)]:bg-muted [&_code:not(pre_code)]:px-1 [&_code:not(pre_code)]:py-0.5 [&_code:not(pre_code)]:text-xs";
