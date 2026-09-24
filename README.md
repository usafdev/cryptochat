# CryptoChat

**Private, end-to-end encrypted messaging for direct conversations.**

CryptoChat is a privacy-focused messaging platform designed for secure one-to-one communication. Messages are encrypted in the browser before they are sent to the server, with authenticated accounts, friend-based conversations, and realtime message delivery built into the platform.

![CryptoChat home screen](assets/Screenshot_11.png)

## Features

- Browser-generated RSA-OAEP identity keys
- Per-message AES-GCM encryption
- Password-encrypted private-key recovery
- Authenticated sessions with database-backed revocation and expiry
- Friend requests and friend-only direct conversations
- HTTP message history with pagination
- Authenticated Socket.IO realtime delivery
- Request validation, authorization checks, and rate limiting

![CryptoChat chat screen](assets/Screenshot_1.png)
![CryptoChat chat screen](assets/Screenshot_4.png)
![CryptoChat chat screen](assets/Screenshot_5.png)


## Requirements

- Node.js 20 or newer
- npm
- PostgreSQL 16 or newer
- Docker Desktop (optional, for local PostgreSQL setup)

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/usafdev/cryptochat.git
cd cryptochat
```

### 2. Install dependencies

```bash
npm install
npx prisma generate
```

### 3. Configure environment variables

Create a local environment file from the committed template:

```bash
cp .env.example .env
```

On Windows PowerShell, use:

```powershell
Copy-Item .env.example .env
```

For local development, the template expects the PostgreSQL service from the next step. Change `SESSION_SECRET` to a random value of at least 32 characters.

Important variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Server-side session-signing secret; use a long random value |
| `APP_ORIGIN` | Exact browser origin, such as `http://localhost:3000` |
| `PORT` | HTTP and Socket.IO server port |
| `NODE_ENV` | Use `development` locally and `production` in deployment |

### 4. Start PostgreSQL

Docker is optional. If you use Docker Desktop:

```bash
docker compose up -d
```

The included compose file creates a local database named `cryptochat` with the credentials in `.env.example`. Set `POSTGRES_PASSWORD` before starting the container if you want to use a different password, and update `DATABASE_URL` to match.

### 5. Apply database migrations

```bash
npx prisma migrate deploy
```

### 6. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Testing

Run the unit tests:

```bash
npm test
```

Run the production type/build checks:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Integration tests can be run against a **dedicated non-production database**:

```bash
npm run test:integration
```

The integration suite starts a temporary local server on port `3101`, creates test users and records, and cleans them up when it finishes. PostgreSQL must be running and `DATABASE_URL` must point to the dedicated test database.

## Production deployment

1. Provision PostgreSQL and set `DATABASE_URL`.
2. Set `NODE_ENV=production`.
3. Set `SESSION_SECRET` to a long, randomly generated secret of at least 32 characters.
4. Set `APP_ORIGIN` to the exact public HTTPS origin, without a path, query string, or credentials.
5. Install dependencies and generate Prisma Client:

   ```bash
   npm ci
   npx prisma generate
   ```

6. Apply migrations:

   ```bash
   npx prisma migrate deploy
   ```

7. Build and start the application:

   ```bash
   npm run build
   npm start
   ```

8. Put the application behind HTTPS and a trusted reverse proxy that forwards the client IP through `X-Real-IP` or `X-Forwarded-For`.

Production configuration fails closed when required database, origin, or session-secret settings are missing. The built-in rate limiter is in-process and is suitable for one server instance only; replace it with shared infrastructure before running multiple application instances. 

## Security model and limitations

Messages are encrypted in the browser with a fresh AES-GCM key per message. That key is wrapped for the recipient and sender with their RSA-OAEP public keys. The server stores and relays encrypted payloads, but it still sees account identities, conversation membership, timestamps, and message metadata.

This project has not had an independent security audit. The application server controls the JavaScript delivered to browsers, so this implementation should not be treated as protection against a malicious or compromised deployment serving altered client code. Users should also understand that there is currently no independent public-key fingerprint verification or forward-secret ratcheting protocol.

Do not use the integration test command against a production database.
