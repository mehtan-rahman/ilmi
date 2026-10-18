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

// plugins/hello/main.ts
var main_exports = {};
__export(main_exports, {
  activate: () => activate
});
module.exports = __toCommonJS(main_exports);
var WORD = /\[hello\]/g;
function activate(ilmi) {
  const greeting = () => (ilmi.store.get("greeting") ?? "").trim() || "hi";
  ilmi.commands.add({ id: "say-hi", name: "hello: say hi", run: () => ilmi.ui.notice(greeting()) });
  ilmi.selection.addAction({
    id: "count",
    name: "hello: count",
    run: (sel) => {
      const n = sel.text.split(/\s+/).filter(Boolean).length;
      ilmi.ui.notice(`${n} word${n === 1 ? "" : "s"}`);
    }
  });
  ilmi.render.onBlock((el) => {
    if (!el.textContent?.includes("[hello]")) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.textContent?.includes("[hello]") && !n.parentElement?.closest(".hello-lit")) nodes.push(n);
    }
    for (const node of nodes) {
      const parts = node.textContent.split(WORD);
      if (parts.length < 2) continue;
      const frag = document.createDocumentFragment();
      parts.forEach((part, i) => {
        if (i > 0) {
          const lit = document.createElement("span");
          lit.className = "hello-lit";
          lit.textContent = "[hello]";
          frag.appendChild(lit);
        }
        if (part) frag.appendChild(document.createTextNode(part));
      });
      node.replaceWith(frag);
    }
  });
  ilmi.ui.settings((s) => {
    s.text("greeting", "greeting", { placeholder: "hi" });
  });
  ilmi.session.on("grade", (ev) => ilmi.ui.notice(`hello saw a ${ev.grade}`));
  return () => {
  };
}
