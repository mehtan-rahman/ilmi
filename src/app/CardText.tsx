// A card's text as a plain row: the deck lens's rows and the intake's
// preview. Drawn by the reader's rules, so emphasis, code, and math read
// as themselves here too.

import { cardHTML } from './Reader.js';

export function CardText({ text }: { text: string }) {
  return <span className="cs-body" dangerouslySetInnerHTML={{ __html: cardHTML({ kind: 'card', text }) }} />;
}
