import DOMPurify from 'dompurify';
import { useMemo } from 'react';
import clsx from 'clsx';

/** Production HTML + MathML, sanitized. Inline colours are dropped so dark mode stays readable. */
const purify = (html: string) =>
  DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true, mathMl: true },
    FORBID_ATTR: ['style', 'color', 'face', 'bgcolor', 'class'],
    ADD_TAGS: ['mark', 'del', 'ins'],
    ADD_ATTR: ['data-fx'],
  });

export function MathHtml({ html, className, small }: { html: string; className?: string; small?: boolean }) {
  const clean = useMemo(() => purify(html), [html]);
  return <div className={clsx('fx-q', small && 'fx-small', className)} dangerouslySetInnerHTML={{ __html: clean }} />;
}
