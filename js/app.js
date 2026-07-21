/* 2026 世界盃 會員問卷 — 前端邏輯 */
(function () {
  "use strict";
  var CFG = window.APP_CONFIG || {};
  var SURVEY = window.SURVEY || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };

  // 讀取分群參數
  var params = new URLSearchParams(location.search);
  var seg = (params.get("seg") || "").toUpperCase().trim();
  var validSegs = Object.keys(SURVEY.segments || {});

  // 文案
  $("#eyebrow").textContent = CFG.brandEyebrow || $("#eyebrow").textContent;
  $("#title").textContent = CFG.brandTitle || $("#title").textContent;
  $("#intro").textContent = SURVEY.intro || "";
  $("#doneText").textContent = SURVEY.outro || "感謝您的填答。";

  var state = {}; // qid -> answer

  if (!seg || validSegs.indexOf(seg) === -1) {
    renderPicker();
  } else {
    renderSurvey(seg);
  }

  /* ---------- 預覽選擇器 ---------- */
  function renderPicker() {
    var desc = {
      S1: "有領獎 ＋ 活動期間貨量成長（真效益模範）",
      S2: "有領獎 ＋ 貨量未成長／下降（假參與診斷）",
      S3: "有參與但未領獎（差臨門一腳）",
      S4: "未參與 ＋ 貨量成長（自然量未接住）",
      S5: "未參與 ＋ 貨量下降／持平（流失／沉睡）"
    };
    var grid = $("#pickerGrid");
    validSegs.forEach(function (k) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "pcard";
      b.innerHTML =
        '<span class="pcard__tag">' + k + '</span>' +
        '<span><span class="pcard__t">' + k + ' 分群問卷</span>' +
        '<span class="pcard__d">' + (desc[k] || "") + '</span></span>';
      b.addEventListener("click", function () {
        location.search = "?seg=" + k;
      });
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

    $("#survey").addEventListener("submit", function (e) {
      e.preventDefault();
      submit(segKey, qs);
    });
  }

  function buildQuestion(q, num) {
    var card = document.createElement("section");
    card.className = "q";
    card.dataset.qid = q.id;
    card.dataset.type = q.type;
    var required = q.type !== "open";

    var head = document.createElement("div");
    head.className = "q__head";
    head.innerHTML =
      '<span class="q__num">' + num + '</span>' +
      '<p class="q__text">' + esc(q.q) + (required ? '<span class="q__req">＊</span>' : '') + '</p>';
    card.appendChild(head);

    if (q.type === "single" || q.type === "multi") card.appendChild(buildChoice(q));
    else if (q.type === "rank") card.appendChild(buildRank(q));
    else card.appendChild(buildOpen(q));

    return card;
  }

  function buildChoice(q) {
    var wrap = document.createElement("div");
    wrap.className = "opts";
    var multi = q.type === "multi";
    q.options.forEach(function (opt, idx) {
      var id = q.id + "-" + idx;
      var lab = document.createElement("label");
      lab.className = "opt" + (multi ? " opt--multi" : "");
      lab.innerHTML =
        '<input type="' + (multi ? "checkbox" : "radio") + '" name="' + q.id + '" value="' + esc(opt) + '" id="' + id + '">' +
        '<span class="opt__box"></span><span class="opt__label">' + esc(opt) + '</span>';
      var input = lab.querySelector("input");
      input.addEventListener("change", function () {
        if (multi) {
          var vals = state[q.id] || [];
          if (input.checked) vals = vals.concat([opt]);
          else vals = vals.filter(function (v) { return v !== opt; });
          state[q.id] = vals;
          lab.classList.toggle("is-on", input.checked);
        } else {
          state[q.id] = opt;
          Array.prototype.forEach.call(wrap.querySelectorAll(".opt"), function (o) { o.classList.remove("is-on"); });
          lab.classList.add("is-on");
        }
        clearMissing(q.id);
        updateProgress();
      });
      wrap.appendChild(lab);
    });
    return wrap;
  }

  function buildRank(q) {
    var wrap = document.createElement("div");
    var hint = document.createElement("p");
    hint.className = "rank__hint";
    hint.textContent = "請依序點選（第 1 名 → 第 4 名），再次點選可取消。";
    wrap.appendChild(hint);

    var list = document.createElement("div");
    list.className = "ranks";
    var order = []; // 依點選順序存 option

    q.options.forEach(function (opt) {
      var row = document.createElement("div");
      row.className = "rank";
      row.tabIndex = 0;
      row.setAttribute("role", "button");
      row.innerHTML = '<span class="rank__badge">·</span><span class="rank__label">' + esc(opt) + '</span>';
      function toggle() {
        var pos = order.indexOf(opt);
        if (pos === -1) order.push(opt);
        else order.splice(pos, 1);
        paint();
      }
      row.addEventListener("click", toggle);
      row.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
      });
      row._opt = opt;
      list.appendChild(row);
    });

    var reset = document.createElement("button");
    reset.type = "button";
    reset.className = "rank__reset";
    reset.textContent = "重設排序";
    reset.addEventListener("click", function () { order = []; paint(); });

    function paint() {
      Array.prototype.forEach.call(list.children, function (row) {
        var pos = order.indexOf(row._opt);
        var badge = row.querySelector(".rank__badge");
        if (pos === -1) { row.classList.remove("is-on"); badge.textContent = "·"; }
        else { row.classList.add("is-on"); badge.textContent = String(pos + 1); }
      });
      // 全部排序完成才算作答
      state[q.id] = order.length === q.options.length ? order.slice() : undefined;
      clearMissing(q.id);
      updateProgress();
    }

    wrap.appendChild(list);
    wrap.appendChild(reset);
    return wrap;
  }

  function buildOpen(q) {
    var ta = document.createElement("textarea");
    ta.placeholder = "請輸入您的想法（選填）";
    ta.maxLength = 500;
    ta.addEventListener("input", function () {
      state[q.id] = ta.value.trim() || undefined;
      updateProgress();
    });
    return ta;
  }

  /* ---------- 進度 ---------- */
  function requiredIds(qs) {
    return (qs || currentQs()).filter(function (q) { return q.type !== "open"; }).map(function (q) { return q.id; });
  }
  function currentQs() {
    return (SURVEY.segments[seg] && SURVEY.segments[seg].questions) || [];
  }
  function answeredCount() {
    return requiredIds().filter(function (id) { return isAnswered(id); }).length;
  }
  function isAnswered(id) {
    var v = state[id];
    if (v === undefined || v === null) return false;
    if (Array.isArray(v)) return v.length > 0;
    return String(v).length > 0;
  }
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
      submissionId: genId(),
      seg: segKey,
      ts: new Date().toISOString(),
      ua: navigator.userAgent,
      answers: qs.map(function (q) {
        var v = state[q.id];
        if (Array.isArray(v)) v = v.join(" ｜ ");
        return { qid: q.id, question: q.q, answer: v == null ? "" : String(v) };
      })
    };

    var btn = $("#submitBtn");
    btn.disabled = true; btn.textContent = "送出中…";
    setHint("");

    sendToSheet(payload, function () {
      showDone();
    });
  }

  function sendToSheet(payload, done) {
    var url = (CFG.ENDPOINT || "").trim();
    if (!url) {
      // 示範模式：未設定後端，仍完成流程並在 console 顯示
      console.warn("[示範模式] 尚未設定 APP_CONFIG.ENDPOINT，回答未寫入 Sheet。內容：", payload);
      setTimeout(done, 500);
      return;
    }
    // Apps Script Web App：以 no-cors + text/plain 送出（規避瀏覽器 CORS 限制）
    fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    }).then(function () { done(); })
      .catch(function () {
        // no-cors 下多半仍已送達；保底仍導向完成畫面
        console.warn("送出時發生網路例外，但資料可能已寫入。");
        done();
      });
  }

  function showDone() {
    $("#survey").hidden = true;
    $("#picker").hidden = true;
    $("#progressBar").style.width = "100%";
    var done = $("#done");
    done.hidden = false;
    done.scrollIntoView({ behavior: "smooth", block: "start" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- 小工具 ---------- */
  function markMissing(id) {
    var el = document.querySelector('.q[data-qid="' + id + '"]');
    if (el) el.classList.add("is-missing");
  }
  function clearMissing(id) {
    var el = document.querySelector('.q[data-qid="' + id + '"]');
    if (el) el.classList.remove("is-missing");
    setHint("");
  }
  function setHint(msg, isErr) {
    var h = $("#submitHint");
    h.textContent = msg || "";
    h.classList.toggle("is-err", !!isErr);
  }
  function genId() {
    return "R" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
})();
