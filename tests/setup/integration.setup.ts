import { config } from "dotenv";
import path from "node:path";

// Integration tests talk to the real local Postgres/PostgREST stack through the
// same env the Next app uses. Load it before any test body runs (the supabase
// clients read these lazily at call time).
config({ path: path.resolve(process.cwd(), ".env.development.local") });
