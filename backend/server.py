#!/usr/bin/env python3
# ==========================================================================
# NEXO SCHOLARSHIP PORTAL - PYTHON 3 BACKEND SERVER & FILE HANDLING
# Alternative zero-dependency backend server for local prototype execution.
# Provides identical API endpoints, static file serving, and JSON file handling.
# ==========================================================================

import os
import sys
import json
import base64
import time
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse
import mimetypes

PORT = int(os.environ.get("PORT", 3000))
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
DATA_FILE_BACKEND = os.path.join(BACKEND_DIR, "data.json")
DATA_FILE_ROOT = os.path.join(PROJECT_ROOT, "data.json")
UPLOADS_DIR = os.path.join(PROJECT_ROOT, "uploads")

os.makedirs(UPLOADS_DIR, exist_ok=True)

DEFAULT_DATA = {
    "scholarships": [],
    "drafts": [],
    "applications": [],
    "settings": {
        "orgName": "NEXO",
        "location": "Batangas City, Philippines",
        "contactPerson": "Admin Officer",
        "contactNumber": "+63 912 345 6789",
        "email": "provider@nexo.edu.ph",
        "bannerImage": "",
        "logoImage": "",
        "bio": "Empowering students through accessible educational opportunities and transparent scholarship management.",
        "notifications": {
            "newApplications": True,
            "emailAlerts": True,
            "weeklyDigest": False,
            "systemUpdates": True
        },
        "preferences": {
            "theme": "light",
            "twoFactor": False
        }
    },
    "studentSettings": {
        "fullName": "Adrian Del Mundo",
        "email": "adrian@batstate-u.edu.ph",
        "university": "Batangas State University",
        "course": "BS Information Technology",
        "yearLevel": "3rd Year",
        "studentId": "21-04589",
        "contactNumber": "+63 912 345 6789",
        "bio": "Passionate IT student striving for academic excellence and innovation in web technologies.",
        "profilePicture": "",
        "notifications": {
            "scholarshipMatches": True,
            "applicationUpdates": True,
            "deadlineReminders": True
        },
        "preferences": {
            "theme": "light"
        }
    },
    "users": [
        {
            "id": "usr_prov_nexo",
            "email": "admin@admin",
            "password": "admin",
            "role": "provider",
            "name": "NEXO",
            "orgName": "NEXO",
            "createdAt": "2026-11-01T08:00:00.000Z",
            "formattedDate": "Nov 1, 2026",
            "status": "active",
            "notes": "Primary Scholarship Provider Account"
        },
        {
            "id": "usr_stud_adrian",
            "email": "adrian@batstate-u.edu.ph",
            "password": "password123",
            "role": "student",
            "name": "Adrian Del Mundo",
            "university": "Batangas State University",
            "course": "BS Information Technology",
            "yearLevel": "3rd Year",
            "createdAt": "2026-11-01T08:00:00.000Z",
            "formattedDate": "Nov 1, 2026",
            "status": "active",
            "notes": "Verified Student Account"
        },
        {
            "id": "usr_stud_2402924",
            "email": "24-02924@g.batstate-u.edu.ph",
            "password": "password123",
            "role": "student",
            "name": "",
            "university": "Batangas State University",
            "course": "",
            "yearLevel": "",
            "studentId": "24-02924",
            "createdAt": "2026-11-09T08:00:00.000Z",
            "formattedDate": "Nov 9, 2026",
            "status": "active",
            "notes": "Student Account created via Admin Panel"
        }
    ]
}

def read_data():
    try:
        path_to_read = DATA_FILE_BACKEND if os.path.exists(DATA_FILE_BACKEND) else DATA_FILE_ROOT
        if not os.path.exists(path_to_read):
            write_data(DEFAULT_DATA)
            return DEFAULT_DATA
        with open(path_to_read, "r", encoding="utf-8") as f:
            data = json.load(f)
        if "scholarships" not in data: data["scholarships"] = []
        if "drafts" not in data: data["drafts"] = []
        if "applications" not in data: data["applications"] = []
        if "settings" not in data: data["settings"] = DEFAULT_DATA["settings"]
        if "studentSettings" not in data: data["studentSettings"] = DEFAULT_DATA["studentSettings"]
        return data
    except Exception as e:
        print("Error reading data:", e)
        return DEFAULT_DATA

