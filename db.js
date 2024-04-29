import pg from 'pg';
import dotenv from 'dotenv'; // If you're using dotenv for environment variables

dotenv.config(); // Load environment variables from .env file

const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT
});

export { pool };
