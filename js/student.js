// ==========================================================================
// NEXO STUDENT DASHBOARD JAVASCRIPT (js/student.js)
// Real-time synchronization, mobile-first side menu, notifications & metrics
// ==========================================================================

// =========================================
// 1. HAMBURGER SIDE MENU & OVERLAY LOGIC
// =========================================
function getNavOverlay() {
  let overlay = document.querySelector(".nav-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "nav-overlay";
    document.body.appendChild(overlay);
    overlay.addEventListener("click", closeSideMenu);
  }
  return overlay;
}

function closeSideMenu() {
  const btn =
    document.getElementById("avatar-menu-btn") ||
    document.querySelector(".hamburger-btn");
  const menu =
    document.getElementById("nav-menu") || document.querySelector(".nav-menu");
  const overlay = document.querySelector(".nav-overlay");

  if (btn) btn.classList.remove("open");
  if (menu) menu.classList.remove("open");
  if (overlay) overlay.classList.remove("active");
  document.body.classList.remove("menu-open");
}

function closeNotifications() {
  const popover = document.getElementById("header-notif-popover");
  const notifBtn = document.querySelector(".notification-btn");
  if (popover) popover.classList.remove("open");
  if (notifBtn) notifBtn.setAttribute("aria-expanded", "false");
}

window.handleMenuToggle = function (e) {
  if (e) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  // Always close notifications when opening or toggling side menu
  closeNotifications();

  const btn =
    document.getElementById("avatar-menu-btn") ||
    document.querySelector(".hamburger-btn");
  const menu =
    document.getElementById("nav-menu") || document.querySelector(".nav-menu");
  const overlay = getNavOverlay();

  if (btn && menu) {
    const willOpen = !menu.classList.contains("open");
    btn.classList.toggle("open", willOpen);
    menu.classList.toggle("open", willOpen);
    const isDesktop = window.innerWidth >= 1024;
    if (overlay && !isDesktop) overlay.classList.toggle("active", willOpen);
    if (!isDesktop) document.body.classList.toggle("menu-open", willOpen);
  }
};

// =========================================
// HELPER: Resolve Provider Profile Picture for Submissions
// =========================================
function resolveAppProviderLogo(app) {
  if (app && app.providerLogo && String(app.providerLogo).trim()) {
    return app.providerLogo;
  }
  if (app && app.logo && String(app.logo).trim()) {
    return app.logo;
  }
  let schols = window.cachedScholarships || [];
  if (schols.length === 0) {
    try {
      schols = JSON.parse(localStorage.getItem("nexo_scholarships") || "[]");
    } catch (_) {}
  }
  const match = schols.find(
    (s) =>
      (app && app.scholarshipId && s.id && String(s.id) === String(app.scholarshipId)) ||
      (app && app.scholarshipTitle && s.title && s.title.toLowerCase() === app.scholarshipTitle.toLowerCase()) ||
      (app && app.title && s.title && s.title.toLowerCase() === app.title.toLowerCase())
  );
  if (match) {
    if (match.providerLogo && String(match.providerLogo).trim()) return match.providerLogo;
    if (match.logoImage && String(match.logoImage).trim()) return match.logoImage;
  }

  let pSet = window.cachedProviderSettings;
  if (!pSet) {
    try {
      pSet = JSON.parse(localStorage.getItem("nexo_provider_settings") || localStorage.getItem("nexo_settings") || "null");
    } catch (_) {}
  }
  const activeOrgName = (pSet && pSet.orgName) || localStorage.getItem("nexo-provider-name") || "NEXO";
  const appOrg = (app && (app.providerName || app.organization) ? (app.providerName || app.organization).trim() : "");
  if (!appOrg || appOrg.toLowerCase() === activeOrgName.toLowerCase() || appOrg.toLowerCase() === "nexo") {
    if (pSet && pSet.logoImage && String(pSet.logoImage).trim()) {
      return pSet.logoImage;
    }
    const lsLogo = localStorage.getItem("nexo-provider-logo") || "";
    if (lsLogo && String(lsLogo).trim()) {
      return lsLogo;
    }
  }
  return "";
}

// =========================================
// 2. NOTIFICATION BELL & LIVE POPOVER
// =========================================
function escapeStudentNotifHtml(text) {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const DEFAULT_STUDENT_NOTIFICATIONS = [];

function getStudentNotificationsFromStorage() {
  let all = [];
  try {
    const raw = localStorage.getItem("nexo_notifications");
    if (raw) all = JSON.parse(raw);
  } catch (_) {}

  if (!Array.isArray(all)) all = [];

  let dismissed = [];
  try {
    dismissed = JSON.parse(localStorage.getItem("nexo_dismissed_notifs") || "[]");
  } catch (_) {}
  if (!Array.isArray(dismissed)) dismissed = [];

  const currentEmail = (
    sessionStorage.getItem("nexo-student-email") ||
    localStorage.getItem("nexo-student-email") ||
    localStorage.getItem("nexo_student_email") ||
    ""
  )
    .toLowerCase()
    .trim();

  return all.filter((n) => {
    if (dismissed.includes(String(n.id))) return false;
    const isStudent = !n.recipient || n.recipient === "student" || n.recipient === "all";
    if (!isStudent) return false;
    if (n.recipientEmail && currentEmail) {
      return String(n.recipientEmail).toLowerCase().trim() === currentEmail;
    }
    return true;
  });
}

function initNotificationBell() {
  const notifBtn = document.querySelector(".notification-btn");
  if (!notifBtn) return;

  // Ensure unread dot exists inside button
  let dot =
    notifBtn.querySelector(".notification-dot") ||
    document.getElementById("student-notif-dot");
  if (!dot) {
    dot = document.createElement("span");
    dot.className = "notification-dot";
    dot.id = "student-notif-dot";
    notifBtn.appendChild(dot);
  }

  let popover = document.getElementById("header-notif-popover");
  if (!popover) {
    popover = document.createElement("div");
    popover.id = "header-notif-popover";
    popover.className = "notification-popover";
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-label", "Notifications");
    popover.innerHTML = `
      <div class="notif-popover-header">
        <div style="display:flex; align-items:center; gap:8px;">
          <h4 class="notif-popover-title">Notifications</h4>
          <span class="notif-badge-count" id="student-notif-badge">0 New</span>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <button type="button" class="notif-mark-read-btn" id="student-mark-read" style="background:none; border:none; color:var(--purple-600, #7c3aed); font-size:11px; font-weight:600; cursor:pointer; padding:2px 6px; border-radius:4px;">Mark all read</button>
          <button type="button" class="notif-trash-btn" id="student-clear-all-btn" title="Delete All Notifications" aria-label="Delete all notifications">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </div>
      </div>
      <div class="notif-popover-body" id="student-notif-body">
        <div class="notif-empty-box">
          <div class="notif-empty-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          </div>
          <p class="notif-empty-heading">No notifications yet</p>
          <p class="notif-empty-text">You're all caught up! New scholarship announcements and application status updates will appear here.</p>
        </div>
      </div>
    `;

    // Wrap the button in a relative container if not already wrapped
    let container = notifBtn.closest(".notification-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "notification-container";
      notifBtn.parentNode.insertBefore(container, notifBtn);
      container.appendChild(notifBtn);
    }
    container.appendChild(popover);
  }

  const NOTIF_API = window.location.origin.includes(":3000")
    ? ""
    : "http://localhost:3000";

  // Fetch & render live student notifications
  let lastStudentNotifsHash = "";

  async function loadStudentNotifications() {
    // 1. Immediately render local state so user gets instant response
    const localNotifs = getStudentNotificationsFromStorage();
    const newHash = JSON.stringify(localNotifs);
    if (newHash !== lastStudentNotifsHash) {
      lastStudentNotifsHash = newHash;
      renderStudentNotifications(localNotifs);
    }

    // 2. Sync with backend API if server is alive
    try {
      const res = await fetch(
        `${NOTIF_API}/api/notifications?recipient=student`,
      );
      if (res.ok) {
        const serverNotifs = await res.json();
        if (Array.isArray(serverNotifs) && serverNotifs.length > 0) {
          try {
            const cached = JSON.parse(
              localStorage.getItem("nexo_notifications") || "[]",
            );
            serverNotifs.forEach((sn) => {
              const idx = cached.findIndex(
                (c) => String(c.id) === String(sn.id),
              );
              if (idx >= 0) cached[idx] = sn;
              else cached.unshift(sn);
            });
            localStorage.setItem("nexo_notifications", JSON.stringify(cached));
          } catch (_) {}
          const mergedNotifs = getStudentNotificationsFromStorage();
          renderStudentNotifications(mergedNotifs);
        }
      }
    } catch (_) {}
  }

  function deleteStudentNotification(id) {
    try {
      let cached = JSON.parse(
        localStorage.getItem("nexo_notifications") || "[]",
      );
      cached = cached.filter((n) => String(n.id) !== String(id));
      localStorage.setItem("nexo_notifications", JSON.stringify(cached));

      let dismissed = JSON.parse(
        localStorage.getItem("nexo_dismissed_notifs") || "[]",
      );
      if (!Array.isArray(dismissed)) dismissed = [];
      if (!dismissed.includes(String(id))) {
        dismissed.push(String(id));
        localStorage.setItem("nexo_dismissed_notifs", JSON.stringify(dismissed));
      }
    } catch (_) {}

    // Send delete request to server if online
    fetch(`${NOTIF_API}/api/notifications/${id}`, {
      method: "DELETE",
      keepalive: true,
    }).catch(() => {});

    loadStudentNotifications();
  }

  function markStudentNotificationRead(id) {
    deleteStudentNotification(id);
  }

  function markAllStudentNotificationsRead() {
    try {
      const cached = JSON.parse(
        localStorage.getItem("nexo_notifications") || "[]",
      );
      cached.forEach((n) => {
        if (
          !n.recipient ||
          n.recipient === "student" ||
          n.recipient === "all"
        ) {
          n.read = true;
        }
      });
      localStorage.setItem("nexo_notifications", JSON.stringify(cached));
    } catch (_) {}

    // Send read request to server if online
    fetch(`${NOTIF_API}/api/notifications/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: "student" }),
    }).catch(() => {});

    loadStudentNotifications();
  }

  function confirmClearAllStudentNotifications() {
    let modal = document.getElementById("clear-student-notifs-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "clear-student-notifs-modal";
      modal.className = "nexo-modal-overlay";
      modal.style.zIndex = "10600";
      modal.innerHTML = `
        <div class="nexo-modal-container" style="max-width: 420px; border-radius: 16px; padding: 24px; text-align: center;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(239, 68, 68, 0.12); color: #ef4444; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px auto;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </div>
          <h3 style="font-size: 18px; font-weight: 800; margin: 0 0 8px 0; color: var(--text-primary);">Delete All Notifications?</h3>
          <p style="font-size: 13px; color: var(--text-secondary); margin: 0 0 20px 0; line-height: 1.45;">
            Are you sure you want to permanently clear all notifications? This action cannot be undone.
          </p>
          <div style="display: flex; gap: 10px; justify-content: center;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-clear-student-notifs" style="padding: 8px 18px; font-size: 13px; border-radius: 8px;">Cancel</button>
            <button type="button" class="btn btn-danger" id="btn-confirm-clear-student-notifs" style="padding: 8px 18px; font-size: 13px; border-radius: 8px; background: #ef4444; border-color: #ef4444; color: #fff; font-weight: 700;">Delete All</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      modal.querySelector("#btn-cancel-clear-student-notifs").addEventListener("click", () => {
        modal.classList.remove("open");
      });
      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.classList.remove("open");
      });
      modal.querySelector("#btn-confirm-clear-student-notifs").addEventListener("click", async () => {
        modal.classList.remove("open");
        await clearAllStudentNotifications();
      });
    }
    modal.classList.add("open");
  }

  async function clearAllStudentNotifications() {
    const currentEmail = (
    sessionStorage.getItem("nexo-student-email") ||
    localStorage.getItem("nexo-student-email") ||
    localStorage.getItem("nexo_student_email") ||
    ""
  )
    .toLowerCase()
    .trim();
    try {
      let cached = JSON.parse(localStorage.getItem("nexo_notifications") || "[]");
      cached = cached.filter((n) => {
        if (!n.recipient || n.recipient === "student" || n.recipient === "all") {
          if (n.recipientEmail && currentEmail && String(n.recipientEmail).toLowerCase().trim() !== currentEmail) {
            return true;
          }
          return false;
        }
        return true;
      });
      localStorage.setItem("nexo_notifications", JSON.stringify(cached));
    } catch (_) {}

    try {
      await fetch(`${NOTIF_API}/api/notifications?recipient=student${currentEmail ? `&email=${encodeURIComponent(currentEmail)}` : ""}`, {
        method: "DELETE",
      });
    } catch (_) {}

    loadStudentNotifications();
    if (typeof showToast === "function") {
      showToast("All notifications deleted.");
    }
  }

  function clampPopoverPosition() {
    if (!popover) return;
    popover.style.right = "0";
    popover.style.left = "auto";
    const rect = popover.getBoundingClientRect();
    if (rect.left < 14) {
      const shift = 14 - rect.left;
      popover.style.right = `-${shift}px`;
    }
  }

  function renderStudentNotifications(notifs) {
    const bodyEl = document.getElementById("student-notif-body");
    const badgeEl = document.getElementById("student-notif-badge");
    const currentDot =
      notifBtn.querySelector(".notification-dot") ||
      document.getElementById("student-notif-dot");
    if (!bodyEl) return;

    const list = Array.isArray(notifs) ? notifs : [];
    const unreadCount = list.filter((n) => !n.read).length;

    if (badgeEl) badgeEl.textContent = `${unreadCount} New`;
    if (currentDot) {
      if (unreadCount > 0) {
        currentDot.classList.add("active");
        notifBtn.classList.add("has-unread");
      } else {
        currentDot.classList.remove("active");
        notifBtn.classList.remove("has-unread");
      }
    }

    if (list.length === 0) {
      bodyEl.innerHTML = `
        <div class="notif-empty-box">
          <div class="notif-empty-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          </div>
          <p class="notif-empty-heading">No notifications yet</p>
          <p class="notif-empty-text">You're all caught up! New scholarship announcements and application status updates will appear here.</p>
        </div>
      `;
      return;
    }

    bodyEl.innerHTML = list
      .map((n) => {
        const isUnread = !n.read;
        const timeStr = n.formattedTime || "Recently";
        let linkUrl = n.link || "student-submissions.html";
        if (n.appId) {
          linkUrl = `student-submissions.html?id=${encodeURIComponent(n.appId)}`;
        } else if (n.scholId) {
          linkUrl = `student-browse.html?id=${encodeURIComponent(n.scholId)}`;
        }
        return `
          <a href="${linkUrl}" class="notif-item ${isUnread ? "unread" : ""}" data-id="${n.id}" data-app-id="${n.appId || ""}">
            <div class="notif-item-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
              </svg>
            </div>
            <div class="notif-item-content">
              <h5 class="notif-item-title">${escapeStudentNotifHtml(n.title)}</h5>
              <p class="notif-item-msg">${escapeStudentNotifHtml(n.message)}</p>
              <span class="notif-item-time">${escapeStudentNotifHtml(timeStr)}</span>
            </div>
          </a>
        `;
      })
      .join("");

    // Attach click listeners to individual items: clicking permanently deletes the notification so it won't flood
    bodyEl.querySelectorAll(".notif-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        const notifId = item.dataset.id;
        const targetAppId = item.dataset.appId;
        if (notifId) {
          deleteStudentNotification(notifId);
          item.remove();
        }

        // If already on submissions page, open modal directly without page reload or persistent query param loop
        if (
          window.location.pathname.includes("student-submissions.html") &&
          targetAppId &&
          Array.isArray(allStudentApplications)
        ) {
          const match = allStudentApplications.find(
            (a) =>
              String(a.id) === String(targetAppId) ||
              String(a.scholarshipId) === String(targetAppId),
          );
          if (match) {
            e.preventDefault();
            const notifDropdown = document.getElementById("student-notif-dropdown");
            if (notifDropdown) notifDropdown.classList.remove("active");
            openSubmissionDetailsModal(match);
          }
        }
      });
    });
  }

  // Initial load and periodic polling
  loadStudentNotifications();
  setInterval(loadStudentNotifications, 3500);

  // Wire "Delete all notifications" button
  const clearAllBtn = document.getElementById("student-clear-all-btn");
  if (clearAllBtn) {
    clearAllBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      confirmClearAllStudentNotifications();
    });
  }

  // Wire "Mark all read" button
  const markReadBtn = document.getElementById("student-mark-read");
  if (markReadBtn) {
    markReadBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      markAllStudentNotificationsRead();
    });
  }

  // Listen for storage events (other tabs/windows) and custom events
  window.addEventListener("storage", (e) => {
    if (e.key === "nexo_notifications") {
      loadStudentNotifications();
    }
  });
  window.addEventListener("nexo:notification", () => {
    loadStudentNotifications();
  });

  // Toggle notification popover on bell click
  notifBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    closeSideMenu();
    const willOpen = !popover.classList.contains("open");
    popover.classList.toggle("open", willOpen);
    notifBtn.setAttribute("aria-expanded", willOpen ? "true" : "false");
    if (willOpen) {
      clampPopoverPosition();
      loadStudentNotifications();
      // Instantly mark notifications as read and remove red dot
      markAllStudentNotificationsRead();
      const currentDot = notifBtn.querySelector(".notification-dot") || document.getElementById("student-notif-dot");
      if (currentDot) currentDot.classList.remove("active");
      notifBtn.classList.remove("has-unread");
    }
  });

  // Close notifications on theme toggle
  const themeToggle = document.querySelector(".theme-toggle");
  if (themeToggle) {
    themeToggle.addEventListener("change", () => {
      closeNotifications();
      closeSideMenu();
    });
  }
}

