#!/usr/bin/env node
/* 静的 HTML の書き出し（データは js/fees.js と news.js だけ）
   使い方: node tools/build.js   … fees.js / news.js / fees-render.js を変更したら実行してコミット
   - index.html … 「診療内容・費用・リスクの目安」の問合せ先と全カード
   - news.html  … 公開日（ビルド日・日本時間）までの記事と、記事ごとの目安カード
   JavaScript が使えない環境・検索エンジンでも全文が読めるようにするためのものです。
   ブラウザでは js/main.js が同じ fees-render.js で再描画（絞り込み・NEW 表示など）します。 */
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..");
const W = {};
const ctx = vm.createContext({ window: W });
for (const f of ["js/fees.js", "news.js"]) vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f });
const J = require(path.join(ROOT, "js/vendor/budoux-ja.min.js"));   // 文節区切り（Safari の改行対策）
const R = require(path.join(ROOT, "js/fees-render.js"))(W, J);

const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date()); // YYYY-MM-DD（日本時間）
const news = (W.NEWS || []).filter(n => n && n.date && n.date <= today)
  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

function put(file, key, html) {
  const p = path.join(ROOT, file);
  let s = fs.readFileSync(p, "utf8");
  const re = new RegExp("(<!-- BUILD:" + key + "[^>]*-->)[\\s\\S]*?(<!-- /BUILD:" + key + " -->)");
  if (!re.test(s)) throw new Error(file + ": marker BUILD:" + key + " not found");
  s = s.replace(re, (m, a, b) => a + html + b);
  fs.writeFileSync(p, s);
}
put("index.html", "FEES-CONTACT", R.contactHtml());
put("index.html", "FEES-LIST", R.feesListHtml());
put("news.html", "NEWS", news.map(n => R.newsArticleHtml(n, false)).join(""));
console.log("built:", R.F.items.length, "fee cards;", news.length, "news articles (<= " + today + " JST)");
