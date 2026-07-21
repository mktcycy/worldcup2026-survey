/* 2026 世界盃 會員問卷 — 前端邏輯（雙版本・成長引擎版） */
(function () {
  "use strict";
  var CFG = window.APP_CONFIG || {};
  var SURVEY = window.SURVEY || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };

  var params = new URLSearchParams(location.search);
  var role = (params.get("role") || "").toLowerCase().trim();
  var seg = (params.get("seg") || "").toUpperCase().trim();
  var refFrom = (params.get("ref") || "").trim();
  var memberShareUrl = ""; // 會員產生的專屬邀請連結
  var state = {};

  var memberSegs = Object.keys((SURVEY.member && SURVEY.member.segments) || {});
  if (seg && !role) role = "member"; // ?seg= 簡寫視為會員版

  var activeRole = null, activeSeg = null, activeQs = null;

  $("#eyebrow").textContent = CFG.brandEyebrow || $("#eyebrow").textContent;

  if (role === "friend") {
    activeRole = "friend"; activeQs = SURVEY.friend.questions;
    $("#title").textContent = "2 分鐘體育小問卷";
    $("#intro").textContent = SURVEY.friend.intro || "";
    $("#doneText").textContent = SURVEY.friend.outro || "感謝您的填答。";
    renderSurvey();
  } else if (role === "member" && memberSegs.indexOf(seg) !== -1) {
    activeRole = "member"; activeSeg = seg; activeQs = SURVEY.member.segments[seg].questions;
    $("#title").textContent = "了解您，也邀您一起玩";
    $("#intro").textContent = SURVEY.member.intro || "";
    $("#doneText").textContent = SURVEY.member.outro || "感謝您的填答。";
    renderSurvey();
  } else {
    renderPicker();
  }

  /* ---------- 版本選擇（預覽） ---------- */
  function renderPicker() {
    $("#title").textContent = "2026 世界盃 問卷（預覽）";
    $("#intro").textContent = "會員版依分群各有專屬題目；好友版供被推薦的新朋友填寫。以下供內部預覽。";
    var segDesc = {
      S1: "有領獎＋貨量成長（真效益模範）", S2: "有領獎＋貨量未成長/下降（薅羊毛）",
      S3: "有參與但未領獎（差臨門一腳）", S4: "未參與＋貨量成長（自然量未接住）",
      S5: "未參與＋貨量下降/持平（流失/沉睡）"
    };
    var grid = $("#pickerGrid");
    memberSegs.forEach(function (k) {
      grid.appendChild(pcard("會員 " + k, "會員版 · " + (segDesc[k] || ""), "?role=member&seg=" + k));
    });
    grid.appendChild(pcard("好友", "好友版 · 被推薦的新朋友填寫、完成後導向註冊", "?role=friend"));
    $("#picker").hidden = false;
  }
  function pcard(tag, desc, search) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "pcard";
    b.innerHTML = '<span class="pcard__tag">' + esc(tag) + '</span>' +
      '<span><span class="pcard__t">' + esc(tag) + ' 問卷</span>' +
      '<span class="pcard__d">' + esc(desc) + '</span></span>';
    b.addEventListener("click", function () { location.search = search; });
    return b;
  }

  /* ---------- 渲染問卷 ---------- */
  function renderSurvey() {
    var qs = activeQs;
    if (activeRole === "friend" && refFrom) {
      var banner = document.createElement("div");
      banner.className = "refbanner";
      banner.textContent = "🎁 您的邀請人推薦碼：" + refFrom + "　完成問卷並註冊投注，雙方皆可領獎勵";
      $("#questions").appendChild(banner);
    }
    var box = $("#questions");
    qs.forEach(function (q, i) { box.appendChild(buildQuestion(q, i + 1)); });
    $("#survey").hidden = false;
    updateProgress();
    $("#survey").addEventListener("submit", function (e) { e.preventDefault(); submit(); });
  }

  function isRequired(q) {
    if (q.type === "refcode") return false;
    if (q.type === "open") return q.required === true;
    return true;
  }

  function buildQuestion(q, num) {
    var card = document.createElement("section");
    card.className = "q"; card.dataset.qid = q.id; card.dataset.type = q.type;
    var required = isRequired(q);
    var head = document.createElement("div"); head.className = "q__head";
    head.innerHTML = '<span class="q__num">' + num + '</span>' +
      '<p class="q__text">' + esc(q.q) + (required ? '<span class="q__req">＊</span>' : '') + '</p>';
    card.appendChild(head);

    var body;
    if (q.type === "single" || q.type === "multi" || q.type === "scale") body = buildChoice(q);
    else if (q.type === "rank") body = buildRank(q);
    else if (q.type === "juster") body = buildJuster(q);
    else if (q.type === "conjoint") body = buildConjoint(q);
    else if (q.type === "refcode") body = buildRefcode(q);
    else body = buildOpen(q);
    card.appendChild(body);
    return card;
  }

  function buildChoice(q) {
    var wrap = document.createElement("div"); wrap.className = "opts";
    var multi = q.type === "multi";
    q.options.forEach(function (opt) {
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
          b.classList.add("is-on"); clearMissing(q.id); updateProgress();
        });
        scale.appendChild(b);
      })(n);
    }
    wrap.appendChild(scale);
    return wrap;
  }

  function buildConjoint(q) {
    var wrap = document.createElement("div"); wrap.className = "cj";
    var hint = document.createElement("p");
    hint.className = "cj__hint"; hint.textContent = "共 " + q.tasks.length + " 組，每組請點選一個您較想參加的方案。";
    wrap.appendChild(hint);
    var choice = {};
    q.tasks.forEach(function (task, ti) {
      var block = document.createElement("div"); block.className = "cj__task";
      var t = document.createElement("p"); t.className = "cj__tlabel"; t.textContent = "第 " + (ti + 1) + " 組"; block.appendChild(t);
      var pair = document.createElement("div"); pair.className = "cj__pair";
      ["A", "B"].forEach(function (letter) {
        var levels = task[letter];
        var cardEl = document.createElement("button");
        cardEl.type = "button"; cardEl.className = "cj__card";
        var rows = q.attrs.map(function (a, i) {
          return '<span class="cj__attr"><span class="cj__k">' + esc(a) + '</span><span class="cj__v">' + esc(levels[i]) + '</span></span>';
        }).join("");
        cardEl.innerHTML = '<span class="cj__badge">方案 ' + letter + '</span>' + rows + '<span class="cj__pick">選這個</span>';
        cardEl.addEventListener("click", function () {
          choice[task.id] = letter;
          Array.prototype.forEach.call(pair.children, function (c) { c.classList.remove("is-on"); });
          cardEl.classList.add("is-on");
          state[q.id] = Object.keys(choice).length === q.tasks.length ? assign({}, choice) : undefined;
          clearMissing(q.id); updateProgress();
        });
        pair.appendChild(cardEl);
      });
      block.appendChild(pair); wrap.appendChild(block);
    });
    return wrap;
  }

  /* 推薦碼 + 產生分享連結（會員版） */
  function buildRefcode(q) {
    var wrap = document.createElement("div"); wrap.className = "ref";
    if (q.note) { var n = document.createElement("p"); n.className = "ref__note"; n.textContent = q.note; wrap.appendChild(n); }
    var row = document.createElement("div"); row.className = "ref__row";
    var input = document.createElement("input");
    input.type = "text"; input.className = "ref__input"; input.placeholder = "輸入您的推薦碼"; input.maxLength = 40;
    var gen = document.createElement("button");
    gen.type = "button"; gen.className = "ref__btn"; gen.textContent = "產生邀請連結";
    row.appendChild(input); row.appendChild(gen);
    wrap.appendChild(row);

    var out = document.createElement("div"); out.className = "ref__out"; out.hidden = true;
    var linkEl = document.createElement("div"); linkEl.className = "ref__link";
    var copyBtn = document.createElement("button"); copyBtn.type = "button"; copyBtn.className = "ref__copy"; copyBtn.textContent = "複製連結";
    out.appendChild(linkEl); out.appendChild(copyBtn);
    wrap.appendChild(out);

    input.addEventListener("input", function () { state[q.id] = input.value.trim() || undefined; });
    gen.addEventListener("click", function () {
      var code = input.value.trim();
      if (!code) { input.focus(); return; }
      state[q.id] = code;
      memberShareUrl = shareUrlFor(code);
      linkEl.textContent = memberShareUrl;
      out.hidden = false;
    });
    copyBtn.addEventListener("click", function () { copy(memberShareUrl, copyBtn); });
    return wrap;
  }

  function buildOpen(q) {
    var ta = document.createElement("textarea");
    ta.placeholder = "請輸入您的想法（選填）"; ta.maxLength = 600;
    ta.addEventListener("input", function () { state[q.id] = ta.value.trim() || undefined; updateProgress(); });
    return ta;
  }

  /* ---------- 進度 ---------- */
  function currentQs() { return activeQs || []; }
  function requiredIds() {
    return currentQs().filter(isRequired).map(function (q) { return q.id; });
  }
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
  function submit() {
    var qs = activeQs;
    var missing = qs.filter(function (q) { return isRequired(q) && !isAnswered(q.id); });
    if (missing.length) {
      markMissing(missing[0].id);
      setHint("尚有 " + missing.length + " 題必填未完成，已為您定位至第一題。", true);
      var el = document.querySelector('.q[data-qid="' + missing[0].id + '"]');
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    var answers = qs.map(function (q) { return { qid: q.id, question: q.q, answer: serializeAnswer(q, state[q.id]) }; });
    if (activeRole === "friend" && refFrom) answers.unshift({ qid: "REF-FROM", question: "推薦人推薦碼(ref)", answer: refFrom });
    if (activeRole === "member") {
      var mc = memberCode();
      if (mc) answers.push({ qid: "MY-CODE", question: "會員自填推薦碼", answer: mc });
    }
    var segTag = activeRole === "friend" ? "FRIEND" : ("會員" + (activeSeg || ""));
    var payload = {
      submissionId: genId(), seg: segTag, ts: new Date().toISOString(), ua: navigator.userAgent, answers: answers
    };
    var btn = $("#submitBtn"); btn.disabled = true; btn.textContent = "送出中…"; setHint("");
    sendToSheet(payload, function () { showDone(activeRole); });
  }

  function memberCode() {
    var q = currentQs().filter(function (x) { return x.type === "refcode"; })[0];
    return q ? (state[q.id] || "") : "";
  }

  function serializeAnswer(q, v) {
    if (v == null) return "";
    if (Array.isArray(v)) return v.join(" ｜ ");
    if (q.type === "conjoint") return q.tasks.map(function (t, i) { return "第" + (i + 1) + "組=方案" + (v[t.id] || "-"); }).join(" ｜ ");
    return String(v);
  }

  function sendToSheet(payload, done) {
    var url = (CFG.ENDPOINT || "").trim();
    if (!url) { console.warn("[示範模式] 尚未設定 ENDPOINT，回答未寫入 Sheet：", payload); setTimeout(done, 500); return; }
    fetch(url, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) })
      .then(function () { done(); }).catch(function () { console.warn("送出例外，但資料可能已寫入。"); done(); });
  }

  /* ---------- 完成畫面（含 CTA / 分享） ---------- */
  function showDone(r) {
    $("#survey").hidden = true; $("#picker").hidden = true;
    $("#progressBar").style.width = "100%";
    var action = $("#doneAction"); action.innerHTML = "";
    if (r === "friend") {
      var url = SURVEY.registerUrl + (refFrom ? "?ref=" + encodeURIComponent(refFrom) : "");
      var a = document.createElement("a");
      a.className = "cta"; a.href = url; a.target = "_blank"; a.rel = "noopener";
      a.textContent = "立即註冊・領取新手體驗金 →";
      action.appendChild(a);
      var tip = document.createElement("p"); tip.className = "done__tip";
      tip.textContent = "註冊並完成首存投注，您與邀請您的朋友都能獲得獎勵。";
      action.appendChild(tip);
    } else if (r === "member") {
      var code = memberCode();
      if (code) {
        var box = document.createElement("div"); box.className = "sharebox";
        var h = document.createElement("p"); h.className = "sharebox__h"; h.textContent = "您的專屬邀請連結";
        var link = document.createElement("div"); link.className = "sharebox__link"; link.textContent = shareUrlFor(code);
        var cp = document.createElement("button"); cp.type = "button"; cp.className = "cta"; cp.textContent = "複製邀請連結";
        cp.addEventListener("click", function () { copy(shareUrlFor(code), cp); });
        box.appendChild(h); box.appendChild(link); box.appendChild(cp);
        action.appendChild(box);
      }
    }
    $("#done").hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- 小工具 ---------- */
  function shareUrlFor(code) {
    return location.origin + location.pathname + "?role=" + (SURVEY.shareParamRole || "friend") + "&ref=" + encodeURIComponent(code);
  }
  function copy(text, btn) {
    var old = btn.textContent;
    function ok() { btn.textContent = "已複製 ✓"; setTimeout(function () { btn.textContent = old; }, 1600); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, function () { fallbackCopy(text); ok(); });
    else { fallbackCopy(text); ok(); }
  }
  function fallbackCopy(text) {
    var t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select();
    try { document.execCommand("copy"); } catch (e) {} document.body.removeChild(t);
  }
  function assign(t, s) { for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) t[k] = s[k]; return t; }
  function markMissing(id) { var el = document.querySelector('.q[data-qid="' + id + '"]'); if (el) el.classList.add("is-missing"); }
  function clearMissing(id) { var el = document.querySelector('.q[data-qid="' + id + '"]'); if (el) el.classList.remove("is-missing"); setHint(""); }
  function setHint(msg, isErr) { var h = $("#submitHint"); h.textContent = msg || ""; h.classList.toggle("is-err", !!isErr); }
  function genId() { return "R" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
})();
