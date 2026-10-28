// =========================================
// 0. INSTANT DARK MODE CHECK
// =========================================
if (localStorage.getItem("nexo-theme") === "dark") {
  document.body.classList.add("dark-theme");
}

// =========================================
// CACHED DOM ELEMENTS & STATE
// =========================================
const DOM = {};
let selectedProofFile = null;

// =========================================
// MASTER INITIALIZATION
// =========================================
document.addEventListener("DOMContentLoaded", () => {
  cacheDOM();
  prefillData();
  initPhoneValidation();
  initDropdown();
  initFileUpload();
  initFormValidation();
});

function cacheDOM() {
  DOM.orgNameInput = document.getElementById("org-name");
  DOM.orgEmailInput = document.getElementById("org-email");
  DOM.orgPhoneInput = document.getElementById("org-phone");
  DOM.notificationEl = document.getElementById("setup-notification");
  DOM.dropdown = document.getElementById("provider-type-dropdown");
  DOM.dropdownTrigger = document.getElementById("dropdown-trigger");
  DOM.dropdownSelectedText = document.getElementById("dropdown-selected-text");
  DOM.dropdownItems = document.querySelectorAll(".org-dropdown-item");
  DOM.orgTypeHiddenInput = document.getElementById("org-type");
  DOM.uploadBox = document.getElementById("org-upload-box");
  DOM.fileInput = document.getElementById("org-proof-file");
  DOM.uploadStatusText = document.getElementById("upload-status-text");
  DOM.providerSetupForm = document.getElementById("provider-setup-form");
  DOM.providerStepForm = document.getElementById("provider-step-form");
  DOM.providerStepSubmitted = document.getElementById(
    "provider-step-submitted",
  );
  DOM.topBar = document.querySelector(".verify-top-bar");
}

// =========================================
// 1. PRE-FILL DATA & PREVENT LEAKS
// =========================================
function prefillData() {
  const pendingName = sessionStorage.getItem("nexo-pending-name");
  if (DOM.orgNameInput && pendingName) {
    DOM.orgNameInput.value = pendingName;
    sessionStorage.removeItem("nexo-pending-name"); // Wipe memory to prevent data leaks
  }

  const pendingEmail = sessionStorage.getItem("nexo-pending-email");
  if (DOM.orgEmailInput && pendingEmail) {
    DOM.orgEmailInput.value = pendingEmail;
    sessionStorage.removeItem("nexo-pending-email"); // Wipe memory to prevent data leaks
  }
}

// =========================================
// 2. STRICT NUMBERS-ONLY FOR CONTACT
// =========================================
function initPhoneValidation() {
  if (DOM.orgPhoneInput) {
    DOM.orgPhoneInput.addEventListener("input", (e) => {
      // Allow only digits (0-9), plus sign (+), and spaces
      e.target.value = e.target.value.replace(/[^0-9+\s]/g, "");
    });
  }
}

// =========================================
// 3. ON-SCREEN NOTIFICATION HELPER
// =========================================
function showNotification(message = "", type = "error") {
  if (!DOM.notificationEl) return;
  DOM.notificationEl.textContent = message;
  DOM.notificationEl.className = `verify-notification ${type} show`;

  window.scrollTo({ top: 0, behavior: "smooth" });

  if (type === "error") {
    setTimeout(() => {
      if (DOM.notificationEl.classList.contains("error")) {
        DOM.notificationEl.classList.remove("show");
      }
    }, 4500);
  }
}

// =========================================
// 4. CUSTOM PROVIDER TYPE DROPDOWN
// =========================================
function initDropdown() {
  if (DOM.dropdown && DOM.dropdownTrigger) {
    DOM.dropdownTrigger.addEventListener("click", () => {
      DOM.dropdown.classList.toggle("open");
    });

    DOM.dropdownItems.forEach((item) => {
      item.addEventListener("click", () => {
        const value = item.getAttribute("data-value") || "";
        if (DOM.orgTypeHiddenInput) DOM.orgTypeHiddenInput.value = value;

        if (DOM.dropdownSelectedText) {
          DOM.dropdownSelectedText.textContent = value;
          DOM.dropdownSelectedText.classList.remove("placeholder");
        }

        DOM.dropdownItems.forEach((i) => i.classList.remove("selected"));
        item.classList.add("selected");

        DOM.dropdownTrigger.classList.remove("input-error");
        DOM.dropdown.classList.remove("open");
      });
    });

    document.addEventListener("click", (e) => {
      if (e.target instanceof Node && !DOM.dropdown.contains(e.target)) {
        DOM.dropdown.classList.remove("open");
      }
    });
  }
}

