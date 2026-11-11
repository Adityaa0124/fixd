import fs from 'node:fs';
import path from 'node:path';

// Load the repo root .env when running locally; CI provides env vars directly.
const envPath = path.resolve(__dirname, '../../.env');
if (!process.env.DATABASE_URL && fs.existsSync(envPath)) process.loadEnvFile(envPath);
process.env.DEMO_RESET_PER_HOUR ??= '100';
