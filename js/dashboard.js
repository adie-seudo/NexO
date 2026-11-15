// =========================================
// STATE TRACKERS & API CONFIG
// =========================================
let totalScholarships = 0;
let ongoingScholarships = 0;
let draftCount = 0;
let currentEditingDraftCard = null; // Tracks if we are updating a draft
let currentEditingDraftId = null;
let isDraftsExpanded = false;

// Local Node.js / Express Server file-handling endpoint
window.API_BASE =
  window.API_BASE ||
  (window.location.origin.includes(":3000") ? "" : "http://localhost:3000");
var API_BASE = window.API_BASE;

// =========================================
// CACHED DOM ELEMENTS (Boosts Performance)
// =========================================
const DOM = {};

// =========================================
// MASTER INITIALIZATION
// =========================================
function initDashboard() {
  cacheDOM();
  initDashboardModals();
  initCustomDropdown();
  initStepNavigation();
  initCustomRequirements();
  initViewSwitching();
  initPublishAndDraft();
  initModalCancellation();
  initDraftEditing();
  initDynamicAvatar();
  loadPersistedData(); // <-- Loads data from local data.json via Node/Express!

  // Live Sync Polling every 4 seconds
  setInterval(() => {
    if (!DOM.creationModal || !DOM.creationModal.classList.contains("active")) {
      loadPersistedData();
    }
  }, 4000);
  window.addEventListener("focus", loadPersistedData);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDashboard);
} else {
  initDashboard();
}

function cacheDOM() {
  // Step 1 Validation Elements
  DOM.nameInput = document.getElementById("schol-name");
  DOM.nameError = document.getElementById("error-schol-name");
  DOM.descInput = document.getElementById("schol-desc");
  DOM.descError = document.getElementById("error-schol-desc");
  DOM.typeInput = document.getElementById("schol-type");
  DOM.typeSelected = document.getElementById("schol-type-selected");
  DOM.typeError = document.getElementById("error-schol-type");
  DOM.dateInput = document.getElementById("schol-deadline");
  DOM.dateError = document.getElementById("error-schol-deadline");
  DOM.limitInput = document.getElementById("schol-limit");
  DOM.limitError = document.getElementById("error-schol-limit");

  // Step 2 & 3 Validation Elements
  DOM.reqList = document.getElementById("requirements-list");
  DOM.step2Error = document.getElementById("error-step-2");
  DOM.confirmCheck = document.getElementById("confirm-info");
  DOM.step3Error = document.getElementById("error-step-3");

  // Navigation & Progress Elements
  DOM.stepContainers = [
    document.getElementById("step-1-container"),
    document.getElementById("step-2-container"),
    document.getElementById("step-3-container"),
  ];
  DOM.progressBarFill = document.querySelector(".progress-bar-fill");
  DOM.progressText = document.querySelector(".progress-percentage");
  DOM.stepIndicators = document.querySelectorAll(".step");
  DOM.creationModal = document.getElementById("create-scholarship-modal");
}

// =========================================
// 1. DASHBOARD MODALS (Fixed Multi-Button Listener)
// =========================================
function openNewScholarshipCreationModal() {
  if (!DOM.creationModal) return;

  // Reset editing trackers and button text
  currentEditingDraftCard = null;
  currentEditingDraftId = null;
  maxStepReached = 1;
  const draftBtn = document.getElementById("draft-btn");
  if (draftBtn) draftBtn.textContent = "Save as Draft";

  // Reset the form so it opens fresh
  const step1Form = document.getElementById("step-1-form");
  if (step1Form) step1Form.reset();
  if (DOM.typeSelected) {
    DOM.typeSelected.querySelector("span").textContent = "Select type";
    DOM.typeSelected.classList.remove("has-value");
    if (DOM.typeInput) DOM.typeInput.value = "";
  }
  if (DOM.reqList) {
    DOM.reqList.innerHTML = `
      <div class="req-card">
        <div class="req-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2"></rect>
            <circle cx="9" cy="10" r="2"></circle>
            <line x1="15" y1="8" x2="17" y2="8"></line>
            <line x1="15" y1="12" x2="17" y2="12"></line>
            <line x1="7" y1="16" x2="17" y2="16"></line>
          </svg>
        </div>
        <div class="req-text">
          <h4>Valid School ID</h4>
          <p>Upload a clear photo of your student ID. (Max 5MB)</p>
        </div>
        <button type="button" class="remove-req-btn" aria-label="Remove">&times;</button>
      </div>
      <div class="req-card">
        <div class="req-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
        </div>
        <div class="req-text">
          <h4>Latest Grades/Transcript</h4>
          <p>Upload your latest grades or official transcript.</p>
        </div>
        <button type="button" class="remove-req-btn" aria-label="Remove">&times;</button>
      </div>
    `;
  }

  DOM.creationModal.classList.add("active");
  DOM.creationModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  goToStep(1, false);
}
window.openNewScholarshipCreationModal = openNewScholarshipCreationModal;

function initDashboardModals() {
  // Select BOTH the main dashboard button (by ID) and the drafts button (by Class)
  const openBtns = document.querySelectorAll(
    "#open-create-modal, .open-create-modal-btn",
  );

  if (openBtns.length > 0 && DOM.creationModal) {
    // Loop through every matching button and attach the click event
    openBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        openNewScholarshipCreationModal();
      });
    });
  } else {
    console.warn(
      "Dashboard Notice: Modal open buttons or 'create-scholarship-modal' not found on this page.",
    );
  }

  // Auto-open creation modal if arriving via link with #open-create or ?action=create
  function checkUrlForCreationTrigger() {
    const hash = (window.location.hash || "").toLowerCase();
    const search = (window.location.search || "").toLowerCase();
    if (
      hash === "#open-create" ||
      hash === "#create" ||
      search.includes("action=create") ||
      search.includes("create=true") ||
      search.includes("open=create")
    ) {
      setTimeout(() => {
        openNewScholarshipCreationModal();
        try {
          if (window.location.hash || window.location.search.includes("create")) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } catch (_) {}
      }, 120);
    }
  }

  checkUrlForCreationTrigger();
  window.addEventListener("hashchange", checkUrlForCreationTrigger);
}

// =========================================
// 2. CUSTOM DROPDOWN LOGIC
// =========================================
function initCustomDropdown() {
  const dropdown = document.getElementById("schol-type-dropdown");
  const selected = document.getElementById("schol-type-selected");
  const options = document.getElementById("schol-type-options");
  const hiddenInput = document.getElementById("schol-type");

  if (dropdown && selected && options && hiddenInput) {
    const selectedText = selected.querySelector("span");

    selected.addEventListener("click", () => {
      dropdown.classList.toggle("active");
    });

    options.querySelectorAll("li").forEach((option) => {
      option.addEventListener("click", () => {
        selectedText.textContent = option.textContent;
        hiddenInput.value = option.getAttribute("data-value");
        selected.classList.add("has-value");
        dropdown.classList.remove("active");
      });
    });

    document.addEventListener("click", (e) => {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove("active");
      }
    });
  }
}

// =========================================
// 3. STEP NAVIGATION & MODAL LOGIC
// =========================================
let maxStepReached = 1;

