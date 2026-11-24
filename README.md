# Home for Paws

Home for Paws is a pet-adoption application with a Vite + React frontend, an Express API, and MySQL persistence. Visitors can browse pets, while registered users can manage profiles, register owned pets, and submit adoption requests.

## Prerequisites

Install these before running the application:

- Node.js 20 or newer and npm
- MySQL 8 or a compatible local MySQL server, running on the configured host and port
- PowerShell on Windows for the commands below

The default ports are `3001` for the Express API and `5173` for the Vite development server. Vite proxies relative `/api` requests to the API.

## Install and configure

Run these commands from the absolute project directory `C:\MyProject`:

```powershell
Set-Location C:\MyProject
npm run install:deps
Copy-Item server/.env.example server/.env
```

Edit the ignored `server/.env` with values for the local environment. Do not commit this file or place its values in client code, source files, documentation, or logs.

Required environment variables are:

| Variable | Purpose |
| --- | --- |
| `DB_HOST` | MySQL host, normally `localhost` |
| `DB_PORT` | MySQL port, normally `3306` |
| `DB_NAME` | Application database name |
| `DB_USER` | MySQL account used by the API and setup script |
| `DB_PASSWORD` | MySQL account password |
| `SESSION_SECRET` | Local-only value used to hash session tokens |
| `MANAGEMENT_API_KEY` | Local-only key for management adoption and pet operations |

Optional variables are `NODE_ENV`, `PORT`, `DB_CONNECTION_LIMIT`, `SESSION_MAX_AGE_MS`, `SESSION_COOKIE_NAME`, `SECURE_COOKIES`, `PET_IMAGE_MAX_BYTES`, and `PET_IMAGE_DIRECTORY`. `PET_IMAGE_MAX_BYTES` defaults to `5242880` (5 MiB). `PET_IMAGE_DIRECTORY` defaults to `server/uploads/pets` and may be an absolute path or a path relative to `server`. `SECURE_COOKIES=true` should be used when the production API is served over HTTPS. The template contains blank or non-secret placeholders only.

## Pet image uploads

The registration form accepts optional JPEG, PNG, GIF, and WebP files up to 5 MiB. The browser checks the selected file before submitting, while the API checks the file's binary signature rather than trusting its MIME type. The API stores files with generated names under `PET_IMAGE_DIRECTORY`, records the `/uploads/pets/...` URL and detected MIME type and byte size in MySQL, and serves only those generated image names inline. Cleanup failures are logged without deleting unrelated paths; the storage service also exposes a reconciliation operation that removes only unreferenced generated names when supplied with the image URLs currently referenced by pets. Uploaded files are runtime data and must not be committed.

When the Vite development server is used, both `/api` and `/uploads` are proxied to `http://localhost:3001`, so a stored image URL can be rendered directly by the client. A production web server must proxy `/api` and `/uploads` to the Express API, or serve the configured upload directory using an equivalent restricted static route. Do not expose the upload directory as an executable or general-purpose file directory.

## Database setup, migration, and seed

Start MySQL, then run the idempotent schema upgrade and seed command:

```powershell
npm run db:setup
```

The root aliases below are also available:

```powershell
npm run db:migrate
npm run db:seed
```

Both aliases run the same safe, idempotent setup because the setup script upgrades legacy installations before loading the sample pets. It creates the users, sessions, pets, and adoption-request tables without dropping existing data. Run the command again to verify that an existing database can be upgraded safely.

## Development commands

Start the API and Vite frontend together:

```powershell
npm run dev
```

Run either service separately when needed:

```powershell
npm run api       # Express API on http://localhost:3001
npm run frontend  # Vite frontend, normally http://localhost:5173
```

The API reads only `server/.env`. Database credentials and management keys are never sent to the browser.

## Production build and start

Build both workspaces, then start the API:

```powershell
npm run build
npm run api
```

The client production files are written to `client/dist`. Serve that directory with the production web server of your choice, configured to proxy `/api` to the Express API. For a local preview of the built client, use:

```powershell
npm run preview
```

The server-only commands are also available as `npm run build:server` and `npm run build:client`.

## API endpoints

Public endpoints:

- `GET /api/health` checks that the API is running.
- `GET /api/pets` lists pets with `search`, `species`, `breed`, `gender`, `size`, `status`, `page`, and `pageSize` filters.
- `GET /api/pets/:id` returns one pet.

Authentication and profile endpoints:

- `POST /api/auth/register` accepts `name`, `email`, `password`, and optional `phone` and `address`.
- `POST /api/auth/login` creates an opaque server-side session in an HttpOnly cookie.
- `GET /api/auth/me` returns the authenticated profile.
- `POST /api/auth/logout` revokes the current session.
- `GET /api/profile` and `PATCH /api/profile` read or update the authenticated profile.

Authenticated pet and adoption endpoints:

- `POST /api/pets` registers a pet owned by the current user. It accepts the existing JSON body or `multipart/form-data` with the same pet fields and one optional `image` file.
- `PATCH`, `PUT`, and `DELETE /api/pets/:id` require the owner or the management API key. `PATCH` and `PUT` also accept the optional `image` upload and replace the previous stored image when one is supplied.
- `POST /api/adoption-requests` requires an authenticated user and accepts `petId` and `message`; applicant identity is derived from the signed-in profile, which must include a phone number.
- `GET /api/adoption-requests` lists the current user's requests. The management API key lists all requests.

Management endpoints accept the local-only `x-api-key` header. Management users can read, update, and delete adoption requests. A request can remain pending or move from pending to approved or rejected; terminal statuses cannot be changed. Approval marks the pet adopted, rejection returns it to available, and unavailable pets return a stable conflict response.

## Browser flow and authorization

The Vite client uses hash navigation so the public listing remains available without a routing dependency. The available pages are `#pets`, `#register`, `#login`, `#profile`, `#register-pet`, and `#my-adoptions`. Visitors can search, filter, and open pet details. Applying from a pet profile sends a signed-out visitor to sign in. A signed-in user can edit the profile, register a pet, apply with the profile name/email/phone and an application message (a phone number is required), and view only that user's requests. Sign out revokes the server session and returns to public browsing.

The browser sends relative `/api` requests through the Vite proxy with browser-managed same-origin credentials. The session cookie is HttpOnly, so the client never reads or stores the session token. The API derives the pet owner and adoption-request user from that session. Pet update/delete operations require the owning account; management operations still require the server-only `x-api-key` value. Adoption submission locks the pet and rejects pending or adopted pets with `PET_UNAVAILABLE`.

The MySQL relationships are `sessions.user_id -> users.id` with cascade delete, `pets.owner_user_id -> users.id` with set-null delete, `adoption_requests.user_id -> users.id` with set-null delete, and `adoption_requests.pet_id -> pets.id` with restrict delete. The schema indexes normalized unique user email, unique session token hash, session user and expiry, pet owner/status/species/creation, and adoption request pet/user/status/user-plus-status columns. `setup-db` upgrades the legacy installation without dropping data.

## Verification

Run the client tests, all workspace tests, syntax checks, and the production build from `C:\MyProject`:

```powershell
npm run test --workspace client
npm run build:client
npm run build --workspace client
npm run test --workspace server
node --check server/test/api.test.js
node --check server/test/setup-db.test.js
npm run build
npm test
```

With MySQL configured, run `npm run db:setup` twice. The injected-repository API tests do not require a live database, but live setup requires the MySQL service and the environment variables above.
