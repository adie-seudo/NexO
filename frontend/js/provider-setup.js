// =========================================
// 1. INSTANT DARK MODE CHECK & PRE-FILL NAME + EMAIL
// =========================================
const savedTheme = localStorage.getItem("nexo-theme");
if (savedTheme === "dark") {
  document.body.classList.add("dark-theme");
}

// Pre-fill Organization Name from Step 1 of registration
const orgNameInput = /** @type {HTMLInputElement | null} */ (
  document.getElementById("org-name")
);
const pendingName = sessionStorage.getItem("nexo-pending-name");
if (orgNameInput && pendingName) {
  orgNameInput.value = pendingName;
}

// Pre-fill Official Email Address from Step 1 of registration
const orgEmailInput = /** @type {HTMLInputElement | null} */ (
  document.getElementById("org-email")
);
const pendingEmail = sessionStorage.getItem("nexo-pending-email");
if (orgEmailInput && pendingEmail) {
  orgEmailInput.value = pendingEmail;
}

// =========================================
// 1.5 STRICT NUMBERS-ONLY FOR CONTACT NUMBER
// =========================================
const orgPhoneInput = /** @type {HTMLInputElement | null} */ (
  document.getElementById("org-phone")
);
if (orgPhoneInput) {
  orgPhoneInput.addEventListener("input", (e) => {
    const target = /** @type {HTMLInputElement} */ (e.target);
    // Allow only digits (0-9), plus sign (+), and spaces
    target.value = target.value.replace(/[^0-9+\s]/g, "");
  });
}

// =========================================
// 2. ON-SCREEN NOTIFICATION HELPER
// =========================================
const notificationEl = document.getElementById("setup-notification");

/**
 * @param {string} message
 * @param {string} [type="error"]
 */
function showNotification(message = "", type = "error") {
  if (!notificationEl) return;
  notificationEl.textContent = message;
  notificationEl.className = `verify-notification ${type} show`;

  window.scrollTo({ top: 0, behavior: "smooth" });

  if (type === "error") {
    setTimeout(() => {
      if (notificationEl.classList.contains("error")) {
        notificationEl.classList.remove("show");
      }
    }, 4500);
  }
}

// =========================================
// 3. CUSTOM PROVIDER TYPE DROPDOWN
// =========================================
const dropdown = document.getElementById("provider-type-dropdown");
const dropdownTrigger = document.getElementById("dropdown-trigger");
const dropdownSelectedText = document.getElementById("dropdown-selected-text");
const dropdownItems = document.querySelectorAll(".org-dropdown-item");
const orgTypeHiddenInput = /** @type {HTMLInputElement | null} */ (
  document.getElementById("org-type")
);

if (dropdown && dropdownTrigger) {
  dropdownTrigger.addEventListener("click", () => {
    dropdown.classList.toggle("open");
  });

  dropdownItems.forEach((item) => {
    item.addEventListener("click", () => {
      const value = item.getAttribute("data-value") || "";
      if (orgTypeHiddenInput) orgTypeHiddenInput.value = value;

      if (dropdownSelectedText) {
        dropdownSelectedText.textContent = value;
        dropdownSelectedText.classList.remove("placeholder");
      }

      dropdownItems.forEach((i) => i.classList.remove("selected"));
      item.classList.add("selected");

      dropdownTrigger.classList.remove("input-error");
      dropdown.classList.remove("open");
    });
  });

  document.addEventListener("click", (e) => {
    if (e.target instanceof Node && !dropdown.contains(e.target)) {
      dropdown.classList.remove("open");
    }
  });
}

// =========================================
// 4. FILE UPLOAD (CLICK & DRAG-AND-DROP)
// =========================================
const uploadBox = document.getElementById("org-upload-box");
const fileInput = /** @type {HTMLInputElement | null} */ (
  document.getElementById("org-proof-file")
);
const uploadStatusText = document.getElementById("upload-status-text");
let selectedProofFile = /** @type {File | null} */ (null);

/**
 * @param {File} file
 */
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
  if (uploadBox) uploadBox.classList.remove("input-error");
  if (uploadStatusText) {
    uploadStatusText.textContent = `Selected: ${file.name}`;
  }
}

if (uploadBox && fileInput) {
  fileInput.addEventListener("change", () => {
    if (fileInput.files && fileInput.files[0]) {
      handleFileSelection(fileInput.files[0]);
    }
  });

  // Prevent browser from opening dropped files in a new tab
  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    uploadBox.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    uploadBox.addEventListener(eventName, () => {
      uploadBox.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    uploadBox.addEventListener(eventName, () => {
      uploadBox.classList.remove("dragover");
    });
  });

  uploadBox.addEventListener("drop", (e) => {
    const dragEvent = /** @type {DragEvent} */ (e);
    if (
      dragEvent.dataTransfer &&
      dragEvent.dataTransfer.files &&
      dragEvent.dataTransfer.files[0]
    ) {
      handleFileSelection(dragEvent.dataTransfer.files[0]);
    }
  });
}

// =========================================
// 5. FORM VALIDATION & SUBMISSION TO "APPLICATION SUBMITTED" VIEW
// =========================================
const providerSetupForm = document.getElementById("provider-setup-form");
const providerStepForm = document.getElementById("provider-step-form");
const providerStepSubmitted = document.getElementById(
  "provider-step-submitted",
);

if (providerSetupForm) {
  providerSetupForm.addEventListener("submit", (e) => {
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
      const inputEl = /** @type {HTMLInputElement | null} */ (
        document.getElementById(id)
      );
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

    if (!orgTypeHiddenInput || !orgTypeHiddenInput.value) {
      if (dropdownTrigger) dropdownTrigger.classList.add("input-error");
      isValid = false;
    }

    if (!selectedProofFile) {
      if (uploadBox) uploadBox.classList.add("input-error");
      isValid = false;
    }

    if (!isValid) {
      showNotification(
        "Please complete all required organization details and upload your proof document.",
        "error",
      );
      return;
    }

    // Hide any active notification banner
    if (notificationEl) {
      notificationEl.classList.remove("show");
    }

    // Swap from the Setup Form to the "Application Submitted!" view
    const topBar = document.querySelector(".verify-top-bar");
    if (topBar) topBar.style.display = "none"; // Hides the NEXO logo and exit button
    if (providerStepForm) providerStepForm.classList.add("hidden");
    if (providerStepSubmitted) providerStepSubmitted.classList.remove("hidden");
    // Scroll cleanly to the top so the user sees the Application Submitted view
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}