function goToStep(stepNumber = 1, isEdit = false) {
  if (!DOM.stepContainers || DOM.stepContainers.length === 0) return;
  if (typeof stepNumber === "number" && stepNumber > maxStepReached) {
    maxStepReached = stepNumber;
  }

  // Populate Review Step before showing it
  if (stepNumber === 3 && !isEdit) {
    document.getElementById("review-title").textContent = DOM.nameInput
      ? DOM.nameInput.value
      : "";
    document.getElementById("review-desc-text").textContent = DOM.descInput
      ? DOM.descInput.value
      : "";
    document.getElementById("review-type").textContent = "Admin";

    const typeSelectedText = DOM.typeSelected
      ? DOM.typeSelected.querySelector("span").textContent
      : "";
    const reviewCategoryPill = document.getElementById("review-category");
    if (reviewCategoryPill) reviewCategoryPill.textContent = typeSelectedText;

    if (DOM.dateInput && DOM.dateInput.value) {
      const dateObj = new Date(DOM.dateInput.value);
      document.getElementById("review-date").textContent =
        dateObj.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
    }

    const limitVal =
      DOM.limitInput && DOM.limitInput.value
        ? parseInt(DOM.limitInput.value, 10)
        : 200;
    const reviewLimitEl = document.getElementById("review-limit");
    if (reviewLimitEl) reviewLimitEl.textContent = `${limitVal} Applicants`;

    const reviewReqList = document.querySelector(".review-req-list");
    if (reviewReqList) {
      reviewReqList.innerHTML = "";
      const currentReqs = document.querySelectorAll(
        "#requirements-list .req-card h4",
      );
      currentReqs.forEach((req) => {
        const li = document.createElement("li");
        li.textContent = req.textContent;
        reviewReqList.appendChild(li);
      });
    }
  }

  // Hide all, show target step
  DOM.stepContainers.forEach((container) => {
    if (container) container.classList.remove("active");
  });
  if (DOM.stepContainers[stepNumber - 1]) {
    DOM.stepContainers[stepNumber - 1].classList.add("active");
  }

  // Toggle Edit vs Normal Buttons
  const s1Normal = document.getElementById("step-1-normal-actions");
  const s1Edit = document.getElementById("step-1-edit-actions");
  const s2Normal = document.getElementById("step-2-normal-actions");
  const s2Edit = document.getElementById("step-2-edit-actions");

  if (isEdit) {
    if (s1Normal) s1Normal.style.display = "none";
    if (s1Edit) s1Edit.style.display = "flex";
    if (s2Normal) s2Normal.style.display = "none";
    if (s2Edit) s2Edit.style.display = "flex";
  } else {
    if (s1Normal) s1Normal.style.display = "flex";
    if (s1Edit) s1Edit.style.display = "none";
    if (s2Normal) s2Normal.style.display = "flex";
    if (s2Edit) s2Edit.style.display = "none";
  }

  // Update Progress Bar
  if (DOM.progressBarFill && DOM.progressText) {
    if (stepNumber === 3) {
      DOM.progressBarFill.style.width = "100%";
      DOM.progressBarFill.style.backgroundColor = "#10b981";
      DOM.progressText.textContent = "100%";
      DOM.progressText.style.color = "#10b981";
    } else if (stepNumber === 2) {
      DOM.progressBarFill.style.width = "66%";
      DOM.progressBarFill.style.backgroundColor = "#f59e0b";
      DOM.progressText.textContent = "66%";
      DOM.progressText.style.color = "#f59e0b";
    } else {
      DOM.progressBarFill.style.width = "33%";
      DOM.progressBarFill.style.backgroundColor = "#ef4444";
      DOM.progressText.textContent = "33%";
      DOM.progressText.style.color = "#ef4444";
    }
  }

  // Update Step Circles
  const checkmarkSVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="color:white;"><path d="M20 6L9 17l-5-5"></path></svg>`;
  if (DOM.stepIndicators) {
    DOM.stepIndicators.forEach((indicator, index) => {
      const numSpan = indicator.querySelector(".step-num");
      const stepIdx = index + 1;

      indicator.classList.remove("active", "completed", "inactive");
      numSpan.style.backgroundColor = "";

      if (stepIdx < stepNumber) {
        indicator.classList.add("completed");
        numSpan.innerHTML = checkmarkSVG;
        numSpan.style.backgroundColor = "#10b981";
      } else if (stepIdx === stepNumber) {
        indicator.classList.add("active");
        numSpan.innerHTML = stepIdx;
      } else {
        indicator.classList.add("inactive");
        numSpan.innerHTML = stepIdx;
      }
    });
  }
}

function initStepNavigation() {
  const btnGoToStep1 = document.getElementById("go-to-step-1");
  const btnGoToStep2 = document.getElementById("go-to-step-2");
  const btnGoToStep3 = document.getElementById("go-to-step-3");
  const btnBackToStep2 = document.getElementById("back-to-step-2");

  if (btnGoToStep1)
    btnGoToStep1.addEventListener("click", () => goToStep(1, false));
  if (btnGoToStep2)
    btnGoToStep2.addEventListener("click", () => {
      if (validateStep1()) goToStep(2, false);
    });
  if (btnGoToStep3)
    btnGoToStep3.addEventListener("click", () => {
      if (validateStep2()) goToStep(3, false);
    });
  if (btnBackToStep2)
    btnBackToStep2.addEventListener("click", () => goToStep(2, false));

  const editStep1 = document.getElementById("edit-step-1");
  const editStep2 = document.getElementById("edit-step-2");
  if (editStep1) editStep1.addEventListener("click", () => goToStep(1, true));
  if (editStep2) editStep2.addEventListener("click", () => goToStep(2, true));

  const doneEdit1 = document.getElementById("done-edit-1");
  const doneEdit2 = document.getElementById("done-edit-2");
  if (doneEdit1)
    doneEdit1.addEventListener("click", () => {
      if (validateStep1()) goToStep(3, false);
    });
  if (doneEdit2)
    doneEdit2.addEventListener("click", () => {
      if (validateStep2()) goToStep(3, false);
    });

  const returnToReviewBtns = [
    document.getElementById("cancel-edit-1"),
    document.getElementById("cancel-edit-2"),
  ];
  returnToReviewBtns.forEach((btn) => {
    if (btn) btn.addEventListener("click", () => goToStep(3, false));
  });
}

// =========================================
// 4. STEP VALIDATIONS (Using Cached DOM)
// =========================================
function validateStep1() {
  let isValid = true;

  if (DOM.nameInput && !DOM.nameInput.value.trim()) {
    DOM.nameError.textContent = "Please enter the scholarship name.";
    DOM.nameError.classList.add("active");
    DOM.nameInput.classList.add("input-error");
    isValid = false;
  } else if (DOM.nameInput) {
    DOM.nameError.classList.remove("active");
    DOM.nameInput.classList.remove("input-error");
  }

  if (DOM.descInput && !DOM.descInput.value.trim()) {
    DOM.descError.textContent = "Please provide a short description.";
    DOM.descError.classList.add("active");
    DOM.descInput.classList.add("input-error");
    isValid = false;
  } else if (DOM.descInput) {
    DOM.descError.classList.remove("active");
    DOM.descInput.classList.remove("input-error");
  }

  if (DOM.typeInput && !DOM.typeInput.value) {
    DOM.typeError.textContent = "Please select a scholarship type.";
    DOM.typeError.classList.add("active");
    if (DOM.typeSelected) DOM.typeSelected.classList.add("input-error");
    isValid = false;
  } else if (DOM.typeInput) {
    DOM.typeError.classList.remove("active");
    if (DOM.typeSelected) DOM.typeSelected.classList.remove("input-error");
  }

  if (DOM.dateInput && !DOM.dateInput.value) {
    DOM.dateError.textContent = "Please select a deadline.";
    DOM.dateError.classList.add("active");
    DOM.dateInput.classList.add("input-error");
    isValid = false;
  } else if (DOM.dateInput) {
    const selectedDate = new Date(DOM.dateInput.value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(selectedDate.getTime())) {
      DOM.dateError.textContent = "Please enter a valid date (MM/DD/YYYY).";
      DOM.dateError.classList.add("active");
      DOM.dateInput.classList.add("input-error");
      isValid = false;
    } else if (selectedDate <= today) {
      DOM.dateError.textContent = "Deadline must be a future date.";
      DOM.dateError.classList.add("active");
      DOM.dateInput.classList.add("input-error");
      isValid = false;
    } else {
      DOM.dateError.classList.remove("active");
      DOM.dateInput.classList.remove("input-error");
    }
  }

  if (DOM.limitInput) {
    const val = parseInt(DOM.limitInput.value, 10);
    if (!val || val <= 0) {
      if (DOM.limitError) {
        DOM.limitError.textContent =
          "Please enter a valid applicant limit (at least 1).";
        DOM.limitError.classList.add("active");
      }
      DOM.limitInput.classList.add("input-error");
      isValid = false;
    } else {
      if (DOM.limitError) DOM.limitError.classList.remove("active");
      DOM.limitInput.classList.remove("input-error");
    }
  }

  return isValid;
}

function validateStep2() {
  if (!DOM.reqList || !DOM.step2Error) return true;
  const currentCards = DOM.reqList.querySelectorAll(".req-card");

  if (currentCards.length === 0) {
    DOM.step2Error.textContent = "Please add at least one requirement.";
    DOM.step2Error.classList.add("active");
    return false;
  } else {
    DOM.step2Error.classList.remove("active");
    return true;
  }
}

function validateStep3() {
  if (!DOM.confirmCheck || !DOM.step3Error) return true;

  if (!DOM.confirmCheck.checked) {
    DOM.step3Error.textContent =
      "Please confirm the information is true and correct before proceeding.";
    DOM.step3Error.classList.add("active");
    return false;
  } else {
    DOM.step3Error.classList.remove("active");
    return true;
  }
}

// =========================================
// 5. CUSTOM REQUIREMENTS LOGIC
// =========================================
function initCustomRequirements() {
  const addCustomReqBtn = document.getElementById("add-custom-req-btn");
  if (addCustomReqBtn && DOM.reqList) {
    addCustomReqBtn.addEventListener("click", () => {
      const newCard = document.createElement("div");
      newCard.className = "req-card custom-edit-mode";
      newCard.innerHTML = `
          <input type="text" class="custom-req-input custom-title" placeholder="Requirement Name (e.g. Portfolio)">
          <input type="text" class="custom-req-input custom-desc" placeholder="Short description...">
          <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px;">
            <button type="button" class="btn btn-secondary cancel-custom-btn" style="padding: 8px 16px; font-size: 13px;">Cancel</button>
            <button type="button" class="btn btn-primary save-custom-btn" style="padding: 8px 16px; font-size: 13px;">Save</button>
          </div>
        `;
      DOM.reqList.appendChild(newCard);
      newCard.querySelector(".custom-title").focus();

      newCard
        .querySelector(".cancel-custom-btn")
        .addEventListener("click", () => newCard.remove());

      newCard
        .querySelector(".save-custom-btn")
        .addEventListener("click", () => {
          const titleInput = newCard.querySelector(".custom-title");
          const descInput = newCard.querySelector(".custom-desc");
          const titleVal = titleInput.value.trim();
          const descVal = descInput.value.trim();
          let isValid = true;

          if (!titleVal) {
            titleInput.classList.add("input-error");
            isValid = false;
          } else {
            titleInput.classList.remove("input-error");
          }

          if (!descVal) {
            descInput.classList.add("input-error");
            isValid = false;
          } else {
            descInput.classList.remove("input-error");
          }

          if (!isValid) return;

          newCard.className = "req-card";
          newCard.innerHTML = `
            <div class="req-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
            </div>
            <div class="req-text">
              <h4>${titleVal}</h4>
              <p>${descVal}</p>
            </div>
            <button type="button" class="remove-req-btn" aria-label="Remove">&times;</button>
          `;

          if (DOM.step2Error) DOM.step2Error.classList.remove("active");
        });
    });

    DOM.reqList.addEventListener("click", (e) => {
      if (
        e.target.classList.contains("remove-req-btn") ||
        e.target.closest(".remove-req-btn")
      ) {
        const card = e.target.closest(".req-card");
        if (card) {
          card.style.transition = "opacity 0.2s, transform 0.2s";
          card.style.opacity = "0";
          card.style.transform = "scale(0.95)";
          setTimeout(() => card.remove(), 200);
        }
      }
    });
  }
}

// =========================================
// 6. VIEW SWITCHING (HOME vs DRAFTS vs ALL)
// =========================================
function initViewSwitching() {
  const navHome = document.querySelector('a[href="provider-dashboard.html"]');
  const navDrafts = document.getElementById("nav-drafts");
  const dashCoverBanner = document.getElementById("dash-cover-banner");
  const dashWelcomeHero = document.getElementById("provider-welcome-section") || document.querySelector(".provider-welcome-hero, .dash-welcome");
  const dashStatsGrid = document.querySelector(".provider-stats-four-grid, .provider-stats-grid, .dash-stats-container");
  const dashMainGrid = document.querySelector(".provider-main-grid");
  const dashRecent = document.querySelector(".dash-recent");
  const dashActions = document.querySelector(".dash-actions");
  const dashDraftsSection = document.getElementById("dash-drafts-section");

  const dashAllScholSection = document.getElementById(
    "dash-all-scholarships-section",
  );
  const viewAllBtn = document.getElementById("view-all-btn");
  const backToDashBtn = document.getElementById("back-to-dash-btn");

  function showHome() {
    if (dashCoverBanner) dashCoverBanner.style.display = "block";
    if (dashWelcomeHero) dashWelcomeHero.style.display = "flex";
    if (dashStatsGrid) dashStatsGrid.style.display = "grid";
    if (dashMainGrid) dashMainGrid.style.display = "grid";
    if (dashRecent) dashRecent.style.display = "block";
    if (dashActions) dashActions.style.display = "block";
    if (dashDraftsSection) dashDraftsSection.style.display = "none";
    if (dashAllScholSection) dashAllScholSection.style.display = "none";

    const curNavHome = document.querySelector('a[href="provider-dashboard.html"]');
    const curNavDrafts = document.getElementById("nav-drafts");
    if (curNavHome) curNavHome.classList.add("active");
    if (curNavDrafts) curNavDrafts.classList.remove("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showDrafts() {
    if (dashCoverBanner) dashCoverBanner.style.display = "none";
    if (dashWelcomeHero) dashWelcomeHero.style.display = "none";
    if (dashStatsGrid) dashStatsGrid.style.display = "none";
    if (dashMainGrid) dashMainGrid.style.display = "none";
    if (dashRecent) dashRecent.style.display = "none";
    if (dashActions) dashActions.style.display = "none";
    if (dashDraftsSection) dashDraftsSection.style.display = "block";
    if (dashAllScholSection) dashAllScholSection.style.display = "none";

    const curNavHome = document.querySelector('a[href="provider-dashboard.html"]');
    const curNavDrafts = document.getElementById("nav-drafts");
    if (curNavDrafts) curNavDrafts.classList.add("active");
    if (curNavHome) curNavHome.classList.remove("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  window.showHomeView = showHome;
  window.showDraftsView = showDrafts;

  if (navDrafts) {
    navDrafts.addEventListener("click", (e) => {
      e.preventDefault();
      showDrafts();
    });
  }

  if (navHome) {
    navHome.addEventListener("click", (e) => {
      e.preventDefault();
      showHome();
    });
  }

  // When "View All" is clicked, navigate directly to Posted Scholarships manager
  if (viewAllBtn) {
    viewAllBtn.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = "provider-posts.html";
    });
  }

  // When "Back" is clicked on the All Scholarships page
  if (backToDashBtn) {
    backToDashBtn.addEventListener("click", (e) => {
      e.preventDefault();
      showHome();
    });
  }
}

// =========================================
// 7. PERSISTENCE HELPERS & FILE HANDLING
// =========================================
function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getCollectedRequirements() {
  const reqs = [];
  if (DOM.reqList) {
    DOM.reqList.querySelectorAll(".req-card").forEach((card) => {
      const h4 = card.querySelector("h4");
      const p = card.querySelector("p");
      if (h4) {
        reqs.push({
          title: h4.textContent.trim(),
          desc: p ? p.textContent.trim() : "",
        });
      }
    });
  }
  return reqs;
}

function closeProviderDetailsModal() {
  const modalEl = document.getElementById("view-details-modal");
  if (modalEl) {
    modalEl.classList.remove("active");
    modalEl.setAttribute("aria-hidden", "true");
  }
  document.body.style.overflow = "auto";
  document.removeEventListener("keydown", handleProviderDetailsEsc);
}
function handleProviderDetailsEsc(e) {
  if (e.key === "Escape") closeProviderDetailsModal();
}
window.closeProviderDetailsModal = closeProviderDetailsModal;

// Banner & Logo resolvers matching Student POV (student-browse.js)
function resolveProviderBanner(schol) {
  if (!schol) return "";
  if (schol.providerBanner && String(schol.providerBanner).trim()) {
    return String(schol.providerBanner).trim();
  }
  if (schol.bannerImage && String(schol.bannerImage).trim()) {
    return String(schol.bannerImage).trim();
  }
  if (schol.banner && String(schol.banner).trim()) {
    return String(schol.banner).trim();
  }
  if (schol.coverPhoto && String(schol.coverPhoto).trim()) {
    return String(schol.coverPhoto).trim();
  }
  if (schol.coverImage && String(schol.coverImage).trim()) {
    return String(schol.coverImage).trim();
  }
  if (schol.cover && String(schol.cover).trim()) {
    return String(schol.cover).trim();
  }

  // Fallback to provider settings or localStorage
  let settings = window._activeProviderSettings;
  if (!settings) {
    try {
      const cached = localStorage.getItem("nexo_provider_settings");
      if (cached) settings = JSON.parse(cached);
    } catch (_) {}
  }
  const activeOrgName =
    (settings && settings.orgName) ||
    localStorage.getItem("nexo-provider-name") ||
    "NEXO";
  const itemOrg = (schol && schol.providerName ? schol.providerName.trim() : "");
  if (!itemOrg || itemOrg.toLowerCase() === activeOrgName.toLowerCase() || itemOrg.toLowerCase() === "nexo") {
    const settingsBanner =
      (settings && settings.bannerImage) ||
      localStorage.getItem("nexo-provider-banner") ||
      localStorage.getItem("provider-banner-preview") ||
      "";
    if (settingsBanner && String(settingsBanner).trim()) {
      return String(settingsBanner).trim();
    }
  }
  return "";
}

function resolveProviderLogo(schol) {
  if (!schol) return "";
  if (schol.providerLogo && String(schol.providerLogo).trim()) {
    return String(schol.providerLogo).trim();
  }
  if (schol.logoImage && String(schol.logoImage).trim()) {
    return String(schol.logoImage).trim();
  }
  if (schol.logo && String(schol.logo).trim()) {
    return String(schol.logo).trim();
  }

  let settings = window._activeProviderSettings;
  if (!settings) {
    try {
      const cached = localStorage.getItem("nexo_provider_settings");
      if (cached) settings = JSON.parse(cached);
    } catch (_) {}
  }
  const activeOrgName =
    (settings && settings.orgName) ||
    localStorage.getItem("nexo-provider-name") ||
    "NEXO";
  const itemOrg = (schol && schol.providerName ? schol.providerName.trim() : "");
  if (!itemOrg || itemOrg.toLowerCase() === activeOrgName.toLowerCase() || itemOrg.toLowerCase() === "nexo") {
    const settingsLogo =
      (settings && settings.logoImage) ||
      localStorage.getItem("nexo-provider-logo") ||
      "";
    if (settingsLogo && String(settingsLogo).trim()) {
      return String(settingsLogo).trim();
    }
  }
  return "";
}

function openScholarshipDetailsModal(schol, applicantCountDisplay, applicantCount) {
  const modalEl = document.getElementById("view-details-modal");
  if (!modalEl) return;

  const titleEl = document.getElementById("view-modal-title");
  const providerEl = document.getElementById("view-modal-provider");
  const typeEl = document.getElementById("view-modal-type");
  const statusEl = document.getElementById("view-modal-status");
  const dateEl = document.getElementById("view-modal-date");
  const postedEl = document.getElementById("view-modal-posted");
  const applicantsEl = document.getElementById("view-modal-applicants");
  const descEl = document.getElementById("view-modal-desc");
  const reqsEl = document.getElementById("view-modal-reqs");
  const coverImg = document.getElementById("view-modal-cover-img");
  const logoEl = document.getElementById("view-modal-schol-logo");
  const manageBtn = document.getElementById("view-modal-manage-btn");

  if (titleEl) titleEl.textContent = schol.title || "Scholarship Program";

  // Provider Organization
  const orgName =
    schol.organization ||
    schol.providerName ||
    localStorage.getItem("nexo-provider-name") ||
    "NEXO";
  if (providerEl) providerEl.textContent = orgName;

  // Type & Status
  if (typeEl) typeEl.textContent = schol.typeText || schol.type || "Scholarship";
  if (statusEl) {
    const isClosed =
      String(schol.status || "").toLowerCase().includes("closed") ||
      String(schol.status || "").toLowerCase().includes("quota");
    statusEl.textContent = isClosed ? "Closed" : "Active";
    statusEl.style.background = isClosed
      ? "rgba(239, 68, 68, 0.12)"
      : "rgba(16, 185, 129, 0.12)";
    statusEl.style.color = isClosed ? "#ef4444" : "#10b981";
  }

  // Dates
  if (dateEl) {
    dateEl.textContent =
      schol.formattedDate ||
      (schol.deadline
        ? new Date(schol.deadline).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "No Deadline");
  }
  if (postedEl) {
    postedEl.textContent = schol.createdAt
      ? new Date(schol.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : schol.postedDate || "Recently";
  }

  // Calculate live applicant count
  let actualCount = 0;
  if (typeof applicantCount === "number") {
    actualCount = applicantCount;
  } else {
    try {
      const apps = Array.isArray(window._allApplicationsCache)
        ? window._allApplicationsCache
        : JSON.parse(localStorage.getItem("nexo_applications") || "[]");
      if (Array.isArray(apps) && apps.length > 0) {
        actualCount = apps.filter((a) => {
          if (a.scholarshipId && schol.id && String(a.scholarshipId) === String(schol.id)) return true;
          if (schol.title && (a.scholarshipTitle === schol.title || a.title === schol.title)) return true;
          return false;
        }).length;
      } else if (schol.applicantTotal !== undefined) {
        actualCount = parseInt(schol.applicantTotal, 10) || 0;
      }
    } catch (_) {
      if (schol.applicantTotal !== undefined) {
        actualCount = parseInt(schol.applicantTotal, 10) || 0;
      }
    }
  }

  // Applicants display
  if (applicantsEl) {
    if (applicantCountDisplay) {
      applicantsEl.textContent = applicantCountDisplay;
    } else {
      const limit = parseInt(schol.applicantLimit || schol.maxApplicants || 200, 10) || 200;
      applicantsEl.textContent = `${actualCount} / ${limit} Applicants`;
    }
  }

  // Description
  if (descEl) descEl.textContent = schol.desc || "No description provided.";

  // Cover photo banner (Exact match to student browse resolution)
  const bannerSrc = resolveProviderBanner(schol);
  if (coverImg) {
    if (bannerSrc && typeof bannerSrc === "string" && bannerSrc.trim()) {
      coverImg.src = bannerSrc.trim();
      coverImg.style.display = "block";
    } else {
      coverImg.src = "";
      coverImg.style.display = "none";
    }
    coverImg.onerror = function () {
      this.style.display = "none";
      this.src = "";
    };
  }

  // Provider Logo / Avatar
  const logoSrc = resolveProviderLogo(schol);
  if (logoEl) {
    if (logoSrc && typeof logoSrc === "string" && logoSrc.trim()) {
      logoEl.innerHTML = `<img src="${logoSrc.trim()}" alt="Logo" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;">`;
    } else {
      const inits = typeof extractInitials === "function" ? extractInitials(orgName) : "NX";
      logoEl.textContent = inits || "NX";
    }
  }

  // Required Documents Checklist (Matches Student POV)
  if (reqsEl) {
    reqsEl.innerHTML = "";
    const reqs =
      Array.isArray(schol.requirements) && schol.requirements.length > 0
        ? schol.requirements
        : [
            "Certificate of Registration (COR)",
            "Certified True Copy of Grades (COG)",
            "Valid School or Government Issued ID",
          ];
    reqs.forEach((r) => {
      const rName =
        typeof r === "string" ? r : r.name || r.title || "Required Document";
      const rDesc =
        typeof r === "object" && r !== null && r.desc
          ? `<span style="font-size: 12px; color: var(--text-secondary); display: block; margin-top: 2px;">${escapeHtml(r.desc)}</span>`
          : "";
      const rItem = document.createElement("div");
      rItem.className = "details-checklist-item";
      rItem.innerHTML = `
        <span style="font-weight: 650; color: var(--text-primary); font-size: 13.5px;">${escapeHtml(rName)}</span>
        ${rDesc}
      `;
      reqsEl.appendChild(rItem);
    });
  }

  // Manage Applications Button Action: Unusable when no applications
  if (manageBtn) {
    if (actualCount === 0) {
      manageBtn.disabled = true;
      manageBtn.setAttribute("disabled", "true");
      manageBtn.setAttribute("aria-disabled", "true");
      manageBtn.style.opacity = "0.55";
      manageBtn.style.cursor = "not-allowed";
      manageBtn.style.pointerEvents = "auto";
      manageBtn.title = "No students have applied to this scholarship yet";
      manageBtn.innerHTML = `
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
        <span>No Applications Yet</span>
      `;
      manageBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
      };
    } else {
      manageBtn.disabled = false;
      manageBtn.removeAttribute("disabled");
      manageBtn.setAttribute("aria-disabled", "false");
      manageBtn.style.opacity = "1";
      manageBtn.style.cursor = "pointer";
      manageBtn.style.pointerEvents = "auto";
      manageBtn.title = `Manage ${actualCount} application${actualCount > 1 ? "s" : ""}`;
      manageBtn.innerHTML = `
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
        <span>Manage Applications</span>
      `;
      manageBtn.onclick = () => {
        closeProviderDetailsModal();
        const targetId = encodeURIComponent(schol.id || schol.title);
        window.location.href = `provider-posts.html?scholarshipId=${targetId}&postId=${targetId}`;
      };
    }
  }

  // Backdrop click & Escape listener
  modalEl.onclick = (e) => {
    if (e.target === modalEl) closeProviderDetailsModal();
  };
  document.removeEventListener("keydown", handleProviderDetailsEsc);
  document.addEventListener("keydown", handleProviderDetailsEsc);

  // Open Full Screen Sheet
  modalEl.classList.add("active");
  modalEl.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function createCompactCard(schol, allApplications = null) {
  const card = document.createElement("div");
  // The card is clean without cover photo/picture, matching user requirement
  card.className = "directory-card provider-recent-card";
  card.dataset.id = schol.id || "";

  const limitNum =
    parseInt(schol.applicantLimit || schol.maxApplicants || 200, 10) || 200;

  // Dynamically calculate live applicant count against applications
  let count = 0;
  let apps = allApplications;
  if (!Array.isArray(apps)) {
    try {
      apps = JSON.parse(localStorage.getItem("nexo_applications") || "[]");
    } catch (_) {
      apps = [];
    }
  }

  if (Array.isArray(apps) && apps.length > 0) {
    count = apps.filter((a) => {
      if (
        a.scholarshipId &&
        schol.id &&
        String(a.scholarshipId) === String(schol.id)
      )
        return true;
      if (
        schol.title &&
        (a.scholarshipTitle === schol.title || a.title === schol.title)
      )
        return true;
      return false;
    }).length;
  } else if (schol.applicantTotal !== undefined) {
    count = parseInt(schol.applicantTotal, 10) || 0;
  }

  const applicantCountDisplay = `${count} / ${limitNum} Applicants`;
  const typeText = schol.typeText || schol.type || "Scholarship";
  const deadlineText =
    schol.formattedDate ||
    (schol.deadline
      ? new Date(schol.deadline).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "No Deadline");

  card.innerHTML = `
    <div class="directory-card-header" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; width: 100%; position: relative; z-index: 1;">
      <h3 class="directory-card-title" style="margin: 0; font-size: 16px; font-weight: 750; color: var(--text-primary); line-height: 1.35; flex: 1; min-width: 0; overflow-wrap: anywhere; word-break: break-word;">${escapeHtml(schol.title || "Scholarship Program")}</h3>
      <span class="directory-type-pill">${escapeHtml(typeText)}</span>
    </div>

    <p class="directory-card-desc" style="font-size: 13px; line-height: 1.55; color: var(--text-secondary); margin: 6px 0 8px 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; overflow-wrap: anywhere; word-break: break-word; position: relative; z-index: 1;">${escapeHtml(schol.desc || "")}</p>

    <div class="directory-card-meta-row" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin: 2px 0 12px 0; position: relative; z-index: 1;">
      <span class="directory-deadline-tag" style="display: inline-flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 500; color: var(--text-secondary);">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        Expires: ${escapeHtml(deadlineText)}
      </span>
      <span class="directory-applicants-tag" style="display: inline-flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 700; color: #8b5cf6;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
        ${escapeHtml(applicantCountDisplay)}
      </span>
    </div>

    <div class="directory-card-footer" style="margin-top: 0; padding-top: 0; width: 100%; position: relative; z-index: 1;">
      <button type="button" class="directory-view-details-btn view-details-btn" style="width: 100%; display: flex; justify-content: center; align-items: center; gap: 6px; padding: 10px 18px; border-radius: 100px; font-size: 13px; font-weight: 600;">
        View Details
      </button>
    </div>
  `;

  // Attach view details click listener
  const viewDetailsBtn = card.querySelector(".view-details-btn");
  if (viewDetailsBtn) {
    viewDetailsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openScholarshipDetailsModal(schol, applicantCountDisplay, count);
    });
  }

  // Also make entire card clickable
  card.addEventListener("click", () => {
    openScholarshipDetailsModal(schol, applicantCountDisplay, count);
  });

  return card;
}

