// ==========================================================================
// NEXO PROVIDER POSTED SCHOLARSHIPS MANAGER (js/provider-posts.js)
// Lists all scholarship posts published by the provider, tracks live
// applicant totals & status breakdowns, and opens scoped applications view.
// ==========================================================================

(function () {
  const API_BASE = window.location.origin.includes(":3000")
    ? ""
    : "http://localhost:3000";

  let allScholarships = [];
  let allApplications = [];
  let activeFilterTab = "all";
  let activeSearchQuery = "";
  let lastRenderSig = null;

  // DOM Elements
  let postsFeedEl = null;
  let emptyStateEl = null;
  let searchInputEl = null;
  let tabAllEl = null;
  let tabOpenEl = null;
  let tabClosedEl = null;
  let countLabelEl = null;

  // Modal Elements
  let modalEl = null;
  let closeBtnEl = null;
  let closeActionBtnEl = null;

  document.addEventListener("DOMContentLoaded", () => {
    cacheDOM();
    initFilters();
    initModal();
    loadData();

    // Live sync polling every 3.5 seconds
    setInterval(() => {
      if (!modalEl || !modalEl.classList.contains("active")) {
        loadData(true);
      }
    }, 3500);

    // Refresh when window regains focus
    window.addEventListener("focus", () => {
      if (!modalEl || !modalEl.classList.contains("active")) {
        loadData(true);
      }
    });
  });

  function cacheDOM() {
    postsFeedEl = document.getElementById("posts-feed");
    emptyStateEl = document.getElementById("posts-empty-state");
    searchInputEl = document.getElementById("posts-search-input");
    tabAllEl = document.getElementById("tab-posts-all");
    tabOpenEl = document.getElementById("tab-posts-open");
    tabClosedEl = document.getElementById("tab-posts-closed");
    countLabelEl = document.getElementById("posts-count-label");

    modalEl = document.getElementById("view-details-modal");
    closeBtnEl = document.getElementById("close-details-btn");
    closeActionBtnEl = document.getElementById("view-modal-close-action-btn");
  }

  function initFilters() {
    if (searchInputEl) {
      searchInputEl.addEventListener("input", (e) => {
        activeSearchQuery = e.target.value.trim().toLowerCase();
        renderPostsFeed();
      });
    }

    const tabs = document.querySelectorAll(".posts-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", function () {
        tabs.forEach((t) => t.classList.remove("active"));
        this.classList.add("active");
        activeFilterTab = this.dataset.filter || "all";
        renderPostsFeed();
      });
    });
  }

  function initModal() {
    const closeModal = () => {
      if (modalEl) {
        modalEl.classList.remove("active");
        modalEl.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "auto";
      }
    };

    if (closeBtnEl) closeBtnEl.addEventListener("click", closeModal);
    if (closeActionBtnEl) closeActionBtnEl.addEventListener("click", closeModal);

    if (modalEl) {
      modalEl.addEventListener("click", (e) => {
        if (e.target === modalEl) closeModal();
      });
    }
  }

  function escapeHtml(text) {
    if (text === null || text === undefined) return "";
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // -------------------------------------------------------------
  // DATA FETCHING & LIVE SYNC
  // -------------------------------------------------------------
  async function loadData(isBackground = false) {
    let scholarships = [];
    let applications = [];

    try {
      const res = await fetch(`${API_BASE}/api/data`);
      if (res.ok) {
        const data = await res.json();
        scholarships = Array.isArray(data.scholarships) ? data.scholarships : [];
        applications = Array.isArray(data.applications) ? data.applications : [];

        try {
          localStorage.setItem("nexo_scholarships", JSON.stringify(scholarships));
          localStorage.setItem("nexo_applications", JSON.stringify(applications));
        } catch (_) {}
      }
    } catch (err) {
      if (!isBackground) {
        console.warn("NEXO: Backend not reached directly, falling back to local storage:", err);
      }
      try {
        const cachedS = localStorage.getItem("nexo_scholarships");
        const cachedA = localStorage.getItem("nexo_applications");
        if (cachedS) scholarships = JSON.parse(cachedS);
        if (cachedA) applications = JSON.parse(cachedA);
      } catch (_) {}
    }

    const currentProviderEmail = (
      sessionStorage.getItem("nexo-provider-email") ||
      localStorage.getItem("nexo-provider-email") ||
      ""
    ).toLowerCase();

    // Filter scholarships posted by this provider (or show all if unassigned)
    const myScholarships = currentProviderEmail
      ? scholarships.filter(
          (s) =>
            !s.providerEmail ||
            s.providerEmail.toLowerCase() === currentProviderEmail,
        )
      : scholarships;

    allScholarships = myScholarships;
    allApplications = applications;

    updateCounters();
    renderPostsFeed();
  }

  // -------------------------------------------------------------
  // TAB COUNTERS
  // -------------------------------------------------------------
  function updateCounters() {
    let total = allScholarships.length;
    let openCount = 0;
    let closedCount = 0;

    allScholarships.forEach((s) => {
      const status = (s.status || "Open").toLowerCase();
      if (status === "closed") closedCount++;
      else openCount++;
    });

    if (tabAllEl) tabAllEl.textContent = `All (${total})`;
    if (tabOpenEl) tabOpenEl.textContent = `Active / Open (${openCount})`;
    if (tabClosedEl) tabClosedEl.textContent = `Closed (${closedCount})`;
  }

  // -------------------------------------------------------------
  // RENDER POSTS FEED
  // -------------------------------------------------------------
  function renderPostsFeed() {
    if (!postsFeedEl || !emptyStateEl) return;

    // Filter by tab
    let filtered = allScholarships.filter((s) => {
      const status = (s.status || "Open").toLowerCase();
      if (activeFilterTab === "open") return status !== "closed";
      if (activeFilterTab === "closed") return status === "closed";
      return true;
    });

    // Filter by search query
    if (activeSearchQuery) {
      filtered = filtered.filter((s) => {
        const title = String(s.title || "").toLowerCase();
        const type = String(s.type || s.typeText || "").toLowerCase();
        const desc = String(s.desc || "").toLowerCase();
        const provider = String(s.providerName || "").toLowerCase();

        return (
          title.includes(activeSearchQuery) ||
          type.includes(activeSearchQuery) ||
          desc.includes(activeSearchQuery) ||
          provider.includes(activeSearchQuery)
        );
      });
    }

    if (countLabelEl) {
      countLabelEl.textContent = `Showing ${filtered.length} scholarship${filtered.length === 1 ? "" : "s"}`;
    }

    // Anti-flicker diff check
    const currentSig = JSON.stringify(
      filtered.map((s) => {
        const apps = getScholarshipApplications(s);
        return {
          id: s.id,
          title: s.title,
          status: s.status,
          appCount: apps.length,
          deadline: s.formattedDate || s.deadline,
        };
      }),
    );

    if (lastRenderSig === currentSig) {
      return;
    }
    lastRenderSig = currentSig;

    // Handle empty state
    if (allScholarships.length === 0) {
      postsFeedEl.style.display = "none";
      postsFeedEl.innerHTML = "";
      emptyStateEl.style.display = "block";
      const title = emptyStateEl.querySelector("h3");
      const desc = emptyStateEl.querySelector("p");
      if (title) title.textContent = "No Posted Scholarships Yet";
      if (desc)
        desc.textContent =
          "You haven't posted any scholarship opportunities yet. Create a new scholarship to start receiving student applications.";
      return;
    }

    if (filtered.length === 0) {
      postsFeedEl.style.display = "none";
      postsFeedEl.innerHTML = "";
      emptyStateEl.style.display = "block";
      const title = emptyStateEl.querySelector("h3");
      const desc = emptyStateEl.querySelector("p");
      if (title) title.textContent = "No Matching Scholarships";
      if (desc)
        desc.textContent =
          "No posted scholarships matched your search criteria. Try a different search term or filter.";
      return;
    }

    emptyStateEl.style.display = "none";
    postsFeedEl.style.display = "flex";
    postsFeedEl.innerHTML = "";

    filtered.forEach((schol) => {
      postsFeedEl.appendChild(createPostCard(schol));
    });
  }

  // -------------------------------------------------------------
  // POST CARD COMPONENT
  // -------------------------------------------------------------
  function getScholarshipApplications(schol) {
    return allApplications.filter((app) => {
      if (app.scholarshipId && schol.id && String(app.scholarshipId) === String(schol.id)) {
        return true;
      }
      if (
        schol.title &&
        (String(app.scholarshipTitle || "").toLowerCase() ===
          String(schol.title).toLowerCase() ||
          String(app.title || "").toLowerCase() ===
            String(schol.title).toLowerCase())
      ) {
        return true;
      }
      return false;
    });
  }

  function createPostCard(schol) {
    const card = document.createElement("div");
    card.className = "post-card";
    card.dataset.id = schol.id || "";

    const relatedApps = getScholarshipApplications(schol);
    const totalApps = relatedApps.length;
    const limit =
      parseInt(schol.applicantLimit || schol.maxApplicants || 200, 10) || 200;

    let underReviewCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let pendingCount = 0;

    relatedApps.forEach((a) => {
      const st = (a.status || "Submitted").toLowerCase();
      if (st.includes("approved")) approvedCount++;
      else if (st.includes("review")) underReviewCount++;
      else if (st.includes("rejected")) rejectedCount++;
      else pendingCount++;
    });

    const isOpen = (schol.status || "Open").toLowerCase() !== "closed";
    const statusText = isOpen ? "Open" : "Closed";
    const statusClass = isOpen ? "open" : "closed";

    const initial = (schol.title || "S").trim().charAt(0).toUpperCase();
    const providerName = schol.providerName || "NEXO Provider";
    const deadlineText = schol.formattedDate || schol.deadline || "No Deadline";
    const postedDate = schol.formattedPostedDate || "Recently";

    card.innerHTML = `
      <div class="post-card-header">
        <div class="post-card-title-group">
          <div class="post-avatar-icon">${initial}</div>
          <div>
            <h3 class="post-title-text">${escapeHtml(schol.title || "Untitled Scholarship")}</h3>
            <div class="post-provider-text">${escapeHtml(providerName)} • <span style="color: #8b5cf6; font-weight: 600;">${escapeHtml(schol.type || schol.typeText || "General")}</span></div>
          </div>
        </div>
        <span class="post-status-badge ${statusClass}">${statusText}</span>
      </div>

      <div class="post-meta-row">
        <div class="post-meta-item">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <strong style="color: var(--text-primary);">${totalApps} / ${limit}</strong> Applicants
        </div>
        <div class="post-meta-item">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>Posted: ${escapeHtml(postedDate)}</span>
        </div>
        <div class="post-meta-item">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <span>Deadline: ${escapeHtml(deadlineText)}</span>
        </div>
      </div>

      <p class="post-desc">${escapeHtml(schol.desc || "No description provided.")}</p>

      <div class="post-breakdown-row">
        <span class="post-breakdown-pill review">Under Review: ${underReviewCount}</span>
        <span class="post-breakdown-pill approved">Approved: ${approvedCount}</span>
        <span class="post-breakdown-pill rejected">Rejected: ${rejectedCount}</span>
        ${pendingCount > 0 ? `<span class="post-breakdown-pill">Pending: ${pendingCount}</span>` : ""}
      </div>

      <div class="post-actions-row">
        <a
          href="provider-applications.html?scholarshipId=${encodeURIComponent(schol.id || schol.title)}"
          class="btn-view-apps"
          title="View applicants only for this scholarship"
        >
          <span>View Applications (${totalApps})</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </a>
        <button type="button" class="btn-view-details-sub" aria-label="View Details">
          View Details
        </button>
      </div>
    `;

    // Modal Details listener
    const viewDetailsBtn = card.querySelector(".btn-view-details-sub");
    if (viewDetailsBtn) {
      viewDetailsBtn.addEventListener("click", () => {
        openScholarshipModal(schol, totalApps, limit);
      });
    }

    return card;
  }

  // -------------------------------------------------------------
  // OPEN SCHOLARSHIP DETAILS MODAL
  // -------------------------------------------------------------
  function openScholarshipModal(schol, totalApps, limit) {
    if (!modalEl) return;

    const titleEl = document.getElementById("view-modal-title");
    const typeEl = document.getElementById("view-modal-type");
    const providerEl = document.getElementById("view-modal-provider");
    const dateEl = document.getElementById("view-modal-date");
    const applicantsEl = document.getElementById("view-modal-applicants");
    const descEl = document.getElementById("view-modal-desc");
    const reqsListEl = document.getElementById("view-modal-reqs-list");
    const manageBtn = document.getElementById("view-modal-manage-btn");

    if (titleEl) titleEl.textContent = schol.title || "Untitled";
    if (typeEl) typeEl.textContent = schol.type || schol.typeText || "General";
    if (providerEl) providerEl.textContent = schol.providerName || "NEXO";
    if (dateEl) dateEl.textContent = schol.formattedDate || schol.deadline || "No Deadline";
    if (applicantsEl) applicantsEl.textContent = `${totalApps} / ${limit} Applicants`;
    if (descEl) descEl.textContent = schol.desc || "No description provided.";

    if (reqsListEl) {
      reqsListEl.innerHTML = "";
      const reqs = Array.isArray(schol.requirements) ? schol.requirements : [];
      if (reqs.length === 0) {
        reqsListEl.innerHTML = '<span style="font-size: 13px; color: var(--text-secondary); font-style: italic;">No specific requirements listed.</span>';
      } else {
        reqs.forEach((r) => {
          const item = document.createElement("div");
          item.style.cssText =
            "display: flex; align-items: flex-start; gap: 8px; font-size: 13.5px; padding: 6px 10px; background: rgba(139, 92, 246, 0.06); border-radius: 8px;";
          item.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2.5" style="margin-top: 2px; flex-shrink: 0;">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <div>
              <strong style="color: var(--text-primary);">${escapeHtml(r.title || r.name || "Requirement")}</strong>
              ${r.desc ? `<div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">${escapeHtml(r.desc)}</div>` : ""}
            </div>
          `;
          reqsListEl.appendChild(item);
        });
      }
    }

    if (manageBtn) {
      manageBtn.href = `provider-applications.html?scholarshipId=${encodeURIComponent(schol.id || schol.title)}`;
    }

    modalEl.classList.add("active");
    modalEl.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
})();
