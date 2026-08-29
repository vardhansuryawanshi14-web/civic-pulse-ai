# CivicPulse — AI-Powered Civic Issue Reporting & Prioritization

Citizens report civic problems (potholes, garbage, broken street lights, water leakage) with a photo, a short description and a district. Two AI models process every submission: Google Cloud Vision classifies the photo into an issue type, and a TF-IDF + Logistic Regression model reads the description and judges urgency. A scoring formula combines both, and municipal officers see their ward's queue ranked with the most critical complaint first.

**Stack:** React 19 + Vite + Tailwind CSS 4 on the frontend, Flask + SQLAlchemy + MySQL on the backend, scikit-learn and Google Cloud Vision for the AI, JWT for auth.

---

## Features

### Citizen
- Register and log in with email + password, or with Google Sign-In. Both registration and login are confirmed by a 6-digit code emailed via Gmail SMTP.
- File a complaint: photo, description, district, optional landmark and GPS coordinates.
- The issue type and urgency are filled in automatically by the AI — the citizen never picks them.
- Track only their own complaints, with status, priority badge and officer notes.
- In-app notifications when a complaint's status changes.
- Forgot-password reset over an emailed OTP.

### Municipal Officer
- Sees only the complaints from the district assigned to them, sorted by priority score.
- Moves a complaint through Open → In Progress → Resolved; the citizen is notified on every change.
- Adds internal notes to a complaint.

### Admin
- All complaints system-wide, with filters.
- Analytics dashboard: counts by issue type, status and district, trend over time, officer performance (Chart.js).
- Complaint heatmap on Google Maps.
- Officer account management — create, edit, assign a district, deactivate.
- PDF reports generated with ReportLab.

---

## How the AI pipeline works

A submitted complaint goes through three steps before it is saved:

1. **Image classification** — `services/vision_api.py` sends the photo bytes to Google Cloud Vision label detection and maps the returned labels onto one of the five issue types. Labels belonging to vehicles (`Automotive lighting`, `Tail & Brake Light`) are ignored so a parked car in frame does not become a "Broken Light". If Vision is not configured or fails, it falls back to keyword matching on the description — an unavailable API never blocks a citizen from filing a complaint.

2. **Urgency classification** — `services/nlp_model.py` loads `ml/model.pkl` and `ml/vectorizer.pkl` once at startup and predicts Low / Medium / High from the description. The model is never retrained at request time.

3. **Priority score** — `services/priority.py`:

```python
ISSUE_WEIGHTS       = {'Pothole': 10, 'Broken Light': 8, 'Water Leakage': 7, 'Garbage': 5, 'Other': 3}
URGENCY_MULTIPLIERS = {'High': 3, 'Medium': 2, 'Low': 1}

score = ISSUE_WEIGHTS[issue_type] * URGENCY_MULTIPLIERS[urgency_level]
```

Officers see the score colour-coded: **≥ 20 red (critical)**, **10–19 amber (moderate)**, **< 10 green (low)**.

Retrain the urgency model with `python ml/train_model.py` — it writes both pickles next to itself and prints a classification report.

---

## Security model

Every protected route requires a valid JWT and checks the caller's role before doing anything. Beyond that, every query is scoped to the caller:

- A citizen's complaint and notification queries are filtered by `citizen_id == current_user.id`; a single-record fetch aborts with 403 when the record belongs to someone else.
- An officer's queries are filtered by `ward == current_user.ward`, so complaints from other districts are invisible, not merely hidden.
- Districts are canonicalised through `services/district.py` on every write, because officer access is an exact string match — "kalwa west", "Kalwa West" and "KALWA WEST" have to land in the same queue.
- Only admins reach the admin blueprint.

Auth travels as a Bearer token rather than a session cookie: the frontend and backend are deployed on different sites, and browsers block third-party cookies. Complaint photos are the one exception — an `<img>` tag cannot send an `Authorization` header, so that single route also accepts `?token=`.

---

## Project structure

