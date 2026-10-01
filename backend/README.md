# Google Apps Script 後端

此資料夾保存與「成幼共學團美食地圖資料庫」綁定的 Apps Script 原始碼。

- `Places`：正式店家點位。
- `Feedback`：具名投票與留言；同一裝置對同一店家的投票會更新原紀錄。
- `Suggestions`：新店家一律先以 `pending` 寫入；管理者補上地址、經緯度並改成 `approved` 後，網站會自動載入。
- 初始群組通關碼由管理者另行提供。它保存在 Apps Script「專案設定 → 指令碼屬性」的 `GROUP_CODE`，不會寫進公開程式碼。變更屬性後不必重新部署。

公開 API 只會回傳 `approved` 資料。Google 評分是資料表中的快照，不會自動擷取 Google Maps。
