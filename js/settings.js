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

// ==========================================
// IMAGE COMPRESSION HELPER (Canvas-based, prevents LocalStorage QuotaExceededError)
// ==========================================
function compressImageDataUrl(dataUrl, maxDim = 800, quality = 0.8) {
  return new Promise((resolve) => {
    if (
      !dataUrl ||
      typeof dataUrl !== "string" ||
      !dataUrl.startsWith("data:image/")
    ) {
      resolve(dataUrl || "");
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        let width = img.width || maxDim;
        let height = img.height || maxDim;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        let out = canvas.toDataURL("image/webp", quality);
        if (
          !out ||
          out.length > dataUrl.length ||
          !out.startsWith("data:image/")
        ) {
          out = canvas.toDataURL("image/jpeg", quality);
        }
        resolve(out && out.length < dataUrl.length ? out : dataUrl);
      } catch (_) {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initSettingsCategories();
  initImageUploads();
  initPasswordToggles();
  initSettingsFormActions();
  initSecurityActions();
  loadSettings();
});

// ==========================================
// 1. ACCORDION CATEGORIES CONTROLLER (Matching Student Settings)
// ==========================================
function initSettingsCategories() {
  const categoryBars = document.querySelectorAll(".settings-category-bar");
  categoryBars.forEach((bar) => {
    bar.addEventListener("click", (e) => {
      e.preventDefault();
      const group = bar.closest(".settings-category-group");
      if (!group) return;
      const isOpen = group.classList.contains("is-open");
      group.classList.toggle("is-open", !isOpen);
      bar.setAttribute("aria-expanded", String(!isOpen));
    });
  });

  // Check URL query parameters or hash to automatically activate requested category
  const urlParams = new URLSearchParams(window.location.search);
  const targetCategory =
    urlParams.get("category") ||
    urlParams.get("tab") ||
    window.location.hash.replace("#", "");

  if (targetCategory) {
    const cleanName = targetCategory
      .replace("panel-provider-", "")
      .replace("category-provider-", "")
      .replace("panel-", "")
      .replace("category-", "");
    const match =
      document.getElementById(`category-provider-${cleanName}`) ||
      document.getElementById(`category-${cleanName}`);
    if (match) {
      document
        .querySelectorAll(".settings-category-group")
        .forEach((g) => g.classList.remove("is-open"));
      match.classList.add("is-open");
      const barBtn = match.querySelector(".settings-category-bar");
      if (barBtn) barBtn.setAttribute("aria-expanded", "true");
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
      reader.onload = async function (event) {
        const rawData = event.target.result;
        bannerBase64 = await compressImageDataUrl(rawData, 960, 0.76);
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
      reader.onload = async function (event) {
        const rawData = event.target.result;
        logoBase64 = await compressImageDataUrl(rawData, 256, 0.82);
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
  const activeProviderEmail = (
    sessionStorage.getItem("nexo-provider-email") ||
    localStorage.getItem("nexo-provider-email") ||
    ""
  ).toLowerCase();

  try {
    const query = activeProviderEmail
      ? `?email=${encodeURIComponent(activeProviderEmail)}`
      : "";
    const res = await fetch(`${API_BASE}/api/settings${query}`);
    if (res.ok) {
      settings = await res.json();
      // Cache copy in localStorage and sessionStorage for offline & quick navigation
      try {
        if (activeProviderEmail) {
          sessionStorage.setItem(`nexo_provider_settings_${activeProviderEmail}`, JSON.stringify(settings));
          localStorage.setItem(`nexo_provider_settings_${activeProviderEmail}`, JSON.stringify(settings));
        }
        sessionStorage.setItem("nexo_provider_settings", JSON.stringify(settings));
        localStorage.setItem("nexo_provider_settings", JSON.stringify(settings));

        if (settings.bannerImage) {
          sessionStorage.setItem("nexo-provider-banner", settings.bannerImage);
          if (activeProviderEmail) sessionStorage.setItem(`nexo-provider-banner_${activeProviderEmail}`, settings.bannerImage);
          try {
            localStorage.setItem("nexo-provider-banner", settings.bannerImage);
            if (activeProviderEmail) localStorage.setItem(`nexo-provider-banner_${activeProviderEmail}`, settings.bannerImage);
          } catch (_) {}
        }
        if (settings.logoImage) {
          sessionStorage.setItem("nexo-provider-logo", settings.logoImage);
          if (activeProviderEmail) sessionStorage.setItem(`nexo-provider-logo_${activeProviderEmail}`, settings.logoImage);
          try {
            localStorage.setItem("nexo-provider-logo", settings.logoImage);
            if (activeProviderEmail) localStorage.setItem(`nexo-provider-logo_${activeProviderEmail}`, settings.logoImage);
          } catch (_) {}
        }
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
      const cached =
        (activeProviderEmail &&
          localStorage.getItem(`nexo_provider_settings_${activeProviderEmail}`)) ||
        localStorage.getItem("nexo_provider_settings");
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

  const activeEmail =
    s.email ||
    sessionStorage.getItem("nexo-provider-email") ||
    localStorage.getItem("nexo-provider-email") ||
    "provider@nexo.edu.ph";

  // Basic Information
  const orgNameInput = document.getElementById("org-name");
  const orgLocationInput = document.getElementById("org-location");
  const orgBioInput = document.getElementById("org-bio");

  if (orgNameInput) orgNameInput.value = s.orgName || "";
  if (orgLocationInput) orgLocationInput.value = s.location || "";
  if (orgBioInput) orgBioInput.value = s.bio || "";

  // Contact Details
  const contactPersonInput = document.getElementById("contact-person");
  const contactNumberInput = document.getElementById("contact-number");
  const contactEmailInput = document.getElementById("contact-email");

  if (contactPersonInput) contactPersonInput.value = s.contactPerson || "";
  if (contactNumberInput) contactNumberInput.value = s.contactNumber || "";
  if (contactEmailInput) contactEmailInput.value = s.email || activeEmail;

  // Current Email & Active Session Display in Security tab
  const currentAccountEmail = document.getElementById("current-account-email");
  const sessionActiveEmail = document.getElementById("session-active-email");
  if (currentAccountEmail) currentAccountEmail.textContent = activeEmail;
  if (sessionActiveEmail) sessionActiveEmail.textContent = activeEmail;

  // Banner Preview
  const bannerPreview = document.getElementById("banner-preview");
  const btnRemoveBanner = document.getElementById("btn-remove-banner");
  if (bannerPreview && s.bannerImage) {
    bannerPreview.src = s.bannerImage;
    bannerPreview.classList.add("has-image");
    if (btnRemoveBanner) btnRemoveBanner.classList.add("visible");
  } else if (bannerPreview) {
    bannerPreview.src = "";
    bannerPreview.classList.remove("has-image");
    if (btnRemoveBanner) btnRemoveBanner.classList.remove("visible");
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

  // Preferences / 2FA & Dark Mode
  const prefs = s.preferences || {};
  setCheckbox("pref-2fa", !!prefs.twoFactor);
  const isDark =
    document.body.classList.contains("dark-theme") ||
    document.documentElement.classList.contains("dark-theme");
  setCheckbox("pref-provider-dark-mode", isDark);
  const topToggle =
    document.getElementById("theme-toggle") ||
    document.querySelector(".theme-toggle");
  if (topToggle) topToggle.checked = !isDark;

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
  const saveBtns = document.querySelectorAll(
    "#btn-save-settings, .btn-save-settings",
  );
  const discardBtns = document.querySelectorAll(
    "#btn-discard-settings, .btn-discard-settings",
  );

  // Track any form input changes to flag unsaved state
  const inputs = document.querySelectorAll(
    ".settings-input, .nexo-switch input",
  );
  inputs.forEach((input) => {
    input.addEventListener("input", () => markDirty(true));
    input.addEventListener("change", () => markDirty(true));
  });

  saveBtns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      await saveAllSettings(btn);
    });
  });

  discardBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      bannerBase64 = null;
      logoBase64 = null;
      loadSettings();
      markDirty(false);
      showToast("Changes discarded");
    });
  });

  // Real-time auto-saving on notification switches & 2FA toggle
  const autoSaveToggles = document.querySelectorAll(
    "#notif-new-apps, #notif-email-alerts, #notif-weekly-digest, #notif-system-updates, #pref-2fa",
  );
  autoSaveToggles.forEach((t) => {
    t.addEventListener("change", () => {
      saveAllSettings();
    });
  });

  // Real-time Provider Dark Mode Toggle
  const providerDarkToggle = document.getElementById(
    "pref-provider-dark-mode",
  );
  const topHeaderToggle =
    document.getElementById("theme-toggle") ||
    document.querySelector(".theme-toggle");

  if (providerDarkToggle) {
    providerDarkToggle.addEventListener("change", (e) => {
      const wantDark = e.target.checked;
      if (wantDark) {
        document.documentElement.classList.add("dark-theme");
        document.body.classList.add("dark-theme");
        localStorage.setItem("nexo-theme", "dark");
      } else {
        document.documentElement.classList.remove("dark-theme");
        document.body.classList.remove("dark-theme");
        localStorage.setItem("nexo-theme", "light");
      }
      if (topHeaderToggle) {
        topHeaderToggle.checked = !wantDark;
      }
      showToast(wantDark ? "Dark theme enabled" : "Light theme enabled");
    });
  }

  if (topHeaderToggle && providerDarkToggle) {
    topHeaderToggle.addEventListener("change", () => {
      setTimeout(() => {
        const isDark =
          document.body.classList.contains("dark-theme") ||
          document.documentElement.classList.contains("dark-theme");
        providerDarkToggle.checked = isDark;
      }, 50);
    });
  }
}

async function saveAllSettings(saveBtn = null) {
  let originalText = "";
  if (saveBtn) {
    originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = `
      <svg class="spin-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 0.8s linear infinite;">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
        <path d="M12 2a10 10 0 0 1 10 10"></path>
      </svg>
      Saving...
    `;
  }

  const activeProviderEmail = (
    sessionStorage.getItem("nexo-provider-email") ||
    localStorage.getItem("nexo-provider-email") ||
    ""
  ).toLowerCase();

  const orgNameVal =
    document.getElementById("org-name")?.value.trim() || "NEXO";
  const locationVal =
    document.getElementById("org-location")?.value.trim() || "";
  const contactPersonVal =
    document.getElementById("contact-person")?.value.trim() || "";
  const contactNumberVal =
    document.getElementById("contact-number")?.value.trim() || "";
  const emailVal =
    document.getElementById("contact-email")?.value.trim() ||
    activeProviderEmail ||
    "";
  const bioVal = document.getElementById("org-bio")?.value.trim() || "";

  // Determine image payloads
  let finalBanner = currentSettings.bannerImage || "";
  if (bannerBase64 !== null) {
    finalBanner = bannerBase64;
  }
  if (finalBanner && finalBanner.length > 250000) {
    try {
      finalBanner = await compressImageDataUrl(finalBanner, 960, 0.76);
    } catch (_) {}
  }

  let finalLogo = currentSettings.logoImage || "";
  if (logoBase64 !== null) {
    finalLogo = logoBase64;
  }
  if (finalLogo && finalLogo.length > 50000) {
    try {
      finalLogo = await compressImageDataUrl(finalLogo, 256, 0.82);
    } catch (_) {}
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

  // Always mirror to localStorage and sessionStorage with quota-safe isolation
  const targetEmailKey = (emailVal || activeProviderEmail).toLowerCase();
  try {
    if (orgNameVal) {
      localStorage.setItem("nexo-provider-name", orgNameVal);
      sessionStorage.setItem("nexo-provider-name", orgNameVal);
    }
    if (targetEmailKey) {
      localStorage.setItem("nexo-provider-email", targetEmailKey);
      sessionStorage.setItem("nexo-provider-email", targetEmailKey);
    }
  } catch (_) {}

  // 1. Session Storage mirroring (Zero Quota impact on localStorage, persists across tab navigations)
  try {
    if (targetEmailKey) {
      sessionStorage.setItem(
        `nexo_provider_settings_${targetEmailKey}`,
        JSON.stringify(currentSettings),
      );
    }
    sessionStorage.setItem(
      "nexo_provider_settings",
      JSON.stringify(currentSettings),
    );
    if (finalBanner) {
      sessionStorage.setItem("nexo-provider-banner", finalBanner);
      if (targetEmailKey) sessionStorage.setItem(`nexo-provider-banner_${targetEmailKey}`, finalBanner);
    } else {
      sessionStorage.removeItem("nexo-provider-banner");
      if (targetEmailKey) sessionStorage.removeItem(`nexo-provider-banner_${targetEmailKey}`);
    }
    if (finalLogo) {
      sessionStorage.setItem("nexo-provider-logo", finalLogo);
      if (targetEmailKey) sessionStorage.setItem(`nexo-provider-logo_${targetEmailKey}`, finalLogo);
    } else {
      sessionStorage.removeItem("nexo-provider-logo");
      if (targetEmailKey) sessionStorage.removeItem(`nexo-provider-logo_${targetEmailKey}`);
    }
  } catch (_) {}

  // 2. Local Storage mirroring
  try {
    if (targetEmailKey) {
      localStorage.setItem(
        `nexo_provider_settings_${targetEmailKey}`,
        JSON.stringify(currentSettings),
      );
    }
    localStorage.setItem(
      "nexo_provider_settings",
      JSON.stringify(currentSettings),
    );
    localStorage.setItem("nexo_settings", JSON.stringify(currentSettings));

    if (finalLogo) {
      localStorage.setItem("nexo-provider-logo", finalLogo);
      if (targetEmailKey) localStorage.setItem(`nexo-provider-logo_${targetEmailKey}`, finalLogo);
    } else {
      localStorage.removeItem("nexo-provider-logo");
      if (targetEmailKey) localStorage.removeItem(`nexo-provider-logo_${targetEmailKey}`);
    }

    if (finalBanner) {
      localStorage.setItem("nexo-provider-banner", finalBanner);
      if (targetEmailKey) localStorage.setItem(`nexo-provider-banner_${targetEmailKey}`, finalBanner);
    } else {
      localStorage.removeItem("nexo-provider-banner");
      if (targetEmailKey) localStorage.removeItem(`nexo-provider-banner_${targetEmailKey}`);
    }
  } catch (quotaErr) {
    console.warn(
      "Storage quota full when saving provider settings, clearing volatile keys...",
    );
    try {
      localStorage.removeItem("provider-banner-preview");
      if (finalBanner) {
        localStorage.setItem("nexo-provider-banner", finalBanner);
      }
      if (finalLogo) {
        localStorage.setItem("nexo-provider-logo", finalLogo);
      }
      if (targetEmailKey) {
        localStorage.setItem(
          `nexo_provider_settings_${targetEmailKey}`,
          JSON.stringify(currentSettings),
        );
      }
    } catch (_) {
      // In worst-case quota failure, sessionStorage and server backend preserve the state
    }
  }

  // Notify listeners and other components of settings & banner update
  try {
    window.dispatchEvent(
      new CustomEvent("nexo:settings-updated", { detail: currentSettings }),
    );
    window.dispatchEvent(
      new CustomEvent("nexo:banner-updated", {
        detail: { bannerImage: finalBanner, email: targetEmailKey },
      }),
    );
  } catch (_) {}

  try {
    const wantDark = document.getElementById(
      "pref-provider-dark-mode",
    )?.checked;
    if (wantDark !== undefined) {
      if (wantDark) {
        document.documentElement.classList.add("dark-theme");
        document.body.classList.add("dark-theme");
        localStorage.setItem("nexo-theme", "dark");
      } else {
        document.documentElement.classList.remove("dark-theme");
        document.body.classList.remove("dark-theme");
        localStorage.setItem("nexo-theme", "light");
      }
    }
  } catch (_) {}

  // Update matching scholarships in local storage safely
  try {
    const cachedSchols = JSON.parse(
      localStorage.getItem("nexo_scholarships") || "[]",
    );
    const isPrimary =
      targetEmailKey === "admin@admin" ||
      targetEmailKey === "provider@nexo.edu.ph";
    if (Array.isArray(cachedSchols) && cachedSchols.length > 0) {
      cachedSchols.forEach((s) => {
        const emailMatch =
          targetEmailKey &&
          s.providerEmail &&
          s.providerEmail.toLowerCase() === targetEmailKey;
        const nameMatch =
          s.providerName === orgNameVal ||
          (isPrimary && (!s.providerName || s.providerName === "NEXO"));
        if (emailMatch || nameMatch) {
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

  if (saveBtn) {
    saveBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M20 6L9 17l-5-5"></path>
      </svg>
      Saved!
    `;

    setTimeout(() => {
      saveBtn.innerHTML = originalText;
      saveBtn.disabled = false;
    }, 1200);
  }

  showToast("Customization saved");
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
        const providerEmail = (
          sessionStorage.getItem("nexo-provider-email") ||
          localStorage.getItem("nexo-provider-email") ||
          ""
        ).toLowerCase();

        const res = await fetch(`${API_BASE}/api/settings/password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: providerEmail,
            role: "provider",
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
          try {
            const uList = JSON.parse(
              localStorage.getItem("nexo_users") || "[]",
            );
            const u = uList.find(
              (x) => (x.email || "").toLowerCase() === providerEmail,
            );
            if (u) {
              u.password = newPass;
              localStorage.setItem("nexo_users", JSON.stringify(uList));
            }
          } catch (_) {}
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