```
backend/
  app.py                  # app factory, JWT setup, CORS, table + admin bootstrap
  config.py               # env config; materialises Google credentials on Railway
  models/                 # user, complaint, notification, otp
  routes/                 # auth, citizen, officer, admin blueprints
  services/               # vision_api, nlp_model, priority, district, email_service, pdf_service
  ml/                     # train_model.py + model.pkl / vectorizer.pkl
  create_db.py            # create tables, seed the admin  (--reset empties everything)
  seed.py                 # demo accounts and realistic complaints (--wipe to undo)

frontend/
  src/api/axios.js        # single axios instance, base URL from VITE_API_URL
  src/context/            # AuthContext
  src/components/         # layout, route guards, complaint card, heatmap, UI
  src/pages/              # landing, auth flow, citizen / officer / admin screens
```

Complaint photos are stored as a `MEDIUMBLOB` in the database rather than on disk, because the production filesystem is ephemeral and anything written to `uploads/` disappears on the next deploy. The column is deferred, so listing complaints never drags image bytes out of MySQL.

---

## Local setup

Requires Python 3.11+, Node 20+ and a local MySQL server.

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:

```
DATABASE_URL=mysql+mysqlconnector://user:password@localhost/civic_db
SECRET_KEY=any-long-random-string
JWT_SECRET_KEY=another-long-random-string
FLASK_ENV=development
FRONTEND_URL=http://localhost:5173

# Google Cloud Vision — optional, falls back to keyword matching without it
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json

# Gmail SMTP — needed for login codes and password reset OTPs
GMAIL_ADDRESS=yourproject@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password

# Google Sign-In — optional
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
```

Then create the schema and the admin account, and optionally load demo data:

```bash
python create_db.py     # creates tables + admin@civicpulse.local / admin123
python seed.py          # 3 citizens, 3 officers, 24 complaints — password demo1234
python app.py           # http://localhost:5000
```

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```
VITE_API_URL=http://localhost:5000
VITE_GOOGLE_MAPS_API_KEY=your-maps-browser-key
```

```bash
npm run dev             # http://localhost:5173
```

`FRONTEND_URL` in the backend `.env` must match the frontend's origin exactly — no trailing slash. A mismatch fails CORS silently and looks identical to "not logged in".

---

## Checks

The non-trivial pure logic carries its own runnable self-check:

```bash
cd backend
python services/priority.py     # scoring formula, including unknown inputs
python services/district.py     # district canonicalisation
python services/vision_api.py   # label matching and description fallback
python test_timestamps.py
python test_login_otp.py
```

---

## API

All responses share one shape: `{"success": bool, "data": {...}, "message": "..."}`, and errors add `error_code`.

**Auth** — `/api/auth`
```
POST /register  POST /login  POST /verify-login-otp  POST /resend-otp
POST /logout    GET  /me     GET  /google            GET  /google/callback
POST /forgot-password  POST /verify-otp  POST /reset-password
```

**Citizen** — `/api/citizen`
```
POST  /complaints          GET   /complaints              GET /complaints/<id>
GET   /notifications       PATCH /notifications/read-all   PATCH /notifications/<id>
GET   /api/complaints/<id>/photo
```

**Officer** — `/api/officer`
```
GET   /complaints                 GET /complaints/<id>   POST /complaints/<id>/notes
PATCH /complaints/<id>/status     GET /profile
```

**Admin** — `/api/admin`
```
GET /complaints  GET /analytics  GET /report
GET /officers    POST /officers  PATCH /officers/<id>  DELETE /officers/<id>
```

---

## Deployment

- **Backend + MySQL:** Railway. `Procfile` runs `gunicorn app:app`. Missing tables are created at startup, and setting `ADMIN_EMAIL` / `ADMIN_PASSWORD` bootstraps an admin account on a fresh database — without it a new deploy has no way into the admin screens, since registration and Google sign-in both create citizens.
- **Frontend:** Vercel, via `vercel.json`. Set `VITE_API_URL` to the Railway backend URL.
- On Railway there is no filesystem to upload the Vision service account JSON to, so pass the JSON itself (raw or base64) in `GOOGLE_CREDENTIALS_JSON` and `config.py` writes it to a temp file at boot.

---

## License

MIT
