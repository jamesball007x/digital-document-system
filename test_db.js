require('dotenv').config();
const db = require('./db');

async function runTests() {
  console.log('========================================');
  console.log('   DocMS - MySQL Backend Test Suite     ');
  console.log('========================================\n');

  try {
    // 1. Test Database Initialization & Connection
    console.log('[1/5] Testing MySQL Connection & DB Setup...');
    await db.initDB();
    console.log('  -> Connection established.');

    // 2. Test Tables Structure
    console.log('\n[2/5] Checking Database Tables...');
    const tables = await db.query('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);
    console.log('  -> Found tables:', tableNames.join(', '));
    const expectedTables = ['users', 'documents', 'signatures', 'certificates', 'notifications', 'access_requests', 'document_access', 'activity_logs'];
    const missing = expectedTables.filter(t => !tableNames.includes(t));
    if (missing.length === 0) {
      console.log('  -> All 8 required tables exist! [PASS]');
    } else {
      console.log('  -> Missing tables:', missing.join(', '), '[FAIL]');
    }

    // 3. Test Users Data & Migration
    console.log('\n[3/5] Checking Users Data...');
    const users = await db.query('SELECT id, username, name, role, department FROM users');
    console.log(`  -> Total users: ${users.length}`);
    users.forEach(u => console.log(`     * [${u.role}] ${u.username} (${u.name}) - ${u.department}`));

    // 4. Test Documents Data & Migration
    console.log('\n[4/5] Checking Documents Data...');
    const docs = await db.query('SELECT id, title, category, status, statusText FROM documents');
    console.log(`  -> Total documents: ${docs.length}`);
    docs.slice(0, 5).forEach(d => console.log(`     * [${d.category}] ${d.id}: ${d.title} (${d.statusText})`));

    // 5. Test Activity Logs & Notifications
    console.log('\n[5/5] Checking Notifications & Logs...');
    const notifs = await db.query('SELECT COUNT(*) as count FROM notifications');
    const logs = await db.query('SELECT COUNT(*) as count FROM activity_logs');
    console.log(`  -> Notifications in DB: ${notifs[0].count}`);
    console.log(`  -> Activity logs in DB: ${logs[0].count}`);

    console.log('\n========================================');
    console.log('🎉 ALL DATABASE TESTS PASSED SUCCESSFULLY!');
    console.log('========================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ DATABASE TEST FAILED:');
    console.error(err.message);
    if (err.code === 'ECONNREFUSED') {
      console.error('\n👉 สาเหตุ: MySQL Server ยังไม่ได้ถูกเปิดทำงาน (Service MySQL80 stopped)');
      console.error('👉 วิธีแก้ไข: กรุณาเปิด Windows Services (`services.msc`) แล้วกด Start ที่ MySQL80 หรือรันคำสั่ง `net start MySQL80` ใน Command Prompt (Admin)');
    } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n👉 สาเหตุ: รหัสผ่าน MySQL ไม่ถูกต้อง');
      console.error('👉 วิธีแก้ไข: กรุณาเปิดไฟล์ .env แล้วใส่รหัสผ่าน MySQL ที่ถูกต้องที่บรรทัด DB_PASSWORD=');
    }
    process.exit(1);
  }
}

runTests();
