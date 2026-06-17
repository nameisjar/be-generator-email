# Email Alias Manager — Backend

Express + Prisma API for managing email aliases on `algonova.my.id` and storing
emails forwarded by the Cloudflare Worker.

## Setup

```bash
cd backend
cp .env.example .env
# edit .env with your DB URL, JWT secrets, WEBHOOK_SECRET
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

## Endpoints

| Method | Path                                    | Auth | Description                                |
|--------|-----------------------------------------|------|--------------------------------------------|
| POST   | `/api/auth/register`                    | —    | Register, sets `rt` cookie + returns JWT.  |
| POST   | `/api/auth/login`                       | —    | Login, sets `rt` cookie + returns JWT.     |
| POST   | `/api/auth/refresh`                     | —    | Rotate tokens (reads `rt` cookie).         |
| POST   | `/api/auth/logout`                      | —    | Revoke refresh token.                      |
| GET    | `/api/auth/me`                          | ✓    | Current user.                              |
| GET    | `/api/aliases`                          | ✓    | List your aliases.                         |
| POST   | `/api/aliases`                          | ✓    | Create an alias (random or custom).        |
| GET    | `/api/aliases/:id`                      | ✓    | One alias.                                 |
| PATCH  | `/api/aliases/:id`                      | ✓    | Update label / isActive.                   |
| DELETE | `/api/aliases/:id`                      | ✓    | Hard-delete (cascades to emails).          |
| GET    | `/api/aliases/:aliasId/emails`          | ✓    | Inbox for an alias.                        |
| GET    | `/api/emails/:id`                       | ✓    | Email detail.                              |
| PATCH  | `/api/emails/:id/read`                  | ✓    | Mark read/unread.                          |
| DELETE | `/api/emails/:id`                       | ✓    | Delete an email.                           |
| GET    | `/api/dashboard/overview`               | ✓    | Counts + recent emails.                    |
| POST   | `/api/webhook/incoming-email`           | HMAC | Worker posts parsed email here.            |

## Auth flow

- Access token: short-lived (15m), sent in `Authorization: Bearer <token>`.
- Refresh token: long-lived (14d), stored as `httpOnly` cookie `rt` (path
  `/api/auth`) and a hashed copy in the `refresh_tokens` table for rotation.
- All `/api/aliases/*`, `/api/emails/*`, `/api/dashboard/*` routes require a
  valid access token.

## Webhook signature

The Worker signs `${timestamp}.${rawBody}` with HMAC-SHA256 using `WEBHOOK_SECRET`.
The backend rejects requests older than `WEBHOOK_MAX_AGE_SECONDS` (replay protection).
