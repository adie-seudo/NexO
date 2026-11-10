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
  let studentProfiles = {};
  let users = [];

  function resolveStudentInfo(app) {
    const email = (app.studentEmail || "").toLowerCase().trim();
    
    // 1. In-memory studentProfiles
    let profile = (studentProfiles && studentProfiles[email]) || {};

    // 2. LocalStorage per-student settings cache
    if (!profile.course || !profile.university || !profile.studentId) {
      try {
        const rawUser = localStorage.getItem(`nexo_student_settings_${email}`);
        if (rawUser) profile = { ...JSON.parse(rawUser), ...profile };
      } catch (_) {}
    }

    // 3. General localStorage student_settings if email matches
    if (!profile.course || !profile.university || !profile.studentId) {
      try {
        const rawGen = localStorage.getItem("nexo_student_settings");
        if (rawGen) {
          const parsedGen = JSON.parse(rawGen);
          if ((parsedGen.email || "").toLowerCase().trim() === email) {
            profile = { ...parsedGen, ...profile };
          }
        }
      } catch (_) {}
    }

    // 4. Global student_profiles cache in localStorage
    if (!profile.course || !profile.university || !profile.studentId) {
      try {
        const rawAll = localStorage.getItem("nexo_student_profiles");
        if (rawAll) {
          const parsedAll = JSON.parse(rawAll);
          if (parsedAll[email]) {
            profile = { ...parsedAll[email], ...profile };
          }
        }
      } catch (_) {}
    }

    // 5. Matched user in users list
    const matchedUser =
      (users &&
        users.find((u) => (u.email || "").toLowerCase().trim() === email)) ||
      {};

    return {
      fullName:
        profile.fullName ||
        matchedUser.name ||
        app.studentName ||
        "Student Applicant",
      email: profile.email || app.studentEmail || matchedUser.email || "",
      university:
        profile.university ||
        matchedUser.university ||
        app.university ||
        "",
      course:
        profile.course ||
        matchedUser.course ||
        app.course ||
        "",
      yearLevel:
        profile.yearLevel ||
        matchedUser.yearLevel ||
        app.yearLevel ||
        "",
      studentId:
        profile.studentId ||
        matchedUser.studentId ||
        app.studentId ||
        "",
      contactNumber:
        profile.contactNumber ||
        matchedUser.contactNumber ||
        app.contactNumber ||
        "",
      bio:
        profile.bio !== undefined && profile.bio !== ""
          ? profile.bio
          : matchedUser.bio !== undefined && matchedUser.bio !== ""
          ? matchedUser.bio
          : app.bio || "",
      profilePicture:
        profile.profilePicture ||
        matchedUser.profilePicture ||
        app.studentProfilePic ||
        app.profilePicture ||
        "",
    };
  }
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
        if (data.studentProfiles) {
          studentProfiles = data.studentProfiles;
          try { localStorage.setItem("nexo_student_profiles", JSON.stringify(studentProfiles)); } catch(_) {}
        }
        if (Array.isArray(data.users)) {
          users = data.users;
        }
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
  // SCOPED SCHOLARSHIP HELPERS
  // -------------------------------------------------------------
  const urlParams = new URLSearchParams(window.location.search);
  const scopedScholId = urlParams.get("scholarshipId") || urlParams.get("scholId");

  function getTargetScholarship() {
    if (!scopedScholId) return null;
    return allScholarships.find(
      (s) =>
        String(s.id) === String(scopedScholId) ||
        String(s.title || "").toLowerCase() === String(scopedScholId).toLowerCase(),
    );
  }

  function getBaseApplications() {
    if (!scopedScholId) return allApplications;
    const target = getTargetScholarship();
    return allApplications.filter((app) => {
      if (app.scholarshipId && String(app.scholarshipId) === String(scopedScholId)) {
        return true;
      }
      if (
        target &&
        target.title &&
        (String(app.scholarshipTitle || "").toLowerCase() ===
          String(target.title).toLowerCase() ||
          String(app.title || "").toLowerCase() ===
            String(target.title).toLowerCase())
      ) {
        return true;
      }
      return false;
    });
  }

  function renderScopedBanner() {
    const bannerEl = document.getElementById("scoped-scholarship-banner");
    const backLink = document.getElementById("back-link");
    const pageTitle = document.getElementById("apps-page-title");
    if (!bannerEl) return;

    if (!scopedScholId) {
      bannerEl.style.display = "none";
      if (pageTitle) pageTitle.textContent = "Applications";
      if (backLink) {
        backLink.href = "provider-dashboard.html";
        backLink.innerHTML = "&larr; Back";
      }
      return;
    }

    const target = getTargetScholarship();
    const title = target ? target.title : scopedScholId;
    const type = target ? target.type || "Scholarship" : "Scholarship";
    const status = target ? target.status || "Open" : "Open";
    const deadline = target
      ? target.formattedDate || target.deadline || "Open"
      : "Open";
    const limit = target ? target.applicantLimit || 200 : 200;
    const baseApps = getBaseApplications();

    if (backLink) {
      backLink.href = "provider-posts.html";
      backLink.innerHTML = "&larr; Back to Posted Scholarships";
    }
    if (pageTitle) {
      pageTitle.textContent = `Applications: ${title}`;
    }

    bannerEl.style.display = "block";
    bannerEl.innerHTML = `
      <div class="scoped-scholarship-card">
        <div class="scoped-card-left">
          <div class="scoped-badge-row">
            <span class="scoped-tag">FILTERED POST</span>
            <span class="scoped-status-pill ${status === "Closed" ? "closed" : "open"}">${escapeHtml(status)}</span>
          </div>
          <h2 class="scoped-title">${escapeHtml(title)}</h2>
          <div class="scoped-meta-row">
            <span><strong>Type:</strong> ${escapeHtml(type)}</span>
            <span>•</span>
            <span><strong>Deadline:</strong> ${escapeHtml(deadline)}</span>
            <span>•</span>
            <span><strong>Applicants:</strong> ${baseApps.length} / ${limit}</span>
          </div>
        </div>
        <div class="scoped-card-actions">
          <a href="provider-posts.html" class="scoped-btn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            All Posted Scholarships
          </a>
          <a href="provider-applications.html" class="scoped-btn">
            View All Applications
          </a>
        </div>
      </div>
    `;
  }

  // -------------------------------------------------------------
  // 2. TAB COUNTERS & FILTER TABS
  // -------------------------------------------------------------
  function updateTabCounters() {
    const baseApps = getBaseApplications();
    let countAll = baseApps.length;
    let countPending = 0;
    let countReviewed = 0;
    let countApproved = 0;
    let countRejected = 0;

    baseApps.forEach((app) => {
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

    renderScopedBanner();
    const baseApps = getBaseApplications();

    // Filter by tab
    let filtered = baseApps.filter((app) => {
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
      if (scopedScholId && baseApps.length === 0) {
        if (emptyTitle) emptyTitle.textContent = "No Applications For This Scholarship";
        if (emptyDesc)
          emptyDesc.textContent =
            "No student applications have been submitted for this specific scholarship opportunity yet.";
      } else if (allApplications.length === 0) {
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

    const info = resolveStudentInfo(app);
    const name = info.fullName;
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

    const avatar = info.profilePicture;

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
            ${escapeHtml([info.course, info.yearLevel].filter(Boolean).join(" • ") || "Degree Candidate")}
            ${info.university ? `&bull; ${escapeHtml(info.university)}` : ""}
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
      </div>
    `;

    // Click on Review button or anywhere on Card to view full details
    card.querySelector(".btn-review-app").addEventListener("click", (e) => {
      e.stopPropagation();
      openReviewModal(app);
    });

    card.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      openReviewModal(app);
    });

    return card;
  }

  // -------------------------------------------------------------
  // 6. APPLICATION REVIEW & DECISION MODAL
  // -------------------------------------------------------------
  const DEFAULT_AUTOMATED_REMARKS = {
    "Approved":
      "Congratulations! Your scholarship application has been officially approved. Please check your registered email or phone for onboarding and disbursement instructions outside of NexO.",
    "Rejected":
      "Thank you for your application and interest. After careful evaluation of all candidates, we regret to inform you that your application was not selected for this scholarship cycle. We encourage you to apply for future opportunities.",
    "Under Review":
      "Your application and verification documents are currently under evaluation. Please keep your contact information active and check back for updates.",
  };

  let pendingDecision = null; // { appId, status }

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

    // Decision action buttons inside review modal
    const btnApprove = document.getElementById("modal-btn-approve");
    const btnUnderReview = document.getElementById("modal-btn-review");
    const btnReject = document.getElementById("modal-btn-reject");
    const btnSaveNotes = document.getElementById("modal-btn-save-notes");

    if (btnApprove) {
      btnApprove.addEventListener("click", () => {
        openDecisionConfirmModal("Approved");
      });
    }

    if (btnUnderReview) {
      btnUnderReview.addEventListener("click", () => {
        openDecisionConfirmModal("Under Review");
      });
    }

    if (btnReject) {
      btnReject.addEventListener("click", () => {
        openDecisionConfirmModal("Rejected");
      });
    }

    if (btnSaveNotes) {
      btnSaveNotes.addEventListener("click", async () => {
        if (!currentActiveApp) return;
        if (
          currentActiveApp.status === "Approved" ||
          currentActiveApp.status === "Rejected"
        ) {
          showToast(
            "This decision has already been finalized and cannot be modified.",
            true,
          );
          return;
        }

        const notesInput = document.getElementById("modal-review-notes");
        const errEl = document.getElementById("modal-save-notes-error");
        const notes = notesInput ? notesInput.value.trim() : "";

        if (!notes) {
          if (errEl) {
            errEl.textContent =
              "Feedback cannot be empty. Please enter notes or feedback before saving.";
            errEl.style.display = "block";
          }
          if (notesInput) notesInput.focus();
          return;
        }

        if (errEl) errEl.style.display = "none";

        btnSaveNotes.disabled = true;
        await updateApplicationStatus(
          currentActiveApp.id,
          currentActiveApp.status || "Under Review",
          notes,
        );
        btnSaveNotes.disabled = false;

        currentActiveApp.notes = notes;
        currentActiveApp.feedback = notes;
        currentActiveApp.remarks = notes;

        const successBanner = document.getElementById(
          "modal-feedback-success-banner",
        );
        const successMsg = document.getElementById("modal-feedback-success-msg");
        if (successBanner && successMsg) {
          successMsg.textContent =
            "Notes and feedback were successfully updated and dispatched to the student's portal!";
          successBanner.style.display = "block";
          const container = reviewModalEl.querySelector(".nexo-modal-container");
          if (container) container.scrollTo({ top: 0, behavior: "smooth" });
        }
      });
    }

    // Confirmation Modal Elements & Listeners
    initDecisionConfirmModal();
  }

  function initDecisionConfirmModal() {
    const confirmModal = document.getElementById("decision-confirm-modal");
    if (!confirmModal) return;

    const closeBtn = document.getElementById("close-decision-confirm");
    const cancelBtn = document.getElementById("btn-cancel-decision-confirm");
    const submitBtn = document.getElementById("btn-submit-decision-confirm");
    const resetDefaultBtn = document.getElementById("btn-reset-default-remarks");
    const textarea = document.getElementById("confirm-remarks-textarea");

    if (closeBtn) closeBtn.addEventListener("click", closeDecisionConfirmModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeDecisionConfirmModal);

    confirmModal.addEventListener("click", (e) => {
      if (e.target === confirmModal) {
        closeDecisionConfirmModal();
      }
    });

    if (resetDefaultBtn) {
      resetDefaultBtn.addEventListener("click", () => {
        if (!pendingDecision) return;
        const defaultText =
          DEFAULT_AUTOMATED_REMARKS[pendingDecision.status] || "";
        if (textarea) {
          textarea.value = defaultText;
          textarea.focus();
        }
        const errEl = document.getElementById("confirm-remarks-error");
        if (errEl) errEl.style.display = "none";
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener("click", async () => {
        if (!currentActiveApp || !pendingDecision) return;

        const remarks = textarea ? textarea.value.trim() : "";
        const errEl = document.getElementById("confirm-remarks-error");

        if (!remarks) {
          if (errEl) {
            errEl.textContent =
              "Remarks cannot be empty. Please provide feedback or follow-up instructions for the student.";
            errEl.style.display = "block";
          }
          if (textarea) textarea.focus();
          return;
        }

        if (errEl) errEl.style.display = "none";

        submitBtn.disabled = true;
        const targetStatus = pendingDecision.status;
        const targetAppId = currentActiveApp.id;

        await updateApplicationStatus(targetAppId, targetStatus, remarks);

        submitBtn.disabled = false;
        closeDecisionConfirmModal();

        // Keep Review Modal open and update its view in-place
        currentActiveApp.status = targetStatus;
        currentActiveApp.statusText = targetStatus;
        currentActiveApp.notes = remarks;
        currentActiveApp.feedback = remarks;
        currentActiveApp.remarks = remarks;

        const notesInput = document.getElementById("modal-review-notes");
        if (notesInput) notesInput.value = remarks;

        // Update status badge in Review Modal header
        const statusBadge = document.getElementById("modal-status-badge");
        if (statusBadge) {
          statusBadge.className = "provider-app-badge";
          if (targetStatus === "Approved") {
            statusBadge.classList.add("badge-status-approved");
            statusBadge.textContent = "Approved";
          } else if (targetStatus === "Rejected") {
            statusBadge.classList.add("badge-status-rejected");
            statusBadge.textContent = "Rejected";
          } else {
            statusBadge.classList.add("badge-status-review");
            statusBadge.textContent = "Under Review";
          }
        }

        // Show prominent on-screen feedback success notifier
        const successBanner = document.getElementById(
          "modal-feedback-success-banner",
        );
        const successMsg = document.getElementById("modal-feedback-success-msg");
        if (successBanner && successMsg) {
          successMsg.textContent = `Application decision marked as "${targetStatus}" and remarks have been successfully saved and dispatched to the student's portal!`;
          successBanner.style.display = "block";
          const container = reviewModalEl.querySelector(".nexo-modal-container");
          if (container) container.scrollTo({ top: 0, behavior: "smooth" });
        }

        // If Approved or Rejected, lock the decision controls permanently
        if (targetStatus === "Approved" || targetStatus === "Rejected") {
          const finalizedNotice = document.getElementById(
            "modal-decision-finalized-notice",
          );
          const finalizedLabel = document.getElementById(
            "modal-finalized-status-label",
          );
          if (finalizedNotice) {
            finalizedNotice.style.display = "block";
            if (finalizedLabel) finalizedLabel.textContent = targetStatus;
          }
          const btnApprove = document.getElementById("modal-btn-approve");
          const btnUnderReview = document.getElementById("modal-btn-review");
          const btnReject = document.getElementById("modal-btn-reject");
          const btnSaveNotes = document.getElementById("modal-btn-save-notes");
          if (btnApprove) btnApprove.disabled = true;
          if (btnUnderReview) btnUnderReview.disabled = true;
          if (btnReject) btnReject.disabled = true;
          if (btnSaveNotes) btnSaveNotes.disabled = true;
          if (notesInput) notesInput.readOnly = true;
        }
      });
    }
  }

  function openDecisionConfirmModal(status) {
    if (!currentActiveApp) return;

    if (
      currentActiveApp.status === "Approved" ||
      currentActiveApp.status === "Rejected"
    ) {
      showToast(
        "This application decision has already been finalized and cannot be modified.",
        true,
      );
      return;
    }

    pendingDecision = { appId: currentActiveApp.id, status };

    const confirmModal = document.getElementById("decision-confirm-modal");
    const heading = document.getElementById("confirm-modal-heading");
    const subheading = document.getElementById("confirm-modal-subheading");
    const permAlert = document.getElementById("confirm-permanence-alert");
    const reviewAlert = document.getElementById("confirm-review-alert");
    const actionName = document.getElementById("confirm-action-name");
    const statusIcon = document.getElementById("confirm-status-icon");
    const textarea = document.getElementById("confirm-remarks-textarea");
    const errEl = document.getElementById("confirm-remarks-error");
    const submitBtn = document.getElementById("btn-submit-decision-confirm");

    if (errEl) errEl.style.display = "none";

    const currentNotes =
      document.getElementById("modal-review-notes")?.value?.trim() || "";
    const defaultRemark = DEFAULT_AUTOMATED_REMARKS[status] || "";

    if (textarea) {
      textarea.value = currentNotes || defaultRemark;
    }

    if (heading) heading.textContent = `Confirm Decision: ${status}`;
    if (subheading) {
      subheading.textContent = `Application of ${currentActiveApp.studentName || "Student Scholar"}`;
    }

    if (status === "Approved") {
      if (permAlert) permAlert.style.display = "block";
      if (reviewAlert) reviewAlert.style.display = "none";
      if (actionName) actionName.textContent = "Approval";
      if (statusIcon) {
        statusIcon.style.background = "rgba(16, 185, 129, 0.15)";
        statusIcon.style.color = "#10B981";
        statusIcon.innerHTML =
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>';
      }
      if (submitBtn) {
        submitBtn.textContent = "Confirm & Approve";
        submitBtn.style.background = "#16a34a";
        submitBtn.style.borderColor = "#16a34a";
      }
    } else if (status === "Rejected") {
      if (permAlert) permAlert.style.display = "block";
      if (reviewAlert) reviewAlert.style.display = "none";
      if (actionName) actionName.textContent = "Rejection";
      if (statusIcon) {
        statusIcon.style.background = "rgba(239, 68, 68, 0.15)";
        statusIcon.style.color = "#ef4444";
        statusIcon.innerHTML =
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
      }
      if (submitBtn) {
        submitBtn.textContent = "Confirm & Reject";
        submitBtn.style.background = "#ef4444";
        submitBtn.style.borderColor = "#ef4444";
      }
    } else {
      if (permAlert) permAlert.style.display = "none";
      if (reviewAlert) reviewAlert.style.display = "block";
      if (statusIcon) {
        statusIcon.style.background = "rgba(139, 92, 246, 0.15)";
        statusIcon.style.color = "#8b5cf6";
        statusIcon.innerHTML =
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
      }
      if (submitBtn) {
        submitBtn.textContent = "Confirm & Mark Under Review";
        submitBtn.style.background = "#8b5cf6";
        submitBtn.style.borderColor = "#8b5cf6";
      }
    }

    if (confirmModal) confirmModal.classList.add("active");
  }

  function closeDecisionConfirmModal() {
    const confirmModal = document.getElementById("decision-confirm-modal");
    if (confirmModal) confirmModal.classList.remove("active");
    pendingDecision = null;
  }

  function openReviewModal(app) {
    currentActiveApp = app;
    isModalOpen = true;

  window.openReviewModalByAppId = function (id) {
    const target = allApplications.find((a) => String(a.id) === String(id));
    if (target) {
      openReviewModal(target);
    }
  };

    // Reset feedback success banner and error messages
    const successBanner = document.getElementById("modal-feedback-success-banner");
    const saveNotesErr = document.getElementById("modal-save-notes-error");
    if (successBanner) successBanner.style.display = "none";
    if (saveNotesErr) saveNotesErr.style.display = "none";

    const info = resolveStudentInfo(app);
    const studentName = info.fullName;
    const initials =
      studentName
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0] || "")
        .join("")
        .toUpperCase() || "ST";

    const avatar = info.profilePicture;

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
    if (emailEl) emailEl.textContent = info.email || app.studentEmail || "Not Specified";
    const idEl = document.getElementById("modal-student-id");
    if (idEl) idEl.textContent = info.studentId || "Not Specified";
    const schoolEl = document.getElementById("modal-student-school");
    if (schoolEl) schoolEl.textContent = info.university || "Not Specified";
    const courseEl = document.getElementById("modal-student-course");
    if (courseEl) courseEl.textContent = info.course || "Not Specified";
    const yearEl = document.getElementById("modal-student-year");
    if (yearEl) yearEl.textContent = info.yearLevel || "Not Specified";
    const contactEl = document.getElementById("modal-student-contact");
    if (contactEl) contactEl.textContent = info.contactNumber || "Not Specified";
    const bioEl = document.getElementById("modal-student-bio");
    if (bioEl) {
      if (info.bio && info.bio.trim()) {
        bioEl.textContent = info.bio.trim();
        bioEl.style.fontStyle = "normal";
        bioEl.style.color = "var(--text-primary)";
      } else {
        bioEl.textContent = "No applicant bio provided.";
        bioEl.style.fontStyle = "italic";
        bioEl.style.color = "var(--text-secondary)";
      }
    }

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

    // Feedback Notes textarea & Finalized Decision Locks
    const notesInput = document.getElementById("modal-review-notes");
    if (notesInput) {
      notesInput.value = app.remarks || app.feedback || app.notes || "";
    }

    const isFinalized = (app.status === "Approved" || app.status === "Rejected");
    const finalizedNotice = document.getElementById("modal-decision-finalized-notice");
    const finalizedLabel = document.getElementById("modal-finalized-status-label");
    const btnApprove = document.getElementById("modal-btn-approve");
    const btnUnderReview = document.getElementById("modal-btn-review");
    const btnReject = document.getElementById("modal-btn-reject");
    const btnSaveNotes = document.getElementById("modal-btn-save-notes");

    if (isFinalized) {
      if (finalizedNotice) {
        finalizedNotice.style.display = "block";
        if (finalizedLabel) finalizedLabel.textContent = app.status;
      }
      if (btnApprove) btnApprove.disabled = true;
      if (btnUnderReview) btnUnderReview.disabled = true;
      if (btnReject) btnReject.disabled = true;
      if (btnSaveNotes) btnSaveNotes.disabled = true;
      if (notesInput) notesInput.readOnly = true;
    } else {
      if (finalizedNotice) finalizedNotice.style.display = "none";
      if (btnApprove) btnApprove.disabled = false;
      if (btnUnderReview) btnUnderReview.disabled = false;
      if (btnReject) btnReject.disabled = false;
      if (btnSaveNotes) btnSaveNotes.disabled = false;
      if (notesInput) notesInput.readOnly = false;
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
          typeof doc === "object"
            ? (doc.data || doc.url || doc.fileUrl || doc.dataUrl || "")
            : (typeof doc === "string" ? doc : "");
        const docSize =
          typeof doc === "object" && doc.size
            ? typeof doc.size === "number"
              ? (doc.size / 1024).toFixed(0) + " KB"
              : doc.size
            : "1.2 MB";
        const cleanDocName = docName.replace(/\s*\(To Follow Up\)/gi, "").trim();
        const isPdf = cleanDocName.toLowerCase().endsWith(".pdf") || (typeof docUrl === "string" && docUrl.startsWith("data:application/pdf"));
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
              <h5 class="modal-doc-name" title="${escapeHtml(cleanDocName)}">${escapeHtml(cleanDocName)}${reqTag}</h5>
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
            cleanDocName,
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
          "background: rgba(245, 158, 11, 0.05); border: 1px dashed rgba(245, 158, 11, 0.35);";

        const reqTitle =
          typeof doc === "object"
            ? doc.requirement || doc.title || (doc.name || "").replace(/\s*\(To Follow Up\)/gi, "")
            : String(doc).replace(/\s*\(To Follow Up\)/gi, "");

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
              </h5>
              <span class="modal-doc-size" style="color: #d97706; font-weight: 500;">
                To follow up later &bull; Pending student submission
              </span>
            </div>
          </div>

          <div class="modal-doc-actions">
            <span style="font-size: 11.5px; font-weight: 700; color: #d97706; background: rgba(245, 158, 11, 0.15); padding: 4px 10px; border-radius: 12px; white-space: nowrap;">
              To Follow Up
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

    const btnFullscreen = document.getElementById("doc-preview-fullscreen");
    const previewContainer = document.getElementById("doc-preview-container");
    const fullscreenText = document.getElementById("fullscreen-btn-text");
    if (btnFullscreen && previewContainer) {
      btnFullscreen.addEventListener("click", () => {
        const isFull = previewContainer.classList.toggle("is-fullscreen");
        if (fullscreenText) {
          fullscreenText.textContent = isFull ? "Exit Full Screen" : "Full Screen";
        }
      });
    }

    const btnDownload = document.getElementById("doc-preview-download");
    if (btnDownload) {
      btnDownload.addEventListener("click", (e) => {
        e.preventDefault();
        // Download button with no function yet as requested
      });
    }

    const btnCloseBottom = document.getElementById("modal-btn-close-bottom");
    if (btnCloseBottom) {
      btnCloseBottom.addEventListener("click", closeReviewModal);
    }
  }

  function openDocPreview(fileName, fileUrl, base64Data) {
    if (!docPreviewModalEl) {
      if (fileUrl) window.open(fileUrl, "_blank");
      return;
    }

    const titleEl = document.getElementById("doc-preview-title");
    const bodyEl = document.getElementById("doc-preview-body");

    if (titleEl) titleEl.textContent = fileName || "Document Preview";

    const targetUrl = fileUrl || base64Data;
    const isPdf =
      fileName.toLowerCase().endsWith(".pdf") ||
      (typeof targetUrl === "string" && targetUrl.startsWith("data:application/pdf"));
    const isImg =
      typeof targetUrl === "string" &&
      (targetUrl.startsWith("data:image/") || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(targetUrl));

    if (bodyEl) {
      if (targetUrl && (isImg || isPdf || targetUrl.startsWith("data:") || targetUrl.startsWith("http"))) {
        if (isPdf) {
          bodyEl.innerHTML = `<iframe src="${targetUrl}" style="width:100%; height:72vh; border:none; border-radius:8px;"></iframe>`;
        } else {
          bodyEl.innerHTML = `
            <div style="display:flex; justify-content:center; align-items:center; background:rgba(0,0,0,0.03); border-radius:8px; padding:14px; min-height:320px;">
              <img src="${targetUrl}" alt="${escapeHtml(fileName)}" style="max-width:100%; max-height:70vh; object-fit:contain; border-radius:6px; box-shadow: 0 4px 16px rgba(0,0,0,0.12);" />
            </div>
          `;
        }
      } else {
        bodyEl.innerHTML = `
          <div style="text-align: center; padding: 48px 20px; background: rgba(0,0,0,0.02); border-radius: 8px;">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#6941C6" stroke-width="1.8" style="margin-bottom:12px;">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
            <h4 style="font-size: 15px; margin: 0 0 6px 0; color: var(--text-primary);">${escapeHtml(fileName)}</h4>
            <p style="font-size: 13px; color: var(--text-secondary); margin: 0;">Verification document submitted via NEXO Student Portal.</p>
          </div>
        `;
      }
    }

    docPreviewModalEl.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeDocPreview() {
    if (!docPreviewModalEl) return;
    docPreviewModalEl.classList.remove("active");
    if (!isModalOpen) {
      document.body.style.overflow = "";
    }
    const container = document.getElementById("doc-preview-container");
    if (container) container.classList.remove("is-fullscreen");
    const fullscreenText = document.getElementById("fullscreen-btn-text");
    if (fullscreenText) fullscreenText.textContent = "Full Screen";
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
      allApplications[idx].remarks = notes;
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
          remarks: notes,
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
