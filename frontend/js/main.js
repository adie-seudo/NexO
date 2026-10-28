// ==========================================
// 1. INSTANT DARK MODE CHECK (Prevents white flash)
// Wrapped in an IIFE to prevent global "const" crashes
// ==========================================
(function applyInitialTheme() {
  const savedTheme = localStorage.getItem("nexo-theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark-theme");
  } else if (savedTheme === null) {
    const hours = new Date().getHours();
    if (hours < 7 || hours >= 18) document.body.classList.add("dark-theme");
  }
})();

// =========================================
// MASTER INITIALIZATION
// =========================================
document.addEventListener("DOMContentLoaded", () => {
  initSplashScreen();
  initHeaderInjection();
  initAvatarMenu();
});

// =========================================
// 2. INTRO SPLASH SCREEN HANDLER
// =========================================
function initSplashScreen() {
  const splashScreen = document.getElementById("splash-screen");
  const introVideo = document.getElementById("intro-eagle-video");

  if (splashScreen) {
    const isDashboard = window.location.pathname.includes("dashboard");
    const storageKey = isDashboard
      ? "nexo-dashboard-intro-played"
      : "nexo-public-intro-played";
    const hasPlayed = sessionStorage.getItem(storageKey);

    if (hasPlayed) {
      splashScreen.style.display = "none";
    } else if (introVideo) {
      const hideSplash = () => {
        splashScreen.classList.add("fade-out");
        setTimeout(() => {
          splashScreen.style.display = "none";
          sessionStorage.setItem(storageKey, "true");
        }, 600);
      };
      introVideo.addEventListener("ended", hideSplash);
      setTimeout(hideSplash, 5000);
    } else {
      splashScreen.style.display = "none";
    }
  }
}

// ==========================================
// 3. SAFE HEADER INJECTION
// ==========================================
function initHeaderInjection() {
  const headerPlaceholder = document.getElementById("header-placeholder");

  if (headerPlaceholder) {
    fetch("header.html")
      .then((response) => response.text())
      .then((data) => {
        headerPlaceholder.innerHTML = data;
        initializeHeaderFunctions();
      })
      .catch((error) => console.error("Error loading header:", error));
  } else {
    // Dashboard and About pages do not have a placeholder, so initialize directly
    initializeHeaderFunctions();
  }
}

