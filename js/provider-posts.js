// ==========================================================================
// NEXO PROVIDER POSTED SCHOLARSHIPS & APPLICANTS MANAGER (js/provider-posts.js)
// 1. Manages posted scholarships list and metrics.
// 2. In-page transition to View Applications: lists only applicants for that
//    specific post in First-Come, First-Served (FCFS) order.
// 3. Complete review, document preview, permanent decisions & remarks sync.
// ==========================================================================

(function () {
  const API_BASE = window.location.origin.includes(":3000")
    ? ""
    : "http://localhost:3000";

  const DEFAULT_AUTOMATED_REMARKS = {
    Approved:
      "Congratulations! Your scholarship application has been officially APPROVED. Please monitor your institutional email for next steps and disbursement scheduling.",
    "Under Review":
      "Your application and submitted documents are currently UNDER REVIEW by the scholarship committee. You will be notified of any required follow-ups.",
    Rejected:
      "Thank you for your application. After careful evaluation, we regret to inform you that your application was NOT SELECTED for this scholarship cycle.",
  };

  // State
  let allScholarships = [];
  let allApplications = [];
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
  let currentActivePost = null;
  let currentActiveApp = null;
  let pendingDecision = null;
  let isModalOpen = false;

  // View 1 Filters (Posts List)
  let postFilterTab = "all";
  let postSearchQuery = "";
  let lastPostsSig = null;

  // View 2 Filters (Applicants for Selected Post)
  let appFilterTab = "all";
  let appSearchQuery = "";

  // DOM Elements
  let postsListViewEl = null;
  let postApplicantsViewEl = null;
  let postsFeedEl = null;
  let postsEmptyStateEl = null;
  let postSearchInputEl = null;
  let postsCountLabelEl = null;

  let postApplicantsFeedEl = null;
  let postApplicantsEmptyEl = null;
  let appSearchInputEl = null;

  // Modals
  let scholModalEl = null;
  let reviewModalEl = null;
  let confirmModalEl = null;
  let docPreviewModalEl = null;

  document.addEventListener("DOMContentLoaded", () => {
    cacheDOM();
    initPostsFilters();
    initApplicantFilters();
    initModals();
    loadData();

    // Check URL parameters for direct deep-linking to a post
    const urlParams = new URLSearchParams(window.location.search);
    const targetId =
      urlParams.get("scholarshipId") ||
      urlParams.get("scholId") ||
      urlParams.get("postId") ||
      urlParams.get("id");
    if (targetId) {
      setTimeout(() => {
        openPostApplicantsView(targetId);
      }, 150);
    }

    // Live sync polling every 3.5 seconds
    setInterval(() => {
      if (!isModalOpen) {
        loadData(true);
      }
    }, 3500);

    // Refresh when window regains focus
    window.addEventListener("focus", () => {
      if (!isModalOpen) loadData(true);
    });
  });

  function cacheDOM() {
    postsListViewEl = document.getElementById("posts-list-view");
    postApplicantsViewEl = document.getElementById("post-applicants-view");

    postsFeedEl = document.getElementById("posts-feed");
    postsEmptyStateEl = document.getElementById("posts-empty-state");
    postSearchInputEl = document.getElementById("posts-search-input");
    postsCountLabelEl = document.getElementById("posts-count-label");

    postApplicantsFeedEl = document.getElementById("post-applicants-feed");
    postApplicantsEmptyEl = document.getElementById("post-applicants-empty-state");
    appSearchInputEl = document.getElementById("applicant-search-input");

    scholModalEl = document.getElementById("view-details-modal");
    reviewModalEl = document.getElementById("review-application-modal");
    confirmModalEl = document.getElementById("decision-confirm-modal");
    docPreviewModalEl = document.getElementById("doc-preview-modal");

    // Back button from applicants view to posts list
    const btnBackToPosts = document.getElementById("btn-back-to-posts");
    if (btnBackToPosts) {
      btnBackToPosts.addEventListener("click", backToPostsList);
    }

    // Criteria button inside active post detail card
    const btnViewCriteria = document.getElementById("btn-view-post-criteria");
    if (btnViewCriteria) {
      btnViewCriteria.addEventListener("click", () => {
        if (currentActivePost) {
          const apps = getPostApplications(currentActivePost);
          const limit = parseInt(currentActivePost.applicantLimit || 200, 10) || 200;
          openScholarshipModal(currentActivePost, apps.length, limit);
        }
      });
    }
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

  function escapeHtml(text) {
    if (text === null || text === undefined) return "";
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatScholarshipType(schol) {
    if (!schol) return "General";
    if (schol.typeText && String(schol.typeText).trim()) return String(schol.typeText).trim();
    const raw = String(schol.type || "").trim().toLowerCase();
    if (raw === "merit" || raw === "merit-based") return "Merit-Based";
    if (raw === "need" || raw === "need-based") return "Need-Based";
    if (raw === "athletic") return "Athletic";
    if (raw === "academic") return "Academic";
    if (raw === "special") return "Special";
    if (raw) return raw.charAt(0).toUpperCase() + raw.slice(1);
    return "General";
  }

  function resolveProviderBanner(schol) {
    if (!schol) return "";
    if (schol.bannerImage && String(schol.bannerImage).trim()) {
      return String(schol.bannerImage).trim();
    }
    if (schol.banner && String(schol.banner).trim()) {
      return String(schol.banner).trim();
    }

    let settings = null;
    try {
      const cached = localStorage.getItem("nexo_provider_settings");
      if (cached) settings = JSON.parse(cached);
    } catch (_) {}

    const activeOrgName =
      (settings && settings.orgName) ||
      localStorage.getItem("nexo-provider-name") ||
      "NEXO";
    const itemOrg = (schol && schol.providerName ? schol.providerName.trim() : "");
    if (!itemOrg || itemOrg.toLowerCase() === activeOrgName.toLowerCase() || itemOrg.toLowerCase() === "nexo") {
      const settingsBanner =
        (settings && settings.bannerImage) ||
        localStorage.getItem("nexo-provider-banner") ||
        localStorage.getItem("provider-banner-preview") ||
        "";
      if (settingsBanner && String(settingsBanner).trim()) {
        return String(settingsBanner).trim();
      }
    }
    return "";
  }

  function resolveProviderLogo(schol) {
    if (!schol) return "";
    if (schol.providerLogo && String(schol.providerLogo).trim()) {
      return String(schol.providerLogo).trim();
    }
    if (schol.logoImage && String(schol.logoImage).trim()) {
      return String(schol.logoImage).trim();
    }
    if (schol.logo && String(schol.logo).trim()) {
      return String(schol.logo).trim();
    }

    let settings = null;
    try {
      const cached = localStorage.getItem("nexo_provider_settings");
      if (cached) settings = JSON.parse(cached);
    } catch (_) {}

    const activeOrgName =
      (settings && settings.orgName) ||
      localStorage.getItem("nexo-provider-name") ||
      "NEXO";
    const itemOrg = (schol && schol.providerName ? schol.providerName.trim() : "");
    if (!itemOrg || itemOrg.toLowerCase() === activeOrgName.toLowerCase() || itemOrg.toLowerCase() === "nexo") {
      const settingsLogo =
        (settings && settings.logoImage) ||
        localStorage.getItem("nexo-provider-logo") ||
        "";
      if (settingsLogo && String(settingsLogo).trim()) {
        return String(settingsLogo).trim();
      }
    }
    return "";
  }

  function extractInitials(name) {
    if (!name || !name.trim()) return "NX";
    const clean = name.trim();
    if (clean.toUpperCase().startsWith("NEXO")) return "NX";
    const parts = clean.split(/\s+/);
    if (parts.length === 1) return parts[0].length > 1 ? parts[0].substring(0, 2).toUpperCase() : parts[0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
        if (data.studentProfiles) { studentProfiles = data.studentProfiles; try { localStorage.setItem("nexo_student_profiles", JSON.stringify(studentProfiles)); } catch(_) {} }
        if (Array.isArray(data.users)) users = data.users;
        if (data.studentSettings) studentSettings = data.studentSettings;

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

    // Synchronize with portal scholarships (matches provider-dashboard.html)
    allScholarships = scholarships;

    allApplications = applications;

    // Refresh active post object if currently viewing applicants
    if (currentActivePost) {
      const updatedPost = allScholarships.find(
        (s) => String(s.id) === String(currentActivePost.id),
      );
      if (updatedPost) currentActivePost = updatedPost;
    }

    updatePostTabCounters();

    // Check if deep-linking directly to a specific post via URL
    if (!currentActivePost) {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const deepLinkId =
          urlParams.get("scholarshipId") ||
          urlParams.get("scholId") ||
          urlParams.get("postId") ||
          urlParams.get("id");
        if (deepLinkId) {
          openPostApplicantsView(deepLinkId);
        }
      } catch (_) {}
    }

    if (currentActivePost && postApplicantsViewEl && postApplicantsViewEl.style.display !== "none") {
      renderActivePostHeader(currentActivePost);
      renderPostApplicantsFeed();
    } else {
      renderPostsFeed();
    }
  }

  // =============================================================
  // VIEW 1: POSTED SCHOLARSHIPS LIST LOGIC
  // =============================================================
  function updatePostFilterUI(activeStatus) {
    const filterBtn = document.getElementById("btn-posts-filter");
    const filterMenu = document.getElementById("menu-posts-filter");
    if (filterBtn) {
      filterBtn.classList.toggle("is-filtered", activeStatus !== "all");
      const statusMap = {
        all: "Status",
        open: "Active / Open",
        closed: "Closed",
      };
      const titleStr = statusMap[activeStatus] || "Status";
      filterBtn.title = activeStatus === "all" ? "Filter by status" : `Filter: ${titleStr}`;
    }
    if (filterMenu) {
      filterMenu.querySelectorAll(".directory-dropdown-item").forEach((item) => {
        item.classList.toggle("active", (item.dataset.filter || "all") === activeStatus);
      });
    }
    const tabs = document.querySelectorAll(".posts-tab");
    tabs.forEach((tab) => {
      tab.classList.toggle("active", (tab.dataset.filter || "all") === activeStatus);
    });
  }

  function initPostsFilters() {
    if (postSearchInputEl) {
      postSearchInputEl.addEventListener("input", (e) => {
        postSearchQuery = e.target.value.trim().toLowerCase();
        renderPostsFeed();
      });
    }

    const filterBtn = document.getElementById("btn-posts-filter");
    const filterMenu = document.getElementById("menu-posts-filter");
    const filterWrapper = document.getElementById("dropdown-wrapper-posts-filter");

    if (filterBtn && filterMenu) {
      filterBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = filterMenu.classList.contains("show");
        filterMenu.classList.toggle("show", !isOpen);
        filterBtn.setAttribute("aria-expanded", String(!isOpen));
        if (filterWrapper) filterWrapper.classList.toggle("is-open", !isOpen);
      });

      filterMenu.querySelectorAll(".directory-dropdown-item").forEach((item) => {
        item.addEventListener("click", function (e) {
          e.stopPropagation();
          postFilterTab = this.dataset.filter || "all";
          updatePostFilterUI(postFilterTab);
          filterMenu.classList.remove("show");
          filterBtn.setAttribute("aria-expanded", "false");
          if (filterWrapper) filterWrapper.classList.remove("is-open");
          renderPostsFeed();
        });
      });

      document.addEventListener("click", (e) => {
        if (!filterMenu.contains(e.target) && !filterBtn.contains(e.target)) {
          filterMenu.classList.remove("show");
          filterBtn.setAttribute("aria-expanded", "false");
          if (filterWrapper) filterWrapper.classList.remove("is-open");
        }
      });
    }

    const tabs = document.querySelectorAll(".posts-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", function () {
        tabs.forEach((t) => t.classList.remove("active"));
        this.classList.add("active");
        postFilterTab = this.dataset.filter || "all";
        updatePostFilterUI(postFilterTab);
        renderPostsFeed();
      });
    });

    // Check URL parameter for initial filter
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlFilter = (urlParams.get("filter") || "").toLowerCase();
      if (urlFilter === "open" || urlFilter === "closed" || urlFilter === "all") {
        postFilterTab = urlFilter;
        updatePostFilterUI(urlFilter);
      }
    } catch (_) {}
  }

  function updatePostTabCounters() {
    let total = allScholarships.length;
    let openCount = 0;
    let closedCount = 0;

    allScholarships.forEach((s) => {
      const status = (s.status || "Open").toLowerCase();
      if (status === "closed") closedCount++;
      else openCount++;
    });

    // Dropdown badges
    const countAll = document.getElementById("filter-count-all");
    const countOpen = document.getElementById("filter-count-open");
    const countClosed = document.getElementById("filter-count-closed");

    if (countAll) countAll.textContent = String(total);
    if (countOpen) countOpen.textContent = String(openCount);
    if (countClosed) countClosed.textContent = String(closedCount);

    // Tab buttons if present
    const tabAll = document.getElementById("tab-posts-all");
    const tabOpen = document.getElementById("tab-posts-open");
    const tabClosed = document.getElementById("tab-posts-closed");

    if (tabAll) tabAll.textContent = `All (${total})`;
    if (tabOpen) tabOpen.textContent = `Active / Open (${openCount})`;
    if (tabClosed) tabClosed.textContent = `Closed (${closedCount})`;
  }

  function renderPostsFeed() {
    if (!postsFeedEl || !postsEmptyStateEl) return;

    // Filter by status tab
    let filtered = allScholarships.filter((s) => {
      const status = (s.status || "Open").toLowerCase();
      if (postFilterTab === "open") return status !== "closed";
      if (postFilterTab === "closed") return status === "closed";
      return true;
    });

    // Filter by search query
    if (postSearchQuery) {
      filtered = filtered.filter((s) => {
        const title = String(s.title || "").toLowerCase();
        const type = String(s.type || s.typeText || "").toLowerCase();
        const desc = String(s.desc || "").toLowerCase();
        const provider = String(s.providerName || "").toLowerCase();

        return (
          title.includes(postSearchQuery) ||
          type.includes(postSearchQuery) ||
          desc.includes(postSearchQuery) ||
          provider.includes(postSearchQuery)
        );
      });
    }

    if (postsCountLabelEl) {
      postsCountLabelEl.textContent = `Showing ${filtered.length} scholarship${filtered.length === 1 ? "" : "s"}`;
    }

    // Anti-flicker diff signature
    const currentSig = JSON.stringify(
      filtered.map((s) => {
        const apps = getPostApplications(s);
        return {
          id: s.id,
          title: s.title,
          status: s.status,
          appCount: apps.length,
          deadline: s.formattedDate || s.deadline,
        };
      }),
    );

    if (lastPostsSig === currentSig) return;
    lastPostsSig = currentSig;

    if (allScholarships.length === 0) {
      postsFeedEl.style.display = "none";
      postsFeedEl.innerHTML = "";
      postsEmptyStateEl.style.display = "block";
      const title = postsEmptyStateEl.querySelector("h3");
      const desc = postsEmptyStateEl.querySelector("p");
      if (title) title.textContent = "No Posted Scholarships Yet";
      if (desc)
        desc.textContent =
          "You haven't posted any scholarship opportunities yet. Create a new scholarship to start receiving student applications.";
      return;
    }

    if (filtered.length === 0) {
      postsFeedEl.style.display = "none";
      postsFeedEl.innerHTML = "";
      postsEmptyStateEl.style.display = "block";
      const title = postsEmptyStateEl.querySelector("h3");
      const desc = postsEmptyStateEl.querySelector("p");
      if (title) title.textContent = "No Matching Scholarships";
      if (desc)
        desc.textContent =
          "No posted scholarships matched your search criteria. Try a different search term or filter.";
      return;
    }

    postsEmptyStateEl.style.display = "none";
    postsFeedEl.style.display = "flex";
    postsFeedEl.innerHTML = "";

    filtered.forEach((schol) => {
      postsFeedEl.appendChild(createPostCard(schol));
    });
  }

  function getApplicationTimestamp(app) {
    if (!app) return 0;
    const candidates = [
      app.submittedAt,
      app.appliedAt,
      app.createdAt,
      app.submissionDate,
      app.date,
    ];
    for (const c of candidates) {
      if (c) {
        const t = new Date(c).getTime();
        if (!isNaN(t) && t > 0) return t;
      }
    }
    return 0;
  }

  function getPostApplications(schol) {
    if (!schol) return [];
    const targetId = String(schol.id || "").trim();
    const targetTitle = String(schol.title || "").trim().toLowerCase();

    const related = allApplications.filter((app) => {
      if (app.scholarshipId && targetId && String(app.scholarshipId).trim() === targetId) {
        return true;
      }
      const appScholTitle = String(app.scholarshipTitle || app.title || "").trim().toLowerCase();
      if (targetTitle && appScholTitle && appScholTitle === targetTitle) {
        return true;
      }
      return false;
    });

    // Sort strictly First-Come, First-Served: earliest application submission timestamp first
    related.sort((a, b) => {
      const timeA = getApplicationTimestamp(a);
      const timeB = getApplicationTimestamp(b);
      if (timeA && timeB && timeA !== timeB) return timeA - timeB;
      if (timeA && !timeB) return -1;
      if (!timeA && timeB) return 1;
      return String(a.id || "").localeCompare(String(b.id || ""));
    });

    return related;
  }

  function createPostCard(schol) {
    const card = document.createElement("div");
    card.className = "post-card";
    card.dataset.id = schol.id || "";

    const relatedApps = getPostApplications(schol);
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

    const providerName = schol.providerName || "NEXO Provider";
    const deadlineText = schol.formattedDate || schol.deadline || "No Deadline";
    const postedDate = schol.formattedPostedDate || schol.postedDate || "Recently";
    const typeText = formatScholarshipType(schol);

    card.innerHTML = `
      <div class="post-card-header" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; width: 100%;">
        <div class="post-card-title-group" style="flex: 1; min-width: 0;">
          <h3 class="post-title-text">${escapeHtml(schol.title || "Untitled Scholarship")}</h3>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
          <span class="directory-type-pill">${escapeHtml(typeText)}</span>
          <span class="post-status-badge ${statusClass}">${statusText}</span>
        </div>
      </div>

      <p class="post-desc">${escapeHtml(schol.desc || "No description provided.")}</p>

      <div class="post-meta-row" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px 16px; margin: 2px 0;">
        <div class="directory-dates-row" style="display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--text-secondary); flex-wrap: wrap;">
          <span class="directory-date-item" style="display: inline-flex; align-items: center; gap: 5px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 14 14"></polyline>
            </svg>
            <span>Posted: <strong style="color: var(--text-primary);">${escapeHtml(postedDate)}</strong></span>
          </span>
          <span class="directory-date-dot" style="opacity: 0.45; font-size: 11px;">&bull;</span>
          <span class="directory-date-item" style="display: inline-flex; align-items: center; gap: 5px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span>Deadline: <strong style="color: var(--text-primary);">${escapeHtml(deadlineText)}</strong></span>
          </span>
        </div>

        <span class="directory-applicants-tag" style="display: inline-flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 700; color: #8b5cf6;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <span>${totalApps} / ${limit} Applicants</span>
        </span>
      </div>

      <div class="post-breakdown-row">
        <span class="post-breakdown-pill review">Under Review: ${underReviewCount}</span>
        <span class="post-breakdown-pill approved">Approved: ${approvedCount}</span>
        <span class="post-breakdown-pill rejected">Rejected: ${rejectedCount}</span>
        ${pendingCount > 0 ? `<span class="post-breakdown-pill">Pending: ${pendingCount}</span>` : ""}
      </div>

      <div class="post-actions-row">
        <button
          type="button"
          class="btn-view-apps btn-trigger-view-apps"
          data-id="${escapeHtml(schol.id || schol.title)}"
          title="View and manage applicants specifically for this post"
        >
          <span>View Applications</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
        <button
          type="button"
          class="directory-view-details-btn view-details-btn btn-view-details-sub"
          aria-label="View Details"
        >
          View Details
        </button>
      </div>
    `;

    // View Applications listener (switches to View 2 in-page!)
    const viewAppsBtn = card.querySelector(".btn-trigger-view-apps");
    if (viewAppsBtn) {
      viewAppsBtn.addEventListener("click", () => {
        openPostApplicantsView(schol.id || schol.title);
      });
    }

    // View Details modal listener
    const viewDetailsBtn = card.querySelector(".btn-view-details-sub");
    if (viewDetailsBtn) {
      viewDetailsBtn.addEventListener("click", () => {
        openScholarshipModal(schol, totalApps, limit);
      });
    }

    return card;
  }

  // =============================================================
  // VIEW 2: POST APPLICANTS MANAGEMENT LOGIC
  // =============================================================
  function updateApplicantFilterUI(activeFilter) {
    const filterBtn = document.getElementById("btn-applicant-filter");
    const filterMenu = document.getElementById("menu-applicant-filter");
    if (filterBtn) {
      filterBtn.classList.toggle("is-filtered", activeFilter !== "all");
      const labelMap = {
        all: "All Applicants",
        submitted: "Submitted",
        under_review: "Under Review",
        approved: "Approved",
        rejected: "Rejected",
      };
      const titleStr = labelMap[activeFilter] || "All Applicants";
      filterBtn.title = activeFilter === "all" ? "Filter applicants by status" : `Filter: ${titleStr}`;
    }
    if (filterMenu) {
      filterMenu.querySelectorAll(".directory-dropdown-item").forEach((item) => {
        item.classList.toggle("active", (item.dataset.applicantFilter || "all") === activeFilter);
      });
    }
  }

  function initApplicantFilters() {
    if (appSearchInputEl) {
      appSearchInputEl.addEventListener("input", (e) => {
        appSearchQuery = e.target.value.trim().toLowerCase();
        renderPostApplicantsFeed();
      });
    }

    const filterBtn = document.getElementById("btn-applicant-filter");
    const filterMenu = document.getElementById("menu-applicant-filter");
    const filterWrapper = document.getElementById("dropdown-wrapper-applicant-filter");

    if (filterBtn && filterMenu) {
      filterBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = filterMenu.classList.contains("show");
        const postsMenu = document.getElementById("menu-posts-filter");
        if (postsMenu) postsMenu.classList.remove("show");

        filterMenu.classList.toggle("show", !isOpen);
        filterBtn.setAttribute("aria-expanded", String(!isOpen));
        if (filterWrapper) filterWrapper.classList.toggle("is-open", !isOpen);
      });

      filterMenu.querySelectorAll(".directory-dropdown-item").forEach((item) => {
        item.addEventListener("click", function (e) {
          e.stopPropagation();
          const selected = this.dataset.applicantFilter || "all";
          appFilterTab = selected;
          updateApplicantFilterUI(selected);
          filterMenu.classList.remove("show");
          filterBtn.setAttribute("aria-expanded", "false");
          if (filterWrapper) filterWrapper.classList.remove("is-open");
          renderPostApplicantsFeed();
        });
      });

      document.addEventListener("click", (e) => {
        if (!filterMenu.contains(e.target) && !filterBtn.contains(e.target)) {
          filterMenu.classList.remove("show");
          filterBtn.setAttribute("aria-expanded", "false");
          if (filterWrapper) filterWrapper.classList.remove("is-open");
        }
      });
    }
  }

  function openPostApplicantsView(scholId) {
    if (!scholId) return;
    const cleanId = String(scholId).trim().toLowerCase();
    const target = allScholarships.find(
      (s) =>
        String(s.id || "").trim().toLowerCase() === cleanId ||
        String(s.title || "").trim().toLowerCase() === cleanId,
    );
    if (!target) return;

    currentActivePost = target;
    appFilterTab = "all";
    appSearchQuery = "";
    if (appSearchInputEl) appSearchInputEl.value = "";
    updateApplicantFilterUI("all");

    if (postsListViewEl) postsListViewEl.style.display = "none";
    if (postApplicantsViewEl) postApplicantsViewEl.style.display = "block";

    renderActivePostHeader(target);
    renderPostApplicantsFeed();

    try {
      window.history.replaceState(
        {},
        "",
        `provider-posts.html?scholarshipId=${encodeURIComponent(target.id || target.title)}`,
      );
    } catch (_) {}

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function backToPostsList() {
    currentActivePost = null;
    if (postApplicantsViewEl) postApplicantsViewEl.style.display = "none";
    if (postsListViewEl) postsListViewEl.style.display = "block";

    try {
      window.history.replaceState({}, "", "provider-posts.html");
    } catch (_) {}

    lastPostsSig = null; // force re-render
    renderPostsFeed();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderActivePostHeader(schol) {
    const titleEl = document.getElementById("post-view-title");
    const statusPill = document.getElementById("post-view-status-pill");
    const typeEl = document.getElementById("post-view-type");
    const deadlineEl = document.getElementById("post-view-deadline");
    const appsCountEl = document.getElementById("post-view-applicants");

    const relatedApps = getPostApplications(schol);
    const limit = parseInt(schol.applicantLimit || schol.maxApplicants || 200, 10) || 200;
    const isOpen = (schol.status || "Open").toLowerCase() !== "closed";

    if (titleEl) titleEl.textContent = schol.title || "Untitled Scholarship";
    if (statusPill) {
      statusPill.className = `post-status-badge ${isOpen ? "open" : "closed"}`;
      statusPill.textContent = isOpen ? "Open" : "Closed";
    }
    if (typeEl) typeEl.textContent = formatScholarshipType(schol);
    if (deadlineEl) deadlineEl.textContent = schol.formattedDate || schol.deadline || "No Deadline";
    if (appsCountEl) appsCountEl.textContent = `${relatedApps.length} / ${limit} Applicants`;
  }

  function renderPostApplicantsFeed() {
    if (!postApplicantsFeedEl || !postApplicantsEmptyEl || !currentActivePost) return;

    const baseApps = getPostApplications(currentActivePost);

    // Update Dropdown Badge Counters for this post
    let countAll = baseApps.length;
    let countSubmitted = 0;
    let countReviewed = 0;
    let countApproved = 0;
    let countRejected = 0;

    baseApps.forEach((app) => {
      const st = (app.status || "Submitted").toLowerCase();
      if (st.includes("approved")) countApproved++;
      else if (st.includes("review")) countReviewed++;
      else if (st.includes("rejected")) countRejected++;
      else countSubmitted++;
    });

    const cntAll = document.getElementById("app-filter-count-all");
    const cntSubmitted = document.getElementById("app-filter-count-submitted");
    const cntReview = document.getElementById("app-filter-count-review");
    const cntApproved = document.getElementById("app-filter-count-approved");
    const cntRejected = document.getElementById("app-filter-count-rejected");

    if (cntAll) cntAll.textContent = countAll;
    if (cntSubmitted) cntSubmitted.textContent = countSubmitted;
    if (cntReview) cntReview.textContent = countReviewed;
    if (cntApproved) cntApproved.textContent = countApproved;
    if (cntRejected) cntRejected.textContent = countRejected;

    // Filter by tab
    let filtered = baseApps.filter((app) => {
      const st = (app.status || "Submitted").toLowerCase();
      if (appFilterTab === "all") return true;
      if (appFilterTab === "submitted") {
        return (
          !st.includes("approved") &&
          !st.includes("review") &&
          !st.includes("rejected")
        );
      }
      if (appFilterTab === "under_review") return st.includes("review");
      if (appFilterTab === "approved") return st.includes("approved");
      if (appFilterTab === "rejected") return st.includes("rejected");
      return true;
    });

    // Filter by search query
    if (appSearchQuery) {
      filtered = filtered.filter((app) => {
        const studentName = String(app.studentName || "").toLowerCase();
        const studentEmail = String(app.studentEmail || "").toLowerCase();
        const studentId = String(app.studentId || "").toLowerCase();
        const course = String(app.course || "").toLowerCase();

        return (
          studentName.includes(appSearchQuery) ||
          studentEmail.includes(appSearchQuery) ||
          studentId.includes(appSearchQuery) ||
          course.includes(appSearchQuery)
        );
      });
    }

    // Empty state handling
    if (baseApps.length === 0) {
      postApplicantsFeedEl.style.display = "none";
      postApplicantsFeedEl.innerHTML = "";
      postApplicantsEmptyEl.style.display = "block";
      const title = document.getElementById("post-apps-empty-title");
      const desc = document.getElementById("post-apps-empty-desc");
      if (title) title.textContent = "No Applicants Yet";
      if (desc)
        desc.textContent = `No student applications have been submitted for "${currentActivePost.title}" yet. As soon as students apply, their submissions will be listed here in first-come, first-served order.`;
      return;
    }

    if (filtered.length === 0) {
      postApplicantsFeedEl.style.display = "none";
      postApplicantsFeedEl.innerHTML = "";
      postApplicantsEmptyEl.style.display = "block";
      const title = document.getElementById("post-apps-empty-title");
      const desc = document.getElementById("post-apps-empty-desc");
      if (title) title.textContent = "No Matching Applicants";
      if (desc)
        desc.textContent =
          "Try clearing your search query or switching filters to view other applicants for this post.";
      return;
    }

    postApplicantsEmptyEl.style.display = "none";
    postApplicantsFeedEl.style.display = "flex";
    postApplicantsFeedEl.innerHTML = "";

    filtered.forEach((app) => {
      // Find original queue index among all baseApps for FCFS display
      const queueIndex = baseApps.indexOf(app) + 1;
      postApplicantsFeedEl.appendChild(createApplicantCard(app, queueIndex));
    });
  }

  function createApplicantCard(app, queueNumber) {
    const card = document.createElement("div");
    card.className = "provider-app-card";
    card.dataset.id = app.id || "";

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
    const studentName = info.fullName;
    const initials =
      studentName
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0] || "")
        .join("")
        .toUpperCase() || "ST";

    const avatar = info.profilePicture;

    const formattedAppliedDate =
      app.formattedDate ||
      (app.submittedAt
        ? new Date(app.submittedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "Recently Applied");

    card.innerHTML = `
      <div class="provider-app-main-row">
        <div class="provider-app-avatar">
          ${
            avatar
              ? `<img src="${avatar}" alt="${escapeHtml(studentName)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" />`
              : escapeHtml(initials)
          }
        </div>

        <div class="provider-app-details" style="flex: 1; min-width: 0;">
          <div class="provider-app-header-line" style="display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 4px;">
            <h3 class="provider-app-student-name" style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0;">${escapeHtml(studentName)}</h3>
            <span class="provider-app-badge ${badgeClass}">${escapeHtml(badgeText)}</span>
          </div>

          <!-- Hierarchy: Course prominently displayed -->
          <div class="provider-app-course" style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 2px 0 8px; line-height: 1.35;">
            ${escapeHtml(info.course || "Degree Candidate")}
          </div>

          <!-- Clean aligned details with consistent icons and NO bullets -->
          <div class="provider-app-meta-row" style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px 18px; font-size: 12.5px; color: var(--text-secondary);">
            <div class="provider-app-meta-item" style="display: inline-flex; align-items: center; gap: 6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.75; flex-shrink: 0;">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
              </svg>
              <span>Year: <strong style="color: var(--text-primary); font-weight: 600;">${escapeHtml(info.yearLevel || "Undergraduate")}</strong></span>
            </div>

            <div class="provider-app-meta-item" style="display: inline-flex; align-items: center; gap: 6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.75; flex-shrink: 0;">
                <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"></path>
              </svg>
              <span>University: <strong style="color: var(--text-primary); font-weight: 600;">${escapeHtml(info.university || "Batangas State University")}</strong></span>
            </div>

            <div class="provider-app-meta-item" style="display: inline-flex; align-items: center; gap: 6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.75; flex-shrink: 0;">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span>Applied: <strong style="color: var(--text-primary); font-weight: 600;">${escapeHtml(formattedAppliedDate)}</strong></span>
            </div>
          </div>
        </div>
      </div>

      <div class="provider-app-actions-row" style="margin-top: 14px; width: 100%;">
        <button type="button" class="btn btn-primary btn-review-app">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          Review Application
        </button>
      </div>
    `;

    card.querySelector(".btn-review-app").addEventListener("click", (e) => {
      e.stopPropagation();
      openReviewModal(app);
    });

    card.addEventListener("click", () => {
      openReviewModal(app);
    });

    return card;
  }

  // =============================================================
  // MODALS INITIALIZATION & HANDLING
  // =============================================================
  function initModals() {
    // 1. Scholarship Criteria Modal
    const closeScholBtn = document.getElementById("close-details-btn");
    const closeScholActionBtn = document.getElementById("view-modal-close-action-btn");

    const closeScholModal = () => {
      if (scholModalEl) {
        scholModalEl.classList.remove("active");
        scholModalEl.setAttribute("aria-hidden", "true");
        if (!isModalOpen) document.body.style.overflow = "auto";
      }
    };
    window.closeScholarshipModal = closeScholModal;

    if (closeScholBtn) closeScholBtn.addEventListener("click", closeScholModal);
    if (closeScholActionBtn) closeScholActionBtn.addEventListener("click", closeScholModal);
    if (scholModalEl) {
      scholModalEl.addEventListener("click", (e) => {
        if (e.target === scholModalEl) closeScholModal();
      });
    }

    // Keyboard Escape listener for modals
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (docPreviewModalEl && docPreviewModalEl.classList.contains("active")) {
          closeDocPreview();
        } else if (confirmModalEl && confirmModalEl.classList.contains("active")) {
          closeDecisionConfirmModal();
        } else if (scholModalEl && scholModalEl.classList.contains("active")) {
          closeScholModal();
        } else if (reviewModalEl && reviewModalEl.classList.contains("active")) {
          closeReviewModal();
        } else if (postApplicantsViewEl && postApplicantsViewEl.style.display !== "none") {
          backToPostsList();
        }
      }
    });

    // 2. Review Application Modal
    const closeReviewBtn = document.getElementById("close-review-modal");
    if (closeReviewBtn) closeReviewBtn.addEventListener("click", closeReviewModal);
    const closeReviewBottomBtn = document.getElementById("modal-btn-close-bottom");
    if (closeReviewBottomBtn) closeReviewBottomBtn.addEventListener("click", closeReviewModal);
    if (reviewModalEl) {
      reviewModalEl.addEventListener("click", (e) => {
        if (e.target === reviewModalEl) closeReviewModal();
      });
    }

    // Decision status buttons inside review modal
    const btnApprove = document.getElementById("modal-btn-approve");
    const btnUnderReview = document.getElementById("modal-btn-review");
    const btnReject = document.getElementById("modal-btn-reject");

    if (btnApprove) btnApprove.addEventListener("click", () => openDecisionConfirmModal("Approved"));
    if (btnUnderReview) btnUnderReview.addEventListener("click", () => openDecisionConfirmModal("Under Review"));
    if (btnReject) btnReject.addEventListener("click", () => openDecisionConfirmModal("Rejected"));

    // Save notes button
    const btnSaveNotes = document.getElementById("modal-btn-save-notes");
    if (btnSaveNotes) {
      btnSaveNotes.addEventListener("click", async () => {
        if (!currentActiveApp) return;

        if (currentActiveApp.status === "Approved" || currentActiveApp.status === "Rejected") {
          showToast("This decision has already been finalized and cannot be modified.", true);
          return;
        }

        const notesInput = document.getElementById("modal-review-notes");
        const errEl = document.getElementById("modal-save-notes-error");
        const notes = notesInput ? notesInput.value.trim() : "";

        if (!notes) {
          if (errEl) {
            errEl.textContent = "Feedback cannot be empty. Please enter notes or feedback before saving.";
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

        const successBanner = document.getElementById("modal-feedback-success-banner");
        const successMsg = document.getElementById("modal-feedback-success-msg");
        if (successBanner && successMsg) {
          successMsg.textContent = "Notes and feedback were successfully updated and dispatched to the student's portal!";
          successBanner.style.display = "block";
          const container = reviewModalEl.querySelector(".nexo-modal-container");
          if (container) container.scrollTo({ top: 0, behavior: "smooth" });
        }
      });
    }

    // 3. Confirmation Modal
    initDecisionConfirmModal();

    // 4. Document Preview Modal
    const closeDocBtn = document.getElementById("close-doc-preview");
    if (closeDocBtn) closeDocBtn.addEventListener("click", closeDocPreview);
    if (docPreviewModalEl) {
      docPreviewModalEl.addEventListener("click", (e) => {
        if (e.target === docPreviewModalEl) closeDocPreview();
      });
    }

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
  }

  function openScholarshipModal(schol, totalApps, limit) {
    if (!scholModalEl || !schol) return;

    const titleEl = document.getElementById("view-modal-title");
    const typeEl = document.getElementById("view-modal-type");
    const statusEl = document.getElementById("view-modal-status");
    const providerEl = document.getElementById("view-modal-provider");
    const dateEl = document.getElementById("view-modal-date");
    const postedEl = document.getElementById("view-modal-posted");
    const applicantsEl = document.getElementById("view-modal-applicants");
    const descEl = document.getElementById("view-modal-desc");
    const reqsEl = document.getElementById("view-modal-reqs");
    const coverImg = document.getElementById("view-modal-cover-img");
    const logoEl = document.getElementById("view-modal-schol-logo");
    const manageBtn = document.getElementById("view-modal-manage-btn");

    if (titleEl) titleEl.textContent = schol.title || "Scholarship Program";

    const orgName =
      schol.organization ||
      schol.providerName ||
      localStorage.getItem("nexo-provider-name") ||
      "NEXO";
    if (providerEl) providerEl.textContent = orgName;

    // Type & Status
    const formattedType = formatScholarshipType(schol);
    if (typeEl) typeEl.textContent = formattedType;

    const isClosed =
      String(schol.status || "").toLowerCase().includes("closed") ||
      String(schol.status || "").toLowerCase().includes("quota");
    if (statusEl) {
      statusEl.textContent = isClosed ? "Closed" : "Active";
      statusEl.style.background = isClosed
        ? "rgba(239, 68, 68, 0.12)"
        : "rgba(16, 185, 129, 0.12)";
      statusEl.style.color = isClosed ? "#ef4444" : "#10b981";
    }

    // Dates
    const deadlineText = schol.formattedDate || schol.deadline || "No Deadline";
    const postedDate = schol.formattedPostedDate || schol.postedDate || "Recently";
    if (dateEl) dateEl.textContent = deadlineText;
    if (postedEl) postedEl.textContent = postedDate;

    // Live applicant count
    const relatedApps = getPostApplications(schol);
    const actualCount =
      typeof totalApps === "number" ? totalApps : relatedApps.length;
    const capacityLimit =
      typeof limit === "number"
        ? limit
        : parseInt(schol.applicantLimit || schol.maxApplicants || 200, 10) ||
          200;

    if (applicantsEl) {
      applicantsEl.textContent = `${actualCount} / ${capacityLimit} Applicants`;
    }

    // Description
    if (descEl) descEl.textContent = schol.desc || "No description provided.";

    // Cover image banner
    const bannerSrc = resolveProviderBanner(schol);
    if (coverImg) {
      if (bannerSrc && typeof bannerSrc === "string" && bannerSrc.trim()) {
        coverImg.src = bannerSrc.trim();
        coverImg.style.display = "block";
      } else {
        coverImg.src = "";
        coverImg.style.display = "none";
      }
      coverImg.onerror = function () {
        this.style.display = "none";
        this.src = "";
      };
    }

    // Provider Avatar / Logo
    const logoSrc = resolveProviderLogo(schol);
    if (logoEl) {
      if (logoSrc && typeof logoSrc === "string" && logoSrc.trim()) {
        logoEl.innerHTML = `<img src="${logoSrc.trim()}" alt="Logo" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;">`;
      } else {
        const inits = extractInitials(orgName);
        logoEl.textContent = inits || "NX";
      }
    }

    // Required Documents Checklist (Matches Student POV)
    if (reqsEl) {
      reqsEl.innerHTML = "";
      const reqs =
        Array.isArray(schol.requirements) && schol.requirements.length > 0
          ? schol.requirements
          : [
              "Certificate of Registration (COR)",
              "Certified True Copy of Grades (COG)",
              "Valid School or Government Issued ID",
            ];
      reqs.forEach((r) => {
        const rName =
          typeof r === "string" ? r : r.name || r.title || "Required Document";
        const rDesc =
          typeof r === "object" && r !== null && r.desc
            ? `<span style="font-size: 12px; color: var(--text-secondary); display: block; margin-top: 2px;">${escapeHtml(r.desc)}</span>`
            : "";
        const rItem = document.createElement("div");
        rItem.className = "details-checklist-item";
        rItem.innerHTML = `
          <span style="font-weight: 650; color: var(--text-primary); font-size: 13.5px;">${escapeHtml(rName)}</span>
          ${rDesc}
        `;
        reqsEl.appendChild(rItem);
      });
    }

    // Manage Applications Button Action
    if (manageBtn) {
      if (actualCount === 0) {
        manageBtn.disabled = true;
        manageBtn.setAttribute("disabled", "true");
        manageBtn.setAttribute("aria-disabled", "true");
        manageBtn.style.opacity = "0.55";
        manageBtn.style.cursor = "not-allowed";
        manageBtn.style.pointerEvents = "auto";
        manageBtn.title = "No students have applied to this scholarship yet";
        manageBtn.innerHTML = `
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <span>No Applications Yet</span>
        `;
        manageBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
        };
      } else {
        manageBtn.disabled = false;
        manageBtn.removeAttribute("disabled");
        manageBtn.setAttribute("aria-disabled", "false");
        manageBtn.style.opacity = "1";
        manageBtn.style.cursor = "pointer";
        manageBtn.style.pointerEvents = "auto";
        manageBtn.title = `Manage ${actualCount} application${actualCount > 1 ? "s" : ""} for this post`;
        manageBtn.innerHTML = `
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <span id="view-modal-manage-text">Manage Applications for this post</span>
        `;
        manageBtn.onclick = () => {
          if (typeof closeScholarshipModal === "function") {
            closeScholarshipModal();
          } else if (scholModalEl) {
            scholModalEl.classList.remove("active");
            scholModalEl.setAttribute("aria-hidden", "true");
            document.body.style.overflow = "auto";
          }
          openPostApplicantsView(schol.id || schol.title);
        };
      }
    }

    scholModalEl.classList.add("active");
    scholModalEl.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function initDecisionConfirmModal() {
    if (!confirmModalEl) return;

    const closeBtn = document.getElementById("close-decision-confirm");
    const cancelBtn = document.getElementById("btn-cancel-decision-confirm");
    const submitBtn = document.getElementById("btn-submit-decision-confirm");
    const resetDefaultBtn = document.getElementById("btn-reset-default-remarks");
    const textarea = document.getElementById("confirm-remarks-textarea");

    if (closeBtn) closeBtn.addEventListener("click", closeDecisionConfirmModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeDecisionConfirmModal);
    confirmModalEl.addEventListener("click", (e) => {
      if (e.target === confirmModalEl) closeDecisionConfirmModal();
    });

    if (resetDefaultBtn) {
      resetDefaultBtn.addEventListener("click", () => {
        if (!pendingDecision) return;
        const defaultText = DEFAULT_AUTOMATED_REMARKS[pendingDecision.status] || "";
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

        let remarks = textarea ? textarea.value.trim() : "";
        const errEl = document.getElementById("confirm-remarks-error");
        if (errEl) errEl.style.display = "none";

        if (!remarks && pendingDecision) {
          remarks = DEFAULT_AUTOMATED_REMARKS[pendingDecision.status] || "Application status updated.";
        }

        submitBtn.disabled = true;
        const targetStatus = pendingDecision.status;
        const targetAppId = currentActiveApp.id;

        await updateApplicationStatus(targetAppId, targetStatus, remarks);

        submitBtn.disabled = false;
        closeDecisionConfirmModal();

        // Update active application object in-place
        currentActiveApp.status = targetStatus;
        currentActiveApp.statusText = targetStatus;
        currentActiveApp.notes = remarks;
        currentActiveApp.feedback = remarks;
        currentActiveApp.remarks = remarks;

        const notesInput = document.getElementById("modal-review-notes");
        if (notesInput) notesInput.value = remarks;

        // Update status badge in Review Modal
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
        const successBanner = document.getElementById("modal-feedback-success-banner");
        const successMsg = document.getElementById("modal-feedback-success-msg");
        if (successBanner && successMsg) {
          successMsg.textContent = `Application decision marked as "${targetStatus}" and remarks have been successfully saved and dispatched to the student's portal!`;
          successBanner.style.display = "block";
          const container = reviewModalEl.querySelector(".nexo-modal-container");
          if (container) container.scrollTo({ top: 0, behavior: "smooth" });
        }

        // If Approved or Rejected, lock the decision controls permanently
        if (targetStatus === "Approved" || targetStatus === "Rejected") {
          const finalizedNotice = document.getElementById("modal-decision-finalized-notice");
          const finalizedLabel = document.getElementById("modal-finalized-status-label");
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

        renderPostApplicantsFeed();
      });
    }
  }

  function openDecisionConfirmModal(status) {
    if (!currentActiveApp) return;

    if (currentActiveApp.status === "Approved" || currentActiveApp.status === "Rejected") {
      showToast("This application decision has already been finalized and cannot be modified.", true);
      return;
    }

    pendingDecision = { appId: currentActiveApp.id, status };

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

    const currentNotes = document.getElementById("modal-review-notes")?.value?.trim() || "";
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

    if (confirmModalEl) confirmModalEl.classList.add("active");
  }

  function closeDecisionConfirmModal() {
    if (confirmModalEl) confirmModalEl.classList.remove("active");
    pendingDecision = null;
  }

  function openReviewModal(app) {
    currentActiveApp = app;
    isModalOpen = true;

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

    const progTitleEl = document.getElementById("modal-program-title");
    if (progTitleEl) {
      progTitleEl.textContent = app.scholarshipTitle || "Scholarship Program";
    }
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

    renderModalDocuments(app);

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
    if (rawDocs.length === 0) {
      docsContainer.innerHTML =
        '<div style="text-align: center; padding: 18px; font-size: 13px; color: var(--text-secondary); background: rgba(0,0,0,0.02); border-radius: 8px;">No attached documents for this submission.</div>';
      return;
    }

    const attachedDocs = [];
    const followUpDocs = [];

    rawDocs.forEach((doc, idx) => {
      let docName = "Document #" + (idx + 1);
      let docUrl = "";
      let docSize = "";
      let isFollowUp = false;

      if (typeof doc === "string") {
        docName = doc;
        isFollowUp = doc.includes("(To Follow Up)");
        if (!isFollowUp && (doc.startsWith("data:") || doc.startsWith("http") || doc.startsWith("/"))) {
          docUrl = doc;
        }
      } else if (doc && typeof doc === "object") {
        docName = doc.requirement || doc.title || doc.name || doc.filename || docName;
        docUrl = doc.data || doc.url || doc.fileUrl || doc.dataUrl || "";
        docSize = doc.size ? formatFileSize(doc.size) : "";
        isFollowUp = Boolean(
          doc.isFollowUp ||
          doc.status === "to_follow_up" ||
          doc.type === "to_follow_up" ||
          (doc.name && doc.name.includes("(To Follow Up)"))
        );
      }

      const cleanDocName = docName.replace(/\s*\(To Follow Up\)/gi, "").trim();
      const itemData = { doc, cleanDocName, docUrl, docSize, isFollowUp };

      if (isFollowUp) {
        followUpDocs.push(itemData);
      } else {
        attachedDocs.push(itemData);
      }
    });

    // 1. Attached Documents Section (All completed requirements placed together)
    if (attachedDocs.length > 0) {
      const attachedHeader = document.createElement("div");
      attachedHeader.style.cssText =
        "display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; margin-top: 4px;";
      attachedHeader.innerHTML = `
        <span style="font-size: 11.5px; font-weight: 700; color: #10B981; text-transform: uppercase; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 4px;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
          Attached Documents (${attachedDocs.length})
        </span>
        <span style="font-size: 11px; color: var(--text-secondary);">Ready for Verification</span>
      `;
      docsContainer.appendChild(attachedHeader);

      attachedDocs.forEach(({ cleanDocName, docUrl, docSize }) => {
        const docItem = document.createElement("div");
        docItem.className = "modal-doc-item";

        const isPdf =
          cleanDocName.toLowerCase().endsWith(".pdf") ||
          (typeof docUrl === "string" && docUrl.startsWith("data:application/pdf"));
        docItem.innerHTML = `
          <div class="modal-doc-info">
            <div class="modal-doc-icon" style="background: rgba(139, 92, 246, 0.15); color: #8b5cf6;">
              ${
                isPdf
                  ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><text x="7" y="18" fill="currentColor" font-size="5" font-weight="bold">PDF</text></svg>'
                  : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>'
              }
            </div>
            <div>
              <h5 class="modal-doc-name">${escapeHtml(cleanDocName)}</h5>
              <span class="modal-doc-size">${docSize ? escapeHtml(docSize) + " &bull; " : ""}Ready for verification</span>
            </div>
          </div>
          <button type="button" class="btn-doc-view">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            View File
          </button>
        `;
        const viewBtn = docItem.querySelector(".btn-doc-view");
        if (viewBtn) {
          viewBtn.addEventListener("click", () => {
            openDocPreview(docUrl, cleanDocName);
          });
        }
        docsContainer.appendChild(docItem);
      });
    }

    // 2. Requirements To Follow Up Section (All incomplete follow-up requirements placed together)
    if (followUpDocs.length > 0) {
      const followUpHeader = document.createElement("div");
      followUpHeader.style.cssText =
        "margin-top: 14px; margin-bottom: 8px; padding-top: 10px; border-top: 1px dashed var(--border-color);";
      followUpHeader.innerHTML = `
        <span style="font-size: 11.5px; font-weight: 700; color: #D97706; text-transform: uppercase; letter-spacing: 0.5px; display: block;">
          Requirements To Follow Up
        </span>
      `;
      docsContainer.appendChild(followUpHeader);

      followUpDocs.forEach(({ cleanDocName }) => {
        const itemEl = document.createElement("div");
        itemEl.className = "modal-doc-item";
        itemEl.style.cssText =
          "background: rgba(245, 158, 11, 0.05); border: 1px dashed rgba(245, 158, 11, 0.35);";
        itemEl.innerHTML = `
          <div class="modal-doc-info" style="min-width: 0;">
            <div style="min-width: 0;">
              <h5 class="modal-doc-name" style="color: var(--text-primary); font-weight: 700;">
                ${escapeHtml(cleanDocName)}
              </h5>
              <span class="modal-doc-size" style="color: #d97706; font-weight: 500;">
                Pending student submission
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

  function formatFileSize(bytes) {
    if (!bytes || isNaN(bytes)) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  function openDocPreview(fileUrl, fileName) {
    if (!docPreviewModalEl) return;

    const titleEl = document.getElementById("doc-preview-title");
    const bodyEl = document.getElementById("doc-preview-body");

    if (titleEl) titleEl.textContent = fileName || "Document Preview";

    if (bodyEl) {
      const isImg =
        fileUrl &&
        (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileUrl) ||
          fileUrl.startsWith("data:image/"));
      const isPdf =
        fileUrl &&
        (/\.pdf$/i.test(fileUrl) ||
          fileUrl.startsWith("data:application/pdf"));

      if (isImg) {
        bodyEl.innerHTML = `
          <div style="display: flex; justify-content: center; align-items: center; background: rgba(0,0,0,0.03); border-radius: 8px; padding: 14px; min-height: 320px;">
            <img src="${fileUrl}" alt="${escapeHtml(fileName)}" style="max-width: 100%; max-height: 70vh; border-radius: 6px; object-fit: contain; box-shadow: 0 4px 16px rgba(0,0,0,0.12);" />
          </div>
        `;
      } else if (isPdf) {
        bodyEl.innerHTML = `
          <iframe src="${fileUrl}" style="width: 100%; height: 72vh; border: none; border-radius: 8px;"></iframe>
        `;
      } else if (fileUrl && fileUrl !== "#" && (fileUrl.startsWith("data:") || fileUrl.startsWith("http"))) {
        bodyEl.innerHTML = `
          <div style="display: flex; justify-content: center; align-items: center; background: rgba(0,0,0,0.03); border-radius: 8px; padding: 14px; min-height: 320px;">
            <img src="${fileUrl}" alt="${escapeHtml(fileName)}" style="max-width: 100%; max-height: 70vh; border-radius: 6px; object-fit: contain;" />
          </div>
        `;
      } else {
        bodyEl.innerHTML = `
          <div style="text-align: center; padding: 48px 20px; background: rgba(0,0,0,0.02); border-radius: 8px;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="1.8" style="margin-bottom: 12px;">
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
  // UPDATE APPLICATION STATUS (LIVE BACKEND SYNC)
  // -------------------------------------------------------------
  async function updateApplicationStatus(appId, newStatus, notes = "") {
    // 1. Optimistic UI update
    const idx = allApplications.findIndex((a) => String(a.id) === String(appId));
    if (idx >= 0) {
      allApplications[idx].status = newStatus;
      allApplications[idx].statusText = newStatus;
      allApplications[idx].notes = notes;
      allApplications[idx].feedback = notes;
      allApplications[idx].remarks = notes;
      allApplications[idx].reviewedAt = new Date().toISOString();
    }

    try {
      localStorage.setItem("nexo_applications", JSON.stringify(allApplications));
    } catch (_) {}

    try {
      const res = await fetch(`${API_BASE}/api/applications/${appId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          notes,
          feedback: notes,
          remarks: notes,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      showToast(`Decision "${newStatus}" saved & sent to student portal!`);
    } catch (err) {
      console.warn("Could not sync application status directly with backend:", err);
      showToast(`Application marked as ${newStatus} (Saved locally)`);
    }
  }
})();
