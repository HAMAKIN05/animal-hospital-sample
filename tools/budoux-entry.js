import { HTMLProcessingParser, jaModel } from "budoux";
/* 禁則：閉じ括弧・句読点・中黒・長音・小書きかなの前、開き括弧の後、数字と単位の間では区切らない */
const NO_START = /[、。，．）」』】〕〉》！？・ー…‥ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ%％円]/;
const NO_END = /[（「『【〔〈《]/;
const DIGIT = /[0-9０-９]/, NUM_TAIL = /[0-9０-９,.:：か月日年回分時秒歳円〜%％万つ個件匹頭名人種]/;
const CLOSE_BR = /[）」』】〕〉》]/, PARTICLE = /[はがをにともでへやの]/;
class JaParser extends HTMLProcessingParser {
  parseBoundaries(s) {
    const b = new Set(super.parseBoundaries(s));
    for (let i = 1; i < s.length; i++) if (s[i - 1] === "・") b.add(i);   // 「A・B・C」は中黒の後ろでも改行可
    return [...b].sort((x, y) => x - y).filter((i) => {
      const p = s[i - 1] || "", c = s[i] || "";
      if (NO_START.test(c) || NO_END.test(p)) return false;
      if (DIGIT.test(p) && NUM_TAIL.test(c)) return false;
      if (CLOSE_BR.test(p) && PARTICLE.test(c)) return false;   // 「食べない」/は を防ぐ
      if (/[かヶカケ]/.test(p) && c === "月" && DIGIT.test(s[i - 2] || "")) return false;
      return true;
    });
  }
}
/* WebKit（iPhone の Safari）は keep-all でも括弧・句読点の前後で改行してしまうため、
   「直前の1文字＋閉じ括弧・句読点」「開き括弧＋直後の1文字」を <span class="nw">（nowrap）でまとめる */
const CLOSE_RE = /[^\s（「『【〔〈《）」』】〕〉》、。，．！？]?[）」』】〕〉》、。，．！？]+(?:(?<=[）」』】〕〉》])[はがをにともでへやの])?/g;
const OPEN_RE = /[（「『【〔〈《]+[^\s（「『【〔〈《）」』】〕〉》、。，．！？]?/g;
const CLUSTER_RE = new RegExp(CLOSE_RE.source + "|" + OPEN_RE.source, "g");
function glue(s) { return s.replace(/TEL (?=\d)/g, "TEL\u00a0"); }
/* エスケープ済み HTML 文字列用（build スクリプト・fees-render.js） */
function glueHTML(h) { return h.replace(CLUSTER_RE, (m) => '<span class="nw">' + m + "</span>"); }
const P = new JaParser(jaModel, { className: "bx", separator: typeof document !== "undefined" ? document.createElement("wbr") : "\u200b" });
const SKIP = /^(SCRIPT|STYLE|CODE|PRE|TEXTAREA|NOSCRIPT)$/;
function glueTree(root) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const list = [];
  let n;
  while ((n = w.nextNode())) {
    let e = n.parentElement, skip = false;
    while (e && e !== root.parentElement) {
      if (SKIP.test(e.tagName) || (e.classList && e.classList.contains("nw"))) { skip = true; break; }
      e = e.parentElement;
    }
    /* flex / grid の直下の文字列を span で分けると、それぞれが別の項目になって隙間が空くので触らない */
    if (!skip && n.parentElement && /flex|grid/.test(getComputedStyle(n.parentElement).display)) skip = true;
    if (!skip) list.push(n);
  }
  list.forEach((t) => {
    const v = glue(t.nodeValue);
    CLUSTER_RE.lastIndex = 0;
    if (!CLUSTER_RE.test(v)) { if (v !== t.nodeValue) t.nodeValue = v; return; }
    const frag = document.createDocumentFragment();
    let last = 0;
    v.replace(CLUSTER_RE, (m, off) => {
      if (off > last) frag.appendChild(document.createTextNode(v.slice(last, off)));
      const sp = document.createElement("span"); sp.className = "nw"; sp.textContent = m; frag.appendChild(sp);
      last = off + m.length; return m;
    });
    if (last < v.length) frag.appendChild(document.createTextNode(v.slice(last)));
    t.parentNode.replaceChild(frag, t);
  });
}
const JPBreak = {
  /* 文字列 → 文節の配列（DOM 不要。build スクリプトでも使用） */
  parse: (s) => P.parse(s),
  /* 括弧・句読点・電話番号を改行させないための WORD JOINER 挿入（文字列用） */
  glue,
  glueHTML,
  /* 要素内の日本語に文節区切り（<wbr>）を入れ、class="bx"（keep-all）を付与 */
  apply: (el) => { P.applyToElement(el); glueTree(el); }
};
export default JPBreak;
