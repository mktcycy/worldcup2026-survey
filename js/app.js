/* 2026 世界盃 會員問卷 — 前端邏輯（專業深度版） */
(function () {
  "use strict";
  var CFG = window.APP_CONFIG || {};
  var SURVEY = window.SURVEY || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };

  var params = new URLSearchParams(location.search);
  var seg = (params.get("seg") || "").toUpperCase().trim();
  var validSegs = Object.keys(SURVEY.segments || {});

  $("#eyebrow").textContent = CFG.brandEyebrow || $("#eyebrow").textContent;
  $("#title").textContent = CFG.brandTitle || $("#title").textContent;
  $("#intro").textContent = SURVEY.intro || "";
  $("#doneText").textContent = SURVEY.outro || "感謝您的填答。";

  var state = {}; // qid -> answer

  if (!seg || validSegs.indexOf(seg) === -1) renderPicker();
  else renderSurvey(seg);

  /* ---------- 預覽選擇器 ---------- */
  function renderPicker() {
    var desc = {
      S1: "有領獎 ＋ 貨量成長（真效益模範）",
      S2: "有領獎 ＋ 貨量未成長／下降（假參與診斷）",
      S3: "有參與但未領獎（差臨門一腳）",
      S4: "未參與 ＋ 貨量成長（自然量未接住）",
      S5: "未參與 ＋ 貨量下降／持平（流失／沉睡）"
    };
    var grid = $("#pickerGrid");
    validSegs.forEach(function (k) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "pcard";
      b.innerHTML = '<span class="pcard__tag">' + k + '</span>' +
        '<span><span class="pcard__t">' + k + ' 分群問卷</span>' +
        '<span class="pcard__d">' + (desc[k] || "") + '</span></span>';
      b.addEventListener("click", function () { location.search = "?seg=" + k; });
      grid.appendChild(b);
    });
    $("#picker").hidden = false;
  }

  /* ---------- 問卷渲染 ---------- */
  function renderSurvey(segKey) {
    var qs = SURVEY.segments[segKey].questions;
    var box = $("#questions");
    qs.forEach(function (q, i) { box.appendChild(buildQuestion(q, i + 1)); });
    $("#survey").hidden = false;
    updateProgress();
    $("#survey").addEventListener("submit", function (e) { e.preventDefault(); submit(segKey, qs); });
  }

  function buildQuestion(q, num) {
    var card = document.createElement("section");
    card.className = "q";
    card.dataset.qid = q.id; card.dataset.type = q.type;
    var required = q.type !== "open";

    var head = document.createElement("div");
    head.className = "q__head";
    head.innerHTML = '<span class="q__num">' + num + '</span>' +
      '<p class="q__text">' + esc(q.q) + (required ? '<span class="q__req">＊</span>' : '') + '</p>';
    card.appendChild(head);

    var body;
    if (q.type === "single" || q.type === "multi" || q.type === "scale") body = buildChoice(q);
    else if (q.type === "rank") body = buildRank(q);
    else if (q.type === "juster") body = buildJuster(q);
    else if (q.type === "conjoint") body = buildConjoint(q);
    else if (q.type === "vw") body = buildVW(q);
    else body = buildOpen(q);
    card.appendChild(body);
    return card;
  }

  /* 單選 / 複選 / 量表 */
  function buildChoice(q) {
    var wrap = document.createElement("div");
    wrap.className = "opts" + (q.type === "scale" ? " opts--scale" : "");
    var multi = q.type === "multi";
    q.options.forEach(function (opt, idx) {
      var lab = document.createElement("label");
      lab.className = "opt" + (multi ? " opt--multi" : "");
      lab.innerHTML = '<input type="' + (multi ? "checkbox" : "radio") + '" name="' + q.id + '" value="' + esc(opt) + '">' +
        '<span class="opt__box"></span><span class="opt__label">' + esc(opt) + '</span>';
      var input = lab.querySelector("input");
      input.addEventListener("change", function () {
        if (multi) {
          var vals = state[q.id] || [];
          vals = input.checked ? vals.concat([opt]) : vals.filter(function (v) { return v !== opt; });
          state[q.id] = vals.length ? vals : undefined;
          lab.classList.toggle("is-on", input.checked);
        } else {
          state[q.id] = opt;
          Array.prototype.forEach.call(wrap.querySelectorAll(".opt"), function (o) { o.classList.remove("is-on"); });
          lab.classList.add("is-on");
        }
        clearMissing(q.id); updateProgress();
      });
      wrap.appendChild(lab);
    });
    return wrap;
  }

  /* 排序（MaxDiff） */
  function buildRank(q) {
    var wrap = document.createElement("div");
    var hint = document.createElement("p");
    hint.className = "rank__hint"; hint.textContent = "請依序點選（第 1 名 → 最後一名），再次點選可取消。";
    wrap.appendChild(hint);
    var list = document.createElement("div"); list.className = "ranks";
    var order = [];
    q.options.forEach(function (opt) {
      var row = document.createElement("div");
      row.className = "rank"; row.tabIndex = 0; row.setAttribute("role", "button");
      row.innerHTML = '<span class="rank__badge">·</span><span class="rank__label">' + esc(opt) + '</span>';
      row._opt = opt;
      function toggle() { var p = order.indexOf(opt); if (p === -1) order.push(opt); else order.splice(p, 1); paint(); }
      row.addEventListener("click", toggle);
      row.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
      list.appendChild(row);
    });
    var reset = document.createElement("button");
    reset.type = "button"; reset.className = "rank__reset"; reset.textContent = "重設排序";
    reset.addEventListener("click", function () { order = []; paint(); });
    function paint() {
      Array.prototype.forEach.call(list.children, function (row) {
        var p = order.indexOf(row._opt), b = row.querySelector(".rank__badge");
        if (p === -1) { row.classList.remove("is-on"); b.textContent = "·"; }
        else { row.classList.add("is-on"); b.textContent = String(p + 1); }
      });
      state[q.id] = order.length === q.options.length ? order.slice() : undefined;
      clearMissing(q.id); updateProgress();
    }
    wrap.appendChild(list); wrap.appendChild(reset);
    return wrap;
  }

  /* 忠誠意圖（Juster 0–10） */
  function buildJuster(q) {
    var wrap = document.createElement("div"); wrap.className = "juster";
    var ends = document.createElement("div"); ends.className = "juster__ends";
    ends.innerHTML = '<span>' + esc(q.low || "0") + '</span><span>' + esc(q.high || "10") + '</span>';
    wrap.appendChild(ends);
    var scale = document.createElement("div"); scale.className = "juster__scale";
    for (var n = 0; n <= 10; n++) {
      (function (val) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "jbtn"; b.textContent = String(val);
        b.addEventListener("click", function () {
          state[q.id] = val;
          Array.prototype.forEach.call(scale.children, function (c) { c.classList.remove("is-on"); });
          b.classList.add("is-on");
          clearMissing(q.id); updateProgress();
        });
        scale.appendChild(b);
      })(n);
    }
    wrap.appendChild(scale);
    return wrap;
  }

  /* 取捨量化（Conjoint choice） */
  function buildConjoint(q) {
    var wrap = document.createElement("div"); wrap.className = "cj";
    var hint = document.createElement("p");
    hint.className = "cj__hint"; hint.textContent = "共 " + q.tasks.length + " 組，每組請點選一個您較想參加的方案。";
    wrap.appendChild(hint);
    var choice = {};
    q.tasks.forEach(function (task, ti) {
      var block = document.createElement("div"); block.className = "cj__task";
      var t = document.createElement("p"); t.className = "cj__tlabel"; t.textContent = "第 " + (ti + 1) + " 組";
      block.appendChild(t);
      var pair = document.createElement("div"); pair.className = "cj__pair";
      ["A", "B"].forEach(function (letter) {
        var levels = task[letter];
        var cardEl = document.createElement("button");
        cardEl.type = "button"; cardEl.className = "cj__card";
        var rows = q.attrs.map(function (a, i) {
          return '<span class="cj__attr"><span class="cj__k">' + esc(a) + '</span><span class="cj__v">' + esc(levels[i]) + '</span></span>';
        }).join("");
        cardEl.innerHTML = '<span class="cj__badge">方案 ' + letter + '</span>' + rows +
          '<span class="cj__pick">選這個</span>';
        cardEl.addEventListener("click", function () {
          choice[task.id] = letter;
          Array.prototype.forEach.call(pair.children, function (c) { c.classList.remove("is-on"); });
          cardEl.classList.add("is-on");
          state[q.id] = Object.keys(choice).length === q.tasks.length ? assign({}, choice) : undefined;
          clearMissing(q.id); updateProgress();
        });
        pair.appendChild(cardEl);
      });
      block.appendChild(pair);
      wrap.appendChild(block);
    });
    return wrap;
  }

  /* 門檻敏感度（Van Westendorp 矩陣） */
  function buildVW(q) {
    var wrap = document.createElement("div"); wrap.className = "vw";
    var ans = {};
    q.rows.forEach(function (rowLabel, ri) {
      var row = document.createElement("div"); row.className = "vw__row";
      var lab = document.createElement("p"); lab.className = "vw__label"; lab.textContent = rowLabel;
      row.appendChild(lab);
      var bands = document.createElement("div"); bands.className = "vw__bands";
      q.bands.forEach(function (band) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "vw__band"; b.textContent = band;
        b.addEventListener("click", function () {
          ans[ri] = band;
          Array.prototype.forEach.call(bands.children, function (c) { c.classList.remove("is-on"); });
          b.classList.add("is-on");
          state[q.id] = Object.keys(ans).length === q.rows.length ? assign({}, ans) : undefined;
          clearMissing(q.id); updateProgress();
        });
        bands.appendChild(b);
      });
      row.appendChild(bands);
      wrap.appendChild(row);
    });
    return wrap;
  }

  function buildOpen(q) {
    var ta = document.createElement("textarea");
    ta.placeholder = "請輸入您的想法（選填）"; ta.maxLength = 600;
    ta.addEventListener("input", function () { state[q.id] = ta.value.trim() || undefined; updateProgress(); });
    return ta;
  }

  /* ---------- 進度 ---------- */
  function currentQs() { return (SURVEY.segments[seg] && SURVEY.segments[seg].questions) || []; }
  function requiredIds() { return currentQs().filter(function (q) { return q.type !== "open"; }).map(function (q) { return q.id; }); }
  function isAnswered(id) {
    var v = state[id];
    if (v === undefined || v === null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "object") return Object.keys(v).length > 0;
    return String(v).length > 0;
  }
  function answeredCount() { return requiredIds().filter(isAnswered).length; }
  function updateProgress() {
    var req = requiredIds();
    var pct = req.length ? Math.round((answeredCount() / req.length) * 100) : 0;
    $("#progressBar").style.width = pct + "%";
  }

  /* ---------- 送出 ---------- */
  function submit(segKey, qs) {
    var missing = qs.filter(function (q) { return q.type !== "open" && !isAnswered(q.id); });
    if (missing.length) {
      markMissing(missing[0].id);
      setHint("尚有 " + missing.length + " 題必填未完成，已為您定位至第一題。", true);
      var el = document.querySelector('.q[data-qid="' + missing[0].id + '"]');
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    var payload = {
      submissionId: genId(), seg: segKey, ts: new Date().toISOString(), ua: navigator.userAgent,
      answers: qs.map(function (q) { return { qid: q.id, question: q.q, answer: serializeAnswer(q, state[q.id]) }; })
    };
    var btn = $("#submitBtn");
    btn.disabled = true; btn.textContent = "送出中…"; setHint("");
    sendToSheet(payload, showDone);
  }

  function serializeAnswer(q, v) {
    if (v == null) return "";
    if (Array.isArray(v)) return v.join(" ｜ ");
    if (q.type === "conjoint") {
      return q.tasks.map(function (t, i) { return "第" + (i + 1) + "組=方案" + (v[t.id] || "-"); }).join(" ｜ ");
    }
    if (q.type === "vw") {
      var marks = ["①", "②", "③", "④", "⑤", "⑥"];
      return q.rows.map(function (_, i) { return marks[i] + "=" + (v[i] || "-"); }).join(" ｜ ");
    }
    return String(v);
  }

  function sendToSheet(payload, done) {
    var url = (CFG.ENDPOINT || "").trim();
    if (!url) { console.warn("[示範模式] 尚未設定 ENDPOINT，回答未寫入 Sheet：", payload); setTimeout(done, 500); return; }
    fetch(url, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) })
      .then(function () { done(); })
      .catch(function () { console.warn("送出例外，但資料可能已寫入。"); done(); });
  }

  function showDone() {
    $("#survey").hidden = true; $("#picker").hidden = true;
    $("#progressBar").style.width = "100%";
    $("#done").hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- 小工具 ---------- */
  function assign(t, s) { for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) t[k] = s[k]; return t; }
  function markMissing(id) { var el = document.querySelector('.q[data-qid="' + id + '"]'); if (el) el.classList.add("is-missing"); }
  function clearMissing(id) { var el = document.querySelector('.q[data-qid="' + id + '"]'); if (el) el.classList.remove("is-missing"); setHint(""); }
  function setHint(msg, isErr) { var h = $("#submitHint"); h.textContent = msg || ""; h.classList.toggle("is-err", !!isErr); }
  function genId() { return "R" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
})();
