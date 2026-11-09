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

const DEFAULT_STUDENT_NOTIFICATIONS = [
  {
    id: "notif_1001",
    recipient: "provider",
    title: "New Application Received",
    message:
      'Juan Dela Cruz submitted an application for "Final Test" with 3 documents.',
    timestamp: new Date().toISOString(),
    formattedTime: "10 mins ago",
    read: false,
    link: "provider-applications.html",
  },
  {
    id: "notif_1002",
    recipient: "provider",
    title: "Grant Capacity Active",
    message: "Applicant quota configured: 0 / 200 active slots remaining.",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    formattedTime: "1 hour ago",
    read: false,
    link: "provider-dashboard.html",
  },
  {
    id: "notif_1003",
    recipient: "student",
    title: "New Scholarship Posted",
    message: '"Final Test" is now open for applications. Check requirements.',
    timestamp: new Date(Date.now() - 1200000).toISOString(),
    formattedTime: "20 mins ago",
    read: false,
    link: "student-browse.html",
  },
  {
    id: "notif_1004",
    recipient: "student",
    title: "Document Verification",
    message:
      "Your .edu.ph student identity is verified for Academic Year 2026-2027.",
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    formattedTime: "2 hours ago",
    read: false,
    link: "student-dashboard.html",
  },
];

