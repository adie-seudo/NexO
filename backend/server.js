// ==========================================================================
// NEXO SCHOLARSHIP PORTAL - LOCAL BACKEND SERVER & FILE HANDLING ENGINE
// Handles static assets, atomic JSON persistence (data.json), validated
// document uploads, live provider-student synchronization, and REST APIs.
// ==========================================================================

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT) || 3000;

// Path configuration
const BACKEND_DIR = __dirname;
const PROJECT_ROOT = path.resolve(__dirname, "..");
const DATA_FILE_BACKEND = path.join(BACKEND_DIR, "data.json");
const DATA_FILE_ROOT = path.join(PROJECT_ROOT, "data.json");
const UPLOADS_DIR = path.join(PROJECT_ROOT, "uploads");

// Strict Upload Validation Constants (5MB max per file; PDF/JPG/PNG only)
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_BODY_BYTES = 25 * 1024 * 1024;
const ALLOWED_UPLOAD_EXTS = new Set([".pdf", ".jpg", ".jpeg", ".png"]);
const ALLOWED_UPLOAD_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);

function ensureDirectoryExists(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    return true;
  } catch (err) {
    console.error(`[Filesystem Error] Failed to create directory ${dirPath}:`, err.message);
    return false;
  }
}

ensureDirectoryExists(UPLOADS_DIR);

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function createHttpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

// Initial default schema (always deep-cloned before use)
const DEFAULT_DATA = {
  scholarships: [],
  drafts: [],
  applications: [],
  notifications: [
    {
      id: "notif_1004",
      recipient: "student",
      title: "Document Verification",
      message:
        "Your .edu.ph student identity is verified for Academic Year 2026-2027.",
      timestamp: "2026-11-08T12:00:00.000Z",
      formattedTime: "2 hours ago",
      read: false,
      link: "student-dashboard.html",
    },
  ],
  settings: {
    orgName: "NEXO",
    location: "Batangas City, Philippines",
    contactPerson: "Admin Officer",
    contactNumber: "+63 912 345 6789",
    email: "provider@nexo.edu.ph",
    bannerImage: "",
    logoImage: "",
    bio: "Empowering students through accessible educational opportunities and transparent scholarship management.",
    notifications: {
      newApplications: true,
      emailAlerts: true,
      weeklyDigest: false,
      systemUpdates: true,
    },
    preferences: {
      theme: "light",
      twoFactor: false,
    },
  },
  studentSettings: {
    fullName: "Adrian Del Mundo",
    email: "adrian@batstate-u.edu.ph",
    university: "Batangas State University",
    course: "BS Information Technology",
    yearLevel: "3rd Year",
    studentId: "21-04589",
    contactNumber: "+63 912 345 6789",
    bio: "Passionate IT student striving for academic excellence and innovation in web technologies.",
    profilePicture: "",
    notifications: {
      scholarshipMatches: true,
      applicationUpdates: true,
      deadlineReminders: true,
    },
    preferences: {
      theme: "light",
    },
  },
  users: [
    {
      id: "usr_prov_nexo",
      email: "admin@admin",
      password: "admin",
      role: "provider",
      name: "NEXO",
      orgName: "NEXO",
      createdAt: "2026-11-01T08:00:00.000Z",
      formattedDate: "Nov 1, 2026",
      status: "active",
      notes: "Primary Scholarship Provider Account",
    },
    {
      id: "usr_stud_adrian",
      email: "adrian@batstate-u.edu.ph",
      password: "password123",
      role: "student",
      name: "Adrian Del Mundo",
      university: "Batangas State University",
      course: "BS Information Technology",
      yearLevel: "3rd Year",
      studentId: "21-04589",
      createdAt: "2026-11-01T08:00:00.000Z",
      formattedDate: "Nov 1, 2026",
      status: "active",
      notes: "Verified Student Account",
    },
    {
      id: "usr_stud_2402924",
      email: "24-02924@g.batstate-u.edu.ph",
      password: "password123",
      role: "student",
      name: "",
      university: "Batangas State University",
      course: "",
      yearLevel: "",
      studentId: "24-02924",
      createdAt: "2026-11-09T08:00:00.000Z",
      formattedDate: "Nov 9, 2026",
      status: "active",
      notes: "Student Account created via Admin Panel",
    },
  ],
  studentProfiles: {
    "adrian@batstate-u.edu.ph": {
      fullName: "Adrian Del Mundo",
      email: "adrian@batstate-u.edu.ph",
      university: "Batangas State University",
      course: "BS Information Technology",
      yearLevel: "3rd Year",
      studentId: "21-04589",
      contactNumber: "+63 912 345 6789",
      bio: "Passionate IT student striving for academic excellence and innovation in web technologies.",
      profilePicture: "",
      notifications: {
        scholarshipMatches: true,
        applicationUpdates: true,
        deadlineReminders: true,
      },
      preferences: {
        theme: "light",
      },
    },
    "24-02924@g.batstate-u.edu.ph": {
      fullName: "",
      email: "24-02924@g.batstate-u.edu.ph",
      university: "Batangas State University",
      course: "",
      yearLevel: "",
      studentId: "24-02924",
      contactNumber: "",
      bio: "",
      profilePicture: "",
      notifications: {
        scholarshipMatches: true,
        applicationUpdates: true,
        deadlineReminders: true,
      },
      preferences: {
        theme: "light",
      },
    },
  },
};

function cloneDefaultData() {
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

// Helper: Safely read and normalize data.json without mutating DEFAULT_DATA
function readData() {
  const defaults = cloneDefaultData();
  try {
    let filePath = DATA_FILE_BACKEND;
    if (!fs.existsSync(filePath)) {
      if (fs.existsSync(DATA_FILE_ROOT)) {
        filePath = DATA_FILE_ROOT;
      } else {
        writeData(defaults);
        return defaults;
      }
    }

    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Root JSON structure must be an object");
    }

    if (!Array.isArray(parsed.scholarships)) parsed.scholarships = [];
    if (!Array.isArray(parsed.drafts)) parsed.drafts = [];
    if (!Array.isArray(parsed.applications)) parsed.applications = [];
    if (!Array.isArray(parsed.notifications)) {
      parsed.notifications = defaults.notifications;
    }
    if (!Array.isArray(parsed.users)) {
      parsed.users = defaults.users;
    }
    if (!parsed.settings || typeof parsed.settings !== "object") {
      parsed.settings = defaults.settings;
    }
    if (!parsed.studentSettings || typeof parsed.studentSettings !== "object") {
      parsed.studentSettings = defaults.studentSettings;
    }
    if (!parsed.studentProfiles || typeof parsed.studentProfiles !== "object") {
      parsed.studentProfiles = defaults.studentProfiles;
    }
    return parsed;
  } catch (err) {
    console.error("[Database Read Error] Recovering with safe defaults:", err.message);
    try {
      if (fs.existsSync(DATA_FILE_BACKEND)) {
        fs.copyFileSync(
          DATA_FILE_BACKEND,
          `${DATA_FILE_BACKEND}.corrupt.${Date.now()}`,
        );
      }
    } catch (_) {}
    return defaults;
  }
}

// Helper: Atomically write data to backend/data.json and root data.json
function writeData(data) {
  try {
    ensureDirectoryExists(BACKEND_DIR);
    const jsonStr = JSON.stringify(data, null, 2) + "\n";

    const tmpBackend = `${DATA_FILE_BACKEND}.tmp.${process.pid}`;
    fs.writeFileSync(tmpBackend, jsonStr, "utf8");
    fs.renameSync(tmpBackend, DATA_FILE_BACKEND);

    try {
      const tmpRoot = `${DATA_FILE_ROOT}.tmp.${process.pid}`;
      fs.writeFileSync(tmpRoot, jsonStr, "utf8");
      fs.renameSync(tmpRoot, DATA_FILE_ROOT);
    } catch (rootErr) {
      console.error("[Database Sync Warning] Could not sync root data.json:", rootErr.message);
    }
    return true;
  } catch (err) {
    console.error("[Database Write Error] Could not write data.json:", err.message);
    return false;
  }
}