// =========================================
// 3. STUDENT IDENTITY & DYNAMIC GREETING
// =========================================
// Helper: Short date formatting for student workspace
function formatStudentShortDate(dateVal) {
  if (!dateVal) return "Recently";
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// 3.1 Calculate and render profile completion and academic chips
function calculateStudentProfileCompletion(profile, activeEmail) {
  const p = profile || {};
  const fields = [
    Boolean(p.fullName && p.fullName.trim()),
    Boolean((p.email || activeEmail) && (p.email || activeEmail).trim()),
    Boolean(p.university && p.university.trim()),
    Boolean(p.course && p.course.trim()),
    Boolean(p.yearLevel && p.yearLevel.trim()),
    Boolean(p.studentId && p.studentId.trim()),
    Boolean(p.contactNumber && p.contactNumber.trim()),
    Boolean(p.bio && p.bio.trim()),
  ];
  const filledCount = fields.filter(Boolean).length;
  let percent = Math.round((filledCount / fields.length) * 100);
  if (p.isProfileConfirmed && percent > 0) {
    percent = Math.max(percent, 100);
  }
  return {
    percent: Math.min(100, Math.max(0, percent)),
    filledCount,
    totalCount: fields.length,
    isConfirmed: Boolean(p.isProfileConfirmed),
  };
}

function updateStudentDashboardProfileOverview(profile, activeEmail) {
  const completionData = calculateStudentProfileCompletion(profile, activeEmail);
  const p = profile || {};

  const wrapEl = document.getElementById("student-profile-completion-wrap");
  const completionLabel = document.getElementById("student-profile-completion-label");
  const progressFill = document.getElementById("student-profile-progress-fill");
  const actionLink = document.getElementById("student-profile-action-link");
  const chipUni = document.getElementById("student-chip-uni");
  const chipCourse = document.getElementById("student-chip-course");
  const chipYear = document.getElementById("student-chip-year");

  // Requirement 1: Remove/hide profile percentage complete bar once it's already 100%
  if (wrapEl) {
    if (completionData.percent >= 100) {
      wrapEl.style.display = "none";
    } else {
      wrapEl.style.display = "block";
    }
  }

  if (completionLabel) {
    completionLabel.textContent = `Profile ${completionData.percent}% Complete`;
  }
  if (progressFill) {
    progressFill.style.width = `${completionData.percent}%`;
  }
  if (actionLink) {
    if (completionData.percent < 100) {
      actionLink.textContent = "Complete Profile \u2192";
    } else {
      actionLink.textContent = "Edit Profile \u2192";
    }
  }

  if (chipUni) {
    chipUni.textContent = p.university || "Batangas State University";
  }
  if (chipCourse) {
    chipCourse.textContent = p.course || "Undergraduate Scholar";
  }
  if (chipYear) {
    chipYear.textContent = p.yearLevel || "Enrolled Student";
  }
}

// 3.2 Synchronize Next Steps, Deadlines, Opportunities, and Activity on Student Dashboard
function syncStudentWorkspaceSections(myApplications, profile, activeEmail) {
  // Only execute on dashboard
  if (!document.getElementById("student-next-steps-list")) return;

  renderStudentNextSteps(profile, myApplications, activeEmail);
  renderStudentUpcomingDeadlines(window.cachedScholarships || [], myApplications);
  renderStudentRecommendedOpportunities(window.cachedScholarships || [], myApplications, profile);
  renderStudentRecentActivity(myApplications, profile, activeEmail);
}

// SECTION 1: YOUR NEXT STEPS
function renderStudentNextSteps(profile, myApplications, activeEmail) {
  const container = document.getElementById("student-next-steps-list");
  const badge = document.getElementById("next-steps-count-badge");
  if (!container) return;

  const items = [];
  const completion = calculateStudentProfileCompletion(profile, activeEmail);

  // 1. Incomplete Profile
  if (completion.percent < 100 || !(profile && profile.isProfileConfirmed)) {
    items.push({
      id: "step-profile",
      badgeClass: "badge-step-profile",
      badgeText: "Profile",
      title: "Complete your academic student profile",
      desc: `Your profile is ${completion.percent}% complete. Complete all fields to enhance scholarship eligibility.`,
      actionText: "Update Settings \u2192",
      onClick: () => {
        window.location.href = "student-settings.html";
      },
    });
  }

  // 2. Pending Follow-up Documents
  (myApplications || []).forEach((app) => {
    const rawDocs = app.documents || app.uploadedDocuments || [];
    const followUpDocs = rawDocs.filter((d) => {
      if (typeof d === "string") return d.includes("(To Follow Up)");
      return d.isFollowUp || d.status === "to_follow_up" || d.type === "to_follow_up";
    });

    if (followUpDocs.length > 0) {
      const scholTitle = app.scholarshipTitle || app.title || "Scholarship Application";
      items.push({
        id: `step-doc-${app.id}`,
        badgeClass: "badge-step-action",
        badgeText: "Action Required",
        title: `Submit requested documents (${followUpDocs.length} pending)`,
        desc: `${scholTitle} has requested verification documents for evaluation.`,
        actionText: "Upload Documents \u2192",
        onClick: () => {
          openSubmissionDetailsModal(app);
        },
      });
    }
  });

  // 3. Provider Feedback / Remarks to review
  (myApplications || []).forEach((app) => {
    const remarks = (app.remarks || app.feedback || app.notes || "").trim();
    if (remarks) {
      const scholTitle = app.scholarshipTitle || app.title || "Scholarship Application";
      items.push({
        id: `step-remark-${app.id}`,
        badgeClass: "badge-step-review",
        badgeText: "Remarks",
        title: `Review provider remarks for ${scholTitle}`,
        desc: "The scholarship evaluation committee has left a message on your record.",
        actionText: "View Remarks \u2192",
        onClick: () => {
          openSubmissionDetailsModal(app);
        },
      });
    }
  });

  // 4. Status decision ready (Approved / Rejected)
  (myApplications || []).forEach((app) => {
    const rawStatus = (app.status || "").toLowerCase();
    if (rawStatus.includes("approved")) {
      const scholTitle = app.scholarshipTitle || app.title || "Scholarship Grant";
      items.push({
        id: `step-appr-${app.id}`,
        badgeClass: "badge-step-approved",
        badgeText: "Approved",
        title: `Congratulations! ${scholTitle} Approved`,
        desc: "Review provider instructions and disbursement onboarding requirements.",
        actionText: "View Grant \u2192",
        onClick: () => {
          openSubmissionDetailsModal(app);
        },
      });
    }
  });

  if (badge) {
    badge.textContent = items.length;
    badge.style.display = items.length > 0 ? "inline-flex" : "none";
  }

  container.innerHTML = "";

  if (items.length === 0) {
    container.innerHTML = `
      <div class="next-steps-empty">
        <div class="next-steps-empty-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <h4 class="next-steps-empty-title">You're all caught up!</h4>
        <p class="next-steps-empty-desc">No urgent tasks or missing documents required. We will alert you when a provider reviews your files.</p>
      </div>
    `;
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "next-step-item";
    row.innerHTML = `
      <div class="next-step-header">
        <span class="next-step-badge ${item.badgeClass}">${item.badgeText}</span>
        <span class="next-step-action-hint">${item.actionText}</span>
      </div>
      <h4 class="next-step-title">${escapeHtml(item.title)}</h4>
      <p class="next-step-desc">${escapeHtml(item.desc)}</p>
    `;
    row.addEventListener("click", item.onClick);
    container.appendChild(row);
  });
}

