/**
 * Loads .env.local and .env into process.env BEFORE any module decorator
 * evaluates. Feature flags such as ENABLE_COMPETITIONS (TEM-15) are read at
 * module-composition time; ParentModule's decorator runs while imports are
 * being hoisted, which is earlier than ConfigModule.forRoot() gets to load
 * env files, so without this preload a flag set only in a .env file would be
 * seen by AppModule but not by ParentModule (a half-enabled module).
 *
 * This file must remain the FIRST import in main.ts. dotenv never overrides
 * variables that are already set, so real environment variables (Railway)
 * always win and .env.local takes precedence over .env, matching
 * ConfigModule's envFilePath order.
 */
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();
