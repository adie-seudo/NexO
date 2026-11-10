// ==========================================================================
// NEXO DEVELOPER ADMIN CONSOLE ENGINE
// Standalone developer portal for account creation, student/provider management,
// cascade account deletion/banning, and JSON database cleaning.
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
  const isHttp =
    window.location.protocol === "http:" ||
    window.location.protocol === "https:";
  const API_BASE = isHttp ? "" : "http://localhost:3000";

  // State
  let users = [];
  let scholarships = [];
  let applications = [];
  let drafts = [];
  let activeTab = "students";
  let activeRoleSelection = "student";
  let pendingDeleteTarget = null; // { type: 'user' | 'scholarship' | 'all_apps' | 'all_drafts' | 'factory', id, name, role }

  // DOM Elements - Navigation Tabs
  const tabBtnStudents = document.getElementById("tab-btn-students");
  const tabBtnProviders = document.getElementById("tab-btn-providers");
  const tabBtnCleaner = document.getElementById("tab-btn-cleaner");
  const secStudents = document.getElementById("section-students");
  const secProviders = document.getElementById("section-providers");
  const secCleaner = document.getElementById("section-cleaner");

  // DOM Elements - Search and Filters
  const searchStudentsInput = document.getElementById("search-students");
  const filterStudentStatus = document.getElementById("filter-student-status");
  const searchProvidersInput = document.getElementById("search-providers");
  const filterProviderStatus = document.getElementById("filter-provider-status");

  // DOM Elements - Containers
  const studentsListContainer = document.getElementById("students-list-container");
  const providersListContainer = document.getElementById("providers-list-container");
  const cleanerScholsList = document.getElementById("cleaner-scholarships-list");

  // DOM Elements - Badges & Stats
  const statStudentCount = document.getElementById("stat-student-count");
  const statProviderCount = document.getElementById("stat-provider-count");
  const statScholCount = document.getElementById("stat-schol-count");
  const statAppCount = document.getElementById("stat-app-count");
  const badgeTabStudents = document.getElementById("badge-tab-students");
  const badgeTabProviders = document.getElementById("badge-tab-providers");
  const cleanerAppCount = document.getElementById("cleaner-app-count");
  const cleanerDraftCount = document.getElementById("cleaner-draft-count");
  const liveSyncIndicator = document.getElementById("live-sync-indicator");

  // DOM Elements - Modals
  const createModal = document.getElementById("admin-create-modal");
  const confirmModal = document.getElementById("admin-confirm-modal");
  const btnOpenCreate = document.getElementById("btn-open-create-user");
  const btnCloseCreate = document.getElementById("close-create-modal");
  const btnCancelCreate = document.getElementById("btn-cancel-create");
  const formCreateAccount = document.getElementById("form-create-account");
  const roleBtnStudent = document.getElementById("role-btn-student");
  const roleBtnProvider = document.getElementById("role-btn-provider");
  const inputUserEmail = document.getElementById("input-user-email");
  const inputUserName = document.getElementById("input-user-name");
  const inputUserPassword = document.getElementById("input-user-password");
  const labelUserName = document.getElementById("label-user-name");
  const emailHint = document.getElementById("email-hint");
  const selectUserStatus = document.getElementById("select-user-status");

  const confirmModalTitle = document.getElementById("confirm-modal-title");
  const confirmModalDesc = document.getElementById("confirm-modal-desc");
  const btnCancelConfirm = document.getElementById("btn-cancel-confirm");
  const btnExecuteConfirm = document.getElementById("btn-execute-confirm");

  // DOM Elements - Cleaner Actions & Export
  const btnPurgeApps = document.getElementById("btn-purge-apps");
  const btnPurgeDrafts = document.getElementById("btn-purge-drafts");
  const btnFactoryReset = document.getElementById("btn-factory-reset");
  const btnExportJson = document.getElementById("btn-export-json");
  const btnAdminTheme = document.getElementById("btn-admin-theme");

  // -------------------------------------------------------------
  // 1. TOAST FEEDBACK NOTIFIER
  // -------------------------------------------------------------
  const adminToast = document.getElementById("admin-toast");
  const adminToastText = document.getElementById("admin-toast-text");
  let toastTimeout = null;

  function showToast(message, isError = false) {
    if (!adminToast || !adminToastText) return;
    adminToastText.textContent = message;
    adminToast.style.borderColor = isError
      ? "rgba(239, 68, 68, 0.5)"
      : "rgba(16, 185, 129, 0.5)";
    adminToast.style.background = isError ? "#3b1111" : "#112e1f";
    adminToast.style.opacity = "1";
    adminToast.style.transform = "translateY(0)";
    adminToast.style.pointerEvents = "auto";

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      adminToast.style.opacity = "0";
      adminToast.style.transform = "translateY(100px)";
      adminToast.style.pointerEvents = "none";
    }, 3200);
  }

  function escapeHtml(text) {
    if (!text) return "";
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // -------------------------------------------------------------
  // 2. THEME TOGGLE
  // -------------------------------------------------------------
  if (btnAdminTheme) {
    btnAdminTheme.addEventListener("click", () => {
      const isDark = document.body.classList.toggle("dark-theme");
      document.documentElement.classList.toggle("dark-theme", isDark);
      localStorage.setItem("nexo-theme", isDark ? "dark" : "light");
    });
  }

  // -------------------------------------------------------------
  // 3. TAB NAVIGATION
  // -------------------------------------------------------------
  function switchTab(target) {
    activeTab = target;
    [tabBtnStudents, tabBtnProviders, tabBtnCleaner].forEach((btn) => {
      if (btn) btn.classList.remove("active");
    });
    [secStudents, secProviders, secCleaner].forEach((sec) => {
      if (sec) sec.style.display = "none";
    });

    if (target === "students") {
      if (tabBtnStudents) tabBtnStudents.classList.add("active");
      if (secStudents) secStudents.style.display = "block";
      renderStudentsList();
    } else if (target === "providers") {
      if (tabBtnProviders) tabBtnProviders.classList.add("active");
      if (secProviders) secProviders.style.display = "block";
      renderProvidersList();
    } else if (target === "cleaner") {
      if (tabBtnCleaner) tabBtnCleaner.classList.add("active");
      if (secCleaner) secCleaner.style.display = "block";
      renderCleanerTab();
    }
  }

  if (tabBtnStudents)
    tabBtnStudents.addEventListener("click", () => switchTab("students"));
  if (tabBtnProviders)
    tabBtnProviders.addEventListener("click", () => switchTab("providers"));
  if (tabBtnCleaner)
    tabBtnCleaner.addEventListener("click", () => switchTab("cleaner"));

  // -------------------------------------------------------------
  // 4. FETCH DATA FROM LOCAL BACKEND (File Handling Engine)
  // -------------------------------------------------------------
  async function loadData() {
    let loadedFromApi = false;
    try {
      const res = await fetch(`${API_BASE}/api/data`, {
        cache: "no-store",
      }).catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        users = Array.isArray(data.users) ? data.users : [];
        scholarships = Array.isArray(data.scholarships)
          ? data.scholarships
          : [];
        applications = Array.isArray(data.applications)
          ? data.applications
          : [];
        drafts = Array.isArray(data.drafts) ? data.drafts : [];
        loadedFromApi = true;

        // Cache to localStorage for offline resilience
        try {
          localStorage.setItem("nexo_users", JSON.stringify(users));
          localStorage.setItem(
            "nexo_scholarships",
            JSON.stringify(scholarships),
          );
          localStorage.setItem(
            "nexo_applications",
            JSON.stringify(applications),
          );
          localStorage.setItem("nexo_drafts", JSON.stringify(drafts));
        } catch (_) {}
      }
    } catch (e) {
      console.warn("Could not fetch /api/data:", e);
    }

    if (!loadedFromApi) {
      // Fallback to localStorage
      try {
        users = JSON.parse(localStorage.getItem("nexo_users") || "[]");
        scholarships = JSON.parse(
          localStorage.getItem("nexo_scholarships") || "[]",
        );
        applications = JSON.parse(
          localStorage.getItem("nexo_applications") || "[]",
        );
        drafts = JSON.parse(localStorage.getItem("nexo_drafts") || "[]");
      } catch (_) {}
    }

    // Ensure default admin accounts exist if list is empty
    ensureDefaultAccounts();

    if (liveSyncIndicator) {
      liveSyncIndicator.style.display = "inline-flex";
    }

    renderAll();
  }

  function ensureDefaultAccounts() {
    let updated = false;
    // Always purge any legacy "Juan Dela Cruz" or "admin@admin.edu.ph" residuals
    const initialLen = users.length;
    users = users.filter((u) => u && u.email !== "admin@admin.edu.ph" && u.name !== "Juan Dela Cruz");
    if (users.length !== initialLen) updated = true;

    // Only seed initial default baseline accounts if the user list is completely empty
    if (users.length === 0) {
      users.push({
        id: "usr_prov_nexo",
        email: "admin@admin",
        password: "admin",
        role: "provider",
        name: "NEXO",
        orgName: "NEXO",
        createdAt: "2026-11-01T08:00:00.000Z",
        formattedDate: "Nov 1, 2026",
        status: "active",
        notes: "Primary Scholarship Provider Account",
      });
      users.push({
        id: "usr_stud_adrian",
        email: "adrian@batstate-u.edu.ph",
        password: "password123",
        role: "student",
        name: "Adrian Del Mundo",
        university: "Batangas State University",
        course: "BS Information Technology",
        yearLevel: "3rd Year",
        createdAt: "2026-11-01T08:00:00.000Z",
        formattedDate: "Nov 1, 2026",
        status: "active",
        notes: "Verified Student Account",
      });
      users.push({
        id: "usr_stud_2402924",
        email: "24-02924@g.batstate-u.edu.ph",
        password: "password123",
        role: "student",
        name: "Student 24-02924",
        university: "Batangas State University",
        course: "BS Information Technology",
        yearLevel: "1st Year",
        studentId: "24-02924",
        createdAt: "2026-11-09T08:00:00.000Z",
        formattedDate: "Nov 9, 2026",
        status: "active",
        notes: "Student Account created via Admin Panel",
      });
      updated = true;
    }

    if (updated) {
      try {
        localStorage.setItem("nexo_users", JSON.stringify(users));
      } catch (_) {}
    }
  }

  // -------------------------------------------------------------
  // 5. RENDER FUNCTIONS
  // -------------------------------------------------------------
  function renderAll() {
    renderStats();
    if (activeTab === "students") renderStudentsList();
    else if (activeTab === "providers") renderProvidersList();
    else if (activeTab === "cleaner") renderCleanerTab();
  }

  function renderStats() {
    const studentUsers = users.filter((u) => u.role === "student");
    const providerUsers = users.filter((u) => u.role === "provider");

    if (statStudentCount) statStudentCount.textContent = studentUsers.length;
    if (statProviderCount) statProviderCount.textContent = providerUsers.length;
    if (statScholCount) statScholCount.textContent = scholarships.length;
    if (statAppCount) statAppCount.textContent = applications.length;

    if (badgeTabStudents) badgeTabStudents.textContent = studentUsers.length;
    if (badgeTabProviders) badgeTabProviders.textContent = providerUsers.length;
    if (cleanerAppCount) cleanerAppCount.textContent = applications.length;
    if (cleanerDraftCount) cleanerDraftCount.textContent = drafts.length;
  }

  // 5A. Render Student Accounts List
  function renderStudentsList() {
    if (!studentsListContainer) return;
    studentsListContainer.innerHTML = "";

    const query = (
      searchStudentsInput ? searchStudentsInput.value : ""
    ).toLowerCase();
    const filterStatus = filterStudentStatus
      ? filterStudentStatus.value
      : "all";

    let studentUsers = users.filter((u) => u.role === "student");

    if (filterStatus === "active") {
      studentUsers = studentUsers.filter((u) => u.status !== "banned");
    } else if (filterStatus === "banned") {
      studentUsers = studentUsers.filter((u) => u.status === "banned");
    }

    if (query) {
      studentUsers = studentUsers.filter((u) => {
        const email = (u.email || "").toLowerCase();
        const name = (u.name || "").toLowerCase();
        const course = (u.course || "").toLowerCase();
        const uni = (u.university || "").toLowerCase();
        return (
          email.includes(query) ||
          name.includes(query) ||
          course.includes(query) ||
          uni.includes(query)
        );
      });
    }

    if (studentUsers.length === 0) {
      studentsListContainer.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; background: var(--bg-surface); border: 1px dashed var(--border-color); border-radius: 14px;">
          <p style="margin: 0; font-size: 14.5px; color: var(--text-secondary);">No student accounts found matching your query.</p>
          <button type="button" class="btn btn-primary" id="btn-empty-add-student" style="margin-top: 14px; font-size: 13px;">+ Create Student Account</button>
        </div>
      `;
      const btnEmptyAdd = document.getElementById("btn-empty-add-student");
      if (btnEmptyAdd) {
        btnEmptyAdd.addEventListener("click", () => openCreateModal("student"));
      }
      return;
    }

    studentUsers.forEach((user) => {
      const isBanned = user.status === "banned";
      const name = user.name || "Student User";
      const initials = name
        .split(" ")
        .map((w) => w[0] || "")
        .slice(0, 2)
        .join("")
        .toUpperCase();

      // Count applications submitted by this student
      const userApps = applications.filter((a) => {
        const emailMatch =
          (a.studentEmail || "").toLowerCase() === user.email.toLowerCase();
        const idMatch = user.studentId && a.studentId === user.studentId;
        return emailMatch || idMatch;
      });

      const card = document.createElement("div");
      card.className = `admin-account-card ${isBanned ? "is-banned" : ""}`;
      card.dataset.id = user.id;

      card.innerHTML = `
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 14px; min-width: 0;">
            <div class="admin-account-avatar">${escapeHtml(initials || "ST")}</div>
            <div style="min-width: 0;">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: var(--text-primary);">${escapeHtml(name)}</h3>
                <span class="admin-status-chip ${isBanned ? "status-chip-banned" : "status-chip-active"}">
                  ${isBanned ? "● Banned" : "● Active"}
                </span>
              </div>
              <p style="margin: 3px 0 0 0; font-size: 13px; font-weight: 600; color: #8b5cf6; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span>${escapeHtml(user.email)}</span>
                <span style="font-size: 11px; background: rgba(139, 92, 246, 0.12); color: #8b5cf6; padding: 2px 7px; border-radius: 6px; font-weight: 700;">🔑 Password: ${escapeHtml(user.password || "password123")}</span>
              </p>
              <p style="margin: 2px 0 0 0; font-size: 12px; color: var(--text-secondary);">
                ${escapeHtml(user.course || "BS Information Technology")} &bull; ${escapeHtml(user.university || "Batangas State University")}
              </p>
            </div>
          </div>

          <div style="text-align: right; font-size: 12px; color: var(--text-secondary);">
            <div>Registered: <strong style="color: var(--text-primary);">${escapeHtml(user.formattedDate || "Recently")}</strong></div>
            <div style="margin-top: 3px;">Activity: <strong style="color: #8b5cf6;">${userApps.length} Application(s)</strong></div>
          </div>
        </div>

        ${user.notes ? `<div style="font-size: 11.5px; color: var(--text-secondary); background: var(--bg-canvas); padding: 6px 10px; border-radius: 6px;">Note: ${escapeHtml(user.notes)}</div>` : ""}

        <div class="admin-card-actions">
          <button type="button" class="btn-admin-action ${isBanned ? "btn-admin-unban" : "btn-admin-ban"}" data-action="toggle-ban" data-id="${user.id}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              ${isBanned ? '<polyline points="20 6 9 17 4 12"></polyline>' : '<circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>'}
            </svg>
            ${isBanned ? "Unban Account" : "Ban Account"}
          </button>

          <button type="button" class="btn-admin-action btn-admin-delete" data-action="delete" data-id="${user.id}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            Delete Account
          </button>
        </div>
      `;

      // Wire action buttons
      const btnToggleBan = card.querySelector('[data-action="toggle-ban"]');
      if (btnToggleBan) {
        btnToggleBan.addEventListener("click", () =>
          toggleAccountBan(user.id, !isBanned),
        );
      }

      const btnDelete = card.querySelector('[data-action="delete"]');
      if (btnDelete) {
        btnDelete.addEventListener("click", () => {
          promptDeleteConfirm({
            type: "user",
            id: user.id,
            email: user.email,
            name: user.name,
            role: "student",
            appCount: userApps.length,
          });
        });
      }

      studentsListContainer.appendChild(card);
    });
  }

  // 5B. Render Provider Accounts List
  function renderProvidersList() {
    if (!providersListContainer) return;
    providersListContainer.innerHTML = "";

    const query = (
      searchProvidersInput ? searchProvidersInput.value : ""
    ).toLowerCase();
    const filterStatus = filterProviderStatus
      ? filterProviderStatus.value
      : "all";

    let providerUsers = users.filter((u) => u.role === "provider");

    if (filterStatus === "active") {
      providerUsers = providerUsers.filter((u) => u.status !== "banned");
    } else if (filterStatus === "banned") {
      providerUsers = providerUsers.filter((u) => u.status === "banned");
    }

    if (query) {
      providerUsers = providerUsers.filter((u) => {
        const email = (u.email || "").toLowerCase();
        const name = (u.name || u.orgName || "").toLowerCase();
        return email.includes(query) || name.includes(query);
      });
    }

    if (providerUsers.length === 0) {
      providersListContainer.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; background: var(--bg-surface); border: 1px dashed var(--border-color); border-radius: 14px;">
          <p style="margin: 0; font-size: 14.5px; color: var(--text-secondary);">No provider accounts found matching your query.</p>
          <button type="button" class="btn btn-primary" id="btn-empty-add-provider" style="margin-top: 14px; font-size: 13px;">+ Create Provider Account</button>
        </div>
      `;
      const btnEmptyAdd = document.getElementById("btn-empty-add-provider");
      if (btnEmptyAdd) {
        btnEmptyAdd.addEventListener("click", () => openCreateModal("provider"));
      }
      return;
    }

    providerUsers.forEach((user) => {
      const isBanned = user.status === "banned";
      const orgName = user.orgName || user.name || "Scholarship Provider";
      const initials = orgName
        .split(" ")
        .map((w) => w[0] || "")
        .slice(0, 2)
        .join("")
        .toUpperCase();

      // Count scholarships posted by this provider
      const userSchols = scholarships.filter((s) => {
        const nameMatch =
          s.providerName &&
          (s.providerName === user.name ||
            s.providerName === user.orgName ||
            s.providerName === user.email);
        const emailMatch =
          s.providerEmail &&
          s.providerEmail.toLowerCase() === user.email.toLowerCase();
        return nameMatch || emailMatch;
      });

      const card = document.createElement("div");
      card.className = `admin-account-card is-provider ${isBanned ? "is-banned" : ""}`;
      card.dataset.id = user.id;

      card.innerHTML = `
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 14px; min-width: 0;">
            <div class="admin-account-avatar">${escapeHtml(initials || "PV")}</div>
            <div style="min-width: 0;">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: var(--text-primary);">${escapeHtml(orgName)}</h3>
                <span class="admin-status-chip ${isBanned ? "status-chip-banned" : "status-chip-active"}">
                  ${isBanned ? "● Banned" : "● Active"}
                </span>
              </div>
              <p style="margin: 3px 0 0 0; font-size: 13px; font-weight: 600; color: #10b981; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span>${escapeHtml(user.email)}</span>
                <span style="font-size: 11px; background: rgba(16, 185, 129, 0.12); color: #10b981; padding: 2px 7px; border-radius: 6px; font-weight: 700;">🔑 Password: ${escapeHtml(user.password || "admin")}</span>
              </p>
              <p style="margin: 2px 0 0 0; font-size: 12px; color: var(--text-secondary);">
                Scholarship Organization &bull; Verified Provider
              </p>
            </div>
          </div>

          <div style="text-align: right; font-size: 12px; color: var(--text-secondary);">
            <div>Registered: <strong style="color: var(--text-primary);">${escapeHtml(user.formattedDate || "Recently")}</strong></div>
            <div style="margin-top: 3px;">Active Posts: <strong style="color: #10b981;">${userSchols.length} Scholarship(s)</strong></div>
          </div>
        </div>

        ${user.notes ? `<div style="font-size: 11.5px; color: var(--text-secondary); background: var(--bg-canvas); padding: 6px 10px; border-radius: 6px;">Note: ${escapeHtml(user.notes)}</div>` : ""}

        <div class="admin-card-actions">
          <button type="button" class="btn-admin-action ${isBanned ? "btn-admin-unban" : "btn-admin-ban"}" data-action="toggle-ban" data-id="${user.id}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              ${isBanned ? '<polyline points="20 6 9 17 4 12"></polyline>' : '<circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>'}
            </svg>
            ${isBanned ? "Unban Account" : "Ban Account"}
          </button>

          <button type="button" class="btn-admin-action btn-admin-delete" data-action="delete" data-id="${user.id}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            Delete Account
          </button>
        </div>
      `;

      // Wire action buttons
      const btnToggleBan = card.querySelector('[data-action="toggle-ban"]');
      if (btnToggleBan) {
        btnToggleBan.addEventListener("click", () =>
          toggleAccountBan(user.id, !isBanned),
        );
      }

      const btnDelete = card.querySelector('[data-action="delete"]');
      if (btnDelete) {
        btnDelete.addEventListener("click", () => {
          promptDeleteConfirm({
            type: "user",
            id: user.id,
            email: user.email,
            name: orgName,
            role: "provider",
            postCount: userSchols.length,
          });
        });
      }

      providersListContainer.appendChild(card);
    });
  }

  // 5C. Render Cleaner Tab (Crowded Database Sanitizer)
  function renderCleanerTab() {
    if (!cleanerScholsList) return;
    cleanerScholsList.innerHTML = "";

    if (scholarships.length === 0) {
      cleanerScholsList.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--text-secondary); background: var(--bg-surface); border-radius: 10px;">
          No scholarships found in database.
        </div>
      `;
      return;
    }

    scholarships.forEach((s) => {
      const item = document.createElement("div");
      item.className = "admin-clean-item";

      // Count applications for this scholarship
      const appCount = applications.filter(
        (a) => String(a.scholarshipId) === String(s.id),
      ).length;

      item.innerHTML = `
        <div style="min-width: 0; flex: 1;">
          <h4 style="margin: 0; font-size: 14px; font-weight: 800; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${escapeHtml(s.title || "Untitled")}
          </h4>
          <p style="margin: 3px 0 0 0; font-size: 12px; color: var(--text-secondary);">
            Provider: ${escapeHtml(s.providerName || "NEXO")} &bull; Deadline: ${escapeHtml(s.formattedDate || "No Deadline")} &bull; <strong style="color: #8b5cf6;">${appCount} Applications</strong>
          </p>
        </div>

        <button type="button" class="btn-admin-action" data-delete-schol="${s.id}" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.35); flex-shrink: 0;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          Delete Post
        </button>
      `;

      item
        .querySelector(`[data-delete-schol="${s.id}"]`)
        .addEventListener("click", () => {
          promptDeleteConfirm({
            type: "scholarship",
            id: s.id,
            title: s.title,
            appCount: appCount,
          });
        });

      cleanerScholsList.appendChild(item);
    });
  }

  // Search input listeners
  if (searchStudentsInput)
    searchStudentsInput.addEventListener("input", renderStudentsList);
  if (filterStudentStatus)
    filterStudentStatus.addEventListener("change", renderStudentsList);
  if (searchProvidersInput)
    searchProvidersInput.addEventListener("input", renderProvidersList);
  if (filterProviderStatus)
    filterProviderStatus.addEventListener("change", renderProvidersList);

  // -------------------------------------------------------------
  // 6. ACCOUNT CREATION
  // -------------------------------------------------------------
  function openCreateModal(defaultRole = "student") {
    activeRoleSelection = defaultRole;
    if (activeRoleSelection === "provider") {
      roleBtnProvider.classList.add("active");
      roleBtnStudent.classList.remove("active");
      if (inputUserEmail)
        inputUserEmail.placeholder = "e.g., contact@foundation.org";
      if (labelUserName)
        labelUserName.textContent = "Organization Name (Optional)";
      if (inputUserName) inputUserName.placeholder = "e.g., Ayala Foundation";
      if (emailHint)
        emailHint.textContent = "Any valid organization email is accepted.";
    } else {
      roleBtnStudent.classList.add("active");
      roleBtnProvider.classList.remove("active");
      if (inputUserEmail)
        inputUserEmail.placeholder = "e.g., student@batstate-u.edu.ph";
      if (labelUserName) labelUserName.textContent = "Full Name (Optional)";
      if (inputUserName) inputUserName.placeholder = "e.g., Adrian Del Mundo";
      if (emailHint)
        emailHint.textContent =
          "Recommended: Use .edu.ph for student accounts.";
    }

    if (inputUserEmail) inputUserEmail.value = "";
    if (inputUserName) inputUserName.value = "";
    if (inputUserPassword) inputUserPassword.value = "";
    if (selectUserStatus) selectUserStatus.value = "active";

    if (createModal) createModal.classList.add("active");
    if (inputUserEmail) inputUserEmail.focus();
  }

  function closeCreateModal() {
    if (createModal) createModal.classList.remove("active");
  }

  if (btnOpenCreate)
    btnOpenCreate.addEventListener("click", () => openCreateModal("student"));
  if (btnCloseCreate) btnCloseCreate.addEventListener("click", closeCreateModal);
  if (btnCancelCreate)
    btnCancelCreate.addEventListener("click", closeCreateModal);

  if (roleBtnStudent) {
    roleBtnStudent.addEventListener("click", () => {
      openCreateModal("student");
    });
  }

  if (roleBtnProvider) {
    roleBtnProvider.addEventListener("click", () => {
      openCreateModal("provider");
    });
  }

  if (formCreateAccount) {
    formCreateAccount.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = inputUserEmail ? inputUserEmail.value.trim().toLowerCase() : "";
      const name = inputUserName ? inputUserName.value.trim() : "";
      const password = inputUserPassword ? inputUserPassword.value.trim() : "";
      const status = selectUserStatus ? selectUserStatus.value : "active";

      if (!email) {
        showToast("Please enter an account email", true);
        return;
      }

      if (!password) {
        showToast("Please enter an account password", true);
        return;
      }

      // Check duplicate
      if (users.some((u) => u.email.toLowerCase() === email)) {
        showToast(`An account with email "${email}" already exists`, true);
        return;
      }

      const newAccountPayload = {
        email: email,
        password: password,
        role: activeRoleSelection,
        name:
          name ||
          (activeRoleSelection === "provider"
            ? "Scholarship Provider"
            : ""),
        university: "",
        course: "",
        studentId: "",
        contactNumber: "",
        status: status,
        createdByAdmin: true,
      };

      try {
        const res = await fetch(`${API_BASE}/api/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newAccountPayload),
        }).catch(() => null);

        let createdUser = null;
        if (res && res.ok) {
          const respData = await res.json();
          createdUser = respData.user;
        }

        if (!createdUser) {
          // Client-side fallback if server offline
          createdUser = {
            id:
              "usr_" +
              (activeRoleSelection === "provider" ? "prov_" : "stud_") +
              Date.now(),
            ...newAccountPayload,
            createdAt: new Date().toISOString(),
            formattedDate: new Date().toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }),
          };
        }

        users.unshift(createdUser);
        try {
          localStorage.setItem("nexo_users", JSON.stringify(users));
        } catch (_) {}

        showToast(
          `Account for "${email}" created successfully as ${activeRoleSelection === "provider" ? "Provider" : "Student"}!`,
        );
        closeCreateModal();

        // Switch to the created account tab and refresh
        switchTab(activeRoleSelection === "provider" ? "providers" : "students");
        renderStats();
      } catch (err) {
        console.error("Account creation error:", err);
        showToast("Failed to create account. Check connection.", true);
      }
    });
  }

  // -------------------------------------------------------------
  // 7. TOGGLE BAN / UNBAN
  // -------------------------------------------------------------
  async function toggleAccountBan(userId, shouldBan) {
    const targetStatus = shouldBan ? "banned" : "active";
    try {
      await fetch(`${API_BASE}/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      }).catch(() => null);

      const u = users.find((item) => String(item.id) === String(userId));
      if (u) {
        u.status = targetStatus;
        try {
          localStorage.setItem("nexo_users", JSON.stringify(users));
        } catch (_) {}
      }

      showToast(
        shouldBan
          ? "Account has been banned. Login access restricted."
          : "Account has been unbanned. Login access restored.",
      );
      renderAll();
    } catch (err) {
      console.error("Ban toggle error:", err);
      showToast("Could not update account status.", true);
    }
  }

  // -------------------------------------------------------------
  // 8. CONFIRM & EXECUTE CASCADE DELETION
  // -------------------------------------------------------------
  function promptDeleteConfirm(target) {
    pendingDeleteTarget = target;
    if (!confirmModal || !confirmModalTitle || !confirmModalDesc) return;

    if (target.type === "user") {
      confirmModalTitle.textContent = `Delete ${target.role === "provider" ? "Provider" : "Student"} Account?`;
      if (target.role === "provider") {
        confirmModalDesc.innerHTML = `
          Are you sure you want to delete <strong>${escapeHtml(target.name || target.email)}</strong>?<br><br>
          <span style="color: #ef4444; font-weight: 600;">Cascade Warning:</span>
          This will permanently delete this provider account, their <strong>${target.postCount || 0} scholarship post(s)</strong>, and all student applications submitted to those posts from <code>data.json</code>.
        `;
      } else {
        confirmModalDesc.innerHTML = `
          Are you sure you want to delete <strong>${escapeHtml(target.name || target.email)}</strong>?<br><br>
          <span style="color: #ef4444; font-weight: 600;">Cascade Warning:</span>
          This will permanently delete this student account and all <strong>${target.appCount || 0} submitted application(s)</strong> from <code>data.json</code>.
        `;
      }
      btnExecuteConfirm.textContent = "Yes, Delete Account";
    } else if (target.type === "scholarship") {
      confirmModalTitle.textContent = "Delete Scholarship Post?";
      confirmModalDesc.innerHTML = `
        Are you sure you want to delete <strong>"${escapeHtml(target.title)}"</strong>?<br><br>
        This will remove the post and its <strong>${target.appCount || 0} associated application(s)</strong> from <code>data.json</code>.
      `;
      btnExecuteConfirm.textContent = "Yes, Delete Post";
    } else if (target.type === "purge_apps") {
      confirmModalTitle.textContent = "Purge All Applications?";
      confirmModalDesc.innerHTML = `
        Are you sure you want to permanently delete all <strong>${applications.length} student application(s)</strong>? This will clean up the crowded JSON data.
      `;
      btnExecuteConfirm.textContent = "Purge All Applications";
    } else if (target.type === "purge_drafts") {
      confirmModalTitle.textContent = "Clear All Drafts?";
      confirmModalDesc.innerHTML = `
        Are you sure you want to clear all <strong>${drafts.length} test draft(s)</strong>?
      `;
      btnExecuteConfirm.textContent = "Clear All Drafts";
    } else if (target.type === "factory_reset") {
      confirmModalTitle.textContent = "Reset to Factory Default State?";
      confirmModalDesc.innerHTML = `
        <span style="color: #ef4444; font-weight: 700;">Full Sanitization:</span>
        This will wipe all test applications, reset applicant counters on scholarships to 0, and restore default admin accounts.
      `;
      btnExecuteConfirm.textContent = "Reset Database";
    }

    confirmModal.classList.add("active");
  }

  function closeConfirmModal() {
    if (confirmModal) confirmModal.classList.remove("active");
    pendingDeleteTarget = null;
  }

  if (btnCancelConfirm)
    btnCancelConfirm.addEventListener("click", closeConfirmModal);

  if (btnExecuteConfirm) {
    btnExecuteConfirm.addEventListener("click", async () => {
      if (!pendingDeleteTarget) return;

      btnExecuteConfirm.disabled = true;
      btnExecuteConfirm.textContent = "Processing...";

      try {
        if (pendingDeleteTarget.type === "user") {
          const res = await fetch(
            `${API_BASE}/api/users/${pendingDeleteTarget.id}`,
            {
              method: "DELETE",
            },
          ).catch(() => null);

          // Local state cascade removal
          const uid = String(pendingDeleteTarget.id);
          const u = users.find((x) => String(x.id) === uid);
          users = users.filter((x) => String(x.id) !== uid);

          if (pendingDeleteTarget.role === "student") {
            const uEmail = (pendingDeleteTarget.email || "").toLowerCase();
            applications = applications.filter(
              (a) => (a.studentEmail || "").toLowerCase() !== uEmail,
            );
          } else if (pendingDeleteTarget.role === "provider") {
            const provName =
              pendingDeleteTarget.name || pendingDeleteTarget.email;
            const removedIds = scholarships
              .filter((s) => s.providerName === provName)
              .map((s) => String(s.id));
            scholarships = scholarships.filter(
              (s) => !removedIds.includes(String(s.id)),
            );
            const provEmail = (pendingDeleteTarget.email || "").toLowerCase();
            drafts = drafts.filter(
              (d) =>
                (d.providerEmail || "").toLowerCase() !== provEmail &&
                !removedIds.includes(String(d.id)),
            );
            applications = applications.filter(
              (a) => !removedIds.includes(String(a.scholarshipId)),
            );
          }

          try {
            localStorage.setItem("nexo_users", JSON.stringify(users));
            localStorage.setItem(
              "nexo_scholarships",
              JSON.stringify(scholarships),
            );
            localStorage.setItem("nexo_drafts", JSON.stringify(drafts));
            localStorage.setItem(
              "nexo_applications",
              JSON.stringify(applications),
            );
            localStorage.setItem("nexo_drafts", JSON.stringify(drafts));
          } catch (_) {}

          showToast("Account and associated data deleted successfully!");
        } else if (pendingDeleteTarget.type === "scholarship") {
          const sid = String(pendingDeleteTarget.id);
          await fetch(`${API_BASE}/api/admin/clean-database`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "delete_scholarship", id: sid }),
          }).catch(() => null);

          scholarships = scholarships.filter((s) => String(s.id) !== sid);
          applications = applications.filter(
            (a) => String(a.scholarshipId) !== sid,
          );

          try {
            localStorage.setItem(
              "nexo_scholarships",
              JSON.stringify(scholarships),
            );
            localStorage.setItem(
              "nexo_applications",
              JSON.stringify(applications),
            );
          } catch (_) {}

          showToast("Scholarship post and applications deleted!");
        } else if (pendingDeleteTarget.type === "purge_apps") {
          await fetch(`${API_BASE}/api/admin/clean-database`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "clear_applications" }),
          }).catch(() => null);

          applications = [];
          scholarships.forEach((s) => {
            s.applicantTotal = 0;
            s.applicantCount = `0 / ${s.applicantLimit || 200} Applicants`;
          });

          try {
            localStorage.setItem("nexo_applications", "[]");
            localStorage.setItem(
              "nexo_scholarships",
              JSON.stringify(scholarships),
            );
          } catch (_) {}

          showToast("All applications purged from data.json!");
        } else if (pendingDeleteTarget.type === "purge_drafts") {
          await fetch(`${API_BASE}/api/admin/clean-database`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "clear_drafts" }),
          }).catch(() => null);

          drafts = [];
          try {
            localStorage.setItem("nexo_drafts", "[]");
          } catch (_) {}

          showToast("All drafts cleared from data.json!");
        } else if (pendingDeleteTarget.type === "factory_reset") {
          await fetch(`${API_BASE}/api/admin/clean-database`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "reset_factory_data" }),
          }).catch(() => null);

          applications = [];
          drafts = [];
          scholarships.forEach((s) => {
            s.applicantTotal = 0;
            s.applicantCount = `0 / ${s.applicantLimit || 200} Applicants`;
          });

          try {
            localStorage.setItem("nexo_applications", "[]");
            localStorage.setItem("nexo_drafts", "[]");
            localStorage.setItem(
              "nexo_scholarships",
              JSON.stringify(scholarships),
            );
          } catch (_) {}

          showToast("Database restored to clean factory state!");
        }
      } catch (err) {
        console.error("Execute action error:", err);
        showToast("Error executing action.", true);
      } finally {
        btnExecuteConfirm.disabled = false;
        closeConfirmModal();
        renderAll();
      }
    });
  }

  // -------------------------------------------------------------
  // 9. CLEANER BUTTONS & EXPORT
  // -------------------------------------------------------------
  if (btnPurgeApps) {
    btnPurgeApps.addEventListener("click", () => {
      promptDeleteConfirm({ type: "purge_apps" });
    });
  }

  if (btnPurgeDrafts) {
    btnPurgeDrafts.addEventListener("click", () => {
      promptDeleteConfirm({ type: "purge_drafts" });
    });
  }

  if (btnFactoryReset) {
    btnFactoryReset.addEventListener("click", () => {
      promptDeleteConfirm({ type: "factory_reset" });
    });
  }

  if (btnExportJson) {
    btnExportJson.addEventListener("click", () => {
      const fullDb = {
        scholarships,
        drafts,
        applications,
        users,
      };
      const jsonStr = JSON.stringify(fullDb, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = `nexo_data_backup_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(dlUrl);
      showToast("data.json downloaded to your device!");
    });
  }

  // -------------------------------------------------------------
  // 10. INITIAL INITIALIZATION
  // -------------------------------------------------------------
  loadData();
});
