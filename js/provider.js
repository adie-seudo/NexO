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
    const currentPage = (window.location.pathname.split("/").pop() || "provider-dashboard.html").toLowerCase();

    // Same-page action links
    if (!href || href === "#!" || href === "#") {
      closeSideMenu();
      return;
    }

    // If clicking Home while already on provider-dashboard.html, switch view smoothly without reload
    if (
      currentPage === "provider-dashboard.html" &&
      (href === "provider-dashboard.html" || href.endsWith("/provider-dashboard.html"))
    ) {
      e.preventDefault();
      closeSideMenu();
      if (window.location.search) {
        window.history.replaceState({}, "", "provider-dashboard.html");
      }
      if (typeof window.showHomeView === "function") {
        window.showHomeView();
      }
      return;
    }

    // If clicking Drafts while already on provider-dashboard.html, switch view smoothly without reload
    if (
      currentPage === "provider-dashboard.html" &&
      (link.id === "nav-drafts" || href.includes("view=drafts"))
    ) {
      e.preventDefault();
      closeSideMenu();
      if (typeof window.showDraftsView === "function") {
        window.showDraftsView();
      }
      window.history.replaceState({}, "", "provider-dashboard.html?view=drafts");
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

const DEFAULT_NEXO_NOTIFICATIONS = [];

function getProviderNotificationsFromStorage() {
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

  return all.filter(
    (n) => (!n.recipient || n.recipient === "provider" || n.recipient === "all") && !dismissed.includes(String(n.id)),
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
        <div style="display:flex; align-items:center; gap:6px;">
          <button type="button" class="notif-mark-read-btn" id="provider-mark-read" style="background:none; border:none; color:var(--purple-600, #7c3aed); font-size:11px; font-weight:600; cursor:pointer; padding:2px 6px; border-radius:4px;">Mark all read</button>
          <button type="button" class="notif-trash-btn" id="provider-clear-all-btn" title="Delete All Notifications" aria-label="Delete all notifications">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </div>
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

  function deleteProviderNotification(id) {
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
    fetch(`${API_BASE}/api/notifications/${id}`, {
      method: "DELETE",
      keepalive: true,
    }).catch(() => {});

    loadNotifications();
  }

  function markNotificationRead(id) {
    deleteProviderNotification(id);
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

  function confirmClearAllProviderNotifications() {
    let modal = document.getElementById("clear-provider-notifs-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "clear-provider-notifs-modal";
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
            <button type="button" class="btn btn-secondary" id="btn-cancel-clear-provider-notifs" style="padding: 8px 18px; font-size: 13px; border-radius: 8px;">Cancel</button>
            <button type="button" class="btn btn-danger" id="btn-confirm-clear-provider-notifs" style="padding: 8px 18px; font-size: 13px; border-radius: 8px; background: #ef4444; border-color: #ef4444; color: #fff; font-weight: 700;">Delete All</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      modal.querySelector("#btn-cancel-clear-provider-notifs").addEventListener("click", () => {
        modal.classList.remove("open");
      });
      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.classList.remove("open");
      });
      modal.querySelector("#btn-confirm-clear-provider-notifs").addEventListener("click", async () => {
        modal.classList.remove("open");
        await clearAllProviderNotifications();
      });
    }
    modal.classList.add("open");
  }

  async function clearAllProviderNotifications() {
    try {
      let cached = JSON.parse(localStorage.getItem("nexo_notifications") || "[]");
      cached = cached.filter((n) => n.recipient && n.recipient !== "provider" && n.recipient !== "all");
      localStorage.setItem("nexo_notifications", JSON.stringify(cached));
    } catch (_) {}

    try {
      await fetch(`${API_BASE}/api/notifications?recipient=provider`, {
        method: "DELETE",
      });
    } catch (_) {}

    loadNotifications();
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
        const linkUrl = n.appId
          ? `provider-applications.html?appId=${encodeURIComponent(n.appId)}`
          : (n.link || "provider-applications.html");
        return `
          <a href="${linkUrl}" class="notif-item ${isUnread ? "unread" : ""}" data-id="${n.id}" data-app-id="${n.appId || ""}">
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

    bodyEl.querySelectorAll(".notif-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        const notifId = item.dataset.id;
        const appId = item.dataset.appId;
        if (notifId) deleteProviderNotification(notifId);

        // If already on provider-applications.html, open review modal directly
        if (window.location.pathname.includes("provider-applications.html") && appId) {
          e.preventDefault();
          closeNotifications();
          if (typeof window.openReviewModalByAppId === "function") {
            window.openReviewModalByAppId(appId);
          }
        }
      });
    });
  }

  // Initial load & periodic polling
  loadNotifications();
  setInterval(loadNotifications, 3500);

  // Wire "Delete all notifications" button
  const clearAllBtn = document.getElementById("provider-clear-all-btn");
  if (clearAllBtn) {
    clearAllBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      confirmClearAllProviderNotifications();
    });
  }

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
    closeSideMenu();
    const willOpen = !popover.classList.contains("open");
    popover.classList.toggle("open", willOpen);
    notifBtn.setAttribute("aria-expanded", willOpen ? "true" : "false");
    if (willOpen) {
      clampPopoverPosition();
      loadNotifications();
      // Instantly mark notifications as read and remove red dot
      markAllNotificationsRead();
      const currentDot = notifBtn.querySelector(".notification-dot") || document.getElementById("notif-dot");
      if (currentDot) currentDot.classList.remove("active");
      notifBtn.classList.remove("has-unread");
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