function createDraftCard(draft) {
  const newDraft = document.createElement("div");
  newDraft.className = "post-card draft-card";
  newDraft.dataset.id = draft.id || "";

  const typeText = draft.typeText || draft.type || "";

  newDraft.innerHTML = `
    <div class="draft-card-header" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
      <span class="draft-badge-pill">Draft</span>
      ${typeText ? `<span class="directory-type-pill" style="font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 99px; background: rgba(139, 92, 246, 0.08); color: #8b5cf6; border: 1px solid rgba(139, 92, 246, 0.2);">${escapeHtml(typeText)}</span>` : ""}
    </div>

    <h3 class="post-title-text" style="font-size: 17px; font-weight: 700; margin: 2px 0 0; color: var(--text-primary); line-height: 1.35; overflow-wrap: anywhere; word-break: break-word;">${escapeHtml(draft.title || "Untitled Scholarship")}</h3>

    <p class="post-desc" style="font-size: 13.5px; line-height: 1.55; color: var(--text-secondary); margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; word-break: break-word;">${escapeHtml(draft.desc || "No description provided yet...")}</p>

    <div class="draft-actions-row" style="display: flex; gap: 10px; align-items: center; margin-top: 4px; width: 100%;">
      <button type="button" class="btn btn-primary continue-edit-btn" style="flex: 1; border-radius: 20px; padding: 10px 18px; font-size: 13.5px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; gap: 8px; margin: 0;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9"></path>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
        </svg>
        <span>Continue Editing</span>
      </button>
      <button type="button" class="delete-draft-btn" data-id="${escapeHtml(draft.id || "")}" aria-label="Delete Draft" title="Delete Draft" style="border-radius: 20px; padding: 10px 18px; font-size: 13.5px; font-weight: 600; border: 1px solid rgba(239, 68, 68, 0.35); background: rgba(239, 68, 68, 0.08); color: #ef4444; display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; transition: all 0.2s ease; margin: 0;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18"></path>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
        <span>Delete</span>
      </button>
    </div>
  `;

  const editBtn = newDraft.querySelector(".continue-edit-btn");
  if (editBtn) {
    editBtn.dataset.id = draft.id || "";
    editBtn.dataset.title = draft.title || "";
    editBtn.dataset.desc = draft.desc || "";
    editBtn.dataset.type = draft.type || "";
    editBtn.dataset.date = draft.date || "";
    editBtn.dataset.limit = draft.applicantLimit || 200;
    if (draft.requirements) {
      editBtn.dataset.requirements = JSON.stringify(draft.requirements);
    }
  }

  return newDraft;
}

