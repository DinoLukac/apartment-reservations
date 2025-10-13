# Apartment Reservations (Apartmani)

Monorepo with Express/MongoDB backend and React/Vite frontend for managing apartment listings, availability, and reservations.

## Stack

- Backend: Node.js (ESM), Express, Mongoose, JWT (jose/jsonwebtoken), Multer + Sharp, Day.js, Zod, Nodemailer
- Frontend: React 18, Vite, React Router v6, Axios, Leaflet + react-leaflet, react-day-picker
- DB: MongoDB

## Features

- Auth with access/refresh tokens, optional Google/Facebook OAuth
- Property onboarding with map-based location picker
- Image upload with server-side compression to WebP
- Calendar with per-unit availability and iCal sync (optional per unit)
- Owner dashboard with sync status/actions

## Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- PowerShell (instructions use Windows PowerShell)

## Local development

1) Backend (port 4000)

- Copy env and install deps

  - Create `backend/.env` from `backend/.env.example` and fill values
  - Required minimum: `MONGO_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
  - Optional: SMTP settings for email verification, OAuth client IDs, CORS domain

  - Run in PowerShell
    - cd backend
    - npm install
    - npm run dev

2) Frontend (port 3000)

- Copy env and install deps

  - Create `frontend/.env` from `frontend/.env.example`
  - Set `VITE_API_URL` to backend API, e.g. `http://localhost:4000/api`
  - For OAuth buttons (optional): set `VITE_OAUTH_FLOW`, `VITE_GOOGLE_CLIENT_ID`, `VITE_FACEBOOK_APP_ID`

  - Run in PowerShell
    - cd frontend
    - npm install
    - npm run dev

## Environment variables

Backend (`backend/.env`)

- Core
  - NODE_ENV, PORT, APP_URL, FRONTEND_URL, BACKEND_URL, BASE_URL, TIMEZONE
- Mongo
  - MONGO_URL, MONGO_DB_NAME
- Auth
  - JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE, ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL, REFRESH_ROTATION, REFRESH_REUSE_DETECT
- Cookies/CORS
  - CORS_ORIGIN, COOKIE_SECURE, COOKIE_SAMESITE, COOKIE_DOMAIN
- Admin bootstrap
  - ADMIN_EMAIL, ADMIN_PASSWORD
- Mail
  - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE, MAIL_FROM, MAIL_REPLY_TO, MAIL_TEMPLATES_DIR
- OAuth
  - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT
  - FACEBOOK_CLIENT_ID, FACEBOOK_CLIENT_SECRET, FACEBOOK_REDIRECT
- Security/limits
  - RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX, SESSION_TTL_HOURS, LOG_LEVEL, REQUEST_ID_HEADER
  - OAUTH_STATE_ENFORCE, OIDC_NONCE_ENFORCE, OAUTH_REDIRECT_ALLOWLIST

Frontend (`frontend/.env`)

- VITE_API_URL=http://localhost:4000/api
- Optional OAuth:
  - VITE_OAUTH_FLOW=redirect
  - VITE_GOOGLE_CLIENT_ID=
  - VITE_FACEBOOK_APP_ID=
  - VITE_GOOGLE_OAUTH_CALLBACK=
  - VITE_FACEBOOK_OAUTH_CALLBACK=

## Useful scripts

- Backend
  - npm run dev — start backend with watch
  - npm start — production start

- Frontend
  - npm run dev — start Vite dev server
  - npm run build — build for production
  - npm run preview — preview production build

## Notes

- .env files are ignored by git. Use the provided .env.example files.
- On Windows, Git may convert line endings (CRLF/LF). Optional: add a .gitattributes to normalize.
