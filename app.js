(() => {
  "use strict";

  if (!window.L) return;
  document.querySelector("#map-fallback").hidden = true;

  const config = window.FOOD_MAP_CONFIG || {};
  const data = { places: [...window.FOOD_MAP_DATA.places], pending: [...window.FOOD_MAP_DATA.pending] };
  const labels = { positive: "群友推薦", mixed: "討論中", negative: "群友踩雷" };
  const symbols = { positive: "✓", mixed: "?", negative: "×" };
  const state = { filter: "all", query: "", markers: new Map(), feedback: {}, clientId: getClientId() };
  const map = L.map("map", { zoomControl: true, preferCanvas: true }).setView([23.005, 120.216], 13);
  const bounds = L.latLngBounds([]);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors"
  }).addTo(map);

  document.querySelector("#search-input").addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLocaleLowerCase("zh-Hant");
    render();
  });
  document.querySelectorAll(".filter-chip").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      document.querySelectorAll(".filter-chip").forEach((chip) => chip.classList.toggle("is-active", chip === button));
      render();
    });
  });
  document.querySelector("#fit-map").addEventListener("click", fitAll);
  setupSuggestionForm();
  setData(window.FOOD_MAP_DATA.places, {});
  loadRemoteData();

  function setData(places, feedback) {
    data.places = places;
    state.feedback = feedback || {};
    state.markers.forEach(marker => marker.remove());
    state.markers.clear();
    bounds._southWest = bounds._northEast = undefined;
    places.forEach(addMarker);
    document.querySelector("#mapped-count").textContent = places.length;
    document.querySelector("#pending-count").textContent = data.pending.length;
    document.querySelector("#pending-summary-count").textContent = `(${data.pending.length})`;
    document.querySelector("#pending-list").innerHTML = data.pending.map((item) => `
      <div class="pending-item"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.reason)}</span></div>
    `).join("");
    render();
    fitAll();
  }

  function addMarker(place) {
    if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng)) return;
    const sentiment = labels[place.sentiment] ? place.sentiment : "mixed";
    place.sentiment = sentiment;
    const icon = L.divIcon({
      className: "", html: `<div class="food-marker ${sentiment}"><span>${symbols[sentiment]}</span></div>`,
      iconSize: [34, 34], iconAnchor: [17, 31], popupAnchor: [0, -30]
    });
    const marker = L.marker([place.lat, place.lng], { icon, title: place.name }).addTo(map);
    marker.on("click", () => centerPlace(place, marker));
    state.markers.set(place.id, marker);
    bounds.extend([place.lat, place.lng]);
  }

  async function loadRemoteData() {
    if (!config.apiUrl) return;
    try {
      const response = await fetch(`${config.apiUrl}?action=bootstrap&v=${Date.now()}`, { redirect: "follow" });
      const result = await response.json();
      if (!result.ok || !Array.isArray(result.places)) throw new Error(result.error || "資料格式不正確");
      setData(result.places, result.feedback);
    } catch (error) {
      console.warn("共用資料庫暫時無法讀取，改用網站內建資料。", error);
    }
  }

  function render() {
    const places = data.places.filter(matchesCurrentFilter);
    document.querySelector("#visible-count").textContent = `${places.length} / ${data.places.length}`;
    const list = document.querySelector("#place-list");
    list.innerHTML = places.length ? places.map(placeCard).join("") : `<p class="empty-state">沒有符合的店家，換個關鍵字試試。</p>`;
    list.querySelectorAll(".place-card").forEach((card) => card.addEventListener("click", () => focusPlace(card.dataset.id)));
    data.places.forEach((place) => {
      const marker = state.markers.get(place.id);
      if (!marker) return;
      const visible = places.some((item) => item.id === place.id);
      if (visible && !map.hasLayer(marker)) marker.addTo(map);
      if (!visible && map.hasLayer(marker)) marker.removeFrom(map);
    });
  }

  function matchesCurrentFilter(place) {
    if (state.filter !== "all" && place.sentiment !== state.filter) return false;
    if (!state.query) return true;
    const haystack = [place.name, place.category, place.address, place.chatQuote, ...(place.tags || [])].join(" ").toLocaleLowerCase("zh-Hant");
    return haystack.includes(state.query);
  }

  function ratingText(place) {
    if (!Number.isFinite(place.googleRating)) return `尚未登錄 Google 評分 · ${escapeHtml(place.category)}`;
    const reviews = Number.isFinite(place.googleReviews) ? ` · ${place.googleReviews.toLocaleString("zh-TW")} 則 Google 評論` : "";
    return `★ ${place.googleRating.toFixed(1)}${reviews} · ${escapeHtml(place.category)}`;
  }

  function placeCard(place) {
    return `<button class="place-card" type="button" data-id="${escapeHtml(place.id)}">
      <span class="card-topline"><span class="card-name">${escapeHtml(place.name)}</span><span class="sentiment-pill ${place.sentiment}">${labels[place.sentiment]}</span></span>
      <span class="card-meta">${ratingText(place)}</span>
      <span class="card-quote">${escapeHtml(place.chatQuote || "")}</span>
    </button>`;
  }

  function focusPlace(id) {
    const place = data.places.find((item) => item.id === id);
    const marker = state.markers.get(id);
    if (!place || !marker) return;
    centerPlace(place, marker);
  }

  function centerPlace(place, marker) {
    if (window.innerWidth <= 760) {
      document.querySelector(".map-panel").scrollIntoView({ behavior: "smooth", block: "start" });
    }

    const target = L.latLng(place.lat, place.lng);
    const targetZoom = Math.max(map.getZoom(), 16);
    const needsMove = map.getCenter().distanceTo(target) > 2 || map.getZoom() !== targetZoom;
    let popupOpened = false;
    const showPopup = () => {
      if (popupOpened) return;
      popupOpened = true;
      openPlace(place, marker);
    };

    if (needsMove) {
      map.once("moveend", showPopup);
      map.flyTo(target, targetZoom, { duration: .45 });
      window.setTimeout(showPopup, 550);
    } else {
      showPopup();
    }
  }

  function openPlace(place, marker) {
    const root = document.querySelector("#popup-template").content.cloneNode(true).querySelector(".place-popup");
    root.querySelector(".sentiment-badge").className = `sentiment-badge ${place.sentiment}`;
    root.querySelector(".sentiment-badge").textContent = labels[place.sentiment];
    root.querySelector(".category").textContent = place.category;
    root.querySelector(".place-name").textContent = place.name;
    root.querySelector(".google-rating").textContent = ratingText(place).replace(` · ${place.category}`, "");
    const googleLink = root.querySelector(".google-link");
    if (place.googleMaps) googleLink.href = place.googleMaps; else googleLink.remove();
    root.querySelector(".address").textContent = place.address || "地址待補";
    root.querySelector(".chat-quote").textContent = place.chatQuote || "";
    root.querySelector(".source-note").textContent = place.sourceNote || "";
    const mapWidth = map.getSize().x;
    const popup = L.popup({
      maxWidth: Math.min(400, Math.max(240, mapWidth - 40)),
      minWidth: Math.min(280, Math.max(220, mapWidth - 72)),
      closeButton: true,
      autoPan: true,
      keepInView: true,
      autoPanPaddingTopLeft: [22, 22],
      autoPanPaddingBottomRight: [22, 22]
    }).setContent(root);
    popup.once("add", () => requestAnimationFrame(() => centerPopup(root)));
    marker.bindPopup(popup).openPopup();
    bindFeedback(root, place.id);
  }

  function centerPopup(root) {
    const popupElement = root.closest(".leaflet-popup");
    if (!popupElement) return;
    const mapRect = map.getContainer().getBoundingClientRect();
    const popupRect = popupElement.getBoundingClientRect();
    const offsetX = popupRect.left + popupRect.width / 2 - (mapRect.left + mapRect.width / 2);
    const offsetY = popupRect.top + popupRect.height / 2 - (mapRect.top + mapRect.height / 2);
    if (Math.abs(offsetX) > 1 || Math.abs(offsetY) > 1) {
      map.panBy([offsetX, offsetY], { animate: true, duration: .35 });
    }
  }

  function bindFeedback(root, placeId) {
    const feedback = state.feedback[placeId] || { agree: 0, disagree: 0, reviews: [] };
    const nameInput = root.querySelector(".reviewer-name");
    const codeInput = root.querySelector(".group-code");
    nameInput.value = localStorage.getItem("chengyou-food-map-name") || "";
    codeInput.value = sessionStorage.getItem("chengyou-food-map-code") || "";
    const update = () => {
      root.querySelector(".agree-count").textContent = feedback.agree || 0;
      root.querySelector(".disagree-count").textContent = feedback.disagree || 0;
      root.querySelector(".review-list").innerHTML = (feedback.reviews || []).slice().reverse().map((review) => `<div class="user-review"><strong>${escapeHtml(review.name)}</strong>${escapeHtml(review.text)}<br><time>${formatDate(review.at)}</time></div>`).join("");
    };
    root.querySelectorAll(".vote-button").forEach((button) => button.addEventListener("click", async () => {
      const choice = button.classList.contains("agree") ? "agree" : "disagree";
      const ok = await submitFeedback(root, placeId, choice, "");
      if (ok) {
        if (feedback._myVote === "agree") feedback.agree = Math.max(0, feedback.agree - 1);
        if (feedback._myVote === "disagree") feedback.disagree = Math.max(0, feedback.disagree - 1);
        feedback[choice] = (feedback[choice] || 0) + 1;
        feedback._myVote = choice;
        update();
      }
    }));
    root.querySelector(".review-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const textarea = root.querySelector(".review-text");
      const text = textarea.value.trim();
      if (!text) return;
      if (await submitFeedback(root, placeId, "comment", text)) {
        feedback.reviews = feedback.reviews || [];
        feedback.reviews.push({ name: nameInput.value.trim(), text, at: new Date().toISOString() });
        textarea.value = "";
        update();
      }
    });
    update();
  }

  async function submitFeedback(root, placeId, type, comment) {
    const name = root.querySelector(".reviewer-name").value.trim();
    const code = root.querySelector(".group-code").value.trim();
    const status = root.querySelector(".form-status");
    if (!name || !code) { status.textContent = "請先填寫名字與群組通關碼。"; return false; }
    if (!config.apiUrl) { status.textContent = "共用資料庫尚未完成部署，暫時無法送出。"; return false; }
    rememberIdentity(name, code);
    root.classList.add("is-busy");
    status.textContent = "送出中…";
    try {
      const result = await apiPost({ action: "feedback", placeId, feedbackType: type, displayName: name, comment, clientId: state.clientId, groupCode: code });
      if (!result.ok) throw new Error(result.error || "送出失敗");
      status.textContent = result.message;
      return true;
    } catch (error) { status.textContent = error.message; return false; }
    finally { root.classList.remove("is-busy"); }
  }

  function setupSuggestionForm() {
    const dialog = document.querySelector("#suggest-dialog");
    const form = document.querySelector("#suggest-form");
    document.querySelector("#suggest-place").addEventListener("click", () => {
      form.elements.displayName.value = localStorage.getItem("chengyou-food-map-name") || "";
      form.elements.groupCode.value = sessionStorage.getItem("chengyou-food-map-code") || "";
      dialog.showModal();
    });
    dialog.querySelectorAll(".dialog-close").forEach(button => button.addEventListener("click", () => dialog.close()));
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      const status = document.querySelector("#suggest-status");
      if (!config.apiUrl) { status.textContent = "共用資料庫尚未完成部署，暫時無法送出。"; return; }
      rememberIdentity(values.displayName, values.groupCode);
      form.classList.add("is-busy");
      status.textContent = "送出中…";
      try {
        const result = await apiPost({ action: "suggestion", ...values });
        if (!result.ok) throw new Error(result.error || "送出失敗");
        form.reset(); status.textContent = result.message;
        setTimeout(() => dialog.close(), 1100);
      } catch (error) { status.textContent = error.message; }
      finally { form.classList.remove("is-busy"); }
    });
  }

  async function apiPost(payload) {
    const response = await fetch(config.apiUrl, { method: "POST", redirect: "follow", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
    return response.json();
  }

  function fitAll() { if (bounds.isValid()) map.fitBounds(bounds.pad(.13), { maxZoom: 14, animate: true }); }
  function rememberIdentity(name, code) { localStorage.setItem("chengyou-food-map-name", name); sessionStorage.setItem("chengyou-food-map-code", code); }
  function getClientId() { let id = localStorage.getItem("chengyou-food-map-client-id"); if (!id) { id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; localStorage.setItem("chengyou-food-map-client-id", id); } return id; }
  function formatDate(value) { try { return new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); } catch { return ""; } }
  function escapeHtml(value) { return String(value == null ? "" : value).replace(/[&<>'\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '\"': "&quot;" })[char]); }
})();
