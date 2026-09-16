// data.jsx — the vault.
// Files over app: this tree IS the model. A vault is a folder tree of source
// files; folders nest; the app is a lens over the tree.
//
// A SOURCE's `body` is an ordered list of blocks. A block is either prose
// (kind 'p' / 'h') or a CARD — a marked span carrying its FSRS schedule inline,
// exactly the way an Obsidian SR annotation does: a block-ref ^id plus a
// trailing <!--SR: due/stab/reps--> comment. A card is therefore NOT a separate
// object; it lives inside the text. The tree leaf under a source is a pointer to
// that span — deleting the leaf strips the annotation, never the prose.
//
// The queue and the saved views are QUERIES over this one tree (blocks due
// ≤ today), not a second store. All content is original placeholder prose.

const TODAY = '2026-05-27';        // the day the workbench is opened
const TODAY_LABEL = 'wed · 27 may';

// ── authoring helpers ────────────────────────────────────────────
let _bid = 0;
const P = (text) => ({ id: 'b' + (++_bid), kind: 'p', text });
const H = (text) => ({ id: 'b' + (++_bid), kind: 'h', text });
// a card block. payload is { text } (cloze) | { body:{q,a} } (qa) | { body:{l,r} } (bidir)
const C = (id, type, payload, sched) => ({ id, kind: 'card', type, ...payload, sched });
// SR schedule: due date, stability(d), reps, lapses, difficulty, last grade note
const SR = (due, stab, reps, lapses, diff, last) => ({ due, stab, reps, lapses, diff, last });
// READ schedule: a source enrolled in incremental reading. due, interval(d),
// reps(=passes done), pos(=prose blocks read), priority. Same idea as a card
// span's SR — but the whole source is the scheduled element (a "topic").
const READ = (due, ivl, reps, pos, pri) => ({ due, ivl, reps, pos, pri });
// WRITE schedule: a DRAFT (or one of its extracts) enrolled in spaced
// composition. due, interval(d), reps(=passes), priority, done. Unlike a card it
// is never graded — it just resurfaces until `done` is set. Same shape as READ,
// but the scheduled element is something you make rather than recall.
const WR = (due, ivl, reps, pri, done) => ({ due, ivl, reps, pri, done: !!done });

