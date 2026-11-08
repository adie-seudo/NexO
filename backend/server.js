// ==========================================================================
// NEXO SCHOLARSHIP PORTAL - LOCAL BACKEND SERVER & FILE HANDLING ENGINE
// Handles static assets, JSON persistence (data.json), document uploads,
// live provider-student synchronization, and REST API endpoints.
// Works seamlessly with zero external dependencies (built-in Node http)
// and supports Express if installed.
// ==========================================================================

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = process.env.PORT || 3000;

// Path configuration
const BACKEND_DIR = __dirname;
const PROJECT_ROOT = path.join(__dirname, "..");
const DATA_FILE_BACKEND = path.join(BACKEND_DIR, "data.json");
const DATA_FILE_ROOT = path.join(PROJECT_ROOT, "data.json");
const UPLOADS_DIR = path.join(PROJECT_ROOT, "uploads");

// Ensure uploads folder exists on local filesystem
if (!fs.existsSync(UPLOADS_DIR)) {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    console.log("Created uploads directory at:", UPLOADS_DIR);
  } catch (err) {
    console.error("Could not create uploads directory:", err);
  }
}

// Initial default schema
const DEFAULT_DATA = {
  scholarships: [],
  drafts: [],
  applications: [],
  notifications: [
    {
      id: "notif_welcome_prov",
      recipient: "provider",
      title: "Welcome to Provider Portal",
      message:
        "Manage your scholarship programs and student applications seamlessly.",
      timestamp: new Date().toISOString(),
      formattedTime: "Just now",
      read: false,
      link: "provider-applications.html",
    },
    {
      id: "notif_welcome_stud",
      recipient: "student",
      title: "Welcome to Student Portal",
      message:
        "Explore available scholarship programs and submit applications online.",
      timestamp: new Date().toISOString(),
      formattedTime: "Just now",
      read: false,
      link: "student-browse.html",
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
    fullName: "Juan Dela Cruz",
    email: "admin@admin.edu.ph",
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
};

// Helper: Read data from data.json
function readData() {
  try {
    let filePath = DATA_FILE_BACKEND;
    if (!fs.existsSync(filePath)) {
      if (fs.existsSync(DATA_FILE_ROOT)) {
        filePath = DATA_FILE_ROOT;
      } else {
        writeData(DEFAULT_DATA);
        return DEFAULT_DATA;
      }
    }
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed.scholarships) parsed.scholarships = [];
    if (!parsed.drafts) parsed.drafts = [];
    if (!parsed.applications) parsed.applications = [];
    if (!parsed.notifications)
      parsed.notifications = DEFAULT_DATA.notifications || [];
    if (!parsed.settings) parsed.settings = DEFAULT_DATA.settings;
    if (!parsed.studentSettings)
      parsed.studentSettings = DEFAULT_DATA.studentSettings;
    return parsed;
  } catch (err) {
    console.error("Error reading data.json:", err);
    return DEFAULT_DATA;
  }
}

// Helper: Write data to both backend/data.json and root data.json
function writeData(data) {
  try {
    const jsonStr = JSON.stringify(data, null, 2);
    fs.writeFileSync(DATA_FILE_BACKEND, jsonStr, "utf8");
    try {
      fs.writeFileSync(DATA_FILE_ROOT, jsonStr, "utf8");
    } catch (_) {}
    return true;
  } catch (err) {
    console.error("Error writing data.json:", err);
    return false;
  }
}

// Helper: Save a base64 encoded document to local uploads folder
function saveBase64File(doc, prefix) {
  if (!doc || !doc.data) return doc;
  try {
    // Expected format: data:application/pdf;base64,... or data:image/png;base64,...
    const matches = doc.data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let buffer;
    if (matches && matches.length === 3) {
      buffer = Buffer.from(matches[2], "base64");
    } else {
      buffer = Buffer.from(doc.data, "base64");
    }

    const safeName = (doc.name || "document")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .toLowerCase();
    const diskFileName = `${prefix}_${Date.now()}_${safeName}`;
    const diskPath = path.join(UPLOADS_DIR, diskFileName);

    fs.writeFileSync(diskPath, buffer);
    console.log(
      `[File Handling] Stored document on disk: ${diskPath} (${buffer.length} bytes)`,
    );

    return {
      name: doc.name || safeName,
      size: doc.size || buffer.length,
      type: doc.type || (matches ? matches[1] : "application/octet-stream"),
      fileUrl: `/uploads/${diskFileName}`,
      uploadedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error("Error saving document to uploads:", err);
    return {
      name: doc.name || "document",
      size: doc.size || 0,
      type: doc.type || "application/octet-stream",
      fileUrl: "",
      error: "Could not save file to disk",
    };
  }
}

// Helper: Recalculate scholarship applicant counts based on current applications and keep student avatars synced
function syncScholarshipApplicantCounts(data) {
  if (Array.isArray(data.applications)) {
    const studentPic =
      (data.studentSettings && data.studentSettings.profilePicture) || "";
    data.applications.forEach((app) => {
      if (!app.studentProfilePic && !app.profilePicture && studentPic) {
        app.studentProfilePic = studentPic;
        app.profilePicture = studentPic;
      }
    });
  }

  if (!Array.isArray(data.scholarships) || !Array.isArray(data.applications))
    return;
  const countMap = {};
  data.applications.forEach((app) => {
    if (app.scholarshipId) {
      countMap[app.scholarshipId] = (countMap[app.scholarshipId] || 0) + 1;
    }
  });

  const scholMap = {};
  data.scholarships.forEach((s) => {
    const count = countMap[s.id] || 0;
    const limit =
      parseInt(s.applicantLimit || s.maxApplicants || 200, 10) || 200;
    s.applicantLimit = limit;
    s.maxApplicants = limit;
    s.applicantTotal = count;
    s.applicantCount = `${count} / ${limit} Applicants`;
    if (count >= limit && (s.status || "").toLowerCase() !== "closed") {
      s.status = "Quota Full";
    }
    scholMap[s.id] = s;
  });

  data.applications.forEach((app) => {
    if (app.scholarshipId && scholMap[app.scholarshipId]) {
      app.applicantCount = scholMap[app.scholarshipId].applicantCount;
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
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain; charset=UTF-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

// Send JSON Helper
function sendJson(res, statusCode, payload) {
  const jsonStr = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Requested-With",
  });
  res.end(jsonStr);
}

// Read JSON Request Body Helper
function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      // 50MB Safety Limit for file handling / Base64 uploads
      if (body.length > 50 * 1024 * 1024) {
        req.destroy();
        reject(new Error("Payload Too Large"));
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        resolve({});
      }
    });
    req.on("error", (err) => reject(err));
  });
}