function updateStatsUI(total, ongoing, drafts, applicants = 0, pending = 0) {
  totalScholarships = total;
  ongoingScholarships = ongoing;
  draftCount = drafts;

  const statTotal = document.getElementById("stat-total");
  const statOngoing = document.getElementById("stat-ongoing");
  const statApplicants = document.getElementById("stat-applicants");
  const statPending = document.getElementById("stat-pending");
  const draftBadge = document.getElementById("draft-badge");

  if (statTotal) statTotal.textContent = total;
  if (statOngoing) statOngoing.textContent = ongoing;
  if (statApplicants) statApplicants.textContent = applicants;
  if (statPending) statPending.textContent = pending;

  if (draftBadge) {
    draftBadge.textContent = drafts;
    draftBadge.style.display = drafts > 0 ? "inline-block" : "none";
  }
}

// =========================================
// RENDERERS FOR REDESIGNED WORKSPACE PANELS
// =========================================
function renderProviderAttentionTable(myApplications) {
  const tbody = document.getElementById("provider-attention-tbody");
  const badgeEl = document.getElementById("provider-attention-badge");
  if (!tbody) return;

  const attentionApps = (Array.isArray(myApplications) ? myApplications : []).filter((app) => {
    const st = (app.status || "").toLowerCase();
    return st.includes("review") || st.includes("pending") || st.includes("submitted");
  });

  if (badgeEl) {
    badgeEl.textContent = `${attentionApps.length} Pending`;
    badgeEl.style.display = attentionApps.length > 0 ? "inline-flex" : "none";
  }

  tbody.innerHTML = "";

  if (attentionApps.length === 0) {
    const emptyTr = document.createElement("tr");
    emptyTr.innerHTML = `
      <td colspan="5" style="text-align: center; padding: 24px 16px; color: var(--text-secondary); font-size: 13.5px;">
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-secondary); opacity: 0.6;">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span style="font-weight: 600;">All caught up! No applications currently require attention.</span>
        </div>
      </td>
    `;
    tbody.appendChild(emptyTr);
    return;
  }

  attentionApps.slice(0, 5).forEach((app) => {
    const tr = document.createElement("tr");

    const studentName = app.studentName || "Student Applicant";
    const inits = typeof extractInitials === "function" ? extractInitials(studentName) : "ST";
    const course = app.course || "Student";
    const yearLevel = app.yearLevel ? ` • ${app.yearLevel}` : "";
    const scholTitle = app.scholarshipTitle || app.title || "Scholarship Program";
    const dateFormatted = app.formattedDate || (app.submittedAt ? new Date(app.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Recently");
    const statusText = app.statusText || app.status || "Under Review";
    const isSubmitted = statusText.toLowerCase().includes("submitted");
    const dotColor = isSubmitted ? "#3b82f6" : "#f59e0b";
    const badgeClass = isSubmitted ? "badge-status-submitted" : "badge-status-review";
    const reviewHref = `provider-applications.html?appId=${encodeURIComponent(app.id || "")}`;

    tr.innerHTML = `
      <td>
        <div class="attention-applicant-cell">
          <div class="applicant-avatar-mini">${escapeHtml(inits)}</div>
          <div>
            <span class="applicant-name-text">${escapeHtml(studentName)}</span>
            <span class="applicant-course-text">${escapeHtml(course + yearLevel)}</span>
          </div>
        </div>
      </td>
      <td>
        <span class="attention-schol-title" title="${escapeHtml(scholTitle)}">
          ${escapeHtml(scholTitle)}
        </span>
      </td>
      <td style="color: var(--text-secondary); white-space: nowrap;">${escapeHtml(dateFormatted)}</td>
      <td>
        <span class="badge-status-pill ${badgeClass}">
          <span style="width: 6px; height: 6px; border-radius: 50%; background: ${dotColor};"></span>
          ${escapeHtml(statusText)}
        </span>
      </td>
      <td style="text-align: right;">
        <a href="${reviewHref}" class="btn btn-secondary btn-table-review">
          <span>Review</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </a>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderProviderUpcomingDeadlines(myScholarships) {
  const container = document.getElementById("provider-deadlines-list");
  if (!container) return;

  const validSchols = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  (Array.isArray(myScholarships) ? myScholarships : []).forEach((s) => {
    if (!s.deadline) return;
    let d = null;
    if (s.deadline.includes("/")) {
      const parts = s.deadline.split("/");
      if (parts.length === 3) {
        d = new Date(parseInt(parts[2], 10), parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
      }
    } else {
      d = new Date(s.deadline);
    }

    if (d && !isNaN(d.getTime())) {
      validSchols.push({ schol: s, dateObj: d });
    }
  });

  validSchols.sort((a, b) => a.dateObj - b.dateObj);

  container.innerHTML = "";

  if (validSchols.length === 0) {
    container.innerHTML = `
      <div style="padding: 16px; text-align: center; color: var(--text-secondary); font-size: 13px;">
        No active deadlines scheduled.
      </div>
    `;
    return;
  }

  validSchols.slice(0, 3).forEach(({ schol, dateObj }) => {
    const month = dateObj.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
    const day = dateObj.getDate();
    const diffDays = Math.ceil((dateObj - now) / (1000 * 60 * 60 * 24));
    let badgeText = "";
    let badgeStyle = "";

    if (diffDays < 0) {
      badgeText = "Closed";
      badgeStyle = "background: rgba(239, 68, 68, 0.1); color: #dc2626;";
    } else if (diffDays === 0) {
      badgeText = "Closes Today";
      badgeStyle = "background: rgba(239, 68, 68, 0.12); color: #dc2626;";
    } else if (diffDays <= 7) {
      badgeText = `In ${diffDays} Day${diffDays > 1 ? "s" : ""}`;
      badgeStyle = "background: rgba(245, 158, 11, 0.12); color: #d97706;";
    } else {
      badgeText = `In ${diffDays} Days`;
      badgeStyle = "background: rgba(59, 130, 246, 0.1); color: #2563eb;";
    }

    const item = document.createElement("div");
    item.className = "provider-deadline-item";
    item.onclick = () => {
      const targetId = encodeURIComponent(schol.id || schol.title || "");
      window.location.href = `provider-posts.html?scholarshipId=${targetId}&postId=${targetId}`;
    };

    item.innerHTML = `
      <div class="deadline-calendar-badge">
        <span class="deadline-cal-month">${escapeHtml(month)}</span>
        <span class="deadline-cal-day">${escapeHtml(String(day))}</span>
      </div>
      <div class="deadline-text-group">
        <h4 class="deadline-text-title" title="${escapeHtml(schol.title || "")}">${escapeHtml(schol.title || "Program Deadline")}</h4>
        <div class="deadline-sub-row">
          <span>Program Closing Date</span>
          <span class="badge-status-pill" style="${badgeStyle} font-size: 10.5px; padding: 2px 7px;">${escapeHtml(badgeText)}</span>
        </div>
      </div>
    `;
    container.appendChild(item);
  });
}

function renderProviderRecentActivity(myScholarships, myApplications, notifications) {
  const container = document.getElementById("provider-activity-list");
  if (!container) return;

  const events = [];

  // Synthesize from notifications if available
  if (Array.isArray(notifications)) {
    notifications.forEach((n) => {
      if ((n.recipient || "").toLowerCase().includes("provider") || (n.recipientEmail || "").toLowerCase().includes("provider")) {
        events.push({
          type: "notif",
          title: n.title || "Notification",
          desc: n.message || "",
          time: n.timestamp || new Date().toISOString(),
          link: n.link || "provider-applications.html",
        });
      }
    });
  }

  // Synthesize from genuine application events
  (Array.isArray(myApplications) ? myApplications : []).forEach((a) => {
    const st = (a.status || "").toLowerCase();
    if (a.submittedAt) {
      events.push({
        type: "app_submit",
        title: "New application received",
        desc: `${a.studentName || "Student"} applied for ${a.scholarshipTitle || "Scholarship Program"}`,
        time: a.submittedAt,
        link: `provider-applications.html?appId=${encodeURIComponent(a.id || "")}`,
      });
    }
    if (st.includes("review")) {
      events.push({
        type: "app_review",
        title: "Application under evaluation",
        desc: `${a.studentName || "Student"} • ${a.scholarshipTitle || "Scholarship Program"}`,
        time: a.reviewedAt || a.submittedAt || new Date().toISOString(),
        link: `provider-applications.html?appId=${encodeURIComponent(a.id || "")}`,
      });
    }
  });

  // Synthesize from scholarship publishing events
  (Array.isArray(myScholarships) ? myScholarships : []).forEach((s) => {
    const postDate = s.createdAt || s.postedAt;
    events.push({
      type: "schol_publish",
      title: "Scholarship program published",
      desc: `${s.title || "Scholarship"} published to directory`,
      time: postDate || new Date().toISOString(),
      link: `provider-posts.html?scholarshipId=${encodeURIComponent(s.id || s.title || "")}`,
    });
  });

  // De-duplicate similar events and sort newest first
  const seen = new Set();
  const uniqueEvents = [];
  events.forEach((e) => {
    const key = `${e.type}_${e.desc}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueEvents.push(e);
    }
  });

  uniqueEvents.sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));

  container.innerHTML = "";

  if (uniqueEvents.length === 0) {
    container.innerHTML = `
      <div style="padding: 16px; text-align: center; color: var(--text-secondary); font-size: 13px;">
        No recent activity recorded yet.
      </div>
    `;
    return;
  }

  function formatTimeAgo(dateStr) {
    try {
      const diff = Math.floor((new Date() - new Date(dateStr)) / 1000);
      if (diff < 60) return "Just now";
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
      return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch (_) {
      return "Recently";
    }
  }

  uniqueEvents.slice(0, 4).forEach((e) => {
    const row = document.createElement("div");
    row.className = "provider-activity-row";
    if (e.link) {
      row.style.cursor = "pointer";
      row.onclick = () => { window.location.href = e.link; };
    }

    let dotClass = "";
    if (e.type === "app_review") dotClass = "activity-dot-amber";
    else if (e.type === "app_submit") dotClass = "activity-dot-green";

    row.innerHTML = `
      <div class="activity-node-col">
        <span class="activity-dot-pulse ${dotClass}"></span>
      </div>
      <div class="activity-body-wrap">
        <div class="activity-line-top">
          <h5 class="activity-text-title">${escapeHtml(e.title)}</h5>
          <span class="activity-timestamp">${escapeHtml(formatTimeAgo(e.time))}</span>
        </div>
        <p class="activity-text-desc">${escapeHtml(e.desc)}</p>
      </div>
    `;
    container.appendChild(row);
  });
}