def write_data(data):
    try:
        json_str = json.dumps(data, indent=2, ensure_ascii=False)
        with open(DATA_FILE_BACKEND, "w", encoding="utf-8") as f:
            f.write(json_str)
        try:
            with open(DATA_FILE_ROOT, "w", encoding="utf-8") as f:
                f.write(json_str)
        except Exception:
            pass
        return True
    except Exception as e:
        print("Error writing data:", e)
        return False

def save_base64_file(doc, prefix):
    if not doc or not isinstance(doc, dict):
        return doc
    is_follow_up = doc.get("isFollowUp") or doc.get("status") == "to_follow_up" or doc.get("type") == "to_follow_up"
    if not doc.get("data") or is_follow_up:
        return {
            "name": doc.get("name") or f"{doc.get('requirement') or doc.get('title') or 'Requirement'} (To Follow Up)",
            "title": doc.get("title") or doc.get("requirement") or "Requirement",
            "requirement": doc.get("requirement") or doc.get("title") or "Requirement",
            "size": 0,
            "type": "to_follow_up",
            "fileUrl": "",
            "uploadedAt": datetime.now().isoformat(),
            "status": "to_follow_up",
            "isFollowUp": True,
            "slot": doc.get("slot", "")
        }
    try:
        raw_data = doc["data"]
        if "," in raw_data:
            header, base64_str = raw_data.split(",", 1)
        else:
            base64_str = raw_data
        
        file_bytes = base64.b64decode(base64_str)
        safe_name = "".join(c if c.isalnum() or c in "._-" else "_" for c in doc.get("name", "document"))
        disk_filename = f"{prefix}_{int(time.time()*1000)}_{safe_name}"
        disk_path = os.path.join(UPLOADS_DIR, disk_filename)
        with open(disk_path, "wb") as f:
            f.write(file_bytes)
        
        return {
            "name": doc.get("name", safe_name),
            "title": doc.get("title") or doc.get("requirement") or safe_name,
            "requirement": doc.get("requirement") or doc.get("title") or safe_name,
            "size": doc.get("size", len(file_bytes)),
            "type": doc.get("type", "application/octet-stream"),
            "fileUrl": f"/uploads/{disk_filename}",
            "uploadedAt": datetime.now().isoformat(),
            "status": "attached",
            "isFollowUp": False,
            "slot": doc.get("slot", "")
        }
    except Exception as e:
        print("Error saving file:", e)
        return {
            "name": doc.get("name", "document"),
            "title": doc.get("title") or doc.get("requirement") or "Document",
            "requirement": doc.get("requirement") or doc.get("title") or "Document",
            "size": 0,
            "type": "application/octet-stream",
            "fileUrl": "",
            "status": "attached",
            "isFollowUp": False,
            "slot": doc.get("slot", "")
        }

def sync_counts(data):
    default_avatar = data.get("studentSettings", {}).get("profilePicture", "")
    for app in data.get("applications", []):
        if not app.get("studentProfilePic") and not app.get("profilePicture") and default_avatar:
            app["studentProfilePic"] = default_avatar
            app["profilePicture"] = default_avatar
    for s in data.get("scholarships", []):
        c = 0
        for app in data.get("applications", []):
            if (app.get("scholarshipId") and str(app.get("scholarshipId")) == str(s.get("id"))) or \
               (s.get("title") and (app.get("scholarshipTitle") == s.get("title") or app.get("title") == s.get("title"))):
                c += 1
        lim = int(s.get("applicantLimit") or s.get("maxApplicants") or 200)
        s["applicantLimit"] = lim
        s["maxApplicants"] = lim
        s["applicantTotal"] = c
        s["applicantCount"] = f"{c} / {lim} Applicants"
        if c >= lim and (s.get("status") or "").lower() != "closed":
            s["status"] = "Quota Full"
    schol_map = {s["id"]: s for s in data.get("scholarships", [])}
    for app in data.get("applications", []):
        sid = app.get("scholarshipId")
        matched = schol_map.get(sid)
        if not matched:
            for s in data.get("scholarships", []):
                if s.get("title") and (app.get("scholarshipTitle") == s.get("title") or app.get("title") == s.get("title")):
                    matched = s
                    break
        if matched:
            app["applicantCount"] = matched["applicantCount"]
            if not sid:
                app["scholarshipId"] = matched["id"]

class NexoHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        content_len = int(self.headers.get("Content-Length", 0))
        if content_len == 0:
            return {}
        raw = self.rfile.read(content_len)
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception:
            return {}

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path == "/api/data":
            data = read_data()
            sync_counts(data)
            return self._send_json(200, data)

        if path == "/api/scholarships":
            data = read_data()
            sync_counts(data)
            return self._send_json(200, data.get("scholarships", []))

        if path == "/api/drafts":
            data = read_data()
            return self._send_json(200, data.get("drafts", []))

        if path == "/api/applications":
            data = read_data()
            return self._send_json(200, data.get("applications", []))

        if path == "/api/notifications":
            data = read_data()
            notifs = data.get("notifications", [])
            recip = query.get("recipient", [None])[0]
            if recip:
                notifs = [n for n in notifs if not n.get("recipient") or n.get("recipient") == recip or n.get("recipient") == "all"]
            return self._send_json(200, notifs)

        if path == "/api/settings":
            data = read_data()
            return self._send_json(200, data.get("settings", DEFAULT_DATA["settings"]))

        if path == "/api/student-settings":
            data = read_data()
            query_email = (query.get("email", [""])[0] or "").strip().lower()
            if query_email:
                profiles = data.setdefault("studentProfiles", {})
                if query_email in profiles:
                    prof = profiles[query_email]
                    if not prof.get("profilePicture"):
                        matched = next((u for u in data.get("users", []) if (u.get("email") or "").strip().lower() == query_email), None)
                        if matched and matched.get("profilePicture"):
                            prof["profilePicture"] = matched.get("profilePicture")
                    return self._send_json(200, prof)
                matched = next((u for u in data.get("users", []) if (u.get("email") or "").strip().lower() == query_email), None)
                prof = {
                    "fullName": (matched.get("name") if matched else "") or "",
                    "email": query_email,
                    "university": (matched.get("university") if matched else "") or ("Batangas State University" if "batstate-u" in query_email else ""),
                    "course": (matched.get("course") if matched else "") or "",
                    "yearLevel": (matched.get("yearLevel") if matched else "") or "",
                    "studentId": (matched.get("studentId") if matched else "") or (query_email.split("@")[0] if len(query_email.split("@")[0].split("-")) == 2 else ""),
                    "contactNumber": "",
                    "bio": "",
                    "profilePicture": (matched.get("profilePicture") if matched else "") or "",
                    "notifications": {
                        "scholarshipMatches": True,
                        "applicationUpdates": True,
                        "deadlineReminders": True
                    },
                    "preferences": {"theme": "light"}
                }
                return self._send_json(200, prof)
            return self._send_json(200, data.get("studentSettings", DEFAULT_DATA["studentSettings"]))

        if path == "/api/users":
            data = read_data()
            return self._send_json(200, data.get("users", []))

        if path == "/api/admin/export-database":
            data = read_data()
            json_bytes = json.dumps(data, indent=2).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Disposition", 'attachment; filename="nexo_database_backup.json"')
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(json_bytes)))
            self.end_headers()
            self.wfile.write(json_bytes)
            return

        # Static files
        if path == "/" or path == "":
            path = "/index.html"
        rel_path = path.lstrip("/")
        full_path = os.path.normpath(os.path.join(PROJECT_ROOT, rel_path))

        if not full_path.startswith(PROJECT_ROOT) or not os.path.isfile(full_path):
            self.send_response(404)
            self._send_cors_headers()
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"404 Not Found")
            return

        mime, _ = mimetypes.guess_type(full_path)
        if not mime:
            mime = "application/octet-stream"
        if full_path.endswith(".js"):
            mime = "application/javascript; charset=UTF-8"
        elif full_path.endswith(".css"):
            mime = "text/css; charset=UTF-8"
        elif full_path.endswith(".html"):
            mime = "text/html; charset=UTF-8"

        with open(full_path, "rb") as f:
            content = f.read()

        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(content)))
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(content)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)
        body = self._read_json()
        data = read_data()

        if path == "/api/scholarships":
            limit = int(body.get("applicantLimit") or body.get("maxApplicants") or 200)
            now_dt = datetime.now()
            posted_at = body.get("postedAt") or body.get("createdAt") or now_dt.isoformat()
            formatted_posted = body.get("formattedPostedDate") or now_dt.strftime("%b %d, %Y")
            new_sch = {
                "id": body.get("id", f"schol_{int(time.time()*1000)}"),
                "title": (body.get("title") or "Untitled Scholarship").strip(),
                "desc": (body.get("desc") or "").strip(),
                "type": body.get("type", "Other"),
                "typeText": body.get("typeText", body.get("type", "Other")),
                "deadline": body.get("deadline", ""),
                "formattedDate": body.get("formattedDate", "No Deadline"),
                "applicantLimit": limit,
                "maxApplicants": limit,
                "applicantTotal": 0,
                "applicantCount": f"0 / {limit} Applicants",
                "postedAt": posted_at,
                "formattedPostedDate": formatted_posted,
                "createdAt": posted_at,
                "requirements": body.get("requirements", []),
                "providerName": body.get("providerName", data["settings"].get("orgName", "NEXO")),
                "providerLogo": body.get("providerLogo", data["settings"].get("logoImage", "")),
                "providerBanner": body.get("providerBanner", data["settings"].get("bannerImage", "")),
                "status": body.get("status", "Open"),
            }
            data.setdefault("scholarships", []).insert(0, new_sch)
            data.setdefault("notifications", []).insert(0, {
                "id": f"notif_{int(time.time()*1000)}",
                "recipient": "student",
                "title": "New Scholarship Posted",
                "message": f"{new_sch['providerName']} published \"{new_sch['title']}\". Applications are now open!",
                "timestamp": datetime.now().isoformat(),
                "formattedTime": "Just now",
                "read": False,
                "link": "student-browse.html",
                "scholarshipId": new_sch["id"]
            })
            if body.get("draftId"):
                data["drafts"] = [d for d in data.get("drafts", []) if str(d.get("id")) != str(body.get("draftId"))]
            write_data(data)
            return self._send_json(201, new_sch)

        if path == "/api/drafts":
            did = body.get("id")
            draft_item = {
                "id": did if did else f"draft_{int(time.time()*1000)}",
                "title": (body.get("title") or "Untitled Scholarship").strip(),
                "desc": (body.get("desc") or "No description provided yet...").strip(),
                "type": body.get("type", ""),
                "typeText": body.get("typeText", body.get("type", "")),
                "date": body.get("date", ""),
                "requirements": body.get("requirements", []),
                "updatedAt": datetime.now().isoformat()
            }
            existing = [i for i, d in enumerate(data.get("drafts", [])) if str(d.get("id")) == str(did)]
            if existing:
                data["drafts"][existing[0]] = draft_item
            else:
                data.setdefault("drafts", []).insert(0, draft_item)
            write_data(data)
            return self._send_json(201, draft_item)

        if path == "/api/applications":
            target_sid = body.get("scholarshipId", "schol_nexo_tech_01")
            student_email = body.get("studentEmail") or data.get("studentSettings", {}).get("email", "adrian@batstate-u.edu.ph")
            for a in data.get("applications", []):
                if str(a.get("scholarshipId")) == str(target_sid) and (not a.get("studentEmail") or a.get("studentEmail") == student_email):
                    return self._send_json(400, {"success": False, "error": "You have already applied for this scholarship."})

            for s in data.get("scholarships", []):
                if str(s.get("id")) == str(target_sid):
                    limit = int(s.get("applicantLimit") or s.get("maxApplicants") or 200)
                    curr = len([a for a in data.get("applications", []) if str(a.get("scholarshipId")) == str(target_sid)])
                    if curr >= limit:
                        return self._send_json(400, {"success": False, "error": "This scholarship has reached its applicant limit and is now closed."})
                    break

            app_id = body.get("id", f"app_{int(time.time()*1000)}")
            saved_docs = []
            raw_docs = body.get("documents") or body.get("uploadedDocuments") or []
            for i, doc in enumerate(raw_docs):
                if isinstance(doc, str):
                    is_fu = "(To Follow Up)" in doc
                    clean_t = doc.replace(" (To Follow Up)", "").strip()
                    saved_docs.append({
                        "name": doc,
                        "title": clean_t,
                        "requirement": clean_t,
                        "size": 0 if is_fu else "1.2 MB",
                        "type": "to_follow_up" if is_fu else "application/pdf",
                        "fileUrl": "",
                        "uploadedAt": datetime.now().isoformat(),
                        "status": "to_follow_up" if is_fu else "attached",
                        "isFollowUp": is_fu
                    })
                elif isinstance(doc, dict):
                    saved = save_base64_file(doc, f"{app_id}_doc{i+1}")
                    if saved:
                        saved_docs.append(saved)

            attached_docs = [d for d in saved_docs if not d.get("isFollowUp") and d.get("status") != "to_follow_up" and d.get("type") != "to_follow_up"]
            follow_up_docs = [d for d in saved_docs if d.get("isFollowUp") or d.get("status") == "to_follow_up" or d.get("type") == "to_follow_up" or "(To Follow Up)" in str(d.get("name", ""))]

            s_avatar = (
                body.get("studentProfilePic") or
                body.get("profilePicture") or
                data.get("studentSettings", {}).get("profilePicture", "")
            )
            new_app = {
                "id": app_id,
                "scholarshipId": body.get("scholarshipId", "schol_nexo_tech_01"),
                "scholarshipTitle": body.get("scholarshipTitle", "Scholarship Program"),
                "providerName": body.get("providerName", data["settings"].get("orgName", "NEXO")),
                "studentName": body.get("studentName", data["studentSettings"].get("fullName", "Student Applicant")),
                "studentEmail": body.get("studentEmail", data["studentSettings"].get("email", "student@university.edu.ph")),
                "studentId": body.get("studentId", data["studentSettings"].get("studentId", "21-04589")),
                "university": body.get("university", data["studentSettings"].get("university", "Batangas State University")),
                "course": body.get("course", data["studentSettings"].get("course", "BS Information Technology")),
                "yearLevel": body.get("yearLevel", data["studentSettings"].get("yearLevel", "3rd Year")),
                "contactNumber": body.get("contactNumber", data["studentSettings"].get("contactNumber", "+63 912 345 6789")),
                "studentProfilePic": s_avatar,
                "profilePicture": s_avatar,
                "status": body.get("status", "Submitted"),
                "statusText": body.get("statusText", body.get("status", "Submitted")),
                "submittedAt": body.get("submittedAt", datetime.now().isoformat()),
                "formattedDate": body.get("formattedDate", datetime.now().strftime("%b %d, %Y")),
                "applicantCount": body.get("applicantCount") if (body.get("applicantCount") and "/ 10 " not in body.get("applicantCount")) else "1 / 200 Applicants",
                "documents": saved_docs,
                "uploadedDocuments": [d["name"] for d in attached_docs],
                "notes": body.get("notes", ""),
                "reviewedAt": None
            }
            data.setdefault("applications", []).insert(0, new_app)

            doc_notice = f"{len(attached_docs)} document(s) ({len(follow_up_docs)} to follow up)" if len(follow_up_docs) > 0 else f"{len(attached_docs)} document(s)"
            data.setdefault("notifications", []).insert(0, {
                "id": f"notif_{int(time.time()*1000)}",
                "recipient": "provider",
                "title": "New Application Received",
                "message": f"{new_app['studentName']} applied for \"{new_app['scholarshipTitle']}\" with {doc_notice}.",
                "timestamp": datetime.now().isoformat(),
                "formattedTime": "Just now",
                "read": False,
                "link": "provider-applications.html",
                "appId": new_app["id"]
            })
            sync_counts(data)
            write_data(data)
            return self._send_json(201, new_app)

        if path.startswith("/api/applications/"):
            app_id = path.replace("/api/applications/", "").split("/")[0]
            for a in data.get("applications", []):
                if str(a.get("id")) == str(app_id):
                    if "status" in body:
                        a["status"] = body["status"]
                        a["statusText"] = body["status"]
                    if "notes" in body:
                        a["notes"] = body["notes"]
                    if "feedback" in body:
                        a["feedback"] = body["feedback"]
                    a["reviewedAt"] = datetime.now().isoformat()

                    # Handle Follow-Up Document Upload
                    if "followUpDocument" in body:
                        fu = body["followUpDocument"]
                        saved_doc = save_base64_file(fu, f"{app_id}_followup_{int(time.time()*1000)}")
                        if not saved_doc:
                            saved_doc = {
                                "name": fu.get("name", "Document.pdf"),
                                "title": fu.get("requirement", fu.get("title", "Document")),
                                "requirement": fu.get("requirement", fu.get("title", "Document")),
                                "size": fu.get("size", "1.2 MB"),
                                "type": fu.get("type", "application/pdf"),
                                "fileUrl": fu.get("fileUrl", ""),
                                "uploadedAt": datetime.now().isoformat(),
                                "status": "attached",
                                "isFollowUp": False
                            }
                        
                        docs = a.get("documents", [])
                        req_target = fu.get("requirement", fu.get("title", "")).lower()
                        replaced = False
                        new_docs = []
                        for d in docs:
                            d_title = (d if isinstance(d, str) else d.get("requirement", d.get("title", d.get("name", "")))).lower()
                            is_fu = "(to follow up)" in d.lower() if isinstance(d, str) else (d.get("isFollowUp") or d.get("status") == "to_follow_up")
                            if is_fu and req_target in d_title and not replaced:
                                new_docs.append(saved_doc)
                                replaced = True
                            else:
                                new_docs.append(d)
                        if not replaced:
                            new_docs.append(saved_doc)
                        a["documents"] = new_docs
                        a["uploadedDocuments"] = [d.get("name", d) if isinstance(d, dict) else d for d in new_docs if not ((d.get("isFollowUp") or d.get("status") == "to_follow_up") if isinstance(d, dict) else "(to follow up)" in d.lower())]

                        data.setdefault("notifications", []).insert(0, {
                            "id": f"notif_{int(time.time()*1000)}",
                            "recipient": "provider",
                            "title": "Follow-Up Document Submitted",
                            "message": f"{a.get('studentName', 'Student')} attached a document for \"{a.get('scholarshipTitle', 'Scholarship')}\".",
                            "timestamp": datetime.now().isoformat(),
                            "formattedTime": "Just now",
                            "read": False,
                            "link": "provider-applications.html",
                            "appId": app_id
                        })

                    if "status" in body:
                        data.setdefault("notifications", []).insert(0, {
                            "id": f"notif_{int(time.time()*1000)}",
                            "recipient": "student",
                            "title": f"Application Status: {a.get('status', 'Updated')}",
                            "message": f"Your application for \"{a.get('scholarshipTitle', 'Scholarship')}\" is now {a.get('status', 'Updated')}.",
                            "timestamp": datetime.now().isoformat(),
                            "formattedTime": "Just now",
                            "read": False,
                            "link": "student-submissions.html",
                            "appId": app_id
                        })
                    write_data(data)
                    return self._send_json(200, {"success": True, "application": a})
            return self._send_json(404, {"success": False, "message": "Application not found"})

        if path == "/api/notifications/read":
            target_recipient = body.get("recipient")
            target_id = body.get("id")
            for n in data.get("notifications", []):
                if target_id:
                    if str(n.get("id")) == str(target_id):
                        n["read"] = True
                elif target_recipient:
                    if not n.get("recipient") or n.get("recipient") == target_recipient or n.get("recipient") == "all":
                        n["read"] = True
                else:
                    n["read"] = True
            write_data(data)
            return self._send_json(200, {"success": True})

        if path == "/api/settings":
            current = data.get("settings", DEFAULT_DATA["settings"])
            current.update(body)
            data["settings"] = current
            write_data(data)
            return self._send_json(200, {"success": True, "settings": current})

        if path == "/api/student-settings":
            email = (body.get("email") or query.get("email", [""])[0] or data.get("studentSettings", {}).get("email", "")).strip().lower()
            profiles = data.setdefault("studentProfiles", {})
            current = profiles.get(email) or data.get("studentSettings", DEFAULT_DATA["studentSettings"]).copy()
            current.update(body)
            if email:
                current["email"] = email
                profiles[email] = current
                for u in data.get("users", []):
                    if (u.get("email") or "").strip().lower() == email:
                        if "fullName" in body:
                            u["name"] = body["fullName"]
                        if "university" in body:
                            u["university"] = body["university"]
                        if "course" in body:
                            u["course"] = body["course"]
                        if "profilePicture" in body:
                            u["profilePicture"] = body["profilePicture"]
            data["studentSettings"] = current
            if "profilePicture" in body:
                for app in data.get("applications", []):
                    if not app.get("studentEmail") or app.get("studentEmail") == current.get("email"):
                        app["studentProfilePic"] = current.get("profilePicture", "")
                        app["profilePicture"] = current.get("profilePicture", "")
            write_data(data)
            return self._send_json(200, {"success": True, "settings": current})

        if path == "/api/users":
            email = (body.get("email") or "").strip().lower()
            role = (body.get("role") or "student").strip().lower()
            name = (body.get("name") or "").strip() or ("Scholarship Provider" if role == "provider" else "")
            status = "banned" if body.get("status") == "banned" else "active"
            if not email:
                return self._send_json(400, {"success": False, "error": "Email is required"})
            
            users = data.get("users", [])
            if any(u.get("email", "").lower() == email for u in users):
                return self._send_json(400, {"success": False, "error": f"An account with email {email} already exists."})
            
            password = (body.get("password") or "").strip() or "password123"
            new_user = {
                "id": f"usr_{'prov_' if role == 'provider' else 'stud_'}{int(time.time()*1000)}",
                "email": email,
                "password": password,
                "role": role,
                "name": name,
                "orgName": name if role == "provider" else None,
                "status": status,
                "createdAt": datetime.now().isoformat(),
                "formattedDate": datetime.now().strftime("%b %d, %Y"),
                "notes": body.get("notes") or ("Created by Developer Admin" if body.get("createdByAdmin") else "Registered Account")
            }
            users.insert(0, new_user)
            data["users"] = users
            write_data(data)
            return self._send_json(201, {"success": True, "user": new_user})

        if path.startswith("/api/users/"):
            uid = path.replace("/api/users/", "").split("/")[0]
            users = data.get("users", [])
            for u in users:
                if str(u.get("id")) == str(uid):
                    if "status" in body:
                        u["status"] = "banned" if body["status"] == "banned" else "active"
                    if "name" in body:
                        u["name"] = body["name"]
                    write_data(data)
                    return self._send_json(200, {"success": True, "user": u})
            return self._send_json(404, {"error": "User not found"})

        if path == "/api/admin/clean-database":
            action = body.get("action")
            if action == "clear_applications":
                count = len(data.get("applications", []))
                data["applications"] = []
                sync_counts(data)
                write_data(data)
                return self._send_json(200, {"success": True, "message": f"Cleared all {count} applications."})
            
            if action == "clear_drafts":
                count = len(data.get("drafts", []))
                data["drafts"] = []
                write_data(data)
                return self._send_json(200, {"success": True, "message": f"Cleared all {count} drafts."})
            
            if action == "delete_scholarship" and body.get("id"):
                target_id = str(body["id"])
                data["scholarships"] = [s for s in data.get("scholarships", []) if str(s.get("id")) != target_id]
                prev_apps = len(data.get("applications", []))
                data["applications"] = [a for a in data.get("applications", []) if str(a.get("scholarshipId")) != target_id]
                removed = prev_apps - len(data["applications"])
                sync_counts(data)
                write_data(data)
                return self._send_json(200, {"success": True, "message": f"Deleted scholarship and {removed} applications."})

            if action == "reset_factory_data":
                data["applications"] = []
                data["drafts"] = []
                data["notifications"] = DEFAULT_DATA.get("notifications", [])
                data["users"] = DEFAULT_DATA.get("users", [])
                for s in data.get("scholarships", []):
                    s["applicantTotal"] = 0
                    s["applicantCount"] = f"0 / {s.get('applicantLimit', 200)} Applicants"
                write_data(data)
                return self._send_json(200, {"success": True, "message": "Database reset to factory defaults."})

        return self._send_json(404, {"error": "Not Found"})

    def do_PATCH(self):
        self.do_POST()

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        data = read_data()

        if path.startswith("/api/notifications/"):
            nid = path.replace("/api/notifications/", "").split("/")[0]
            data["notifications"] = [n for n in data.get("notifications", []) if str(n.get("id")) != str(nid)]
            write_data(data)
            return self._send_json(200, {"success": True, "message": "Notification deleted permanently"})

        if path.startswith("/api/users/"):
            uid = path.replace("/api/users/", "").split("/")[0]
            users = data.get("users", [])
            target_user = next((u for u in users if str(u.get("id")) == str(uid)), None)
            if not target_user:
                return self._send_json(404, {"error": "User not found"})
            
            data["users"] = [u for u in users if str(u.get("id")) != str(uid)]
            removed_posts = 0
            removed_apps = 0

            if target_user.get("role") == "student":
                pre_apps = len(data.get("applications", []))
                data["applications"] = [a for a in data.get("applications", []) if (a.get("studentEmail") or "").lower() != target_user.get("email", "").lower()]
                removed_apps = pre_apps - len(data["applications"])
                sync_counts(data)
            elif target_user.get("role") == "provider":
                prov_name = target_user.get("name") or target_user.get("orgName")
                prov_email = (target_user.get("email") or "").lower()
                prov_schols = [str(s.get("id")) for s in data.get("scholarships", []) if s.get("providerName") == prov_name or (s.get("providerEmail") or "").lower() == prov_email]
                removed_posts = len(prov_schols)
                data["scholarships"] = [s for s in data.get("scholarships", []) if str(s.get("id")) not in prov_schols]
                data["drafts"] = [d for d in data.get("drafts", []) if str(d.get("id")) not in prov_schols]
                pre_apps = len(data.get("applications", []))
                data["applications"] = [a for a in data.get("applications", []) if str(a.get("scholarshipId")) not in prov_schols]
                removed_apps = pre_apps - len(data["applications"])

            write_data(data)
            return self._send_json(200, {
                "success": True,
                "message": f"Account deleted. Removed {removed_posts} posts and {removed_apps} applications.",
                "deletedId": uid
            })

        if path.startswith("/api/scholarships/"):
            sid = path.replace("/api/scholarships/", "")
            data["scholarships"] = [s for s in data.get("scholarships", []) if str(s.get("id")) != str(sid)]
            write_data(data)
            return self._send_json(200, {"success": True, "id": sid})

        if path.startswith("/api/drafts/"):
            did = path.replace("/api/drafts/", "")
            data["drafts"] = [d for d in data.get("drafts", []) if str(d.get("id")) != str(did)]
            write_data(data)
            return self._send_json(200, {"success": True, "id": did})

        if path.startswith("/api/applications/"):
            aid = path.replace("/api/applications/", "")
            data["applications"] = [a for a in data.get("applications", []) if str(a.get("id")) != str(aid)]
            sync_counts(data)
            write_data(data)
            return self._send_json(200, {"success": True, "id": aid})

        return self._send_json(404, {"error": "Not Found"})

if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), NexoHandler)
    print(f"\nNEXO Python Backend Server Running on http://localhost:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
