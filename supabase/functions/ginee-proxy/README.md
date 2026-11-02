# Ginee API Proxy - Supabase Edge Function

Edge Function ini berfungsi sebagai backend proxy untuk memanggil Ginee Open API dari browser, mengatasi CORS restriction dan mengamankan kredensial API.

## Cara Deploy ke Supabase

1. Pastikan Supabase CLI sudah terpasang.
2. Login ke akun Supabase:
   ```bash
   npx supabase login
   ```
3. Link ke project Supabase Anda:
   ```bash
   npx supabase link --project-ref <PROJECT_REF>
   ```
4. Deploy function:
   ```bash
   npx supabase functions deploy ginee-proxy --no-verify-jwt
   ```
5. (Opsional) Simpan secret di Supabase Secrets agar tidak perlu dikirim dari client:
   ```bash
   npx supabase secrets set GINEE_APP_KEY=your_app_key GINEE_APP_SECRET=your_app_secret
   ```
