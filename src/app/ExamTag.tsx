// The next exam in the reader's top row (milestone 43), on the document that
// sets it: `midterm 2 in 19d`, what is left before it in the tooltip, a click
// opening what is ahead narrowed to that exam.

import { activeExam, examKey, examLeft, upcomingExam } from '../schedule/index.js';
import { appNow } from './clock.js';
import { docsUnder } from './deck.js';
import { examDay, examName, examWhen, leftLines } from './items.js';
import { queueId } from './names.js';
import { useApp } from './store.js';
import { examsAtPath, openNode, optionsAt } from './vault.js';

export function ExamTag({ path }: { path: string }) {
  const queue = useApp((s) => s.queue);
  const docs = useApp((s) => s.docs);
  const tree = useApp((s) => s.tree);
  const order = useApp((s) => s.order);
  const files = useApp((s) => s.files);
  if (!docs[path]) return null;
  const now = appNow();
  const exams = examsAtPath(path).filter((e) => e.from === path);
  const next = upcomingExam(exams, now);
  if (!next) return null;
  const active = activeExam(exams, now);
  const k = examKey(next);
  let tip = examDay(next.day);
  if (active && examKey(active) === k) {
    const under = new Set(docsUnder(tree, path, order, files));
    const left = leftLines(examLeft(queue.filter((i) => i.exam && examKey(i.exam) === k), next, (p) => under.has(p), (p) => optionsAt(p).opts.retention));
    tip = [tip, left.cards && `cards ${left.cards}`, left.reading && `reading ${left.reading}`].filter(Boolean).join('\n');
  }
  const open = () => { useApp.setState({ examFilter: k }); openNode(queueId('upcoming')); };
  return (
    <button type="button" className="frozen-tag exam-tag" data-exam={k} title={tip} onClick={open}>
      {examName(next)} {examWhen(next.day, now)}
    </button>
  );
}
