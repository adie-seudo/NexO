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
    if (overlay) overlay.classList.toggle("active", willOpen);
    document.body.classList.toggle("menu-open", willOpen);
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

  const currentEmail = (localStorage.getItem("nexo_student_email") || "").toLowerCase().trim();

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
    const currentEmail = (localStorage.getItem("nexo_student_email") || "").toLowerCase().trim();
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
      const cached = localStorage.getItem("nexo_applications");
      if (cached) applications = JSON.parse(cached);
    } catch (_) {}
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
  if (statReview) statReview.textContent = reviewCount + submittedCount;
  if (statRejected) statRejected.textContent = rejectedCount;

  // Setup dynamic card navigation (clickable only if count >= 1)
  const cardMyApps = document.getElementById("card-stat-my-apps");
  const cardApproved = document.getElementById("card-stat-approved");
  const cardReview = document.getElementById("card-stat-review");
  const cardRejected = document.getElementById("card-stat-rejected");

  if (cardMyApps) {
    if (totalCount >= 1) {
      cardMyApps.classList.add("is-clickable");
      cardMyApps.classList.remove("is-disabled");
      cardMyApps.title = "View all submitted applications";
      cardMyApps.onclick = () => {
        window.location.href = "student-submissions.html";
      };
    } else {
      cardMyApps.classList.remove("is-clickable");
      cardMyApps.classList.add("is-disabled");
      cardMyApps.removeAttribute("title");
      cardMyApps.onclick = null;
    }
  }

  if (cardApproved) {
    if (approvedCount >= 1) {
      cardApproved.classList.add("is-clickable");
      cardApproved.classList.remove("is-disabled");
      cardApproved.title = "View approved scholarship grants";
      cardApproved.onclick = () => {
        window.location.href = "student-submissions.html?filter=approved";
      };
    } else {
      cardApproved.classList.remove("is-clickable");
      cardApproved.classList.add("is-disabled");
      cardApproved.removeAttribute("title");
      cardApproved.onclick = null;
    }
  }

  const reviewAndSubmittedCount = reviewCount + submittedCount;
  if (cardReview) {
    if (reviewAndSubmittedCount >= 1) {
      cardReview.classList.add("is-clickable");
      cardReview.classList.remove("is-disabled");
      cardReview.title = "View applications under review";
      cardReview.onclick = () => {
        window.location.href = "student-submissions.html?filter=review";
      };
    } else {
      cardReview.classList.remove("is-clickable");
      cardReview.classList.add("is-disabled");
      cardReview.removeAttribute("title");
      cardReview.onclick = null;
    }
  }

  if (cardRejected) {
    if (rejectedCount >= 1) {
      cardRejected.classList.add("is-clickable");
      cardRejected.classList.remove("is-disabled");
      cardRejected.title = "View rejected applications";
      cardRejected.onclick = () => {
        window.location.href = "student-submissions.html?filter=rejected";
      };
    } else {
      cardRejected.classList.remove("is-clickable");
      cardRejected.classList.add("is-disabled");
      cardRejected.removeAttribute("title");
      cardRejected.onclick = null;
    }
  }

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
  if (!window._hasHandledSubDetailDeepLink) {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const targetId =
        urlParams.get("id") ||
        urlParams.get("applicationId") ||
        urlParams.get("appId");
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
    document.getElementById("submissions-status-filters"),
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
  } else {
    // On Dashboard / Home Page:
    // Only top three latest applications by default.
    // If more than 3 applications, show View All button which expands in-place on home page.
    // If 3 or fewer applications, View All button will not occur.
    const totalApps = allStudentApplications.length;
    if (viewAllBtn) {
      if (totalApps > 3) {
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
          listToRender = allStudentApplications.slice(0, 3);
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
        listToRender = allStudentApplications;
      }
    }
  }

  if (filterEmptyCard) filterEmptyCard.style.display = "none";
  appsFeed.style.display = "flex";
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
        ? `<img src="${resolvedLogo}" alt="${escapeHtml(orgName)}" class="student-app-logo" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" />`
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

    // 1. Attached Files Pill (Clearly identified pill, not mere text)
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
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
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

    card.innerHTML = `
      <div class="student-app-header-row">
        ${logoHtml}
        <div class="student-app-info">
          <h4 class="student-app-title" title="${escapeHtml(title)}">${escapeHtml(title)}</h4>
          <p class="student-app-org">${escapeHtml(orgName)} &bull; ${escapeHtml(date)}</p>
        </div>
        <div class="student-app-status-col">
          <span class="student-app-status-badge ${badgeClass}">${escapeHtml(statusLabel)}</span>
        </div>
      </div>

      <div class="student-app-pills-row">
        ${docsPillHtml}
        ${followUpPillHtml}
        ${remarksPillHtml}
      </div>

      <div class="student-app-action-row">
        <button type="button" class="btn btn-secondary view-sub-details-btn" data-app-id="${app.id}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          View Full Details
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
          <div id="modal-sub-logo" class="student-app-logo" style="width: 52px; height: 52px; font-size: 16px; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">NX</div>
          <div style="flex: 1; min-width: 0;">
            <h4 id="modal-sub-title" style="font-size: 17px; font-weight: 800; color: var(--text-primary); margin: 0 0 4px 0; line-height: 1.3;">Scholarship Program</h4>
            <p id="modal-sub-provider" style="font-size: 13px; color: var(--text-secondary); margin: 0;">Provider Organization</p>
          </div>
        </div>
        <div id="modal-sub-status-card" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-radius: 12px; margin-bottom: 20px; background: rgba(139, 92, 246, 0.08); border: 1px solid rgba(139, 92, 246, 0.2);">
          <div>
            <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 2px;">Decision Status</span>
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
        <div style="padding: 12px 14px; border-radius: 10px; background: var(--bg-canvas); border: 1px solid var(--border-color); margin-bottom: 24px;">
          <span style="font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; display: block; margin-bottom: 4px;">Verified Applicant Identity</span>
          <p style="margin: 0; font-size: 13px; color: var(--text-primary); font-weight: 600;" id="modal-sub-student-name">Student Scholar</p>
          <p style="margin: 2px 0 0 0; font-size: 12px; color: var(--text-secondary);" id="modal-sub-student-info">Verified Student Account</p>
        </div>
        <button type="button" id="btn-close-sub-modal" class="btn-sub-modal-close" style="width: 100%; padding: 12px 24px; font-size: 14px; font-weight: 700; border-radius: 100px; background: #6941C6; color: #ffffff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 2px 8px rgba(105, 65, 198, 0.35); transition: all 0.2s ease;">
          Close Details
        </button>
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
      logoEl.innerHTML = `<img src="${resolvedLogo}" alt="${escapeHtml(org)}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
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
        followUpDocs.forEach((doc) => {
          const reqTitle =
            typeof doc === "object"
              ? doc.requirement || doc.title || (doc.name || "").replace(" (To Follow Up)", "")
              : String(doc).replace(" (To Follow Up)", "");

          const fuItem = document.createElement("div");
          fuItem.style.cssText =
            "display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 8px; background: rgba(245, 158, 11, 0.06); border: 1px solid rgba(245, 158, 11, 0.35); gap: 10px;";
          fuItem.innerHTML = `
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
          `;
          docListEl.appendChild(fuItem);
        });
      }

      // 3. Document Integrity Notice
      const lockNotice = document.createElement("div");
      lockNotice.style.cssText =
        "margin-top: 12px; padding: 10px 12px; border-radius: 8px; background: rgba(139, 92, 246, 0.06); border: 1px solid rgba(139, 92, 246, 0.2); font-size: 11.5px; color: var(--text-secondary); line-height: 1.45; display: flex; align-items: flex-start; gap: 8px;";
      lockNotice.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" style="flex-shrink: 0; margin-top: 1px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        <span><strong>Document Integrity Notice:</strong> Submitted documents are locked on record to maintain verification integrity.</span>
      `;
      docListEl.appendChild(lockNotice);
    }
  }

  // Populate Student Identity
  const nameEl = document.getElementById("modal-sub-student-name");
  const infoEl = document.getElementById("modal-sub-student-info");
  if (nameEl) nameEl.textContent = app.studentName || "Student Scholar";
  if (infoEl) {
    const course = app.course || "";
    const uni = app.university || "";
    const email = app.studentEmail || "";
    infoEl.textContent = [course, uni, email].filter(Boolean).join(" • ") || "Verified Student Account";
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

  if (closeBtn) closeBtn.onclick = closeSubModal;
  if (bottomCloseBtn) bottomCloseBtn.onclick = closeSubModal;

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

// Initialize Submissions Page Filtering (Status Tabs & Search Bar)
function initSubmissionsFiltering() {
  const filterTabsContainer = document.getElementById(
    "submissions-status-filters",
  );
  const searchInput = document.getElementById("submissions-search-input");
  const resetBtn = document.getElementById("reset-submissions-filter");

  if (!filterTabsContainer && !searchInput) return;

  // Pre-activate tab from URL parameter if passed (e.g. from Dashboard metric cards)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const initialFilter = (
      urlParams.get("filter") ||
      urlParams.get("status") ||
      ""
    ).toLowerCase();
    if (initialFilter && filterTabsContainer) {
      const targetTab = filterTabsContainer.querySelector(
        `.filter-tab[data-filter="${initialFilter}"]`,
      );
      if (targetTab) {
        filterTabsContainer
          .querySelectorAll(".filter-tab")
          .forEach((t) => t.classList.remove("active"));
        targetTab.classList.add("active");
        currentSubmissionsFilter = initialFilter;
      }
      try {
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );
      } catch (_) {}
    }
  } catch (_) {}

  if (filterTabsContainer) {
    filterTabsContainer.querySelectorAll(".filter-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        filterTabsContainer
          .querySelectorAll(".filter-tab")
          .forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        currentSubmissionsFilter = tab.dataset.filter || "all";
        renderFilteredSubmissions();
      });
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentSubmissionsSearch = e.target.value;
      renderFilteredSubmissions();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      currentSubmissionsFilter = "all";
      currentSubmissionsSearch = "";
      if (searchInput) searchInput.value = "";
      if (filterTabsContainer) {
        filterTabsContainer.querySelectorAll(".filter-tab").forEach((t) => {
          t.classList.toggle("active", t.dataset.filter === "all");
        });
      }
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

  // 6. Global document clicks to close Side Menu & Notifications
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
      if (btn && !btn.contains(e.target) && !menuEl.contains(e.target)) {
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

  // 7. ESC key closes both side menu and notifications
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeSideMenu();
      closeNotifications();
    }
  });
});