// ==========================================
// 4. HEADER LOGIC & SCROLL EVENTS
// ==========================================
function initializeHeaderFunctions() {
  const navMenu = document.querySelector(".nav-menu");
  const hamburgerBtn = document.querySelector(".hamburger-btn");
  const globalHeader = document.querySelector(".global-header");

  // --- A. Dynamic Active Link Highlight & Scroll ---
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  const navLinks = document.querySelectorAll(".nav-link");

  navLinks.forEach((link) => {
    if (link.getAttribute("href") === currentPage) {
      link.classList.add("active");
    }
    link.addEventListener("click", function (e) {
      if (this.classList.contains("active")) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
        if (navMenu) navMenu.classList.remove("open");
        if (hamburgerBtn) hamburgerBtn.classList.remove("open");
      }
    });
  });

  // --- B. Hamburger Menu (For Mobile Login Screen) ---
  if (hamburgerBtn && navMenu) {
    hamburgerBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      hamburgerBtn.classList.toggle("open");
      navMenu.classList.toggle("open");
    });

    // ---> NEW FIX: Close menu when clicking anywhere else on the page <---
    document.addEventListener("click", (e) => {
      if (
        navMenu.classList.contains("open") &&
        !navMenu.contains(e.target) &&
        !hamburgerBtn.contains(e.target)
      ) {
        hamburgerBtn.classList.remove("open");
        navMenu.classList.remove("open");
      }
    });
  }

  // --- C. Dark Mode Toggle Binding ---
  const themeToggle = document.querySelector(".theme-toggle");
  if (themeToggle) {
    // 1. Initial sync: Checkbox is TRUE (Sun) when it is NOT Dark Theme
    themeToggle.checked = !document.body.classList.contains("dark-theme");

    // 2. Toggle listener: Apply the exact theme based on the checkbox state
    themeToggle.addEventListener("change", (e) => {
      if (e.target.checked) {
        // Checked = Light Mode (Sun)
        localStorage.setItem("nexo-theme", "light");
        document.body.classList.remove("dark-theme");
      } else {
        // Unchecked = Dark Mode (Moon)
        localStorage.setItem("nexo-theme", "dark");
        document.body.classList.add("dark-theme");
      }
    });
  }

  // --- D. UNIFIED SCROLL LISTENER (Header & Drawer) ---
  let lastScrollY = window.scrollY;
  window.addEventListener(
    "scroll",
    () => {
      if (navMenu && navMenu.classList.contains("open")) {
        if (hamburgerBtn) hamburgerBtn.classList.remove("open");
        navMenu.classList.remove("open");
      }
      if (globalHeader) {
        const currentScrollY = window.scrollY;
        if (currentScrollY > lastScrollY && currentScrollY > 72) {
          globalHeader.classList.add("scroll-down");
        } else {
          globalHeader.classList.remove("scroll-down");
        }
        lastScrollY = currentScrollY;
      }
    },
    { passive: true },
  );

  // --- E. AUTH BUTTONS & ROLE MODAL ROUTING ---
  const headerLoginBtn = document.getElementById("header-login-btn");
  const headerRegisterBtn = document.getElementById("header-register-btn");
  const roleModal = document.querySelector(".role-modal-overlay");
  const roleModalClose = document.querySelector(".role-modal-close");

  // 1. Log In Button -> Handles smooth scroll / navigation to login focus
  if (headerLoginBtn) {
    headerLoginBtn.addEventListener("click", (e) => {
      e.preventDefault();

      const authScreen = document.getElementById("auth-screen");
      const focusEmailInput = document.getElementById("email");

      // Check if we are already on the home/index page
      const isIndexPage =
        window.location.pathname.split("/").pop() === "index.html" ||
        window.location.pathname.endsWith("/");

      if (isIndexPage && authScreen && focusEmailInput) {
        // If we're already on index.html, scroll smoothly right away
        authScreen.scrollIntoView({ behavior: "smooth" });
        setTimeout(() => focusEmailInput.focus(), 500);

        // Close the mobile menu if open
        if (navMenu) navMenu.classList.remove("open");
        if (hamburgerBtn) hamburgerBtn.classList.remove("open");
      } else {
        // If we are on another page (like About), navigate to index with the hash
        window.location.href = "index.html#focus-login";
      }
    });
  }

  // 2. Register Button -> Opens the Role Selection Modal
  if (headerRegisterBtn) {
    headerRegisterBtn.addEventListener("click", (e) => {
      e.preventDefault();

      if (roleModal) {
        roleModal.classList.add("active");

        // Auto-close the mobile menu if it's open so it doesn't block the modal
        if (navMenu) navMenu.classList.remove("open");
        if (hamburgerBtn) hamburgerBtn.classList.remove("open");
      } else {
        // Fallback: If they click Register on a page without the modal (like About page), send them to main
        window.location.href = "index.html";
      }
    });
  }

  // 2.5 Login Page "Register" Link -> Opens the Role Selection Modal
  const showRegisterLink = document.getElementById("show-register");

  if (showRegisterLink) {
    showRegisterLink.addEventListener("click", (e) => {
      e.preventDefault(); // Stops the page from jumping to the top

      if (roleModal) {
        roleModal.classList.add("active");
      }
    });
  }

  // 2.6 "Get Started" Button -> Scrolls to login form
  const getStartedBtn = document.getElementById("get-started-btn");

  if (getStartedBtn) {
    getStartedBtn.addEventListener("click", (e) => {
      e.preventDefault();

      const authScreen = document.getElementById("auth-screen");
      const focusEmailInput = document.getElementById("email");

      // Check if we are on the index page
      const isIndexPage =
        window.location.pathname.split("/").pop() === "index.html" ||
        window.location.pathname.endsWith("/");

      if (isIndexPage && authScreen && focusEmailInput) {
        // Smoothly scroll to the login form
        authScreen.scrollIntoView({ behavior: "smooth" });
        // Auto-focus the email input after scrolling
        setTimeout(() => focusEmailInput.focus(), 500);
      } else {
        // If clicked from a different page, redirect back to index
        window.location.href = "index.html#focus-login";
      }
    });
  }

  // 2.7 Bottom CTA "Register Now" Button -> Opens the Role Selection Modal
  const bottomRegisterBtn = document.getElementById("bottom-register-btn");

  if (bottomRegisterBtn) {
    bottomRegisterBtn.addEventListener("click", (e) => {
      e.preventDefault(); // Stops the page from jumping

      if (roleModal) {
        roleModal.classList.add("active");
      } else {
        // Fallback in case they click it from a page without the modal
        window.location.href = "index.html";
      }
    });
  }

  // 2.8 Direct "Register as Provider" Button -> Bypasses modal, goes straight to setup
  const directProviderRegBtn = document.getElementById("direct-provider-reg");

  if (directProviderRegBtn) {
    directProviderRegBtn.addEventListener("click", (e) => {
      e.preventDefault(); // Prevents default button behavior

      // Jump directly to the provider setup page
      window.location.href = "provider-setup.html";
    });
  }

  // 3. Close Role Modal (Clicking the 'X')
  if (roleModalClose && roleModal) {
    roleModalClose.addEventListener("click", () => {
      roleModal.classList.remove("active");
    });
  }

  // 4. Close Role Modal (Clicking the dark background outside the card)
  if (roleModal) {
    roleModal.addEventListener("click", (e) => {
      if (e.target === roleModal) {
        roleModal.classList.remove("active");
      }
    });
  }
}

// =========================================
// 5. AVATAR MENU TOGGLE
// =========================================
function initAvatarMenu() {
  const avatarBtn = document.getElementById("avatar-menu-btn");
  const navMenu = document.getElementById("nav-menu");

  if (avatarBtn && navMenu) {
    avatarBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      avatarBtn.classList.toggle("open");
      navMenu.classList.toggle("open");
    });

    document.addEventListener("click", (e) => {
      if (
        navMenu.classList.contains("open") &&
        !navMenu.contains(e.target) &&
        !avatarBtn.contains(e.target)
      ) {
        avatarBtn.classList.remove("open");
        navMenu.classList.remove("open");
      }
    });
  }
}

// 5. Route to specific registration pages (Event Delegation for dynamic HTML)
document.addEventListener("click", (e) => {
  // Check if the click happened on or inside the Student button
  const studentBtn = e.target.closest("#choose-student-reg");
  // Check if the click happened on or inside the Provider button
  const providerBtn = e.target.closest("#choose-provider-reg");

  if (studentBtn) {
    e.preventDefault();
    window.location.href = "register.html";
  }

  if (providerBtn) {
    e.preventDefault();
    window.location.href = "provider-setup.html";
  }
});