// ── the vault ────────────────────────────────────────────────────
const VAULT = {
  id: 'root', type: 'folder', name: 'notes', root: true, open: true,
  children: [
    {
      id: 'papers', type: 'folder', name: 'papers', open: true,
      children: [
        {
          id: 'wozniak-1990', type: 'source', name: 'wozniak-1990', frozen: true,
          meta: { path: 'papers/wozniak-1990.md', imported: '2026-04-18', words: 4820 },
          summary: '6 cards · 3 due', open: true,
          read: READ('2026-06-01', 9, 4, 12, 3),
          body: [
            H('§1 — the premise'),
            P('Memory is not a vessel that fills with study, nor a muscle that strengthens with reps. It is closer to a forest: each path you walk gets a little easier to walk again, and the ones you stop walking close over. What we call learning is the discipline of choosing which paths to walk.'),
            P('Choosing well requires honesty about how memory behaves. The classical curve falls fast and flattens slow. Each successful recall pushes the curve out further than the last. A scheduler\u2019s job is to surface a recall just before the curve crosses the floor — not earlier, not later.'),
            C('cw1-paths', 'qa',
              { body: { q: 'what is the framework\u2019s picture of memory?', a: 'paths in a forest — walked paths stay open, unwalked ones close over; learning is choosing which to walk' } },
              SR('2026-06-04', 22.0, 9, 0, 0.38, '8d ago · good')),
            H('§2 — twenty rules of formulating knowledge'),
            P('The twenty rules are the residue of a long argument with one\u2019s own forgetfulness. They group into four concerns: atomicity, integration, language, and process.'),
            P('Atomicity is the unglamorous one and the most important. The minimum information principle — the smallest piece of knowledge you can recall standalone — is not a stylistic preference. It is the only formulation that produces a memory you can retrieve, because retrieval cues degrade with each additional concept the card asks you to track.'),            C('cw2-min', 'cloze',
              { text: 'the {{minimum information principle}} is the discipline of breaking knowledge into the smallest atoms a learner can {{recall}} independently' },
              SR('2026-05-27', 11.8, 14, 2, 0.42, '12d ago · good')),
            C('cw2-retr', 'cloze',
              { text: 'retrieval cues {{degrade}} with each additional concept a single card asks you to track' },
              SR('2026-05-26', 6.4, 7, 1, 0.5, '6d ago · good')),
            { id: 'wb-atom', kind: 'p', exrefs: ['woz-ex1'], text: 'Atomicity sounds easy and is in fact the hardest discipline in the practice. Every bundle is a future failure.' },
            C('cw2-atom', 'qa',
              { body: { q: 'why is bundling several facts on one card a false economy?', a: 'a card with three facts has roughly the failure probability of three cards, but only one of them can be marked good' } },
              SR('2026-06-10', 18.0, 5, 0, 0.4, '5d ago · easy')),
            P('Integration is the rule the system cannot help you with. A card you do not understand cannot become a card. You cannot atomize what you have not integrated; you can only transcribe it.'),
            C('cw2-integ', 'cloze',
              { text: 'you cannot {{c1::atomize}} what you have not {{c2::integrated}} — you can only transcribe it' },
              SR('2026-05-27', 1.0, 0, 0, 0.3, 'new')),
            H('§3 — the card you keep failing'),
            P('Some cards you get wrong again and again. The system can flag them; only the learner can repair them. The repair is almost never on the card itself — it is one level up, in the passage that produced it.'),
            C('cw3-leech', 'qa',
              { body: { q: 'why does a card built from un-integrated material keep failing?', a: 'the recall has no scaffolding of meaning to attach to — every review re-encodes the fact from scratch instead of retrieving it by association' } },
              SR('2026-05-25', 0.5, 11, 4, 0.7, '2d ago · again')),
            C('cw3-prereq', 'qa',
              { body: { q: 'what does reformulating a stuck card more clearly usually paper over?', a: 'a missing prerequisite the learner has not yet integrated — demote the card, read around the passage, try next month' } },
              SR('2026-07-01', 34.0, 6, 0, 0.36, '14d ago · good')),
            H('§4 — on cramming'),
            P('Cramming is mass repetition compressed in time. It solves the problem of an exam tomorrow morning and nothing that lasts. The forgetting curve is largely insensitive to how many times you ran the deck on the eve — what matters is the spacing between successful recalls, not the count of them.'),
          ],
          children: [
            {
              id: 'woz-ex1', type: 'source', extract: true, parent: 'wozniak-1990',
              name: 'atomicity is the hardest discipline', open: false, frozen: false, summary: 'extract',
              meta: { path: 'papers/wozniak-1990/woz-ex1.md', imported: '2026-05-24', words: 33, of: 'wozniak-1990' },
              read: READ('2026-05-27', 1, 1, 0, 3),
              body: [
                P('Atomicity sounds easy and is in fact the hardest discipline in the practice. Every bundle is a future failure — a card carrying three facts fails about as often as three cards, but only one of them can be marked good.'),
              ],
            },
          ],
        },
        {
          id: 'crick-1995', type: 'source', name: 'crick-1995', frozen: true,
          meta: { path: 'papers/crick-1995.md', imported: '2026-05-20', words: 3120 },
          summary: '1 card · mid-read', open: false,
          read: READ('2026-05-27', 2, 3, 2, 2),
          body: [
            H('intro — what consciousness is not'),
            P('Before we ask what awareness is, the notebook insists, we have to be ruthless about what it is not — most of the early confusion comes from smuggling the answer into the question.'),
            P('Consciousness is not a single thing, and it is not the whole of mental life. Most of what the brain does, it does in the dark. The interesting question is the narrow one: why is some small fraction of that processing accompanied by experience at all?'),
            H('three eliminations'),
            P('The first elimination is the homunculus. There is no inner viewer watching a screen; if there were, we would only have moved the problem inward. The regress is the tell.'),
            P('The second elimination is language. A creature need not be able to report an experience in order to have one. Tying awareness to report quietly excludes infants, animals, and most of one\u2019s own waking life.'),
            P('What remains is a tractable target: the smallest set of neural events sufficient for one specific conscious percept. Name it and you can study it.'),
            C('cck-ncc', 'bidir',
              { body: { l: 'neural correlate of consciousness', r: 'NCC' } },
              SR('2026-05-27', 1.0, 0, 0, 0.3, 'new')),
          ],
        },
        {
          id: 'papers-archive', type: 'folder', name: 'archive', open: false,
          children: [
            {
              id: 'sutton-2019', type: 'source', name: 'sutton-2019', frozen: true,
              meta: { path: 'papers/archive/sutton-2019.md', imported: '2026-03-02', words: 1980 },
              summary: 'unread', open: false,
              read: READ('2026-05-27', 1, 0, 0, 2),
              body: [
                H('opening — where humans got it wrong'),
                P('The bitter lesson, restated for a notebook: methods that scale with computation eventually overtake methods that encode what a clever human believes about the problem. The believing feels like progress and is mostly a tax.'),
                P('Search and learning are the two things that scale. Everything else is scaffolding we are reluctant to throw away because we built it.'),
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'german', type: 'deck', name: 'german · A1', open: true, defaultCard: 'bidir',
      body: [
        C('cv-vorsatz', 'bidir', { body: { l: 'der Vorsatz', r: 'resolution; intention' } },
          SR('2026-05-27', 3.0, 4, 1, 0.5, '3d ago · hard')),
        C('cv-wdh', 'bidir', { body: { l: 'die Wiederholung', r: 'repetition; review' } },
          SR('2026-05-27', 8.0, 6, 0, 0.36, '6d ago · good')),
        C('cv-gedacht', 'bidir', { body: { l: 'das Ged\u00e4chtnis', r: 'memory' } },
          SR('2026-06-09', 14.0, 7, 0, 0.34, '9d ago · good')),
        C('cv-vergessen', 'bidir', { body: { l: 'vergessen', r: 'to forget' } },
          SR('2026-06-02', 6.0, 5, 0, 0.4, '5d ago · good')),
        C('cv-luecke', 'bidir', { body: { l: 'die L\u00fccke', r: 'gap; blank' } },
          SR('2026-05-25', 0.5, 9, 4, 0.7, '2d ago · again')),
        C('cv-cloze', 'cloze', { text: 'spaced repetition is {{verteilte Wiederholung}} in German' },
          SR('2026-06-15', 18.0, 3, 0, 0.34, '4d ago · good')),
      ],
    },
    {
      id: 'essays', type: 'folder', name: 'essays', open: true,
      children: [
        {
          id: 'marginalia', type: 'source', name: 'marginalia',
          meta: { path: 'essays/marginalia.md', imported: '2026-05-09', words: 2240 },
          summary: '3 cards · 1 due', open: false,
          body: [
            H('§1 — on slow reading'),
            P('The margin is the only honest measure of reading. A page you passed your eyes over leaves nothing there; a page you argued with is fenced in ink. The notebook treats an empty margin as an unread page, regardless of how long you spent on it.'),
            C('cmar-drive', 'qa',
              { body: { q: 'what does the learn drive actually reward?', a: 'the integration of new patterns into existing prior knowledge — not novelty, not completion' } },
              SR('2026-05-27', 5.0, 4, 1, 0.5, '5d ago · hard')),
            C('cmar-pleasure', 'cloze',
              { text: 'where there is no {{pleasure}} in the reading there is, reliably, no {{learning}} either' },
              SR('2026-06-12', 20.0, 6, 0, 0.36, '9d ago · good')),
            H('§2 — the margin as workshop'),
            P('The margin is where understanding crystallizes — not because the space is special but because it forces reduction. You cannot fit the paragraph back into the margin; you can only fit what you took from it.'),
            C('cmar-margin', 'cloze',
              { text: 'transcription is not understanding; the margin forces a {{reduction}} into your own words' },
              SR('2026-06-20', 28.0, 7, 0, 0.34, '11d ago · easy')),
          ],
        },
        {
          id: 'atomic-notes', type: 'source', name: 'atomic-notes',
          meta: { path: 'essays/atomic-notes.md', imported: '2026-05-18', words: 880 },
          summary: 'unread', open: false,
          read: READ('2026-05-27', 1, 0, 0, 3),
          body: [
            H('on the integration step'),
            P('An atomic note is the output of integration, not its substitute. The discipline people skip is the slow one in the middle: holding the new idea against everything you already believe until it either fits or forces a revision.'),
          ],
        },
        {
          id: 'draft-sc', type: 'draft', name: 'spaced composition', open: true,
          meta: { path: 'essays/spaced-composition.md', started: '2026-05-22', words: 168 },
          write: WR('2026-05-27', 2, 1, 2, false),
          body: [
            H('working title'),
            P('A note arguing with itself about whether writing can be scheduled the way reading and review already are. Keep it short until it earns length.'),
            H('§1 — the thesis'),
            P('Reading has a loop and review has a loop; writing has deadlines and guilt. The wager here is that a draft is just another element that should come back on a schedule — not to be graded, only to be touched again — until the writer decides it is finished.'),
            P('The danger is over-design. The loop is not a workflow; it is a door that opens, lets you do anything, and closes. Resist adding steps to it.'),
            P('Every constraint added to the writing loop is one more reason not to enter it. The empty afternoon is the feature, not the bug. [tighten this — it is the crux of the piece]'),
            H('§2 — what comes back'),
            P('A draft is not graded; it simply resurfaces until you call it done. #TODO: find the right word for "resurface" — it sounds clinical.'),
            P('If reviews fall on a curve, spacing the next pass at $t_{n+1} = t_n \\cdot (1 + e^{-\\theta})$ keeps the draft surfacing while it is still warm, then lets it rest.'),
          ],
        },
        {
          id: 'draft-talk', type: 'draft', name: 'talk · incremental everything', open: false,
          meta: { path: 'essays/talk-incremental.md', started: '2026-05-25', words: 54 },
          write: WR('2026-05-30', 3, 0, 3, false),
          body: [
            H('outline'),
            P('— open on the forgetting curve, but pose it as a question, not a fact.'),
            P('— the three loops, side by side: read, recall, write.'),
            P('— the file tree is the model; show one card from three angles.'),
            P('— close on the empty queue as an open afternoon.'),
          ],
        },
      ],
    },
    {
      id: 'books', type: 'folder', name: 'books', open: false,
      children: [
        {
          id: 'pragmatism', type: 'source', name: 'james-pluralistic-ch4', frozen: true,
          meta: { path: 'books/james-pluralistic-ch4.md', imported: '2026-04-30', words: 5400 },
          summary: '1 card', open: false,
          body: [
            H('ch.4 — radical empiricism'),
            P('The chapter\u2019s wager is that relations between things are themselves part of experience — felt directly, not inferred and pasted on afterward by the mind. If that is true, the join between two ideas is as real as the ideas.'),
            C('cprag-rel', 'cloze',
              { text: 'radical empiricism holds that the {{c1::relations}} between things are themselves {{c1::directly experienced}}, not added by the mind' },
              SR('2026-06-08', 16.0, 5, 0, 0.4, '7d ago · good')),
          ],
        },
        {
          id: 'commonplace', type: 'source', name: 'commonplace-book-three', frozen: true,
          meta: { path: 'books/commonplace-book-three.md', imported: '2026-02-14', words: 6100 },
          summary: '1 card', open: false,
          body: [
            H('book three — gathered lines'),
            P('A commonplace book is a deck that has not admitted it is a deck. The copying is the encoding; the re-reading is the review; the only thing missing is a scheduler honest enough to space the re-readings.'),
            C('ccom-door', 'cloze',
              { text: 'the page is not a {{destination}}; it is a {{doorway}}' },
              SR('2026-08-01', 78.0, 12, 1, 0.3, '34d ago · good')),
          ],
        },
      ],
    },
    {
      id: 'fleeting', type: 'folder', name: 'fleeting', open: true,
      children: [
        {
          id: 'inbox-0527', type: 'source', name: '2026-05-27.md',
          meta: { path: 'fleeting/2026-05-27.md', imported: '2026-05-27', words: 90 },
          summary: 'today', open: false,
          body: [
            P('Idea while walking: the queue should never be a debt. If nothing is due, the right number on the screen is nothing, not zero-with-a-frown. Build the empty state to read like an open afternoon.'),
          ],
        },
        {
          id: 'inbox-0526', type: 'source', name: '2026-05-26.md',
          meta: { path: 'fleeting/2026-05-26.md', imported: '2026-05-26', words: 60 },
          summary: '', open: false,
          body: [
            P('Note to self — stop reformulating the card you keep failing. Read the paragraph above it instead. The card is almost never the problem.'),
          ],
        },
      ],
    },
  ],
};

// A sample for the intake surface — try the ingest flow without pasting.
const INTAKE_SAMPLE = `Spaced repetition and the economics of attention

Every review you schedule is a small wager against forgetting. The wager has a cost — the minutes spent — and a payoff that compounds: each successful recall pushes the next due date further out, so a few well-timed reviews buy years of retention for the price of an afternoon.

The mistake most learners make is to treat the wager as free. They review everything, constantly, and confuse the warm feeling of familiarity with the harder fact of retrieval. Familiarity is cheap. Retrieval is the thing that lasts, and it is only trained by the discomfort of nearly forgetting and then not quite forgetting.

A good system spends your attention the way a careful gardener spends water: not evenly, but where the curve is about to cross the floor.`;