function renderProviderScholarshipsFeed(myScholarships, myApplications) {
  const feed = document.getElementById("scholarships-feed");
  const emptyState = document.getElementById("empty-state-card");
  const viewAllBtn = document.getElementById("view-all-btn");
  if (!feed) return;

  const scholSig = JSON.stringify(
    myScholarships.map((s) => ({
      id: s.id,
      title: s.title,
      applicants: s.applicantCount,
      status: s.status,
    }))
  );

  if (typeof window.clearSkeleton === "function") {
    window.clearSkeleton(feed);
  }
  if (window._lastScholSig !== scholSig) {
    window._lastScholSig = scholSig;
    feed.innerHTML = "";

    if (myScholarships.length > 0) {
      if (emptyState) emptyState.style.display = "none";
      myScholarships.slice(0, 3).forEach((schol) => {
        const miniCard = document.createElement("div");
        miniCard.className = "provider-mini-schol-card";
        miniCard.dataset.id = schol.id || "";

        const limitNum = parseInt(schol.applicantLimit || schol.maxApplicants || 200, 10) || 200;
        const liveCount = (Array.isArray(myApplications) ? myApplications : []).filter((a) => {
          if (a.scholarshipId && schol.id && String(a.scholarshipId) === String(schol.id)) return true;
          if (schol.title && (a.scholarshipTitle === schol.title || a.title === schol.title)) return true;
          return false;
        }).length;

        const isClosed = (schol.status || "").toLowerCase().includes("closed");
        const statusText = isClosed ? "Closed" : "Ongoing";
        const statusBg = isClosed ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)";
        const statusColor = isClosed ? "#dc2626" : "#059669";

        const deadlineText = schol.formattedDate || (schol.deadline ? (schol.deadline.includes("/") ? `Closes ${schol.deadline}` : `Closes ${new Date(schol.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`) : "Open Program");
        const typeText = schol.typeText || schol.type || "Scholarship";

        miniCard.innerHTML = `
          <div class="mini-schol-header">
            <div>
              <h4 class="mini-schol-title">${escapeHtml(schol.title || "Scholarship Program")}</h4>
              <p class="mini-schol-meta">${escapeHtml(typeText)} &bull; ${escapeHtml(deadlineText)}</p>
            </div>
            <span class="badge-status-pill" style="background: ${statusBg}; color: ${statusColor};">${escapeHtml(statusText)}</span>
          </div>
          <div class="mini-schol-footer">
            <span class="mini-schol-counts">${liveCount} / ${limitNum} Applicants</span>
            <button type="button" class="mini-schol-manage-btn">
              Manage &rarr;
            </button>
          </div>
        `;

        miniCard.onclick = () => {
          const targetId = encodeURIComponent(schol.id || schol.title || "");
          window.location.href = `provider-posts.html?scholarshipId=${targetId}&postId=${targetId}`;
        };

        const manageBtn = miniCard.querySelector(".mini-schol-manage-btn");
        if (manageBtn) {
          manageBtn.onclick = (e) => {
            e.stopPropagation();
            const targetId = encodeURIComponent(schol.id || schol.title || "");
            window.location.href = `provider-posts.html?scholarshipId=${targetId}&postId=${targetId}`;
          };
        }

        feed.appendChild(miniCard);
      });

      if (viewAllBtn) {
        viewAllBtn.style.display = myScholarships.length > 0 ? "inline-flex" : "none";
      }
    } else {
      if (emptyState) emptyState.style.display = "block";
      if (viewAllBtn) viewAllBtn.style.display = "none";
    }
  }
}

