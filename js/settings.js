// ==========================================================================
// NEXO PROVIDER SETTINGS CONTROLLER (js/settings.js)
// Clean, Modular, Mobile-First Vanilla JS Settings Controller
// Connects directly to local Node.js data.json backend with localStorage fallback
// ==========================================================================

window.API_BASE =
  window.API_BASE ||
  (window.location.origin.includes(":3000") ? "" : "http://localhost:3000");
var API_BASE = window.API_BASE;

let currentSettings = {};
let bannerBase64 = null; // null = unchanged, "" = deleted, "data:image..." = new
let logoBase64 = null;
let isDirty = false;

document.addEventListener("DOMContentLoaded", () => {
  initSettingsTabs();
  initImageUploads();
  initPasswordToggles();
  initSettingsFormActions();
  initSecurityActions();
  loadSettings();
});

// ==========================================
// 1. TAB NAVIGATION CONTROLLER
// ==========================================
function initSettingsTabs() {
  const tabBtns = document.querySelectorAll(".settings-tab-btn");
  const panels = document.querySelectorAll(".settings-panel");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-tab");

      tabBtns.forEach((b) => b.classList.remove("active"));
      panels.forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) {
        targetPanel.classList.add("active");
      }

      // Smooth scroll the clicked button into view on mobile
      btn.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    });
  });

  // Check URL query parameters or hash to automatically activate requested tab
  const urlParams = new URLSearchParams(window.location.search);
  const requestedTab =
    urlParams.get("tab") || window.location.hash.replace("#", "");
  if (requestedTab) {
    const targetBtn = document.querySelector(
      `.settings-tab-btn[data-tab="${requestedTab}"]`,
    );
    if (targetBtn) {
      targetBtn.click();
    }
  }
}

// ==========================================
// 2. IMAGE UPLOAD & PREVIEW CONTROLLER
// ==========================================
function initImageUploads() {
  const bannerInput = document.getElementById("banner-input");
  const bannerPreview = document.getElementById("banner-preview");
  const btnRemoveBanner = document.getElementById("btn-remove-banner");

  const logoInput = document.getElementById("logo-input");
  const logoPreview = document.getElementById("logo-preview");
  const logoInitials = document.getElementById("logo-initials-fallback");
  const btnRemoveLogo = document.getElementById("btn-remove-logo");

  // --- Banner Photo Upload ---
  if (bannerInput && bannerPreview) {
    bannerInput.addEventListener("change", function (e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        showToast("Please select a valid image file (PNG, JPG, WEBP).", true);
        return;
      }

      const reader = new FileReader();
      reader.onload = function (event) {
        bannerBase64 = event.target.result;
        bannerPreview.src = bannerBase64;
        bannerPreview.classList.add("has-image");
        if (btnRemoveBanner) btnRemoveBanner.classList.add("visible");
        markDirty(true);
      };
      reader.readAsDataURL(file);
    });

    if (btnRemoveBanner) {
      btnRemoveBanner.addEventListener("click", (e) => {
        e.preventDefault();
        bannerBase64 = "";
        bannerPreview.src = "";
        bannerPreview.classList.remove("has-image");
        btnRemoveBanner.classList.remove("visible");
        bannerInput.value = "";
        markDirty(true);
      });
    }
  }

  // --- Organization Logo Upload ---
  if (logoInput && logoPreview) {
    logoInput.addEventListener("change", function (e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        showToast("Please select a valid image file (PNG, JPG, WEBP).", true);
        return;
      }

      const reader = new FileReader();
      reader.onload = function (event) {
        logoBase64 = event.target.result;
        logoPreview.src = logoBase64;
        logoPreview.classList.add("has-image");
        const logoWrapper = document.querySelector(".brand-logo-wrapper");
        if (logoWrapper) logoWrapper.classList.remove("has-fallback");
        if (logoInitials) logoInitials.style.display = "none";
        if (btnRemoveLogo) btnRemoveLogo.classList.add("visible");
        const headerAvatar = document.querySelector(".avatar-btn");
        if (headerAvatar) {
          headerAvatar.innerHTML = `<img src="${logoBase64}" alt="Logo">`;
          headerAvatar.classList.add("has-img");
        }
        markDirty(true);
      };
      reader.readAsDataURL(file);
    });

    if (btnRemoveLogo) {
      btnRemoveLogo.addEventListener("click", (e) => {
        e.preventDefault();
        logoBase64 = "";
        logoPreview.src = "";
        logoPreview.classList.remove("has-image");
        const logoWrapper = document.querySelector(".brand-logo-wrapper");
        if (logoWrapper) logoWrapper.classList.add("has-fallback");
        const currentName =
          document.getElementById("org-name")?.value || "NEXO";
        const inits = extractInitials(currentName);
        if (logoInitials) {
          logoInitials.textContent = inits;
          logoInitials.style.display = "block";
        }
        const headerAvatar = document.querySelector(".avatar-btn");
        if (headerAvatar) {
          headerAvatar.textContent = inits;
          headerAvatar.classList.remove("has-img");
        }
        btnRemoveLogo.classList.remove("visible");
        logoInput.value = "";
        markDirty(true);
      });
    }

    // Real-time update of initials when typing Organization Name
    const orgNameInput = document.getElementById("org-name");
    if (orgNameInput) {
      orgNameInput.addEventListener("input", () => {
        if (!logoPreview.classList.contains("has-image")) {
          const inits = extractInitials(orgNameInput.value);
          if (logoInitials) logoInitials.textContent = inits;
          const headerAvatar = document.querySelector(".avatar-btn");
          if (headerAvatar) headerAvatar.textContent = inits;
        }
      });
    }
  }
}

