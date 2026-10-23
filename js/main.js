/* =====================================================================
   main.js ― 日付から「いま」の情報を組み立てる処理
   （通常は編集不要。設定は schedule.js / news.js / seasonal.js で行います）
   確認用：URL の末尾に ?date=2026-11-03T10:30 のように付けると、その日時として表示します。
   ===================================================================== */
(function () {
  "use strict";
  var S = window.CLINIC_SCHEDULE;
  var WD = ["日", "月", "火", "水", "木", "金", "土"];

  /* ---------- 日付ユーティリティ ---------- */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function md(d) { return (d.getMonth() + 1) + "/" + d.getDate() + "（" + WD[d.getDay()] + "）"; }
  function toMin(hhmm) { var p = hhmm.split(":"); return +p[0] * 60 + +p[1]; }
  function fmtT(hhmm) { return hhmm.replace(/^0/, ""); }
  function fmtHours(h) { return h.map(function (r) { return fmtT(r[0]) + "–" + fmtT(r[1]); }).join(" / "); }
  function hoursHtml(h) { return h.map(function (r) { return '<span class="nw">' + fmtT(r[0]) + "–" + fmtT(r[1]) + "</span>"; }).join(" / "); }
  function addDays(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); return x; }
  function parseYmd(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* 現在日時（?date= で上書き可能） */
  var forced = null;
  function getNow() {
    var m = /[?&]date=(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(location.search);
    if (m) {
      forced = new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 10, m[5] ? +m[5] : 0);
      return forced;
    }
    return new Date();
  }
  var NOW = getNow();

  /* ---------- その日の診療情報 ---------- */
  function dayInfo(d) {
    var key = ymd(d), mmdd = key.slice(5);
    var sp = S.special && S.special[key];
    var hol = S.holidays[key] || null;
    if (sp) {
      if (sp.closed) return { hours: [], closed: true, reason: sp.label, kind: "special", holiday: hol };
      return { hours: sp.hours, closed: false, reason: sp.label, kind: "special", holiday: hol };
    }
    var ye = S.yearEnd;
    if (ye && (mmdd >= ye.from || mmdd <= ye.to)) return { hours: [], closed: true, reason: ye.label, kind: "yearend", holiday: hol };
    if (hol && S.closeOnHolidays) return { hours: [], closed: true, reason: hol + "（祝日）のため休診", kind: "holiday", holiday: hol };
    var h = S.weekly[d.getDay()] || [];
    if (!h.length) return { hours: [], closed: true, reason: "定休日（" + WD[d.getDay()] + "曜）", kind: "regular", holiday: hol };
    return { hours: h, closed: false, reason: h.length === 1 ? "午前のみ診療" : null, kind: "open", holiday: hol };
  }

  /* 次に診療が始まる日時 */
  function nextOpening(now) {
    var nowMin = now.getHours() * 60 + now.getMinutes();
    for (var i = 0; i < 60; i++) {
      var d = addDays(now, i), info = dayInfo(d);
      if (info.closed) continue;
      for (var j = 0; j < info.hours.length; j++) {
        if (i > 0 || toMin(info.hours[j][0]) > nowMin) return { date: d, start: info.hours[j][0], info: info, offset: i };
      }
    }
    return null;
  }

  function currentStatus(now) {
    var info = dayInfo(now), t = now.getHours() * 60 + now.getMinutes();
    if (info.closed) return { state: "closed", info: info };
    var h = info.hours;
    if (t < toMin(h[0][0])) return { state: "before", info: info, at: h[0][0] };
    for (var i = 0; i < h.length; i++) {
      var s = toMin(h[i][0]), e = toMin(h[i][1]);
      if (t >= s && t < e) {
        return { state: t >= e - S.receptionCloseMinutes ? "lastcall" : "open", info: info, until: h[i][1] };
      }
      if (h[i + 1] && t >= e && t < toMin(h[i + 1][0])) return { state: "break", info: info, at: h[i + 1][0] };
    }
    return { state: "done", info: info };
  }

  function nextLabel(n) {
    if (!n) return "";
    var when = n.offset === 0 ? "本日" : n.offset === 1 ? "明日 " + md(n.date) : md(n.date);
    return when + " " + fmtT(n.start) + "〜";
  }

  /* ---------- 本日の診療状況 ---------- */
  function renderStatus() {
    var st = currentStatus(NOW), info = st.info, n = nextOpening(NOW);
    var badge = {
      open: ["ただいま診療中", "is-open"],
      lastcall: ["まもなく受付終了", "is-warn"],
      before: ["本日 " + fmtT(st.at || "") + " から診療", "is-soon"],
      "break": ["お昼休み中", "is-break"],
      done: ["本日の診療は終了", "is-closed"],
      closed: ["本日は休診日です", "is-closed"]
    }[st.state];

    var headline = info.closed
      ? "本日 " + esc(md(NOW)) + "は休診日です"
      : "本日 " + esc(md(NOW)) + "は " + hoursHtml(info.hours) + " 診療";

    var sub = "";
    if (st.state === "open") sub = fmtT(st.until) + " まで診療しています（受付は終了" + S.receptionCloseMinutes + "分前まで）。";
    if (st.state === "lastcall") sub = "受付はまもなく終了します。お急ぎの方はお電話ください。";
    if (st.state === "break") sub = "午後の診療は " + fmtT(st.at) + " からです。この時間は手術・往診を行っています。";
    if (st.state === "before") sub = "診療開始までもう少しお待ちください。";
    if (st.state === "done") sub = "本日もありがとうございました。";
    if (st.state === "closed") sub = info.reason + "。";
    if (!info.closed && info.reason) sub = info.reason + "の日です。" + sub;

    var nextHtml = (st.state === "closed" || st.state === "done" || st.state === "break" || st.state === "before")
      ? '<p class="st-next"><span>次の診療</span><strong>' + esc(nextLabel(n)) + "</strong></p>" : "";

    var el = document.getElementById("today-status");
    if (el) {
      el.innerHTML =
        '<p class="st-badge ' + badge[1] + '"><i></i>' + badge[0] + "</p>" +
        '<p class="st-head">' + headline + "</p>" +
        '<p class="st-sub">' + esc(sub) + "</p>" + nextHtml + upcomingClosures();
    }
    var hp = document.getElementById("hdr-status");
    if (hp) { hp.className = "hdr-status " + badge[1]; hp.innerHTML = "<i></i>" + badge[0]; }
    document.querySelectorAll(".js-status-pill").forEach(function (e) {
      e.classList.remove("is-open", "is-warn", "is-soon", "is-break", "is-closed");
      e.classList.add(badge[1]);
      e.innerHTML = "<i></i>" + esc(badge[0]) + "<span>" + (info.closed ? "次の診療 " + esc(nextLabel(n)) : esc(fmtHours(info.hours))) + "</span>";
    });
  }

  /* 近日の祝日・臨時・年末年始の休診（3週間以内） */
  function upcomingClosures() {
    var list = [], seenYearEnd = dayInfo(NOW).kind === "yearend";
    for (var i = 1; i <= 21 && list.length < 3; i++) {
      var d = addDays(NOW, i), info = dayInfo(d);
      if (!info.closed || info.kind === "regular") continue;
      if (info.kind === "yearend") {
        if (seenYearEnd) continue; seenYearEnd = true;
        list.push(esc(md(d)) + "〜 " + esc(info.reason));
      } else {
        list.push(esc(md(d)) + " " + esc(info.reason));
      }
    }
    if (!list.length) return "";
    return '<div class="st-upcoming"><span>近日の休診</span><ul><li>' + list.join("</li><li>") + "</li></ul></div>";
  }

  /* ---------- 今月の休診日カレンダー ---------- */
  var calOffset = 0;
  function renderCalendar() {
    var box = document.getElementById("mini-cal");
    if (!box) return;
    var base = new Date(NOW.getFullYear(), NOW.getMonth() + calOffset, 1);
    var y = base.getFullYear(), m = base.getMonth();
    var days = new Date(y, m + 1, 0).getDate();
    var html = '<div class="cal-head"><button type="button" class="cal-nav" data-d="-1" aria-label="前の月"' + (calOffset <= 0 ? " disabled" : "") + '>‹</button>' +
      "<strong>" + y + "年" + (m + 1) + "月</strong>" +
      '<button type="button" class="cal-nav" data-d="1" aria-label="次の月"' + (calOffset >= 2 ? " disabled" : "") + ">›</button></div>";
    html += '<table class="cal"><thead><tr>' + WD.map(function (w, i) {
      return '<th class="' + (i === 0 ? "sun" : i === 6 ? "sat" : "") + '">' + w + "</th>";
    }).join("") + "</tr></thead><tbody><tr>";
    var first = base.getDay();
    for (var b = 0; b < first; b++) html += "<td></td>";
    var notes = [];
    for (var dnum = 1; dnum <= days; dnum++) {
      var d = new Date(y, m, dnum), info = dayInfo(d), cls = [], mark = "";
      if (info.closed) { cls.push("off"); mark = "休"; }
      else if (info.hours.length === 1) { cls.push("half"); mark = "午前"; }
      if (info.holiday) cls.push("hol");
      if (ymd(d) === ymd(NOW)) cls.push("today");
      if (info.closed && info.kind !== "regular") notes.push(md(d) + " " + (info.kind === "holiday" ? info.holiday : info.reason));
      var title = info.closed ? info.reason : (info.reason || fmtHours(info.hours));
      html += '<td class="' + cls.join(" ") + '" title="' + esc(title) + '"><span class="n">' + dnum + "</span>" + (mark ? '<span class="m">' + mark + "</span>" : "") + "</td>";
      if (d.getDay() === 6 && dnum < days) html += "</tr><tr>";
    }
    var last = new Date(y, m, days).getDay();
    for (var a = last; a < 6; a++) html += "<td></td>";
    html += "</tr></tbody></table>";
    html += '<p class="cal-legend"><span class="lg off">休</span>休診　<span class="lg half">午前</span>午前のみ　<span class="lg today"></span>今日</p>';
    if (notes.length) html += '<p class="cal-notes">' + notes.map(esc).join("　") + "</p>";
    if (!Object.keys(S.holidays).some(function (k) { return k.indexOf(String(y)) === 0; })) {
      html += '<p class="cal-notes">※' + y + "年の祝日は未登録です（schedule.js に追加してください）</p>";
    }
    box.innerHTML = html;
    box.querySelectorAll(".cal-nav").forEach(function (btn) {
      btn.addEventListener("click", function () { calOffset += +btn.getAttribute("data-d"); renderCalendar(); });
    });
  }

  /* ---------- 診療時間表：今日の列をハイライト ---------- */
  function highlightHours() {
    var info = dayInfo(NOW);
    var col = info.kind === "holiday" ? "hol" : String(NOW.getDay());
    document.querySelectorAll('[data-col="' + col + '"]').forEach(function (c) { c.classList.add("is-today"); });
    var cap = document.getElementById("hours-today");
    if (cap) cap.innerHTML = "本日 " + esc(md(NOW)) + "：" + (info.closed ? "休診（" + esc(info.reason) + "）" : hoursHtml(info.hours));
  }

  /* ---------- 季節の健康ガイド ---------- */
  function seasonFor(month) {
    var G = window.SEASONAL_GUIDE || [];
    for (var i = 0; i < G.length; i++) if (G[i].months.indexOf(month) >= 0) return i;
    return 0;
  }
  var curSeason = seasonFor(NOW.getMonth() + 1), shownSeason = curSeason, tabsScrolled = false;
  function renderSeason() {
    var G = window.SEASONAL_GUIDE, box = document.getElementById("season-body");
    if (!G || !box) return;
    var g = G[shownSeason], mon = NOW.getMonth() + 1;
    var tabs = document.getElementById("season-tabs");
    if (tabs) {
      tabs.innerHTML = G.map(function (s, i) {
        return '<button type="button" role="tab" aria-selected="' + (i === shownSeason) + '" data-i="' + i + '">' +
          esc(s.season) + '<small>' + s.months.join("・") + "月</small>" + (i === curSeason ? "<em>いま</em>" : "") + "</button>";
      }).join("");
      tabs.querySelectorAll("button").forEach(function (b) {
        b.addEventListener("click", function () { shownSeason = +b.getAttribute("data-i"); renderSeason(); });
      });
      if (!tabsScrolled) { tabsScrolled = true; var cb = tabs.children[curSeason]; if (cb) tabs.scrollLeft = Math.max(0, cb.offsetLeft - tabs.offsetLeft - 16); }
    }
    box.className = "season-body s-" + g.key;
    box.innerHTML =
      '<p class="season-kicker">' + (shownSeason === curSeason ? mon + "月のからだケア" : esc(g.season) + "（" + g.months.join("・") + "月）のからだケア") + "</p>" +
      "<h3>" + esc(g.title) + "</h3><p class=\"season-lead\">" + esc(g.lead) + "</p>" +
      '<ol class="tips">' + g.tips.map(function (t) { return "<li><strong>" + esc(t[0]) + "</strong><span>" + esc(t[1]) + "</span></li>"; }).join("") + "</ol>";

    var c = G[curSeason];
    var r = document.getElementById("reminder");
    if (r) r.innerHTML = '<span class="rm-label">' + esc(c.reminder.label) + "</span><p>" + esc(c.reminder.text) + "</p>";
    var hs = document.getElementById("hero-season");
    if (hs) hs.innerHTML = "<b>" + mon + "月のからだケア</b>" + esc(c.title) + " →";
  }

  /* ---------- お知らせ ---------- */
  function newsItems() {
    var today = ymd(NOW);
    return (window.NEWS || [])
      .filter(function (n) { return n && n.date && n.date <= today; })   // 未来日付は予約投稿として非表示
      .slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  }
  function newsId(n) {
    var h = 0, s = n.date + n.title;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return "n" + n.date.replace(/-/g, "") + "-" + h.toString(36).slice(0, 5);
  }
  function catKey(c) { return { "お知らせ": "info", "休診": "closed", "予防": "care", "コラム": "column" }[c] || "info"; }
  function isNew(n) { var diff = (parseYmd(ymd(NOW)) - parseYmd(n.date)) / 864e5; return diff >= 0 && diff <= 30; }
  function dateLabel(n) { var d = parseYmd(n.date); return d.getFullYear() + "." + (d.getMonth() + 1) + "." + d.getDate(); }
  function bodyHtml(b) { return esc(b).replace(/\n/g, "<br>"); }

  function renderNewsTop() {
    var box = document.getElementById("news-list");
    if (!box) return;
    var items = newsItems().slice(0, 3);
    box.innerHTML = items.map(function (n) {
      var plain = n.body.replace(/※サンプル記事です。?/g, "").replace(/\n/g, " ");
      return '<li class="news-card c-' + catKey(n.category) + '"><a href="news.html#' + newsId(n) + '">' +
        '<p class="nc-meta"><span class="cat">' + esc(n.category) + "</span>" + (isNew(n) ? '<span class="new">NEW</span>' : "") + "</p>" +
        '<h3>' + esc(n.title) + "</h3>" +
        '<p class="nc-ex">' + esc(plain.length > 54 ? plain.slice(0, 54) + "…" : plain) + "</p>" +
        '<p class="nc-date"><time datetime="' + n.date + '">' + dateLabel(n) + "</time></p></a></li>";
    }).join("");
  }

  function renderNewsAll() {
    var box = document.getElementById("news-all");
    if (!box) return;
    var all = newsItems(), cur = "すべて";
    var cats = ["すべて"].concat(all.map(function (n) { return n.category; }).filter(function (c, i, a) { return a.indexOf(c) === i; }));
    var f = document.getElementById("news-filter");
    function draw() {
      f.innerHTML = cats.map(function (c) { return '<button type="button" aria-pressed="' + (c === cur) + '">' + esc(c) + "</button>"; }).join("");
      f.querySelectorAll("button").forEach(function (b) { b.addEventListener("click", function () { cur = b.textContent; draw(); }); });
      box.innerHTML = all.filter(function (n) { return cur === "すべて" || n.category === cur; }).map(function (n) {
        return '<article class="news-item c-' + catKey(n.category) + '" id="' + newsId(n) + '">' +
          '<p class="nc-meta"><span class="cat">' + esc(n.category) + "</span>" + (isNew(n) ? '<span class="new">NEW</span>' : "") +
          '<time datetime="' + n.date + '">' + dateLabel(n) + "</time></p>" +
          "<h2>" + esc(n.title) + "</h2><p>" + bodyHtml(n.body) + "</p></article>";
      }).join("");
    }
    draw();
    if (location.hash) { var t = document.getElementById(location.hash.slice(1)); if (t) { t.classList.add("is-target"); t.scrollIntoView(); } }
  }

  /* ---------- 共通 ---------- */
  function common() {
    document.querySelectorAll(".js-year").forEach(function (e) { e.textContent = NOW.getFullYear(); });
    if (forced) {
      var bar = document.createElement("div");
      bar.className = "date-sim";
      bar.innerHTML = "確認用：表示日時を <strong>" + esc(md(forced) + " " + forced.getHours() + ":" + pad(forced.getMinutes())) + "</strong> に固定中　<a href=\"" + location.pathname + "\">解除</a>";
      document.body.appendChild(bar);
      // ページ内リンクにも ?date= を引き継ぐ
      document.querySelectorAll('a[href^="index.html"],a[href^="news.html"]').forEach(function (a) {
        var parts = a.getAttribute("href").split("#");
        a.setAttribute("href", parts[0] + location.search + (parts[1] ? "#" + parts[1] : ""));
      });
    }
    var btn = document.getElementById("menu-btn"), nav = document.getElementById("site-nav");
    if (btn && nav) {
      btn.addEventListener("click", function () {
        var open = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!open)); nav.classList.toggle("is-open", !open);
      });
      nav.querySelectorAll("a").forEach(function (a) {
        a.addEventListener("click", function () { btn.setAttribute("aria-expanded", "false"); nav.classList.remove("is-open"); });
      });
    }
  }

  common();
  renderStatus();
  renderCalendar();
  highlightHours();
  renderSeason();
  renderNewsTop();
  renderNewsAll();
  // ページを開いたままでも状況が変わるよう1分ごとに更新（日時固定中は更新しない）
  if (!forced) setInterval(function () { NOW = new Date(); renderStatus(); }, 60000);

  // テスト用に公開
  window.__clinic = { dayInfo: dayInfo, currentStatus: currentStatus, nextOpening: nextOpening };
})();