// =========================================
// 5. FILE UPLOAD (CLICK & DRAG-AND-DROP)
// =========================================
function handleFileSelection(file) {
  const fileName = file.name.toLowerCase();
  const isValidExt =
    fileName.endsWith(".pdf") ||
    fileName.endsWith(".png") ||
    fileName.endsWith(".jpg") ||
    fileName.endsWith(".jpeg");
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!isValidExt) {
    showNotification(
      "Invalid file format. Please upload a PDF, PNG, or JPG file.",
      "error",
    );
    return;
  }

  if (file.size > maxSize) {
    showNotification(
      "File is too large. Maximum allowed size is 10MB.",
      "error",
    );
    return;
  }

  selectedProofFile = file;
  if (DOM.uploadBox) DOM.uploadBox.classList.remove("input-error");
  if (DOM.uploadStatusText) {
    DOM.uploadStatusText.textContent = `Selected: ${file.name}`;
  }
}

function initFileUpload() {
  if (DOM.uploadBox && DOM.fileInput) {
    DOM.fileInput.addEventListener("change", () => {
      if (DOM.fileInput.files && DOM.fileInput.files[0]) {
        handleFileSelection(DOM.fileInput.files[0]);
      }
    });

    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      DOM.uploadBox.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      DOM.uploadBox.addEventListener(eventName, () =>
        DOM.uploadBox.classList.add("dragover"),
      );
    });

    ["dragleave", "drop"].forEach((eventName) => {
      DOM.uploadBox.addEventListener(eventName, () =>
        DOM.uploadBox.classList.remove("dragover"),
      );
    });

    DOM.uploadBox.addEventListener("drop", (e) => {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelection(e.dataTransfer.files[0]);
      }
    });
  }
}

// =========================================
// 6. FORM VALIDATION & SUBMISSION
// =========================================
function initFormValidation() {
  if (DOM.providerSetupForm) {
    DOM.providerSetupForm.addEventListener("submit", (e) => {
      e.preventDefault();
      let isValid = true;

      const requiredIds = [
        "org-name",
        "org-contact-person",
        "org-email",
        "org-phone",
        "org-address",
      ];

      requiredIds.forEach((id) => {
        const inputEl = document.getElementById(id);
        if (inputEl) {
          if (!inputEl.value.trim()) {
            inputEl.classList.add("input-error");
            isValid = false;
          } else {
            inputEl.classList.remove("input-error");
          }

          inputEl.addEventListener(
            "input",
            () => inputEl.classList.remove("input-error"),
            { once: true },
          );
        }
      });

      if (!DOM.orgTypeHiddenInput || !DOM.orgTypeHiddenInput.value) {
        if (DOM.dropdownTrigger)
          DOM.dropdownTrigger.classList.add("input-error");
        isValid = false;
      }

      if (!selectedProofFile) {
        if (DOM.uploadBox) DOM.uploadBox.classList.add("input-error");
        isValid = false;
      }

      if (!isValid) {
        showNotification(
          "Please complete all required organization details and upload your proof document.",
          "error",
        );
        return;
      }

      // Hide active notification
      if (DOM.notificationEl) DOM.notificationEl.classList.remove("show");

      // Swap to "Application Submitted!" view
      if (DOM.topBar) DOM.topBar.style.display = "none";
      if (DOM.providerStepForm) DOM.providerStepForm.classList.add("hidden");
      if (DOM.providerStepSubmitted)
        DOM.providerStepSubmitted.classList.remove("hidden");

      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
}
