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
        "fullName": "Juan Dela Cruz",
        "email": "admin@admin.edu.ph",
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
    }
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
    if not doc or not isinstance(doc, dict) or "data" not in doc:
        return doc
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
            "size": doc.get("size", len(file_bytes)),
            "type": doc.get("type", "application/octet-stream"),
            "fileUrl": f"/uploads/{disk_filename}",
            "uploadedAt": datetime.now().isoformat()
        }
    except Exception as e:
        print("Error saving file:", e)
        return {
            "name": doc.get("name", "document"),
            "size": 0,
            "type": "application/octet-stream",
            "fileUrl": ""
        }

def sync_counts(data):
    counts = {}
    for app in data.get("applications", []):
        sid = app.get("scholarshipId")
        if sid:
            counts[sid] = counts.get(sid, 0) + 1
    for s in data.get("scholarships", []):
        c = counts.get(s["id"], 0)
        s["applicantCount"] = f"{c} / 10 Applicants"
        s["applicantTotal"] = c

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

        if path == "/api/data":
            data = read_data()
            sync_counts(data)
            write_data(data)
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
            query = urllib.parse.parse_qs(parsed.query)
            recip = query.get("recipient", [None])[0]
            if recip:
                notifs = [n for n in notifs if not n.get("recipient") or n.get("recipient") == recip or n.get("recipient") == "all"]
            return self._send_json(200, notifs)

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
            data = read_data()
            return self._send_json(200, data.get("settings", DEFAULT_DATA["settings"]))

        if path == "/api/student-settings":
            data = read_data()
            return self._send_json(200, data.get("studentSettings", DEFAULT_DATA["studentSettings"]))

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
        body = self._read_json()
        data = read_data()

        if path == "/api/scholarships":
            new_sch = {
                "id": body.get("id", f"schol_{int(time.time()*1000)}"),
                "title": (body.get("title") or "Untitled Scholarship").strip(),
                "desc": (body.get("desc") or "").strip(),
                "type": body.get("type", "Other"),
                "typeText": body.get("typeText", body.get("type", "Other")),
                "deadline": body.get("deadline", ""),
                "formattedDate": body.get("formattedDate", "No Deadline"),
                "requirements": body.get("requirements", []),
                "providerName": body.get("providerName", data["settings"].get("orgName", "NEXO")),
                "providerLogo": body.get("providerLogo", data["settings"].get("logoImage", "")),
                "providerBanner": body.get("providerBanner", data["settings"].get("bannerImage", "")),
                "benefit": body.get("benefit", "₱ 10,000 Grant"),
                "status": body.get("status", "Open"),
                "applicantCount": "0 / 10 Applicants",
                "createdAt": datetime.now().isoformat()
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
            app_id = body.get("id", f"app_{int(time.time()*1000)}")
            saved_docs = []
            raw_docs = body.get("documents") or body.get("uploadedDocuments") or []
            for i, doc in enumerate(raw_docs):
                if isinstance(doc, str):
                    saved_docs.append({
                        "name": doc,
                        "size": "1.2 MB",
                        "type": "application/pdf",
                        "fileUrl": "",
                        "uploadedAt": datetime.now().isoformat()
                    })
                elif isinstance(doc, dict):
                    saved = save_base64_file(doc, f"{app_id}_doc{i+1}")
                    saved_docs.append(saved)

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
                "status": body.get("status", "Submitted"),
                "statusText": body.get("statusText", body.get("status", "Submitted")),
                "submittedAt": body.get("submittedAt", datetime.now().isoformat()),
                "formattedDate": body.get("formattedDate", datetime.now().strftime("%b %d, %Y")),
                "applicantCount": body.get("applicantCount", "1 / 10 Applicants"),
                "documents": saved_docs,
                "uploadedDocuments": [d["name"] for d in saved_docs],
                "notes": body.get("notes", ""),
                "reviewedAt": None
            }
            data.setdefault("applications", []).insert(0, new_app)
            data.setdefault("notifications", []).insert(0, {
                "id": f"notif_{int(time.time()*1000)}",
                "recipient": "provider",
                "title": "New Application Received",
                "message": f"{new_app['studentName']} applied for \"{new_app['scholarshipTitle']}\" with {len(saved_docs)} document(s).",
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
            current = data.get("studentSettings", DEFAULT_DATA["studentSettings"])
            current.update(body)
            data["studentSettings"] = current
            write_data(data)
            return self._send_json(200, {"success": True, "settings": current})

        return self._send_json(404, {"error": "Not Found"})

    def do_PATCH(self):
        self.do_POST()

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        data = read_data()

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
