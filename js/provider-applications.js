// ==========================================================================
// NEXO PROVIDER APPLICATIONS MANAGER (js/provider-applications.js)
// Live synchronized application handling, real-time polling, document review,
// status updates (Pending -> Under Review -> Approved / Rejected), and search.
// ==========================================================================

(function () {
  const API_BASE = window.location.origin.includes(":3000")
    ? ""
    : "http://localhost:3000";

  let allApplications = [];
  let allScholarships = [];
  let studentSettings = null;
  let activeFilterTab = "all";
  let activeSearchQuery = "";
  let activeSortOption = "newest";
  let activeProgramFilter = "all";
  let activeDocFilter = "all";
  let currentActiveApp = null;
  let isModalOpen = false;

  // DOM Elements
  let appsFeedEl = null;
  let emptyStateEl = null;
  let searchInputEl = null;
  let filterTabsEls = [];
  let reviewModalEl = null;
  let docPreviewModalEl = null;

  document.addEventListener("DOMContentLoaded", () => {
    initDOMElements();
    initFilterTabs();
    initSearchAndSort();
    initReviewModal();
    initDocPreviewModal();

    // Initial data fetch
    loadApplicationsData();

    // Live Polling every 3.5 seconds for instant multi-window sync
    setInterval(() => {
      if (!isModalOpen) {
        loadApplicationsData(true);
      }
    }, 3500);

    // Refresh when window regains focus
    window.addEventListener("focus", () => {
      if (!isModalOpen) loadApplicationsData(true);
    });
  });

  function initDOMElements() {
    appsFeedEl = document.getElementById("applications-feed");
    emptyStateEl = document.getElementById("apps-empty-state");
    searchInputEl = document.querySelector(".search-input");
    filterTabsEls = document.querySelectorAll(".filter-tab");
    reviewModalEl = document.getElementById("review-application-modal");
    docPreviewModalEl = document.getElementById("doc-preview-modal");
  }

  // -------------------------------------------------------------
  // TOAST NOTIFICATIONS
  // -------------------------------------------------------------
  function showToast(message, isError = false) {
    let toast = document.getElementById("provider-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "provider-toast";
      toast.className = "settings-toast";
      document.body.appendChild(toast);
    }

    toast.innerHTML = isError
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg><span>${message}</span>`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg><span>${message}</span>`;
    toast.classList.toggle("error", isError);
    toast.classList.add("show");

    if (window.providerToastTimeout) clearTimeout(window.providerToastTimeout);
    window.providerToastTimeout = setTimeout(() => {
      toast.classList.remove("show");
    }, 2800);
  }

  // -------------------------------------------------------------
  // 1. FETCH LIVE APPLICATIONS & SCHOLARSHIPS
  // -------------------------------------------------------------
  async function loadApplicationsData(isBackground = false) {
    let serverApps = null;
    let serverSchols = null;

    try {
      const res = await fetch(`${API_BASE}/api/data`);
      if (res.ok) {
        const data = await res.json();
        serverApps = Array.isArray(data.applications) ? data.applications : [];
        serverSchols = Array.isArray(data.scholarships)
          ? data.scholarships
          : [];
        if (data.studentSettings) {
          studentSettings = data.studentSettings;
        }

        // Cache local copy
        try {
          localStorage.setItem("nexo_applications", JSON.stringify(serverApps));
          localStorage.setItem(
            "nexo_scholarships",
            JSON.stringify(serverSchols),
          );
        } catch (_) {}
      }
    } catch (err) {
      if (!isBackground) {
        console.warn(
          "Backend not reachable directly, reading localStorage fallback:",
          err,
        );
      }
    }

    if (!serverApps) {
      try {
        const cached = localStorage.getItem("nexo_applications");
        if (cached) serverApps = JSON.parse(cached);
      } catch (_) {}
    }

    if (!serverSchols) {
      try {
        const cachedS = localStorage.getItem("nexo_scholarships");
        if (cachedS) serverSchols = JSON.parse(cachedS);
      } catch (_) {}
    }

    allApplications = serverApps || [];
    allScholarships = serverSchols || [];

    updateTabCounters();
    populateScholarshipFilterMenu();
    renderApplicationsList();
  }

  // -------------------------------------------------------------
  // 2. TAB COUNTERS & FILTER TABS
  // -------------------------------------------------------------
  function updateTabCounters() {
    let countAll = allApplications.length;
    let countPending = 0;
    let countReviewed = 0;
    let countApproved = 0;
    let countRejected = 0;

    allApplications.forEach((app) => {
      const status = (app.status || "Submitted").toLowerCase();
      if (status.includes("approved")) {
        countApproved++;
      } else if (status.includes("review")) {
        countReviewed++;
      } else if (status.includes("rejected")) {
        countRejected++;
      } else {
        countPending++;
      }
    });

    const tabAll = document.getElementById("tab-all");
    const tabPending = document.getElementById("tab-pending");
    const tabReviewed = document.getElementById("tab-reviewed");
    const tabApproved = document.getElementById("tab-approved");
    const tabRejected = document.getElementById("tab-rejected");

    if (tabAll) tabAll.textContent = `All (${countAll})`;
    if (tabPending) tabPending.textContent = `Pending (${countPending})`;
    if (tabReviewed)
      tabReviewed.textContent = `Under Review (${countReviewed})`;
    if (tabApproved) tabApproved.textContent = `Approved (${countApproved})`;
    if (tabRejected) tabRejected.textContent = `Rejected (${countRejected})`;
  }

  function initFilterTabs() {
    const tabs = document.querySelectorAll(".filter-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", function () {
        tabs.forEach((t) => t.classList.remove("active"));
        this.classList.add("active");
        activeFilterTab = this.dataset.filter || "all";
        renderApplicationsList();
      });
    });
  }

  // -------------------------------------------------------------
  // 3. SEARCH, SORT & DROPDOWN FILTERS
  // -------------------------------------------------------------
  function initSearchAndSort() {
    if (searchInputEl) {
      searchInputEl.addEventListener("input", (e) => {
        activeSearchQuery = e.target.value.trim().toLowerCase();
        renderApplicationsList();
      });
    }

    // Sort items
    const sortItems = document.querySelectorAll("[data-sort-value]");
    sortItems.forEach((item) => {
      item.addEventListener("click", function () {
        activeSortOption = this.dataset.sortValue;
        const triggerLabel = this.closest(".nexo-dropdown")?.querySelector(
          ".nexo-dropdown-value",
        );
        if (triggerLabel) triggerLabel.textContent = this.textContent.trim();
        this.closest(".nexo-dropdown")?.classList.remove("active");
        renderApplicationsList();
      });
    });

    // Document status items
    const docItems = document.querySelectorAll("[data-doc-filter]");
    docItems.forEach((item) => {
      item.addEventListener("click", function () {
        activeDocFilter = this.dataset.docFilter;
        const triggerLabel = this.closest(".nexo-dropdown")?.querySelector(
          ".nexo-dropdown-value",
        );
        if (triggerLabel) triggerLabel.textContent = this.textContent.trim();
        this.closest(".nexo-dropdown")?.classList.remove("active");
        renderApplicationsList();
      });
    });

    // Close other dropdowns on click & close on outside click
    document.querySelectorAll(".nexo-dropdown").forEach((dropdown) => {
      dropdown.addEventListener("click", (e) => {
        document.querySelectorAll(".nexo-dropdown").forEach((other) => {
          if (other !== dropdown) other.classList.remove("active");
        });
      });
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".nexo-dropdown")) {
        document.querySelectorAll(".nexo-dropdown.active").forEach((d) => {
          d.classList.remove("active");
        });
      }
    });

    // Apply Filters button
    const applyBtn = document.getElementById("apply-filters-btn");
    if (applyBtn) {
      applyBtn.addEventListener("click", () => {
        renderApplicationsList();
      });
    }
  }

  function populateScholarshipFilterMenu() {
    const listEl = document.getElementById("filter-scholarships-list");
    if (!listEl) return;

    const titles = Array.from(
      new Set(
        allApplications
          .map((a) => a.scholarshipTitle)
          .concat(allScholarships.map((s) => s.title))
          .filter(Boolean),
      ),
    );

    let html = `
      <div class="nexo-dropdown-item ${activeProgramFilter === "all" ? "selected" : ""}" data-program="all">
        All Scholarships
      </div>
    `;

    titles.forEach((title) => {
      html += `
        <div class="nexo-dropdown-item ${activeProgramFilter === title ? "selected" : ""}" data-program="${escapeAttr(title)}">
          ${escapeHtml(title)}
        </div>
      `;
    });

    listEl.innerHTML = html;

    listEl.querySelectorAll(".nexo-dropdown-item").forEach((item) => {
      item.addEventListener("click", function () {
        activeProgramFilter = this.dataset.program || "all";
        const triggerLabel = this.closest(".nexo-dropdown")?.querySelector(
          ".nexo-dropdown-value",
        );
        if (triggerLabel) triggerLabel.textContent = this.textContent.trim();
        this.closest(".nexo-dropdown")?.classList.remove("active");
        renderApplicationsList();
      });
    });
  }

  // -------------------------------------------------------------
  // 4. RENDER APPLICATIONS LIST
  // -------------------------------------------------------------
  function renderApplicationsList() {
    if (!appsFeedEl || !emptyStateEl) return;

    // Filter by tab
    let filtered = allApplications.filter((app) => {
      const status = (app.status || "Submitted").toLowerCase();
      if (activeFilterTab === "all") return true;
      if (activeFilterTab === "pending") {
        return (
          !status.includes("approved") &&
          !status.includes("review") &&
          !status.includes("rejected")
        );
      }
      if (activeFilterTab === "reviewed") {
        return status.includes("review");
      }
      if (activeFilterTab === "approved") {
        return status.includes("approved");
      }
      if (activeFilterTab === "rejected") {
        return status.includes("rejected");
      }
      return true;
    });

    // Filter by Program
    if (activeProgramFilter !== "all") {
      filtered = filtered.filter(
        (app) =>
          String(app.scholarshipTitle || "").toLowerCase() ===
          activeProgramFilter.toLowerCase(),
      );
    }

    // Filter by Search Query
    if (activeSearchQuery) {
      filtered = filtered.filter((app) => {
        const studentName = String(app.studentName || "").toLowerCase();
        const studentEmail = String(app.studentEmail || "").toLowerCase();
        const studentId = String(app.studentId || "").toLowerCase();
        const course = String(app.course || "").toLowerCase();
        const scholarshipTitle = String(
          app.scholarshipTitle || "",
        ).toLowerCase();

        return (
          studentName.includes(activeSearchQuery) ||
          studentEmail.includes(activeSearchQuery) ||
          studentId.includes(activeSearchQuery) ||
          course.includes(activeSearchQuery) ||
          scholarshipTitle.includes(activeSearchQuery)
        );
      });
    }

    // Filter by Document Status
    if (activeDocFilter === "complete") {
      filtered = filtered.filter((app) => {
        const rawDocs = app.documents || app.uploadedDocuments || [];
        const attached = rawDocs.filter((d) => {
          if (typeof d === "string") return !d.includes("(To Follow Up)");
          return !d.isFollowUp && d.status !== "to_follow_up" && d.type !== "to_follow_up";
        });
        const followUps = rawDocs.filter((d) => {
          if (typeof d === "string") return d.includes("(To Follow Up)");
          return d.isFollowUp || d.status === "to_follow_up" || d.type === "to_follow_up";
        });
        return attached.length > 0 && followUps.length === 0;
      });
    } else if (activeDocFilter === "missing") {
      filtered = filtered.filter((app) => {
        const rawDocs = app.documents || app.uploadedDocuments || [];
        const attached = rawDocs.filter((d) => {
          if (typeof d === "string") return !d.includes("(To Follow Up)");
          return !d.isFollowUp && d.status !== "to_follow_up" && d.type !== "to_follow_up";
        });
        const followUps = rawDocs.filter((d) => {
          if (typeof d === "string") return d.includes("(To Follow Up)");
          return d.isFollowUp || d.status === "to_follow_up" || d.type === "to_follow_up";
        });
        return followUps.length > 0 || attached.length === 0;
      });
    }

    // Sort
    if (activeSortOption === "newest") {
      filtered.sort(
        (a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0),
      );
    } else if (activeSortOption === "oldest") {
      filtered.sort(
        (a, b) => new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0),
      );
    } else if (activeSortOption === "name") {
      filtered.sort((a, b) =>
        (a.studentName || "").localeCompare(b.studentName || ""),
      );
    }

    // Empty state handling
    if (filtered.length === 0) {
      appsFeedEl.style.display = "none";
      appsFeedEl.innerHTML = "";
      emptyStateEl.style.display = "block";

      const emptyTitle = emptyStateEl.querySelector("h3");
      const emptyDesc = emptyStateEl.querySelector("p");
      if (allApplications.length === 0) {
        if (emptyTitle) emptyTitle.textContent = "No Applications Yet";
        if (emptyDesc)
          emptyDesc.textContent =
            "Once students begin applying to your published scholarship posts, their applications will appear here for review.";
      } else {
        if (emptyTitle) emptyTitle.textContent = "No Matching Applications";
        if (emptyDesc)
          emptyDesc.textContent =
            "Try clearing your search query or switching tabs to view other applicants.";
      }
      return;
    }

    emptyStateEl.style.display = "none";
    appsFeedEl.style.display = "flex";
    appsFeedEl.innerHTML = "";

    filtered.forEach((app) => {
      appsFeedEl.appendChild(createApplicationCard(app));
    });
  }

  // -------------------------------------------------------------
  // 5. APPLICATION CARD COMPONENT
  // -------------------------------------------------------------
  function createApplicationCard(app) {
    const card = document.createElement("div");
    card.className = "provider-app-card";
    card.dataset.id = app.id;

    // Status Pill
    const rawStatus = (app.status || "Submitted").toLowerCase();
    let badgeClass = "badge-status-pending";
    let badgeText = app.status || "Submitted";

    if (rawStatus.includes("approved")) {
      badgeClass = "badge-status-approved";
      badgeText = "Approved";
    } else if (rawStatus.includes("review")) {
      badgeClass = "badge-status-review";
      badgeText = "Under Review";
    } else if (rawStatus.includes("rejected")) {
      badgeClass = "badge-status-rejected";
      badgeText = "Rejected";
    }

    // Initials
    const name = app.studentName || "Student";
    const initials =
      name
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0] || "")
        .join("")
        .toUpperCase() || "ST";

    const rawDocs = app.documents || app.uploadedDocuments || [];
    const attachedDocs = rawDocs.filter((d) => {
      if (typeof d === "string") return !d.includes("(To Follow Up)");
      return !d.isFollowUp && d.status !== "to_follow_up" && d.type !== "to_follow_up";
    });
    const followUpDocs = rawDocs.filter((d) => {
      if (typeof d === "string") return d.includes("(To Follow Up)");
      return d.isFollowUp || d.status === "to_follow_up" || d.type === "to_follow_up";
    });
    const docsCount = attachedDocs.length;
    const dateFormatted =
      app.formattedDate ||
      (app.submittedAt
        ? new Date(app.submittedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "Recently");

    const avatar =
      app.studentProfilePic ||
      app.profilePicture ||
      (studentSettings && studentSettings.profilePicture) ||
      "";

    let avatarHtml = `<div class="provider-app-avatar">${escapeHtml(initials)}</div>`;
    if (avatar) {
      avatarHtml = `<img src="${avatar}" alt="${escapeHtml(name)}" class="provider-app-avatar" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" />`;
    }

    card.innerHTML = `
      <div class="provider-app-main-row">
        ${avatarHtml}

        <div class="provider-app-details">
          <div class="provider-app-header-line">
            <h3 class="provider-app-student-name">${escapeHtml(name)}</h3>
            <span class="provider-app-badge ${badgeClass}">${escapeHtml(badgeText)}</span>
          </div>

          <p class="provider-app-program">
            <span class="program-tag">${escapeHtml(app.scholarshipTitle || "Scholarship Program")}</span>
          </p>

          <p class="provider-app-school">
            ${escapeHtml(app.course || "BS IT")} &bull; ${escapeHtml(app.university || "Batangas State University")}
          </p>

          <div class="provider-app-meta-row">
            <span class="provider-app-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              ${escapeHtml(dateFormatted)}
            </span>

            <span class="provider-app-meta-item doc-count-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              ${docsCount} ${docsCount === 1 ? "File" : "Files"} Attached
              ${
                followUpDocs.length > 0
                  ? ` &bull; <span style="color: #D97706; font-weight: 600; display: inline-flex; align-items: center; gap: 3px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>${followUpDocs.length} To Follow Up</span>`
                  : ""
              }
            </span>
          </div>
        </div>
      </div>

      <div class="provider-app-actions-row">
        <button type="button" class="btn btn-review-app btn-primary">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          Review Application
        </button>

        <div class="provider-app-quick-btns">
          <button type="button" class="btn-quick-action btn-quick-approve" title="Quick Approve">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </button>
          <button type="button" class="btn-quick-action btn-quick-review" title="Mark Under Review">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </button>
          <button type="button" class="btn-quick-action btn-quick-reject" title="Reject Application">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
    `;

    // Click on Review button or Card
    card.querySelector(".btn-review-app").addEventListener("click", (e) => {
      e.stopPropagation();
      openReviewModal(app);
    });

    card.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      openReviewModal(app);
    });

    // Quick Actions
    card
      .querySelector(".btn-quick-approve")
      .addEventListener("click", async (e) => {
        e.stopPropagation();
        await updateApplicationStatus(
          app.id,
          "Approved",
          "Approved via Quick Action.",
        );
      });

    card
      .querySelector(".btn-quick-review")
      .addEventListener("click", async (e) => {
        e.stopPropagation();
        await updateApplicationStatus(
          app.id,
          "Under Review",
          "Application marked Under Review.",
        );
      });

    card
      .querySelector(".btn-quick-reject")
      .addEventListener("click", async (e) => {
        e.stopPropagation();
        if (
          confirm(
            `Are you sure you want to decline the application of ${app.studentName}?`,
          )
        ) {
          await updateApplicationStatus(
            app.id,
            "Rejected",
            "Application did not meet criteria.",
          );
        }
      });

    return card;
  }

  // -------------------------------------------------------------
  // 6. APPLICATION REVIEW & DECISION MODAL
  // -------------------------------------------------------------
  function initReviewModal() {
    if (!reviewModalEl) return;

    // Close button & overlay
    const closeBtn = document.getElementById("close-review-modal");
    if (closeBtn) {
      closeBtn.addEventListener("click", closeReviewModal);
    }

    reviewModalEl.addEventListener("click", (e) => {
      if (e.target === reviewModalEl) {
        closeReviewModal();
      }
    });

    // Decision action buttons inside modal
    const btnApprove = document.getElementById("modal-btn-approve");
    const btnUnderReview = document.getElementById("modal-btn-review");
    const btnReject = document.getElementById("modal-btn-reject");
    const btnSaveNotes = document.getElementById("modal-btn-save-notes");

    if (btnApprove) {
      btnApprove.addEventListener("click", async () => {
        if (!currentActiveApp) return;
        const notes =
          document.getElementById("modal-review-notes")?.value || "";
        await updateApplicationStatus(currentActiveApp.id, "Approved", notes);
        closeReviewModal();
      });
    }

    if (btnUnderReview) {
      btnUnderReview.addEventListener("click", async () => {
        if (!currentActiveApp) return;
        const notes =
          document.getElementById("modal-review-notes")?.value || "";
        await updateApplicationStatus(
          currentActiveApp.id,
          "Under Review",
          notes,
        );
        closeReviewModal();
      });
    }

    if (btnReject) {
      btnReject.addEventListener("click", async () => {
        if (!currentActiveApp) return;
        if (confirm("Are you sure you want to decline this applicant?")) {
          const notes =
            document.getElementById("modal-review-notes")?.value || "";
          await updateApplicationStatus(currentActiveApp.id, "Rejected", notes);
          closeReviewModal();
        }
      });
    }

    if (btnSaveNotes) {
      btnSaveNotes.addEventListener("click", async () => {
        if (!currentActiveApp) return;
        const notes =
          document.getElementById("modal-review-notes")?.value || "";
        await updateApplicationStatus(
          currentActiveApp.id,
          currentActiveApp.status || "Under Review",
          notes,
        );
        showToast("Review notes and feedback updated!");
      });
    }
  }

  function openReviewModal(app) {
    currentActiveApp = app;
    isModalOpen = true;

    // Student Avatar in Modal Header
    const studentName = app.studentName || "Student Applicant";
    const initials =
      studentName
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0] || "")
        .join("")
        .toUpperCase() || "ST";

    let studentSettingsPic = "";
    if (
      studentSettings &&
      studentSettings.email &&
      app.studentEmail &&
      studentSettings.email.toLowerCase() === app.studentEmail.toLowerCase()
    ) {
      studentSettingsPic = studentSettings.profilePicture || "";
    }

    const avatar =
      app.studentProfilePic ||
      app.profilePicture ||
      studentSettingsPic ||
      "";

    const modalAvatarEl = document.getElementById("modal-student-avatar");
    if (modalAvatarEl) {
      if (avatar) {
        modalAvatarEl.innerHTML = `<img src="${avatar}" alt="${escapeHtml(studentName)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" />`;
      } else {
        modalAvatarEl.innerHTML = escapeHtml(initials);
      }
    }

    // Populate Fields
    const nameEl = document.getElementById("modal-student-name");
    if (nameEl) nameEl.textContent = studentName;
    const emailEl = document.getElementById("modal-student-email");
    if (emailEl) emailEl.textContent = app.studentEmail || "student@university.edu.ph";
    const idEl = document.getElementById("modal-student-id");
    if (idEl) idEl.textContent = app.studentId || "N/A";
    const schoolEl = document.getElementById("modal-student-school");
    if (schoolEl) schoolEl.textContent = app.university || "Batangas State University";
    const courseEl = document.getElementById("modal-student-course");
    if (courseEl) courseEl.textContent = app.course || "BS Information Technology";
    const yearEl = document.getElementById("modal-student-year");
    if (yearEl) yearEl.textContent = app.yearLevel || "N/A";
    const contactEl = document.getElementById("modal-student-contact");
    if (contactEl) contactEl.textContent = app.contactNumber || "N/A";

    document.getElementById("modal-program-title").textContent =
      app.scholarshipTitle || "Scholarship Program";
    document.getElementById("modal-app-date").textContent =
      app.formattedDate ||
      (app.submittedAt
        ? new Date(app.submittedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "Recently Applied");

    // Status Pill
    const statusPill = document.getElementById("modal-status-badge");
    if (statusPill) {
      const s = (app.status || "Submitted").toLowerCase();
      statusPill.className = "provider-app-badge";
      if (s.includes("approved")) {
        statusPill.classList.add("badge-status-approved");
        statusPill.textContent = "Approved";
      } else if (s.includes("review")) {
        statusPill.classList.add("badge-status-review");
        statusPill.textContent = "Under Review";
      } else if (s.includes("rejected")) {
        statusPill.classList.add("badge-status-rejected");
        statusPill.textContent = "Rejected";
      } else {
        statusPill.classList.add("badge-status-pending");
        statusPill.textContent = app.status || "Submitted";
      }
    }

    // Feedback Notes textarea
    const notesInput = document.getElementById("modal-review-notes");
    if (notesInput) {
      notesInput.value = app.notes || app.feedback || "";
    }

    // Render Submitted Documents
    renderModalDocuments(app);

    // Open Modal
    reviewModalEl.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeReviewModal() {
    if (!reviewModalEl) return;
    reviewModalEl.classList.remove("active");
    document.body.style.overflow = "";
    isModalOpen = false;
    currentActiveApp = null;
  }

  function renderModalDocuments(app) {
    const docsContainer = document.getElementById("modal-documents-list");
    if (!docsContainer) return;

    docsContainer.innerHTML = "";
    const rawDocs = app.documents || app.uploadedDocuments || [];

    const attachedDocs = rawDocs.filter((d) => {
      if (typeof d === "string") return !d.includes("(To Follow Up)");
      return !d.isFollowUp && d.status !== "to_follow_up" && d.type !== "to_follow_up";
    });
    const followUpDocs = rawDocs.filter((d) => {
      if (typeof d === "string") return d.includes("(To Follow Up)");
      return d.isFollowUp || d.status === "to_follow_up" || d.type === "to_follow_up";
    });

    if (attachedDocs.length === 0 && followUpDocs.length === 0) {
      docsContainer.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--text-secondary); background: rgba(0,0,0,0.02); border-radius: 8px;">
          <p style="margin: 0; font-size: 13.5px;">No documents were attached to this submission.</p>
        </div>
      `;
      return;
    }

    // 1. Attached Documents Section
    if (attachedDocs.length > 0) {
      const attachedHeader = document.createElement("div");
      attachedHeader.style.cssText =
        "display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; margin-top: 4px;";
      attachedHeader.innerHTML = `
        <span style="font-size: 11.5px; font-weight: 700; color: #10B981; text-transform: uppercase; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 4px;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
          Attached Verification Files (${attachedDocs.length})
        </span>
        <span style="font-size: 11px; color: var(--text-secondary);">Ready for Verification</span>
      `;
      docsContainer.appendChild(attachedHeader);

      attachedDocs.forEach((doc, idx) => {
        const docItem = document.createElement("div");
        docItem.className = "modal-doc-item";

        const docName =
          typeof doc === "string" ? doc : doc.name || `Document_${idx + 1}`;
        const docUrl =
          typeof doc === "object" && doc.fileUrl ? doc.fileUrl : "";
        const docSize =
          typeof doc === "object" && doc.size
            ? typeof doc.size === "number"
              ? (doc.size / 1024).toFixed(0) + " KB"
              : doc.size
            : "1.2 MB";
        const isPdf = docName.toLowerCase().endsWith(".pdf");
        const reqTag =
          typeof doc === "object" && (doc.requirement || doc.title)
            ? `<span style="font-size: 11px; font-weight: 600; color: #8b5cf6; background: rgba(139, 92, 246, 0.12); padding: 2px 7px; border-radius: 4px; margin-left: 6px; display: inline-block;">${escapeHtml(doc.requirement || doc.title)}</span>`
            : "";

        docItem.innerHTML = `
          <div class="modal-doc-info">
            <div class="modal-doc-icon ${isPdf ? "is-pdf" : "is-img"}">
              ${
                isPdf
                  ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="#E53935"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8" fill="none" stroke="#fff" stroke-width="2"></polyline><text x="7" y="18" fill="#fff" font-size="6" font-weight="bold">PDF</text></svg>`
                  : `<svg width="20" height="20" viewBox="0 0 24 24" fill="#6941C6"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5" fill="#fff"></circle><polyline points="21 15 16 10 5 21" fill="none" stroke="#fff" stroke-width="2"></polyline></svg>`
              }
            </div>
            <div>
              <h5 class="modal-doc-name" title="${escapeHtml(docName)}">${escapeHtml(docName)}${reqTag}</h5>
              <span class="modal-doc-size">${escapeHtml(docSize)} &bull; Ready for verification</span>
            </div>
          </div>

          <div class="modal-doc-actions">
            <button type="button" class="btn-doc-view" title="Preview Document">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              View File
            </button>
          </div>
        `;

        docItem.querySelector(".btn-doc-view").addEventListener("click", () => {
          openDocPreview(
            docName,
            docUrl,
            typeof doc === "object" ? doc.data : null,
          );
        });

        docsContainer.appendChild(docItem);
      });
    }

    // 2. Requirements To Follow Up Section
    if (followUpDocs.length > 0) {
      const followUpHeader = document.createElement("div");
      followUpHeader.style.cssText =
        "display: flex; align-items: center; justify-content: space-between; margin-top: 14px; margin-bottom: 8px; padding-top: 10px; border-top: 1px dashed var(--border-color);";
      followUpHeader.innerHTML = `
        <span style="font-size: 11.5px; font-weight: 700; color: #D97706; text-transform: uppercase; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 4px;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          Requirements To Follow Up (${followUpDocs.length})
        </span>
        <span style="font-size: 11px; color: #D97706; font-weight: 600;">Student Opted to Submit Later</span>
      `;
      docsContainer.appendChild(followUpHeader);

      followUpDocs.forEach((doc) => {
        const itemEl = document.createElement("div");
        itemEl.className = "modal-doc-item";
        itemEl.style.cssText =
          "background: rgba(245, 158, 11, 0.05); border-color: rgba(245, 158, 11, 0.25);";

        const reqTitle =
          typeof doc === "object"
            ? doc.requirement || doc.title || (doc.name || "").replace(" (To Follow Up)", "")
            : String(doc).replace(" (To Follow Up)", "");

        itemEl.innerHTML = `
          <div class="modal-doc-info" style="min-width: 0;">
            <div class="modal-doc-icon" style="background: rgba(245, 158, 11, 0.15); color: #D97706;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2.2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <div style="min-width: 0;">
              <h5 class="modal-doc-name" style="color: var(--text-primary); font-weight: 700;">
                ${escapeHtml(reqTitle)}
                <span style="font-size: 11px; font-weight: 600; color: #D97706; background: rgba(245, 158, 11, 0.15); padding: 2px 7px; border-radius: 4px; margin-left: 6px; display: inline-block;">To Follow Up</span>
              </h5>
              <span style="font-size: 11.5px; color: var(--text-secondary); display: block; margin-top: 2px;">
                Student chose to submit this document later &bull; Cannot be reviewed yet
              </span>
            </div>
          </div>

          <div class="modal-doc-actions">
            <span style="background: rgba(245, 158, 11, 0.12); color: #D97706; border: 1px solid rgba(245, 158, 11, 0.25); font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 6px; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              No File Attached
            </span>
          </div>
        `;
        docsContainer.appendChild(itemEl);
      });
    }
  }

  // -------------------------------------------------------------
  // 7. IN-PORTAL DOCUMENT PREVIEW MODAL
  // -------------------------------------------------------------
  function initDocPreviewModal() {
    if (!docPreviewModalEl) return;
    const closeBtn = document.getElementById("close-doc-preview");
    if (closeBtn) {
      closeBtn.addEventListener("click", closeDocPreview);
    }
    docPreviewModalEl.addEventListener("click", (e) => {
      if (e.target === docPreviewModalEl) {
        closeDocPreview();
      }
    });
  }

  function openDocPreview(fileName, fileUrl, base64Data) {
    if (!docPreviewModalEl) {
      if (fileUrl) window.open(fileUrl, "_blank");
      return;
    }

    const titleEl = document.getElementById("doc-preview-title");
    const bodyEl = document.getElementById("doc-preview-body");
    const downloadBtn = document.getElementById("doc-preview-download");

    if (titleEl) titleEl.textContent = fileName;
    if (downloadBtn) {
      downloadBtn.href = fileUrl || base64Data || "#";
      downloadBtn.download = fileName;
    }

    const isPdf = fileName.toLowerCase().endsWith(".pdf");
    const targetUrl = fileUrl || base64Data;

    if (bodyEl) {
      if (targetUrl) {
        if (isPdf) {
          bodyEl.innerHTML = `<iframe src="${targetUrl}" style="width:100%; height:450px; border:none; border-radius:8px;"></iframe>`;
        } else {
          bodyEl.innerHTML = `
            <div style="display:flex; justify-content:center; align-items:center; background:#111; border-radius:8px; padding:16px;">
              <img src="${targetUrl}" alt="${escapeHtml(fileName)}" style="max-width:100%; max-height:450px; object-fit:contain;" />
            </div>
          `;
        }
      } else {
        bodyEl.innerHTML = `
          <div style="text-align: center; padding: 40px 20px; background: rgba(0,0,0,0.03); border-radius: 8px;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6941C6" stroke-width="1.8" style="margin-bottom:12px;">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <h4>${escapeHtml(fileName)}</h4>
            <p style="font-size: 13.5px; opacity: 0.8; margin-top: 6px;">Document file verified by NEXO Student Drop-Box.</p>
          </div>
        `;
      }
    }

    docPreviewModalEl.classList.add("active");
  }

  function closeDocPreview() {
    if (!docPreviewModalEl) return;
    docPreviewModalEl.classList.remove("active");
  }

  // -------------------------------------------------------------
  // 8. UPDATE APPLICATION STATUS (LIVE BACKEND SYNC)
  // -------------------------------------------------------------
  async function updateApplicationStatus(appId, newStatus, notes = "") {
    // 1. Optimistic UI update
    const idx = allApplications.findIndex(
      (a) => String(a.id) === String(appId),
    );
    if (idx >= 0) {
      allApplications[idx].status = newStatus;
      allApplications[idx].statusText = newStatus;
      allApplications[idx].notes = notes;
      allApplications[idx].feedback = notes;
      allApplications[idx].reviewedAt = new Date().toISOString();
    }

    // Keep localStorage updated
    try {
      localStorage.setItem(
        "nexo_applications",
        JSON.stringify(allApplications),
      );
    } catch (_) {}

    // Dispatch live student notification
    try {
      const notifList = JSON.parse(
        localStorage.getItem("nexo_notifications") || "[]",
      );
      const targetApp = allApplications.find(
        (a) => String(a.id) === String(appId),
      );
      const scholTitle = targetApp
        ? targetApp.scholarshipTitle || targetApp.title || "Scholarship Program"
        : "Scholarship Program";
      const remarksText = notes ? ` Provider remarks: "${notes}"` : "";
      const newNotif = {
        id: "notif_" + Date.now(),
        recipient: "student",
        title: `Application Status: ${newStatus}`,
        message: `Your application for "${scholTitle}" has been updated to "${newStatus}".${remarksText}`,
        timestamp: new Date().toISOString(),
        formattedTime: "Just now",
        read: false,
        link: "student-submissions.html",
        appId: appId,
      };
      notifList.unshift(newNotif);
      localStorage.setItem("nexo_notifications", JSON.stringify(notifList));

      fetch(`${API_BASE}/api/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newNotif),
      }).catch(() => {});

      window.dispatchEvent(new CustomEvent("nexo:notification"));
    } catch (_) {}

    updateTabCounters();
    renderApplicationsList();

    // 2. Persist to Backend Server & data.json
    try {
      const res = await fetch(`${API_BASE}/api/applications/${appId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          notes: notes,
          feedback: notes,
        }),
      });

      if (res.ok) {
        showToast(`Application status updated to "${newStatus}"!`);
      } else {
        throw new Error("HTTP error " + res.status);
      }
    } catch (err) {
      console.warn("Server update fallback, saved to local cache:", err);
      showToast(`Updated to "${newStatus}" (saved locally)!`);
    }
  }

  // -------------------------------------------------------------
  // ESCAPE HELPERS
  // -------------------------------------------------------------
  function escapeHtml(text) {
    if (text === null || text === undefined) return "";
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttr(text) {
    if (text === null || text === undefined) return "";
    return String(text).replace(/"/g, "&quot;");
  }
})();
