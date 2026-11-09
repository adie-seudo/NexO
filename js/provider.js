// =========================================
// PROVIDER HAMBURGER SIDE MENU LOGIC
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
// CLOSE MENU ON NAV LINK CLICKS
// Handles both: internal (same-page) links
// and external page navigation links
// =========================================
document.addEventListener("DOMContentLoaded", function () {
  const menu =
    document.getElementById("nav-menu") || document.querySelector(".nav-menu");
  if (!menu) return;

  // Listen on all anchor/button links inside the nav menu
  menu.addEventListener("click", function (e) {
    const link = e.target.closest("a.nav-link, a.btn");
    if (!link) return;

    const href = link.getAttribute("href");

    // #! or empty = same-page action link (like Drafts on dashboard),
    // close the menu and let dashboard.js handle the view-switch normally.
    if (!href || href === "#!" || href === "#") {
      closeSideMenu();
      // Don't preventDefault — let the existing dashboard.js "click" listener run
      return;
    }

    // If clicking Home while already on provider-dashboard.html, switch view smoothly without reload
    const currentPage = window.location.pathname.split("/").pop();
    if (
      currentPage === "provider-dashboard.html" &&
      href === "provider-dashboard.html"
    ) {
      closeSideMenu();
      if (window.location.search) {
        window.history.replaceState({}, "", "provider-dashboard.html");
      }
      return;
    }

    // Real navigation link — close the menu first, then navigate after the
    // slide-out animation finishes (350ms matches the CSS transition duration)
    e.preventDefault();
    closeSideMenu();
    setTimeout(function () {
      window.location.href = href;
    }, 360);
  });
});

// Safe document listener to close it when clicking elsewhere
document.addEventListener("click", function (e) {
  const btn =
    document.getElementById("avatar-menu-btn") ||
    document.querySelector(".hamburger-btn");
  const menu =
    document.getElementById("nav-menu") || document.querySelector(".nav-menu");

  if (menu && menu.classList.contains("open")) {
    if (btn && !btn.contains(e.target) && !menu.contains(e.target)) {
      closeSideMenu();
    }
  }
});

// Close menu with ESC key
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    closeSideMenu();
  }
});

// ==========================================
// APPLICATIONS PAGE: FILTER TABS LOGIC
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const filterTabs = document.querySelectorAll(".filter-tab");

  if (filterTabs.length > 0) {
    filterTabs.forEach((tab) => {
      tab.addEventListener("click", function () {
        // 1. Remove the 'active' class from ALL tabs
        filterTabs.forEach((t) => t.classList.remove("active"));

        // 2. Add the 'active' class to the specific tab you just clicked
        this.classList.add("active");
      });
    });
  }

  // Synchronize header avatar with saved profile picture / initials
  syncGlobalHeaderAvatar();

  // Initialize interactive notification bell and empty state popover
  initNotificationBell();
});

// ==========================================
// NOTIFICATION BELL & LIVE POPOVER HANDLER
// ==========================================
window.API_BASE =
  window.API_BASE ||
  (window.location.origin.includes(":3000") ? "" : "http://localhost:3000");
var API_BASE = window.API_BASE;

function escapeNotifHtml(text) {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const DEFAULT_NEXO_NOTIFICATIONS = [
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
    read: true,
    link: "student-dashboard.html",
  },
];