function getStudentNotificationsFromStorage() {
  let all = [];
  try {
    const raw = localStorage.getItem("nexo_notifications");
    if (raw) all = JSON.parse(raw);
  } catch (_) {}

  if (!Array.isArray(all)) all = [];

  // 1. Sync status updates from actual student applications
  try {
    const apps = JSON.parse(localStorage.getItem("nexo_applications") || "[]");
    if (Array.isArray(apps)) {
      apps.forEach((app) => {
        const notifId = "notif_student_app_" + (app.id || "temp");
        if (!all.some((n) => n.id === notifId || n.appId === app.id)) {
          const status = app.status || "Under Review";
          all.unshift({
            id: notifId,
            recipient: "student",
            title: `Application ${status}`,
            message: `Your application for "${app.scholarshipTitle || "Scholarship"}" is now ${status}.`,
            timestamp: app.submittedAt || new Date().toISOString(),
            formattedTime: app.formattedDate || "Recently",
            read: false,
            link: "student-submissions.html",
            appId: app.id,
          });
        }
      });
    }
  } catch (_) {}

  // 2. Sync announcement notifications from active scholarships
  try {
    const schols = JSON.parse(
      localStorage.getItem("nexo_scholarships") || "[]",
    );
    if (Array.isArray(schols)) {
      schols.forEach((s) => {
        const notifId = "notif_student_schol_" + s.id;
        if (!all.some((n) => n.id === notifId || n.scholId === s.id)) {
          all.push({
            id: notifId,
            recipient: "student",
            title: "New Scholarship Posted",
            message: `"${s.title}" is now open for applications. Check eligibility.`,
            timestamp: s.postedAt || new Date().toISOString(),
            formattedTime: "Open",
            read: false,
            link: "student-browse.html",
            scholId: s.id,
          });
        }
      });
    }
  } catch (_) {}

  // 3. Ensure baseline student notifications exist if none found
  const studentItems = all.filter(
    (n) => !n.recipient || n.recipient === "student" || n.recipient === "all",
  );

  if (studentItems.length === 0) {
    DEFAULT_STUDENT_NOTIFICATIONS.forEach((dn) => {
      if (
        !dn.recipient ||
        dn.recipient === "student" ||
        dn.recipient === "all"
      ) {
        if (!all.some((n) => n.id === dn.id)) {
          all.push(dn);
        }
      }
    });
  }

  try {
    localStorage.setItem("nexo_notifications", JSON.stringify(all));
  } catch (_) {}

  return all.filter(
    (n) => !n.recipient || n.recipient === "student" || n.recipient === "all",
  );
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
        <button type="button" class="notif-mark-read-btn" id="student-mark-read" style="background:none; border:none; color:var(--purple-600, #7c3aed); font-size:11px; font-weight:600; cursor:pointer; padding:2px 6px; border-radius:4px;">Mark all read</button>
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

  function markStudentNotificationRead(id) {
    try {
      const cached = JSON.parse(
        localStorage.getItem("nexo_notifications") || "[]",
      );
      const item = cached.find((n) => String(n.id) === String(id));
      if (item) {
        item.read = true;
        localStorage.setItem("nexo_notifications", JSON.stringify(cached));
      }
    } catch (_) {}

    // Send read request to server if online
    fetch(`${NOTIF_API}/api/notifications/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});

    loadStudentNotifications();
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
        return `
          <a href="${n.link || "student-submissions.html"}" class="notif-item ${isUnread ? "unread" : ""}" data-id="${n.id}">
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

    // Attach click listeners to individual items
    bodyEl.querySelectorAll(".notif-item").forEach((item) => {
      item.addEventListener("click", () => {
        const notifId = item.dataset.id;
        if (notifId) markStudentNotificationRead(notifId);
      });
    });
  }

  // Initial load and periodic polling
  loadStudentNotifications();
  setInterval(loadStudentNotifications, 3500);

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
      loadStudentNotifications();
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
        const cached = JSON.parse(
          localStorage.getItem("nexo_student_settings") || "{}",
        );
        if (cached && cached.profilePicture)
          customAvatar = cached.profilePicture;
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

let allStudentApplications = [];
let currentSubmissionsFilter = "all";
let currentSubmissionsSearch = "";
let lastStudentAppsHash = "";

async function loadStudentData() {
  const statMyApps = document.getElementById("stat-my-apps");
  const statApproved = document.getElementById("stat-approved");
  const statReview = document.getElementById("stat-review");
  const statRejected = document.getElementById("stat-rejected");

  let applications = [];

  try {
    const response = await fetch(`${API_BASE}/api/data`);
    if (!response.ok) {
      throw new Error("HTTP error " + response.status);
    }
    const data = await response.json();
    applications = Array.isArray(data.applications) ? data.applications : [];

    // Sync student settings and header avatar
    if (data.studentSettings) {
      try {
        localStorage.setItem(
          "nexo_student_settings",
          JSON.stringify(data.studentSettings),
        );
        if (data.studentSettings.profilePicture) {
          sessionStorage.setItem(
            "nexo-student-avatar",
            data.studentSettings.profilePicture,
          );
          const headerAvatar = document.querySelector(".header-avatar");
          if (headerAvatar && !headerAvatar.querySelector("img")) {
            headerAvatar.innerHTML = `<img src="${data.studentSettings.profilePicture}" alt="Profile" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
          }
        }
      } catch (_) {}
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

  allStudentApplications = applications;

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

  // Update UI Metric Numbers (for Student Dashboard)
  if (statMyApps) statMyApps.textContent = totalCount;
  if (statApproved) statApproved.textContent = approvedCount;
  if (statReview) statReview.textContent = reviewCount;
  if (statRejected) statRejected.textContent = rejectedCount;

  // Update Filter Pill Counters (for My Scholarship Submissions)
  const filterCountAll = document.getElementById("filter-count-all");
  const filterCountReview = document.getElementById("filter-count-review");
  const filterCountApproved = document.getElementById("filter-count-approved");
  const filterCountRejected = document.getElementById("filter-count-rejected");

  if (filterCountAll) filterCountAll.textContent = totalCount;
  if (filterCountReview) filterCountReview.textContent = reviewCount;
  if (filterCountApproved) filterCountApproved.textContent = approvedCount;
  if (filterCountRejected) filterCountRejected.textContent = rejectedCount;

  // Render application feed
  renderFilteredSubmissions();
}

function renderFilteredSubmissions() {
  const emptyAppsCard = document.getElementById("student-empty-apps");
  const filterEmptyCard = document.getElementById("student-filter-empty");
  const appsFeed = document.getElementById("student-apps-feed");
  const hasFilterTools = Boolean(
    document.getElementById("submissions-status-filters"),
  );

  if (!appsFeed) return;

  if (allStudentApplications.length === 0) {
    if (emptyAppsCard) emptyAppsCard.style.display = "block";
    if (filterEmptyCard) filterEmptyCard.style.display = "none";
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
      // 1. Status Filter
      const rawStatus = (app.status || "Submitted").toLowerCase();
      let matchesStatus = true;

      if (currentSubmissionsFilter === "review") {
        matchesStatus =
          rawStatus.includes("review") ||
          rawStatus.includes("submitted") ||
          rawStatus.includes("pending") ||
          (!rawStatus.includes("approved") && !rawStatus.includes("rejected"));
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
  }

  if (filterEmptyCard) filterEmptyCard.style.display = "none";
  appsFeed.style.display = "flex";
  renderApplicationCards(listToRender, appsFeed);
}

// Render student application cards
function renderApplicationCards(applications, container) {
  container.innerHTML = "";

  applications.forEach((app) => {
    const card = document.createElement("div");
    card.className = "student-app-card";
    card.style.flexDirection = "column";
    card.style.alignItems = "stretch";
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

    const logoHtml =
      app.logo || app.providerLogo
        ? `<img src="${app.logo || app.providerLogo}" alt="${escapeHtml(orgName)}" class="student-app-logo" />`
        : `<div class="student-app-logo">${initials || "NX"}</div>`;

    const title = app.title || app.scholarshipTitle || "Scholarship Program";
    const date =
      app.formattedDate || app.appliedDate || app.date || "Recently Applied";
    let applicants = app.applicantCount || "1 / 200 Applicants";
    if (applicants.includes("/ 10 Applicants")) {
      applicants = applicants.replace("/ 10 Applicants", "/ 200 Applicants");
    }
    const docs = app.documents || app.uploadedDocuments || [];
    const hasFeedback = Boolean(app.feedback || app.notes);

    // Follow-up message is hidden from card body per user requirement.
    // Instead, card has an intuitive prompt and a dedicated "View Full Details" button.
    card.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 14px; width: 100%;">
        ${logoHtml}
        <div class="student-app-info" style="flex: 1; min-width: 0;">
          <h4 class="student-app-title" title="${escapeHtml(title)}">${escapeHtml(title)}</h4>
          <p class="student-app-org">${escapeHtml(orgName)} &bull; ${escapeHtml(date)}</p>
          <div style="display: flex; align-items: center; gap: 10px; margin-top: 4px; flex-wrap: wrap;">
            <span style="font-size: 11.5px; color: var(--text-secondary); display: inline-flex; align-items: center; gap: 4px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
              ${docs.length} Document(s) Attached
            </span>
            ${
              hasFeedback
                ? `<span style="font-size: 11px; color: #8b5cf6; font-weight: 600; display: inline-flex; align-items: center; gap: 3px;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg> Remarks Available</span>`
                : ""
            }
          </div>
        </div>
        <div class="student-app-status-col">
          <span class="student-app-status-badge ${badgeClass}">${escapeHtml(statusLabel)}</span>
          <span class="student-app-applicants">${escapeHtml(applicants)}</span>
        </div>
      </div>

      <!-- Action Row: Prominent CTA & Visual Tap Affordance -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border-color); width: 100%; gap: 8px;">
        <span style="font-size: 11.5px; color: var(--text-secondary); display: inline-flex; align-items: center; gap: 4px;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          Tap card to view full details
        </span>
        <button type="button" class="btn btn-secondary view-sub-details-btn" data-app-id="${app.id}" style="padding: 6px 14px; font-size: 12px; font-weight: 600; border-radius: 8px; margin: 0; display: inline-flex; align-items: center; gap: 5px;">
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
  let modalOverlay = document.getElementById("student-sub-modal-overlay");

  // Dynamically create modal if not present on page (e.g. from Dashboard)
  if (!modalOverlay) {
    modalOverlay = document.createElement("div");
    modalOverlay.id = "student-sub-modal-overlay";
    modalOverlay.className = "schol-modal-overlay";
    modalOverlay.setAttribute("aria-hidden", "true");
    modalOverlay.innerHTML = `
      <div class="schol-modal-sheet" id="student-sub-modal-sheet" style="max-width: 560px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
            <h3 style="font-size: 18px; font-weight: 700; margin: 0; color: var(--text-primary);">Application Details</h3>
          </div>
          <button type="button" id="close-student-sub-modal" style="background: none; border: none; font-size: 26px; line-height: 1; color: var(--text-secondary); cursor: pointer; padding: 2px 6px;">&times;</button>
        </div>
        <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 18px;">
          <div id="modal-sub-logo" class="student-app-logo" style="width: 52px; height: 52px; font-size: 16px; border-radius: 50%;">NX</div>
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
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            Provider Remarks &amp; Follow-Up Message
          </h5>
          <div id="modal-sub-feedback-box" style="padding: 14px 16px; border-radius: 12px; background: var(--bg-canvas); border: 1px solid var(--border-color); font-size: 13.5px; line-height: 1.55; color: var(--text-primary);"></div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
          <div style="padding: 10px 12px; border-radius: 10px; background: var(--bg-canvas); border: 1px solid var(--border-color);">
            <span style="font-size: 11px; color: var(--text-secondary); display: block;">Date Submitted</span>
            <strong id="modal-sub-date" style="font-size: 13px; color: var(--text-primary); margin-top: 2px; display: block;">Nov 8, 2026</strong>
          </div>
          <div style="padding: 10px 12px; border-radius: 10px; background: var(--bg-canvas); border: 1px solid var(--border-color);">
            <span style="font-size: 11px; color: var(--text-secondary); display: block;">Grant Capacity</span>
            <strong id="modal-sub-capacity" style="font-size: 13px; color: var(--text-primary); margin-top: 2px; display: block;">1 / 200 Applicants</strong>
          </div>
        </div>
        <div style="margin-bottom: 24px;">
          <h5 style="font-size: 12.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); margin: 0 0 10px 0; display: flex; align-items: center; gap: 6px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
            Attached Verification Documents (<span id="modal-sub-doc-count">0</span>)
          </h5>
          <div id="modal-sub-doc-list" style="display: flex; flex-direction: column; gap: 8px;"></div>
        </div>
        <div style="padding: 12px 14px; border-radius: 10px; background: var(--bg-canvas); border: 1px dashed var(--border-color); margin-bottom: 24px;">
          <span style="font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; display: block; margin-bottom: 4px;">Verified Applicant Identity</span>
          <p style="margin: 0; font-size: 13px; color: var(--text-primary); font-weight: 600;" id="modal-sub-student-name">Juan Dela Cruz</p>
          <p style="margin: 2px 0 0 0; font-size: 12px; color: var(--text-secondary);" id="modal-sub-student-info">BS Information Technology &bull; Batangas State University &bull; admin@admin.edu.ph</p>
        </div>
        <button type="button" id="btn-close-sub-modal" class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 14px; font-weight: 600; border-radius: 10px;">
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
    if (app.logo || app.providerLogo) {
      logoEl.innerHTML = `<img src="${app.logo || app.providerLogo}" alt="${escapeHtml(org)}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
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
  } else {
    // Under Review / Submitted
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
  }

  // Populate Provider Feedback / Follow-Up Message
  const feedbackBox = document.getElementById("modal-sub-feedback-box");
  const feedbackMsg = app.feedback || app.notes;

  if (feedbackBox) {
    if (feedbackMsg && feedbackMsg.trim()) {
      feedbackBox.innerHTML = `
        <div style="background: rgba(139, 92, 246, 0.08); border-left: 4px solid #8b5cf6; border-radius: 8px; padding: 12px 14px;">
          <strong style="color: #8b5cf6; font-size: 12.5px; display: block; margin-bottom: 4px;">Official Provider Remarks:</strong>
          <span style="white-space: pre-wrap; font-size: 13.5px; line-height: 1.55; color: var(--text-primary);">${escapeHtml(feedbackMsg)}</span>
        </div>
      `;
    } else {
      let defaultMsg =
        "Your academic verification files are currently on record with the scholarship evaluation committee. Official follow-up notes from the provider will appear here once processed.";
      if (rawStatus.includes("approved")) {
        defaultMsg =
          "Congratulations! Your scholarship application has been officially approved. Please monitor your institutional university email for disbursement instructions.";
      } else if (rawStatus.includes("rejected")) {
        defaultMsg =
          "Thank you for applying. Your application was reviewed but could not be accepted for this cycle. You are encouraged to explore other grants.";
      }
      feedbackBox.innerHTML = `
        <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.5;">${escapeHtml(defaultMsg)}</p>
      `;
    }
  }

  // Populate Dates & Capacity
  const dateEl = document.getElementById("modal-sub-date");
  const capEl = document.getElementById("modal-sub-capacity");
  if (dateEl)
    dateEl.textContent =
      app.formattedDate || app.appliedDate || "Recently Applied";
  if (capEl) {
    let cap = app.applicantCount || "1 / 200 Applicants";
    if (cap.includes("/ 10 Applicants"))
      cap = cap.replace("/ 10 Applicants", "/ 200 Applicants");
    capEl.textContent = cap;
  }

  // Populate Documents List
  const docListEl = document.getElementById("modal-sub-doc-list");
  const docCountEl = document.getElementById("modal-sub-doc-count");
  const docs = app.documents || app.uploadedDocuments || [];

  if (docCountEl) docCountEl.textContent = docs.length;

  if (docListEl) {
    docListEl.innerHTML = "";
    if (docs.length === 0) {
      docListEl.innerHTML = `<p style="font-size: 13px; color: var(--text-secondary); margin: 0;">No documents were attached to this submission.</p>`;
    } else {
      docs.forEach((doc, idx) => {
        const docName =
          typeof doc === "string" ? doc : doc.name || `Document_${idx + 1}`;
        const docSize =
          typeof doc === "object" && doc.size ? doc.size : "Verified Upload";
        const isPdf = docName.toLowerCase().endsWith(".pdf");

        const docItem = document.createElement("div");
        docItem.style.cssText =
          "display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 8px; background: var(--bg-canvas); border: 1px solid var(--border-color); gap: 10px;";
        docItem.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
            <div style="width: 32px; height: 32px; border-radius: 6px; background: ${isPdf ? "rgba(239, 68, 68, 0.12)" : "rgba(139, 92, 246, 0.12)"}; color: ${isPdf ? "#ef4444" : "#8b5cf6"}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 11px; font-weight: 700;">
              ${isPdf ? "PDF" : "IMG"}
            </div>
            <div style="min-width: 0;">
              <p style="margin: 0; font-size: 13px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(docName)}</p>
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
    }
  }

  // Populate Student Identity
  const nameEl = document.getElementById("modal-sub-student-name");
  const infoEl = document.getElementById("modal-sub-student-info");
  if (nameEl) nameEl.textContent = app.studentName || "Juan Dela Cruz";
  if (infoEl) {
    const course = app.course || "BS Information Technology";
    const uni = app.university || "Batangas State University";
    const email = app.studentEmail || "admin@admin.edu.ph";
    infoEl.textContent = `${course} • ${uni} • ${email}`;
  }

  // Open Modal
  modalOverlay.classList.add("active");
  document.body.style.overflow = "hidden";

  // Modal Close Handlers
  function closeSubModal() {
    modalOverlay.classList.remove("active");
    document.body.style.overflow = "";
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