// SECTION 2: UPCOMING DEADLINES
function renderStudentUpcomingDeadlines(scholarships, myApplications) {
  const container = document.getElementById("student-deadlines-list");
  if (!container) return;

  const now = new Date();
  const deadlineEntries = [];

  // Parse scholarships
  (scholarships || []).forEach((s) => {
    if (!s.deadline) return;
    const parts = String(s.deadline).split("/");
    let d = null;
    if (parts.length === 3) {
      d = new Date(parseInt(parts[2], 10), parseInt(parts[0], 10) - 1, parseInt(parts[1], 10), 23, 59, 59);
    } else {
      d = new Date(s.deadline);
    }
    if (isNaN(d.getTime())) return;

    const diffTime = d.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return; // Expired

    const hasApplied = (myApplications || []).some(
      (a) => String(a.scholarshipId) === String(s.id) || String(a.id) === String(s.id)
    );

    deadlineEntries.push({
      dateObj: d,
      diffDays,
      title: s.title || "Scholarship Opportunity",
      type: hasApplied ? "Application Submitted" : "Application Deadline",
      statusClass: diffDays <= 5 ? "badge-deadline-urgent" : "badge-deadline-open",
      statusLabel: diffDays === 0 ? "Closing Today" : `Closes in ${diffDays}d`,
      scholId: s.id,
    });
  });

  // Sort by nearest deadline first
  deadlineEntries.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

  container.innerHTML = "";

  if (deadlineEntries.length === 0) {
    container.innerHTML = `
      <div class="deadlines-empty">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-secondary); margin-bottom: 6px;">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <p style="margin: 0; font-size: 13.5px; color: var(--text-secondary);">No upcoming scholarship deadlines found.</p>
      </div>
    `;
    return;
  }

  // Display up to 4 nearest deadlines
  deadlineEntries.slice(0, 4).forEach((item) => {
    const month = item.dateObj.toLocaleString("en-US", { month: "short" }).toUpperCase();
    const day = item.dateObj.getDate();

    const row = document.createElement("div");
    row.className = "deadline-item";
    row.innerHTML = `
      <div class="deadline-date-box">
        <span class="deadline-month">${month}</span>
        <span class="deadline-day">${day}</span>
      </div>
      <div class="deadline-info">
        <h4 class="deadline-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h4>
        <div class="deadline-meta-row">
          <span class="deadline-type">${escapeHtml(item.type)}</span>
          <span class="deadline-status-pill ${item.statusClass}">${escapeHtml(item.statusLabel)}</span>
        </div>
      </div>
    `;
    row.addEventListener("click", () => {
      window.location.href = `student-browse.html?scholId=${encodeURIComponent(item.scholId)}`;
    });
    container.appendChild(row);
  });
}