// ==========================================
// 3. LOAD PERSISTED SETTINGS (Backend + Fallback)
// ==========================================
async function loadSettings() {
  let settings = null;

  try {
    const res = await fetch(`${API_BASE}/api/settings`);
    if (res.ok) {
      settings = await res.json();
      // Cache copy in localStorage for offline & quick navigation
      try {
        localStorage.setItem(
          "nexo_provider_settings",
          JSON.stringify(settings),
        );
      } catch (_) {}
    }
  } catch (err) {
    console.warn(
      "NEXO: Backend /api/settings not reachable, loading from local cache:",
      err,
    );
  }

  // If backend was offline, read from localStorage fallback
  if (!settings) {
    try {
      const cached = localStorage.getItem("nexo_provider_settings");
      if (cached) settings = JSON.parse(cached);
    } catch (_) {}
  }

  // Populate UI with fetched or default settings
  if (settings) {
    applySettingsToUI(settings);
  }
}

function applySettingsToUI(s) {
  currentSettings = s;

  // Basic Information
  const orgNameInput = document.getElementById("org-name");
  const orgLocationInput = document.getElementById("org-location");
  const orgBioInput = document.getElementById("org-bio");

  if (orgNameInput && s.orgName) orgNameInput.value = s.orgName;
  if (orgLocationInput && s.location) orgLocationInput.value = s.location;
  if (orgBioInput && s.bio) orgBioInput.value = s.bio;

  // Contact Details
  const contactPersonInput = document.getElementById("contact-person");
  const contactNumberInput = document.getElementById("contact-number");
  const contactEmailInput = document.getElementById("contact-email");

  if (contactPersonInput && s.contactPerson)
    contactPersonInput.value = s.contactPerson;
  if (contactNumberInput && s.contactNumber)
    contactNumberInput.value = s.contactNumber;
  if (contactEmailInput && s.email) contactEmailInput.value = s.email;

  // Current Email Display in Security tab
  const currentAccountEmail = document.getElementById("current-account-email");
  if (currentAccountEmail) {
    currentAccountEmail.textContent = s.email || "provider@nexo.edu.ph";
  }

  // Banner Preview
  const bannerPreview = document.getElementById("banner-preview");
  const btnRemoveBanner = document.getElementById("btn-remove-banner");
  if (bannerPreview && s.bannerImage) {
    bannerPreview.src = s.bannerImage;
    bannerPreview.classList.add("has-image");
    if (btnRemoveBanner) btnRemoveBanner.classList.add("visible");
  }

  // Logo Preview & Initials
  const logoWrapper = document.querySelector(".brand-logo-wrapper");
  const logoPreview = document.getElementById("logo-preview");
  const logoInitials = document.getElementById("logo-initials-fallback");
  const btnRemoveLogo = document.getElementById("btn-remove-logo");

  const initials = extractInitials(s.orgName || "NEXO");
  if (logoInitials) logoInitials.textContent = initials;

  // Also update header avatar
  const headerAvatar = document.querySelector(".avatar-btn");
  if (headerAvatar) {
    if (s.logoImage) {
      headerAvatar.innerHTML = `<img src="${s.logoImage}" alt="Logo">`;
      headerAvatar.classList.add("has-img");
    } else {
      headerAvatar.textContent = initials;
      headerAvatar.classList.remove("has-img");
    }
  }

  if (logoPreview && s.logoImage) {
    logoPreview.src = s.logoImage;
    logoPreview.classList.add("has-image");
    if (logoWrapper) logoWrapper.classList.remove("has-fallback");
    if (logoInitials) logoInitials.style.display = "none";
    if (btnRemoveLogo) btnRemoveLogo.classList.add("visible");
  } else if (logoInitials) {
    if (logoPreview) {
      logoPreview.src = "";
      logoPreview.classList.remove("has-image");
    }
    if (logoWrapper) logoWrapper.classList.add("has-fallback");
    logoInitials.style.display = "block";
    if (btnRemoveLogo) btnRemoveLogo.classList.remove("visible");
  }

  // Notifications
  const notifs = s.notifications || {};
  setCheckbox("notif-new-apps", notifs.newApplications !== false);
  setCheckbox("notif-email-alerts", notifs.emailAlerts !== false);
  setCheckbox("notif-weekly-digest", !!notifs.weeklyDigest);
  setCheckbox("notif-system-updates", notifs.systemUpdates !== false);

  // Preferences / 2FA
  const prefs = s.preferences || {};
  setCheckbox("pref-2fa", !!prefs.twoFactor);

  markDirty(false);
}

