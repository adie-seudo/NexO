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
    document.getElementById("nav-menu") ||
    document.querySelector(".nav-menu");
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
    document.getElementById("nav-menu") ||
    document.querySelector(".nav-menu");
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

function initNotificationBell() {
  const notifBtn = document.querySelector(".notification-btn");
  if (!notifBtn) return;

  let popover = document.getElementById("header-notif-popover");
  if (!popover) {
    popover = document.createElement("div");
    popover.id = "header-notif-popover";
    popover.className = "notification-popover";
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-label", "Notifications");
    popover.innerHTML = `
      <div class="notif-popover-header">
        <h4 class="notif-popover-title">Notifications</h4>
        <span class="notif-badge-count" id="student-notif-badge">0 New</span>
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
    try {
      const res = await fetch(`${NOTIF_API}/api/notifications?recipient=student`);
      if (!res.ok) return;
      const notifs = await res.json();
      const newHash = JSON.stringify(notifs);
      if (newHash === lastStudentNotifsHash) return;
      lastStudentNotifsHash = newHash;
      renderStudentNotifications(notifs);
    } catch (_) {}
  }

  function renderStudentNotifications(notifs) {
    const bodyEl = document.getElementById("student-notif-body");
    const badgeEl = document.getElementById("student-notif-badge");
    const dot = notifBtn.querySelector(".notification-dot") || document.getElementById("student-notif-dot");
    if (!bodyEl) return;

    const list = Array.isArray(notifs) ? notifs : [];
    const unreadCount = list.filter((n) => !n.read).length;

    if (badgeEl) badgeEl.textContent = `${unreadCount} New`;
    if (dot) {
      if (unreadCount > 0) {
        dot.classList.add("active");
        notifBtn.classList.add("has-unread");
      } else {
        dot.classList.remove("active");
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
        return `
          <a href="${n.link || 'student-submissions.html'}" class="notif-item ${isUnread ? 'unread' : ''}">
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
  }

  // Initial load and periodic polling
  loadStudentNotifications();
  setInterval(loadStudentNotifications, 4000);

  // Toggle notification popover on bell click
  notifBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    closeSideMenu();
    const willOpen = !popover.classList.contains("open");
    popover.classList.toggle("open", willOpen);
    notifBtn.setAttribute("aria-expanded", willOpen ? "true" : "false");

    if (willOpen) {
      // Mark student notifications as read
      fetch(`${NOTIF_API}/api/notifications/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: "student" }),
      }).catch(() => {});

      const dot = notifBtn.querySelector(".notification-dot") || document.getElementById("student-notif-dot");
      if (dot) dot.classList.remove("active");
      notifBtn.classList.remove("has-unread");
      const badgeEl = document.getElementById("student-notif-badge");
      if (badgeEl) badgeEl.textContent = "0 New";
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

  // Resolve student name (defaults to Juan Dela Cruz for admin testing)
  const savedName =
    sessionStorage.getItem("nexo-student-name") ||
    sessionStorage.getItem("nexo-pending-name") ||
    "Juan Dela Cruz";

  if (nameTitle) {
    nameTitle.textContent = savedName;
  }

  // Set header initials or avatar photo
  if (headerAvatar) {
    let customAvatar = sessionStorage.getItem("nexo-student-avatar");
    if (!customAvatar) {
      try {
        const cached = JSON.parse(localStorage.getItem("nexo_student_settings") || "{}");
        if (cached && cached.profilePicture) customAvatar = cached.profilePicture;
      } catch (_) {}
    }

    if (customAvatar) {
      headerAvatar.innerHTML = `<img src="${customAvatar}" alt="Profile" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
    } else {
      const initials = savedName
        .split(" ")
        .filter((n) => n.length > 0)
        .slice(0, 2)
        .map((n) => n[0].toUpperCase())
        .join("");
      headerAvatar.textContent = initials || "JD";
    }

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

let lastStudentAppsHash = "";

async function loadStudentData() {
  const statMyApps = document.getElementById("stat-my-apps");
  const statApproved = document.getElementById("stat-approved");
  const statReview = document.getElementById("stat-review");
  const statRejected = document.getElementById("stat-rejected");
  const emptyAppsCard = document.getElementById("student-empty-apps");
  const appsFeed = document.getElementById("student-apps-feed");

  let applications = [];

  try {
    const response = await fetch(`${API_BASE}/api/data`);
    if (!response.ok) {
      throw new Error("HTTP error " + response.status);
    }
    const data = await response.json();
    applications = Array.isArray(data.applications) ? data.applications : [];

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

  // Calculate metrics
  let totalCount = applications.length;
  let approvedCount = 0;
  let reviewCount = 0;
  let rejectedCount = 0;

  applications.forEach((app) => {
    const status = (app.status || "").toLowerCase();
    if (status.includes("approved")) {
      approvedCount++;
    } else if (status.includes("rejected")) {
      rejectedCount++;
    } else {
      // Pending, Submitted, Under Review
      reviewCount++;
    }
  });

  // Update UI Metric Numbers
  if (statMyApps) statMyApps.textContent = totalCount;
  if (statApproved) statApproved.textContent = approvedCount;
  if (statReview) statReview.textContent = reviewCount;
  if (statRejected) statRejected.textContent = rejectedCount;

  // Prevent DOM wiping if data hasn't changed
  const currentHash = JSON.stringify(applications);
  if (currentHash === lastStudentAppsHash) {
    return;
  }
  lastStudentAppsHash = currentHash;

  // Render Applications or Empty State
  if (totalCount === 0) {
    if (emptyAppsCard) emptyAppsCard.style.display = "block";
    if (appsFeed) {
      appsFeed.style.display = "none";
      appsFeed.innerHTML = "";
    }
  } else {
    if (emptyAppsCard) emptyAppsCard.style.display = "none";
    if (appsFeed) {
      appsFeed.style.display = "flex";
      renderApplicationCards(applications, appsFeed);
    }
  }
}

// Render student application cards matching Canva reference design
function renderApplicationCards(applications, container) {
  container.innerHTML = "";

  applications.forEach((app) => {
    const card = document.createElement("div");
    card.className = "student-app-card";
    card.style.flexDirection = "column";
    card.style.alignItems = "stretch";

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

    const logoHtml = app.logo || app.providerLogo
      ? `<img src="${app.logo || app.providerLogo}" alt="${escapeHtml(orgName)}" class="student-app-logo" />`
      : `<div class="student-app-logo">${initials || "NX"}</div>`;

    const title = app.title || app.scholarshipTitle || "Scholarship Program";
    const date = app.formattedDate || app.appliedDate || app.date || "Recently Applied";
    const applicants = app.applicantCount || "1 / 10 Applicants";
    const docs = app.documents || app.uploadedDocuments || [];

    // Optional provider feedback note
    const feedbackText = app.feedback || app.notes;
    const feedbackHtml = feedbackText
      ? `<div class="student-app-feedback">
          <strong>Provider Note:</strong> ${escapeHtml(feedbackText)}
         </div>`
      : "";

    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 14px; width: 100%;">
        ${logoHtml}
        <div class="student-app-info">
          <h4 class="student-app-title" title="${escapeHtml(title)}">${escapeHtml(title)}</h4>
          <p class="student-app-org">${escapeHtml(orgName)} &bull; ${escapeHtml(date)}</p>
          <span style="font-size: 11px; color: var(--text-secondary);">📎 ${docs.length} Documents Attached</span>
        </div>
        <div class="student-app-status-col">
          <span class="student-app-status-badge ${badgeClass}">${escapeHtml(statusLabel)}</span>
          <span class="student-app-applicants">${escapeHtml(applicants)}</span>
        </div>
      </div>
      ${feedbackHtml}
    `;

    container.appendChild(card);
  });
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
    document.getElementById("nav-menu") ||
    document.querySelector(".nav-menu");
  if (menu) {
    menu.addEventListener("click", (e) => {
      const link = e.target.closest("a.nav-link, a.btn");
      if (!link) return;

      const href = link.getAttribute("href");
      if (href && (href.startsWith("#") || href.includes(window.location.pathname))) {
        closeSideMenu();
      }
    });
  }

  // 2. Initialize Interactive Notification Bell
  initNotificationBell();

  // 3. Initialize Student Greeting & Profile Details
  initStudentGreeting();

  // 4. Load Real-time Data / Empty State
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
      if (notifBtn && !notifBtn.contains(e.target) && !popover.contains(e.target)) {
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