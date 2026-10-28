# Deploy guide (Vercel / Netlify)

Ye app **serverless** hosts par chalne ke liye ready hai. Audio files disk par
nahi rakhi ja sakti (wahan filesystem read-only hota hai), isliye uploads
**Supabase Storage** me jaate hain.

```
Browser ──▶ Next.js (Vercel/Netlify)
               ├─▶ Supabase Postgres   (catalogue: songs table)
               ├─▶ Supabase Storage    (audio files: blndfld-audio bucket)
               └─▶ Firebase Firestore  (cloud mirror of the catalogue)
```

## Serverless ke 2 rules jo code me already handle hain

Vercel functions ka body limit **4.5 MB** hai (request aur response dono).
Tumhare gaane 5-6.7 MB ke hain, isliye:

1. **Upload:** browser server ko file nahi bhejta. Admin console `/api/admin/upload-url`
   se ek **signed URL** leta hai aur file seedha Supabase me PUT karta hai.
   Server ko sirf chhota JSON milta hai (title, key, size).
2. **Playback:** `/api/songs/<id>/audio` **302 redirect** karta hai Supabase ke
   public URL par. Audio function se hoke nahi guzarta.

Netlify ka limit bhi 6 MB hai, to wahan bhi yahi flow chalega.

---

## 0. Ek baar local par (ho chuka hai)

```bash
node scripts/push-uploads.cjs   # local uploads -> Supabase Storage
npm run build && npm start
```

---

## 1. Git repo banao (ek hi baar)

```bash
git init
git add .
git commit -m "BLINDFOLD music site"
```

`.gitignore` already hai — `.env.local`, `.data/`, `node_modules`, `.next`
commit nahi honge. **Verify:** `git status` me `.env.local` nahi dikhna chahiye.

GitHub par naya repo banao, phir:

```bash
git remote add origin https://github.com/<user>/<repo>.git
git branch -M main
git push -u origin main
```

---

## 2. Vercel par deploy (recommended)

1. [vercel.com/new](https://vercel.com/new) → GitHub repo import karo.
2. Framework: **Next.js** (auto-detect). Build command / output default rakho.
3. **Environment Variables** me ye daalo:

| Key | Value |
|---|---|
| `DATABASE_URL` | Supabase **transaction pooler** URL, port `6543` |
| `ADMIN_PASSWORD` | tumhara naya admin password (repo me purana committed hai, isliye **badal do**) |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role / secret key |
| `FIREBASE_PROJECT_ID` | `todo-app-cc408` |
| `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk-fbsvc@todo-app-cc408.iam.gserviceaccount.com` |
| `FIREBASE_PRIVATE_KEY` | poora key, **ek hi line** me (`\n` literal) |
| `FIREBASE_FIRESTORE_DATABASE` | `default` |

Optional: `SUPABASE_URL`, `SUPABASE_STORAGE_BUCKET`, `STORAGE_DRIVER=supabase`.

4. **Deploy** → 1-2 minute.

### DATABASE_URL (Vercel ke liye)

Supabase → **Connect** → *Transaction pooler*:

```text
postgresql://postgres.hyavluoqzvvmqssjlygk:PASSWORD@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=no-verify
```

- Port **6543** = transaction pooler (serverless ke liye best).
- `sslmode=no-verify` chahiye kyunki pooler ka cert chain self-signed hai.
- Local par port **5432** (session pooler) chal raha hai - dono fine hain.

---

## 3. Netlify par deploy (agar chaho)

1. [app.netlify.com/start](https://app.netlify.com/start) → repo import.
2. Netlify Next.js runtime **auto-install** ho jata hai (koi config nahi).
3. Wahi 7 environment variables daalo (Site configuration → Environment variables).
4. Deploy.

> Vercel aur Netlify dono same repo se chalenge, dono same DB/Storage use karenge.
> Ek hi rakho, warna do URLs maintain karne padenge.

---

## 4. Deploy ke baad checklist

- [ ] `https://<domain>/api/health` → `{"ok":true}`
- [ ] Home page par 5 gaane dikh rahe hain
- [ ] Gaana play karo → chalta hai, seek bhi kaam karta hai
- [ ] Visualizer (bottom dock ki bars) react karta hai
- [ ] Admin (`/admin`) → password → **"Firebase cloud · Connected"**
- [ ] Admin se **6 MB ka** gaana upload karo → public list me turant dikhe
      (yahi 4.5 MB limit ka asli test hai)
- [ ] Wahi gaana incognito/mobile me chale (matlab cloud par hai)
- [ ] Test gaana delete karo → list se hate, bucket se bhi file jaaye
- [ ] Firestore console → `songs` collection update ho raha ho

---

## 5. Free tier limits

| Service | Free limit | Abhi use |
|---|---|---|
| Supabase Postgres | 500 MB DB | ~100 KB (sirf metadata) |
| Supabase Storage | 1 GB files, 5 GB egress/mo | **29.9 MB** (5 gaane) |
| Supabase Storage | 50 MB max per file | sabse bada 6.7 MB |
| Firestore | 1 GiB + 50k reads/day | few KB |
| Vercel Hobby | 100 GB bandwidth | fine |

Ek gaana ~6 MB → **1 GB me ~150 gaane**.

> Note: Vercel Hobby **non-commercial** use ke liye hai. Personal music site
> theek hai; agar kabhi paise lene lag jaao to Pro lena padega.

---

## 6. Gaana add karne ke 3 tareeke (admin console)

| Tareeka | Kya hota hai |
|---|---|
| **File drop** | Title/artist/genre file ke ID3 tags se **apne aap** bhar jaate hain, duration bhi |
| **Direct audio link** (`.mp3/.wav/.m4a/...`) | Server khud download karta hai, tags padhta hai, Supabase par upload karta hai — phir bas colour choose karo |
| **Spotify / YouTube / Apple / SoundCloud link** | Sirf title/artist auto-fill (audio DRM-protected hai, download nahi ho sakta) |

Genre ek **suggestion** hai (ID3 tag, warna title/artist ke keywords se). 100%
accurate auto-detection possible nahi hai — field editable hai.

---

## 7. Kabhi kuch tootey to

| Problem | Fix |
|---|---|
| `Audio file missing` / 404 | `node scripts/push-uploads.cjs` chalao; `SUPABASE_SERVICE_ROLE_KEY` check karo |
| Upload par `Upload failed (403)` | Supabase key galat — `service_role` (secret) honi chahiye, publishable/anon nahi |
| `looks like a publishable/anon key` | Dashboard → Settings → API Keys → **Secret keys** wali copy karo |
| `413 FUNCTION_PAYLOAD_TOO_LARGE` | Purana client cache ho sakta hai; hard refresh. Direct upload flow hona chahiye |
| `self-signed certificate in certificate chain` | `DATABASE_URL` me `?sslmode=no-verify` |
| `getaddrinfo ENOTFOUND db.<ref>.supabase.co` | Direct host IPv6-only hai → pooler URL use karo |
| Firebase `5 NOT_FOUND` | `FIREBASE_FIRESTORE_DATABASE=default` |
| Login 200 par upload 401 | localhost cookie issue — production https par theek hai |
| Gaana chal raha par visualizer dead | Bucket public hona chahiye (audio + `access-control-allow-origin: *`) |
