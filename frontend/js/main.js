// =========================================
// INTRO SPLASH SCREEN HANDLER (Public vs Dashboard)
// =========================================
document.addEventListener("DOMContentLoaded", () => {
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
});

// ==========================================
// 1. INSTANT DARK MODE CHECK (Prevents white flash)
// ==========================================
const savedTheme = localStorage.getItem("nexo-theme");
if (savedTheme === "dark") {
  document.body.classList.add("dark-theme");
} else if (savedTheme === null) {
  const hours = new Date().getHours();
  if (hours < 7 || hours >= 18) document.body.classList.add("dark-theme");
}

// ==========================================
// 2. SAFE HEADER INJECTION & INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
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
});

// ==========================================
// 3. INITIALIZE ALL HEADER LOGIC
// ==========================================
function initializeHeaderFunctions() {
  const navMenu = document.querySelector(".nav-menu");
  const hamburgerBtn = document.querySelector(".hamburger-btn");
  const globalHeader = document.querySelector(".global-header");

  // --- A. Dynamic Active Link Highlight & Scroll ---
  const currentPage = window.location.pathname.split("/").pop() || "app.html";
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
}

// =========================================
// 4. AVATAR MENU TOGGLE (For Logged-In Pages)
// =========================================
document.addEventListener("DOMContentLoaded", () => {
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
});