function getProviderNotificationsFromStorage() {
  let all = [];
  try {
    const raw = localStorage.getItem("nexo_notifications");
    if (raw) all = JSON.parse(raw);
  } catch (_) {}

  if (!Array.isArray(all)) all = [];

  // 1. Sync live from local applications so any applied student generates a provider notification
  try {
    const apps = JSON.parse(localStorage.getItem("nexo_applications") || "[]");
    if (Array.isArray(apps)) {
      apps.forEach((app) => {
        const notifId = "notif_app_" + (app.id || "temp");
        if (!all.some((n) => n.id === notifId || n.appId === app.id)) {
          const rawDocs = Array.isArray(app.documents)
            ? app.documents
            : Array.isArray(app.uploadedDocuments)
              ? app.uploadedDocuments
              : [];
          const attachedDocs = rawDocs.filter((d) => {
            if (typeof d === "string") return !d.includes("(To Follow Up)");
            return !d.isFollowUp && d.status !== "to_follow_up" && d.type !== "to_follow_up";
          });
          const followUpDocs = rawDocs.filter((d) => {
            if (typeof d === "string") return d.includes("(To Follow Up)");
            return d.isFollowUp || d.status === "to_follow_up" || d.type === "to_follow_up";
          });
          const docNotice =
            followUpDocs.length > 0
              ? `${attachedDocs.length} document(s) (${followUpDocs.length} to follow up)`
              : `${attachedDocs.length} document(s)`;
          all.unshift({
            id: notifId,
            recipient: "provider",
            title: "New Application Received",
            message: `${app.studentName || "Juan Dela Cruz"} applied for "${app.scholarshipTitle || "Scholarship"}" with ${docNotice}.`,
            timestamp: app.submittedAt || new Date().toISOString(),
            formattedTime: app.formattedDate || "Just now",
            read: false,
            link: "provider-applications.html",
            appId: app.id,
          });
        }
      });
    }
  } catch (_) {}

  // 2. Sync capacity notifications from live scholarships
  try {
    const schols = JSON.parse(
      localStorage.getItem("nexo_scholarships") || "[]",
    );
    if (Array.isArray(schols)) {
      schols.forEach((s) => {
        const notifId = "notif_schol_cap_" + s.id;
        if (!all.some((n) => n.id === notifId || n.scholId === s.id)) {
          const limit =
            parseInt(s.applicantLimit || s.maxApplicants || 200, 10) || 200;
          all.push({
            id: notifId,
            recipient: "provider",
            title: "Grant Capacity Active",
            message: `"${s.title}": Capacity configured for ${limit} applicants.`,
            timestamp: s.postedAt || new Date().toISOString(),
            formattedTime: "Active",
            read: true,
            link: "provider-dashboard.html",
            scholId: s.id,
          });
        }
      });
    }
  } catch (_) {}

  // 3. If there are still no provider notifications, seed with default provider items
  const providerItems = all.filter(
    (n) => !n.recipient || n.recipient === "provider" || n.recipient === "all",
  );

  if (providerItems.length === 0) {
    DEFAULT_NEXO_NOTIFICATIONS.forEach((dn) => {
      if (
        !dn.recipient ||
        dn.recipient === "provider" ||
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
    (n) => !n.recipient || n.recipient === "provider" || n.recipient === "all",
  );
}

function initNotificationBell() {
  const notifBtn = document.querySelector(".notification-btn");
  if (!notifBtn) return;

  // Ensure unread indicator dot element exists inside the button
  let dot =
    notifBtn.querySelector(".notification-dot") ||
    document.getElementById("notif-dot");
  if (!dot) {
    dot = document.createElement("span");
    dot.className = "notification-dot";
    dot.id = "notif-dot";
    notifBtn.appendChild(dot);
  }

  // Find or create the popover
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
          <span class="notif-badge-count" id="provider-notif-badge">0 New</span>
        </div>
        <button type="button" class="notif-mark-read-btn" id="provider-mark-read" style="background:none; border:none; color:var(--purple-600, #7c3aed); font-size:11px; font-weight:600; cursor:pointer; padding:2px 6px; border-radius:4px;">Mark all read</button>
      </div>
      <div class="notif-popover-body" id="provider-notif-body">
        <div class="notif-empty-box">
          <div class="notif-empty-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          </div>
          <p class="notif-empty-heading">No notifications yet</p>
          <p class="notif-empty-text">You're all caught up! New applicant submissions and scholarship updates will appear here.</p>
        </div>
      </div>
    `;

    // Wrap the button if not already inside .notification-container
    let container = notifBtn.closest(".notification-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "notification-container";
      notifBtn.parentNode.insertBefore(container, notifBtn);
      container.appendChild(notifBtn);
    }
    container.appendChild(popover);
  }

  // Fetch & render live notifications
  let lastProviderNotifsHash = "";

  async function loadNotifications() {
    // 1. Immediately render local state so user gets instant response
    const localNotifs = getProviderNotificationsFromStorage();
    const newHash = JSON.stringify(localNotifs);
    if (newHash !== lastProviderNotifsHash) {
      lastProviderNotifsHash = newHash;
      renderNotifications(localNotifs);
    }

    // 2. Sync with backend API if server is alive
    try {
      const res = await fetch(
        `${API_BASE}/api/notifications?recipient=provider`,
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
          const mergedNotifs = getProviderNotificationsFromStorage();
          renderNotifications(mergedNotifs);
        }
      }
    } catch (_) {}
  }

  function markNotificationRead(id) {
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
    fetch(`${API_BASE}/api/notifications/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});

    loadNotifications();
  }

  function markAllNotificationsRead() {
    try {
      const cached = JSON.parse(
        localStorage.getItem("nexo_notifications") || "[]",
      );
      cached.forEach((n) => {
        if (
          !n.recipient ||
          n.recipient === "provider" ||
          n.recipient === "all"
        ) {
          n.read = true;
        }
      });
      localStorage.setItem("nexo_notifications", JSON.stringify(cached));
    } catch (_) {}

    // Send read request to server if online
    fetch(`${API_BASE}/api/notifications/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: "provider" }),
    }).catch(() => {});

    loadNotifications();
  }

  function renderNotifications(notifs) {
    const bodyEl = document.getElementById("provider-notif-body");
    const badgeEl = document.getElementById("provider-notif-badge");
    const currentDot =
      notifBtn.querySelector(".notification-dot") ||
      document.getElementById("notif-dot");
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
          <p class="notif-empty-text">You're all caught up! New applicant submissions and scholarship updates will appear here.</p>
        </div>
      `;
      return;
    }

    bodyEl.innerHTML = list
      .map((n) => {
        const isUnread = !n.read;
        const timeStr = n.formattedTime || "Recently";
        return `
          <a href="${n.link || "provider-applications.html"}" class="notif-item ${isUnread ? "unread" : ""}" data-id="${n.id}">
            <div class="notif-item-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="8.5" cy="7" r="4"></circle>
                <polyline points="17 11 19 13 23 9"></polyline>
              </svg>
            </div>
            <div class="notif-item-content">
              <h5 class="notif-item-title">${escapeNotifHtml(n.title)}</h5>
              <p class="notif-item-msg">${escapeNotifHtml(n.message)}</p>
              <span class="notif-item-time">${escapeNotifHtml(timeStr)}</span>
            </div>
          </a>
        `;
      })
      .join("");

    // Attach click listeners to individual items
    bodyEl.querySelectorAll(".notif-item").forEach((item) => {
      item.addEventListener("click", () => {
        const notifId = item.dataset.id;
        if (notifId) markNotificationRead(notifId);
      });
    });
  }

  // Initial load & periodic polling
  loadNotifications();
  setInterval(loadNotifications, 3500);

  // Wire "Mark all read" button
  const markReadBtn = document.getElementById("provider-mark-read");
  if (markReadBtn) {
    markReadBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      markAllNotificationsRead();
    });
  }

  // Listen for storage events (other tabs/windows) and custom events
  window.addEventListener("storage", (e) => {
    if (e.key === "nexo_notifications") {
      loadNotifications();
    }
  });
  window.addEventListener("nexo:notification", () => {
    loadNotifications();
  });

  // Toggle dropdown on bell click
  notifBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    // Close the side menu if open
    closeSideMenu();
    const willOpen = !popover.classList.contains("open");
    popover.classList.toggle("open", willOpen);
    notifBtn.setAttribute("aria-expanded", willOpen ? "true" : "false");
    if (willOpen) {
      loadNotifications();
    }
  });

  // When theme toggle is clicked or changed, close notifications and close side menu
  const themeToggle = document.querySelector(".theme-toggle");
  const themeContainer = document.querySelector(".theme-toggle-container");
  if (themeToggle) {
    themeToggle.addEventListener("change", () => {
      closeNotifications();
      closeSideMenu();
    });
  }
  if (themeContainer) {
    themeContainer.addEventListener("click", () => {
      closeNotifications();
      closeSideMenu();
    });
  }

  // Close when clicking outside
  document.addEventListener("click", (e) => {
    if (
      popover.classList.contains("open") &&
      !popover.contains(e.target) &&
      !notifBtn.contains(e.target)
    ) {
      closeNotifications();
    }
  });

  // Close with Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && popover.classList.contains("open")) {
      closeNotifications();
    }
  });

  // Close when scrolling page
  window.addEventListener(
    "scroll",
    () => {
      if (popover.classList.contains("open")) {
        closeNotifications();
      }
    },
    { passive: true },
  );
}

function syncGlobalHeaderAvatar() {
  const avatarBtn = document.querySelector(".logo-container .avatar-btn");
  if (!avatarBtn) return;

  const logo = localStorage.getItem("nexo-provider-logo");
  const name = localStorage.getItem("nexo-provider-name") || "NEXO";

  if (logo) {
    avatarBtn.innerHTML = `<img src="${logo}" alt="Logo">`;
  } else {
    let inits = "NX";
    if (name && !name.toUpperCase().startsWith("NEXO")) {
      const parts = name.trim().split(/\s+/);
      inits =
        parts.length === 1
          ? parts[0].length > 1
            ? parts[0].substring(0, 2).toUpperCase()
            : parts[0].toUpperCase()
          : (parts[0][0] + parts[1][0]).toUpperCase();
    }
    avatarBtn.textContent = inits;
  }
}
