// =====================================================================
//  Herbify Admin — Supabase connection
//  Supabase Dashboard → Project Settings → API:
//    • Project URL       → SUPABASE_URL
//    • anon public key   → SUPABASE_ANON_KEY
//  The anon key is safe to use in a browser. Admin access is enforced by
//  the database (Row Level Security + the "admin" role on your profile).
//  NEVER paste the service_role key here.
// =====================================================================
export const SUPABASE_URL = 'https://lwpgbezayqujjdprppii.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3cGdiZXpheXF1ampkcHJwcGlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NTkxOTEsImV4cCI6MjEwNjQzNTE5MX0.NG_qkeH6XhiUEdM9Bi-z_bhk68fugV64JjABTZJ8mP0';

// Storage bucket created by supabase/01_schema.sql
export const IMAGE_BUCKET = 'product-images';