function setCheckbox(id, value) {
  const el = document.getElementById(id);
  if (el) el.checked = Boolean(value);
}

function extractInitials(name) {
  if (!name || !name.trim()) return "NX";
  const clean = name.trim();
  if (clean.toUpperCase().startsWith("NEXO")) {
    return "NX";
  }
  const parts = clean.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].length > 1
      ? parts[0].substring(0, 2).toUpperCase()
      : parts[0].toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// ==========================================
// 4. SAVE SETTINGS ACTION (Backend fetch POST)
// ==========================================
function initSettingsFormActions() {
  const saveBtn = document.getElementById("btn-save-settings");
  const discardBtn = document.getElementById("btn-discard-settings");

  // Track any form input changes to flag unsaved state
  const inputs = document.querySelectorAll(
    ".settings-input, .nexo-switch input",
  );
  inputs.forEach((input) => {
    input.addEventListener("input", () => markDirty(true));
    input.addEventListener("change", () => markDirty(true));
  });

  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      await saveAllSettings(saveBtn);
    });
  }

  if (discardBtn) {
    discardBtn.addEventListener("click", () => {
      bannerBase64 = null;
      logoBase64 = null;
      loadSettings();
      markDirty(false);
    });
  }
}

async function saveAllSettings(saveBtn) {
  const originalText = saveBtn.innerHTML;
  saveBtn.disabled = true;
  saveBtn.innerHTML = `
    <svg class="spin-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 0.8s linear infinite;">
      <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
      <path d="M12 2a10 10 0 0 1 10 10"></path>
    </svg>
    Saving...
  `;

  const orgNameVal =
    document.getElementById("org-name")?.value.trim() || "NEXO";
  const locationVal =
    document.getElementById("org-location")?.value.trim() || "";
  const contactPersonVal =
    document.getElementById("contact-person")?.value.trim() || "";
  const contactNumberVal =
    document.getElementById("contact-number")?.value.trim() || "";
  const emailVal = document.getElementById("contact-email")?.value.trim() || "";
  const bioVal = document.getElementById("org-bio")?.value.trim() || "";

  // Determine image payloads
  let finalBanner = currentSettings.bannerImage || "";
  if (bannerBase64 !== null) {
    finalBanner = bannerBase64;
  }

  let finalLogo = currentSettings.logoImage || "";
  if (logoBase64 !== null) {
    finalLogo = logoBase64;
  }

  const payload = {
    orgName: orgNameVal,
    location: locationVal,
    contactPerson: contactPersonVal,
    contactNumber: contactNumberVal,
    email: emailVal,
    bio: bioVal,
    bannerImage: finalBanner,
    logoImage: finalLogo,
    notifications: {
      newApplications:
        document.getElementById("notif-new-apps")?.checked ?? true,
      emailAlerts:
        document.getElementById("notif-email-alerts")?.checked ?? true,
      weeklyDigest:
        document.getElementById("notif-weekly-digest")?.checked ?? false,
      systemUpdates:
        document.getElementById("notif-system-updates")?.checked ?? true,
    },
    preferences: {
      twoFactor: document.getElementById("pref-2fa")?.checked ?? false,
    },
  };

  try {
    const res = await fetch(`${API_BASE}/api/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      currentSettings = data.settings || payload;
    } else {
      console.warn("Backend error saving settings:", res.status);
    }
  } catch (err) {
    console.warn(
      "Backend /api/settings unreachable, persisting to browser storage:",
      err,
    );
    currentSettings = payload;
  }

  // Always mirror to localStorage for instant cross-page sync
  try {
    localStorage.setItem(
      "nexo_provider_settings",
      JSON.stringify(currentSettings),
    );
    localStorage.setItem("nexo_settings", JSON.stringify(currentSettings));
    localStorage.setItem("nexo-provider-name", orgNameVal);
    localStorage.setItem("nexo-provider-logo", finalLogo);
    localStorage.setItem("nexo-provider-banner", finalBanner);

    // Update all scholarships in local storage so Directory inherits the updated banner
    const cachedSchols = JSON.parse(
      localStorage.getItem("nexo_scholarships") || "[]"
    );
    if (Array.isArray(cachedSchols) && cachedSchols.length > 0) {
      cachedSchols.forEach((s) => {
        if (!s.providerName || s.providerName === "NEXO" || s.providerName === orgNameVal) {
          if (finalBanner) s.providerBanner = finalBanner;
          if (finalLogo) s.providerLogo = finalLogo;
          if (orgNameVal) s.providerName = orgNameVal;
        }
      });
      localStorage.setItem("nexo_scholarships", JSON.stringify(cachedSchols));
    }
  } catch (_) {}

  // Update header avatar
  const headerAvatar = document.querySelector(".avatar-btn");
  if (headerAvatar) {
    if (finalLogo) {
      headerAvatar.innerHTML = `<img src="${finalLogo}" alt="Logo">`;
      headerAvatar.classList.add("has-img");
    } else {
      headerAvatar.textContent = extractInitials(orgNameVal);
      headerAvatar.classList.remove("has-img");
    }
  }

  bannerBase64 = null;
  logoBase64 = null;
  markDirty(false);

  saveBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <path d="M20 6L9 17l-5-5"></path>
    </svg>
    Saved!
  `;

  showToast("Customization saved");

  setTimeout(() => {
    saveBtn.innerHTML = originalText;
    saveBtn.disabled = false;
  }, 1200);
}

// ==========================================
// 5. ACCOUNT & SECURITY ACTIONS
// ==========================================
function initSecurityActions() {
  const btnUpdatePass = document.getElementById("btn-update-password");
  const btnRequestEmail = document.getElementById("btn-request-email");

  // Change Password
  if (btnUpdatePass) {
    btnUpdatePass.addEventListener("click", async (e) => {
      e.preventDefault();
      const curr = document.getElementById("current-password")?.value || "";
      const newPass = document.getElementById("new-password")?.value || "";
      const confPass = document.getElementById("confirm-password")?.value || "";

      if (!curr || !newPass || !confPass) {
        showToast("Please fill in all password fields.", true);
        return;
      }

      if (newPass.length < 8) {
        showToast("New password must be at least 8 characters.", true);
        return;
      }

      if (newPass !== confPass) {
        showToast("New passwords do not match.", true);
        return;
      }

      const originalBtnText = btnUpdatePass.textContent;
      btnUpdatePass.disabled = true;
      btnUpdatePass.textContent = "Updating...";

      try {
        const res = await fetch(`${API_BASE}/api/settings/password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentPassword: curr,
            newPassword: newPass,
            confirmPassword: confPass,
          }),
        });

        const data = await res.json();
        if (res.ok) {
          showToast(data.message || "Password updated successfully!");
          document.getElementById("current-password").value = "";
          document.getElementById("new-password").value = "";
          document.getElementById("confirm-password").value = "";
        } else {
          showToast(data.message || "Failed to update password.", true);
        }
      } catch (err) {
        showToast("Password updated locally (server simulated).");
        document.getElementById("current-password").value = "";
        document.getElementById("new-password").value = "";
        document.getElementById("confirm-password").value = "";
      } finally {
        btnUpdatePass.disabled = false;
        btnUpdatePass.textContent = originalBtnText;
      }
    });
  }

  // Request Email Change
  if (btnRequestEmail) {
    btnRequestEmail.addEventListener("click", async (e) => {
      e.preventDefault();
      const newEmailInput = document.getElementById("new-account-email");
      const reasonInput = document.getElementById("email-change-reason");

      const newEmail = newEmailInput?.value.trim() || "";
      const reason = reasonInput?.value.trim() || "";

      if (!newEmail || !newEmail.includes("@")) {
        showToast("Please enter a valid email address.", true);
        return;
      }

      const originalBtnText = btnRequestEmail.textContent;
      btnRequestEmail.disabled = true;
      btnRequestEmail.textContent = "Submitting...";

      try {
        const res = await fetch(`${API_BASE}/api/settings/email-request`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newEmail, reason }),
        });

        const data = await res.json();
        if (res.ok) {
          showToast(data.message || "Verification request submitted!");
          if (newEmailInput) newEmailInput.value = "";
          if (reasonInput) reasonInput.value = "";
        } else {
          showToast(data.message || "Could not submit email request.", true);
        }
      } catch (err) {
        showToast("Request logged. A simulated verification was created.");
        if (newEmailInput) newEmailInput.value = "";
        if (reasonInput) reasonInput.value = "";
      } finally {
        btnRequestEmail.disabled = false;
        btnRequestEmail.textContent = originalBtnText;
      }
    });
  }
}

// Password visibility toggles
function initPasswordToggles() {
  const toggleBtns = document.querySelectorAll(".password-toggle-btn");
  toggleBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const input = document.getElementById(targetId);
      if (!input) return;

      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";

      btn.innerHTML = isPassword
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    });
  });
}

// ==========================================
// 6. UI UTILITIES (Toast & Dirty Status)
// ==========================================
function markDirty(dirty) {
  isDirty = dirty;
}

function showToast(message, isError = false) {
  let toast = document.getElementById("settings-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "settings-toast";
    toast.className = "settings-toast";
    document.body.appendChild(toast);
  }

  toast.innerHTML = isError
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg><span>${message}</span>`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg><span>${message}</span>`;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");

  if (window.toastTimeout) clearTimeout(window.toastTimeout);
  window.toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

// Spin animation keyframes injected if not already present
(function injectKeyframes() {
  if (document.getElementById("settings-keyframes")) return;
  const style = document.createElement("style");
  style.id = "settings-keyframes";
  style.textContent = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
})();