// ==========================================================================
// HTTP REQUEST HANDLER
// ==========================================================================
async function handleRequest(req, res) {
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
    req.url,
    "http://" + (req.headers.host || "localhost:3000"),
  );
  const pathname = reqUrl.pathname;
  const method = req.method.toUpperCase();

  // -------------------------------------------------------------
  // API ROUTES
  // -------------------------------------------------------------

  // 1. GET /api/data (Full live system sync)
  if (pathname === "/api/data" && method === "GET") {
    const data = readData();
    syncScholarshipApplicantCounts(data);
    return sendJson(res, 200, data);
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
        id: body.id || "schol_" + Date.now(),
        title: (body.title || "Untitled Scholarship").trim(),
        desc: (body.desc || "").trim(),
        type: body.type || "Other",
        typeText: body.typeText || body.type || "Other",
        deadline: body.deadline || "",
        formattedDate: body.formattedDate || "No Deadline",
        applicantLimit: limit,
        maxApplicants: limit,
        applicantTotal: 0,
        applicantCount: `0 / ${limit} Applicants`,
        postedAt: postedAt,
        formattedPostedDate: formattedPostedDate,
        createdAt: postedAt,
        requirements: Array.isArray(body.requirements) ? body.requirements : [],
        providerName: body.providerName || data.settings.orgName || "NEXO",
        providerLogo: body.providerLogo || data.settings.logoImage || "",
        providerBanner: body.providerBanner || data.settings.bannerImage || "",
        status: body.status || "Open",
      };

      data.scholarships.unshift(newScholarship);

      // Add live student notification about new scholarship
      data.notifications = data.notifications || [];
      data.notifications.unshift({
        id: "notif_" + Date.now(),
        recipient: "student",
        title: "New Scholarship Posted",
        message: `${newScholarship.providerName} published "${newScholarship.title}". Applications are now open!`,
        timestamp: new Date().toISOString(),
        formattedTime: "Just now",
        read: false,
        link: "student-browse.html",
        scholarshipId: newScholarship.id,
      });

      // If published from an existing draft, remove draft
      if (body.draftId) {
        data.drafts = (data.drafts || []).filter(
          (d) => String(d.id) !== String(body.draftId),
        );
      }

      writeData(data);
      console.log(
        `[Scholarship Created] "${newScholarship.title}" by ${newScholarship.providerName}`,
      );
      return sendJson(res, 201, newScholarship);
    }
  }

  // DELETE /api/scholarships/:id
  if (pathname.startsWith("/api/scholarships/") && method === "DELETE") {
    const id = pathname.replace("/api/scholarships/", "");
    const data = readData();
    data.scholarships = (data.scholarships || []).filter(
      (s) => String(s.id) !== String(id),
    );
    writeData(data);
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

      const draftId = body.id;
      const existingIdx = draftId
        ? data.drafts.findIndex((d) => String(d.id) === String(draftId))
        : -1;

      const draftItem = {
        id: draftId || "draft_" + Date.now(),
        title: (body.title || "Untitled Scholarship").trim(),
        desc: (body.desc || "No description provided yet...").trim(),
        type: body.type || "",
        typeText: body.typeText || body.type || "",
        date: body.date || "",
        requirements: Array.isArray(body.requirements) ? body.requirements : [],
        updatedAt: new Date().toISOString(),
      };

      if (existingIdx >= 0) {
        data.drafts[existingIdx] = draftItem;
      } else {
        data.drafts.unshift(draftItem);
      }

      writeData(data);
      return sendJson(res, 201, draftItem);
    }
  }

  // DELETE /api/drafts/:id
  if (pathname.startsWith("/api/drafts/") && method === "DELETE") {
    const id = pathname.replace("/api/drafts/", "");
    const data = readData();
    data.drafts = (data.drafts || []).filter(
      (d) => String(d.id) !== String(id),
    );
    writeData(data);
    return sendJson(res, 200, { success: true, id });
  }

  // 4. APPLICATIONS API
  if (pathname === "/api/applications") {
    if (method === "GET") {
      const data = readData();
      return sendJson(res, 200, data.applications || []);
    }

    if (method === "POST") {
      const body = await parseRequestBody(req);
      const data = readData();
      data.applications = data.applications || [];

      // Check if student has already applied for this scholarship
      const studentEmail =
        body.studentEmail ||
        (data.studentSettings && data.studentSettings.email) ||
        "admin@admin.edu.ph";
      const targetScholarshipId = body.scholarshipId || "schol_nexo_tech_01";
      const alreadyApplied = data.applications.some(
        (a) =>
          String(a.scholarshipId) === String(targetScholarshipId) &&
          (!a.studentEmail || a.studentEmail === studentEmail)
      );

      if (alreadyApplied) {
        return sendJson(res, 400, {
          success: false,
          error: "You have already applied for this scholarship.",
        });
      }

      // Check if scholarship has reached applicant quota limit
      const targetSchol = (data.scholarships || []).find(
        (s) => String(s.id) === String(targetScholarshipId)
      );
      if (targetSchol) {
        const limit =
          parseInt(targetSchol.applicantLimit || targetSchol.maxApplicants || 200, 10) ||
          200;
        const currentCount = (data.applications || []).filter(
          (a) => String(a.scholarshipId) === String(targetScholarshipId)
        ).length;
        if (currentCount >= limit) {
          return sendJson(res, 400, {
            success: false,
            error: "This scholarship has reached its applicant limit and is now closed.",
          });
        }
      }

      const appId = body.id || "app_" + Date.now();

      // Process and save uploaded documents to disk using File Handling
      const savedDocuments = [];
      const rawDocs = Array.isArray(body.documents)
        ? body.documents
        : Array.isArray(body.uploadedDocuments)
          ? body.uploadedDocuments
          : [];

      rawDocs.forEach((doc, idx) => {
        if (typeof doc === "string") {
          savedDocuments.push({
            name: doc,
            size: "1.2 MB",
            type: "application/pdf",
            fileUrl: "",
            uploadedAt: new Date().toISOString(),
          });
        } else if (doc && typeof doc === "object") {
          const saved = saveBase64File(doc, `${appId}_doc${idx + 1}`);
          savedDocuments.push(saved);
        }
      });

      const sAvatar =
        body.studentProfilePic ||
        body.profilePicture ||
        (data.studentSettings && data.studentSettings.profilePicture) ||
        "";

      const newApp = {
        id: appId,
        scholarshipId: body.scholarshipId || "schol_nexo_tech_01",
        scholarshipTitle: body.scholarshipTitle || "Scholarship Program",
        providerName: body.providerName || data.settings.orgName || "NEXO",
        studentName:
          body.studentName ||
          data.studentSettings.fullName ||
          "Student Applicant",
        studentEmail:
          body.studentEmail ||
          data.studentSettings.email ||
          "student@university.edu.ph",
        studentId:
          body.studentId || data.studentSettings.studentId || "21-04589",
        university:
          body.university ||
          data.studentSettings.university ||
          "Batangas State University",
        course:
          body.course ||
          data.studentSettings.course ||
          "BS Information Technology",
        yearLevel:
          body.yearLevel || data.studentSettings.yearLevel || "3rd Year",
        contactNumber:
          body.contactNumber ||
          data.studentSettings.contactNumber ||
          "+63 912 345 6789",
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
        applicantCount: body.applicantCount && !body.applicantCount.includes("/ 10 ")
          ? body.applicantCount
          : "1 / 200 Applicants",
        documents: savedDocuments,
        uploadedDocuments: savedDocuments.map((d) => d.name),
        notes: body.notes || "",
        reviewedAt: null,
      };

      data.applications.unshift(newApp);
      syncScholarshipApplicantCounts(data);

      // Add live provider notification about new applicant
      data.notifications = data.notifications || [];
      data.notifications.unshift({
        id: "notif_" + Date.now(),
        recipient: "provider",
        title: "New Application Received",
        message: `${newApp.studentName} applied for "${newApp.scholarshipTitle}" with ${savedDocuments.length} document(s).`,
        timestamp: new Date().toISOString(),
        formattedTime: "Just now",
        read: false,
        link: "provider-applications.html",
        appId: newApp.id,
      });

      writeData(data);

      console.log(
        `[Application Received] Student "${newApp.studentName}" applied for "${newApp.scholarshipTitle}" with ${savedDocuments.length} files.`,
      );
      return sendJson(res, 201, newApp);
    }
  }

  // PATCH /api/applications/:id (Provider updates application status and feedback notes)
  if (
    pathname.startsWith("/api/applications/") &&
    (method === "PATCH" || method === "PUT" || method === "POST")
  ) {
    const id = pathname.replace("/api/applications/", "").split("/")[0];
    const body = await parseRequestBody(req);
    const data = readData();
    data.applications = data.applications || [];

    const appIndex = data.applications.findIndex(
      (a) => String(a.id) === String(id),
    );
    if (appIndex === -1) {
      return sendJson(res, 404, {
        success: false,
        message: "Application not found",
      });
    }

    const currentApp = data.applications[appIndex];
    const updatedStatus =
      body.status !== undefined ? body.status : currentApp.status;
    const updatedNotes =
      body.notes !== undefined ? body.notes : currentApp.notes || "";

    data.applications[appIndex] = {
      ...currentApp,
      status: updatedStatus,
      statusText: updatedStatus,
      notes: updatedNotes,
      feedback:
        body.feedback !== undefined
          ? body.feedback
          : currentApp.feedback || updatedNotes,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Add live student notification about status change
    data.notifications = data.notifications || [];
    data.notifications.unshift({
      id: "notif_" + Date.now(),
      recipient: "student",
      title: `Application Status: ${updatedStatus}`,
      message: `Your application for "${currentApp.scholarshipTitle}" is now ${updatedStatus}.`,
      timestamp: new Date().toISOString(),
      formattedTime: "Just now",
      read: false,
      link: "student-submissions.html",
      appId: id,
    });

    writeData(data);
    console.log(
      `[Application Managed] App ${id} status updated to: "${updatedStatus}"`,
    );
    return sendJson(res, 200, {
      success: true,
      message: `Application updated to ${updatedStatus}`,
      application: data.applications[appIndex],
    });
  }

  // DELETE /api/applications/:id
  if (pathname.startsWith("/api/applications/") && method === "DELETE") {
    const id = pathname.replace("/api/applications/", "");
    const data = readData();
    data.applications = (data.applications || []).filter(
      (a) => String(a.id) !== String(id),
    );
    syncScholarshipApplicantCounts(data);
    writeData(data);
    return sendJson(res, 200, { success: true, id });
  }

  // 5. PROVIDER SETTINGS API
  if (pathname === "/api/settings") {
    const data = readData();
    if (method === "GET") {
      return sendJson(res, 200, data.settings || DEFAULT_DATA.settings);
    }

    if (method === "POST") {
      const body = await parseRequestBody(req);
      const current = data.settings || DEFAULT_DATA.settings;

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
          body.email !== undefined ? String(body.email).trim() : current.email,
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
      writeData(data);
      return sendJson(res, 200, {
        success: true,
        message: "Settings saved successfully to data.json",
        settings: updated,
      });
    }
  }

  // Password Update API
  if (pathname === "/api/settings/password" && method === "POST") {
    const body = await parseRequestBody(req);
    const { currentPassword, newPassword, confirmPassword } = body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return sendJson(res, 400, {
        success: false,
        message: "Please fill out all password fields.",
      });
    }
    if (newPassword.length < 8) {
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
    data.passwordUpdated = new Date().toISOString();
    writeData(data);
    return sendJson(res, 200, {
      success: true,
      message: "Password updated successfully!",
    });
  }

  // Email Change Request API
  if (pathname === "/api/settings/email-request" && method === "POST") {
    const body = await parseRequestBody(req);
    const { newEmail, reason } = body;

    if (!newEmail || !newEmail.includes("@")) {
      return sendJson(res, 400, {
        success: false,
        message: "Please provide a valid new email address.",
      });
    }

    const data = readData();
    data.pendingEmailRequests = data.pendingEmailRequests || [];
    data.pendingEmailRequests.unshift({
      id: "req_" + Date.now(),
      newEmail,
      reason: reason || "",
      requestedAt: new Date().toISOString(),
      status: "Pending Verification",
    });
    writeData(data);

    return sendJson(res, 200, {
      success: true,
      message: `Email change request submitted! A verification link was simulated for ${newEmail}`,
    });
  }

  // 6. STUDENT SETTINGS API
  if (pathname === "/api/student-settings") {
    const data = readData();
    if (method === "GET") {
      return sendJson(
        res,
        200,
        data.studentSettings || DEFAULT_DATA.studentSettings,
      );
    }

    if (method === "POST") {
      const body = await parseRequestBody(req);
      const current = data.studentSettings || DEFAULT_DATA.studentSettings;

      const updated = {
        ...current,
        fullName: current.fullName,
        email: current.email,
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

      data.studentSettings = updated;

      // Update student profile picture on existing applications
      if (
        body.profilePicture !== undefined &&
        Array.isArray(data.applications)
      ) {
        data.applications.forEach((app) => {
          if (!app.studentEmail || app.studentEmail === current.email) {
            app.studentProfilePic = updated.profilePicture;
            app.profilePicture = updated.profilePicture;
          }
        });
      }

      writeData(data);
      return sendJson(res, 200, {
        success: true,
        message: "Student settings saved successfully to data.json",
        settings: updated,
      });
    }
  }

  // 6. NOTIFICATIONS API
  if (pathname === "/api/notifications") {
    const data = readData();
    data.notifications = data.notifications || [];
    const recipient = reqUrl.searchParams.get("recipient");

    if (method === "GET") {
      let filtered = data.notifications;
      if (recipient) {
        filtered = filtered.filter(
          (n) =>
            !n.recipient || n.recipient === recipient || n.recipient === "all",
        );
      }
      return sendJson(res, 200, filtered);
    }

    if (method === "POST") {
      const body = await parseRequestBody(req);
      const newNotif = {
        id: "notif_" + Date.now(),
        recipient: body.recipient || "all",
        title: body.title || "New Notification",
        message: body.message || "",
        timestamp: new Date().toISOString(),
        formattedTime: "Just now",
        read: false,
        link: body.link || "#",
      };
      data.notifications.unshift(newNotif);
      writeData(data);
      return sendJson(res, 201, newNotif);
    }
  }

  // POST /api/notifications/read (mark notifications as read)
  if (pathname === "/api/notifications/read" && method === "POST") {
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

    writeData(data);
    return sendJson(res, 200, {
      success: true,
      message: "Notifications marked as read",
    });
  }

  // -------------------------------------------------------------
  // STATIC FILE SERVING
  // -------------------------------------------------------------
  let sanitizedPath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, "");
  if (sanitizedPath === "/" || sanitizedPath === "") {
    sanitizedPath = "/index.html";
  }

  const filePath = path.join(PROJECT_ROOT, sanitizedPath);

  // Security check: ensure path is inside PROJECT_ROOT
  if (!filePath.startsWith(PROJECT_ROOT)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("403 Forbidden");
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, {
        "Content-Type": "text/html; charset=UTF-8",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>404 Not Found</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h2>404 - Page or Resource Not Found</h2>
          <p>Requested: <code>${pathname}</code></p>
          <a href="/index.html" style="color: #6941C6; font-weight: bold;">Return to Home</a>
        </body>
        </html>
      `);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": stats.size,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600",
    });

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  });
}

// Start HTTP Server
const server = http.createServer(handleRequest);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n======================================================`);
  console.log(`  NEXO Scholarship Portal - Local Server Running!`);
  console.log(
    `  Provider Dashboard : http://localhost:${PORT}/provider-dashboard.html`,
  );
  console.log(
    `  Applications Portal: http://localhost:${PORT}/provider-applications.html`,
  );
  console.log(
    `  Student Dashboard  : http://localhost:${PORT}/student-dashboard.html`,
  );
  console.log(
    `  Student Directory  : http://localhost:${PORT}/student-browse.html`,
  );
  console.log(`  Live JSON Storage  : ${DATA_FILE_BACKEND}`);
  console.log(`  Uploaded Files Dir : ${UPLOADS_DIR}`);
  console.log(`======================================================\n`);
});

module.exports = server;