async function loadPersistedData() {
  const feed = document.getElementById("scholarships-feed");
  const draftsFeed = document.getElementById("drafts-feed");
  const emptyState = document.getElementById("empty-state-card");
  const emptyDraftsCard = document.getElementById("empty-drafts-card");

  if (typeof window.renderSkeletonCards === "function") {
    if (window._lastScholSig === undefined && feed && feed.children.length === 0) {
      if (emptyState) emptyState.style.display = "none";
      window.renderSkeletonCards(feed, 2);
    }
    if (window._lastDraftsSig === undefined && draftsFeed && draftsFeed.children.length === 0) {
      if (emptyDraftsCard) emptyDraftsCard.style.display = "none";
      window.renderSkeletonCards(draftsFeed);
    }
  }

  let scholarships = [];
  let drafts = [];
  let applications = [];
  let notifications = [];

  try {
    const res = await fetch(`${API_BASE}/api/data`);
    if (!res.ok) throw new Error("Status " + res.status);
    const data = await res.json();

    scholarships = Array.isArray(data.scholarships) ? data.scholarships : [];
    drafts = Array.isArray(data.drafts) ? data.drafts : [];
    applications = Array.isArray(data.applications) ? data.applications : [];
    notifications = Array.isArray(data.notifications) ? data.notifications : [];

    // Cache local copy for offline/Live Server fallback
    try {
      localStorage.setItem("nexo_scholarships", JSON.stringify(scholarships));
      localStorage.setItem("nexo_drafts", JSON.stringify(drafts));
      localStorage.setItem("nexo_applications", JSON.stringify(applications));
      localStorage.setItem("nexo_notifications", JSON.stringify(notifications));
    } catch (_) {}
  } catch (err) {
    try {
      const dataRes = await fetch("data.json");
      if (dataRes.ok) {
        const localData = await dataRes.json();
        scholarships = Array.isArray(localData.scholarships) ? localData.scholarships : [];
        drafts = Array.isArray(localData.drafts) ? localData.drafts : [];
        applications = Array.isArray(localData.applications) ? localData.applications : [];
        notifications = Array.isArray(localData.notifications) ? localData.notifications : [];
      } else {
        throw new Error("data.json fallback unavailable");
      }
    } catch (_) {
      try {
        const cachedSchols = localStorage.getItem("nexo_scholarships");
        const cachedDrafts = localStorage.getItem("nexo_drafts");
        const cachedApps = localStorage.getItem("nexo_applications");
        const cachedNotifs = localStorage.getItem("nexo_notifications");
        if (cachedSchols) scholarships = JSON.parse(cachedSchols);
        if (cachedDrafts) drafts = JSON.parse(cachedDrafts);
        if (cachedApps) applications = JSON.parse(cachedApps);
        if (cachedNotifs) notifications = JSON.parse(cachedNotifs);
      } catch (_) {}
    }
  }

  const currentProviderEmail = (
    sessionStorage.getItem("nexo-provider-email") ||
    localStorage.getItem("nexo-provider-email") ||
    ""
  ).toLowerCase().trim();

  const currentProviderName = (
    sessionStorage.getItem("nexo-provider-name") ||
    localStorage.getItem("nexo-provider-name") ||
    "NEXO"
  ).toLowerCase().trim();

  const isPrimaryProvider =
    currentProviderEmail === "admin@admin" ||
    currentProviderEmail === "provider@nexo.edu.ph";

  // Filter scholarships and drafts belonging to the authenticated provider
  const myScholarships = scholarships.filter((s) => {
    if (!currentProviderEmail && !currentProviderName) return true;
    const sEmail = (s.providerEmail || "").toLowerCase().trim();
    const sName = (s.providerName || s.organization || "").toLowerCase().trim();
    if (currentProviderEmail && sEmail) return sEmail === currentProviderEmail;
    if (currentProviderName && sName === currentProviderName) return true;
    if (isPrimaryProvider && (!sEmail && (!sName || sName === "nexo"))) return true;
    return false;
  });

  const myDrafts = drafts.filter((d) => {
    const dEmail = (d.providerEmail || "").toLowerCase().trim();
    const dName = (d.providerName || "").toLowerCase().trim();
    if (!currentProviderEmail && !currentProviderName) return true;
    if (currentProviderEmail && dEmail) return dEmail === currentProviderEmail;
    if (!dEmail && currentProviderName && dName === currentProviderName) return true;
    // Only associate unassigned drafts with primary provider admin
    return isPrimaryProvider && !dEmail;
  });

  // Filter applications submitted to this provider's scholarships
  const myApplications = applications.filter((app) => {
    if (!currentProviderEmail && !currentProviderName) return true;
    const appEmail = (app.providerEmail || "").toLowerCase().trim();
    const appProvName = (app.providerName || "").toLowerCase().trim();
    if (currentProviderEmail && appEmail && appEmail === currentProviderEmail) return true;
    if (currentProviderName && appProvName === currentProviderName) return true;

    // Match against scholarshipId or scholarshipTitle
    const matchesSchol = myScholarships.some((s) => {
      if (app.scholarshipId && s.id && String(app.scholarshipId) === String(s.id)) return true;
      if (s.title && (app.scholarshipTitle === s.title || app.title === s.title)) return true;
      return false;
    });
    return matchesSchol;
  });

  // Accurate 4 metrics calculation
  const totalSchols = myScholarships.length;
  const totalApplicants = myApplications.length;
  const pendingReview = myApplications.filter((a) => {
    const st = (a.status || "").toLowerCase();
    return st.includes("review") || st.includes("pending") || st.includes("submitted");
  }).length;
  const ongoingSchols = myScholarships.filter((s) => {
    return (s.status || "Open").toLowerCase() === "open";
  }).length;

  updateStatsUI(
    totalSchols,
    ongoingSchols,
    myDrafts.length,
    totalApplicants,
    pendingReview,
  );

  // Synchronize local cache with accurate live counts
  if (Array.isArray(myScholarships) && Array.isArray(myApplications)) {
    myScholarships.forEach((s) => {
      const liveCount = myApplications.filter(
        (a) =>
          (a.scholarshipId &&
            s.id &&
            String(a.scholarshipId) === String(s.id)) ||
          (s.title && (a.scholarshipTitle === s.title || a.title === s.title)),
      ).length;
      const limit =
        parseInt(s.applicantLimit || s.maxApplicants || 200, 10) || 200;
      s.applicantTotal = liveCount;
      s.applicantLimit = limit;
      s.maxApplicants = limit;
      s.applicantCount = `${liveCount} / ${limit} Applicants`;
    });
  }

  // Render Section 1: Applications Requiring Attention (Clean Table)
  renderProviderAttentionTable(myApplications);

  // Render Section 2: Recent Scholarships (Horizontal Cards)
  renderProviderScholarshipsFeed(myScholarships, myApplications);

  // Render Section 3: Upcoming Deadlines (Compact Calendar List)
  renderProviderUpcomingDeadlines(myScholarships);

  // Render Section 5: Recent Activity (Compact Timeline)
  renderProviderRecentActivity(myScholarships, myApplications, notifications);

  // Populate Drafts Feed (anti-flicker diffing)
  const draftsFeedEl = document.getElementById("drafts-feed");
  const emptyDraftsCardEl = document.getElementById("empty-drafts-card");

  if (draftsFeedEl) {
    if (typeof window.clearSkeleton === "function") {
      window.clearSkeleton(draftsFeedEl);
    }
    const draftsSig = JSON.stringify(
      myDrafts.map((d) => ({
        id: d.id,
        title: d.title,
        desc: d.desc,
        date: d.date,
        type: d.type,
        applicantLimit: d.applicantLimit,
        requirements: d.requirements,
      }))
    );

    if (window._lastDraftsSig !== draftsSig || window._forceDraftsRerender) {
      window._lastDraftsSig = draftsSig;
      window._forceDraftsRerender = false;
      draftsFeedEl.innerHTML = "";
      if (myDrafts.length > 0) {
        if (emptyDraftsCardEl)
          emptyDraftsCardEl.setAttribute("style", "display: none !important;");

        const isDesktop = window.innerWidth >= 1024;
        const maxInitialCards = isDesktop ? 6 : 3;
        const visibleDrafts = isDraftsExpanded ? myDrafts : myDrafts.slice(0, maxInitialCards);

        visibleDrafts.forEach((draft) => {
          draftsFeedEl.appendChild(createDraftCard(draft));
        });

        if (myDrafts.length > maxInitialCards) {
          const toggleContainer = document.createElement("div");
          toggleContainer.className = "drafts-view-all-container";
          toggleContainer.style.cssText =
            "display: flex; justify-content: center; margin-top: 18px; margin-bottom: 8px; width: 100%; grid-column: 1 / -1;";
          toggleContainer.innerHTML = `
            <button type="button" id="btn-toggle-drafts-all" class="btn btn-outline" style="border-radius: 100px; padding: 10px 24px; font-size: 13.5px; font-weight: 700; display: inline-flex; align-items: center; gap: 8px; border: 1.5px solid var(--border-color); background: var(--bg-surface); color: var(--text-primary); cursor: pointer; transition: all 0.2s ease;">
              ${
                isDraftsExpanded
                  ? `<span>Show Less</span>
                     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"></polyline></svg>`
                  : `<span>View All Drafts (${myDrafts.length})</span>
                     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>`
              }
            </button>
          `;
          draftsFeedEl.appendChild(toggleContainer);

          const toggleBtn = toggleContainer.querySelector("#btn-toggle-drafts-all");
          if (toggleBtn) {
            toggleBtn.addEventListener("click", () => {
              isDraftsExpanded = !isDraftsExpanded;
              window._forceDraftsRerender = true;
              loadPersistedData();
              if (!isDraftsExpanded) {
                draftsFeedEl.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            });
          }
        }
      } else {
        if (emptyDraftsCardEl) emptyDraftsCardEl.removeAttribute("style");
      }
    } else if (myDrafts.length === 0 && emptyDraftsCardEl) {
      emptyDraftsCardEl.removeAttribute("style");
    }
  }
}
// =========================================
// 8. PUBLISH AND DRAFT SUBMISSION LOGIC
// =========================================
function initPublishAndDraft() {
  const publishBtn = document.getElementById("publish-btn");
  const draftBtn = document.getElementById("draft-btn");

  // --- PUBLISH BUTTON LOGIC ---
  if (publishBtn) {
    publishBtn.addEventListener("click", function () {
      if (!validateStep3()) return;

      const btn = this;
      const originalText = btn.textContent;
      btn.textContent = "Publishing...";
      btn.disabled = true;
      btn.style.opacity = "0.7";
      btn.style.cursor = "not-allowed";

      setTimeout(async () => {
        const title = DOM.nameInput ? DOM.nameInput.value.trim() : "";
        const desc = DOM.descInput ? DOM.descInput.value.trim() : "";
        const typeSelectedText = DOM.typeSelected
          ? DOM.typeSelected.querySelector("span").textContent
          : "";
        const typeVal = DOM.typeInput ? DOM.typeInput.value : "";
        let formattedDate = "No Deadline";

        if (DOM.dateInput && DOM.dateInput.value) {
          const dateObj = new Date(DOM.dateInput.value);
          formattedDate = dateObj.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
        }

        const collectedRequirements = getCollectedRequirements();
        const draftIdToDelete = currentEditingDraftId;
        const providerEmail = (
          sessionStorage.getItem("nexo-provider-email") ||
          localStorage.getItem("nexo-provider-email") ||
          ""
        ).toLowerCase().trim();
        const providerName =
          sessionStorage.getItem("nexo-provider-name") ||
          localStorage.getItem("nexo-provider-name") ||
          "NEXO";
        const providerLogo = localStorage.getItem("nexo-provider-logo") || "";
        const providerBanner =
          localStorage.getItem("nexo-provider-banner") ||
          "";
        const applicantLimit =
          DOM.limitInput && DOM.limitInput.value
            ? parseInt(DOM.limitInput.value, 10)
            : 200;
        const now = new Date();
        const formattedPostedDate = now.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });

        const payload = {
          title,
          desc,
          type: typeVal,
          typeText: typeSelectedText,
          deadline: DOM.dateInput ? DOM.dateInput.value : "",
          formattedDate,
          postedAt: now.toISOString(),
          formattedPostedDate,
          applicantLimit,
          maxApplicants: applicantLimit,
          applicantTotal: 0,
          applicantCount: `0 / ${applicantLimit} Applicants`,
          requirements: collectedRequirements,
          providerName,
          providerEmail,
          providerLogo,
          providerBanner,
          status: "Open",
          draftId: draftIdToDelete,
        };

        let newSchol = { id: "schol_" + Date.now(), ...payload };

        try {
          const res = await fetch(`${API_BASE}/api/scholarships`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            newSchol = await res.json();
          }
        } catch (e) {
          console.warn("Could not save to data.json directly via server:", e);
        }

        // Keep local cache in sync
        try {
          const cached = JSON.parse(
            localStorage.getItem("nexo_scholarships") || "[]",
          );
          cached.unshift(newSchol);
          localStorage.setItem("nexo_scholarships", JSON.stringify(cached));
          if (draftIdToDelete) {
            const cachedDrafts = JSON.parse(
              localStorage.getItem("nexo_drafts") || "[]",
            );
            const filteredDrafts = cachedDrafts.filter(
              (d) => String(d.id) !== String(draftIdToDelete),
            );
            localStorage.setItem("nexo_drafts", JSON.stringify(filteredDrafts));
          }
        } catch (_) {}

        // Dispatch live student notification for offline/local resilience
        try {
          const cachedNotifs = JSON.parse(
            localStorage.getItem("nexo_notifications") || "[]",
          );
          const limitDisplay =
            newSchol.applicantLimit || newSchol.maxApplicants || 200;
          cachedNotifs.unshift({
            id: "notif_" + Date.now(),
            recipient: "student",
            title: "New Scholarship Available",
            message: `"${newSchol.title}" is now open for applications. Capacity: ${limitDisplay} slots.`,
            timestamp: new Date().toISOString(),
            formattedTime: "Just now",
            read: false,
            link: "student-browse.html",
            scholId: newSchol.id,
          });
          localStorage.setItem(
            "nexo_notifications",
            JSON.stringify(cachedNotifs),
          );

          window.dispatchEvent(new CustomEvent("nexo:notification"));
        } catch (_) {}

        // If we just published a draft, remove the old draft from UI
        if (currentEditingDraftCard) {
          currentEditingDraftCard.remove();
          draftCount = Math.max(0, draftCount - 1);
          const draftBadge = document.getElementById("draft-badge");
          if (draftBadge) {
            draftBadge.textContent = draftCount;
            if (draftCount <= 0) {
              draftBadge.style.display = "none";
              const emptyDraftsCard =
                document.getElementById("empty-drafts-card");
              if (emptyDraftsCard) emptyDraftsCard.removeAttribute("style");
            }
          }
          currentEditingDraftCard = null;
          currentEditingDraftId = null;
          window.dispatchEvent(new Event("nexo_drafts_updated"));
        }

        // Hide main home feed empty state
        const emptyState = document.getElementById("empty-state-card");
        if (emptyState) emptyState.style.display = "none";

        totalScholarships++;
        ongoingScholarships++;
        const statTotal = document.getElementById("stat-total");
        const statOngoing = document.getElementById("stat-ongoing");
        if (statTotal) statTotal.textContent = totalScholarships;
        if (statOngoing) statOngoing.textContent = ongoingScholarships;

        const feed = document.getElementById("scholarships-feed");
        const allFeed = document.getElementById("all-scholarships-feed");

        if (feed) {
          feed.prepend(createCompactCard(newSchol));
          if (allFeed) allFeed.prepend(createCompactCard(newSchol));

          while (feed.children.length > 3) {
            feed.removeChild(feed.lastChild);
          }

          const viewAllBtn = document.getElementById("view-all-btn");
          if (viewAllBtn && ongoingScholarships > 3) {
            viewAllBtn.style.display = "inline-block";
          }
        }

        if (DOM.creationModal) {
          DOM.creationModal.classList.remove("active");
          DOM.creationModal.setAttribute("aria-hidden", "true");
        }
        document.body.style.overflow = "auto";

        setTimeout(() => {
          goToStep(1, false);
          const step1Form = document.getElementById("step-1-form");
          if (step1Form) step1Form.reset();

          const dropdownHidden = document.getElementById("schol-type");
          if (DOM.typeSelected && dropdownHidden) {
            DOM.typeSelected.querySelector("span").textContent = "Select type";
            DOM.typeSelected.classList.remove("has-value");
            dropdownHidden.value = "";
          }

          if (DOM.confirmCheck) DOM.confirmCheck.checked = false;

          btn.textContent = originalText;
          btn.disabled = false;
          btn.style.opacity = "1";
          btn.style.cursor = "pointer";
        }, 400);
      }, 1000);
    });
  }

  // --- SAVE AS DRAFT BUTTON LOGIC ---
  if (draftBtn) {
    draftBtn.addEventListener("click", function () {
      const btn = this;
      const originalText = btn.textContent;
      btn.textContent = "Saving...";
      btn.disabled = true;
      btn.style.opacity = "0.7";

      setTimeout(async () => {
        try {
          const titleInput = DOM.nameInput ? DOM.nameInput.value.trim() : "";
          const descInput = DOM.descInput ? DOM.descInput.value.trim() : "";
          const draftTitle = titleInput || "Untitled Scholarship";
          const draftDesc = descInput || "No description provided yet...";
          const typeVal = DOM.typeInput ? DOM.typeInput.value : "";
          const typeSelectedText =
            DOM.typeSelected && DOM.typeSelected.classList.contains("has-value")
              ? DOM.typeSelected.querySelector("span").textContent
              : "";
          const dateVal = DOM.dateInput ? DOM.dateInput.value : "";
          const collectedRequirements = getCollectedRequirements();

          const providerEmail = (
            sessionStorage.getItem("nexo-provider-email") ||
            localStorage.getItem("nexo-provider-email") ||
            ""
          ).toLowerCase().trim();
          const providerName =
            sessionStorage.getItem("nexo-provider-name") ||
            localStorage.getItem("nexo-provider-name") ||
            "NEXO";

          const draftPayload = {
            id: currentEditingDraftId || "draft_" + Date.now(),
            title: draftTitle,
            desc: draftDesc,
            type: typeVal,
            typeText: typeSelectedText,
            date: dateVal,
            providerEmail,
            providerName,
            applicantLimit: DOM.limitInput
              ? parseInt(DOM.limitInput.value, 10) || 200
              : 200,
            requirements: collectedRequirements,
          };

          let savedDraft = draftPayload;

          try {
            const res = await fetch(`${API_BASE}/api/drafts`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(draftPayload),
            });
            if (res.ok) {
              savedDraft = await res.json();
            }
          } catch (e) {
            console.warn(
              "Could not save draft to data.json directly via server:",
              e,
            );
          }

          // Keep local cache in sync
          try {
            const cachedDrafts = JSON.parse(
              localStorage.getItem("nexo_drafts") || "[]",
            );
            const idx = cachedDrafts.findIndex(
              (d) => String(d.id) === String(savedDraft.id),
            );
            if (idx >= 0) cachedDrafts[idx] = savedDraft;
            else cachedDrafts.unshift(savedDraft);
            localStorage.setItem("nexo_drafts", JSON.stringify(cachedDrafts));
          } catch (_) {}

          currentEditingDraftCard = null;
          currentEditingDraftId = null;

          window._forceDraftsRerender = true;
          await loadPersistedData();
          window.dispatchEvent(new Event("nexo_drafts_updated"));

          // Close modal and reset
          if (DOM.creationModal) {
            DOM.creationModal.classList.remove("active");
            DOM.creationModal.setAttribute("aria-hidden", "true");
          }
          document.body.style.overflow = "auto";
        } finally {
          setTimeout(() => {
            goToStep(1, false);
            const step1Form = document.getElementById("step-1-form");
            if (step1Form) step1Form.reset();

            btn.textContent = "Save as Draft";
            btn.disabled = false;
            btn.style.opacity = "1";
          }, 300);
        }
      }, 400);
    });
  }
}

// =========================================
// 8. MODAL CANCELLATION & WARNING LOGIC
// =========================================
function initModalCancellation() {
  const cancelConfirmModal = document.getElementById("cancel-confirm-modal");
  const stayEditingBtn = document.getElementById("stay-editing-btn");
  const confirmDiscardBtn = document.getElementById("confirm-discard-btn");
  const step1CancelBtn = document.getElementById("cancel-creation-btn-1");
  const creationModal = document.getElementById("create-scholarship-modal");
  // Only target close buttons strictly inside create-scholarship-modal
  const xCloseBtns = creationModal
    ? creationModal.querySelectorAll(".close-modal-btn, .close-btn")
    : [];

  function hasCreationProgress() {
    if (currentEditingDraftCard || currentEditingDraftId) return true;
    if (typeof maxStepReached === "number" && maxStepReached > 1) return true;

    // Check step 1 inputs
    const nameVal = DOM.nameInput ? DOM.nameInput.value.trim() : "";
    const descVal = DOM.descInput ? DOM.descInput.value.trim() : "";
    const typeVal = DOM.typeInput ? DOM.typeInput.value.trim() : "";
    const dateVal = DOM.dateInput ? DOM.dateInput.value.trim() : "";
    const limitVal = DOM.limitInput ? DOM.limitInput.value.trim() : "";

    if (nameVal.length > 0) return true;
    if (descVal.length > 0) return true;
    if (typeVal.length > 0) return true;
    if (dateVal.length > 0) return true;
    if (limitVal.length > 0 && limitVal !== "200") return true;

    return false;
  }

  function dismissCreationModalImmediately() {
    currentEditingDraftCard = null;
    currentEditingDraftId = null;
    maxStepReached = 1;

    if (DOM.creationModal) {
      DOM.creationModal.classList.remove("active");
      DOM.creationModal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "auto";
    }

    setTimeout(() => {
      goToStep(1, false);
      const step1Form = document.getElementById("step-1-form");
      if (step1Form) step1Form.reset();

      const dropdownHidden = document.getElementById("schol-type");
      if (DOM.typeSelected && dropdownHidden) {
        DOM.typeSelected.querySelector("span").textContent = "Select type";
        DOM.typeSelected.classList.remove("has-value");
        dropdownHidden.value = "";
      }

      if (DOM.limitInput) {
        DOM.limitInput.value = "200";
      }

      if (DOM.confirmCheck) DOM.confirmCheck.checked = false;

      if (DOM.creationModal) {
        const errorMsgs = DOM.creationModal.querySelectorAll(".error-msg");
        errorMsgs.forEach((msg) => (msg.textContent = ""));
      }
    }, 200);
  }

  function triggerCancelWarning() {
    if (cancelConfirmModal) {
      cancelConfirmModal.style.display = "flex";
      setTimeout(() => (cancelConfirmModal.style.opacity = "1"), 10);
    }
  }

  function handleCreationCancelAttempt() {
    if (hasCreationProgress()) {
      triggerCancelWarning();
    } else {
      dismissCreationModalImmediately();
    }
  }

  if (step1CancelBtn) {
    step1CancelBtn.addEventListener("click", handleCreationCancelAttempt);
  }

  xCloseBtns.forEach((btn) => {
    btn.addEventListener("click", handleCreationCancelAttempt);
  });

  if (creationModal) {
    creationModal.addEventListener("click", (e) => {
      if (e.target === creationModal) {
        handleCreationCancelAttempt();
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (
      e.key === "Escape" &&
      DOM.creationModal &&
      DOM.creationModal.classList.contains("active")
    ) {
      if (cancelConfirmModal && cancelConfirmModal.style.display === "flex") {
        cancelConfirmModal.style.opacity = "0";
        setTimeout(() => (cancelConfirmModal.style.display = "none"), 200);
      } else {
        handleCreationCancelAttempt();
      }
    }
  });

  if (stayEditingBtn) {
    stayEditingBtn.addEventListener("click", () => {
      cancelConfirmModal.style.opacity = "0";
      setTimeout(() => (cancelConfirmModal.style.display = "none"), 200);
    });
  }

  if (confirmDiscardBtn) {
    confirmDiscardBtn.addEventListener("click", () => {
      if (cancelConfirmModal) {
        cancelConfirmModal.style.opacity = "0";
        setTimeout(() => (cancelConfirmModal.style.display = "none"), 200);
      }
      dismissCreationModalImmediately();
    });
  }
}

// =========================================
// REAL-TIME PROVIDER PROFILE & BRANDING SYNC
// =========================================
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

async function initDynamicAvatar() {
  await syncProviderProfile();

  // Real-time synchronization across browser tabs/storage
  window.addEventListener("storage", (e) => {
    if (e.key === "nexo_provider_settings" && e.newValue) {
      try {
        syncProviderProfile(JSON.parse(e.newValue));
      } catch (_) {}
    } else if (
      e.key === "nexo-provider-name" ||
      e.key === "nexo-provider-logo"
    ) {
      syncProviderProfile();
    }
  });

  // Re-sync on page navigation / back button
  window.addEventListener("pageshow", () => {
    syncProviderProfile();
  });
}

async function syncProviderProfile(incomingSettings = null) {
  let settings = incomingSettings;
  const currentProvEmail = (
    sessionStorage.getItem("nexo-provider-email") ||
    localStorage.getItem("nexo-provider-email") ||
    ""
  ).toLowerCase().trim();

  if (!settings) {
    try {
      const cached =
        (currentProvEmail && localStorage.getItem(`nexo_provider_settings_${currentProvEmail}`)) ||
        localStorage.getItem("nexo_provider_settings");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (
          !parsed.email ||
          !currentProvEmail ||
          String(parsed.email).toLowerCase().trim() === currentProvEmail
        ) {
          settings = parsed;
        }
      }
    } catch (_) {}
  }

  if (!settings) {
    try {
      const endpoint = currentProvEmail
        ? `${API_BASE}/api/settings?email=${encodeURIComponent(currentProvEmail)}`
        : `${API_BASE}/api/settings`;
      const res = await fetch(endpoint);
      if (res.ok) {
        settings = await res.json();
        try {
          if (currentProvEmail) {
            localStorage.setItem(
              `nexo_provider_settings_${currentProvEmail}`,
              JSON.stringify(settings),
            );
          }
          localStorage.setItem(
            "nexo_provider_settings",
            JSON.stringify(settings),
          );
        } catch (_) {}
      } else {
        throw new Error("Settings fetch failed");
      }
    } catch (_) {
      try {
        const dataRes = await fetch("data.json");
        if (dataRes.ok) {
          const rawData = await dataRes.json();
          if (currentProvEmail && rawData && rawData.providerProfiles && rawData.providerProfiles[currentProvEmail]) {
            settings = rawData.providerProfiles[currentProvEmail];
          } else if (
            rawData &&
            rawData.settings &&
            (!currentProvEmail ||
              currentProvEmail === "admin@admin" ||
              currentProvEmail === "provider@nexo.edu.ph")
          ) {
            settings = rawData.settings;
          }
          if (settings) {
            try {
              localStorage.setItem("nexo_provider_settings", JSON.stringify(settings));
            } catch (_) {}
          }
        }
      } catch (_) {}
    }
  }

  window._activeProviderSettings = settings;

  const orgName =
    (settings && settings.orgName) ||
    sessionStorage.getItem("nexo-provider-name") ||
    localStorage.getItem("nexo-provider-name") ||
    "NEXO";
  const logoImage =
    (settings && settings.logoImage !== undefined ? settings.logoImage : localStorage.getItem("nexo-provider-logo")) ||
    "";
  const bannerImage =
    (settings && settings.bannerImage !== undefined ? settings.bannerImage : localStorage.getItem("nexo-provider-banner")) ||
    "";
  const initials = extractInitials(orgName);

  // 1. Update Welcome Title
  const welcomeTitle =
    document.getElementById("dash-welcome-title") ||
    document.querySelector(".welcome-title");
  if (welcomeTitle) {
    welcomeTitle.textContent = orgName;
  }

  // 2. Update Header Avatar Circle
  const headerAvatar = document.querySelector(".logo-container .avatar-btn");
  if (headerAvatar) {
    if (logoImage) {
      headerAvatar.innerHTML = `<img src="${logoImage}" alt="Logo">`;
      headerAvatar.classList.add("has-img");
    } else {
      headerAvatar.textContent = initials;
      headerAvatar.classList.remove("has-img");
    }
  }

  // 3. Update Welcome Section Avatar
  const welcomeAvatarWrapper = document.getElementById(
    "welcome-avatar-wrapper",
  );
  const welcomeAvatarImg = document.getElementById("welcome-avatar-img");
  const welcomeAvatarInits = document.getElementById("welcome-avatar-initials");
  if (welcomeAvatarImg && welcomeAvatarInits) {
    if (logoImage) {
      welcomeAvatarImg.src = logoImage;
      welcomeAvatarImg.classList.add("has-img");
      if (welcomeAvatarWrapper) welcomeAvatarWrapper.classList.add("has-img");
      welcomeAvatarInits.style.display = "none";
    } else {
      welcomeAvatarImg.src = "";
      welcomeAvatarImg.classList.remove("has-img");
      if (welcomeAvatarWrapper)
        welcomeAvatarWrapper.classList.remove("has-img");
      welcomeAvatarInits.textContent = initials;
      welcomeAvatarInits.style.display = "block";
    }
  }

  // 4. Update Cover Photo Banner with Soft Bottom Fade
  const coverBanner = document.getElementById("dash-cover-banner");
  const coverPhoto = document.getElementById("dash-cover-photo");
  if (coverBanner && coverPhoto) {
    if (bannerImage) {
      coverPhoto.src = bannerImage;
      coverPhoto.classList.add("has-img");
      coverBanner.classList.add("active");
    } else {
      coverPhoto.src = "";
      coverPhoto.classList.remove("has-img");
      coverBanner.classList.remove("active");
    }
  }
}

// =========================================
// 9. CONTINUE EDITING & DELETE DRAFTS LOGIC
// =========================================
function initDraftEditing() {
  const draftsFeed = document.getElementById("drafts-feed");
  if (!draftsFeed) return;

  let pendingDeleteDraftCard = null;
  let pendingDeleteDraftId = null;

  const deleteDraftModal = document.getElementById("delete-draft-confirm-modal");
  const cancelDeleteBtn = document.getElementById("cancel-delete-draft-btn");
  const confirmDeleteBtn = document.getElementById("confirm-delete-draft-btn");

  function closeDeleteDraftModal() {
    if (deleteDraftModal) deleteDraftModal.classList.remove("active");
    pendingDeleteDraftCard = null;
    pendingDeleteDraftId = null;
  }

  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener("click", (e) => {
      e.preventDefault();
      closeDeleteDraftModal();
    });
  }

  if (deleteDraftModal) {
    deleteDraftModal.addEventListener("click", (e) => {
      if (e.target === deleteDraftModal) {
        closeDeleteDraftModal();
      }
    });
  }

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      const draftId = pendingDeleteDraftId;
      const card = pendingDeleteDraftCard;
      closeDeleteDraftModal();

      if (draftId) {
        try {
          await fetch(`${API_BASE}/api/drafts/${draftId}`, {
            method: "DELETE",
          });
        } catch (err) {
          console.error(err);
        }
        try {
          const cachedDrafts = JSON.parse(
            localStorage.getItem("nexo_drafts") || "[]",
          );
          const filtered = cachedDrafts.filter(
            (d) => String(d.id) !== String(draftId),
          );
          localStorage.setItem("nexo_drafts", JSON.stringify(filtered));
          window.dispatchEvent(new Event("nexo_drafts_updated"));
        } catch (_) {}
      }

      if (card) {
        card.style.transition = "opacity 0.25s ease, transform 0.25s ease";
        card.style.opacity = "0";
        card.style.transform = "scale(0.95)";
      }

      setTimeout(async () => {
        window._forceDraftsRerender = true;
        await loadPersistedData();
        window.dispatchEvent(new Event("nexo_drafts_updated"));
      }, 260);
    });
  }

  draftsFeed.addEventListener("click", (e) => {
    // --- 1. HANDLE "CONTINUE EDITING" ---
    const continueBtn = e.target.closest(".continue-edit-btn");
    if (continueBtn) {
      currentEditingDraftCard = continueBtn.closest(".draft-card");
      currentEditingDraftId =
        continueBtn.dataset.id ||
        (currentEditingDraftCard ? currentEditingDraftCard.dataset.id : null);

      const draftBtn = document.getElementById("draft-btn");
      if (draftBtn) draftBtn.textContent = "Update Draft";

      // Populate form fields with saved data
      if (DOM.nameInput) DOM.nameInput.value = continueBtn.dataset.title || "";
      if (DOM.descInput) DOM.descInput.value = continueBtn.dataset.desc || "";
      if (DOM.dateInput) DOM.dateInput.value = continueBtn.dataset.date || "";
      if (DOM.limitInput)
        DOM.limitInput.value = continueBtn.dataset.limit || 200;

      // Update custom dropdown UI
      if (DOM.typeInput && DOM.typeSelected) {
        DOM.typeInput.value = continueBtn.dataset.type || "";
        const typeSpan = DOM.typeSelected.querySelector("span");

        if (continueBtn.dataset.type) {
          const option = document.querySelector(
            `#schol-type-options li[data-value="${continueBtn.dataset.type}"]`,
          );
          if (option) {
            typeSpan.textContent = option.textContent;
            DOM.typeSelected.classList.add("has-value");
          }
        } else {
          typeSpan.textContent = "Select type";
          DOM.typeSelected.classList.remove("has-value");
        }
      }

      // Restore custom requirements if present
      if (continueBtn.dataset.requirements && DOM.reqList) {
        try {
          const reqs = JSON.parse(continueBtn.dataset.requirements);
          if (Array.isArray(reqs) && reqs.length > 0) {
            DOM.reqList.innerHTML = "";
            reqs.forEach((r) => {
              const card = document.createElement("div");
              card.className = "req-card";
              card.innerHTML = `
                <div class="req-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                  </svg>
                </div>
                <div class="req-text">
                  <h4>${escapeHtml(r.title)}</h4>
                  <p>${escapeHtml(r.desc)}</p>
                </div>
                <button type="button" class="remove-req-btn" aria-label="Remove">&times;</button>
              `;
              DOM.reqList.appendChild(card);
            });
          }
        } catch (err) {}
      }

      // Open Modal to Step 1
      if (DOM.creationModal) {
        DOM.creationModal.classList.add("active");
        DOM.creationModal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        goToStep(1, false);
      }
    }

    // --- 2. HANDLE "DELETE DRAFT" (WITH CONFIRMATION MODAL) ---
    const deleteBtn = e.target.closest(".delete-draft-btn");
    if (deleteBtn) {
      e.preventDefault();
      e.stopPropagation();
      const card = deleteBtn.closest(".draft-card");
      if (card) {
        const editBtn = card.querySelector(".continue-edit-btn");
        pendingDeleteDraftId =
          (editBtn && editBtn.dataset.id) ||
          card.dataset.id ||
          deleteBtn.dataset.id;
        pendingDeleteDraftCard = card;

        if (deleteDraftModal) {
          deleteDraftModal.classList.add("active");
        } else if (
          confirm("Are you sure you want to delete this scholarship draft?")
        ) {
          if (confirmDeleteBtn) confirmDeleteBtn.click();
        }
      }
    }
  });
}

