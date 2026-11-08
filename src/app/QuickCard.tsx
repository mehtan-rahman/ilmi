// The quick card over the phone (milestone 56): the composer with front and
// back, the deck it lands in named at its foot, under the thumb. A tap on
// the deck lists the others; `save, another` keeps the composer and the deck.

import { useState } from 'react';
import { meta, type CardForm } from '../format/index.js';
import { Composer } from './Composer.js';
import { newCardAt } from './deckOps.js';
import { notify } from './land.js';
import { titleOf } from './names.js';
import { decksNow } from './quick.js';
import { useApp } from './store.js';
import { docsOf, rememberDeck } from './vault.js';
import { Icon } from './icons.js';

export function QuickCard() {
  const quick = useApp((s) => s.quickCard);
  const docs = useApp((s) => s.docs);
  const root = useApp((s) => s.vault);
  const [choosing, setChoosing] = useState(false);
  if (!quick) return null;
  const deck = quick.deck;
  const title = (p: string) => titleOf(p, docs, root);
  const close = () => { setChoosing(false); useApp.setState({ quickCard: null }); };
  const save = (text: string, again: boolean) => {
    rememberDeck(deck);
    newCardAt(deck, null, text, null, (line) => notify(line)).catch(console.error);
    if (!again) close();
  };
  const body = docsOf([deck])[0]?.[1];
  const form: CardForm = (body && meta(body).defaultCard) || 'qa';
  const where = (
    <button type="button" className="quick-deck" aria-expanded={choosing} onMouseDown={(e) => e.preventDefault()} onClick={() => setChoosing(!choosing)}>
      <span className="qd-w">to</span><bdi className="qd-t">{title(deck)}</bdi><span className="qd-c" data-open={choosing ? '1' : '0'}><Icon name="caret" /><span className="gch">{choosing ? '▴' : '▾'}</span></span>
    </button>
  );
  return (
    <div className="quick" data-choosing={choosing ? '1' : '0'}>
      {choosing && (
        <div className="quick-decks">
          {decksNow().map((p) => (
            <button key={p} type="button" className="qd-row" data-path={p} data-on={p === deck ? '1' : '0'} onMouseDown={(e) => e.preventDefault()} onClick={() => { setChoosing(false); useApp.setState({ quickCard: { deck: p } }); }}>
              <bdi>{title(p)}</bdi><span className="qd-at">{p.split('/').slice(0, -1).pop() ?? ''}</span>
            </button>
          ))}
        </div>
      )}
      <Composer seed="" form={form} pri={0} quick={where} onSave={(text, again) => save(text, again)} onClose={close} />
    </div>
  );
}
