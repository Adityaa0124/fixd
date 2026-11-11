import DOMPurify from 'dompurify';
import { useMemo } from 'react';
import clsx from 'clsx';

const purify = (html: string) =>
  DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true, mathMl: true },
    FORBID_ATTR: ['style', 'color', 'face', 'onerror', 'onclick'],
    ADD_TAGS: ['mark'],
    ADD_ATTR: ['data-fx'],
  });

export function MathHtml({ html, className }: { html: string; className?: string }) {
  const clean = useMemo(() => purify(html), [html]);
  return <div className={clsx('fx-q', className)} dangerouslySetInnerHTML={{ __html: clean }} />;
}
