/* =========================================================
   診療内容・費用・リスクの目安：HTML 生成（ブラウザと build スクリプトで共用）
   - データは js/fees.js（FEES / RABIES_NOTE / MICROCHIP_NOTE）だけ。
   - index.html の費用一覧と news.html の記事・目安カードは
     `node tools/build.js` でこのファイルから静的 HTML として書き出します。
     （JavaScript が無効でも、検索エンジンにも、全文が見えるようにするため）
   - fees.js や news.js を変更したら、必ず `node tools/build.js` を実行してください。
   ========================================================= */
(function (root) {
  function create(W) {
    var F = W.FEES || { items: [], contact: {} };
    function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
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
      if ((text && text.indexOf("狂犬病") >= 0) || ids.indexOf("rabies") >= 0) h += '<p class="legal-note">' + esc(W.RABIES_NOTE || "") + "</p>";
      if ((text && text.indexOf("マイクロチップ") >= 0) || ids.indexOf("microchip") >= 0) h += '<p class="legal-note">' + esc(W.MICROCHIP_NOTE || "") + "</p>";
      return h;
    }
    function feeHref(id, base) { return (base || "") + "#fee-" + id; }
    function feeLinks(ids, base) {
      if (!ids.length) return "";
      return '<p class="fee-links"><span>内容・費用・リスクの目安</span>' + ids.map(function (id) {
        return '<a href="' + feeHref(id, base) + '">' + esc(feeById(id).name) + "</a>";
      }).join("") + "</p>";
    }
    /* 文のすぐ横に置く小さなリンク（1件なら「費用・リスクの目安」、複数なら項目名を並べる） */
    function inlineFeeLinks(ids, base) {
      if (!ids.length) return "";
      if (ids.length === 1) return ' <a class="fee-inline" href="' + feeHref(ids[0], base) + '">費用・リスクの目安</a>';
      return ' <span class="fee-inline-group">費用・リスクの目安：' + ids.map(function (id) {
        return '<a class="fee-inline" href="' + feeHref(id, base) + '">' + esc(feeById(id).name) + "</a>";
      }).join("") + "</span>";
    }
    function contactHtml() {
      return '<dl class="fee-contact"><dt>問合せ先</dt><dd>' + esc(F.contact.clinic || "") + "</dd><dt>診療時間外</dt><dd>" + esc(F.contact.afterHours || "") + "</dd></dl>";
    }
    function priceTable(it) {
      return '<table class="fee-price"><caption class="sr-only">' + esc(it.name) + "の費用（税込）</caption><tbody>" +
        it.prices.map(function (p) { return '<tr><th scope="row">' + esc(p[0]) + "</th><td>" + esc(p[1]) + "</td></tr>"; }).join("") + "</tbody></table>";
    }
    function feeCard(it, compact) {
      var legal = it.legal === "rabies" ? W.RABIES_NOTE : it.legal === "microchip" ? W.MICROCHIP_NOTE : "";
      return '<article class="fee' + (compact ? " fee-compact" : "") + '"' + (compact ? "" : ' id="fee-' + it.id + '"') + ">" +
        "<h3>" + esc(it.name) + '<small>対象：' + esc(it.target) + "</small></h3>" +
        '<dl class="fee-dl">' +
        "<dt>通常必要とされる診療内容</dt><dd>" + esc(it.content) + "</dd>" +
        "<dt>通院回数の目安</dt><dd>" + esc(it.visits) + "</dd>" +
        "<dt>主なリスク・副作用</dt><dd>" + esc(it.risks) + "</dd>" +
        "<dt>費用（税込）</dt><dd>" + priceTable(it) + (it.note ? '<p class="fee-note">' + esc(it.note) + "</p>" : "") + "</dd>" +
        "</dl>" + (legal ? '<p class="legal-note">' + esc(legal) + "</p>" : "") + contactHtml() + "</article>";
    }
    function feesListHtml() { return F.items.map(function (it) { return feeCard(it, false); }).join(""); }
    /* 記事で触れた診療の「内容・リスク・費用・問合せ先」を記事の下に併記 */
    function newsFeesHtml(n) {
      var ids = feeIds(n.fees, n.title + n.body);
      if (!ids.length) return "";
      return '<div class="news-fees"><p class="news-fees-ttl">この記事に関する診療の内容・費用・リスクの目安<small>※金額は架空のサンプルです（税込）</small></p>' +
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
        "<h2>" + esc(n.title) + "</h2><p>" + esc(n.body).replace(/\n/g, "<br>") + "</p>" + newsFeesHtml(n) + "</article>";
    }
    return { esc: esc, feeById: feeById, feeIds: feeIds, legalNotes: legalNotes, feeLinks: feeLinks, inlineFeeLinks: inlineFeeLinks,
      contactHtml: contactHtml, feeCard: feeCard, feesListHtml: feesListHtml, newsFeesHtml: newsFeesHtml,
      newsId: newsId, catKey: catKey, dateLabel: dateLabel, newsArticleHtml: newsArticleHtml, F: F };
  }
  if (typeof module !== "undefined" && module.exports) module.exports = create;
  else root.FeeRender = create(root);
})(typeof window !== "undefined" ? window : this);