// SECTION 3: RECOMMENDED OPPORTUNITIES
function renderStudentRecommendedOpportunities(scholarships, myApplications, profile) {
  const container = document.getElementById("student-opportunities-feed");
  if (!container) return;

  const appliedIds = new Set((myApplications || []).map((a) => String(a.scholarshipId || a.id)));
  const p = profile || {};
  const studentYear = (p.yearLevel || "").toLowerCase();
  const studentUni = (p.university || "").toLowerCase();

  const openList = (scholarships || []).filter((s) => {
    const isOpen = (s.status || "Open").toLowerCase() === "open";
    const isApplied = appliedIds.has(String(s.id));
    return isOpen && !isApplied;
  });

  container.innerHTML = "";

  if (openList.length === 0) {
    container.innerHTML = `
      <div class="opportunities-empty">
        <p style="margin: 0; font-size: 13.5px; color: var(--text-secondary);">No open scholarship opportunities at the moment. Check back soon!</p>
      </div>
    `;
    return;
  }

  // Display top 2-3 opportunities
  openList.slice(0, 3).forEach((schol) => {
    const isApplied = appliedIds.has(String(schol.id));
    const org = schol.providerName || schol.organization || "NEXO";
    const title = schol.title || "Scholarship Program";
    const typeLabel = schol.typeText || (schol.type === "need" ? "Need-Based" : "Merit-Based");
    const deadline = schol.formattedDate || schol.deadline || "Open";
    const applicants = schol.applicantCount || `${schol.applicantTotal || 1} / ${schol.applicantLimit || 500} Applicants`;

    const desc = (schol.desc || schol.description || "").toLowerCase();
    const hasEligibilityMatch =
      (studentYear && desc.includes(studentYear)) ||
      (studentUni && desc.includes("batangas state university"));

    const card = document.createElement("div");
    card.className = "opportunity-mini-card";
    card.innerHTML = `
      <div class="opportunity-mini-header">
        <div class="opportunity-mini-titles">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px; flex-wrap: wrap;">
            <span class="opp-type-badge">${escapeHtml(typeLabel)}</span>
            ${hasEligibilityMatch ? `<span class="opp-match-badge">&#10003; Matches Profile</span>` : ""}
            ${isApplied ? `<span class="opp-applied-badge">Applied</span>` : ""}
          </div>
          <h4 class="opportunity-mini-title">${escapeHtml(title)}</h4>
          <p class="opportunity-mini-org">${escapeHtml(org)} &bull; Closes ${escapeHtml(deadline)}</p>
        </div>
      </div>
      <div class="opportunity-mini-footer">
        <span class="opportunity-mini-capacity">${escapeHtml(applicants)}</span>
        <button type="button" class="btn btn-secondary btn-view-opp" data-id="${schol.id}">
          ${isApplied ? "View Details" : "View Opportunity &rarr;"}
        </button>
      </div>
    `;

    card.addEventListener("click", () => {
      window.location.href = `student-browse.html?scholId=${encodeURIComponent(schol.id)}`;
    });

    const btn = card.querySelector(".btn-view-opp");
    if (btn) {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        window.location.href = `student-browse.html?scholId=${encodeURIComponent(schol.id)}`;
      });
    }

    container.appendChild(card);
  });
}

// SECTION 4: RECENT ACTIVITY
function renderStudentRecentActivity(myApplications, profile, activeEmail) {
  const container = document.getElementById("student-activity-list");
  if (!container) return;

  const activities = [];

  (myApplications || []).forEach((app) => {
    const scholTitle = app.scholarshipTitle || app.title || "Scholarship Program";

    // 1. Status review / update event
    if (app.reviewedAt || app.updatedAt) {
      activities.push({
        time: new Date(app.reviewedAt || app.updatedAt).getTime() || 0,
        dateFormatted: formatStudentShortDate(app.reviewedAt || app.updatedAt),
        title: `Application status updated to ${app.status || "Under Review"}`,
        sub: scholTitle,
        type: "status",
        app,
      });
    }

    // 2. Remarks added event
    if (app.remarks || app.feedback) {
      activities.push({
        time: (new Date(app.reviewedAt || app.updatedAt).getTime() || 0) + 1,
        dateFormatted: formatStudentShortDate(app.reviewedAt || app.updatedAt || app.submittedAt),
        title: "Provider feedback & remarks posted",
        sub: scholTitle,
        type: "remark",
        app,
      });
    }

    // 3. Submitted event
    if (app.submittedAt || app.appliedDate || app.date) {
      activities.push({
        time: new Date(app.submittedAt || app.appliedDate || app.date).getTime() || 0,
        dateFormatted: formatStudentShortDate(app.submittedAt || app.appliedDate || app.date),
        title: "Application submitted for committee evaluation",
        sub: scholTitle,
        type: "submission",
        app,
      });
    }
  });

  // Profile confirmed event
  if (profile && profile.isProfileConfirmed && profile.updatedAt) {
    activities.push({
      time: new Date(profile.updatedAt).getTime() || 0,
      dateFormatted: formatStudentShortDate(profile.updatedAt),
      title: "Academic student profile confirmed",
      sub: `${profile.university || "BatSU"} \u2022 ${profile.course || "Degree program"}`,
      type: "profile",
      url: "student-settings.html",
    });
  }

  // Sort activities newest first
  activities.sort((a, b) => b.time - a.time);

  container.innerHTML = "";

  if (activities.length === 0) {
    container.innerHTML = `
      <div class="activity-empty">
        <p style="margin: 0; font-size: 13.5px; color: var(--text-secondary);">No recent activity recorded yet.</p>
      </div>
    `;
    return;
  }

  // Render up to 5 events
  activities.slice(0, 5).forEach((item) => {
    const el = document.createElement("div");
    el.className = "activity-timeline-item";
    el.innerHTML = `
      <div class="activity-dot-col">
        <span class="activity-timeline-dot dot-${item.type}"></span>
        <span class="activity-timeline-line"></span>
      </div>
      <div class="activity-content">
        <div class="activity-header-line">
          <span class="activity-title">${escapeHtml(item.title)}</span>
          <span class="activity-date">${escapeHtml(item.dateFormatted)}</span>
        </div>
        <p class="activity-sub">${escapeHtml(item.sub)}</p>
      </div>
    `;

    el.addEventListener("click", () => {
      if (item.app) {
        openSubmissionDetailsModal(item.app);
      } else if (item.url) {
        window.location.href = item.url;
      }
    });

    container.appendChild(el);
  });
}

function getDynamicGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return "Good morning,";
  } else if (hour >= 12 && hour < 18) {
    return "Good afternoon,";
  } else {
    // 6:00 PM to 4:59 AM
    return "Good evening,";
  }
}

function updateStudentGreeting() {
  const greetingSub = document.getElementById("student-greeting-sub");
  if (greetingSub) {
    greetingSub.textContent = getDynamicGreeting();
  }
}

function initStudentGreeting() {
  const nameTitle = document.getElementById("student-name-title");
  const headerAvatar = document.getElementById("student-header-avatar");

  // Determine time-based greeting dynamically
  updateStudentGreeting();

  // Periodically re-check greeting every minute (e.g. 11:59 AM -> 12:00 PM transition)
  setInterval(updateStudentGreeting, 60000);

  // Also update when user switches back to this tab
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      updateStudentGreeting();
    }
  });

  // Resolve student name dynamically from settings or session
  const currentStudentEmail = (
    sessionStorage.getItem("nexo-student-email") ||
    localStorage.getItem("nexo-student-email") ||
    ""
  ).toLowerCase();

  let studentSettings = null;
  try {
    const raw = localStorage.getItem("nexo_student_settings");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.email || !currentStudentEmail || parsed.email.toLowerCase() === currentStudentEmail) {
        studentSettings = parsed;
      }
    }
  } catch (_) {}

  const savedName =
    (studentSettings && studentSettings.fullName) ||
    sessionStorage.getItem("nexo-student-name") ||
    localStorage.getItem("nexo-student-name") ||
    "";

  if (nameTitle) {
    nameTitle.textContent = savedName || "Welcome, Student Scholar";
  }

  // Update profile completion and academic chips on welcome card
  updateStudentDashboardProfileOverview(studentSettings, currentStudentEmail);

  // Set header initials or avatar photo dynamically
  if (typeof window.syncGlobalStudentIdentity === "function") {
    window.syncGlobalStudentIdentity();
  }

  const cardAvatar = document.getElementById("student-card-avatar");
  if (cardAvatar) {
    cardAvatar.style.cursor = "pointer";
    cardAvatar.title = "View Account Settings";
    cardAvatar.onclick = () => {
      window.location.href = "student-settings.html";
    };
  }

  if (headerAvatar) {
    headerAvatar.style.cursor = "pointer";
    headerAvatar.title = "Student Settings";
    headerAvatar.onclick = () => {
      window.location.href = "student-settings.html";
    };
  }
}

// =========================================
// 4. APPLICATION METRICS & FEED SYNC
// =========================================
window.API_BASE =
  window.API_BASE ||
  (window.location.origin.includes(":3000") ? "" : "http://localhost:3000");
var API_BASE = window.API_BASE;

let allStudentApplications = [];
let currentSubmissionsFilter = "all";
let currentSubmissionsSearch = "";
let lastStudentAppsHash = "";

async function loadStudentData() {
  const studentAppsFeed = document.getElementById("student-apps-feed");
  const emptyAppsCard = document.getElementById("student-empty-apps");
  if (typeof window.renderSkeletonCards === "function" && studentAppsFeed && studentAppsFeed.children.length === 0) {
    if (emptyAppsCard) emptyAppsCard.style.display = "none";
    const isDesktopApp = window.innerWidth >= 1024;
    window.renderSkeletonCards(studentAppsFeed, isDesktopApp ? 9 : 3);
    studentAppsFeed.style.display = "";
  }

  const statMyApps = document.getElementById("stat-my-apps");
  const statApproved = document.getElementById("stat-approved");
  const statReview = document.getElementById("stat-review");
  const statRejected = document.getElementById("stat-rejected");

  const activeStudentEmail = (
    sessionStorage.getItem("nexo-student-email") ||
    localStorage.getItem("nexo-student-email") ||
    ""
  ).toLowerCase();

  let applications = [];

  try {
    const response = await fetch(`${API_BASE}/api/data`);
    if (!response.ok) {
      throw new Error("HTTP error " + response.status);
    }
    const data = await response.json();
    applications = Array.isArray(data.applications) ? data.applications : [];
    if (data.settings) window.cachedProviderSettings = data.settings;
    if (Array.isArray(data.scholarships)) window.cachedScholarships = data.scholarships;

    // Sync student settings and avatar from server data
    let serverProfile = null;
    if (activeStudentEmail && data.studentProfiles && data.studentProfiles[activeStudentEmail]) {
      serverProfile = data.studentProfiles[activeStudentEmail];
    } else if (
      data.studentSettings &&
      data.studentSettings.email &&
      activeStudentEmail &&
      data.studentSettings.email.toLowerCase() === activeStudentEmail
    ) {
      serverProfile = data.studentSettings;
    } else if (activeStudentEmail && Array.isArray(data.users)) {
      const u = data.users.find((x) => (x.email || "").toLowerCase() === activeStudentEmail);
      if (u) {
        serverProfile = {
          email: u.email,
          fullName: u.name,
          profilePicture: u.profilePicture || "",
          course: u.course || "",
          yearLevel: u.yearLevel || "",
          university: u.university || "",
          isProfileConfirmed: Boolean(u.isProfileConfirmed),
        };
      }
    }

    if (serverProfile) {
      try {
        localStorage.setItem(
          "nexo_student_settings",
          JSON.stringify(serverProfile),
        );
        if (serverProfile.fullName) {
          sessionStorage.setItem("nexo-student-name", serverProfile.fullName);
          localStorage.setItem("nexo-student-name", serverProfile.fullName);
        }
        const nameTitleEl = document.getElementById("student-name-title");
        if (nameTitleEl && serverProfile.fullName) {
          nameTitleEl.textContent = serverProfile.fullName;
        }
        if (activeStudentEmail) {
          localStorage.setItem(
            `nexo_student_settings_${activeStudentEmail}`,
            JSON.stringify(serverProfile),
          );
        }
        if (serverProfile.profilePicture) {
          sessionStorage.setItem(
            "nexo-student-avatar",
            serverProfile.profilePicture,
          );
          localStorage.setItem(
            "nexo-student-avatar",
            serverProfile.profilePicture,
          );
          if (activeStudentEmail) {
            localStorage.setItem(
              "nexo_avatar_" + activeStudentEmail,
              serverProfile.profilePicture,
            );
            localStorage.setItem(
              "nexo-student-avatar-" + activeStudentEmail,
              serverProfile.profilePicture,
            );
          }
        }
      } catch (_) {}
    }

    // Trigger UI identity sync with server-updated data
    if (typeof window.syncGlobalStudentIdentity === "function") {
      window.syncGlobalStudentIdentity();
    }

    // Cache local copy
    try {
      localStorage.setItem("nexo_applications", JSON.stringify(applications));
    } catch (_) {}
  } catch (err) {
    try {
      // Fallback to static data.json if API is unreachable (e.g., Live Server)
      const staticRes = await fetch("data.json").catch(() => null);
      if (staticRes && staticRes.ok) {
        const staticData = await staticRes.json();
        applications = Array.isArray(staticData.applications) ? staticData.applications : [];
        if (Array.isArray(staticData.scholarships)) window.cachedScholarships = staticData.scholarships;
        if (staticData.settings) window.cachedProviderSettings = staticData.settings;

        if (activeStudentEmail && staticData.studentProfiles && staticData.studentProfiles[activeStudentEmail]) {
          serverProfile = staticData.studentProfiles[activeStudentEmail];
        } else if (
          staticData.studentSettings &&
          staticData.studentSettings.email &&
          activeStudentEmail &&
          staticData.studentSettings.email.toLowerCase() === activeStudentEmail
        ) {
          serverProfile = staticData.studentSettings;
        } else if (activeStudentEmail && Array.isArray(staticData.users)) {
          const u = staticData.users.find((x) => (x.email || "").toLowerCase() === activeStudentEmail);
          if (u) {
            serverProfile = {
              email: u.email,
              fullName: u.name,
              profilePicture: u.profilePicture || "",
              course: u.course || "",
              yearLevel: u.yearLevel || "",
              university: u.university || "",
              isProfileConfirmed: Boolean(u.isProfileConfirmed),
            };
          }
        }
      }
    } catch (_) {}

    if (!applications || applications.length === 0) {
      try {
        const cached = localStorage.getItem("nexo_applications");
        if (cached) applications = JSON.parse(cached);
      } catch (_) {}
    }
    if (!window.cachedScholarships || window.cachedScholarships.length === 0) {
      try {
        const cachedSchols = localStorage.getItem("nexo_scholarships");
        if (cachedSchols) window.cachedScholarships = JSON.parse(cachedSchols);
      } catch (_) {}
    }
  }

  // Filter applications specifically belonging to currently logged-in student
  const myApplications = activeStudentEmail
    ? applications.filter(
        (a) => (a.studentEmail || "").toLowerCase() === activeStudentEmail,
      )
    : applications;

  // Sort applications by latest first (using timestamp, appliedDate, or id)
  myApplications.sort((a, b) => {
    const parseDate = (d) => {
      if (!d) return 0;
      const t = new Date(d).getTime();
      return isNaN(t) ? 0 : t;
    };
    const timeA = parseDate(a.submittedAt || a.appliedDate || a.date);
    const timeB = parseDate(b.submittedAt || b.appliedDate || b.date);
    if (timeA && timeB && timeA !== timeB) return timeB - timeA;
    return String(b.id || "").localeCompare(String(a.id || ""), undefined, {
      numeric: true,
    });
  });

  allStudentApplications = myApplications;

  // Calculate metrics
  let totalCount = myApplications.length;
  let submittedCount = 0;
  let reviewCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;

  myApplications.forEach((app) => {
    const status = (app.status || "").toLowerCase();
    if (status.includes("approved")) {
      approvedCount++;
    } else if (status.includes("rejected")) {
      rejectedCount++;
    } else if (status.includes("review")) {
      reviewCount++;
    } else {
      // Submitted / Initial application
      submittedCount++;
    }
  });

  // Update UI Metric Numbers (for Student Dashboard)
  if (statMyApps) statMyApps.textContent = totalCount;
  if (statApproved) statApproved.textContent = approvedCount;
  if (statReview) statReview.textContent = reviewCount;
  if (statRejected) statRejected.textContent = rejectedCount;

  // Setup dynamic card navigation (clickable only if count >= 1)
  const cardMyApps = document.getElementById("card-stat-my-apps");
  const cardApproved = document.getElementById("card-stat-approved");
  const cardReview = document.getElementById("card-stat-review");
  const cardRejected = document.getElementById("card-stat-rejected");

  const wireStatCard = (cardEl, count, filterParam, titleText) => {
    if (!cardEl) return;
    if (count >= 1) {
      cardEl.classList.add("is-clickable");
      cardEl.classList.remove("is-disabled");
      cardEl.title = titleText;
      cardEl.setAttribute("aria-disabled", "false");
      const targetUrl = filterParam
        ? `student-submissions.html?filter=${filterParam}`
        : "student-submissions.html";
      cardEl.onclick = () => {
        window.location.href = targetUrl;
      };
      cardEl.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          window.location.href = targetUrl;
        }
      };
    } else {
      cardEl.classList.remove("is-clickable");
      cardEl.classList.add("is-disabled");
      cardEl.removeAttribute("title");
      cardEl.setAttribute("aria-disabled", "true");
      cardEl.onclick = null;
      cardEl.onkeydown = null;
    }
  };

  wireStatCard(cardMyApps, totalCount, "", "View all submitted applications");
  wireStatCard(cardApproved, approvedCount, "approved", "View approved scholarship grants");
  wireStatCard(cardReview, reviewCount, "review", "View applications under review");
  wireStatCard(cardRejected, rejectedCount, "rejected", "View rejected applications");

  // Ensure name and profile overview reflect serverProfile
  if (serverProfile && serverProfile.fullName) {
    const nameTitleEl = document.getElementById("student-name-title");
    if (nameTitleEl) nameTitleEl.textContent = serverProfile.fullName;
  }
  updateStudentDashboardProfileOverview(serverProfile, activeStudentEmail);

  // Synchronize New Student Workspace Sections (Next Steps, Upcoming Deadlines, Recommended Opportunities, Recent Activity)
  syncStudentWorkspaceSections(myApplications, serverProfile, activeStudentEmail);

  // Update Filter Pill Counters (for My Scholarship Submissions)
  const filterCountAll = document.getElementById("filter-count-all");
  const filterCountSubmitted = document.getElementById("filter-count-submitted");
  const filterCountReview = document.getElementById("filter-count-review");
  const filterCountApproved = document.getElementById("filter-count-approved");
  const filterCountRejected = document.getElementById("filter-count-rejected");

  if (filterCountAll) filterCountAll.textContent = totalCount;
  if (filterCountSubmitted) filterCountSubmitted.textContent = submittedCount;
  if (filterCountReview) filterCountReview.textContent = reviewCount;
  if (filterCountApproved) filterCountApproved.textContent = approvedCount;
  if (filterCountRejected) filterCountRejected.textContent = rejectedCount;

  // Render application feed
  renderFilteredSubmissions();

  // Handle direct one-tap navigation to submission from Scholarship Directory or Notification
  // (ONLY execute on student-submissions.html so it NEVER hijacks student-browse.html or other pages)
  if (
    !window._hasHandledSubDetailDeepLink &&
    window.location.pathname.includes("student-submissions.html")
  ) {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const targetId =
        urlParams.get("appId") ||
        urlParams.get("applicationId") ||
        urlParams.get("id");
      if (targetId) {
        window._hasHandledSubDetailDeepLink = true;
        const match = applications.find(
          (a) =>
            String(a.id) === String(targetId) ||
            String(a.scholarshipId) === String(targetId),
        );
        if (match) {
          if (window._subModalOpenTimeout) clearTimeout(window._subModalOpenTimeout);
          window._subModalOpenTimeout = setTimeout(() => {
            if (!window._subModalUserDismissed) {
              openSubmissionDetailsModal(match);
            }
          }, 200);
        }
        // Immediately clean URL search query parameters so background sync intervals never loop
        try {
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (_) {}
      }
    } catch (_) {}
  }
}

function renderFilteredSubmissions() {
  const emptyAppsCard = document.getElementById("student-empty-apps");
  const filterEmptyCard = document.getElementById("student-filter-empty");
  const appsFeed = document.getElementById("student-apps-feed");
  const hasFilterTools = Boolean(
    document.getElementById("submissions-status-filters") ||
      document.getElementById("btn-submissions-filter"),
  );
  const viewAllBtn = document.getElementById("student-view-all-link");

  if (!appsFeed) return;

  if (allStudentApplications.length === 0) {
    if (emptyAppsCard) emptyAppsCard.style.display = "block";
    if (filterEmptyCard) filterEmptyCard.style.display = "none";
    if (viewAllBtn) viewAllBtn.style.display = "none";
    appsFeed.style.display = "none";
    appsFeed.innerHTML = "";
    return;
  }

  if (emptyAppsCard) emptyAppsCard.style.display = "none";

  let listToRender = allStudentApplications;

  // If on Submissions page with filter tools, apply status & search filters
  if (hasFilterTools) {
    const query = (currentSubmissionsSearch || "").toLowerCase().trim();

    listToRender = allStudentApplications.filter((app) => {
      // 1. Status Filter (Separating Submitted and Under Review)
      const rawStatus = (app.status || "Submitted").toLowerCase();
      let matchesStatus = true;

      if (currentSubmissionsFilter === "submitted") {
        matchesStatus =
          rawStatus.includes("submitted") ||
          (!rawStatus.includes("review") &&
            !rawStatus.includes("approved") &&
            !rawStatus.includes("rejected"));
      } else if (currentSubmissionsFilter === "review") {
        matchesStatus = rawStatus.includes("review");
      } else if (currentSubmissionsFilter === "approved") {
        matchesStatus = rawStatus.includes("approved");
      } else if (currentSubmissionsFilter === "rejected") {
        matchesStatus = rawStatus.includes("rejected");
      }

      if (!matchesStatus) return false;

      // 2. Search Query Filter
      if (query) {
        const title = (app.scholarshipTitle || app.title || "").toLowerCase();
        const org = (app.providerName || app.organization || "").toLowerCase();
        return title.includes(query) || org.includes(query);
      }

      return true;
    });

    if (listToRender.length === 0) {
      if (filterEmptyCard) filterEmptyCard.style.display = "block";
      appsFeed.style.display = "none";
      appsFeed.innerHTML = "";
      return;
    }

    const totalMatchingSub = listToRender.length;
    const isDesktopSub = window.innerWidth >= 1024;
    const maxInitialSubCards = isDesktopSub ? 9 : 3;

    if (totalMatchingSub > maxInitialSubCards && !window._submissionsShowAllApps) {
      listToRender = listToRender.slice(0, maxInitialSubCards);
    }

    if (filterEmptyCard) filterEmptyCard.style.display = "none";
    appsFeed.style.display = "";
    renderApplicationCards(listToRender, appsFeed);

    if (totalMatchingSub > maxInitialSubCards) {
      const toggleContainer = document.createElement("div");
      toggleContainer.className = "submissions-view-all-container";
      toggleContainer.style.cssText =
        "display: flex; justify-content: center; margin-top: 18px; margin-bottom: 8px; width: 100%; grid-column: 1 / -1;";
      toggleContainer.innerHTML = `
        <button type="button" id="btn-toggle-submissions-all" class="btn btn-outline" style="border-radius: 100px; padding: 10px 24px; font-size: 13.5px; font-weight: 700; display: inline-flex; align-items: center; gap: 8px; border: 1.5px solid var(--border-color); background: var(--bg-surface); color: var(--text-primary); cursor: pointer; transition: all 0.2s ease;">
          ${
            window._submissionsShowAllApps
              ? `<span>Show Less</span>
                 <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"></polyline></svg>`
              : `<span>View All Applications (${totalMatchingSub})</span>
                 <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>`
          }
        </button>
      `;
      appsFeed.appendChild(toggleContainer);

      const toggleBtn = toggleContainer.querySelector("#btn-toggle-submissions-all");
      if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
          window._submissionsShowAllApps = !window._submissionsShowAllApps;
          renderFilteredSubmissions();
          if (!window._submissionsShowAllApps) {
            appsFeed.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
      }
    }

    if (!window._hasStudentResizeGridListener) {
      window._hasStudentResizeGridListener = true;
      let lastDesktopState = window.innerWidth >= 1024;
      window.addEventListener("resize", () => {
        const nowDesktop = window.innerWidth >= 1024;
        if (nowDesktop !== lastDesktopState) {
          lastDesktopState = nowDesktop;
          renderFilteredSubmissions();
        }
      });
    }
    return;
  } else {
    // On Dashboard / Home Page:
    // Mobile (< 1024px): 3 applications max listed then View All option occurs.
    // Desktop (>= 1024px): 3x3 grid (9 applications max listed) then View All option occurs.
    const totalApps = allStudentApplications.length;
    const isDesktop = window.innerWidth >= 1024;
    const maxInitialCards = isDesktop ? 9 : 3;

    if (viewAllBtn) {
      if (totalApps > maxInitialCards) {
        viewAllBtn.style.display = "inline-flex";
        const textEl =
          document.getElementById("student-view-all-text") || viewAllBtn;
        const iconEl = document.getElementById("student-view-all-icon");
        if (window._dashboardShowAllApps) {
          textEl.textContent = "Show Less";
          if (iconEl) iconEl.style.transform = "rotate(180deg)";
          listToRender = allStudentApplications;
        } else {
          textEl.textContent = `View All (${totalApps})`;
          if (iconEl) iconEl.style.transform = "rotate(0deg)";
          listToRender = allStudentApplications.slice(0, maxInitialCards);
        }

        if (!viewAllBtn._hasViewAllListener) {
          viewAllBtn._hasViewAllListener = true;
          viewAllBtn.addEventListener("click", (e) => {
            e.preventDefault();
            window._dashboardShowAllApps = !window._dashboardShowAllApps;
            renderFilteredSubmissions();
          });
        }
      } else {
        viewAllBtn.style.display = "none";
        listToRender = allStudentApplications.slice(0, maxInitialCards);
      }
    } else {
      listToRender = allStudentApplications.slice(0, maxInitialCards);
    }

    if (!window._hasStudentResizeGridListener) {
      window._hasStudentResizeGridListener = true;
      let lastDesktopState = window.innerWidth >= 1024;
      window.addEventListener("resize", () => {
        const nowDesktop = window.innerWidth >= 1024;
        if (nowDesktop !== lastDesktopState) {
          lastDesktopState = nowDesktop;
          renderFilteredSubmissions();
        }
      });
    }
  }

  if (filterEmptyCard) filterEmptyCard.style.display = "none";
  appsFeed.style.display = "";
  renderApplicationCards(listToRender, appsFeed);

  // Deep-linking: scroll to and highlight target submission from notification click (only once)
  if (!window._hasHandledSubScrollDeepLink) {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const targetId =
        urlParams.get("id") ||
        urlParams.get("appId") ||
        urlParams.get("applicationId");
      if (targetId) {
        window._hasHandledSubScrollDeepLink = true;
        setTimeout(() => {
          const targetCard = document.querySelector(`[data-app-id="${targetId}"]`);
          if (targetCard) {
            targetCard.scrollIntoView({ behavior: "smooth", block: "center" });
            targetCard.style.outline = "2.5px solid #8b5cf6";
            targetCard.style.boxShadow = "0 0 20px rgba(139, 92, 246, 0.4)";
          }
        }, 250);
      }
    } catch (_) {}
  }
}

// Render student application cards
function renderApplicationCards(applications, container) {
  container.innerHTML = "";

  applications.forEach((app) => {
    const card = document.createElement("div");
    card.className = "student-app-card";
    card.dataset.appId = app.id || "";

    // Resolve Status badge class and text
    const rawStatus = (app.status || "Submitted").toLowerCase();
    let badgeClass = "badge-status-submitted";
    let statusLabel = app.status || "Submitted";

    if (rawStatus.includes("approved")) {
      badgeClass = "badge-status-approved";
      statusLabel = "Approved";
    } else if (rawStatus.includes("review")) {
      badgeClass = "badge-status-review";
      statusLabel = "Under Review";
    } else if (rawStatus.includes("rejected")) {
      badgeClass = "badge-status-rejected";
      statusLabel = "Rejected";
    } else if (rawStatus.includes("quota")) {
      badgeClass = "badge-status-quota";
      statusLabel = "Quota Full";
    }

    // Resolve Logo / Initials
    const orgName = app.providerName || app.organization || "NEXO";
    const initials = orgName
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0] || "")
      .join("")
      .toUpperCase();

    const resolvedLogo = resolveAppProviderLogo(app);
    const logoHtml =
      resolvedLogo
        ? `<div class="student-app-logo" style="padding: 0; overflow: hidden; flex-shrink: 0;"><img src="${resolvedLogo}" alt="${escapeHtml(orgName)}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;" /></div>`
        : `<div class="student-app-logo">${initials || "NX"}</div>`;

    const title = app.title || app.scholarshipTitle || "Scholarship Program";
    const date =
      app.formattedDate || app.appliedDate || app.date || "Recently Applied";

    const rawDocs = app.documents || app.uploadedDocuments || [];
    const attachedDocs = rawDocs.filter((d) => {
      if (typeof d === "string") return !d.includes("(To Follow Up)");
      return !d.isFollowUp && d.status !== "to_follow_up" && d.type !== "to_follow_up";
    });
    const followUpDocs = rawDocs.filter((d) => {
      if (typeof d === "string") return d.includes("(To Follow Up)");
      return d.isFollowUp || d.status === "to_follow_up" || d.type === "to_follow_up";
    });
    const hasFeedback = Boolean(app.feedback || app.notes);

    // 0. Unified Status Pill (Consistent shape & palette inside pills row; top-right badge removed)
    const statusPillHtml = `
      <span class="student-meta-pill pill-app-status ${badgeClass}">
        <span class="pill-status-dot"></span>
        ${escapeHtml(statusLabel)}
      </span>
    `;

    // 1. Attached Files Pill
    let docsPillHtml = "";
    if (attachedDocs.length > 0) {
      docsPillHtml = `
        <span class="student-meta-pill pill-docs-attached">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
          ${attachedDocs.length} ${attachedDocs.length === 1 ? "File" : "Files"} Attached
        </span>
      `;
    } else {
      docsPillHtml = `
        <span class="student-meta-pill pill-docs-zero">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
          0 Files Attached
        </span>
      `;
    }

    // 2. To Follow Up Pill
    const followUpPillHtml =
      followUpDocs.length > 0
        ? `
        <span class="student-meta-pill pill-follow-up">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          ${followUpDocs.length} To Follow Up
        </span>
      `
        : "";

    // 3. Remarks Available Pill
    const remarksPillHtml = hasFeedback
      ? `
        <span class="student-meta-pill pill-remarks">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          Remarks Available
        </span>
      `
      : "";

    // 4. Status Explanation Text
    let statusExplanation = "";
    if (rawStatus.includes("approved")) {
      statusExplanation = "Your application has been approved. Review provider onboarding instructions.";
    } else if (rawStatus.includes("rejected")) {
      statusExplanation = "Your application was not selected. Review provider remarks and feedback.";
    } else if (rawStatus.includes("review")) {
      if (followUpDocs.length > 0) {
        statusExplanation = `Under provider review &bull; ${followUpDocs.length} follow-up document${followUpDocs.length === 1 ? "" : "s"} requested.`;
      } else {
        statusExplanation = "Your application and submitted documents are undergoing committee evaluation.";
      }
    } else {
      statusExplanation = "Your application has been received and queued for committee review.";
    }

    // 5. Context-aware Button CTA Text
    let ctaLabel = "View Full Details";
    if (followUpDocs.length > 0) {
      ctaLabel = "Upload Requested Docs";
    } else if (hasFeedback) {
      ctaLabel = "Review Remarks";
    }

    // 6. Last Updated Date
    const lastUpdateDate = app.reviewedAt || app.updatedAt || app.submittedAt || date;
    const formattedLastUpdate = formatStudentShortDate(lastUpdateDate);

    card.innerHTML = `
      <div class="student-app-header-row">
        ${logoHtml}
        <div class="student-app-info">
          <h4 class="student-app-title" title="${escapeHtml(title)}">${escapeHtml(title)}</h4>
          <p class="student-app-org">${escapeHtml(orgName)} &bull; Applied: ${escapeHtml(date)}</p>
        </div>
      </div>

      <div class="student-app-status-note">
        <p class="status-note-text">${statusExplanation}</p>
      </div>

      <div class="student-app-pills-row">
        ${statusPillHtml}
        ${docsPillHtml}
        ${followUpPillHtml}
        ${remarksPillHtml}
      </div>

      <div class="student-app-action-row">
        <span class="student-app-update-date">Updated: ${escapeHtml(formattedLastUpdate)}</span>
        <button type="button" class="btn btn-secondary view-sub-details-btn" data-app-id="${app.id}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          ${ctaLabel}
        </button>
      </div>
    `;

    // Clicking either the card or the button opens the full details modal
    card.addEventListener("click", () => {
      openSubmissionDetailsModal(app);
    });

    const btn = card.querySelector(".view-sub-details-btn");
    if (btn) {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openSubmissionDetailsModal(app);
      });
    }

    container.appendChild(card);
  });
}

// =========================================
// DOCUMENT UPLOAD REVIEW & SUCCESS MODALS
// =========================================
function showFileUploadReviewModal(file, reqTitle, onConfirm) {
  let overlay = document.getElementById("fu-review-modal-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "fu-review-modal-overlay";
    overlay.className = "fu-modal-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="fu-modal-sheet">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(105, 65, 198, 0.12); color: #6941C6; display: flex; align-items: center; justify-content: center;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            </div>
            <h3 style="margin: 0; font-size: 16.5px; font-weight: 700; color: var(--text-primary);">Review Document Submission</h3>
          </div>
          <button type="button" id="btn-close-fu-review" class="modal-close-icon-btn" aria-label="Cancel upload">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div style="margin-bottom: 14px;">
          <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); display: block; margin-bottom: 4px;">Requirement</span>
          <p id="fu-review-req-title" style="margin: 0; font-size: 14px; font-weight: 700; color: #6941C6;"></p>
        </div>
        <div style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 10px; background: var(--bg-canvas); border: 1px solid var(--border-color); margin-bottom: 16px;">
          <div id="fu-review-file-icon" style="width: 38px; height: 38px; border-radius: 8px; background: rgba(105, 65, 198, 0.12); color: #6941C6; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0;">
            FILE
          </div>
          <div style="min-width: 0; flex: 1;">
            <p id="fu-review-file-name" style="margin: 0; font-size: 13.5px; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">filename.pdf</p>
            <span id="fu-review-file-size" style="font-size: 11.5px; color: var(--text-secondary);">1.2 MB</span>
          </div>
        </div>
        <div style="padding: 12px 14px; border-radius: 10px; background: rgba(245, 158, 11, 0.08); border-left: 4px solid #D97706; margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <strong style="font-size: 12.5px; color: #D97706;">Permanent Submission Notice</strong>
          </div>
          <p style="margin: 0; font-size: 12.5px; color: var(--text-primary); line-height: 1.5;">
            Once confirmed and uploaded, this document is locked on your scholarship application record and will be immediately submitted to the scholarship committee. It cannot be deleted or replaced. Please confirm you have selected the correct, legible document.
          </p>
        </div>
        <div style="display: flex; gap: 10px;">
          <button type="button" id="btn-cancel-fu-review" class="btn-sub-modal-close-secondary" style="flex: 1;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            <span>Cancel</span>
          </button>
          <button type="button" id="btn-confirm-fu-upload" class="btn-sub-modal-view-post" style="flex: 1.3;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            <span>Confirm &amp; Upload</span>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  const reqEl = overlay.querySelector("#fu-review-req-title");
  const nameEl = overlay.querySelector("#fu-review-file-name");
  const sizeEl = overlay.querySelector("#fu-review-file-size");
  const iconEl = overlay.querySelector("#fu-review-file-icon");
  const btnClose = overlay.querySelector("#btn-close-fu-review");
  const btnCancel = overlay.querySelector("#btn-cancel-fu-review");
  const btnConfirm = overlay.querySelector("#btn-confirm-fu-upload");

  if (reqEl) reqEl.textContent = reqTitle;
  if (nameEl) nameEl.textContent = file.name;
  const isPdf = file.name.toLowerCase().endsWith(".pdf");
  if (iconEl) {
    iconEl.textContent = isPdf ? "PDF" : "IMG";
    iconEl.style.background = isPdf ? "rgba(239, 68, 68, 0.12)" : "rgba(105, 65, 198, 0.12)";
    iconEl.style.color = isPdf ? "#ef4444" : "#6941C6";
  }
  const formattedSize =
    file.size >= 1024 * 1024
      ? (file.size / (1024 * 1024)).toFixed(1) + " MB"
      : (file.size / 1024).toFixed(0) + " KB";
  if (sizeEl) sizeEl.textContent = formattedSize;

  function closeReview() {
    overlay.classList.remove("active");
  }

  if (btnClose) btnClose.onclick = closeReview;
  if (btnCancel) btnCancel.onclick = closeReview;

  if (btnConfirm) {
    btnConfirm.disabled = false;
    btnConfirm.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
      <span>Confirm &amp; Upload</span>
    `;
    btnConfirm.onclick = async () => {
      btnConfirm.disabled = true;
      btnConfirm.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="spin">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
          <path d="M12 2a10 10 0 0 1 10 10"></path>
        </svg>
        <span>Uploading...</span>
      `;
      closeReview();
      if (typeof onConfirm === "function") {
        await onConfirm();
      }
    };
  }

  overlay.classList.add("active");
}

function showFileUploadSuccessModal(fileName, providerName, onDone) {
  let overlay = document.getElementById("fu-success-modal-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "fu-success-modal-overlay";
    overlay.className = "fu-modal-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="fu-modal-sheet" style="text-align: center; max-width: 440px;">
        <div style="width: 58px; height: 58px; border-radius: 50%; background: rgba(16, 185, 129, 0.12); color: #10B981; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 800; color: var(--text-primary);">Document Submitted Successfully!</h3>
        <p id="fu-success-message" style="margin: 0 0 22px 0; font-size: 13.5px; color: var(--text-secondary); line-height: 1.5;"></p>
        <button type="button" id="btn-done-fu-success" class="btn-sub-modal-view-post" style="width: 100%;">
          <span>Done</span>
        </button>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  const msgEl = overlay.querySelector("#fu-success-message");
  if (msgEl) {
    msgEl.innerHTML = `<strong>&ldquo;${escapeHtml(fileName)}&rdquo;</strong> has been uploaded and officially attached to your scholarship application for evaluation by <strong>${escapeHtml(providerName || "the provider")}</strong>.`;
  }

  const btnDone = overlay.querySelector("#btn-done-fu-success");
  if (btnDone) {
    btnDone.onclick = () => {
      overlay.classList.remove("active");
      if (typeof onDone === "function") onDone();
    };
  }

  overlay.classList.add("active");
}

// Open the Full Submission Details Modal
function openSubmissionDetailsModal(app) {
  window._subModalUserDismissed = false;
  window._isSubDetailsModalOpen = true;
  if (window._subModalOpenTimeout) {
    clearTimeout(window._subModalOpenTimeout);
    window._subModalOpenTimeout = null;
  }

  let modalOverlay = document.getElementById("student-sub-modal-overlay");

  // Dynamically create modal if not present on page (e.g. from Dashboard)
  if (!modalOverlay) {
    modalOverlay = document.createElement("div");
    modalOverlay.id = "student-sub-modal-overlay";
    modalOverlay.className = "schol-modal-overlay";
    modalOverlay.setAttribute("aria-hidden", "true");
    modalOverlay.innerHTML = `
      <div class="schol-modal-sheet" id="student-sub-modal-sheet" style="max-width: 560px;">
        <!-- Modal Top Bar: Consistent Clean X Close Button -->
        <div style="display: flex; justify-content: flex-end; align-items: center; margin-bottom: 12px;">
          <button
            type="button"
            id="close-student-sub-modal"
            class="modal-close-icon-btn"
            aria-label="Close details"
            title="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 18px;">
          <div id="modal-sub-logo" class="student-app-logo" style="width: 52px; height: 52px; min-width: 52px; min-height: 52px; max-width: 52px; max-height: 52px; font-size: 16px; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">NX</div>
          <div style="flex: 1; min-width: 0;">
            <h4 id="modal-sub-title" style="font-size: 17px; font-weight: 800; color: var(--text-primary); margin: 0 0 4px 0; line-height: 1.3;">Scholarship Program</h4>
            <p id="modal-sub-provider" style="font-size: 13px; color: var(--text-secondary); margin: 0;">Provider Organization</p>
          </div>
        </div>
        <div id="modal-sub-status-card" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-radius: 12px; margin-bottom: 20px; background: rgba(139, 92, 246, 0.08); border: 1px solid rgba(139, 92, 246, 0.2);">
          <div>
            <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 2px;">Status</span>
            <span id="modal-sub-status-text" style="font-size: 15px; font-weight: 800; color: #8b5cf6;">Under Review</span>
          </div>
          <div id="modal-sub-badge-wrap">
            <span class="student-app-status-badge badge-status-review" id="modal-sub-badge">Under Review</span>
          </div>
        </div>
        <div style="margin-bottom: 22px;">
          <h5 style="font-size: 12.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); margin: 0 0 8px 0; display: flex; align-items: center; gap: 6px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            Provider Remarks &amp; Follow-Up Message
          </h5>
          <div id="modal-sub-feedback-box" style="padding: 14px 16px; border-radius: 12px; background: var(--bg-canvas); border: 1px solid var(--border-color); font-size: 13.5px; line-height: 1.55; color: var(--text-primary);"></div>
        </div>
        <div style="padding: 12px 14px; border-radius: 10px; background: var(--bg-canvas); border: 1px solid var(--border-color); margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-secondary);"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            <span style="font-size: 12.5px; font-weight: 600; color: var(--text-secondary);">Date Submitted</span>
          </div>
          <strong id="modal-sub-date" style="font-size: 13.5px; font-weight: 700; color: var(--text-primary);">Nov 8, 2026</strong>
        </div>
        <div style="margin-bottom: 24px;">
          <h5 style="font-size: 12.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); margin: 0 0 10px 0; display: flex; align-items: center; gap: 6px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
            </svg>
            Attached Verification Documents (<span id="modal-sub-doc-count">0</span>)
          </h5>
          <div id="modal-sub-doc-list" style="display: flex; flex-direction: column; gap: 8px;"></div>
        </div>
        <!-- APPLICANT IDENTITY (Redesigned Modern Structured Layout) -->
        <div class="sub-identity-card">
          <!-- Identity Header: Avatar + Student Name -->
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
            <div id="modal-sub-student-avatar" style="width: 42px; height: 42px; border-radius: 50%; background: rgba(105, 65, 198, 0.12); color: #6941C6; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0; overflow: hidden; border: 1.5px solid rgba(105, 65, 198, 0.25);">
              ST
            </div>
            <div style="min-width: 0;">
              <span style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: var(--text-secondary); display: block;">Applicant Identity</span>
              <h4 id="modal-sub-student-name" style="margin: 2px 0 0 0; font-size: 15px; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Student Scholar</h4>
            </div>
          </div>

          <!-- Information Grid: 2 columns, aligned, no dots -->
          <div class="sub-identity-grid">
            <div>
              <span style="font-size: 11px; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 2px;">Degree &amp; Year</span>
              <strong id="modal-sub-student-course" style="font-size: 13px; font-weight: 600; color: var(--text-primary); display: block; line-height: 1.35; word-break: break-word;">BSIT - Service Management</strong>
            </div>

            <div>
              <span style="font-size: 11px; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 2px;">Institution</span>
              <strong id="modal-sub-student-uni" style="font-size: 13px; font-weight: 600; color: var(--text-primary); display: block; line-height: 1.35; word-break: break-word;">Batangas State University</strong>
            </div>

            <div>
              <span style="font-size: 11px; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 2px;">Student ID / SR-Code</span>
              <strong id="modal-sub-student-id" style="font-size: 13px; font-weight: 600; color: var(--text-primary); display: block; line-height: 1.35;">24-02924</strong>
            </div>

            <div>
              <span style="font-size: 11px; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 2px;">Institutional Email</span>
              <strong id="modal-sub-student-email" style="font-size: 13px; font-weight: 600; color: var(--text-primary); display: block; line-height: 1.35; word-break: break-word;">student@batstate-u.edu.ph</strong>
            </div>
          </div>
        </div>
        <!-- MODAL BOTTOM ACTIONS: 1) View Scholarship Post Details, 2) Close Application Details -->
        <div class="sub-modal-actions">
          <button
            type="button"
            id="btn-sub-view-post"
            class="btn-sub-modal-view-post"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
            <span>View Scholarship Post</span>
          </button>
          <button
            type="button"
            id="btn-close-sub-modal"
            class="btn-sub-modal-close-secondary"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            <span>Close Application Details</span>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modalOverlay);
  }

  // Populate title & provider
  const title = app.scholarshipTitle || app.title || "Scholarship Program";
  const org = app.providerName || app.organization || "NEXO";
  const titleEl = document.getElementById("modal-sub-title");
  const provEl = document.getElementById("modal-sub-provider");
  const logoEl = document.getElementById("modal-sub-logo");

  if (titleEl) titleEl.textContent = title;
  if (provEl) provEl.textContent = org;
  if (logoEl) {
    const resolvedLogo = resolveAppProviderLogo(app);
    if (resolvedLogo) {
      logoEl.innerHTML = `<img src="${resolvedLogo}" alt="${escapeHtml(org)}" style="width: 100%; height: 100%; max-width: 100%; max-height: 100%; border-radius: 50%; object-fit: cover; display: block;">`;
    } else {
      const inits = org
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0] || "")
        .join("")
        .toUpperCase();
      logoEl.textContent = inits || "NX";
    }
  }

  // Populate Status
  const rawStatus = (app.status || "Submitted").toLowerCase();
  const statusCard = document.getElementById("modal-sub-status-card");
  const statusText = document.getElementById("modal-sub-status-text");
  const statusBadge = document.getElementById("modal-sub-badge");

  if (rawStatus.includes("approved")) {
    if (statusText) {
      statusText.textContent = "Approved";
      statusText.style.color = "#10b981";
    }
    if (statusBadge) {
      statusBadge.className = "student-app-status-badge badge-status-approved";
      statusBadge.textContent = "Approved";
    }
    if (statusCard) {
      statusCard.style.background = "rgba(16, 185, 129, 0.08)";
      statusCard.style.borderColor = "rgba(16, 185, 129, 0.25)";
    }
  } else if (rawStatus.includes("rejected")) {
    if (statusText) {
      statusText.textContent = "Rejected";
      statusText.style.color = "#ef4444";
    }
    if (statusBadge) {
      statusBadge.className = "student-app-status-badge badge-status-rejected";
      statusBadge.textContent = "Rejected";
    }
    if (statusCard) {
      statusCard.style.background = "rgba(239, 68, 68, 0.08)";
      statusCard.style.borderColor = "rgba(239, 68, 68, 0.25)";
    }
  } else if (rawStatus.includes("review")) {
    if (statusText) {
      statusText.textContent = "Under Review";
      statusText.style.color = "#8b5cf6";
    }
    if (statusBadge) {
      statusBadge.className = "student-app-status-badge badge-status-review";
      statusBadge.textContent = "Under Review";
    }
    if (statusCard) {
      statusCard.style.background = "rgba(139, 92, 246, 0.08)";
      statusCard.style.borderColor = "rgba(139, 92, 246, 0.25)";
    }
  } else {
    // Submitted
    if (statusText) {
      statusText.textContent = "Submitted";
      statusText.style.color = "#60A5FA";
    }
    if (statusBadge) {
      statusBadge.className = "student-app-status-badge badge-status-submitted";
      statusBadge.textContent = "Submitted";
    }
    if (statusCard) {
      statusCard.style.background = "rgba(96, 165, 250, 0.08)";
      statusCard.style.borderColor = "rgba(96, 165, 250, 0.25)";
    }
  }

  // Populate Provider Feedback / Follow-Up Message (Straight to the point remark)
  const feedbackBox = document.getElementById("modal-sub-feedback-box");
  const feedbackMsg = app.remarks || app.feedback || app.notes;

  if (feedbackBox) {
    let msg = feedbackMsg && feedbackMsg.trim() ? feedbackMsg.trim() : "";
    if (!msg) {
      if (rawStatus.includes("approved")) {
        msg =
          "Congratulations! Your scholarship application has been officially approved. Please monitor your institutional university email and contact phone for disbursement and onboarding instructions outside of NEXO.";
      } else if (rawStatus.includes("rejected")) {
        msg =
          "Thank you for applying. After careful evaluation of all applicants, your application was not accepted for this cycle. You are encouraged to explore other grants.";
      } else if (rawStatus.includes("review")) {
        msg =
          "Your application and verification documents are currently under evaluation by the scholarship committee. Official follow-up notes from the provider will appear here.";
      } else {
        msg =
          "Your academic verification files are currently on record with the scholarship evaluation committee. Official follow-up notes from the provider will appear here once processed.";
      }
    }
    feedbackBox.innerHTML = `
      <div style="background: rgba(139, 92, 246, 0.06); border-left: 4px solid #8b5cf6; border-radius: 8px; padding: 12px 14px;">
        <p style="margin: 0; font-size: 13.5px; color: var(--text-primary); line-height: 1.55; white-space: pre-wrap;">${escapeHtml(msg)}</p>
      </div>
    `;
  }

  // Populate Date Submitted (Clearer date, Grant Capacity removed)
  const dateEl = document.getElementById("modal-sub-date");
  if (dateEl) {
    dateEl.textContent =
      app.formattedDate || app.appliedDate || "Recently Applied";
  }

  // Populate Documents List
  const docListEl = document.getElementById("modal-sub-doc-list");
  const docCountEl = document.getElementById("modal-sub-doc-count");
  const rawDocs = app.documents || app.uploadedDocuments || [];

  const attachedDocs = rawDocs.filter((d) => {
    if (typeof d === "string") return !d.includes("(To Follow Up)");
    return !d.isFollowUp && d.status !== "to_follow_up" && d.type !== "to_follow_up";
  });
  const followUpDocs = rawDocs.filter((d) => {
    if (typeof d === "string") return d.includes("(To Follow Up)");
    return d.isFollowUp || d.status === "to_follow_up" || d.type === "to_follow_up";
  });

  if (docCountEl) docCountEl.textContent = attachedDocs.length;

  if (docListEl) {
    docListEl.innerHTML = "";
    if (attachedDocs.length === 0 && followUpDocs.length === 0) {
      docListEl.innerHTML = `<p style="font-size: 13px; color: var(--text-secondary); margin: 0;">No documents were attached to this submission.</p>`;
    } else {
      // 1. Attached Files
      attachedDocs.forEach((doc, idx) => {
        const docName =
          typeof doc === "string" ? doc : doc.name || `Document_${idx + 1}`;
        const docSize =
          typeof doc === "object" && doc.size
            ? typeof doc.size === "number"
              ? (doc.size / 1024).toFixed(0) + " KB"
              : doc.size
            : "Verified Upload";
        const isPdf = docName.toLowerCase().endsWith(".pdf");
        const reqLabel =
          typeof doc === "object" && (doc.requirement || doc.title)
            ? doc.requirement || doc.title
            : "";

        const docItem = document.createElement("div");
        docItem.style.cssText =
          "display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 8px; background: var(--bg-canvas); border: 1px solid var(--border-color); gap: 10px;";
        docItem.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
            <div style="width: 32px; height: 32px; border-radius: 6px; background: ${isPdf ? "rgba(239, 68, 68, 0.12)" : "rgba(139, 92, 246, 0.12)"}; color: ${isPdf ? "#ef4444" : "#8b5cf6"}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 11px; font-weight: 700;">
              ${isPdf ? "PDF" : "IMG"}
            </div>
            <div style="min-width: 0;">
              <p style="margin: 0; font-size: 13px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${escapeHtml(docName)}${reqLabel && reqLabel !== docName ? ` <span style="font-size: 10.5px; font-weight: 600; color: #8b5cf6; background: rgba(139, 92, 246, 0.12); padding: 1.5px 5px; border-radius: 4px; margin-left: 4px;">${escapeHtml(reqLabel)}</span>` : ""}
              </p>
              <span style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(docSize)}</span>
            </div>
          </div>
          <span style="font-size: 11.5px; color: #10b981; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Attached
          </span>
        `;
        docListEl.appendChild(docItem);
      });

      // 2. Requirements To Follow Up
      if (followUpDocs.length > 0) {
        followUpDocs.forEach((doc, fuIdx) => {
          const reqTitle =
            typeof doc === "object"
              ? doc.requirement || doc.title || (doc.name || "").replace(" (To Follow Up)", "")
              : String(doc).replace(" (To Follow Up)", "");

          const fuItem = document.createElement("div");
          fuItem.style.cssText =
            "display: flex; flex-direction: column; padding: 12px 14px; border-radius: 10px; background: rgba(245, 158, 11, 0.06); border: 1px solid rgba(245, 158, 11, 0.35); gap: 10px; margin-top: 6px;";
          fuItem.innerHTML = `
            <input type="file" id="fu-file-input-${fuIdx}" style="display: none;" accept=".pdf,.png,.jpg,.jpeg">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
              <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                <div style="width: 32px; height: 32px; border-radius: 6px; background: rgba(245, 158, 11, 0.15); color: #D97706; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                </div>
                <div style="min-width: 0;">
                  <p style="margin: 0; font-size: 13px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${escapeHtml(reqTitle)}
                  </p>
                  <span style="font-size: 11px; color: #D97706; font-weight: 600;">Pending</span>
                </div>
              </div>
              <span style="font-size: 11px; color: #D97706; font-weight: 700; background: rgba(245, 158, 11, 0.18); padding: 3px 8px; border-radius: 6px; flex-shrink: 0;">
                To Follow Up
              </span>
            </div>

            <div style="display: flex; justify-content: flex-end; width: 100%;">
              <button type="button" id="btn-upload-fu-${fuIdx}" class="btn-fu-upload">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                <span>Upload Document</span>
              </button>
            </div>
          `;

          const fileInput = fuItem.querySelector(`#fu-file-input-${fuIdx}`);
          const btnUploadFu = fuItem.querySelector(`#btn-upload-fu-${fuIdx}`);

          if (btnUploadFu && fileInput) {
            btnUploadFu.onclick = () => fileInput.click();

            fileInput.onchange = (e) => {
              const file = e.target.files[0];
              if (!file) return;

              if (file.size > 5 * 1024 * 1024) {
                alert("File size exceeds 5MB limit. Please choose a smaller file.");
                fileInput.value = "";
                return;
              }

              showFileUploadReviewModal(file, reqTitle, async () => {
                btnUploadFu.disabled = true;
                btnUploadFu.innerHTML = `
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="spin">
                    <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
                    <path d="M12 2a10 10 0 0 1 10 10"></path>
                  </svg>
                  <span>Uploading...</span>
                `;

                const reader = new FileReader();
                reader.onload = async () => {
                  const base64Data = reader.result;
                  const formattedSize =
                    file.size >= 1024 * 1024
                      ? (file.size / (1024 * 1024)).toFixed(1) + " MB"
                      : (file.size / 1024).toFixed(0) + " KB";

                  const followUpPayload = {
                    followUpDocument: {
                      name: file.name,
                      title: reqTitle,
                      requirement: reqTitle,
                      size: formattedSize,
                      type: file.type || "application/pdf",
                      data: base64Data,
                      status: "attached",
                      isFollowUp: false,
                    },
                  };

                  try {
                    const res = await fetch(`${API_BASE}/api/applications/${app.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(followUpPayload),
                    }).catch(() => null);

                    if (res && res.ok) {
                      const resData = await res.json();
                      if (resData.application) {
                        Object.assign(app, resData.application);
                      }
                    } else {
                      const updatedDocs = (app.documents || []).map((d) => {
                        const dName = typeof d === "string" ? d : d.requirement || d.title || d.name || "";
                        if (dName.toLowerCase().includes(reqTitle.toLowerCase())) {
                          return {
                            name: file.name,
                            title: reqTitle,
                            requirement: reqTitle,
                            size: formattedSize,
                            type: file.type || "application/pdf",
                            status: "attached",
                            isFollowUp: false,
                          };
                        }
                        return d;
                      });
                      app.documents = updatedDocs;
                      app.uploadedDocuments = updatedDocs
                        .filter((d) => (typeof d === "string" ? !d.includes("(To Follow Up)") : !d.isFollowUp))
                        .map((d) => (typeof d === "string" ? d : d.name));
                    }
                  } catch (err) {
                    console.warn("Could not patch application follow-up doc:", err);
                  }

                  try {
                    const cached = JSON.parse(localStorage.getItem("nexo_applications") || "[]");
                    const idx = cached.findIndex((a) => String(a.id) === String(app.id));
                    if (idx !== -1) {
                      cached[idx] = app;
                      localStorage.setItem("nexo_applications", JSON.stringify(cached));
                    }
                  } catch (_) {}

                  showFileUploadSuccessModal(file.name, app.providerName || app.organization || "NEXO", () => {
                    openSubmissionDetailsModal(app);
                  });
                };
                reader.readAsDataURL(file);
              });
            };
          }

          docListEl.appendChild(fuItem);
        });
      }
    }
  }

  // Populate Student Identity (Structured Card)
  const nameEl = document.getElementById("modal-sub-student-name");
  const avatarEl = document.getElementById("modal-sub-student-avatar");
  const courseEl = document.getElementById("modal-sub-student-course");
  const uniEl = document.getElementById("modal-sub-student-uni");
  const idEl = document.getElementById("modal-sub-student-id");
  const emailEl = document.getElementById("modal-sub-student-email");

  const sName = app.studentName || "Student Scholar";
  if (nameEl) nameEl.textContent = sName;

  if (avatarEl) {
    const sPic = app.studentProfilePic || localStorage.getItem("nexo-student-avatar") || "";
    if (sPic && sPic.trim()) {
      avatarEl.innerHTML = `<img src="${sPic}" alt="${escapeHtml(sName)}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;">`;
    } else {
      const inits = sName
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0] || "")
        .join("")
        .toUpperCase();
      avatarEl.textContent = inits || "ST";
    }
  }

  if (courseEl) {
    const c = app.course || "";
    const y = app.yearLevel || "";
    courseEl.textContent = [c, y].filter(Boolean).join(" - ") || "Undergraduate Scholar";
  }
  if (uniEl) {
    uniEl.textContent = app.university || "Batangas State University";
  }
  if (idEl) {
    idEl.textContent = app.studentId || "Verified Account";
  }
  if (emailEl) {
    emailEl.textContent = app.studentEmail || "student@batstate-u.edu.ph";
  }

  // Open Modal
  modalOverlay.classList.add("active");
  document.body.style.overflow = "hidden";

  // Modal Close Handlers
  function closeSubModal() {
    window._subModalUserDismissed = true;
    window._isSubDetailsModalOpen = false;
    if (window._subModalOpenTimeout) {
      clearTimeout(window._subModalOpenTimeout);
      window._subModalOpenTimeout = null;
    }
    // Clean any lingering query parameter from the URL address bar
    try {
      if (window.location.search) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (_) {}

    modalOverlay.classList.remove("active");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", handleEsc);
  }

  const closeBtn = document.getElementById("close-student-sub-modal");
  const bottomCloseBtn = document.getElementById("btn-close-sub-modal");
  const btnViewPost = document.getElementById("btn-sub-view-post");

  if (closeBtn) closeBtn.onclick = closeSubModal;
  if (bottomCloseBtn) bottomCloseBtn.onclick = closeSubModal;
  if (btnViewPost) {
    btnViewPost.onclick = () => {
      const targetScholId = app.scholarshipId || app.id || "";
      closeSubModal();
      if (
        window.location.pathname.includes("student-browse.html") &&
        typeof openDetailsModal === "function" &&
        Array.isArray(window.allScholarships)
      ) {
        const match = window.allScholarships.find((s) => String(s.id) === String(targetScholId));
        if (match) {
          openDetailsModal(match);
          return;
        }
      }
      window.location.href = `student-browse.html?scholId=${encodeURIComponent(targetScholId)}`;
    };
  }

  modalOverlay.onclick = (e) => {
    if (e.target === modalOverlay) closeSubModal();
  };

  const handleEsc = (e) => {
    if (e.key === "Escape" && modalOverlay.classList.contains("active")) {
      closeSubModal();
      document.removeEventListener("keydown", handleEsc);
    }
  };
  document.addEventListener("keydown", handleEsc);
}

// Initialize Submissions Page Filtering (Status Dropdown & Search Bar)
function initSubmissionsFiltering() {
  const filterDropdownBtn = document.getElementById("btn-submissions-filter");
  const filterDropdownMenu = document.getElementById("menu-submissions-filter");
  const filterDropdownWrapper = document.getElementById(
    "dropdown-wrapper-submissions-filter",
  );
  const searchInput = document.getElementById("submissions-search-input");
  const resetBtn = document.getElementById("reset-submissions-filter");
  const legacyFilterTabs = document.getElementById("submissions-status-filters");

  if (!filterDropdownBtn && !legacyFilterTabs && !searchInput) return;

  const statusLabelMap = {
    all: "Status",
    submitted: "Submitted",
    review: "Under Review",
    approved: "Approved",
    rejected: "Rejected",
  };

  const updateDropdownUI = (activeStatus) => {
    if (filterDropdownBtn) {
      filterDropdownBtn.classList.toggle("is-filtered", activeStatus !== "all");
      const statusTitle = statusLabelMap[activeStatus] || "Status";
      filterDropdownBtn.title =
        activeStatus === "all" ? "Filter by status" : `Filter: ${statusTitle}`;
    }
    if (filterDropdownMenu) {
      filterDropdownMenu
        .querySelectorAll(".directory-dropdown-item")
        .forEach((item) => {
          item.classList.toggle("active", item.dataset.filter === activeStatus);
        });
    }
    if (legacyFilterTabs) {
      legacyFilterTabs.querySelectorAll(".filter-tab").forEach((tab) => {
        tab.classList.toggle("active", tab.dataset.filter === activeStatus);
      });
    }
  };

  // Pre-activate filter from URL parameter if passed (e.g. from Dashboard metric cards: ?filter=approved)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const initialFilter = (
      urlParams.get("filter") ||
      urlParams.get("status") ||
      ""
    ).toLowerCase();
    if (
      initialFilter &&
      (statusLabelMap[initialFilter] !== undefined || initialFilter === "all")
    ) {
      currentSubmissionsFilter = initialFilter;
      updateDropdownUI(initialFilter);
      try {
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );
      } catch (_) {}
    }
  } catch (_) {}

  // Toggle Dropdown Menu
  if (filterDropdownBtn && filterDropdownMenu) {
    filterDropdownBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = filterDropdownMenu.classList.contains("show");
      filterDropdownMenu.classList.toggle("show", !isOpen);
      filterDropdownBtn.setAttribute("aria-expanded", String(!isOpen));
      if (filterDropdownWrapper) {
        filterDropdownWrapper.classList.toggle("is-open", !isOpen);
      }
    });

    // Handle Dropdown Item Clicks
    filterDropdownMenu
      .querySelectorAll(".directory-dropdown-item")
      .forEach((item) => {
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          const selectedStatus = item.dataset.filter || "all";
          currentSubmissionsFilter = selectedStatus;
          window._submissionsShowAllApps = false;
          updateDropdownUI(selectedStatus);

          filterDropdownMenu.classList.remove("show");
          filterDropdownBtn.setAttribute("aria-expanded", "false");
          if (filterDropdownWrapper) {
            filterDropdownWrapper.classList.remove("is-open");
          }
          renderFilteredSubmissions();
        });
      });

    // Close Dropdown on Outside Click
    document.addEventListener("click", (e) => {
      if (!filterDropdownWrapper || !filterDropdownWrapper.contains(e.target)) {
        filterDropdownMenu.classList.remove("show");
        filterDropdownBtn.setAttribute("aria-expanded", "false");
        if (filterDropdownWrapper) {
          filterDropdownWrapper.classList.remove("is-open");
        }
      }
    });
  }

  // Legacy tab listener support (if ever rendered)
  if (legacyFilterTabs) {
    legacyFilterTabs.querySelectorAll(".filter-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const filterVal = tab.dataset.filter || "all";
        currentSubmissionsFilter = filterVal;
        window._submissionsShowAllApps = false;
        updateDropdownUI(filterVal);
        renderFilteredSubmissions();
      });
    });
  }

  // Live Search Input Listener
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentSubmissionsSearch = e.target.value;
      window._submissionsShowAllApps = false;
      renderFilteredSubmissions();
    });
  }

  // Reset Filters Button Listener
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      currentSubmissionsFilter = "all";
      currentSubmissionsSearch = "";
      window._submissionsShowAllApps = false;
      if (searchInput) searchInput.value = "";
      updateDropdownUI("all");
      renderFilteredSubmissions();
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

// =========================================
// 5. GLOBAL LISTENERS & INITIALIZATION
// =========================================
document.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize Side Menu Link Listeners
  const menu =
    document.getElementById("nav-menu") || document.querySelector(".nav-menu");
  if (menu) {
    menu.addEventListener("click", (e) => {
      const link = e.target.closest("a.nav-link, a.btn");
      if (!link) return;

      const href = link.getAttribute("href");
      if (
        href &&
        (href.startsWith("#") || href.includes(window.location.pathname))
      ) {
        closeSideMenu();
      }
    });
  }

  // 2. Initialize Interactive Notification Bell
  initNotificationBell();

  // 3. Initialize Student Greeting & Profile Details
  initStudentGreeting();

  // 4. Load Real-time Data / Empty State
  initSubmissionsFiltering();
  loadStudentData();
  setInterval(loadStudentData, 3500);
  window.addEventListener("focus", loadStudentData);

  // 5. Logout Listener
  const logoutBtn = document.getElementById("student-logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      sessionStorage.removeItem("nexo-logged-in");
      sessionStorage.removeItem("nexo-student-name");
      sessionStorage.removeItem("nexo-student-email");
      sessionStorage.removeItem("nexo-student-intro-played");
    });
  }

  // 6. Global document clicks & scroll to close Side Menu & Notifications
  document.addEventListener("click", (e) => {
    const btn =
      document.getElementById("avatar-menu-btn") ||
      document.querySelector(".hamburger-btn");
    const menuEl =
      document.getElementById("nav-menu") ||
      document.querySelector(".nav-menu");
    const popover = document.getElementById("header-notif-popover");
    const notifBtn = document.querySelector(".notification-btn");

    if (menuEl && menuEl.classList.contains("open")) {
      if ((!btn || !btn.contains(e.target)) && !menuEl.contains(e.target)) {
        closeSideMenu();
      }
    }

    if (popover && popover.classList.contains("open")) {
      if (
        notifBtn &&
        !notifBtn.contains(e.target) &&
        !popover.contains(e.target)
      ) {
        closeNotifications();
      }
    }
  });

  window.addEventListener(
    "scroll",
    () => {
      const menuEl =
        document.getElementById("nav-menu") ||
        document.querySelector(".nav-menu");
      if (menuEl && menuEl.classList.contains("open")) {
        closeSideMenu();
      }
      const popover = document.getElementById("header-notif-popover");
      if (popover && popover.classList.contains("open")) {
        closeNotifications();
      }
    },
    { passive: true },
  );

  if (typeof window.syncMenuTooltips === "function") {
    window.syncMenuTooltips();
  }

  // 7. ESC key closes both side menu and notifications
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeSideMenu();
      closeNotifications();
    }
  });
});