// Helper: Validate & save a Base64-encoded document to /uploads
function saveBase64File(doc, prefix) {
  if (!doc) return null;
  const isFollowUp =
    Boolean(doc.isFollowUp) ||
    doc.status === "to_follow_up" ||
    doc.type === "to_follow_up";

  if (!doc.data || isFollowUp) {
    return {
      name:
        doc.name ||
        `${doc.requirement || doc.title || "Requirement"} (To Follow Up)`,
      title: doc.title || doc.requirement || "Requirement",
      requirement: doc.requirement || doc.title || "Requirement",
      size: 0,
      type: "to_follow_up",
      fileUrl: "",
      uploadedAt: new Date().toISOString(),
      status: "to_follow_up",
      isFollowUp: true,
      slot: doc.slot || "",
    };
  }

  if (!ensureDirectoryExists(UPLOADS_DIR)) {
    throw createHttpError(500, "Server upload directory is unavailable.");
  }

  const rawName = String(doc.name || "document.pdf").trim();
  const ext = path.extname(rawName).toLowerCase();
  if (!ALLOWED_UPLOAD_EXTS.has(ext)) {
    throw createHttpError(
      400,
      `Unsupported file extension "${ext || "unknown"}". Allowed formats: PDF, JPG, PNG.`,
    );
  }

  const matches = String(doc.data).match(/^data:([A-Za-z0-9.+-]+\/[A-Za-z0-9.+-]+);base64,(.+)$/);
  const detectedMime = (matches ? matches[1] : String(doc.type || "")).toLowerCase().trim();
  if (detectedMime && !ALLOWED_UPLOAD_MIMES.has(detectedMime)) {
    throw createHttpError(
      400,
      `Unsupported file type "${detectedMime}". Allowed formats: PDF, JPG, PNG.`,
    );
  }

  const base64Payload = matches ? matches[2] : String(doc.data);
  const buffer = Buffer.from(base64Payload, "base64");

  if (!buffer || buffer.length === 0) {
    throw createHttpError(400, `Uploaded file "${rawName}" is empty or corrupted.`);
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw createHttpError(
      413,
      `File "${rawName}" exceeds the 5MB maximum upload size limit.`,
    );
  }

  const safePrefix = String(prefix || "doc").replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
  const diskFileName = `${safePrefix}_${Date.now()}_${safeName}`;
  const diskPath = path.resolve(UPLOADS_DIR, diskFileName);

  if (!diskPath.startsWith(UPLOADS_DIR + path.sep)) {
    throw createHttpError(400, "Invalid upload destination path.");
  }

  try {
    fs.writeFileSync(diskPath, buffer);
  } catch (err) {
    console.error("[Upload Write Error]:", err.message);
    throw createHttpError(500, "Failed to save uploaded document to disk.");
  }

  return {
    name: rawName,
    title: doc.title || doc.requirement || rawName,
    requirement: doc.requirement || doc.title || rawName,
    size: buffer.length,
    type: detectedMime || (ext === ".pdf" ? "application/pdf" : "image/jpeg"),
    fileUrl: `/uploads/${diskFileName}`,
    uploadedAt: new Date().toISOString(),
    status: "attached",
    isFollowUp: false,
    slot: doc.slot || "",
  };
}

// Helper: Remove uploaded files on disk when applications are purged
function cleanupUploadedFilesForApplications(apps) {
  if (!Array.isArray(apps)) return;
  apps.forEach((app) => {
    const docs = Array.isArray(app && app.documents) ? app.documents : [];
    docs.forEach((doc) => {
      if (doc && typeof doc.fileUrl === "string" && doc.fileUrl.startsWith("/uploads/")) {
        const relName = path.basename(doc.fileUrl);
        const fullPath = path.resolve(UPLOADS_DIR, relName);
        if (fullPath.startsWith(UPLOADS_DIR + path.sep) && fs.existsSync(fullPath)) {
          try {
            fs.unlinkSync(fullPath);
          } catch (_) {}
        }
      }
    });
  });
}

// Helper: Recalculate scholarship applicant counts & sync per-student avatars safely
function syncScholarshipApplicantCounts(data) {
  const profiles = (data && data.studentProfiles) || {};

  if (Array.isArray(data.applications)) {
    data.applications.forEach((app) => {
      const appEmail = String(app.studentEmail || "").toLowerCase().trim();
      const profilePic =
        (appEmail && profiles[appEmail] && profiles[appEmail].profilePicture) || "";
      if (!app.studentProfilePic && !app.profilePicture && profilePic) {
        app.studentProfilePic = profilePic;
        app.profilePicture = profilePic;
      }
    });
  }

  if (!Array.isArray(data.scholarships) || !Array.isArray(data.applications)) {
    return;
  }

  const scholMap = {};
  data.scholarships.forEach((s) => {
    const count = data.applications.filter((app) => {
      if (app.scholarshipId && s.id && String(app.scholarshipId) === String(s.id)) {
        return true;
      }
      if (!app.scholarshipId && s.title && (app.scholarshipTitle === s.title || app.title === s.title)) {
        return true;
      }
      return false;
    }).length;

    const limit = parseInt(s.applicantLimit || s.maxApplicants || 200, 10) || 200;
    s.applicantLimit = limit;
    s.maxApplicants = limit;
    s.applicantTotal = count;
    s.applicantCount = `${count} / ${limit} Applicants`;

    const currentStatus = String(s.status || "Open").toLowerCase();
    if (count >= limit && currentStatus !== "closed") {
      s.status = "Quota Full";
    } else if (count < limit && currentStatus === "quota full") {
      s.status = "Open";
    }
    scholMap[s.id] = s;
  });

  data.applications.forEach((app) => {
    const matched =
      scholMap[app.scholarshipId] ||
      data.scholarships.find(
        (s) => s.title && (app.scholarshipTitle === s.title || app.title === s.title),
      );
    if (matched) {
      app.applicantCount = matched.applicantCount;
      if (!app.scholarshipId) app.scholarshipId = matched.id;
    }
  });
}

// MIME Types for static files
const MIME_TYPES = {
  ".html": "text/html; charset=UTF-8",
  ".css": "text/css; charset=UTF-8",
  ".js": "application/javascript; charset=UTF-8",
  ".json": "application/json; charset=UTF-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".txt": "text/plain; charset=UTF-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

// Blocked server/config paths from public static access
const BLOCKED_STATIC_PREFIXES = ["/backend/", "/bin/", "/.git/", "/.vscode/"];
const BLOCKED_STATIC_FILES = new Set([
  "/data.json",
  "/server.js",
  "/package.json",
  "/package-lock.json",
  "/start.sh",
  "/.gitignore",
]);

function sendJson(res, statusCode, payload) {
  if (res.headersSent) return;
  const jsonStr = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=UTF-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  });
  res.end(jsonStr);
}

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let aborted = false;

    req.on("data", (chunk) => {
      if (aborted) return;
      totalBytes += Buffer.byteLength(chunk);
      if (totalBytes > MAX_BODY_BYTES) {
        aborted = true;
        reject(createHttpError(413, "Request payload exceeds maximum size limit."));
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (aborted) return;
      if (totalBytes === 0) return resolve({});
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return reject(createHttpError(400, "JSON request body must be an object."));
        }
        resolve(parsed);
      } catch (err) {
        reject(createHttpError(400, "Malformed JSON in request body."));
      }
    });

    req.on("error", (err) => {
      if (!aborted) reject(err);
    });
  });
}

