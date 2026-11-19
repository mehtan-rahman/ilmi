"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// plugins/recall-sample/main.ts
var main_exports = {};
__export(main_exports, {
  activate: () => activate,
  halfLife: () => halfLife,
  recallAt: () => recallAt
});
module.exports = __toCommonJS(main_exports);
var DAY = 864e5;
function halfLife(card, then) {
  let h = 1;
  for (const r of card.history) h = r.g === 1 ? 1 : h * 2;
  return then === void 0 ? h : then === 1 ? 1 : h * 2;
}
function recallAt(card, at) {
  const last = card.history[card.history.length - 1];
  return last ? 0.5 ** (Math.max(0, at - Date.parse(last.at)) / DAY / halfLife(card)) : null;
}
function activate(ilmi) {
  ilmi.scheduler.register({
    id: "recall-sample",
    name: "recall sample",
    recall: (cards, { now }) => cards.map((c) => recallAt(c, now.getTime())),
    curve: (card, days, { now }) => days.map((d) => recallAt(card, now.getTime() + d * DAY) ?? 0),
    // after a grade recall is 1 and falls to the target in halfLife × log2(1 / target) days
    preview: (card, { now }) => {
      const back = (g) => ({ due: new Date(now.getTime() + halfLife(card, g) * Math.log2(1 / card.retention) * DAY) });
      return { 1: back(1), 2: back(2), 3: back(3), 4: back(4) };
    }
  });
}
