# Qlass

**Qlass** is an open-source, self-hostable learning management system inspired by Google Classroom — built for educators who want control over their data and infrastructure.

MIT License · Next.js 14 · PostgreSQL · Prisma · NextAuth

## Features

- **Authentication** — Email/password plus optional Google & GitHub OAuth
- **Roles** — Admin, Teacher, Student (Guardian-ready schema)
- **Classes** — Create, join via code, customizable banner colors
- **Stream** — Announcement feed with notifications
- **Classwork** — Assignments with due dates, points, categories
- **Submissions** — Turn in / unsubmit with late flags
- **Grading** — Teacher queue, inline grades, return to student
- **Notifications** — In-app bell with unread counts
- **Admin** — User list, suspend, system settings stub
- **Storage** — Local uploads, AWS S3, or Supabase Storage

## Quick start (< 5 minutes)

### 1. Clone & configure

```bash
cd qlass
cp .env.example .env
cp .env.example .env.local
```

Edit both files (or symlink: `ln -sf .env.local .env`) — Prisma CLI reads `.env`; Next.js reads `.env.local`. At minimum set:

```env
DATABASE_URL=postgresql://qlass:qlass@localhost:5432/qlass?schema=public
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=$(openssl rand -base64 32)
```

### 2. Start PostgreSQL

```bash
docker compose up postgres -d
```

### 3. Install & migrate

```bash
npm install
npm run db:push
npm run db:seed
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Demo accounts

| Role    | Email                 | Password     |
|---------|-----------------------|--------------|
| Admin   | admin@qlass.local     | password123  |
| Teacher | teacher@qlass.local   | password123  |
| Student | student@qlass.local   | password123  |

Join code for demo class: **DEMOCLS**

## Project structure

```
qlass/
├── prisma/          # Schema & seed
├── src/app/         # App Router pages & API routes
├── src/components/  # UI & layout
├── src/lib/         # Auth, DB, storage, permissions
├── emails/          # React Email templates (extend)
└── public/
```

## API overview

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Register with email |
| GET/POST | `/api/classes` | List / create classes |
| POST | `/api/classes/join` | Join by code |
| GET/POST | `/api/classes/:id/stream` | Feed |
| POST | `/api/assignments` | Create assignment |
| POST | `/api/assignments/:id/submit` | Student turn-in |
| PATCH | `/api/grades/:submissionId` | Grade submission |

All protected routes require a valid NextAuth session.

## Deployment

### Docker Compose (full stack)

```bash
docker compose --profile full up -d
```

### Vercel + Supabase

1. Deploy Postgres on [Supabase](https://supabase.com)
2. Set `DATABASE_URL`, `NEXTAUTH_*`, and `STORAGE_PROVIDER=supabase`
3. Deploy to Vercel with the Next.js preset

### Railway / Render / Fly.io

Use the included `Dockerfile` or the Node buildpack with `npm run build` and `npm start`.

## Environment variables

See [.env.example](.env.example) for the full list.

## Stretch goals

See the project roadmap: gradebook CSV export, guardian portal, LTI 1.3, Google Classroom import, AI rubrics.

## Contributing

Contributions welcome. Please open an issue before large changes.

---

Built with care for classrooms everywhere. **Qlass** — quality class, open source.