// ==========================================
// DASHBOARD MASTER STARTUP LOGIC
// ==========================================
function initDashboardStartup() {
  // ----------------------------------------
  // 1. URL PARAMETER NAVIGATION (AUTO-OPEN DRAFTS)
  // ----------------------------------------
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("view") === "drafts") {
    if (typeof window.showDraftsView === "function") {
      window.showDraftsView();
    } else {
      setTimeout(() => {
        if (typeof window.showDraftsView === "function") {
          window.showDraftsView();
        }
      }, 50);
    }
  }

  // ----------------------------------------
  // 2. SMART DATE INPUT MASK & VALIDATION
  // ----------------------------------------
  const dateInput = document.getElementById("schol-deadline");
  const dateError = document.getElementById("error-schol-deadline");

  if (dateInput) {
    // Real-time typing formatter
    dateInput.addEventListener("input", function (e) {
      let cleaned = e.target.value.replace(/\D/g, "");

      let month = cleaned.substring(0, 2);
      let day = cleaned.substring(2, 4);
      let year = cleaned.substring(4, 8);

      if (month.length === 2) {
        if (parseInt(month) > 12) month = "12";
        if (month === "00") month = "01";
      }
      if (month.length === 1 && parseInt(month) > 1) month = "0" + month;

      if (day.length === 2) {
        if (parseInt(day) > 31) day = "31";
        if (day === "00") day = "01";
      }
      if (day.length === 1 && parseInt(day) > 3) day = "0" + day;

      let formatted = month;
      if (cleaned.length >= 3) formatted += "/" + day;
      if (cleaned.length >= 5) formatted += "/" + year;

      e.target.value = formatted;
      if (dateError) dateError.textContent = "";
    });

    // Final check on blur (tap away)
    dateInput.addEventListener("blur", function (e) {
      let val = e.target.value;
      if (val.length > 0 && val.length < 10) {
        if (dateError)
          dateError.textContent = "Please enter a complete date (MM/DD/YYYY).";
      } else if (val.length === 10) {
        let year = parseInt(val.substring(6, 10));
        let currentYear = new Date().getFullYear();
        if (year < currentYear) {
          if (dateError)
            dateError.textContent = "The deadline year cannot be in the past.";
        }
      }
    });
  }

  // ----------------------------------------
  // 3. CALENDAR ICON SYNC LOGIC
  // ----------------------------------------
  const nativeDatePicker = document.getElementById("native-date-picker");

  // We reuse the 'dateInput' and 'dateError' variables we already found in step 2!
  if (nativeDatePicker && dateInput) {
    nativeDatePicker.addEventListener("change", function (e) {
      const selectedDate = e.target.value;

      if (selectedDate) {
        const parts = selectedDate.split("-");
        const formatted = `${parts[1]}/${parts[2]}/${parts[0]}`;

        dateInput.value = formatted;
        if (dateError) dateError.textContent = "";
      }
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDashboardStartup);
} else {
  initDashboardStartup();
}
