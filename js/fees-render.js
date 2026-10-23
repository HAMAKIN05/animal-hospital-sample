/* =========================================================
   診療内容・費用・リスクの目安：HTML 生成（ブラウザと build スクリプトで共用）
   - データは js/fees.js（FEES / RABIES_NOTE / MICROCHIP_NOTE）だけ。
   - index.html の費用一覧と news.html の記事・目安カードは
     `node tools/build.js` でこのファイルから静的 HTML として書き出します。
     （JavaScript が無効でも、検索エンジンにも、全文が見えるようにするため）
   - fees.js や news.js を変更したら、必ず `node tools/build.js` を実行してください。
   ========================================================= */
(function (root) {
  function create(W, J) {
    var F = W.FEES || { items: [], contact: {} };
    function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
    /* 日本語の改行対策：文節の区切りに <wbr> を入れる（親要素に class="bx"＝keep-all を付けて使う）。
       Safari は word-break:auto-phrase 未対応のため、BudouX（js/vendor/budoux-ja.min.js）で区切りを事前に入れます。 */
    function jp(s) {
      s = String(s);
      if (!J || !J.parse) return esc(s);
      return J.parse(s).map(function (c) { var h = esc(J.glue ? J.glue(c) : c); return J.glueHTML ? J.glueHTML(h) : h; }).join("<wbr>")
        .replace(/((?:TEL\u00a0)?\d{2,4}(?:-(?:<wbr>)?\d{2,4}){2})/g, function (m) { return '<wbr><span class="nw">' + m.replace(/<wbr>/g, "") + "</span>"; });   // 電話番号は改行させない
    }
    /* 「6,600〜9,900円（接種前の診察料を含む）」→ 金額は改行させず、補足は下の行に小さく */
    function splitNote(s) {
      var m = String(s).match(/^(.*?)(（[^（）]*(?:（[^（）]*）[^（）]*)*）)$/);
      return m && m[1] ? [m[1], m[2]] : [String(s), ""];
    }
    function valHtml(s, isPrice) {
      var p = splitNote(s);
      var main = (isPrice || p[0].length <= 9) ? '<span class="nw">' + esc(p[0]) + "</span>" : jp(p[0]);   // 金額と短い項目名は1行に
      return main + (p[1] ? '<small class="fee-sub">' + jp(p[1]) + "</small>" : "");
    }
    function feeById(id) { for (var i = 0; i < F.items.length; i++) if (F.items[i].id === id) return F.items[i]; return null; }
    /* 明示した id ＋ 本文キーワードから自動検出した id（重複なし・fees.js の並び順） */
    function feeIds(explicit, text) {
      var set = {};
      (explicit || []).forEach(function (id) { if (feeById(id)) set[id] = 1; });
      F.items.forEach(function (it) { if (it.match && new RegExp(it.match).test(text || "")) set[it.id] = 1; });
      return F.items.filter(function (it) { return set[it.id]; }).map(function (it) { return it.id; });
    }
    function legalNotes(ids, text) {
      var h = "";
      if ((text && text.indexOf("狂犬病") >= 0) || ids.indexOf("rabies") >= 0) h += '<p class="legal-note bx">' + jp(W.RABIES_NOTE || "") + "</p>";
      if ((text && text.indexOf("マイクロチップ") >= 0) || ids.indexOf("microchip") >= 0) h += '<p class="legal-note bx">' + jp(W.MICROCHIP_NOTE || "") + "</p>";
      return h;
    }
    function feeHref(id, base) { return (base || "") + "#fee-" + id; }
    function feeLinks(ids, base) {
      if (!ids.length) return "";
      return '<p class="fee-links"><span>内容・費用・リスクの目安</span>' + ids.map(function (id) {
        return '<a href="' + feeHref(id, base) + '" title="' + esc(feeById(id).name) + '">' + esc(feeById(id).name.replace(/（[^）]*）/g, "")) + "</a>";   // チップは括弧書きを省いて短く
      }).join("<wbr>") + "</p>";
    }
    /* 文のすぐ横に置く小さなリンク（1件なら「費用・リスクの目安」、複数なら項目名を並べる） */
    function inlineFeeLinks(ids, base) {
      if (!ids.length) return "";
      if (ids.length === 1) return ' <a class="fee-inline" href="' + feeHref(ids[0], base) + '">費用・リスクの目安</a>';
      return ' <span class="fee-inline-group">費用・リスクの目安：<wbr>' + ids.map(function (id) {
        return '<a class="fee-inline" href="' + feeHref(id, base) + '">' + esc(feeById(id).name) + "</a>";
      }).join("<wbr>") + "</span>";
    }
    function contactHtml() {
      return '<dl class="fee-contact bx"><dt>問合せ先</dt><dd>' + jp(F.contact.clinic || "") + "</dd><dt>診療時間外</dt><dd>" + jp(F.contact.afterHours || "") + "</dd></dl>";
    }
    function priceTable(it) {
      return '<table class="fee-price bx"><caption class="sr-only">' + esc(it.name) + "の費用（税込）</caption><tbody>" +
        it.prices.map(function (p) { return '<tr><th scope="row">' + valHtml(p[0], false) + "</th><td>" + valHtml(p[1], true) + "</td></tr>"; }).join("") + "</tbody></table>";
    }
    function feeCard(it, compact) {
      var legal = it.legal === "rabies" ? W.RABIES_NOTE : it.legal === "microchip" ? W.MICROCHIP_NOTE : "";
      return '<article class="fee bx' + (compact ? " fee-compact" : "") + '"' + (compact ? "" : ' id="fee-' + it.id + '"') + ">" +
        "<h3>" + jp(it.name) + '<small>対象：' + jp(it.target) + "</small></h3>" +
        '<dl class="fee-dl">' +
        "<dt>通常必要とされる診療内容</dt><dd>" + jp(it.content) + "</dd>" +
        "<dt>通院回数の目安</dt><dd>" + jp(it.visits) + "</dd>" +
        "<dt>主なリスク・副作用</dt><dd>" + jp(it.risks) + "</dd>" +
        "<dt>費用（税込）</dt><dd>" + priceTable(it) + (it.note ? '<p class="fee-note">' + jp(it.note) + "</p>" : "") + "</dd>" +
        "</dl>" + (legal ? '<p class="legal-note">' + jp(legal) + "</p>" : "") + contactHtml() + "</article>";
    }
    function feesListHtml() { return F.items.map(function (it) { return feeCard(it, false); }).join(""); }
    /* 記事で触れた診療の「内容・リスク・費用・問合せ先」を記事の下に併記 */
    function newsFeesHtml(n) {
      var ids = feeIds(n.fees, n.title + n.body);
      if (!ids.length) return "";
      return '<div class="news-fees"><p class="news-fees-ttl bx">' + jp("この記事に関する診療の内容・費用・リスクの目安") + '<small>※金額は架空のサンプルです（税込）</small></p>' +
        ids.map(function (id) { return feeCard(feeById(id), true); }).join("") + "</div>";
    }
    /* お知らせ（記事）共通 */
    function newsId(n) {
      var h = 0, s = n.date + n.title;
      for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
      return "n" + n.date.replace(/-/g, "") + "-" + h.toString(36).slice(0, 5);
    }
    function catKey(c) { return { "お知らせ": "info", "休診": "closed", "予防": "care", "コラム": "column" }[c] || "info"; }
    function dateLabel(n) { var p = n.date.split("-"); return +p[0] + "." + +p[1] + "." + +p[2]; }
    function newsArticleHtml(n, isNew) {
      return '<article class="news-item c-' + catKey(n.category) + '" id="' + newsId(n) + '">' +
        '<p class="nc-meta"><span class="cat">' + esc(n.category) + "</span>" + (isNew ? '<span class="new">NEW</span>' : "") +
        '<time datetime="' + n.date + '">' + dateLabel(n) + "</time></p>" +
        "<h2 class=\"bx\">" + jp(n.title) + "</h2><p class=\"bx\">" + n.body.split("\n").map(jp).join("<br>") + "</p>" + newsFeesHtml(n) + "</article>";
    }
    return { esc: esc, jp: jp, feeById: feeById, feeIds: feeIds, legalNotes: legalNotes, feeLinks: feeLinks, inlineFeeLinks: inlineFeeLinks,
      contactHtml: contactHtml, feeCard: feeCard, feesListHtml: feesListHtml, newsFeesHtml: newsFeesHtml,
      newsId: newsId, catKey: catKey, dateLabel: dateLabel, newsArticleHtml: newsArticleHtml, F: F };
  }
  if (typeof module !== "undefined" && module.exports) module.exports = create;
  else root.FeeRender = create(root, root.JPBreak);
})(typeof window !== "undefined" ? window : this);
