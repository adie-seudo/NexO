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
    // Helper Function: Show Inline Error
    const showError = (inputId, errorId, message) => {
      const inputEl = document.getElementById(inputId);
      const errorEl = document.getElementById(errorId);
      if (inputEl) inputEl.classList.add("input-error");
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = "block";
      }
    };

    // Helper Function: Clear Inline Error
    const clearError = (inputId, errorId) => {
      const inputEl = document.getElementById(inputId);
      const errorEl = document.getElementById(errorId);
      if (inputEl) inputEl.classList.remove("input-error");
      if (errorEl) {
        errorEl.textContent = "";
        errorEl.style.display = "none";
      }
    };

    // Real-Time UX: Clear errors immediately when typing or interacting
    const fieldPairs = [
      { input: "org-name", error: "error-org-name" },
      { input: "org-contact-person", error: "error-org-contact" },
      { input: "org-email", error: "error-org-email" },
      { input: "org-phone", error: "error-org-phone" },
      { input: "org-address", error: "error-org-address" },
    ];

    fieldPairs.forEach((pair) => {
      const inputEl = document.getElementById(pair.input);
      if (inputEl) {
        inputEl.addEventListener("input", () =>
          clearError(pair.input, pair.error),
        );
      }
    });

    // Clear dropdown error when clicked
    if (DOM.dropdownTrigger) {
      DOM.dropdownTrigger.addEventListener("click", () =>
        clearError("dropdown-trigger", "error-org-type"),
      );
    }

    // Clear file error when a file is uploaded
    if (DOM.fileInput) {
      DOM.fileInput.addEventListener("change", () =>
        clearError("org-upload-box", "error-org-file"),
      );
    }

    // Handle Submit
    DOM.providerSetupForm.addEventListener("submit", (e) => {
      e.preventDefault();
      let isValid = true;

      // 1. Validate Organization Name
      const orgName = document.getElementById("org-name");
      if (orgName && !orgName.value.trim()) {
        showError(
          "org-name",
          "error-org-name",
          "Organization name is required.",
        );
        isValid = false;
      }

      // 2. Validate Contact Person
      const orgContact = document.getElementById("org-contact-person");
      if (orgContact && !orgContact.value.trim()) {
        showError(
          "org-contact-person",
          "error-org-contact",
          "Contact person name is required.",
        );
        isValid = false;
      }

      // 3. Validate Email
      const orgEmail = document.getElementById("org-email");
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (orgEmail && !orgEmail.value.trim()) {
        showError("org-email", "error-org-email", "Email address is required.");
        isValid = false;
      } else if (orgEmail && !emailRegex.test(orgEmail.value.trim())) {
        showError(
          "org-email",
          "error-org-email",
          "Please enter a valid email address.",
        );
        isValid = false;
      }

      // 4. Validate Phone Number
      const orgPhone = document.getElementById("org-phone");
      if (orgPhone && !orgPhone.value.trim()) {
        showError(
          "org-phone",
          "error-org-phone",
          "Contact number is required.",
        );
        isValid = false;
      } else if (orgPhone && orgPhone.value.trim().length < 7) {
        showError(
          "org-phone",
          "error-org-phone",
          "Please enter a valid phone number.",
        );
        isValid = false;
      }

      // 5. Validate Address
      const orgAddress = document.getElementById("org-address");
      if (orgAddress && !orgAddress.value.trim()) {
        showError(
          "org-address",
          "error-org-address",
          "Office address is required.",
        );
        isValid = false;
      }

      // 6. Validate Organization Type Dropdown
      if (!DOM.orgTypeHiddenInput || !DOM.orgTypeHiddenInput.value) {
        showError(
          "dropdown-trigger",
          "error-org-type",
          "Please select an organization type.",
        );
        isValid = false;
      }

      // 7. Validate Document Upload
      if (!selectedProofFile) {
        showError(
          "org-upload-box",
          "error-org-file",
          "Please upload a verification document.",
        );
        isValid = false;
      }

      // HARD STOP: If anything failed, stop the function
      if (!isValid) return;

      // Hide active general notification if it was showing
      if (DOM.notificationEl) DOM.notificationEl.classList.remove("show");

      // Change button text to show loading state
      const submitBtn = document.querySelector(
        "#provider-setup-form .auth-submit",
      );
      if (submitBtn) {
        submitBtn.textContent = "Submitting Application...";
        submitBtn.style.opacity = "0.7";
        submitBtn.style.pointerEvents = "none";
      }

      // Simulate a small delay, then swap to "Application Submitted!" view
      setTimeout(() => {
        if (DOM.topBar) DOM.topBar.style.display = "none";
        if (DOM.providerStepForm) DOM.providerStepForm.classList.add("hidden");
        if (DOM.providerStepSubmitted)
          DOM.providerStepSubmitted.classList.remove("hidden");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 1000);
    });
  }
}
