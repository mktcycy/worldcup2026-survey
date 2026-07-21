/**
 * 2026 世界盃 會員問卷 — Google Apps Script 後端
 * 作用：接收問卷網頁 POST 過來的作答，逐題寫入試算表「回覆」分頁。
 *
 * ── 部署步驟（約 2 分鐘，需用 mktcycy@gmail.com 本人操作）──
 * 1. 開啟你要收資料的 Google 試算表（可用我建的「2026世足問卷_回覆」）。
 * 2. 上方選單：擴充功能 → Apps Script。
 * 3. 刪掉預設內容，貼上本檔全部程式碼，存檔。
 * 4. 右上「部署」→「新增部署作業」→ 類型選「網頁應用程式」。
 * 5. 設定：
 *      - 執行身分：我（你自己）
 *      - 具有存取權的使用者：任何人
 * 6. 「部署」→ 授權（第一次會要你允許）→ 複製「網頁應用程式網址」
 *    （長得像 https://script.google.com/macros/s/AKfycb..../exec）。
 * 7. 把該網址貼到網站的 js/config.js 的 ENDPOINT，或直接傳給我，我幫你更新並重新部署。
 *
 * 之後每筆作答會以「一題一列」寫入，方便你做樞紐表分析。
 */

var SHEET_NAME = '回覆';
var HEADERS = ['提交時間', '提交ID', '分群', '題號', '題目', '回答', '裝置'];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sh.getLastRow() === 0) {
      sh.appendRow(HEADERS);
      sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
    var ts = data.ts ? new Date(data.ts) : new Date();
    var ua = (data.ua || '').slice(0, 200);
    var rows = (data.answers || []).map(function (a) {
      return [ts, data.submissionId || '', data.seg || '', a.qid || '', a.question || '', a.answer || '', ua];
    });
    if (rows.length) {
      sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEADERS.length).setValues(rows);
    }
    return json({ ok: true, saved: rows.length });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// 方便用瀏覽器測試部署是否成功
function doGet() {
  return json({ ok: true, service: 'worldcup2026-survey', ts: new Date().toISOString() });
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
