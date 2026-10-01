const SPREADSHEET_ID = "11NZ0bl7I-pn3reUtbabx3DQEELKXmRhcb18nJ66hccg";

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || "bootstrap");
    if (action !== "bootstrap") throw new Error("不支援的讀取動作");
    return json_({ ok: true, ...bootstrap_() });
  } catch (error) {
    return json_({ ok: false, error: error.message });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const body = JSON.parse((e.postData && e.postData.contents) || "{}");
    if (clean_(body.groupCode, 40) !== groupCode_()) throw new Error("群組通關碼不正確");
    if (body.action === "feedback") return json_(saveFeedback_(body));
    if (body.action === "suggestion") return json_(saveSuggestion_(body));
    throw new Error("不支援的寫入動作");
  } catch (error) {
    return json_({ ok: false, error: error.message });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function bootstrap_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const places = rows_(ss.getSheetByName("Places")).filter(r => r.status === "approved").map(placeFromRow_);
  const approvedSuggestions = rows_(ss.getSheetByName("Suggestions"))
    .filter(r => r.status === "approved" && finite_(r.lat) && finite_(r.lng))
    .map(suggestionFromRow_);
  const feedbackRows = rows_(ss.getSheetByName("Feedback")).filter(r => r.status === "approved" && r.feedback_id !== "SYSTEM_INIT");
  const feedback = {};
  feedbackRows.forEach(row => {
    const placeId = String(row.place_id || "");
    if (!feedback[placeId]) feedback[placeId] = { agree: 0, disagree: 0, reviews: [] };
    if (row.feedback_type === "agree") feedback[placeId].agree++;
    if (row.feedback_type === "disagree") feedback[placeId].disagree++;
    if (row.feedback_type === "comment") feedback[placeId].reviews.push({
      name: String(row.display_name || ""), text: String(row.comment || ""), at: iso_(row.created_at)
    });
  });
  return { places: places.concat(approvedSuggestions), feedback, updatedAt: new Date().toISOString() };
}

function saveFeedback_(body) {
  const placeId = clean_(body.placeId, 100);
  const displayName = required_(body.displayName, "請填寫名字", 30);
  const type = clean_(body.feedbackType, 20);
  const clientId = required_(body.clientId, "缺少裝置識別碼", 100);
  if (!["agree", "disagree", "comment"].includes(type)) throw new Error("意見類型不正確");
  const comment = type === "comment" ? required_(body.comment, "請填寫評價", 300) : "";
  if (!publicPlaceIds_().has(placeId)) throw new Error("找不到這個店家");

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Feedback");
  const now = new Date();
  if (type !== "comment") {
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][2]) === placeId && ["agree", "disagree"].includes(String(values[i][3])) && String(values[i][7]) === clientId) {
        sheet.getRange(i + 1, 2, 1, 7).setValues([["approved", placeId, type, displayName, "", now, clientId]]);
        return { ok: true, message: "投票已更新" };
      }
    }
  }
  sheet.appendRow([Utilities.getUuid(), "approved", placeId, type, displayName, comment, now, clientId, ""]);
  return { ok: true, message: type === "comment" ? "評價已送出" : "投票已送出" };
}

function saveSuggestion_(body) {
  const displayName = required_(body.displayName, "請填寫名字", 30);
  const name = required_(body.name, "請填寫店名", 80);
  const reason = required_(body.reason, "請填寫推薦原因", 300);
  const url = clean_(body.googleMapsUrl, 500);
  if (url && !/^https:\/\/(www\.)?(google\.[^/]+\/maps|maps\.app\.goo\.gl)\//i.test(url)) throw new Error("請貼上 Google Maps 網址");
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Suggestions");
  sheet.appendRow([Utilities.getUuid(), "pending", name, url, clean_(body.category, 40), reason, displayName, "", "", "", new Date(), ""]);
  return { ok: true, message: "推薦已送出，待管理者確認位置" };
}

function publicPlaceIds_() {
  const data = bootstrap_();
  return new Set(data.places.map(p => p.id));
}

function groupCode_() {
  const value = PropertiesService.getScriptProperties().getProperty("GROUP_CODE");
  if (!value) throw new Error("後端尚未設定群組通關碼");
  return value;
}

function rows_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (!values.length) return [];
  const headers = values[0].map(String);
  return values.slice(1).map(row => Object.fromEntries(headers.map((h, i) => [h, row[i]])));
}

function placeFromRow_(r) {
  return { id: String(r.place_id), name: String(r.name), category: String(r.category || "其他"), sentiment: String(r.sentiment || "mixed"), lat: Number(r.lat), lng: Number(r.lng), address: String(r.address || ""), googleRating: nullableNumber_(r.google_rating), googleReviews: nullableNumber_(r.google_reviews), googleMaps: String(r.google_maps_url || ""), chatQuote: String(r.chat_quote || ""), sourceNote: String(r.source_note || ""), tags: String(r.tags || "").split(",").filter(Boolean) };
}

function suggestionFromRow_(r) {
  return { id: "suggestion-" + r.suggestion_id, name: String(r.name), category: String(r.category || "群友新增"), sentiment: "mixed", lat: Number(r.lat), lng: Number(r.lng), address: String(r.address || ""), googleRating: null, googleReviews: null, googleMaps: String(r.google_maps_url || ""), chatQuote: String(r.reason || ""), sourceNote: "由 " + String(r.display_name || "群友") + " 推薦", tags: [String(r.category || "群友新增")] };
}

function required_(value, message, max) { const v = clean_(value, max); if (!v) throw new Error(message); return v; }
function clean_(value, max) { return String(value == null ? "" : value).replace(/[<>]/g, "").trim().slice(0, max); }
function finite_(value) { return value !== "" && Number.isFinite(Number(value)); }
function nullableNumber_(value) { return finite_(value) ? Number(value) : null; }
function iso_(value) { return value instanceof Date ? value.toISOString() : String(value || ""); }
function json_(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }
