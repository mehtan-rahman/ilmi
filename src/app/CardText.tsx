// A card's text as a plain row: the deck lens's rows and the intake's preview.

import { cardFields, type ClozePart } from '../format/index.js';

export function CardText({ text }: { text: string }) {
  const f = cardFields(text);
  if (!f) return <span>{text}</span>;
  if (f.form === 'cloze') return <span className="cs-body">{f.parts.map((p, i) => <Part key={i} part={p} />)}</span>;
  if (f.form === 'qa') return <span className="cs-body"><span className="cs-q">{f.front}</span><span className="cs-a">{f.back}</span></span>;
  return <span className="cs-body">{f.left} <span className="cs-arrow">⇄</span> {f.right}</span>;
}

function Part({ part }: { part: ClozePart }) {
  return typeof part === 'string' ? <>{part}</> : <span className="cz">{part.answer}</span>;
}
