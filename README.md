# 成幼共學團 10/1 臺南美食地圖

這是一個可直接部署到 GitHub Pages 的純靜態網站。初始資料來自 `[LINE]成幼共學團.txt` 中 2026-10-01 的對話，只擷取公開店家與飲食心得，不收錄非必要的個人資料。

## 功能

- OpenStreetMap 免費公開底圖＋Leaflet 互動地圖
- 13 個已定位店家、7 個因店名或分店不明而暫緩定位的項目
- 推薦／討論中／踩雷三色點位與篩選
- 店名、餐點、對話內容搜尋
- 點位視窗顯示 2026-10-01 擷取的 Google 評分、評論數與 Google Maps 連結
- 具名認同／不認同與具名文字評價
- 具名新增店家申請；送出後先進入待審核清單
- Google 試算表＋Apps Script 共用資料庫，可跨裝置同步
- 電腦版側欄獨立捲動；手機版地圖固定在上方、內容正常垂直捲動

## 共用資料庫與管理

線上資料庫：[成幼共學團美食地圖資料庫](https://docs.google.com/spreadsheets/d/11NZ0bl7I-pn3reUtbabx3DQEELKXmRhcb18nJ66hccg/edit)

- `Places`：既有正式點位；`status=approved` 才會公開。
- `Feedback`：具名投票與留言。同一瀏覽器對同一店家的新投票會取代舊投票。
- `Suggestions`：群友新增的店家，預設為 `pending`。
- `Settings`：欄位版本與審核原則。

審核新增店家時，請在 `Suggestions` 補上 `address`、`lat`、`lng`，確認 Google Maps 網址與內容後，把 `status` 改成 `approved`。網站下次載入時就會出現；不採用的紀錄可改成 `hidden` 或 `rejected`，不必刪除。

網站「待確認店家」中的「補充位置」會將原始線索與待確認店名一併送入 `Suggestions`。核准後，網站會依這段來源標記或正式店名自動隱藏相對應的待確認項目，不必另外刪除原始紀錄。

目前群組通關碼請向管理者索取。若要更換，請到 Apps Script 專案「專案設定 → 指令碼屬性」，修改 `GROUP_CODE`；不必修改網站或重新部署。

Apps Script 公開端點只回傳 `approved` 資料。寫入留言、投票或新增店家時必須提供通關碼；通關碼只暫存在使用者該次瀏覽的 `sessionStorage`，不會寫進網站程式碼。

## 重要限制

Google 評分會變動；本版數值是 2026-10-01 的公開資料快照。店家地址經公開地理編碼服務轉為座標，已定位點位仍建議在正式發布前人工抽查。

這是適合小群組、輕用量的架構，不是完整會員系統。通關碼可以降低路人誤用，但無法取代 Google／LINE 登入、細緻權限或大量濫用防護。

## 本機預覽

Windows 請直接雙擊 `啟動美食地圖.cmd`。它會啟動本機網站並自動開啟瀏覽器；保留命令視窗即可持續瀏覽，關閉命令視窗會停止本機網站。

也可在本資料夾自行啟動任一靜態 HTTP 伺服器，例如：

```powershell
python -m http.server 8000
```

再開啟 `http://localhost:8000/`。不建議直接雙擊 `index.html`，也不要把 Codex 的檔案內容預覽當成網站預覽。

## GitHub Pages

1. 建立一個新的獨立 repository（不要與既有的「台灣主要道路里程定位」混用）。
2. 將本資料夾內容放在 repository 根目錄並推送至 `main`。
3. 在 GitHub repository 的 **Settings → Pages**，選擇 **Deploy from a branch**、`main`、`/(root)`。
4. 等待部署完成後，以手機與電腦各測一次。

正式推送前，請先確認 repository 名稱與 public/private；GitHub Pages 免費公開網站通常使用 public repository。
