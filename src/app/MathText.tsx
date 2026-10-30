// A line of chrome text with its formulas drawn (milestone 40): an outline
// row, a card's name in a list, a crumb, a queue row's path. Plain words
// stay a text node; a line with `$…$` in it gets KaTeX, small and inline,
// and a `title` reading its formulas as plain text.

import { hasMath, inlineMathHTML, plainMath } from './chromeText.js';

interface Props {
  text: string;
  className?: string;
  /** The tooltip: the text itself, formulas as plain text, unless given. */
  title?: string | false;
  dir?: 'auto' | 'ltr' | 'rtl';
}

export function MathText({ text, className, title, dir }: Props) {
  const tip = title === false ? undefined : title ?? plainMath(text);
  if (!hasMath(text)) return <span className={className} title={title === undefined ? undefined : tip} dir={dir}>{text}</span>;
  return <span className={className} title={tip} dir={dir} dangerouslySetInnerHTML={{ __html: inlineMathHTML(text) }} />;
}
