(() => {
  "use strict";

  const LF_KEY = "hostelboard_lostfound";
  const C_KEY = "hostelboard_complaints";

  /* ---------------------------------------------------------
     STORAGE HELPERS
     --------------------------------------------------------- */
  function load(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Could not read from storage:", e);
      return [];
    }
  }

  function save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error("Could not save to storage:", e);
      showToast("Your entry was added, but couldn't be saved for next time.");
    }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) +
      " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /* ---------------------------------------------------------
     TOAST
     --------------------------------------------------------- */
  let toastTimer = null;
  function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  /* ---------------------------------------------------------
     TABS
     --------------------------------------------------------- */
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => {
        t.classList.remove("is-active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("is-active");
      tab.setAttribute("aria-selected", "true");

      document.querySelectorAll(".panel").forEach((panel) => {
        panel.hidden = true;
        panel.classList.remove("is-active");
      });
      const target = document.getElementById("panel-" + tab.dataset.target);
      target.hidden = false;
      target.classList.add("is-active");
    });
  });

  /* ---------------------------------------------------------
     LOST & FOUND
     --------------------------------------------------------- */
  let lostFoundItems = load(LF_KEY);

  const lfForm = document.getElementById("lostfound-form");
  const lfBoard = document.getElementById("lostfound-board");
  const lfEmpty = document.getElementById("lf-empty");
  const lfSearch = document.getElementById("lf-search");
  const lfStats = document.getElementById("lf-stats");

  function renderLostFound() {
    const query = lfSearch.value.trim().toLowerCase();
    const visible = lostFoundItems.filter((item) => {
      if (!query) return true;
      return (
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.location.toLowerCase().includes(query) ||
        item.contact.toLowerCase().includes(query)
      );
    });

    lfBoard.innerHTML = "";

    visible
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .forEach((item) => {
        const card = document.createElement("article");
        card.className = "notice-card" + (item.claimed ? " is-claimed" : "");
        card.style.setProperty("--tilt", item.tilt + "deg");
        card.dataset.id = item.id;

        card.innerHTML = `
          <h3>${escapeHtml(item.name)}</h3>
          <p>${escapeHtml(item.description)}</p>
          <div class="notice-meta">
            <div><strong>Found at:</strong> ${escapeHtml(item.location)}</div>
            <div><strong>Reported by:</strong> ${escapeHtml(item.contact)}</div>
            <div>${formatDate(item.createdAt)}</div>
          </div>
          <div class="notice-actions">
            <button type="button" data-action="claim">${item.claimed ? "Mark unclaimed" : "Mark claimed"}</button>
            <button type="button" data-action="remove">Remove</button>
          </div>
        `;
        lfBoard.appendChild(card);
      });

    lfEmpty.hidden = lostFoundItems.length !== 0;
    const unclaimedCount = lostFoundItems.filter((i) => !i.claimed).length;
    lfStats.textContent = `${lostFoundItems.length} item${lostFoundItems.length === 1 ? "" : "s"} pinned · ${unclaimedCount} unclaimed`;

    if (query && visible.length === 0 && lostFoundItems.length > 0) {
      const p = document.createElement("p");
      p.className = "empty-state";
      p.textContent = "No items match your search.";
      lfBoard.appendChild(p);
    }
  }

  lfForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const name = document.getElementById("lf-item").value.trim();
    const description = document.getElementById("lf-desc").value.trim();
    const location = document.getElementById("lf-location").value.trim();
    const contact = document.getElementById("lf-contact").value.trim();

    if (!name || !description || !location || !contact) return;

    lostFoundItems.push({
      id: uid(),
      name,
      description,
      location,
      contact,
      claimed: false,
      createdAt: Date.now(),
      tilt: (Math.random() * 3 - 1.5).toFixed(2),
    });

    save(LF_KEY, lostFoundItems);
    lfForm.reset();
    renderLostFound();
    showToast("Notice pinned to the board.");
  });

  lfBoard.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const card = e.target.closest(".notice-card");
    const id = card.dataset.id;
    const item = lostFoundItems.find((i) => i.id === id);
    if (!item) return;

    if (btn.dataset.action === "claim") {
      item.claimed = !item.claimed;
      save(LF_KEY, lostFoundItems);
      renderLostFound();
      showToast(item.claimed ? "Marked as claimed." : "Marked as unclaimed.");
    } else if (btn.dataset.action === "remove") {
      lostFoundItems = lostFoundItems.filter((i) => i.id !== id);
      save(LF_KEY, lostFoundItems);
      renderLostFound();
      showToast("Notice removed.");
    }
  });

  lfSearch.addEventListener("input", renderLostFound);

  /* ---------------------------------------------------------
     COMPLAINTS & FEEDBACK
     --------------------------------------------------------- */
  let complaints = load(C_KEY);

  const cForm = document.getElementById("complaint-form");
  const cList = document.getElementById("complaint-list");
  const cEmpty = document.getElementById("c-empty");
  const cFilter = document.getElementById("c-filter");
  const cStats = document.getElementById("c-stats");
  const cStarsWrap = document.getElementById("c-stars");
  const cRatingInput = document.getElementById("c-rating");
  let currentRating = 0;

  cStarsWrap.addEventListener("click", (e) => {
    const star = e.target.closest(".star");
    if (!star) return;
    currentRating = Number(star.dataset.value);
    cRatingInput.value = currentRating;
    paintStars();
  });

  function paintStars() {
    document.querySelectorAll("#c-stars .star").forEach((star) => {
      star.classList.toggle("is-filled", Number(star.dataset.value) <= currentRating);
    });
  }

  function renderComplaints() {
    const filter = cFilter.value;
    const visible = complaints.filter((c) => filter === "all" || c.category === filter);

    cList.innerHTML = "";

    visible
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .forEach((c) => {
        const li = document.createElement("li");
        li.className = "complaint-item" + (c.resolved ? " is-resolved" : "");
        li.dataset.category = c.category;
        li.dataset.id = c.id;

        const stars = c.rating > 0 ? "★".repeat(c.rating) + "☆".repeat(5 - c.rating) : "";

        li.innerHTML = `
          <div class="complaint-top">
            <span class="complaint-category">${escapeHtml(c.category)}</span>
            <span class="complaint-date">${formatDate(c.createdAt)}</span>
          </div>
          <p class="complaint-message">${escapeHtml(c.message)}</p>
          <div class="complaint-bottom">
            <span class="complaint-author">${c.name ? "— " + escapeHtml(c.name) : "— Anonymous"}</span>
            ${stars ? `<span class="complaint-rating">${stars}</span>` : "<span></span>"}
            <button type="button" class="complaint-status-btn" data-action="toggle-resolved">
              ${c.resolved ? "Reopen" : "Mark resolved"}
            </button>
          </div>
        `;
        cList.appendChild(li);
      });

    cEmpty.hidden = complaints.length !== 0;
    const openCount = complaints.filter((c) => !c.resolved).length;
    cStats.textContent = `${complaints.length} entr${complaints.length === 1 ? "y" : "ies"} · ${openCount} open`;

    if (visible.length === 0 && complaints.length > 0) {
      const p = document.createElement("p");
      p.className = "empty-state";
      p.textContent = "No entries in this category.";
      cList.appendChild(p);
    }
  }

  cForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const category = document.getElementById("c-category").value;
    const message = document.getElementById("c-message").value.trim();
    const name = document.getElementById("c-name").value.trim();

    if (!category || !message) return;

    complaints.push({
      id: uid(),
      category,
      message,
      name,
      rating: currentRating,
      resolved: false,
      createdAt: Date.now(),
    });

    save(C_KEY, complaints);
    cForm.reset();
    currentRating = 0;
    paintStars();
    renderComplaints();
    showToast("Thanks — sent to the hostel office.");
  });

  cList.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action='toggle-resolved']");
    if (!btn) return;
    const li = e.target.closest(".complaint-item");
    const id = li.dataset.id;
    const item = complaints.find((c) => c.id === id);
    if (!item) return;
    item.resolved = !item.resolved;
    save(C_KEY, complaints);
    renderComplaints();
  });

  cFilter.addEventListener("change", renderComplaints);

  /* ---------------------------------------------------------
     INIT
     --------------------------------------------------------- */
  renderLostFound();
  renderComplaints();
})();
