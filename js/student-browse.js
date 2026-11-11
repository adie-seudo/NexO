// ==========================================================================
// NEXO STUDENT SCHOLARSHIP DIRECTORY JAVASCRIPT (js/student-browse.js)
// Real-time provider sync, mobile-first design, search, 3-pill filters,
// scholarship details modal & digital drop-box document upload.
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = window.location.origin.includes(":3000")
    ? ""
    : "http://localhost:3000";

  let allScholarships = [];
  let providerSettings = null;
  let studentSettings = null;
  let studentApplications = [];
  let activeScholarship = null;

  // Filter State
  let searchQuery = "";
  let filterType = "all";
  let filterProvider = "all";
  let filterStatus = "all";

  // Document Uploads State for Digital Drop-Box
  let uploadedFiles = {};

  // -------------------------------------------------------------
  // 1. TOAST NOTIFIER HELPER
  // -------------------------------------------------------------
  function showToast(message, isError = false) {
    let toast = document.getElementById("student-browse-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "student-browse-toast";
      toast.className = "settings-toast";
      document.body.appendChild(toast);
    }
    toast.innerHTML = isError
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg><span>${message}</span>`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg><span>${message}</span>`;
    toast.classList.toggle("error", isError);
    toast.classList.add("show");

    if (window.browseToastTimeout) clearTimeout(window.browseToastTimeout);
    window.browseToastTimeout = setTimeout(() => {
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

  function getProviderInitials(name) {
    if (!name || !name.trim()) return "NX";
    const clean = name.trim();
    const words = clean.split(/\s+/);
    if (words.length === 1) {
      return clean.slice(0, 2).toUpperCase();
    }
    return (words[0][0] + (words[1] ? words[1][0] : "")).toUpperCase();
  }

  function resolveProviderLogo(item, pSettings) {
    if (item && item.providerLogo && String(item.providerLogo).trim()) {
      return item.providerLogo;
    }
    if (item && item.logoImage && String(item.logoImage).trim()) {
      return item.logoImage;
    }
    const activeOrgName =
      (pSettings && pSettings.orgName) ||
      localStorage.getItem("nexo-provider-name") ||
      "NEXO";
    const itemOrg = (item && item.providerName ? item.providerName.trim() : "");
    if (!itemOrg || itemOrg.toLowerCase() === activeOrgName.toLowerCase() || itemOrg.toLowerCase() === "nexo") {
      const settingsLogo =
        (pSettings && pSettings.logoImage) ||
        localStorage.getItem("nexo-provider-logo") ||
        "";
      if (settingsLogo) return settingsLogo;
    }
    return "";
  }

  // -------------------------------------------------------------
  // 2. FETCH REAL-TIME SCHOLARSHIPS FROM BACKEND & DATA.JSON ONLY
  // (No fake seed scholarships - only synchronized provider posts)
  // -------------------------------------------------------------
  async function fetchLiveScholarships() {
    let combined = [];
    let serverOk = false;

    try {
      const res = await fetch(`${API_BASE}/api/data`);
      if (res.ok) {
        serverOk = true;
        const fullData = await res.json();
        const serverScholarships = Array.isArray(fullData.scholarships)
          ? fullData.scholarships
          : [];
        combined = serverScholarships;
        if (fullData.settings) {
          providerSettings = fullData.settings;
        }
        if (fullData.studentSettings) {
          studentSettings = fullData.studentSettings;
        }
        if (Array.isArray(fullData.applications)) {
          studentApplications = fullData.applications;
        }

        const currentStudentEmail = (
          sessionStorage.getItem("nexo-student-email") ||
          localStorage.getItem("nexo-student-email") ||
          ""
        ).toLowerCase();
        if (currentStudentEmail && fullData.studentProfiles && fullData.studentProfiles[currentStudentEmail]) {
          studentSettings = fullData.studentProfiles[currentStudentEmail];
          try {
            localStorage.setItem(`nexo_student_settings_${currentStudentEmail}`, JSON.stringify(studentSettings));
            localStorage.setItem("nexo_student_settings", JSON.stringify(studentSettings));
          } catch (_) {}
        }

        // Keep local cache exactly in sync with server
        try {
          localStorage.setItem(
            "nexo_scholarships",
            JSON.stringify(serverScholarships),
          );
          localStorage.setItem(
            "nexo_applications",
            JSON.stringify(studentApplications),
          );
        } catch (_) {}
      }
    } catch (e) {
      console.warn("Could not fetch /api/data:", e);
    }

    // Only fallback to localStorage if server was unreachable
    if (!serverOk) {
      try {
        combined = JSON.parse(
          localStorage.getItem("nexo_scholarships") || "[]",
        );
        studentApplications = JSON.parse(
          localStorage.getItem("nexo_applications") || "[]",
        );
      } catch (_) {}
    }

    const FAKE_SCHOL_IDS = new Set([
      "schol_nexo_stem",
      "schol_nexo_academic",
      "schol_nexo_tech",
      "schol_nexo_tech_01",
      "schol_1794124026316",
      "schol_1794126664376",
      "schol_1794126637109",
    ]);

    if (Array.isArray(combined) && combined.some((s) => s && FAKE_SCHOL_IDS.has(s.id))) {
      combined = combined.filter((s) => s && !FAKE_SCHOL_IDS.has(s.id));
      try {
        localStorage.setItem("nexo_scholarships", JSON.stringify(combined));
      } catch (_) {}
    }

    // Check localStorage for provider settings if not loaded
    if (!providerSettings) {
      try {
        const cachedSettings =
          localStorage.getItem("nexo_provider_settings") ||
          localStorage.getItem("nexo_settings");
        if (cachedSettings) providerSettings = JSON.parse(cachedSettings);
      } catch (_) {}
    }

    const orgName =
      (providerSettings && providerSettings.orgName) ||
      localStorage.getItem("nexo-provider-name") ||
      "NEXO";
    const orgLogo =
      (providerSettings && providerSettings.logoImage) ||
      localStorage.getItem("nexo-provider-logo") ||
      "";
    const orgBanner =
      (providerSettings && providerSettings.bannerImage) ||
      "";

    // Format for display
    allScholarships = combined.map((post) => {
      const limit =
        parseInt(post.applicantLimit || post.maxApplicants || 200, 10) || 200;
      let liveCount = 0;
      if (
        Array.isArray(studentApplications) &&
        studentApplications.length > 0
      ) {
        liveCount = studentApplications.filter(
          (a) =>
            (a.scholarshipId &&
              post.id &&
              String(a.scholarshipId) === String(post.id)) ||
            (post.title &&
              (a.scholarshipTitle === post.title || a.title === post.title)),
        ).length;
      } else {
        liveCount = parseInt(post.applicantTotal || 0, 10) || 0;
      }
      const appCount = `${liveCount} / ${limit} Applicants`;
      return {
        id: post.id || "schol_" + Date.now(),
        title: post.title || "Scholarship Program",
        providerName: post.providerName || orgName,
        providerLogo: post.providerLogo || orgLogo,
        providerBanner: post.providerBanner || orgBanner,
        type: post.type || "General",
        deadline: post.deadline || "",
        formattedDate: post.formattedDate || "Open Deadline",
        desc:
          post.desc ||
          "Scholarship program details provided by the organization.",
        requirements:
          Array.isArray(post.requirements) && post.requirements.length > 0
            ? post.requirements
            : [],
        status: liveCount >= limit ? "Quota Full" : post.status || "Open",
        applicantLimit: limit,
        maxApplicants: limit,
        applicantTotal: liveCount,
        applicantCount: appCount,
        postedAt: post.postedAt || post.createdAt || "",
        formattedPostedDate: post.formattedPostedDate || "",
      };
    });

    // Populate Provider filter options dynamically
    populateProviderFilter();

    renderFeed();
  }

  // -------------------------------------------------------------
  // 3. POPULATE PROVIDER FILTER DROPDOWN
  // -------------------------------------------------------------
  function populateProviderFilter() {
    const providerMenu = document.getElementById("menu-filter-provider");
    if (!providerMenu) return;

    const providers = Array.from(
      new Set(allScholarships.map((s) => s.providerName).filter(Boolean)),
    );

    let html = `<button type="button" class="directory-dropdown-item ${
      filterProvider === "all" ? "active" : ""
    }" data-filter-provider="all">All Providers</button>`;

    providers.forEach((p) => {
      const isActive = filterProvider.toLowerCase() === p.toLowerCase();
      html += `<button type="button" class="directory-dropdown-item ${
        isActive ? "active" : ""
      }" data-filter-provider="${p}">${p}</button>`;
    });

    providerMenu.innerHTML = html;
    wireDropdownItems();
  }

  // -------------------------------------------------------------
  // 4. DROPDOWN MENUS SYSTEM (Type ˇ, Provider ˇ, Status ˇ)
  // -------------------------------------------------------------
  const btnType = document.getElementById("btn-filter-type");
  const menuType = document.getElementById("menu-filter-type");
  const labelType = document.getElementById("label-filter-type");

  const btnProvider = document.getElementById("btn-filter-provider");
  const menuProvider = document.getElementById("menu-filter-provider");
  const labelProvider = document.getElementById("label-filter-provider");

  const btnStatus = document.getElementById("btn-filter-status");
  const menuStatus = document.getElementById("menu-filter-status");
  const labelStatus = document.getElementById("label-filter-status");

  function closeAllDropdowns() {
    if (menuType) menuType.classList.remove("show");
    if (menuProvider) menuProvider.classList.remove("show");
    if (menuStatus) menuStatus.classList.remove("show");
    document.querySelectorAll(".directory-filter-dropdown").forEach((el) => {
      el.classList.remove("is-open");
    });
  }

  function setupFilterDropdown(btn, menu, wrapperId) {
    if (!btn || !menu) return;
    const wrapper = document.getElementById(wrapperId);
    const toggleHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = menu.classList.contains("show");
      closeAllDropdowns();
      if (!isOpen) {
        menu.classList.add("show");
        if (wrapper) wrapper.classList.add("is-open");
      }
    };
    btn.onclick = toggleHandler;
  }

  setupFilterDropdown(btnType, menuType, "dropdown-wrapper-type");
  setupFilterDropdown(btnProvider, menuProvider, "dropdown-wrapper-provider");
  setupFilterDropdown(btnStatus, menuStatus, "dropdown-wrapper-status");

  document.addEventListener("click", () => {
    closeAllDropdowns();
  });

  function wireDropdownItems() {
    // Type Items
    document.querySelectorAll("[data-filter-type]").forEach((item) => {
      const handleSelect = (e) => {
        e.preventDefault();
        e.stopPropagation();
        filterType = item.getAttribute("data-filter-type") || "all";
        document
          .querySelectorAll("[data-filter-type]")
          .forEach((i) => i.classList.remove("active"));
        item.classList.add("active");
        if (labelType) {
          labelType.textContent = filterType === "all" ? "Type" : filterType;
        }
        if (btnType) {
          btnType.classList.toggle("is-filtered", filterType !== "all");
        }
        closeAllDropdowns();
        renderFeed();
      };
      item.onclick = handleSelect;
    });

    // Provider Items
    document.querySelectorAll("[data-filter-provider]").forEach((item) => {
      const handleSelect = (e) => {
        e.preventDefault();
        e.stopPropagation();
        filterProvider = item.getAttribute("data-filter-provider") || "all";
        document
          .querySelectorAll("[data-filter-provider]")
          .forEach((i) => i.classList.remove("active"));
        item.classList.add("active");
        if (labelProvider) {
          labelProvider.textContent =
            filterProvider === "all" ? "Provider" : filterProvider;
        }
        if (btnProvider) {
          btnProvider.classList.toggle("is-filtered", filterProvider !== "all");
        }
        closeAllDropdowns();
        renderFeed();
      };
      item.onclick = handleSelect;
    });

    // Status Items
    document.querySelectorAll("[data-filter-status]").forEach((item) => {
      const handleSelect = (e) => {
        e.preventDefault();
        e.stopPropagation();
        filterStatus = item.getAttribute("data-filter-status") || "all";
        document
          .querySelectorAll("[data-filter-status]")
          .forEach((i) => i.classList.remove("active"));
        item.classList.add("active");
        if (labelStatus) {
          labelStatus.textContent =
            filterStatus === "all" ? "Status" : filterStatus;
        }
        if (btnStatus) {
          btnStatus.classList.toggle("is-filtered", filterStatus !== "all");
        }
        closeAllDropdowns();
        renderFeed();
      };
      item.onclick = handleSelect;
    });
  }
  wireDropdownItems();

  // Search Input (Live debounced filter)
  const searchInput = document.getElementById("browse-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value.trim().toLowerCase();
      renderFeed();
    });
  }

  // Reset Filters Button
  const resetBtn = document.getElementById("browse-reset-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      filterType = "all";
      filterProvider = "all";
      filterStatus = "all";
      searchQuery = "";
      if (searchInput) searchInput.value = "";
      if (labelType) labelType.textContent = "Type";
      if (labelProvider) labelProvider.textContent = "Provider";
      if (labelStatus) labelStatus.textContent = "Status";
      if (btnType) btnType.classList.remove("is-filtered");
      if (btnProvider) btnProvider.classList.remove("is-filtered");
      if (btnStatus) btnStatus.classList.remove("is-filtered");
      renderFeed();
    });
  }

  // -------------------------------------------------------------
  // 5. RENDER DIRECTORY CARDS (Matching Canva Mockup)
  // -------------------------------------------------------------
  const feedContainer = document.getElementById("browse-scholarships-feed");
  const countLabel = document.getElementById("browse-count-label");
  const emptyState = document.getElementById("browse-empty-state");

  function renderFeed() {
    if (!feedContainer) return;

    const filtered = allScholarships.filter((item) => {
      // Type match (accurately matching Merit-Based, Need-Based, and Athletic)
      let matchesType = true;
      if (filterType !== "all") {
        const ft = filterType.toLowerCase();
        const t = (item.type || "").toLowerCase();
        const tt = (item.typeText || "").toLowerCase();
        if (ft.includes("merit")) {
          matchesType = t === "merit" || t.includes("merit") || tt.includes("merit");
        } else if (ft.includes("need")) {
          matchesType = t === "need" || t.includes("need") || tt.includes("need");
        } else if (ft.includes("athletic")) {
          matchesType = t === "athletic" || t.includes("athletic") || tt.includes("athletic");
        } else {
          matchesType = t === ft || tt.includes(ft);
        }
      }

      // Provider match
      let matchesProvider = true;
      if (filterProvider !== "all") {
        matchesProvider =
          item.providerName &&
          item.providerName.toLowerCase() === filterProvider.toLowerCase();
      }

      // Status match
      let matchesStatus = true;
      if (filterStatus !== "all") {
        matchesStatus =
          item.status &&
          item.status.toLowerCase() === filterStatus.toLowerCase();
      }

      // Query match
      let matchesQuery = true;
      if (searchQuery.length > 0) {
        const inTitle = (item.title || "").toLowerCase().includes(searchQuery);
        const inProvider = (item.providerName || "")
          .toLowerCase()
          .includes(searchQuery);
        const inDesc = (item.desc || "").toLowerCase().includes(searchQuery);
        const inType = (item.type || "").toLowerCase().includes(searchQuery);
        matchesQuery = inTitle || inProvider || inDesc || inType;
      }

      return matchesType && matchesProvider && matchesStatus && matchesQuery;
    });

    if (countLabel) {
      countLabel.textContent = "";
      countLabel.style.display = "none";
    }

    if (filtered.length === 0) {
      feedContainer.innerHTML = "";
      if (emptyState) {
        emptyState.style.display = "block";
        const emptyTitle = emptyState.querySelector(".student-empty-title");
        const emptyDesc = emptyState.querySelector(".student-empty-desc");
        const resetBtn = document.getElementById("browse-reset-btn");
        if (allScholarships.length === 0) {
          if (emptyTitle) emptyTitle.textContent = "No scholarships posted yet";
          if (emptyDesc) {
            emptyDesc.textContent =
              "Scholarships published by providers will appear here automatically.";
          }
          if (resetBtn) resetBtn.style.display = "none";
        } else {
          if (emptyTitle) emptyTitle.textContent = "No matching scholarships";
          if (emptyDesc) {
            emptyDesc.textContent =
              "We couldn't find any scholarship matching your search or selected filter. Try clearing your search.";
          }
          if (resetBtn) resetBtn.style.display = "inline-flex";
        }
      }
      return;
    }

    if (emptyState) emptyState.style.display = "none";
    feedContainer.innerHTML = "";

    filtered.forEach((item) => {
      const card = document.createElement("div");
      card.className = "directory-card";

      const resolvedLogo = resolveProviderLogo(item, providerSettings);
      const initials = getProviderInitials(item.providerName || "NEXO");

      const logoHtml = resolvedLogo
        ? `<img src="${resolvedLogo}" alt="${escapeHtml(item.providerName || 'Provider')}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`
        : `<span>${initials}</span>`;

      const isQuotaFull = (item.status || "").toLowerCase().includes("quota");
      const isClosed =
        (item.status || "").toLowerCase() === "closed" || isQuotaFull;
      const statusClass = isClosed ? "closed" : "open";
      const statusText = isQuotaFull
        ? "Quota Full"
        : isClosed
          ? "Closed"
          : "Open";

      const currentStudentEmail = (
        sessionStorage.getItem("nexo-student-email") ||
        localStorage.getItem("nexo-student-email") ||
        ""
      ).toLowerCase();

      const existingApp = studentApplications.find(
        (a) =>
          (a.studentEmail || "").toLowerCase() === currentStudentEmail &&
          String(a.scholarshipId) === String(item.id),
      );
      const isAlreadyApplied = !!existingApp;

      let applyBtnHtml = "";
      if (isAlreadyApplied) {
        applyBtnHtml = `<button type="button" class="directory-apply-btn view-submission-btn" data-id="${item.id}" data-app-id="${existingApp.id}">View My Submission</button>`;
      } else if (isClosed) {
        applyBtnHtml = `<button type="button" class="directory-apply-btn disabled" data-id="${item.id}" disabled>${statusText}</button>`;
      } else {
        applyBtnHtml = `<button type="button" class="directory-apply-btn" data-id="${item.id}">Apply Now</button>`;
      }

      const postedDate =
        item.formattedPostedDate ||
        (item.postedAt
          ? new Date(item.postedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : item.createdAt
            ? new Date(item.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "Nov 9, 2026");

      const applicantCountDisplay =
        item.applicantCount ||
        `0 / ${item.applicantLimit || item.maxApplicants || 200} Applicants`;

      card.innerHTML = `
        <div class="directory-card-header">
          <div class="directory-card-brand">
            <div class="directory-card-logo">
              ${logoHtml}
            </div>
            <div class="directory-card-titles">
              <h3 class="directory-card-title">${escapeHtml(item.title || "Scholarship Program")}</h3>
              <p class="directory-card-provider">${escapeHtml(item.providerName || "NEXO")}</p>
            </div>
          </div>
          <span class="directory-status-pill ${statusClass}">${statusText}</span>
        </div>

        <div class="directory-card-meta-wrap">
          <div>
            <span class="directory-applicants-tag">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              ${escapeHtml(applicantCountDisplay)}
            </span>
          </div>

          <div class="directory-dates-row">
            <span class="directory-date-item">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              Posted: ${escapeHtml(postedDate)}
            </span>
            <span class="directory-date-dot">•</span>
            <span class="directory-date-item">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              Expires: ${escapeHtml(item.formattedDate || "No Deadline")}
            </span>
          </div>
        </div>

        <p class="directory-card-desc">${escapeHtml(item.desc || "")}</p>

        <div class="directory-card-footer">
          <button type="button" class="directory-view-details-btn" data-id="${item.id}">View Details</button>
          ${applyBtnHtml}
        </div>
      `;

      // Wire View Details Link
      const btnViewDetails = card.querySelector(".directory-view-details-btn");
      if (btnViewDetails) {
        btnViewDetails.addEventListener("click", () => {
          openDetailsModal(item);
        });
      }

      // Wire Apply Now Button or View My Submission button
      const btnApply = card.querySelector(".directory-apply-btn");
      if (btnApply) {
        btnApply.addEventListener("click", () => {
          if (
            btnApply.classList.contains("already-applied-btn") ||
            btnApply.classList.contains("view-submission-btn")
          ) {
            const appId =
              btnApply.dataset.appId || (existingApp ? existingApp.id : "");
            window.location.href = appId
              ? `student-submissions.html?id=${encodeURIComponent(appId)}`
              : "student-submissions.html";
            return;
          }
          if (!isClosed) {
            if (typeof window.isStudentProfileComplete === "function" && !window.isStudentProfileComplete()) {
              showProfileGuardModal();
              return;
            }
            openDropboxModal(item);
          }
        });
      }

      feedContainer.appendChild(card);
    });
  }

  // -------------------------------------------------------------
  // 6. SCHOLARSHIP DETAILS MODAL (Matching Image 4 Mockup)
  // -------------------------------------------------------------
  const modalOverlay = document.getElementById("schol-modal-overlay");
  const modalViewDetails = document.getElementById("modal-view-details");
  const modalViewDropbox = document.getElementById("modal-view-dropbox");
  const btnCloseModal = document.getElementById("close-schol-modal");
  const btnOpenDropbox = document.getElementById("btn-open-dropbox");
  const btnShare = document.getElementById("btn-share-schol");

  function openDetailsModal(schol) {
    activeScholarship = schol;
    if (!modalOverlay || !modalViewDetails) return;

    modalViewDetails.style.display = "block";
    if (modalViewDropbox) modalViewDropbox.style.display = "none";

    // Populate data
    const coverImg = document.getElementById("modal-cover-img");
    const logoBox = document.getElementById("modal-schol-logo");
    const providerEl = document.getElementById("modal-schol-provider");
    const titleEl = document.getElementById("modal-schol-title");
    const deadlineEl = document.getElementById("modal-schol-deadline");
    const descEl = document.getElementById("modal-schol-desc");
    const reqsContainer = document.getElementById("modal-schol-reqs");

    const bannerSrc =
      schol.providerBanner ||
      schol.bannerImage ||
      schol.banner ||
      "";

    if (coverImg) {
      if (bannerSrc && typeof bannerSrc === "string" && bannerSrc.trim()) {
        coverImg.src = bannerSrc;
        coverImg.style.display = "block";
      } else {
        coverImg.style.display = "none";
        coverImg.src = "";
      }
      coverImg.onerror = function () {
        this.style.display = "none";
        this.src = "";
      };
    }

    const logoSrc = resolveProviderLogo(schol, providerSettings);

    if (logoBox) {
      if (logoSrc) {
        logoBox.innerHTML = `<img src="${logoSrc}" alt="Logo" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
      } else {
        const initials = getProviderInitials(schol.providerName || "NEXO");
        logoBox.innerHTML = initials;
      }
    }

    if (providerEl) providerEl.textContent = schol.providerName || "NEXO";
    if (titleEl) titleEl.textContent = schol.title;
    if (deadlineEl) deadlineEl.textContent = schol.formattedDate;
    if (descEl) descEl.textContent = schol.desc;

    if (reqsContainer) {
      reqsContainer.innerHTML = "";
      const reqList = Array.isArray(schol.requirements)
        ? schol.requirements
        : [];
      if (reqList.length > 0) {
        reqList.forEach((req) => {
          const reqTitle =
            typeof req === "object" && req !== null
              ? req.title || req.name || ""
              : String(req);
          const reqDesc =
            typeof req === "object" && req !== null && req.desc
              ? `<span style="font-size: 12px; color: var(--text-secondary); display: block; margin-top: 2px;">${escapeHtml(req.desc)}</span>`
              : "";

          const item = document.createElement("div");
          item.className = "details-checklist-item";
          item.innerHTML = `
            <div class="details-check-icon">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <div style="display: flex; flex-direction: column;">
              <span style="font-weight: 600; color: var(--text-primary); font-size: 13.5px;">${escapeHtml(reqTitle)}</span>
              ${reqDesc}
            </div>
          `;
          reqsContainer.appendChild(item);
        });
      } else {
        reqsContainer.innerHTML = `<p style="font-size: 13px; color: var(--text-secondary); margin: 0;">No specific documents required.</p>`;
      }
    }

    // Check if student has already applied for this scholarship
    const postedDate =
      schol.formattedPostedDate ||
      (schol.postedAt
        ? new Date(schol.postedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : schol.createdAt
          ? new Date(schol.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "Recently");

    const postedEl = document.getElementById("modal-schol-posted");
    if (postedEl) postedEl.textContent = postedDate;

    const applicantsEl = document.getElementById("modal-schol-applicants");
    if (applicantsEl) {
      const applicantLimit = schol.applicantLimit || schol.maxApplicants || 200;
      applicantsEl.textContent =
        schol.applicantCount || `0 / ${applicantLimit} Applicants`;
    }

    const daysLeftEl = document.getElementById("modal-schol-days-left");
    if (daysLeftEl) {
      if (schol.deadline) {
        const deadlineDate = new Date(schol.deadline);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        deadlineDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil(
          (deadlineDate - today) / (1000 * 60 * 60 * 24),
        );

        if (diffDays < 0) {
          daysLeftEl.textContent = "Expired";
          daysLeftEl.style.background = "rgba(239, 68, 68, 0.12)";
          daysLeftEl.style.color = "#ef4444";
        } else if (diffDays === 0) {
          daysLeftEl.textContent = "Expires Today";
          daysLeftEl.style.background = "rgba(245, 158, 11, 0.15)";
          daysLeftEl.style.color = "#d97706";
        } else if (diffDays === 1) {
          daysLeftEl.textContent = "1 day left";
          daysLeftEl.style.background = "rgba(245, 158, 11, 0.15)";
          daysLeftEl.style.color = "#d97706";
        } else {
          daysLeftEl.textContent = `${diffDays} days left`;
          daysLeftEl.style.background = "rgba(16, 185, 129, 0.12)";
          daysLeftEl.style.color = "#10b981";
        }
      } else {
        daysLeftEl.textContent = "Active";
        daysLeftEl.style.background = "rgba(16, 185, 129, 0.12)";
        daysLeftEl.style.color = "#10b981";
      }
    }

    const currentStudentEmail = (
      sessionStorage.getItem("nexo-student-email") ||
      localStorage.getItem("nexo-student-email") ||
      ""
    ).toLowerCase();

    const existingApp = studentApplications.find(
      (a) =>
        (a.studentEmail || "").toLowerCase() === currentStudentEmail &&
        String(a.scholarshipId) === String(schol.id),
    );
    const isAlreadyApplied = !!existingApp;
    const isQuotaFull = (schol.status || "").toLowerCase().includes("quota");
    const isClosed =
      (schol.status || "").toLowerCase() === "closed" || isQuotaFull;

    const bannerEl = document.getElementById("modal-already-applied-banner");
    if (bannerEl) {
      if (isAlreadyApplied) {
        const appStatus = existingApp.status || "Submitted";
        const dateFormatted =
          existingApp.formattedDate ||
          (existingApp.submittedAt
            ? new Date(existingApp.submittedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "Recently");

        let statusColor = "#10b981";
        if (appStatus.toLowerCase().includes("review")) statusColor = "#8b5cf6";
        if (appStatus.toLowerCase().includes("rejected"))
          statusColor = "#ef4444";

        bannerEl.style.display = "block";
        bannerEl.innerHTML = `
          <div style="background: rgba(139, 92, 246, 0.08); border: 1px solid rgba(139, 92, 246, 0.35); border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
            <div style="display: flex; align-items: flex-start; gap: 12px; min-width: 0; flex: 1;">
              <div style="width: 24px; height: 24px; border-radius: 50%; background: #8b5cf6; color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <div style="flex: 1;">
                <div style="font-weight: 700; color: var(--text-primary); font-size: 14px;">Application Submitted</div>
                <div style="font-size: 13px; color: var(--text-secondary); margin-top: 3px; line-height: 1.45;">
                  Applied on <strong>${escapeHtml(dateFormatted)}</strong> &bull; Status: <span style="font-weight: 700; color: ${statusColor};">${escapeHtml(appStatus)}</span>
                </div>
              </div>
            </div>
            <a href="student-submissions.html?id=${encodeURIComponent(existingApp.id)}" class="btn btn-primary" style="padding: 8px 16px; font-size: 13px; font-weight: 700; border-radius: 8px; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;">
              View My Submission &rarr;
            </a>
          </div>
        `;
      } else {
        bannerEl.style.display = "none";
        bannerEl.innerHTML = "";
      }
    }

    // Configure CTA button
    if (btnOpenDropbox) {
      if (isAlreadyApplied) {
        const appStatus = existingApp.status || "Submitted";
        btnOpenDropbox.disabled = false;
        btnOpenDropbox.classList.remove("disabled");
        btnOpenDropbox.style.background = "#8b5cf6";
        btnOpenDropbox.style.borderColor = "#8b5cf6";
        btnOpenDropbox.style.color = "#ffffff";
        btnOpenDropbox.style.cursor = "pointer";
        btnOpenDropbox.style.opacity = "1";
        btnOpenDropbox.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          View My Submission
        `;
        btnOpenDropbox.onclick = () => {
          window.location.href = `student-submissions.html?id=${encodeURIComponent(existingApp.id)}`;
        };
      } else if (isQuotaFull) {
        btnOpenDropbox.disabled = true;
        btnOpenDropbox.classList.add("disabled");
        btnOpenDropbox.style.background = "";
        btnOpenDropbox.style.borderColor = "";
        btnOpenDropbox.style.color = "";
        btnOpenDropbox.style.cursor = "not-allowed";
        btnOpenDropbox.style.opacity = "";
        btnOpenDropbox.onclick = null;
        btnOpenDropbox.innerHTML = "Applicant Limit Reached (Quota Full)";
      } else if (isClosed) {
        btnOpenDropbox.disabled = true;
        btnOpenDropbox.classList.add("disabled");
        btnOpenDropbox.style.background = "";
        btnOpenDropbox.style.borderColor = "";
        btnOpenDropbox.style.color = "";
        btnOpenDropbox.style.cursor = "not-allowed";
        btnOpenDropbox.style.opacity = "";
        btnOpenDropbox.onclick = null;
        btnOpenDropbox.innerHTML = "Applications are Closed";
      } else {
        btnOpenDropbox.disabled = false;
        btnOpenDropbox.classList.remove("disabled");
        btnOpenDropbox.style.background = "";
        btnOpenDropbox.style.borderColor = "";
        btnOpenDropbox.style.color = "";
        btnOpenDropbox.style.cursor = "";
        btnOpenDropbox.style.opacity = "";
        btnOpenDropbox.onclick = null;
        btnOpenDropbox.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>
            <polyline points="12 12 12 17"></polyline>
            <polyline points="9 15 12 12 15 15"></polyline>
          </svg>
          Proceed to Digital Drop-Box
        `;
      }
    }

    modalOverlay.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    if (modalOverlay) modalOverlay.classList.remove("active");
    document.body.style.overflow = "";
    uploadedFiles = {};
    if (btnSubmitDropbox) {
      btnSubmitDropbox.disabled = false;
      btnSubmitDropbox.innerHTML = "Submit Application";
    }
  }

  if (btnCloseModal) btnCloseModal.addEventListener("click", closeModal);

  if (modalOverlay) {
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) closeModal();
    });
  }

  if (btnShare) {
    btnShare.addEventListener("click", () => {
      if (navigator.share && activeScholarship) {
        navigator
          .share({
            title: activeScholarship.title,
            text: `Check out ${activeScholarship.title} on NEXO!`,
            url: window.location.href,
          })
          .catch(() => {});
      } else {
        navigator.clipboard.writeText(window.location.href);
        showToast("Scholarship link copied to clipboard");
      }
    });
  }

  // -------------------------------------------------------------
  // 7. DIGITAL DROP-BOX (Images 2 & 3 Upload Screen)
  // -------------------------------------------------------------
  const btnBackToDetails = document.getElementById("btn-back-to-details");
  const btnCloseDropbox = document.getElementById("close-dropbox-modal");
  const btnSubmitDropbox = document.getElementById("btn-submit-dropbox");

  // Profile Confirmation Guard Modal
  const guardModal = document.getElementById("modal-profile-locked-guard");
  const btnCloseGuardModal = document.getElementById("btn-close-guard-modal");
  if (btnCloseGuardModal && guardModal) {
    btnCloseGuardModal.addEventListener("click", () => {
      guardModal.classList.remove("active");
      document.body.style.overflow = "";
    });
  }

  function showProfileGuardModal() {
    if (guardModal) {
      guardModal.classList.add("active");
      document.body.style.overflow = "hidden";
    } else {
      showToast(
        "Profile Confirmation Required: Please complete and confirm your Course, Year Level, and Bio in Settings before applying.",
        true,
      );
      setTimeout(() => {
        window.location.href = "student-settings.html";
      }, 1200);
    }
  }

  function openDropboxModal(schol) {
    if (typeof window.isStudentProfileComplete === "function" && !window.isStudentProfileComplete()) {
      showProfileGuardModal();
      return;
    }

    activeScholarship = schol;
    if (!modalOverlay || !modalViewDropbox) return;

    const existing = studentApplications.find(
      (a) => String(a.scholarshipId) === String(schol.id),
    );
    if (existing) {
      showToast("You have already applied for this scholarship.", true);
      openDetailsModal(schol);
      return;
    }

    const isQuota = (schol.status || "").toLowerCase().includes("quota");
    if (isQuota) {
      showToast(
        "This scholarship has reached its applicant limit and is now closed.",
        true,
      );
      openDetailsModal(schol);
      return;
    }

    if (modalViewDetails) modalViewDetails.style.display = "none";
    modalViewDropbox.style.display = "block";

    // Populate dropbox card
    const dTitle = document.getElementById("dropbox-schol-title");
    if (dTitle) dTitle.textContent = schol.title;

    const dDesc = document.getElementById("dropbox-schol-desc");
    if (dDesc) {
      dDesc.textContent =
        "Submit your required documents securely below for " +
        (schol.title || "this scholarship") +
        ".";
    }

    // Render slots dynamically synchronized with active scholarship requirements
    renderDropboxSlots(schol);

    modalOverlay.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  if (btnOpenDropbox) {
    btnOpenDropbox.addEventListener("click", () => {
      if (!activeScholarship) return;
      const existing = studentApplications.find(
        (a) => String(a.scholarshipId) === String(activeScholarship.id),
      );
      if (existing) {
        showToast(
          "You have already submitted an application for this scholarship.",
          true,
        );
        return;
      }
      if (typeof window.isStudentProfileComplete === "function" && !window.isStudentProfileComplete()) {
        showProfileGuardModal();
        return;
      }
      openDropboxModal(activeScholarship);
    });
  }

  if (btnBackToDetails) {
    btnBackToDetails.addEventListener("click", () => {
      if (activeScholarship) openDetailsModal(activeScholarship);
    });
  }

  if (btnCloseDropbox) btnCloseDropbox.addEventListener("click", closeModal);

  function renderDropboxSlots(schol) {
    const container = document.getElementById("dropbox-slots-container");
    if (!container) return;
    container.innerHTML = "";
    uploadedFiles = {};

    let reqList =
      Array.isArray(schol.requirements) && schol.requirements.length > 0
        ? schol.requirements
        : [];

    // Fallback if no specific requirements configured
    if (reqList.length === 0) {
      reqList = [
        {
          title: "Certificate of Registration (COR)",
          desc: "Upload current semester registration or enrollment form.",
        },
        {
          title: "Latest Grades / Transcript of Records",
          desc: "Upload official grades or copy of grades from previous semester.",
        },
      ];
    }

    reqList.forEach((req, idx) => {
      const slotKey = "req_" + idx;
      const reqTitle =
        typeof req === "object" && req !== null
          ? req.title || req.name || `Requirement ${idx + 1}`
          : String(req);
      const reqDesc =
        typeof req === "object" && req !== null && req.desc
          ? req.desc
          : "PDF, JPG, PNG - Max 5MB";

      uploadedFiles[slotKey] = null;

      const slotCard = document.createElement("div");
      slotCard.className = "dropbox-slot-card";
      slotCard.id = `slot-${slotKey}`;
      slotCard.dataset.slot = slotKey;

      slotCard.innerHTML = `
        <input type="file" id="file-${slotKey}" style="display: none;" accept=".pdf,.png,.jpg,.jpeg">
        <div class="dropbox-slot-header">
          <div class="dropbox-slot-icon-box" id="icon-${slotKey}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>
              <polyline points="12 12 12 17"></polyline>
              <polyline points="9 15 12 12 15 15"></polyline>
            </svg>
          </div>
          <div class="dropbox-slot-info">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <h5 class="dropbox-slot-title" id="title-${slotKey}">${escapeHtml(reqTitle)}</h5>
              <span class="dropbox-slot-status-pill" id="badge-${slotKey}" style="font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 6px; background: rgba(0,0,0,0.05); color: var(--text-secondary);">
                Required
              </span>
            </div>
            <p class="dropbox-slot-desc" id="meta-${slotKey}">${escapeHtml(reqDesc)} &bull; (Max 5MB)</p>
          </div>
        </div>
        <div class="dropbox-slot-actions" id="actions-${slotKey}">
          <!-- Populated by updateSlotUI -->
        </div>
      `;

      container.appendChild(slotCard);

      const fileInput = slotCard.querySelector(`#file-${slotKey}`);

      function updateSlotUI() {
        const iconBox = slotCard.querySelector(`#icon-${slotKey}`);
        const metaEl = slotCard.querySelector(`#meta-${slotKey}`);
        const badgeEl = slotCard.querySelector(`#badge-${slotKey}`);
        const actionsEl = slotCard.querySelector(`#actions-${slotKey}`);
        const current = uploadedFiles[slotKey];

        if (current && current.status === "uploaded" && current.file) {
          // 1. FILE ATTACHED STATE
          slotCard.className = "dropbox-slot-card has-file";
          slotCard.classList.remove("slot-error");
          const inlineErr = slotCard.querySelector(".slot-inline-error");
          if (inlineErr) inlineErr.remove();
          const file = current.file;
          const isPdf = file.name.toLowerCase().endsWith(".pdf");
          const formattedSize = (file.size / (1024 * 1024)).toFixed(1) + " MB";

          if (badgeEl) {
            badgeEl.style.background = "rgba(16, 185, 129, 0.15)";
            badgeEl.style.color = "#10B981";
            badgeEl.textContent = "File Attached";
          }

          if (iconBox) {
            iconBox.innerHTML = isPdf
              ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="#E53935"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8" fill="none" stroke="#fff" stroke-width="2"></polyline><text x="7" y="18" fill="#fff" font-size="6" font-weight="bold">PDF</text></svg>`
              : `<svg width="20" height="20" viewBox="0 0 24 24" fill="#6941C6"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5" fill="#fff"></circle><polyline points="21 15 16 10 5 21" fill="none" stroke="#fff" stroke-width="2"></polyline></svg>`;
          }

          if (metaEl) {
            metaEl.innerHTML = `<span style="font-weight: 700; color: var(--text-primary);">${escapeHtml(file.name)}</span> &bull; ${formattedSize}`;
          }

          if (actionsEl) {
            actionsEl.innerHTML = `
              <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 10px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 10px; padding: 8px 12px;">
                <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  <span style="font-size: 13px; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(file.name)}</span>
                </div>
                <button type="button" class="btn-slot-remove" id="btn-remove-${slotKey}" title="Remove Attached File">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  <span>Remove</span>
                </button>
              </div>
            `;
            const btnRemove = actionsEl.querySelector(`#btn-remove-${slotKey}`);
            if (btnRemove) {
              btnRemove.onclick = (e) => {
                e.stopPropagation();
                uploadedFiles[slotKey] = null;
                if (fileInput) fileInput.value = "";
                updateSlotUI();
                showToast(`Removed ${file.name}`);
              };
            }
          }
        } else if (current && current.status === "to_follow_up") {
          // 2. TO FOLLOW UP LATER STATE
          slotCard.className = "dropbox-slot-card is-follow-up";
          slotCard.classList.remove("slot-error");
          const inlineErr = slotCard.querySelector(".slot-inline-error");
          if (inlineErr) inlineErr.remove();

          if (badgeEl) {
            badgeEl.style.background = "rgba(245, 158, 11, 0.15)";
            badgeEl.style.color = "#D97706";
            badgeEl.textContent = "To Follow Up Later";
          }

          if (iconBox) {
            iconBox.innerHTML = `
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2.2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            `;
          }

          if (metaEl) {
            metaEl.innerHTML = `<span style="color: #D97706; font-weight: 600; font-size: 12px;">Submission deferred &bull; No file attached</span>`;
          }

          if (actionsEl) {
            actionsEl.innerHTML = `
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; margin-top: 4px; padding: 10px 14px; background: rgba(245, 158, 11, 0.08); border: 1.5px dashed rgba(245, 158, 11, 0.4); border-radius: 12px; box-sizing: border-box;">
                <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2.2" style="flex-shrink: 0;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  <span style="font-size: 12.5px; color: #D97706; font-weight: 600;">Deferred to My Submissions</span>
                </div>
                <button type="button" class="btn-slot-upload" id="btn-upload-instead-${slotKey}" style="min-height: 38px; padding: 0 14px; font-size: 12.5px; flex-shrink: 0; width: auto;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  <span>Upload File Instead</span>
                </button>
              </div>
            `;
            const btnUploadInstead = actionsEl.querySelector(`#btn-upload-instead-${slotKey}`);
            if (btnUploadInstead) {
              btnUploadInstead.onclick = (e) => {
                e.stopPropagation();
                uploadedFiles[slotKey] = null;
                updateSlotUI();
                fileInput.click();
              };
            }
          }
        } else {
          // 3. EMPTY DEFAULT STATE
          slotCard.className = "dropbox-slot-card";
          if (badgeEl) {
            badgeEl.style.background = "rgba(0,0,0,0.06)";
            badgeEl.style.color = "var(--text-secondary)";
            badgeEl.textContent = "Required";
          }

          if (iconBox) {
            iconBox.innerHTML = `
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>
                <polyline points="12 12 12 17"></polyline>
                <polyline points="9 15 12 12 15 15"></polyline>
              </svg>
            `;
          }

          if (metaEl) {
            metaEl.textContent = `${reqDesc} • (Max 5MB)`;
          }

          if (actionsEl) {
            actionsEl.innerHTML = `
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 100%;">
                <button type="button" class="btn-slot-upload" id="btn-upload-${slotKey}" style="min-height: 44px; border-radius: 10px; font-size: 13px; font-weight: 700; padding: 0 10px;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  <span>Upload File</span>
                </button>
                <button type="button" class="btn-followup-toggle" id="btn-toggle-${slotKey}" style="min-height: 44px; border-radius: 10px; font-size: 13px; font-weight: 700; padding: 0 10px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  <span>Follow Up Later</span>
                </button>
              </div>
            `;

            const btnUpload = actionsEl.querySelector(`#btn-upload-${slotKey}`);
            const btnToggle = actionsEl.querySelector(`#btn-toggle-${slotKey}`);

            if (btnUpload) {
              btnUpload.onclick = (e) => {
                e.stopPropagation();
                fileInput.click();
              };
            }

            if (btnToggle) {
              btnToggle.onclick = (e) => {
                e.stopPropagation();
                uploadedFiles[slotKey] = {
                  status: "to_follow_up",
                  file: null,
                  reqTitle: reqTitle,
                  reqDesc: reqDesc,
                };
                updateSlotUI();
                showToast(`"${reqTitle}" marked as To Follow Up later`);
              };
            }
          }
        }
      }

      updateSlotUI();

      fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
          showToast("File size exceeds 5MB limit", true);
          fileInput.value = "";
          return;
        }

        uploadedFiles[slotKey] = {
          status: "uploaded",
          file: file,
          reqTitle: reqTitle,
          reqDesc: reqDesc,
        };

        // Hide inline error box if it was active
        const errorBox = document.getElementById("dropbox-error-box");
        if (errorBox) errorBox.style.display = "none";

        updateSlotUI();
        showToast(`${file.name} attached for ${reqTitle}`);
      });
    });
  }

  // Submit Application Flow with Confirmation Modal and Validation
  const confirmModalOverlay = document.getElementById("confirm-app-modal-overlay");
  const btnCloseConfirmModal = document.getElementById("btn-close-confirm-modal");
  const btnBackFromConfirm = document.getElementById("btn-back-from-confirm");
  const btnFinalConfirmSubmit = document.getElementById("btn-final-confirm-submit");
  const confirmScholTitle = document.getElementById("confirm-modal-schol-title");
  const confirmDocsSummary = document.getElementById("confirm-modal-docs-summary");
  const errorBox = document.getElementById("dropbox-error-box");
  const errorText = document.getElementById("dropbox-error-text");

  function closeConfirmModal() {
    if (confirmModalOverlay) confirmModalOverlay.classList.remove("active");
  }

  if (btnCloseConfirmModal) btnCloseConfirmModal.onclick = closeConfirmModal;
  if (btnBackFromConfirm) btnBackFromConfirm.onclick = closeConfirmModal;

  if (btnSubmitDropbox) {
    btnSubmitDropbox.addEventListener("click", () => {
      if (!activeScholarship) return;

      const currentStudentEmail = (
        sessionStorage.getItem("nexo-student-email") ||
        localStorage.getItem("nexo-student-email") ||
        ""
      ).toLowerCase();

      const alreadyApplied = studentApplications.some(
        (a) =>
          (a.studentEmail || "").toLowerCase() === currentStudentEmail &&
          String(a.scholarshipId) === String(activeScholarship.id),
      );
      if (alreadyApplied) {
        showToast("You have already applied for this scholarship.", true);
        closeModal();
        return;
      }

      // Validate each required document slot directly from rendered cards
      const slotCards = document.querySelectorAll("#dropbox-slots-container .dropbox-slot-card");
      let unhandledSlots = [];

      slotCards.forEach((slotCard) => {
        const slotKey = slotCard.dataset.slot || slotCard.id.replace("slot-", "");
        const item = uploadedFiles[slotKey];
        const isHandled =
          item &&
          (item.status === "uploaded" || item.status === "to_follow_up");

        if (!isHandled) {
          unhandledSlots.push(slotKey);
          slotCard.classList.add("slot-error");
          let inlineErr = slotCard.querySelector(".slot-inline-error");
          if (!inlineErr) {
            inlineErr = document.createElement("div");
            inlineErr.className = "slot-inline-error";
            inlineErr.style.cssText =
              "background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 8px; padding: 8px 12px; margin-top: 10px; font-size: 12px; font-weight: 600; color: #ef4444; display: flex; align-items: center; gap: 8px;";
            inlineErr.innerHTML = `
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink: 0;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              <span>Upload a file now or click <strong>"Follow Up Later"</strong> to submit without this file.</span>
            `;
            slotCard.appendChild(inlineErr);
          }
        } else {
          slotCard.classList.remove("slot-error");
          const inlineErr = slotCard.querySelector(".slot-inline-error");
          if (inlineErr) inlineErr.remove();
        }
      });

      if (unhandledSlots.length > 0) {
        const firstCard = document.getElementById(`slot-${unhandledSlots[0]}`);
        if (firstCard) {
          firstCard.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        showToast(
          "Action required: Upload a file or choose 'Follow Up Later' for each requirement.",
          true,
        );
        return;
      }

      if (errorBox) errorBox.style.display = "none";

      const attachedKeys = Object.keys(uploadedFiles).filter((k) => {
        const item = uploadedFiles[k];
        return item && item.status === "uploaded" && item.file instanceof File;
      });

      // Populate & Open Confirmation Modal
      if (confirmScholTitle) {
        confirmScholTitle.textContent =
          activeScholarship.title || "Scholarship Program";
      }

      if (confirmDocsSummary) {
        let summaryHtml = "";
        if (attachedKeys.length > 0) {
          attachedKeys.forEach((k) => {
            const item = uploadedFiles[k];
            const isPdf =
              item.file && item.file.name
                ? item.file.name.toLowerCase().endsWith(".pdf")
                : false;
            summaryHtml += `
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 13px;">
                <span style="display: inline-flex; align-items: center; gap: 6px; font-weight: 700; color: var(--text-primary); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" style="flex-shrink: 0;"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  ${escapeHtml(item.reqTitle)}
                </span>
                <span style="font-size: 11.5px; font-weight: 700; color: #10b981; flex-shrink: 0; background: rgba(16, 185, 129, 0.12); padding: 2px 7px; border-radius: 6px;">
                  ${isPdf ? "PDF" : "IMG"} Attached
                </span>
              </div>
            `;
          });
        }

        const followUpKeys = Object.keys(uploadedFiles).filter((k) => {
          const item = uploadedFiles[k];
          return item && item.status === "to_follow_up";
        });

        if (followUpKeys.length > 0) {
          followUpKeys.forEach((k) => {
            const item = uploadedFiles[k];
            summaryHtml += `
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 13px;">
                <span style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600; color: #D97706; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2.2" style="flex-shrink: 0;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  ${escapeHtml(item.reqTitle)}
                </span>
                <span style="font-size: 11.5px; font-weight: 700; color: #D97706; flex-shrink: 0; background: rgba(245, 158, 11, 0.15); padding: 2px 7px; border-radius: 6px;">
                  To Follow Up Later
                </span>
              </div>
            `;
          });
        }

        if (attachedKeys.length === 0 && followUpKeys.length > 0) {
          summaryHtml += `
            <div style="background: rgba(245, 158, 11, 0.08); border: 1px dashed rgba(245, 158, 11, 0.4); border-radius: 8px; padding: 10px 12px; margin-top: 8px; font-size: 12px; color: #D97706; line-height: 1.45;">
              Notice: All required documents are marked to follow up later. You can submit files anytime under 'My Scholarship Submissions' before provider verification.
            </div>
          `;
        }

        confirmDocsSummary.innerHTML = summaryHtml;
      }

      if (confirmModalOverlay) confirmModalOverlay.classList.add("active");
    });
  }

  // Final Confirmed Submission Execution
  if (btnFinalConfirmSubmit) {
    btnFinalConfirmSubmit.addEventListener("click", async () => {
      closeConfirmModal();

      const allSlots = Object.keys(uploadedFiles);
      const isAnyHandled =
        allSlots.length === 0 ||
        allSlots.every(
          (k) =>
            uploadedFiles[k] &&
            (uploadedFiles[k].status === "uploaded" ||
              uploadedFiles[k].status === "to_follow_up"),
        );

      if (!isAnyHandled) return;

      const attachedKeys = Object.keys(uploadedFiles).filter((k) => {
        const item = uploadedFiles[k];
        return item && item.status === "uploaded" && item.file instanceof File;
      });

      if (btnSubmitDropbox) {
        btnSubmitDropbox.disabled = true;
        btnSubmitDropbox.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="spin">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
            <path d="M12 2a10 10 0 0 1 10 10"></path>
          </svg>
          Submitting Application...
        `;
      }

      // 1. Process files actually attached by student
      const attachedPromises = attachedKeys.map((k) => {
        const item = uploadedFiles[k];
        const file = item.file;
        const reqTitle = item.reqTitle || file.name;
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              name: file.name,
              title: reqTitle,
              requirement: reqTitle,
              size: file.size,
              type: file.type || "application/octet-stream",
              data: reader.result,
              status: "attached",
              isFollowUp: false,
              slot: k,
            });
          };
          reader.onerror = () => {
            resolve({
              name: file.name,
              title: reqTitle,
              requirement: reqTitle,
              size: file.size,
              type: file.type || "application/octet-stream",
              data: null,
              status: "attached",
              isFollowUp: false,
              slot: k,
            });
          };
          reader.readAsDataURL(file);
        });
      });

      const processedAttachedDocs = await Promise.all(attachedPromises);

      // 2. Process requirements student chose to follow up later
      const followUpKeys = Object.keys(uploadedFiles).filter((k) => {
        const item = uploadedFiles[k];
        return item && item.status === "to_follow_up";
      });

      const followUpDocs = followUpKeys.map((k) => {
        const item = uploadedFiles[k];
        return {
          name: `${item.reqTitle} (To Follow Up)`,
          title: item.reqTitle,
          requirement: item.reqTitle,
          size: 0,
          type: "to_follow_up",
          data: null,
          status: "to_follow_up",
          isFollowUp: true,
          slot: k,
        };
      });

      const processedDocs = [...processedAttachedDocs, ...followUpDocs];

      // Ensure we have freshest student settings right before constructing application
      try {
        const curEmail = (
          sessionStorage.getItem("nexo-student-email") ||
          localStorage.getItem("nexo-student-email") ||
          (studentSettings && studentSettings.email) ||
          ""
        ).toLowerCase().trim();
        if (curEmail) {
          const raw = localStorage.getItem(`nexo_student_settings_${curEmail}`);
          if (raw) studentSettings = JSON.parse(raw);
        }
      } catch (_) {}

      const sEmail =
        sessionStorage.getItem("nexo-student-email") ||
        (studentSettings && studentSettings.email) ||
        "student@batstate-u.edu.ph";
      const emailFallback = sEmail.includes("@") ? sEmail.split("@")[0] : "Student Applicant";
      const sName =
        (studentSettings && studentSettings.fullName && studentSettings.fullName.trim()) ||
        (sessionStorage.getItem("nexo-student-name") && sessionStorage.getItem("nexo-student-name").trim()) ||
        emailFallback;
      const sId = (studentSettings && studentSettings.studentId) || "";
      const sSchool =
        (studentSettings && studentSettings.university) ||
        "";
      const sCourse =
        (studentSettings && studentSettings.course) ||
        "";
      const sYear =
        (studentSettings && studentSettings.yearLevel) || "";
      const sPhone =
        (studentSettings && studentSettings.contactNumber) ||
        "";
      const sBio =
        (studentSettings && studentSettings.bio) ||
        "";
      const sAvatar =
        (typeof window.getStudentAvatar === "function" ? window.getStudentAvatar(sEmail) : null) ||
        sessionStorage.getItem("nexo-student-avatar") ||
        (studentSettings && studentSettings.profilePicture) ||
        "";

      // Build application object
      const newApp = {
        id: "app_" + Date.now(),
        scholarshipId: activeScholarship
          ? activeScholarship.id
          : "schol_nexo_tech_01",
        scholarshipTitle: activeScholarship
          ? activeScholarship.title
          : "Tech for Tomorrow Scholarship",
        providerName: activeScholarship
          ? activeScholarship.providerName
          : "NEXO",
        studentName: sName,
        studentEmail: sEmail,
        studentId: sId,
        university: sSchool,
        course: sCourse,
        yearLevel: sYear,
        contactNumber: sPhone,
        bio: sBio,
        studentProfilePic: sAvatar,
        profilePicture: sAvatar,
        status: "Submitted",
        statusText: "Submitted",
        submittedAt: new Date().toISOString(),
        formattedDate: new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        applicantCount: activeScholarship
          ? `${(parseInt(activeScholarship.applicantTotal || 0, 10) || 0) + 1} / ${activeScholarship.applicantLimit || activeScholarship.maxApplicants || 200} Applicants`
          : "1 / 200 Applicants",
        documents: processedDocs,
        uploadedDocuments: processedAttachedDocs.map((d) => d.name),
      };

      // Save to server
      let saveFailed = false;
      try {
        const resp = await fetch(`${API_BASE}/api/applications`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newApp),
        });
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          showToast(errData.error || "Failed to submit application", true);
          saveFailed = true;
        }
      } catch (err) {
        console.warn("Could not save to /api/applications:", err);
      }

      if (saveFailed) {
        btnSubmitDropbox.disabled = false;
        btnSubmitDropbox.innerHTML = "Submit Application";
        closeModal();
        return;
      }

      // Update in-memory state and re-render feed
      studentApplications.unshift(newApp);

      // Save application to localStorage
      try {
        const cachedApps = JSON.parse(
          localStorage.getItem("nexo_applications") || "[]",
        );
        cachedApps.unshift(newApp);
        localStorage.setItem("nexo_applications", JSON.stringify(cachedApps));
      } catch (_) {}

      // Synchronize applicant count in cached scholarships for provider and student POVs
      try {
        const cachedSchols = JSON.parse(
          localStorage.getItem("nexo_scholarships") || "[]",
        );
        let updated = false;
        cachedSchols.forEach((s) => {
          if (
            (activeScholarship &&
              String(s.id) === String(activeScholarship.id)) ||
            (activeScholarship && s.title === activeScholarship.title)
          ) {
            const limit =
              parseInt(s.applicantLimit || s.maxApplicants || 200, 10) || 200;
            const currentTotal = parseInt(s.applicantTotal || 0, 10) || 0;
            const newTotal = currentTotal + 1;
            s.applicantTotal = newTotal;
            s.applicantLimit = limit;
            s.maxApplicants = limit;
            s.applicantCount = `${newTotal} / ${limit} Applicants`;
            if (
              newTotal >= limit &&
              (s.status || "").toLowerCase() !== "closed"
            ) {
              s.status = "Quota Full";
            }
            updated = true;
          }
        });
        if (updated) {
          localStorage.setItem(
            "nexo_scholarships",
            JSON.stringify(cachedSchols),
          );
        }
      } catch (_) {}

      renderFeed();

      // Dispatch live notification for provider
      try {
        const notifList = JSON.parse(
          localStorage.getItem("nexo_notifications") || "[]",
        );
        const scholName = activeScholarship
          ? activeScholarship.title
          : "Scholarship";
        const docNotice =
          followUpDocs.length > 0
            ? `${processedAttachedDocs.length} document(s) (${followUpDocs.length} to follow up)`
            : `${processedAttachedDocs.length} document(s)`;
        const newNotif = {
          id: "notif_" + Date.now(),
          recipient: "provider",
          title: "New Application Received",
          message: `${sName || "Student Scholar"} applied for "${scholName}" with ${docNotice}.`,
          timestamp: new Date().toISOString(),
          formattedTime: "Just now",
          read: false,
          link: "provider-applications.html",
          appId: newApp.id,
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

      setTimeout(() => {
        btnSubmitDropbox.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Application Submitted!
        `;
        showToast(
          "Application submitted successfully! Your submission is now Under Review.",
        );

        setTimeout(() => {
          closeModal();
          btnSubmitDropbox.disabled = false;
          btnSubmitDropbox.innerHTML = "Submit Application";
          // Redirect to student dashboard to see updated application
          window.location.href = "student-dashboard.html";
        }, 1200);
      }, 900);
    });
  }

  // Initial Load
  fetchLiveScholarships();

  // Live polling for provider scholarship updates every 3.5 seconds
  setInterval(() => {
    if (!modalOverlay || !modalOverlay.classList.contains("active")) {
      fetchLiveScholarships();
    }
  }, 3500);
  window.addEventListener("focus", fetchLiveScholarships);
});
