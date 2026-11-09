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
    if (!parsed.users)
      parsed.users = DEFAULT_DATA.users || [];
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
  if (!doc) return null;
  const isFollowUp = doc.isFollowUp || doc.status === "to_follow_up" || doc.type === "to_follow_up";
  if (!doc.data || isFollowUp) {
    return {
      name: doc.name || `${doc.requirement || doc.title || "Requirement"} (To Follow Up)`,
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
      title: doc.title || doc.requirement || doc.name || safeName,
      requirement: doc.requirement || doc.title || doc.name || safeName,
      size: doc.size || buffer.length,
      type: doc.type || (matches ? matches[1] : "application/octet-stream"),
      fileUrl: `/uploads/${diskFileName}`,
      uploadedAt: new Date().toISOString(),
      status: "attached",
      isFollowUp: false,
      slot: doc.slot || "",
    };
  } catch (err) {
    console.error("Error saving document to uploads:", err);
    return {
      name: doc.name || "document",
      title: doc.title || doc.requirement || "Document",
      requirement: doc.requirement || doc.title || "Document",
      size: doc.size || 0,
      type: doc.type || "application/octet-stream",
      fileUrl: "",
      error: "Could not save file to disk",
      status: "attached",
      isFollowUp: false,
      slot: doc.slot || "",
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

  const scholMap = {};
  data.scholarships.forEach((s) => {
    const count = data.applications.filter((app) => {
      if (
        app.scholarshipId &&
        s.id &&
        String(app.scholarshipId) === String(s.id)
      )
        return true;
      if (
        s.title &&
        (app.scholarshipTitle === s.title || app.title === s.title)
      )
        return true;
      return false;
    }).length;

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
    const matched =
      scholMap[app.scholarshipId] ||
      data.scholarships.find(
        (s) =>
          s.title &&
          (app.scholarshipTitle === s.title || app.title === s.title),
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
        "adrian@batstate-u.edu.ph";
      const targetScholarshipId = body.scholarshipId || "schol_nexo_tech_01";
      const alreadyApplied = data.applications.some(
        (a) =>
          String(a.scholarshipId) === String(targetScholarshipId) &&
          (!a.studentEmail || a.studentEmail === studentEmail),
      );

      if (alreadyApplied) {
        return sendJson(res, 400, {
          success: false,
          error: "You have already applied for this scholarship.",
        });
      }

      // Check if scholarship has reached applicant quota limit
      const targetSchol = (data.scholarships || []).find(
        (s) => String(s.id) === String(targetScholarshipId),
      );
      if (targetSchol) {
        const limit =
          parseInt(
            targetSchol.applicantLimit || targetSchol.maxApplicants || 200,
            10,
          ) || 200;
        const currentCount = (data.applications || []).filter(
          (a) => String(a.scholarshipId) === String(targetScholarshipId),
        ).length;
        if (currentCount >= limit) {
          return sendJson(res, 400, {
            success: false,
            error:
              "This scholarship has reached its applicant limit and is now closed.",
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
          const isFollowUp = doc.includes("(To Follow Up)");
          const cleanTitle = doc.replace(" (To Follow Up)", "").trim();
          savedDocuments.push({
            name: doc,
            title: cleanTitle,
            requirement: cleanTitle,
            size: isFollowUp ? 0 : "1.2 MB",
            type: isFollowUp ? "to_follow_up" : "application/pdf",
            fileUrl: "",
            uploadedAt: new Date().toISOString(),
            status: isFollowUp ? "to_follow_up" : "attached",
            isFollowUp: isFollowUp,
          });
        } else if (doc && typeof doc === "object") {
          const saved = saveBase64File(doc, `${appId}_doc${idx + 1}`);
          if (saved) savedDocuments.push(saved);
        }
      });

      const attachedDocs = savedDocuments.filter(
        (d) => !d.isFollowUp && d.status !== "to_follow_up" && d.type !== "to_follow_up" && (d.size > 0 || d.fileUrl || d.data)
      );
      const followUpDocs = savedDocuments.filter(
        (d) => d.isFollowUp || d.status === "to_follow_up" || d.type === "to_follow_up" || (typeof d.name === "string" && d.name.includes("(To Follow Up)"))
      );

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
        applicantCount:
          body.applicantCount && !body.applicantCount.includes("/ 10 ")
            ? body.applicantCount
            : "1 / 200 Applicants",
        documents: savedDocuments,
        uploadedDocuments: attachedDocs.map((d) => d.name),
        notes: body.notes || "",
        reviewedAt: null,
      };

      data.applications.unshift(newApp);
      syncScholarshipApplicantCounts(data);

      // Add live provider notification about new applicant strictly counting attached files
      const docNotice =
        followUpDocs.length > 0
          ? `${attachedDocs.length} document(s) (${followUpDocs.length} to follow up)`
          : `${attachedDocs.length} document(s)`;

      data.notifications = data.notifications || [];
      data.notifications.unshift({
        id: "notif_" + Date.now(),
        recipient: "provider",
        title: "New Application Received",
        message: `${newApp.studentName} applied for "${newApp.scholarshipTitle}" with ${docNotice}.`,
        timestamp: new Date().toISOString(),
        formattedTime: "Just now",
        read: false,
        link: "provider-applications.html",
        appId: newApp.id,
      });

      writeData(data);

      console.log(
        `[Application Received] Student "${newApp.studentName}" applied for "${newApp.scholarshipTitle}" with ${attachedDocs.length} attached files (${followUpDocs.length} to follow up).`,
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

    // Handle Follow-Up Document Upload by Student
    if (body.followUpDocument) {
      const fu = body.followUpDocument;
      let savedDoc = null;
      if (fu && fu.data) {
        savedDoc = saveBase64File(fu, `${id}_followup_${Date.now()}`);
      }
      if (!savedDoc) {
        savedDoc = {
          name: fu.name || "FollowUp_Document.pdf",
          title: fu.requirement || fu.title || "Required Document",
          requirement: fu.requirement || fu.title || "Required Document",
          size: fu.size || "1.2 MB",
          type: fu.type || "application/pdf",
          fileUrl: fu.fileUrl || "",
          uploadedAt: new Date().toISOString(),
          status: "attached",
          isFollowUp: false,
        };
      }

      // Update documents array: replace the matching to_follow_up requirement
      let docs = Array.isArray(currentApp.documents)
        ? [...currentApp.documents]
        : [];
      const targetReq = (fu.requirement || fu.title || fu.name || "").toLowerCase().trim();
      let replaced = false;

      docs = docs.map((d) => {
        const dTitle = typeof d === "string" ? d : d.requirement || d.title || d.name || "";
        const isFu = typeof d === "string" ? d.includes("(To Follow Up)") : (d.isFollowUp || d.status === "to_follow_up");
        if (isFu && dTitle.toLowerCase().includes(targetReq)) {
          replaced = true;
          return savedDoc;
        }
        return d;
      });

      if (!replaced) {
        // Fallback: replace first follow-up or push
        const firstFuIdx = docs.findIndex((d) =>
          typeof d === "string" ? d.includes("(To Follow Up)") : (d.isFollowUp || d.status === "to_follow_up")
        );
        if (firstFuIdx !== -1) {
          docs[firstFuIdx] = savedDoc;
        } else {
          docs.push(savedDoc);
        }
      }

      currentApp.documents = docs;
      currentApp.uploadedDocuments = docs
        .filter((d) => (typeof d === "string" ? !d.includes("(To Follow Up)") : !d.isFollowUp))
        .map((d) => (typeof d === "string" ? d : d.name));

      // Live Provider Notification: Follow-up document attached!
      data.notifications = data.notifications || [];
      data.notifications.unshift({
        id: "notif_" + Date.now(),
        recipient: "provider",
        title: "Follow-Up Document Submitted",
        message: `${currentApp.studentName} attached "${savedDoc.name}" for "${currentApp.scholarshipTitle}".`,
        timestamp: new Date().toISOString(),
        formattedTime: "Just now",
        read: false,
        link: "provider-applications.html",
        appId: id,
      });

      console.log(`[Student Follow-Up Uploaded] App ${id}: "${savedDoc.name}" for ${savedDoc.requirement}`);
    }

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

    // If status changed by provider, notify student
    if (body.status !== undefined && body.status !== currentApp.status) {
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
    }

    writeData(data);
    return sendJson(res, 200, {
      success: true,
      message: `Application updated successfully`,
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

  // 6. STUDENT SETTINGS API (Multi-Account Profile Isolation)
  if (pathname === "/api/student-settings") {
    const data = readData();
    const queryEmail = (reqUrl.searchParams.get("email") || "").toLowerCase().trim();

    if (method === "GET") {
      if (queryEmail) {
        data.studentProfiles = data.studentProfiles || {};
        if (data.studentProfiles[queryEmail]) {
          return sendJson(res, 200, data.studentProfiles[queryEmail]);
        }
        const matched = (data.users || []).find((u) => (u.email || "").toLowerCase() === queryEmail);
        const profile = {
          fullName: (matched && matched.name) || "",
          email: queryEmail,
          university: (matched && matched.university) || (queryEmail.includes("batstate-u") ? "Batangas State University" : ""),
          course: (matched && matched.course) || "",
          yearLevel: (matched && matched.yearLevel) || "",
          studentId: (matched && matched.studentId) || (queryEmail.split("@")[0].match(/^\d{2}-\d{4,6}$/) ? queryEmail.split("@")[0] : ""),
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
        data.studentSettings || DEFAULT_DATA.studentSettings,
      );
    }

    if (method === "POST" || method === "PUT" || method === "PATCH") {
      const body = await parseRequestBody(req);
      const email = (body.email || queryEmail || (data.studentSettings && data.studentSettings.email) || "").toLowerCase().trim();
      data.studentProfiles = data.studentProfiles || {};

      const current = data.studentProfiles[email] || {
        fullName: "",
        email: email,
        university: email.includes("batstate-u") ? "Batangas State University" : "",
        course: "",
        yearLevel: "",
        studentId: email.split("@")[0].match(/^\d{2}-\d{4,6}$/) ? email.split("@")[0] : "",
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

      // Update data.users if name or course updated
      if (Array.isArray(data.users) && email) {
        const u = data.users.find((user) => (user.email || "").toLowerCase() === email);
        if (u) {
          if (body.fullName !== undefined) u.name = String(body.fullName).trim();
          if (body.university !== undefined) u.university = String(body.university).trim();
          if (body.course !== undefined) u.course = String(body.course).trim();
          if (body.studentId !== undefined) u.studentId = String(body.studentId).trim();
        }
      }

      data.studentSettings = updated;

      // Update student profile picture on existing applications
      if (
        body.profilePicture !== undefined &&
        Array.isArray(data.applications)
      ) {
        data.applications.forEach((app) => {
          if (!app.studentEmail || app.studentEmail === email) {
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

  // DELETE /api/notifications/:id (Permanently delete notification on click)
  if (pathname.startsWith("/api/notifications/") && method === "DELETE") {
    const targetId = pathname.replace("/api/notifications/", "").split("/")[0];
    const data = readData();
    data.notifications = (data.notifications || []).filter(
      (n) => String(n.id) !== String(targetId)
    );
    writeData(data);
    return sendJson(res, 200, {
      success: true,
      message: "Notification deleted permanently",
    });
  }

  // ==========================================================================
  // 7. DEVELOPER ADMINISTRATOR & USER ACCOUNTS ENGINE
  // ==========================================================================

  // GET /api/users - List all registered and admin-created accounts
  if (pathname === "/api/users" && method === "GET") {
    const data = readData();
    data.users = data.users || [];
    return sendJson(res, 200, data.users);
  }

  // POST /api/users - Create new account (Student or Provider) with file handling
  if (pathname === "/api/users" && method === "POST") {
    const body = await parseRequestBody(req);
    const data = readData();
    data.users = data.users || [];

    const email = (body.email || "").trim().toLowerCase();
    const role = (body.role || "student").trim().toLowerCase(); // "student" or "provider"
    const name =
      (body.name || "").trim() ||
      (role === "provider" ? "Scholarship Provider" : "");
    const university = (body.university || "").trim();
    const course = (body.course || "").trim();
    const status = body.status === "banned" ? "banned" : "active";

    if (!email) {
      return sendJson(res, 400, { success: false, error: "Email is required" });
    }

    // Check if user already exists
    const existing = data.users.find((u) => u.email.toLowerCase() === email);
    if (existing) {
      return sendJson(res, 400, {
        success: false,
        error: `An account with email "${email}" already exists.`,
      });
    }

    const password = (body.password || "").trim() || "password123";

    const newUser = {
      id: "usr_" + (role === "provider" ? "prov_" : "stud_") + Date.now(),
      email: email,
      password: password,
      role: role,
      name: name,
      orgName: role === "provider" ? name : undefined,
      university: role === "student" ? university : undefined,
      course: role === "student" ? course : undefined,
      status: status,
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
    writeData(data);

    console.log(`[Admin File Handling] Created ${role} account: ${email}`);
    return sendJson(res, 201, { success: true, user: newUser });
  }

  // PATCH /api/users/:id - Update user status (Ban / Unban / Edit)
  if (
    pathname.startsWith("/api/users/") &&
    (method === "PATCH" || method === "PUT")
  ) {
    const id = pathname.replace("/api/users/", "").split("/")[0];
    const body = await parseRequestBody(req);
    const data = readData();
    data.users = data.users || [];

    const userIdx = data.users.findIndex((u) => String(u.id) === String(id));
    if (userIdx === -1) {
      return sendJson(res, 404, {
        success: false,
        error: "User account not found",
      });
    }

    if (body.status !== undefined) {
      data.users[userIdx].status =
        body.status === "banned" ? "banned" : "active";
    }
    if (body.name !== undefined) data.users[userIdx].name = body.name;
    if (body.notes !== undefined) data.users[userIdx].notes = body.notes;
    data.users[userIdx].updatedAt = new Date().toISOString();

    writeData(data);
    return sendJson(res, 200, { success: true, user: data.users[userIdx] });
  }

  // DELETE /api/users/:id - Delete or Ban Account (Cascade purges posts & applications)
  if (pathname.startsWith("/api/users/") && method === "DELETE") {
    const id = pathname.replace("/api/users/", "").split("/")[0];
    const data = readData();
    data.users = data.users || [];

    const user = data.users.find((u) => String(u.id) === String(id));
    if (!user) {
      return sendJson(res, 404, {
        success: false,
        error: "User account not found",
      });
    }

    // 1. Remove user account from users list
    data.users = data.users.filter((u) => String(u.id) !== String(id));

    let removedPostsCount = 0;
    let removedAppsCount = 0;

    // 2. Cascade cleanup based on role
    if (user.role === "student") {
      // Remove all applications submitted by this student
      const initialAppCount = (data.applications || []).length;
      data.applications = (data.applications || []).filter((a) => {
        const emailMatch =
          (a.studentEmail || "").toLowerCase() === user.email.toLowerCase();
        const idMatch = user.studentId && a.studentId === user.studentId;
        return !emailMatch && !idMatch;
      });
      removedAppsCount = initialAppCount - (data.applications || []).length;
      // Recalculate scholarship applicant numbers
      syncScholarshipApplicantCounts(data);
    } else if (user.role === "provider") {
      // Find all scholarships posted by this provider
      const providerScholarshipIds = (data.scholarships || [])
        .filter((s) => {
          const nameMatch =
            s.providerName &&
            (s.providerName === user.name ||
              s.providerName === user.orgName ||
              s.providerName === user.email);
          const emailMatch =
            s.providerEmail &&
            s.providerEmail.toLowerCase() === user.email.toLowerCase();
          return nameMatch || emailMatch;
        })
        .map((s) => String(s.id));

      removedPostsCount = providerScholarshipIds.length;

      // Remove scholarships
      data.scholarships = (data.scholarships || []).filter(
        (s) => !providerScholarshipIds.includes(String(s.id)),
      );

      // Remove drafts
      data.drafts = (data.drafts || []).filter(
        (d) => !providerScholarshipIds.includes(String(d.id)),
      );

      // Remove all applications submitted for those deleted scholarships
      const initialAppCount = (data.applications || []).length;
      data.applications = (data.applications || []).filter(
        (a) => !providerScholarshipIds.includes(String(a.scholarshipId)),
      );
      removedAppsCount = initialAppCount - (data.applications || []).length;
    }

    writeData(data);
    console.log(
      `[Admin Cascade Delete] Removed ${user.email} (${removedPostsCount} posts, ${removedAppsCount} apps)`,
    );
    return sendJson(res, 200, {
      success: true,
      message: `Account "${user.email}" deleted. Removed ${removedPostsCount} scholarship post(s) and ${removedAppsCount} student application(s).`,
      deletedId: id,
      deletedRole: user.role,
      removedPostsCount,
      removedAppsCount,
    });
  }

  // POST /api/admin/clean-database - Crowded Database Cleaning Engine
  if (pathname === "/api/admin/clean-database" && method === "POST") {
    const body = await parseRequestBody(req);
    const data = readData();

    if (body.action === "clear_applications") {
      const count = (data.applications || []).length;
      data.applications = [];
      syncScholarshipApplicantCounts(data);
      writeData(data);
      return sendJson(res, 200, {
        success: true,
        message: `Successfully cleared all ${count} applications from data.json.`,
      });
    }

    if (body.action === "clear_drafts") {
      const count = (data.drafts || []).length;
      data.drafts = [];
      writeData(data);
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
      const prevApps = (data.applications || []).length;
      data.applications = (data.applications || []).filter(
        (a) => String(a.scholarshipId) !== targetId,
      );
      const appsRemoved = prevApps - (data.applications || []).length;
      syncScholarshipApplicantCounts(data);
      writeData(data);
      return sendJson(res, 200, {
        success: true,
        message: `Scholarship deleted. ${appsRemoved} associated application(s) removed.`,
      });
    }

    if (body.action === "reset_factory_data") {
      data.applications = [];
      data.drafts = [];
      data.notifications = DEFAULT_DATA.notifications;
      data.users = DEFAULT_DATA.users;
      (data.scholarships || []).forEach((s) => {
        s.applicantTotal = 0;
        s.applicantCount = `0 / ${s.applicantLimit || 200} Applicants`;
      });
      writeData(data);
      return sendJson(res, 200, {
        success: true,
        message:
          "Database sanitized and reset to clean factory state with default accounts.",
      });
    }

    return sendJson(res, 400, { success: false, error: "Invalid clean action" });
  }

  // GET /api/admin/export-database - Download current data.json
  if (pathname === "/api/admin/export-database" && method === "GET") {
    const data = readData();
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="nexo_database_backup.json"',
      "Access-Control-Allow-Origin": "*",
    });
    return res.end(JSON.stringify(data, null, 2));
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