// ==========================================================================
// HTTP REQUEST HANDLER
// ==========================================================================
async function handleRequest(req, res) {
  try {
    // CORS Preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, X-Requested-With",
      });
      res.end();
      return;
    }

    const reqUrl = new URL(
      req.url || "/",
      "http://" + (req.headers.host || `localhost:${PORT}`),
    );
    let pathname = reqUrl.pathname;
    try {
      pathname = decodeURIComponent(pathname);
    } catch (_) {
      return sendJson(res, 400, {
        success: false,
        error: "Malformed request URI.",
      });
    }
    const method = (req.method || "GET").toUpperCase();

    // -------------------------------------------------------------
    // API ROUTES
    // -------------------------------------------------------------

    // 1. GET /api/data (Full live system sync)
    if (pathname === "/api/data") {
      if (method !== "GET") {
        return sendJson(res, 405, { success: false, error: "Method not allowed" });
      }
      const data = readData();
      syncScholarshipApplicantCounts(data);
      return sendJson(res, 200, data);
    }

    // 1b. POST /api/auth/login (Server-side account authentication)
    if (pathname === "/api/auth/login") {
      if (method !== "POST") {
        return sendJson(res, 405, { success: false, error: "Method not allowed" });
      }
      const body = await parseRequestBody(req);
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const requestedRole = String(body.role || "").trim().toLowerCase();

      if (!email || !password) {
        return sendJson(res, 400, {
          success: false,
          error: "Email and password are required.",
        });
      }

      const data = readData();
      const matchedUser = (data.users || []).find(
        (u) => String(u.email || "").toLowerCase() === email,
      );

      if (!matchedUser) {
        return sendJson(res, 404, {
          success: false,
          error: "Account not found. Only registered accounts can log in.",
        });
      }
      if (matchedUser.status === "banned") {
        return sendJson(res, 403, {
          success: false,
          error: "This account has been suspended by the administrator.",
        });
      }
      if (requestedRole && matchedUser.role !== requestedRole) {
        if (!(matchedUser.role === "admin")) {
          return sendJson(res, 403, {
            success: false,
            error: `This email is registered as a ${matchedUser.role} account. Please switch tabs.`,
          });
        }
      }
      if (String(matchedUser.password || "") !== password) {
        return sendJson(res, 401, {
          success: false,
          error: "Incorrect password. Please verify your credentials.",
        });
      }

      const { password: _omitted, ...safeUser } = matchedUser;
      return sendJson(res, 200, { success: true, user: safeUser });
    }

    // 2. SCHOLARSHIPS API
    if (pathname === "/api/scholarships") {
      if (method === "GET") {
        const data = readData();
        syncScholarshipApplicantCounts(data);
        return sendJson(res, 200, data.scholarships || []);
      }

      if (method === "POST") {
        const body = await parseRequestBody(req);
        const title = String(body.title || "").trim();
        if (!title) {
          return sendJson(res, 400, {
            success: false,
            error: "Scholarship title is required.",
          });
        }

        const data = readData();
        data.scholarships = data.scholarships || [];

        const limit =
          parseInt(body.applicantLimit || body.maxApplicants || 200, 10) || 200;
        const now = new Date();
        const postedAt = body.postedAt || body.createdAt || now.toISOString();
        const formattedPostedDate =
          body.formattedPostedDate ||
          new Date(postedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });

        const newScholarship = {
          id: makeId("schol"),
          title,
          desc: String(body.desc || "").trim(),
          type: body.type || "Other",
          typeText: body.typeText || body.type || "Other",
          deadline: body.deadline || "",
          formattedDate: body.formattedDate || "No Deadline",
          applicantLimit: limit,
          maxApplicants: limit,
          applicantTotal: 0,
          applicantCount: `0 / ${limit} Applicants`,
          postedAt,
          formattedPostedDate,
          createdAt: postedAt,
          requirements: Array.isArray(body.requirements) ? body.requirements : [],
          providerName: body.providerName || data.settings.orgName || "NEXO",
          providerEmail: String(body.providerEmail || data.settings.email || "").toLowerCase(),
          providerLogo:
            body.providerLogo !== undefined
              ? body.providerLogo
              : data.settings.logoImage || "",
          providerBanner:
            body.providerBanner !== undefined
              ? body.providerBanner
              : data.settings.bannerImage || "",
          status: body.status || "Open",
        };

        data.scholarships.unshift(newScholarship);

        data.notifications = data.notifications || [];
        data.notifications.unshift({
          id: makeId("notif"),
          recipient: "student",
          title: "New Scholarship Posted",
          message: `${newScholarship.providerName} published "${newScholarship.title}". Applications are now open!`,
          timestamp: now.toISOString(),
          formattedTime: "Just now",
          read: false,
          link: "student-browse.html",
          scholarshipId: newScholarship.id,
        });

        if (body.draftId) {
          data.drafts = (data.drafts || []).filter(
            (d) => String(d.id) !== String(body.draftId),
          );
        }

        if (!writeData(data)) {
          return sendJson(res, 500, {
            success: false,
            error: "Failed to persist scholarship to data.json.",
          });
        }
        return sendJson(res, 201, newScholarship);
      }

      return sendJson(res, 405, { success: false, error: "Method not allowed" });
    }

    // DELETE /api/scholarships/:id
    if (pathname.startsWith("/api/scholarships/")) {
      if (method !== "DELETE") {
        return sendJson(res, 405, { success: false, error: "Method not allowed" });
      }
      const id = pathname.replace("/api/scholarships/", "").split("/")[0];
      const data = readData();
      const beforeCount = (data.scholarships || []).length;
      data.scholarships = (data.scholarships || []).filter(
        (s) => String(s.id) !== String(id),
      );
      if (data.scholarships.length === beforeCount) {
        return sendJson(res, 404, {
          success: false,
          error: "Scholarship not found.",
        });
      }

      const removedApps = (data.applications || []).filter(
        (a) => String(a.scholarshipId) === String(id),
      );
      cleanupUploadedFilesForApplications(removedApps);
      data.applications = (data.applications || []).filter(
        (a) => String(a.scholarshipId) !== String(id),
      );
      syncScholarshipApplicantCounts(data);

      if (!writeData(data)) {
        return sendJson(res, 500, {
          success: false,
          error: "Failed to update data.json.",
        });
      }
      return sendJson(res, 200, { success: true, id });
    }

    // 3. DRAFTS API
    if (pathname === "/api/drafts") {
      if (method === "GET") {
        const data = readData();
        return sendJson(res, 200, data.drafts || []);
      }

      if (method === "POST") {
        const body = await parseRequestBody(req);
        const data = readData();
        data.drafts = data.drafts || [];

        const draftId = body.id ? String(body.id) : "";
        const existingIdx = draftId
          ? data.drafts.findIndex((d) => String(d.id) === draftId)
          : -1;

        const draftItem = {
          id: existingIdx >= 0 ? draftId : makeId("draft"),
          title: String(body.title || "Untitled Scholarship").trim(),
          desc: String(body.desc || "No description provided yet...").trim(),
          type: body.type || "",
          typeText: body.typeText || body.type || "",
          date: body.date || "",
          applicantLimit: parseInt(body.applicantLimit || 200, 10) || 200,
          requirements: Array.isArray(body.requirements) ? body.requirements : [],
          providerName: body.providerName || data.settings.orgName || "NEXO",
          providerEmail: String(body.providerEmail || data.settings.email || "").toLowerCase(),
          updatedAt: new Date().toISOString(),
        };

        if (existingIdx >= 0) {
          data.drafts[existingIdx] = draftItem;
        } else {
          data.drafts.unshift(draftItem);
        }

        if (!writeData(data)) {
          return sendJson(res, 500, {
            success: false,
            error: "Failed to save draft to data.json.",
          });
        }
        return sendJson(res, existingIdx >= 0 ? 200 : 201, draftItem);
      }

      return sendJson(res, 405, { success: false, error: "Method not allowed" });
    }

    // DELETE /api/drafts/:id
    if (pathname.startsWith("/api/drafts/")) {
      if (method !== "DELETE") {
        return sendJson(res, 405, { success: false, error: "Method not allowed" });
      }
      const id = pathname.replace("/api/drafts/", "").split("/")[0];
      const data = readData();
      data.drafts = (data.drafts || []).filter((d) => String(d.id) !== String(id));
      if (!writeData(data)) {
        return sendJson(res, 500, {
          success: false,
          error: "Failed to delete draft from data.json.",
        });
      }
      return sendJson(res, 200, { success: true, id });
    }

    // 4. APPLICATIONS API
    if (pathname === "/api/applications") {
      if (method === "GET") {
        const data = readData();
        syncScholarshipApplicantCounts(data);
        return sendJson(res, 200, data.applications || []);
      }

      if (method === "POST") {
        const body = await parseRequestBody(req);
        const data = readData();
        data.applications = data.applications || [];

        const targetScholarshipId = String(body.scholarshipId || "").trim();
        if (!targetScholarshipId) {
          return sendJson(res, 400, {
            success: false,
            error: "Valid scholarshipId is required to submit an application.",
          });
        }

        const studentEmail = String(body.studentEmail || "").trim().toLowerCase();
        if (!studentEmail) {
          return sendJson(res, 400, {
            success: false,
            error: "Student email is required to submit an application.",
          });
        }

        const alreadyApplied = data.applications.some(
          (a) =>
            String(a.scholarshipId) === targetScholarshipId &&
            String(a.studentEmail || "").trim().toLowerCase() === studentEmail,
        );

        if (alreadyApplied) {
          return sendJson(res, 400, {
            success: false,
            error: "You have already applied for this scholarship.",
          });
        }

        const targetSchol = (data.scholarships || []).find(
          (s) => String(s.id) === targetScholarshipId,
        );
        if (!targetSchol) {
          return sendJson(res, 404, {
            success: false,
            error: "The selected scholarship post no longer exists.",
          });
        }

        const limit =
          parseInt(
            targetSchol.applicantLimit || targetSchol.maxApplicants || 200,
            10,
          ) || 200;
        const currentCount = (data.applications || []).filter(
          (a) => String(a.scholarshipId) === targetScholarshipId,
        ).length;

        if (
          currentCount >= limit ||
          String(targetSchol.status || "").toLowerCase() === "closed"
        ) {
          return sendJson(res, 400, {
            success: false,
            error:
              "This scholarship has reached its applicant limit or is now closed.",
          });
        }

        const appId = makeId("app");
        const savedDocuments = [];
        const rawDocs = Array.isArray(body.documents)
          ? body.documents
          : Array.isArray(body.uploadedDocuments)
            ? body.uploadedDocuments
            : [];

        if (rawDocs.length === 0) {
          return sendJson(res, 400, {
            success: false,
            error:
              "Please upload a file or select Follow Up Later for each requirement.",
          });
        }

        for (let idx = 0; idx < rawDocs.length; idx++) {
          const doc = rawDocs[idx];
          if (typeof doc === "string") {
            const isFollowUp = doc.includes("(To Follow Up)");
            const cleanTitle = doc.replace(" (To Follow Up)", "").trim();
            savedDocuments.push({
              name: doc,
              title: cleanTitle,
              requirement: cleanTitle,
              size: 0,
              type: isFollowUp ? "to_follow_up" : "application/pdf",
              fileUrl: "",
              uploadedAt: new Date().toISOString(),
              status: isFollowUp ? "to_follow_up" : "attached",
              isFollowUp,
            });
          } else if (doc && typeof doc === "object") {
            const saved = saveBase64File(doc, `${appId}_doc${idx + 1}`);
            if (saved) savedDocuments.push(saved);
          }
        }

        const attachedDocs = savedDocuments.filter(
          (d) =>
            !d.isFollowUp &&
            d.status !== "to_follow_up" &&
            d.type !== "to_follow_up" &&
            (d.size > 0 || d.fileUrl),
        );
        const followUpDocs = savedDocuments.filter(
          (d) =>
            d.isFollowUp ||
            d.status === "to_follow_up" ||
            d.type === "to_follow_up",
        );

        const studentProfile =
          (data.studentProfiles && data.studentProfiles[studentEmail]) || {};
        const matchedStudentUser =
          (data.users || []).find(
            (u) => String(u.email || "").toLowerCase() === studentEmail,
          ) || {};

        const sAvatar =
          body.studentProfilePic ||
          body.profilePicture ||
          studentProfile.profilePicture ||
          "";

        const resolvedStudentName =
          String(
            body.studentName ||
              studentProfile.fullName ||
              matchedStudentUser.name ||
              studentEmail.split("@")[0],
          ).trim() || "Verified Student";

        const newApp = {
          id: appId,
          scholarshipId: targetScholarshipId,
          scholarshipTitle:
            body.scholarshipTitle || targetSchol.title || "Scholarship Program",
          providerName:
            body.providerName ||
            targetSchol.providerName ||
            data.settings.orgName ||
            "NEXO",
          providerEmail:
            targetSchol.providerEmail || data.settings.email || "",
          studentName: resolvedStudentName,
          studentEmail,
          studentId:
            body.studentId ||
            studentProfile.studentId ||
            matchedStudentUser.studentId ||
            "",
          university:
            body.university ||
            studentProfile.university ||
            matchedStudentUser.university ||
            "",
          course:
            body.course ||
            studentProfile.course ||
            matchedStudentUser.course ||
            "",
          yearLevel:
            body.yearLevel ||
            studentProfile.yearLevel ||
            matchedStudentUser.yearLevel ||
            "",
          contactNumber:
            body.contactNumber || studentProfile.contactNumber || "",
          studentProfilePic: sAvatar,
          profilePicture: sAvatar,
          status: body.status || "Submitted",
          statusText: body.statusText || body.status || "Submitted",
          submittedAt: body.submittedAt || new Date().toISOString(),
          formattedDate:
            body.formattedDate ||
            new Date().toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }),
          applicantCount: `1 / ${limit} Applicants`,
          documents: savedDocuments,
          uploadedDocuments: attachedDocs.map((d) => d.name),
          notes: body.notes || "",
          reviewedAt: null,
        };

        data.applications.unshift(newApp);
        syncScholarshipApplicantCounts(data);

        const docNotice =
          followUpDocs.length > 0
            ? `${attachedDocs.length} document(s) (${followUpDocs.length} to follow up)`
            : `${attachedDocs.length} document(s)`;

        data.notifications = data.notifications || [];
        data.notifications.unshift({
          id: makeId("notif"),
          recipient: "provider",
          title: "New Application Received",
          message: `${newApp.studentName} applied for "${newApp.scholarshipTitle}" with ${docNotice}.`,
          timestamp: new Date().toISOString(),
          formattedTime: "Just now",
          read: false,
          link: "provider-applications.html",
          appId: newApp.id,
        });

        if (!writeData(data)) {
          return sendJson(res, 500, {
            success: false,
            error: "Failed to save application to data.json.",
          });
        }
        return sendJson(res, 201, newApp);
      }

      return sendJson(res, 405, { success: false, error: "Method not allowed" });
    }

    // PATCH/PUT/POST/DELETE /api/applications/:id
    if (pathname.startsWith("/api/applications/")) {
      const id = pathname.replace("/api/applications/", "").split("/")[0];

      if (method === "DELETE") {
        const data = readData();
        const removed = (data.applications || []).filter(
          (a) => String(a.id) === String(id),
        );
        cleanupUploadedFilesForApplications(removed);
        data.applications = (data.applications || []).filter(
          (a) => String(a.id) !== String(id),
        );
        syncScholarshipApplicantCounts(data);
        if (!writeData(data)) {
          return sendJson(res, 500, {
            success: false,
            error: "Failed to delete application from data.json.",
          });
        }
        return sendJson(res, 200, { success: true, id });
      }

      if (method === "PATCH" || method === "PUT" || method === "POST") {
        const body = await parseRequestBody(req);
        const data = readData();
        data.applications = data.applications || [];

        const appIndex = data.applications.findIndex(
          (a) => String(a.id) === String(id),
        );
        if (appIndex === -1) {
          return sendJson(res, 404, {
            success: false,
            message: "Application not found.",
          });
        }

        const currentApp = data.applications[appIndex];
        const previousStatus = currentApp.status;
        const updatedStatus =
          body.status !== undefined ? body.status : currentApp.status;
        const updatedNotes =
          body.notes !== undefined ? body.notes : currentApp.notes || "";

        if (body.followUpDocument) {
          const fu = body.followUpDocument;
          if (!fu || !fu.data) {
            return sendJson(res, 400, {
              success: false,
              error: "Follow-up document file data is required.",
            });
          }

          const savedDoc = saveBase64File(fu, `${id}_followup`);
          let docs = Array.isArray(currentApp.documents)
            ? [...currentApp.documents]
            : [];
          const targetReq = String(
            fu.requirement || fu.title || fu.name || "",
          )
            .toLowerCase()
            .trim();
          let replaced = false;

          docs = docs.map((d) => {
            const dTitle =
              typeof d === "string"
                ? d
                : d.requirement || d.title || d.name || "";
            const isFu =
              typeof d === "string"
                ? d.includes("(To Follow Up)")
                : Boolean(d.isFollowUp || d.status === "to_follow_up");
            if (!replaced && isFu && targetReq && dTitle.toLowerCase().includes(targetReq)) {
              replaced = true;
              return savedDoc;
            }
            return d;
          });

          if (!replaced) {
            const firstFuIdx = docs.findIndex((d) =>
              typeof d === "string"
                ? d.includes("(To Follow Up)")
                : Boolean(d.isFollowUp || d.status === "to_follow_up"),
            );
            if (firstFuIdx !== -1) {
              docs[firstFuIdx] = savedDoc;
            } else {
              docs.push(savedDoc);
            }
          }

          currentApp.documents = docs;
          currentApp.uploadedDocuments = docs
            .filter((d) =>
              typeof d === "string"
                ? !d.includes("(To Follow Up)")
                : !d.isFollowUp && d.status !== "to_follow_up",
            )
            .map((d) => (typeof d === "string" ? d : d.name));

          data.notifications = data.notifications || [];
          data.notifications.unshift({
            id: makeId("notif"),
            recipient: "provider",
            title: "Follow-Up Document Submitted",
            message: `${currentApp.studentName} attached "${savedDoc.name}" for "${currentApp.scholarshipTitle}".`,
            timestamp: new Date().toISOString(),
            formattedTime: "Just now",
            read: false,
            link: "provider-applications.html",
            appId: id,
          });
        }

        const updatedRemarks =
          body.remarks !== undefined
            ? body.remarks
            : body.feedback !== undefined
            ? body.feedback
            : body.notes !== undefined
            ? body.notes
            : currentApp.remarks || currentApp.feedback || currentApp.notes || "";

        data.applications[appIndex] = {
          ...currentApp,
          status: updatedStatus,
          statusText: updatedStatus,
          notes: updatedRemarks,
          feedback: updatedRemarks,
          remarks: updatedRemarks,
          reviewedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        if (body.status !== undefined && body.status !== previousStatus) {
          const remarksSnippet = updatedRemarks ? ` Provider Remarks: "${updatedRemarks}"` : "";
          data.notifications = data.notifications || [];
          data.notifications.unshift({
            id: makeId("notif"),
            recipient: "student",
            recipientEmail: currentApp.studentEmail || "",
            title: `Application Status: ${updatedStatus}`,
            message: `Your application for "${currentApp.scholarshipTitle}" is now ${updatedStatus}.${remarksSnippet}`,
            timestamp: new Date().toISOString(),
            formattedTime: "Just now",
            read: false,
            link: "student-submissions.html",
            appId: id,
          });
        }

        if (!writeData(data)) {
          return sendJson(res, 500, {
            success: false,
            message: "Failed to save application changes to data.json.",
          });
        }
        return sendJson(res, 200, {
          success: true,
          message: "Application updated successfully.",
          application: data.applications[appIndex],
        });
      }

      return sendJson(res, 405, { success: false, error: "Method not allowed" });
    }

    // 5. PROVIDER SETTINGS API
    if (pathname === "/api/settings") {
      const data = readData();
      if (method === "GET") {
        return sendJson(res, 200, data.settings || cloneDefaultData().settings);
      }

      if (method === "POST" || method === "PUT" || method === "PATCH") {
        const body = await parseRequestBody(req);
        const current = data.settings || cloneDefaultData().settings;

        const updated = {
          ...current,
          orgName:
            body.orgName !== undefined
              ? String(body.orgName).trim()
              : current.orgName,
          location:
            body.location !== undefined
              ? String(body.location).trim()
              : current.location,
          contactPerson:
            body.contactPerson !== undefined
              ? String(body.contactPerson).trim()
              : current.contactPerson,
          contactNumber:
            body.contactNumber !== undefined
              ? String(body.contactNumber).trim()
              : current.contactNumber,
          email:
            body.email !== undefined
              ? String(body.email).trim()
              : current.email,
          bio: body.bio !== undefined ? String(body.bio).trim() : current.bio,
          bannerImage:
            body.bannerImage !== undefined
              ? body.bannerImage
              : current.bannerImage,
          logoImage:
            body.logoImage !== undefined ? body.logoImage : current.logoImage,
          notifications: {
            ...current.notifications,
            ...(body.notifications || {}),
          },
          preferences: {
            ...current.preferences,
            ...(body.preferences || {}),
          },
          updatedAt: new Date().toISOString(),
        };

        data.settings = updated;
        if (!writeData(data)) {
          return sendJson(res, 500, {
            success: false,
            message: "Failed to save settings to data.json.",
          });
        }
        return sendJson(res, 200, {
          success: true,
          message: "Settings saved successfully to data.json",
          settings: updated,
        });
      }

      return sendJson(res, 405, { success: false, error: "Method not allowed" });
    }

    // Password Update API (Verifies currentPassword and updates data.users)
    if (pathname === "/api/settings/password") {
      if (method !== "POST") {
        return sendJson(res, 405, { success: false, error: "Method not allowed" });
      }
      const body = await parseRequestBody(req);
      const { currentPassword, newPassword, confirmPassword } = body;
      const targetEmail = String(body.email || "").trim().toLowerCase();
      const targetRole = String(body.role || "").trim().toLowerCase();

      if (!currentPassword || !newPassword || !confirmPassword) {
        return sendJson(res, 400, {
          success: false,
          message: "Please fill out all password fields.",
        });
      }
      if (String(newPassword).length < 8) {
        return sendJson(res, 400, {
          success: false,
          message: "New password must be at least 8 characters long.",
        });
      }
      if (newPassword !== confirmPassword) {
        return sendJson(res, 400, {
          success: false,
          message: "New passwords do not match.",
        });
      }

      const data = readData();
      data.users = data.users || [];

      let user = null;
      if (targetEmail) {
        user = data.users.find(
          (u) => String(u.email || "").toLowerCase() === targetEmail,
        );
      }
      if (!user && targetRole) {
        user = data.users.find((u) => u.role === targetRole);
      }

      if (!user) {
        return sendJson(res, 404, {
          success: false,
          message: "Active user account not found.",
        });
      }
      if (String(user.password || "") !== String(currentPassword)) {
        return sendJson(res, 401, {
          success: false,
          message: "Current password is incorrect.",
        });
      }

      user.password = String(newPassword);
      user.updatedAt = new Date().toISOString();
      data.passwordUpdated = user.updatedAt;

      if (!writeData(data)) {
        return sendJson(res, 500, {
          success: false,
          message: "Failed to persist updated password.",
        });
      }
      return sendJson(res, 200, {
        success: true,
        message: "Password updated successfully!",
      });
    }

    // Email Change Request API
    if (pathname === "/api/settings/email-request") {
      if (method !== "POST") {
        return sendJson(res, 405, { success: false, error: "Method not allowed" });
      }
      const body = await parseRequestBody(req);
      const { newEmail, reason } = body;

      if (!newEmail || !String(newEmail).includes("@")) {
        return sendJson(res, 400, {
          success: false,
          message: "Please provide a valid new email address.",
        });
      }

      const data = readData();
      data.pendingEmailRequests = data.pendingEmailRequests || [];
      data.pendingEmailRequests.unshift({
        id: makeId("req"),
        newEmail: String(newEmail).trim(),
        reason: String(reason || "").trim(),
        requestedAt: new Date().toISOString(),
        status: "Pending Verification",
      });

      if (!writeData(data)) {
        return sendJson(res, 500, {
          success: false,
          message: "Failed to record email change request.",
        });
      }
      return sendJson(res, 200, {
        success: true,
        message: `Email change request submitted! Verification sent to ${newEmail}`,
      });
    }

    // 6. STUDENT SETTINGS API (Multi-Account Profile Isolation)
    if (pathname === "/api/student-settings") {
      const data = readData();
      const queryEmail = String(reqUrl.searchParams.get("email") || "")
        .toLowerCase()
        .trim();

      if (method === "GET") {
        if (queryEmail) {
          data.studentProfiles = data.studentProfiles || {};
          if (data.studentProfiles[queryEmail]) {
            return sendJson(res, 200, data.studentProfiles[queryEmail]);
          }
          const matched = (data.users || []).find(
            (u) => String(u.email || "").toLowerCase() === queryEmail,
          );
          const localPrefix = queryEmail.split("@")[0] || "";
          const profile = {
            fullName: (matched && matched.name) || "",
            email: queryEmail,
            university:
              (matched && matched.university) ||
              (queryEmail.includes("batstate-u")
                ? "Batangas State University"
                : ""),
            course: (matched && matched.course) || "",
            yearLevel: (matched && matched.yearLevel) || "",
            studentId:
              (matched && matched.studentId) ||
              (/^\d{2}-\d{4,6}$/.test(localPrefix) ? localPrefix : ""),
            contactNumber: "",
            bio: "",
            profilePicture: "",
            notifications: {
              scholarshipMatches: true,
              applicationUpdates: true,
              deadlineReminders: true,
            },
            preferences: {
              theme: "light",
            },
          };
          return sendJson(res, 200, profile);
        }

        return sendJson(
          res,
          200,
          data.studentSettings || cloneDefaultData().studentSettings,
        );
      }

      if (method === "POST" || method === "PUT" || method === "PATCH") {
        const body = await parseRequestBody(req);
        const email = String(body.email || queryEmail || "")
          .toLowerCase()
          .trim();

        if (!email) {
          return sendJson(res, 400, {
            success: false,
            message: "Student email is required to update profile settings.",
          });
        }

        data.studentProfiles = data.studentProfiles || {};
        const localPrefix = email.split("@")[0] || "";
        const current = data.studentProfiles[email] || {
          fullName: "",
          email,
          university: email.includes("batstate-u")
            ? "Batangas State University"
            : "",
          course: "",
          yearLevel: "",
          studentId: /^\d{2}-\d{4,6}$/.test(localPrefix) ? localPrefix : "",
          contactNumber: "",
          bio: "",
          profilePicture: "",
          notifications: {
            scholarshipMatches: true,
            applicationUpdates: true,
            deadlineReminders: true,
          },
          preferences: {
            theme: "light",
          },
        };

        const updated = {
          ...current,
          fullName:
            body.fullName !== undefined
              ? String(body.fullName).trim()
              : current.fullName,
          email: email || current.email,
          university:
            body.university !== undefined
              ? String(body.university).trim()
              : current.university,
          course:
            body.course !== undefined
              ? String(body.course).trim()
              : current.course,
          yearLevel:
            body.yearLevel !== undefined
              ? String(body.yearLevel).trim()
              : current.yearLevel,
          studentId:
            body.studentId !== undefined
              ? String(body.studentId).trim()
              : current.studentId,
          contactNumber:
            body.contactNumber !== undefined
              ? String(body.contactNumber).trim()
              : current.contactNumber,
          bio: body.bio !== undefined ? String(body.bio).trim() : current.bio,
          profilePicture:
            body.profilePicture !== undefined
              ? body.profilePicture
              : current.profilePicture,
          notifications: {
            ...current.notifications,
            ...(body.notifications || {}),
          },
          preferences: {
            ...current.preferences,
            ...(body.preferences || {}),
          },
          updatedAt: new Date().toISOString(),
        };

        data.studentProfiles[email] = updated;

        if (
          data.studentSettings &&
          String(data.studentSettings.email || "").toLowerCase() === email
        ) {
          data.studentSettings = updated;
        }

        if (Array.isArray(data.users)) {
          const u = data.users.find(
            (user) => String(user.email || "").toLowerCase() === email,
          );
          if (u) {
            if (body.fullName !== undefined) u.name = String(body.fullName).trim();
            if (body.university !== undefined) u.university = String(body.university).trim();
            if (body.course !== undefined) u.course = String(body.course).trim();
            if (body.yearLevel !== undefined) u.yearLevel = String(body.yearLevel).trim();
            if (body.studentId !== undefined) u.studentId = String(body.studentId).trim();
          }
        }

        if (
          body.profilePicture !== undefined &&
          Array.isArray(data.applications)
        ) {
          data.applications.forEach((app) => {
            if (String(app.studentEmail || "").toLowerCase() === email) {
              app.studentProfilePic = updated.profilePicture;
              app.profilePicture = updated.profilePicture;
            }
          });
        }

        if (!writeData(data)) {
          return sendJson(res, 500, {
            success: false,
            message: "Failed to save student settings to data.json.",
          });
        }
        return sendJson(res, 200, {
          success: true,
          message: "Student settings saved successfully to data.json",
          settings: updated,
        });
      }

      return sendJson(res, 405, { success: false, error: "Method not allowed" });
    }

    // 6b. NOTIFICATIONS API
    if (pathname === "/api/notifications") {
      const data = readData();
      data.notifications = data.notifications || [];
      const recipient = reqUrl.searchParams.get("recipient");
      const queryEmail = String(reqUrl.searchParams.get("email") || "")
        .toLowerCase()
        .trim();

      if (method === "GET") {
        let filtered = data.notifications;
        if (recipient) {
          filtered = filtered.filter((n) => {
            const roleOk =
              !n.recipient || n.recipient === recipient || n.recipient === "all";
            if (!roleOk) return false;
            if (queryEmail && n.recipientEmail) {
              return String(n.recipientEmail).toLowerCase() === queryEmail;
            }
            return true;
          });
        }
        return sendJson(res, 200, filtered);
      }

      if (method === "POST") {
        const body = await parseRequestBody(req);
        const newNotif = {
          id: makeId("notif"),
          recipient: body.recipient || "all",
          recipientEmail: body.recipientEmail || "",
          title: String(body.title || "New Notification").trim(),
          message: String(body.message || "").trim(),
          timestamp: new Date().toISOString(),
          formattedTime: "Just now",
          read: false,
          link: body.link || "#",
        };
        data.notifications.unshift(newNotif);
        if (!writeData(data)) {
          return sendJson(res, 500, {
            success: false,
            error: "Failed to save notification.",
          });
        }
        return sendJson(res, 201, newNotif);
      }

      return sendJson(res, 405, { success: false, error: "Method not allowed" });
    }

    // POST /api/notifications/read
    if (pathname === "/api/notifications/read") {
      if (method !== "POST") {
        return sendJson(res, 405, { success: false, error: "Method not allowed" });
      }
      const body = await parseRequestBody(req);
      const data = readData();
      data.notifications = data.notifications || [];
      const targetRecipient = body.recipient;
      const targetId = body.id;

      data.notifications.forEach((n) => {
        if (targetId) {
          if (String(n.id) === String(targetId)) n.read = true;
        } else if (targetRecipient) {
          if (
            !n.recipient ||
            n.recipient === targetRecipient ||
            n.recipient === "all"
          ) {
            n.read = true;
          }
        } else {
          n.read = true;
        }
      });

      if (!writeData(data)) {
        return sendJson(res, 500, {
          success: false,
          message: "Failed to update notifications.",
        });
      }
      return sendJson(res, 200, {
        success: true,
        message: "Notifications marked as read",
      });
    }

    // DELETE /api/notifications/:id
    if (pathname.startsWith("/api/notifications/")) {
      if (method !== "DELETE") {
        return sendJson(res, 405, { success: false, error: "Method not allowed" });
      }
      const targetId = pathname.replace("/api/notifications/", "").split("/")[0];
      const data = readData();
      data.notifications = (data.notifications || []).filter(
        (n) => String(n.id) !== String(targetId),
      );
      if (!writeData(data)) {
        return sendJson(res, 500, {
          success: false,
          message: "Failed to delete notification.",
        });
      }
      return sendJson(res, 200, {
        success: true,
        message: "Notification deleted permanently",
      });
    }

    // ==========================================================================
    // 7. DEVELOPER ADMINISTRATOR & USER ACCOUNTS ENGINE
    // ==========================================================================
    if (pathname === "/api/users") {
      if (method === "GET") {
        const data = readData();
        return sendJson(res, 200, data.users || []);
      }

      if (method === "POST") {
        const body = await parseRequestBody(req);
        const data = readData();
        data.users = data.users || [];

        const email = String(body.email || "").trim().toLowerCase();
        const role =
          String(body.role || "student").trim().toLowerCase() === "provider"
            ? "provider"
            : "student";
        const name =
          String(body.name || "").trim() ||
          (role === "provider" ? "Scholarship Provider" : "");
        const university = String(body.university || "").trim();
        const course = String(body.course || "").trim();
        const status = body.status === "banned" ? "banned" : "active";

        if (!email || !email.includes("@")) {
          return sendJson(res, 400, {
            success: false,
            error: "A valid email address is required.",
          });
        }

        const existing = data.users.find(
          (u) => String(u.email || "").toLowerCase() === email,
        );
        if (existing) {
          return sendJson(res, 400, {
            success: false,
            error: `An account with email "${email}" already exists.`,
          });
        }

        const password = String(body.password || "").trim() || "password123";
        const localPrefix = email.split("@")[0] || "";
        const inferredStudentId =
          role === "student" && /^\d{2}-\d{4,6}$/.test(localPrefix)
            ? localPrefix
            : "";

        const newUser = {
          id: makeId(role === "provider" ? "usr_prov" : "usr_stud"),
          email,
          password,
          role,
          name,
          orgName: role === "provider" ? name : undefined,
          university:
            role === "student"
              ? university ||
                (email.includes("batstate-u") ? "Batangas State University" : "")
              : undefined,
          course: role === "student" ? course : undefined,
          studentId:
            role === "student"
              ? String(body.studentId || inferredStudentId).trim()
              : undefined,
          status,
          createdAt: new Date().toISOString(),
          formattedDate: new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          notes:
            body.notes ||
            (body.createdByAdmin
              ? "Created by Developer Admin"
              : "Registered Account"),
        };

        data.users.unshift(newUser);

        if (role === "student") {
          data.studentProfiles = data.studentProfiles || {};
          if (!data.studentProfiles[email]) {
            data.studentProfiles[email] = {
              fullName: name,
              email,
              university: newUser.university || "",
              course: course || "",
              yearLevel: "",
              studentId: newUser.studentId || "",
              contactNumber: "",
              bio: "",
              profilePicture: "",
              notifications: {
                scholarshipMatches: true,
                applicationUpdates: true,
                deadlineReminders: true,
              },
              preferences: { theme: "light" },
            };
          }
        }

        if (!writeData(data)) {
          return sendJson(res, 500, {
            success: false,
            error: "Failed to save user account to data.json.",
          });
        }
        return sendJson(res, 201, { success: true, user: newUser });
      }

      return sendJson(res, 405, { success: false, error: "Method not allowed" });
    }

    // PATCH/PUT/DELETE /api/users/:id
    if (pathname.startsWith("/api/users/")) {
      const id = pathname.replace("/api/users/", "").split("/")[0];

      if (method === "PATCH" || method === "PUT") {
        const body = await parseRequestBody(req);
        const data = readData();
        data.users = data.users || [];

        const userIdx = data.users.findIndex((u) => String(u.id) === String(id));
        if (userIdx === -1) {
          return sendJson(res, 404, {
            success: false,
            error: "User account not found.",
          });
        }

        if (body.status !== undefined) {
          data.users[userIdx].status =
            body.status === "banned" ? "banned" : "active";
        }
        if (body.name !== undefined) {
          data.users[userIdx].name = String(body.name).trim();
        }
        if (body.notes !== undefined) {
          data.users[userIdx].notes = String(body.notes).trim();
        }
        data.users[userIdx].updatedAt = new Date().toISOString();

        if (!writeData(data)) {
          return sendJson(res, 500, {
            success: false,
            error: "Failed to update user account.",
          });
        }
        return sendJson(res, 200, { success: true, user: data.users[userIdx] });
      }

      if (method === "DELETE") {
        const data = readData();
        data.users = data.users || [];

        const user = data.users.find((u) => String(u.id) === String(id));
        if (!user) {
          return sendJson(res, 404, {
            success: false,
            error: "User account not found.",
          });
        }

        const userEmailLower = String(user.email || "").toLowerCase();
        data.users = data.users.filter((u) => String(u.id) !== String(id));

        let removedPostsCount = 0;
        let removedAppsCount = 0;

        if (user.role === "student") {
          const matchingApps = (data.applications || []).filter((a) => {
            const emailMatch =
              String(a.studentEmail || "").toLowerCase() === userEmailLower;
            const idMatch = user.studentId && a.studentId === user.studentId;
            return emailMatch || idMatch;
          });
          cleanupUploadedFilesForApplications(matchingApps);

          const initialAppCount = (data.applications || []).length;
          data.applications = (data.applications || []).filter((a) => {
            const emailMatch =
              String(a.studentEmail || "").toLowerCase() === userEmailLower;
            const idMatch = user.studentId && a.studentId === user.studentId;
            return !emailMatch && !idMatch;
          });
          removedAppsCount = initialAppCount - data.applications.length;

          if (data.studentProfiles && userEmailLower) {
            delete data.studentProfiles[userEmailLower];
          }
          syncScholarshipApplicantCounts(data);
        } else if (user.role === "provider") {
          const matchesProvider = (item) => {
            const nameMatch =
              item.providerName &&
              (item.providerName === user.name ||
                item.providerName === user.orgName ||
                item.providerName === user.email);
            const emailMatch =
              item.providerEmail &&
              String(item.providerEmail).toLowerCase() === userEmailLower;
            return Boolean(nameMatch || emailMatch);
          };

          const providerScholarshipIds = (data.scholarships || [])
            .filter(matchesProvider)
            .map((s) => String(s.id));

          removedPostsCount = providerScholarshipIds.length;

          data.scholarships = (data.scholarships || []).filter(
            (s) => !providerScholarshipIds.includes(String(s.id)),
          );
          data.drafts = (data.drafts || []).filter((d) => !matchesProvider(d));

          const appsToDelete = (data.applications || []).filter((a) =>
            providerScholarshipIds.includes(String(a.scholarshipId)),
          );
          cleanupUploadedFilesForApplications(appsToDelete);

          const initialAppCount = (data.applications || []).length;
          data.applications = (data.applications || []).filter(
            (a) => !providerScholarshipIds.includes(String(a.scholarshipId)),
          );
          removedAppsCount = initialAppCount - data.applications.length;
        }

        if (!writeData(data)) {
          return sendJson(res, 500, {
            success: false,
            error: "Failed to persist cascade deletion.",
          });
        }
        return sendJson(res, 200, {
          success: true,
          message: `Account "${user.email}" deleted. Removed ${removedPostsCount} scholarship post(s) and ${removedAppsCount} student application(s).`,
          deletedId: id,
          deletedRole: user.role,
          removedPostsCount,
          removedAppsCount,
        });
      }

      return sendJson(res, 405, { success: false, error: "Method not allowed" });
    }

    // POST /api/admin/clean-database
    if (pathname === "/api/admin/clean-database") {
      if (method !== "POST") {
        return sendJson(res, 405, { success: false, error: "Method not allowed" });
      }
      const body = await parseRequestBody(req);
      const data = readData();

      if (body.action === "clear_applications") {
        const count = (data.applications || []).length;
        cleanupUploadedFilesForApplications(data.applications);
        data.applications = [];
        syncScholarshipApplicantCounts(data);
        if (!writeData(data)) {
          return sendJson(res, 500, {
            success: false,
            error: "Failed to clear applications.",
          });
        }
        return sendJson(res, 200, {
          success: true,
          message: `Successfully cleared all ${count} applications from data.json.`,
        });
      }

      if (body.action === "clear_drafts") {
        const count = (data.drafts || []).length;
        data.drafts = [];
        if (!writeData(data)) {
          return sendJson(res, 500, {
            success: false,
            error: "Failed to clear drafts.",
          });
        }
        return sendJson(res, 200, {
          success: true,
          message: `Successfully cleared all ${count} drafts from data.json.`,
        });
      }

      if (body.action === "delete_scholarship" && body.id) {
        const targetId = String(body.id);
        data.scholarships = (data.scholarships || []).filter(
          (s) => String(s.id) !== targetId,
        );
        const removedApps = (data.applications || []).filter(
          (a) => String(a.scholarshipId) === targetId,
        );
        cleanupUploadedFilesForApplications(removedApps);
        const prevApps = (data.applications || []).length;
        data.applications = (data.applications || []).filter(
          (a) => String(a.scholarshipId) !== targetId,
        );
        const appsRemoved = prevApps - data.applications.length;
        syncScholarshipApplicantCounts(data);
        if (!writeData(data)) {
          return sendJson(res, 500, {
            success: false,
            error: "Failed to delete scholarship.",
          });
        }
        return sendJson(res, 200, {
          success: true,
          message: `Scholarship deleted. ${appsRemoved} associated application(s) removed.`,
        });
      }

      if (body.action === "reset_factory_data") {
        const defaults = cloneDefaultData();
        cleanupUploadedFilesForApplications(data.applications);
        data.applications = [];
        data.drafts = [];
        data.notifications = defaults.notifications;
        data.users = defaults.users;
        data.studentProfiles = defaults.studentProfiles;
        (data.scholarships || []).forEach((s) => {
          const limit = parseInt(s.applicantLimit || 200, 10) || 200;
          s.applicantTotal = 0;
          s.applicantCount = `0 / ${limit} Applicants`;
          if (String(s.status || "").toLowerCase() === "quota full") {
            s.status = "Open";
          }
        });
        if (!writeData(data)) {
          return sendJson(res, 500, {
            success: false,
            error: "Failed to reset database.",
          });
        }
        return sendJson(res, 200, {
          success: true,
          message:
            "Database sanitized and reset to clean factory state with default accounts.",
        });
      }

      return sendJson(res, 400, { success: false, error: "Invalid clean action" });
    }

    // GET /api/admin/export-database
    if (pathname === "/api/admin/export-database") {
      if (method !== "GET") {
        return sendJson(res, 405, { success: false, error: "Method not allowed" });
      }
      const data = readData();
      res.writeHead(200, {
        "Content-Type": "application/json; charset=UTF-8",
        "Content-Disposition": 'attachment; filename="nexo_database_backup.json"',
        "Access-Control-Allow-Origin": "*",
      });
      return res.end(JSON.stringify(data, null, 2));
    }

    // Catch-all for unknown /api/* routes (never fall through to HTML static serving)
    if (pathname === "/api" || pathname.startsWith("/api/")) {
      return sendJson(res, 404, {
        success: false,
        error: `API endpoint not found: ${method} ${pathname}`,
      });
    }

    // -------------------------------------------------------------
    // STATIC FILE SERVING (Sandboxed to public frontend files)
    // -------------------------------------------------------------
    let normalizedUrlPath = pathname.replace(/\\/g, "/");
    if (normalizedUrlPath === "/" || normalizedUrlPath === "") {
      normalizedUrlPath = "/index.html";
    }

    // Block sensitive backend, config, database, and hidden files
    const lowerUrlPath = normalizedUrlPath.toLowerCase();
    const hasDotSegment = lowerUrlPath
      .split("/")
      .some((seg) => seg.startsWith(".") && seg.length > 1);
    const isBlockedPrefix = BLOCKED_STATIC_PREFIXES.some((p) =>
      lowerUrlPath.startsWith(p),
    );
    if (
      hasDotSegment ||
      isBlockedPrefix ||
      BLOCKED_STATIC_FILES.has(lowerUrlPath)
    ) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=UTF-8" });
      res.end("403 Forbidden");
      return;
    }

    const filePath = path.resolve(PROJECT_ROOT, "." + normalizedUrlPath);
    if (
      filePath !== PROJECT_ROOT &&
      !filePath.startsWith(PROJECT_ROOT + path.sep)
    ) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=UTF-8" });
      res.end("403 Forbidden");
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        if (res.headersSent) return;
        const safePath = escapeHtml(pathname);
        res.writeHead(404, {
          "Content-Type": "text/html; charset=UTF-8",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(`<!doctype html>
<html lang="en">
<head><meta charset="UTF-8"><title>404 Not Found - NEXO</title></head>
<body style="font-family: sans-serif; text-align: center; padding: 50px;">
  <h2>404 - Page or Resource Not Found</h2>
  <p>Requested: <code>${safePath}</code></p>
  <a href="/index.html" style="color: #6941C6; font-weight: bold;">Return to Home</a>
</body>
</html>`);
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";
      const isUploadAsset = lowerUrlPath.startsWith("/uploads/");

      const headers = {
        "Content-Type": contentType,
        "Content-Length": stats.size,
        "Access-Control-Allow-Origin": "*",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600",
      };
      if (isUploadAsset && !ALLOWED_UPLOAD_EXTS.has(ext)) {
        headers["Content-Disposition"] = "attachment";
      }

      res.writeHead(200, headers);

      const readStream = fs.createReadStream(filePath);
      readStream.on("error", (streamErr) => {
        console.error("[Static Stream Error]:", streamErr.message);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "text/plain; charset=UTF-8" });
          res.end("500 Internal Server Error");
        } else {
          res.destroy();
        }
      });
      readStream.pipe(res);
    });
  } catch (err) {
    const statusCode = err && err.statusCode ? err.statusCode : 500;
    const message =
      statusCode >= 500
        ? "Internal server error while processing request."
        : err.message || "Bad request.";
    if (statusCode >= 500) {
      console.error("[Unhandled Server Error]:", err);
    }
    if (!res.headersSent) {
      sendJson(res, statusCode, {
        success: false,
        error: message,
        message,
      });
    } else {
      res.destroy();
    }
  }
}

// Start HTTP Server
const server = http.createServer(handleRequest);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n======================================================`);
  console.log(`  NEXO Scholarship Portal - Local Server Running!`);
  console.log(`  Landing & Login    : http://localhost:${PORT}/index.html`);
  console.log(
    `  Provider Dashboard : http://localhost:${PORT}/provider-dashboard.html`,
  );
  console.log(
    `  Student Dashboard  : http://localhost:${PORT}/student-dashboard.html`,
  );
  console.log(`  Live JSON Storage  : ${DATA_FILE_BACKEND}`);
  console.log(`  Uploaded Files Dir : ${UPLOADS_DIR}`);
  console.log(`======================================================\n`);
});

module.exports = server;
