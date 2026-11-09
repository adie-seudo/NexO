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
  const uploadedFiles = {
    cor: null,
    indigency: null,
    grades: null,
    income: null,
  };

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
      localStorage.getItem("nexo-provider-banner") ||
      window.DEFAULT_PROVIDER_BANNER ||
      "";

    // Format for display
    allScholarships = combined.map((post) => {
      const limit =
        parseInt(post.applicantLimit || post.maxApplicants || 200, 10) || 200;
      let appCount = post.applicantCount;
      if (!appCount || appCount.includes("/ 10 Applicants")) {
        const total = parseInt(post.applicantTotal || 0, 10) || 0;
        appCount = `${total} / ${limit} Applicants`;
      }
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
        status: post.status || "Open",
        applicantLimit: limit,
        maxApplicants: limit,
        applicantTotal: post.applicantTotal || 0,
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
  }

  if (btnType) {
    btnType.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = menuType.classList.contains("show");
      closeAllDropdowns();
      if (!isOpen) menuType.classList.add("show");
    });
  }

  if (btnProvider) {
    btnProvider.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = menuProvider.classList.contains("show");
      closeAllDropdowns();
      if (!isOpen) menuProvider.classList.add("show");
    });
  }

  if (btnStatus) {
    btnStatus.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = menuStatus.classList.contains("show");
      closeAllDropdowns();
      if (!isOpen) menuStatus.classList.add("show");
    });
  }

  document.addEventListener("click", () => {
    closeAllDropdowns();
  });

  function wireDropdownItems() {
    // Type Items
    document.querySelectorAll("[data-filter-type]").forEach((item) => {
      item.onclick = (e) => {
        e.stopPropagation();
        filterType = item.getAttribute("data-filter-type");
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
    });

    // Provider Items
    document.querySelectorAll("[data-filter-provider]").forEach((item) => {
      item.onclick = (e) => {
        e.stopPropagation();
        filterProvider = item.getAttribute("data-filter-provider");
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
    });

    // Status Items
    document.querySelectorAll("[data-filter-status]").forEach((item) => {
      item.onclick = (e) => {
        e.stopPropagation();
        filterStatus = item.getAttribute("data-filter-status");
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
      // Type match
      let matchesType = true;
      if (filterType !== "all") {
        matchesType =
          (item.type && item.type.toLowerCase() === filterType.toLowerCase()) ||
          (item.typeText &&
            item.typeText.toLowerCase().includes(filterType.toLowerCase()));
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
      countLabel.textContent = `Showing ${filtered.length} scholarship${
        filtered.length === 1 ? "" : "s"
      }`;
    }

    if (filtered.length === 0) {
      feedContainer.innerHTML = "";
      if (emptyState) emptyState.style.display = "block";
      return;
    }

    if (emptyState) emptyState.style.display = "none";
    feedContainer.innerHTML = "";

    filtered.forEach((item) => {
      const card = document.createElement("div");
      card.className = "directory-card";

      const initials = (item.providerName || "NEXO")
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

      const logoHtml = item.providerLogo
        ? `<img src="${item.providerLogo}" alt="${item.providerName}">`
        : `<span>${initials || "NX"}</span>`;

      const isQuotaFull = (item.status || "").toLowerCase().includes("quota");
      const isClosed =
        (item.status || "").toLowerCase() === "closed" || isQuotaFull;
      const statusClass = isClosed ? "closed" : "open";
      const statusText = isQuotaFull
        ? "Quota Full"
        : isClosed
          ? "Closed"
          : "Open";

      const existingApp = studentApplications.find(
        (a) => String(a.scholarshipId) === String(item.id),
      );
      const isAlreadyApplied = !!existingApp;

      let applyBtnHtml = "";
      if (isAlreadyApplied) {
        const appStatus = existingApp.status || "Submitted";
        let badgeBg = "#10b981";
        if (appStatus.toLowerCase().includes("review")) badgeBg = "#8b5cf6";
        if (appStatus.toLowerCase().includes("rejected")) badgeBg = "#ef4444";
        applyBtnHtml = `<button type="button" class="directory-apply-btn already-applied-btn" data-id="${item.id}" style="background-color: ${badgeBg}; border-color: ${badgeBg}; color: #ffffff;" title="Click to view details">✓ Applied (${appStatus})</button>`;
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
            : "Recently");

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
              <h3 class="directory-card-title">${item.title}</h3>
              <p class="directory-card-provider">${item.providerName}</p>
            </div>
          </div>
          <span class="directory-status-pill ${statusClass}">${statusText}</span>
        </div>

        <div class="directory-meta-row" style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
          <span class="directory-applicants-tag" style="display: inline-flex; align-items: center; gap: 5px; color: #8b5cf6; font-weight: 700;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            ${escapeHtml(applicantCountDisplay)}
          </span>

          <span class="directory-posted-tag" style="display: inline-flex; align-items: center; gap: 5px; color: var(--text-secondary); font-size: 12.5px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            Posted: ${escapeHtml(postedDate)}
          </span>

          <span class="directory-deadline-tag" style="display: inline-flex; align-items: center; gap: 5px; color: var(--text-secondary); font-size: 12.5px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            Expires: ${escapeHtml(item.formattedDate || "No Deadline")}
          </span>
        </div>

        <p class="directory-card-desc">${item.desc}</p>

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

      // Wire Apply Now Button or Already Applied button
      const btnApply = card.querySelector(".directory-apply-btn");
      if (btnApply && !isClosed) {
        btnApply.addEventListener("click", () => {
          if (btnApply.classList.contains("already-applied-btn")) {
            openDetailsModal(item);
            return;
          }
          openDropboxModal(item);
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
      localStorage.getItem("nexo-provider-banner") ||
      (providerSettings && providerSettings.bannerImage) ||
      window.DEFAULT_PROVIDER_BANNER;

    if (coverImg) {
      if (bannerSrc) {
        coverImg.src = bannerSrc;
        coverImg.style.display = "block";
      } else {
        coverImg.style.display = "none";
        coverImg.src = "";
      }
      coverImg.onerror = function () {
        if (
          window.DEFAULT_PROVIDER_BANNER &&
          this.src !== window.DEFAULT_PROVIDER_BANNER
        ) {
          this.src = window.DEFAULT_PROVIDER_BANNER;
          this.style.display = "block";
        } else {
          this.style.display = "none";
        }
      };
    }

    const logoSrc =
      schol.providerLogo ||
      schol.logoImage ||
      localStorage.getItem("nexo-provider-logo") ||
      (providerSettings && providerSettings.logoImage);

    if (logoBox) {
      if (logoSrc) {
        logoBox.innerHTML = `<img src="${logoSrc}" alt="Logo" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
      } else {
        const initials = (schol.providerName || "NX")
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();
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

    const existingApp = studentApplications.find(
      (a) => String(a.scholarshipId) === String(schol.id),
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
          <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; display: flex; align-items: flex-start; gap: 12px;">
            <div style="width: 24px; height: 24px; border-radius: 50%; background: #10b981; color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <div style="flex: 1;">
              <div style="font-weight: 700; color: var(--text-primary); font-size: 14px;">Application Already Submitted</div>
              <div style="font-size: 13px; color: var(--text-secondary); margin-top: 3px; line-height: 1.45;">
                You have already applied for this scholarship grant on <strong>${escapeHtml(dateFormatted)}</strong>.<br/>
                Current Status: <span style="font-weight: 700; color: ${statusColor};">${escapeHtml(appStatus)}</span>
              </div>
            </div>
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
        btnOpenDropbox.disabled = true;
        btnOpenDropbox.classList.remove("disabled");
        btnOpenDropbox.style.background = "#10b981";
        btnOpenDropbox.style.borderColor = "#10b981";
        btnOpenDropbox.style.color = "#ffffff";
        btnOpenDropbox.style.cursor = "not-allowed";
        btnOpenDropbox.style.opacity = "0.95";
        btnOpenDropbox.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Already Applied (${escapeHtml(appStatus)})
        `;
      } else if (isQuotaFull) {
        btnOpenDropbox.disabled = true;
        btnOpenDropbox.classList.add("disabled");
        btnOpenDropbox.style.background = "";
        btnOpenDropbox.style.borderColor = "";
        btnOpenDropbox.style.color = "";
        btnOpenDropbox.style.cursor = "not-allowed";
        btnOpenDropbox.style.opacity = "";
        btnOpenDropbox.innerHTML = "Applicant Limit Reached (Quota Full)";
      } else if (isClosed) {
        btnOpenDropbox.disabled = true;
        btnOpenDropbox.classList.add("disabled");
        btnOpenDropbox.style.background = "";
        btnOpenDropbox.style.borderColor = "";
        btnOpenDropbox.style.color = "";
        btnOpenDropbox.style.cursor = "not-allowed";
        btnOpenDropbox.style.opacity = "";
        btnOpenDropbox.innerHTML = "Applications are Closed";
      } else {
        btnOpenDropbox.disabled = false;
        btnOpenDropbox.classList.remove("disabled");
        btnOpenDropbox.style.background = "";
        btnOpenDropbox.style.borderColor = "";
        btnOpenDropbox.style.color = "";
        btnOpenDropbox.style.cursor = "";
        btnOpenDropbox.style.opacity = "";
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

  function openDropboxModal(schol) {
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
      openDropboxModal(activeScholarship);
    });
  }

  if (btnBackToDetails) {
    btnBackToDetails.addEventListener("click", () => {
      if (activeScholarship) openDetailsModal(activeScholarship);
    });
  }

  if (btnCloseDropbox) btnCloseDropbox.addEventListener("click", closeModal);

  // File slot handlers
  const slots = ["cor", "indigency", "grades", "income"];
  slots.forEach((key) => {
    const slotCard = document.getElementById(`slot-${key}`);
    const fileInput = document.getElementById(`file-${key}`);
    const iconBox = document.getElementById(`icon-${key}`);
    const titleEl = document.getElementById(`title-${key}`);
    const metaEl = document.getElementById(`meta-${key}`);
    const actionBox = document.getElementById(`action-${key}`);

    if (slotCard && fileInput) {
      slotCard.addEventListener("click", (e) => {
        // If clicking delete button, reset slot
        if (e.target.closest(".btn-slot-delete")) {
          e.stopPropagation();
          resetSlot(key);
          return;
        }
        fileInput.click();
      });

      fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
          showToast("File size exceeds 5MB limit", true);
          fileInput.value = "";
          return;
        }

        uploadedFiles[key] = file;
        const isPdf = file.name.endsWith(".pdf");
        const formattedSize = (file.size / (1024 * 1024)).toFixed(1) + " MB";

        slotCard.classList.add("has-file");

        // Icon
        if (iconBox) {
          iconBox.innerHTML = isPdf
            ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="#E53935"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8" fill="none" stroke="#fff" stroke-width="2"></polyline><text x="7" y="18" fill="#fff" font-size="6" font-weight="bold">PDF</text></svg>`
            : `<svg width="20" height="20" viewBox="0 0 24 24" fill="#6941C6"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5" fill="#fff"></circle><polyline points="21 15 16 10 5 21" fill="none" stroke="#fff" stroke-width="2"></polyline></svg>`;
        }

        // Title and size
        if (metaEl) {
          metaEl.innerHTML = `<span style="font-weight: 600; color: var(--text-primary);">${file.name}</span> &bull; ${formattedSize}`;
        }

        // Action: Green Checkmark + Trash Button
        if (actionBox) {
          actionBox.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#008013">
                <circle cx="12" cy="12" r="10" fill="#E6F9ED"/>
                <path d="M9 12l2 2 4-4" fill="none" stroke="#008013" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <button type="button" class="btn-slot-delete" title="Remove File" style="background: transparent; border: none; cursor: pointer; color: #9CA3AF; padding: 4px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          `;
        }

        showToast(`${file.name} uploaded`);
      });
    }
  });

  function resetSlot(key) {
    uploadedFiles[key] = null;
    const slotCard = document.getElementById(`slot-${key}`);
    const fileInput = document.getElementById(`file-${key}`);
    const iconBox = document.getElementById(`icon-${key}`);
    const metaEl = document.getElementById(`meta-${key}`);
    const actionBox = document.getElementById(`action-${key}`);

    if (fileInput) fileInput.value = "";
    if (slotCard) slotCard.classList.remove("has-file");
    if (iconBox) {
      iconBox.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path><polyline points="12 12 12 17"></polyline><polyline points="9 15 12 12 15 15"></polyline></svg>`;
    }
    if (metaEl) {
      metaEl.textContent = "(PDF, JPG, PNG - Max 5MB)";
    }
    if (actionBox) {
      actionBox.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
    }
  }

  // Submit Application
  if (btnSubmitDropbox) {
    btnSubmitDropbox.addEventListener("click", async () => {
      if (!activeScholarship) return;
      const alreadyApplied = studentApplications.some(
        (a) => String(a.scholarshipId) === String(activeScholarship.id),
      );
      if (alreadyApplied) {
        showToast("You have already applied for this scholarship.", true);
        closeModal();
        return;
      }

      btnSubmitDropbox.disabled = true;
      btnSubmitDropbox.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="spin">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
          <path d="M12 2a10 10 0 0 1 10 10"></path>
        </svg>
        Uploading Documents & Submitting...
      `;

      // Convert uploaded file objects to Base64 documents for local file handling
      const docPromises = Object.keys(uploadedFiles)
        .filter((k) => uploadedFiles[k] !== null)
        .map((k) => {
          const file = uploadedFiles[k];
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                name: file.name,
                size: file.size,
                type: file.type || "application/octet-stream",
                data: reader.result,
                slot: k,
              });
            };
            reader.onerror = () => {
              resolve({
                name: file.name,
                size: file.size,
                type: file.type || "application/octet-stream",
                data: null,
                slot: k,
              });
            };
            reader.readAsDataURL(file);
          });
        });

      const processedDocs = await Promise.all(docPromises);

      // Student details from settings or session
      const sName =
        sessionStorage.getItem("nexo-student-name") ||
        (studentSettings && studentSettings.fullName) ||
        "Juan Dela Cruz";
      const sEmail =
        sessionStorage.getItem("nexo-student-email") ||
        (studentSettings && studentSettings.email) ||
        "admin@admin.edu.ph";
      const sId = (studentSettings && studentSettings.studentId) || "21-04589";
      const sSchool =
        (studentSettings && studentSettings.university) ||
        "Batangas State University";
      const sCourse =
        (studentSettings && studentSettings.course) ||
        "BS Information Technology";
      const sYear =
        (studentSettings && studentSettings.yearLevel) || "3rd Year";
      const sPhone =
        (studentSettings && studentSettings.contactNumber) ||
        "+63 912 345 6789";
      const sAvatar =
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
        uploadedDocuments: processedDocs.map((d) => d.name),
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
      renderFeed();

      // Save to localStorage
      try {
        const cachedApps = JSON.parse(
          localStorage.getItem("nexo_applications") || "[]",
        );
        cachedApps.unshift(newApp);
        localStorage.setItem("nexo_applications", JSON.stringify(cachedApps));
      } catch (_) {}

      // Dispatch live notification for provider
      try {
        const notifList = JSON.parse(
          localStorage.getItem("nexo_notifications") || "[]",
        );
        const scholName = activeScholarship
          ? activeScholarship.title
          : "Scholarship";
        const newNotif = {
          id: "notif_" + Date.now(),
          recipient: "provider",
          title: "New Application Received",
          message: `${sName || "Juan Dela Cruz"} applied for "${scholName}" with ${processedDocs.length} document(s).`,
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
