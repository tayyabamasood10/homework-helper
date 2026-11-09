# AI Homework Helper

Type a question and/or upload or paste an image, click **Generate**, and get a step-by-step solution with rendered math. No sign-in.

```
Next.js (compress image) ──POST /api/solve──▶ Express (multer) ──▶ Gemini 2.5 Flash
                                                    └──▶ Supabase Storage + Postgres
```

## 1. Supabase (one time)

1. Create a project at <https://supabase.com>.
2. Open **SQL Editor**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it.
   This creates the `homework_history` table and the public `homework-images` bucket.
3. Copy your **Project URL** and **secret key** (Project Settings → API Keys).

## 2. Backend (port 5000)

```bash
cd backend
npm install
cp .env.example .env      # then fill in GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SECRET_KEY
npm run dev               # or: npm start
```

Get a Gemini key at <https://aistudio.google.com/apikey>. Check it works: <http://localhost:5000/api/health>.

## 3. Frontend (port 3000)

```bash
cd frontend
npm install
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:5000
npm run dev
```

Open <http://localhost:3000>.

## Notes

- **Secrets** live only in `backend/.env`. The frontend only knows the API URL.
- **Images** are compressed in the browser (≤ ~1 MB, 1600 px) and sent as `multipart/form-data` straight to Express. Server Actions are not used. Multer holds the upload in memory with a 15 MB cap.
- **Paste** a screenshot with <kbd>Ctrl/⌘ + V</kbd> anywhere in the input card. Drag-and-drop and file picking also work.
- If Supabase is misconfigured, the student still gets their solution; the save failure is only logged on the server.
- Stored images are in a **public** bucket (random file names). Switch the bucket to private and use signed URLs if that doesn't suit you.
- Deploying? Set `FRONTEND_URL` on the backend to your site's origin and `NEXT_PUBLIC_API_URL` on the frontend to the API's URL.
