import pg from 'pg';

async function testAppRole() {
  const connectionString = 'postgresql://saarlekha_app:npg_EALl9dSWJKg6@ep-royal-cherry-aoc9fp1m.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
  console.log('Testing connection as saarlekha_app...');
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log('✓ Successfully connected to PostgreSQL as saarlekha_app!');
    const res = await client.query('SELECT 1 as val');
    console.log('Query result:', res.rows);
  } catch (err) {
    console.error('✗ Connection failed:', err);
  } finally {
    await client.end();
  }
}

testAppRole();
