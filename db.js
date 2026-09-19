require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

let pool = null;

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'docms_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
};

async function getPool() {
  if (!pool) {
    await initDB();
  }
  return pool;
}

async function query(sql, params = []) {
  const p = await getPool();
  const [rows] = await p.query(sql, params);
  return rows;
}

async function execute(sql, params = []) {
  const p = await getPool();
  const [result] = await p.execute(sql, params);
  return result;
}

async function initDB() {
  try {
    // 1. Connect without database first to ensure DB exists
    const rootConn = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      charset: 'utf8mb4'
    });

    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await rootConn.end();

    // 2. Create Pool with Database
    pool = mysql.createPool(dbConfig);

    // 3. Create Tables with Comments
    await createTables();

    // 4. Update column comments on existing tables
    await applyColumnComments();

    // 5. Migrate initial data from JSON if tables are empty
    await migrateDataFromJSON();

    console.log(`[Database] Connected to MySQL (${dbConfig.database}) successfully.`);
    return pool;
  } catch (error) {
    console.error('[Database Error] Failed to initialize MySQL:', error.message);
    throw error;
  }
}

async function createTables() {
  // Users Table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(50) PRIMARY KEY COMMENT 'รหัสประจำตัวผู้ใช้',
      username VARCHAR(100) UNIQUE NOT NULL COMMENT 'ชื่อผู้ใช้สำหรับเข้าสู่ระบบ',
      password VARCHAR(255) NOT NULL COMMENT 'รหัสผ่านเข้าสู่ระบบ',
      name VARCHAR(255) NOT NULL COMMENT 'ชื่อ-นามสกุลจริง',
      email VARCHAR(255) COMMENT 'อีเมลผู้ใช้งาน',
      role VARCHAR(50) NOT NULL COMMENT 'รหัสบทบาท (admin, secretary, executive, user)',
      roleName VARCHAR(100) COMMENT 'ชื่อภาษาไทยของบทบาท',
      department VARCHAR(100) COMMENT 'แผนกหรือฝ่ายงานที่สังกัด',
      position VARCHAR(100) COMMENT 'ตำแหน่งทางการบริหาร/งาน',
      phone VARCHAR(50) COMMENT 'เบอร์โทรศัพท์ติดต่อ',
      status VARCHAR(50) DEFAULT 'active' COMMENT 'สถานะบัญชี (active = ใช้งานได้, suspended = ถูกระงับ)',
      avatar LONGTEXT COMMENT 'รูปภาพโปรไฟล์',
      failedAttempts INT DEFAULT 0 COMMENT 'จำนวนครั้งที่ใส่รหัสผ่านผิดติดต่อกัน',
      lockedUntil VARCHAR(50) NULL COMMENT 'เวลาที่บัญชีจะปลดล็อกอัตโนมัติ',
      pinHash VARCHAR(255) NULL COMMENT 'รหัสแฮช PIN ยืนยันตัวตน MFA (PBKDF2)',
      pinSalt VARCHAR(255) NULL COMMENT 'ค่า Salt สำหรับแฮช PIN',
      createdAt VARCHAR(50) COMMENT 'วันเวลาที่สร้างบัญชี',
      lastLogin VARCHAR(50) NULL COMMENT 'วันเวลาเข้าสู่ระบบล่าสุด'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตารางข้อมูลผู้ใช้งานและสิทธิ์การเข้าถึง';
  `);

  // Documents Table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id VARCHAR(50) PRIMARY KEY COMMENT 'รหัสเอกสาร',
      title VARCHAR(255) NOT NULL COMMENT 'หัวข้อหรือชื่อเรื่องของเอกสาร',
      description TEXT COMMENT 'รายละเอียดเนื้อหาของเอกสารโดยย่อ',
      category VARCHAR(100) COMMENT 'หมวดหมู่เอกสาร (บันทึกข้อความ, สัญญา, รายงาน, คำสั่ง)',
      fileName VARCHAR(255) COMMENT 'ชื่อไฟล์ต้นฉบับที่อัปโหลด',
      fileStorageName VARCHAR(255) COMMENT 'ชื่อไฟล์ที่บันทึกจริงในโฟลเดอร์ uploads',
      fileSize BIGINT DEFAULT 0 COMMENT 'ขนาดไฟล์เอกสาร (หน่วยเป็นไบต์)',
      uploadedBy VARCHAR(50) COMMENT 'รหัสผู้ใช้ที่เป็นผู้อัปโหลดเอกสาร',
      uploadedByName VARCHAR(255) COMMENT 'ชื่อ-นามสกุลของผู้อัปโหลด',
      assignedTo LONGTEXT COMMENT 'รายชื่อผู้ใช้ที่ได้รับมอบหมาย (JSON Array)',
      status VARCHAR(50) DEFAULT 'draft' COMMENT 'รหัสสถานะเอกสาร (draft, pending_approval, approved, signed, rejected, expired)',
      statusText VARCHAR(100) COMMENT 'ชื่อภาษาไทยของสถานะเอกสาร',
      priority VARCHAR(50) DEFAULT 'medium' COMMENT 'ระดับความสำคัญ (low, medium, high, urgent)',
      version INT DEFAULT 1 COMMENT 'หมายเลขเวอร์ชันปัจจุบันของเอกสาร',
      versionHistory LONGTEXT COMMENT 'ประวัติไฟล์ทุกเวอร์ชันที่เคยอัปโหลดแก้ไข (JSON Array)',
      signatures LONGTEXT COMMENT 'ประวัติลายเซ็นที่ประทับลงในเอกสาร (JSON Array)',
      comments LONGTEXT COMMENT 'ข้อคิดเห็นและบันทึกแนบท้ายเอกสาร (JSON Array)',
      approvalWorkflow LONGTEXT COMMENT 'เส้นทางการอนุมัติ (JSON Array)',
      createdAt VARCHAR(50) COMMENT 'วันเวลาที่สร้างเอกสาร',
      updatedAt VARCHAR(50) COMMENT 'วันเวลาที่มีการแก้ไขเอกสารล่าสุด',
      deadline VARCHAR(50) NULL COMMENT 'กำหนดเวลาสิ้นสุดการดำเนินงาน (Deadline)',
      expiryDate VARCHAR(50) NULL COMMENT 'วันหมดอายุของเอกสาร (Expiry Date)',
      rejectReason TEXT NULL COMMENT 'เหตุผลที่ปฏิเสธเอกสาร'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตารางข้อมูลเอกสารดิจิทัลและการลงนาม';
  `);

  // Signatures Table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS signatures (
      id VARCHAR(50) PRIMARY KEY COMMENT 'รหัสลายเซ็น',
      userId VARCHAR(50) NOT NULL COMMENT 'รหัสผู้ใช้เจ้าของลายเซ็น',
      signatureType VARCHAR(50) COMMENT 'รูปแบบลายเซ็น (draw = วาด, image = รูปภาพ, type = พิมพ์)',
      signatureData LONGTEXT COMMENT 'ข้อมูลรูปภาพลายเซ็น (Base64 Data URI)',
      iv VARCHAR(100) NULL COMMENT 'เวกเตอร์เริ่มต้นสำหรับการเข้ารหัส AES-256 GCM',
      tag VARCHAR(100) NULL COMMENT 'Authentication Tag ตรวจสอบความถูกต้องของการถอดรหัส',
      createdAt VARCHAR(50) COMMENT 'วันเวลาที่บันทึกลายเซ็น',
      updatedAt VARCHAR(50) COMMENT 'วันเวลาที่แก้ไขลายเซ็นล่าสุด'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตารางลายมือชื่ออิเล็กทรอนิกส์ส่วนบุคคล';
  `);

  // Certificates Table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS certificates (
      id VARCHAR(50) PRIMARY KEY COMMENT 'รหัสใบรับรอง',
      userId VARCHAR(50) NOT NULL COMMENT 'รหัสผู้ใช้ผู้ถือครองใบรับรอง',
      userName VARCHAR(255) NOT NULL COMMENT 'ชื่อผู้ถือครองใบรับรอง',
      certSerial VARCHAR(100) UNIQUE NOT NULL COMMENT 'หมายเลขซีเรียลของใบรับรอง (Serial Number)',
      issuedBy VARCHAR(255) NOT NULL COMMENT 'ผู้ออกใบรับรอง (Issuer)',
      issuedDate VARCHAR(50) NOT NULL COMMENT 'วันที่ออกใบรับรอง (YYYY-MM-DD)',
      expiredDate VARCHAR(50) NOT NULL COMMENT 'วันหมดอายุของใบรับรอง (YYYY-MM-DD)',
      certStatus VARCHAR(50) DEFAULT 'active' COMMENT 'สถานะใบรับรอง (active, revoked, expired)',
      publicKey TEXT COMMENT 'กุญแจสาธารณะ (Public Key)',
      createdAt VARCHAR(50) COMMENT 'วันเวลาที่สร้างข้อมูลใบรับรอง'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตารางใบรับรองดิจิทัล (CA Certificates)';
  `);

  // Notifications Table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id VARCHAR(50) PRIMARY KEY COMMENT 'รหัสการแจ้งเตือน',
      userId VARCHAR(50) NOT NULL COMMENT 'รหัสผู้รับการแจ้งเตือน',
      type VARCHAR(50) COMMENT 'ประเภทการแจ้งเตือน (status_change, access_request, ฯลฯ)',
      title VARCHAR(255) COMMENT 'หัวข้อการแจ้งเตือน',
      message TEXT COMMENT 'ข้อความรายละเอียดการแจ้งเตือน',
      documentId VARCHAR(50) NULL COMMENT 'รหัสเอกสารที่เกี่ยวข้อง',
      isRead TINYINT(1) DEFAULT 0 COMMENT 'สถานะการเปิดอ่าน (0 = ยังไม่อ่าน, 1 = อ่านแล้ว)',
      createdAt VARCHAR(50) COMMENT 'วันเวลาที่ส่งการแจ้งเตือน'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตารางการแจ้งเตือนผู้ใช้งาน';
  `);

  // Access Requests Table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS access_requests (
      id VARCHAR(50) PRIMARY KEY COMMENT 'รหัสคำร้องขอสิทธิ์',
      userId VARCHAR(50) NOT NULL COMMENT 'รหัสผู้ยื่นคำร้อง',
      userName VARCHAR(255) NOT NULL COMMENT 'ชื่อผู้ยื่นคำร้อง',
      documentId VARCHAR(50) NOT NULL COMMENT 'รหัสเอกสารที่ขอเข้าถึง',
      documentTitle VARCHAR(255) COMMENT 'ชื่อเอกสารที่ขอเข้าถึง',
      reason TEXT COMMENT 'เหตุผลความจำเป็นในการขอเข้าถึง',
      status VARCHAR(50) DEFAULT 'pending' COMMENT 'สถานะคำร้อง (pending = รอดำเนินการ, approved = อนุมัติ, rejected = ปฏิเสธ)',
      statusText VARCHAR(100) COMMENT 'ชื่อภาษาไทยของสถานะคำร้อง',
      createdAt VARCHAR(50) COMMENT 'วันเวลาที่ยื่นคำร้อง',
      reviewedBy VARCHAR(50) NULL COMMENT 'รหัสผู้พิจารณาคำร้อง',
      reviewedByName VARCHAR(255) NULL COMMENT 'ชื่อผู้พิจารณาคำร้อง',
      reviewedAt VARCHAR(50) NULL COMMENT 'วันเวลาที่พิจารณาคำร้อง'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตารางคำร้องขอสิทธิ์เข้าถึงเอกสาร';
  `);

  // Document Access Table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS document_access (
      id VARCHAR(50) PRIMARY KEY COMMENT 'รหัสรายการสิทธิ์',
      docId VARCHAR(50) NOT NULL COMMENT 'รหัสเอกสาร',
      docTitle VARCHAR(255) COMMENT 'ชื่อเอกสาร',
      roleId VARCHAR(50) NULL COMMENT 'รหัสบทบาทที่ได้รับสิทธิ์',
      userId VARCHAR(50) NULL COMMENT 'รหัสผู้ใช้ที่ได้รับสิทธิ์เฉพาะบุคคล',
      userName VARCHAR(255) COMMENT 'ชื่อผู้ใช้ที่ได้รับสิทธิ์',
      canView TINYINT(1) DEFAULT 1 COMMENT 'สิทธิ์ดูเอกสาร (1 = ได้, 0 = ไม่ได้)',
      canDownload TINYINT(1) DEFAULT 1 COMMENT 'สิทธิ์ดาวน์โหลดไฟล์ (1 = ได้, 0 = ไม่ได้)',
      canEdit TINYINT(1) DEFAULT 0 COMMENT 'สิทธิ์แก้ไขเอกสาร (1 = ได้, 0 = ไม่ได้)',
      canSign TINYINT(1) DEFAULT 0 COMMENT 'สิทธิ์ลงนามเอกสาร (1 = ได้, 0 = ไม่ได้)',
      createdAt VARCHAR(50) COMMENT 'วันเวลาที่ให้สิทธิ์'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตารางสิทธิ์การเข้าถึงเอกสารเฉพาะบุคคล';
  `);

  // Activity Logs Table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id VARCHAR(50) PRIMARY KEY COMMENT 'รหัสบันทึกกิจกรรม',
      userId VARCHAR(50) COMMENT 'รหัสผู้ใช้ที่ทำกิจกรรม',
      userName VARCHAR(255) COMMENT 'ชื่อผู้ทำกิจกรรม',
      action VARCHAR(100) COMMENT 'รหัสกิจกรรมที่ทำ (login, upload, sign, approve, ฯลฯ)',
      actionText VARCHAR(255) COMMENT 'คำอธิบายกิจกรรมภาษาไทย',
      target VARCHAR(100) COMMENT 'รหัสเป้าหมายที่ถูกกระทำ',
      targetName VARCHAR(255) COMMENT 'ชื่อเป้าหมายที่ถูกกระทำ',
      timestamp VARCHAR(50) COMMENT 'วันเวลาที่ทำกิจกรรม (ISO 8601)',
      ip VARCHAR(100) COMMENT 'หมายเลข IP Address ของผู้ใช้'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตารางบันทึกประวัติการใช้งานระบบ (Audit Logs)';
  `);
}

async function applyColumnComments() {
  try {
    const alterQueries = [
      // Users
      "ALTER TABLE users COMMENT = 'ตารางข้อมูลผู้ใช้งานและสิทธิ์การเข้าถึง'",
      "ALTER TABLE users MODIFY id VARCHAR(50) COMMENT 'รหัสประจำตัวผู้ใช้'",
      "ALTER TABLE users MODIFY username VARCHAR(100) NOT NULL COMMENT 'ชื่อผู้ใช้สำหรับเข้าสู่ระบบ'",
      "ALTER TABLE users MODIFY password VARCHAR(255) NOT NULL COMMENT 'รหัสผ่านเข้าสู่ระบบ'",
      "ALTER TABLE users MODIFY name VARCHAR(255) NOT NULL COMMENT 'ชื่อ-นามสกุลจริง'",
      "ALTER TABLE users MODIFY email VARCHAR(255) COMMENT 'อีเมลผู้ใช้งาน'",
      "ALTER TABLE users MODIFY role VARCHAR(50) NOT NULL COMMENT 'รหัสบทบาท (admin, secretary, executive, user)'",
      "ALTER TABLE users MODIFY roleName VARCHAR(100) COMMENT 'ชื่อภาษาไทยของบทบาท'",
      "ALTER TABLE users MODIFY department VARCHAR(100) COMMENT 'แผนกหรือฝ่ายงานที่สังกัด'",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS position VARCHAR(100) COMMENT 'ตำแหน่งทางการบริหาร/งาน'",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50) COMMENT 'เบอร์โทรศัพท์ติดต่อ'",
      "ALTER TABLE users MODIFY status VARCHAR(50) DEFAULT 'active' COMMENT 'สถานะบัญชี (active = ใช้งานได้, suspended = ถูกระงับ)'",
      "ALTER TABLE users MODIFY avatar LONGTEXT COMMENT 'รูปภาพโปรไฟล์'",
      "ALTER TABLE users MODIFY failedAttempts INT DEFAULT 0 COMMENT 'จำนวนครั้งที่ใส่รหัสผ่านผิดติดต่อกัน'",
      "ALTER TABLE users MODIFY lockedUntil VARCHAR(50) NULL COMMENT 'เวลาที่บัญชีจะปลดล็อกอัตโนมัติ'",
      "ALTER TABLE users MODIFY pinHash VARCHAR(255) NULL COMMENT 'รหัสแฮช PIN ยืนยันตัวตน MFA (PBKDF2)'",
      "ALTER TABLE users MODIFY pinSalt VARCHAR(255) NULL COMMENT 'ค่า Salt สำหรับแฮช PIN'",
      "ALTER TABLE users MODIFY createdAt VARCHAR(50) COMMENT 'วันเวลาที่สร้างบัญชี'",
      "ALTER TABLE users MODIFY lastLogin VARCHAR(50) NULL COMMENT 'วันเวลาเข้าสู่ระบบล่าสุด'",

      // Documents
      "ALTER TABLE documents COMMENT = 'ตารางข้อมูลเอกสารดิจิทัลและการลงนาม'",
      "ALTER TABLE documents MODIFY id VARCHAR(50) COMMENT 'รหัสเอกสาร'",
      "ALTER TABLE documents MODIFY title VARCHAR(255) NOT NULL COMMENT 'หัวข้อหรือชื่อเรื่องของเอกสาร'",
      "ALTER TABLE documents MODIFY description TEXT COMMENT 'รายละเอียดเนื้อหาของเอกสารโดยย่อ'",
      "ALTER TABLE documents MODIFY category VARCHAR(100) COMMENT 'หมวดหมู่เอกสาร (บันทึกข้อความ, สัญญา, รายงาน, คำสั่ง)'",
      "ALTER TABLE documents MODIFY fileName VARCHAR(255) COMMENT 'ชื่อไฟล์ต้นฉบับที่อัปโหลด'",
      "ALTER TABLE documents MODIFY fileStorageName VARCHAR(255) COMMENT 'ชื่อไฟล์ที่บันทึกจริงในโฟลเดอร์ uploads'",
      "ALTER TABLE documents MODIFY fileSize BIGINT DEFAULT 0 COMMENT 'ขนาดไฟล์เอกสาร (หน่วยเป็นไบต์)'",
      "ALTER TABLE documents MODIFY uploadedBy VARCHAR(50) COMMENT 'รหัสผู้ใช้ที่เป็นผู้อัปโหลดเอกสาร'",
      "ALTER TABLE documents MODIFY uploadedByName VARCHAR(255) COMMENT 'ชื่อ-นามสกุลของผู้อัปโหลด'",
      "ALTER TABLE documents MODIFY assignedTo LONGTEXT COMMENT 'รายชื่อผู้ใช้ที่ได้รับมอบหมาย (JSON Array)'",
      "ALTER TABLE documents MODIFY status VARCHAR(50) DEFAULT 'draft' COMMENT 'รหัสสถานะเอกสาร (draft, pending_approval, approved, signed, rejected, expired)'",
      "ALTER TABLE documents MODIFY statusText VARCHAR(100) COMMENT 'ชื่อภาษาไทยของสถานะเอกสาร'",
      "ALTER TABLE documents MODIFY priority VARCHAR(50) DEFAULT 'medium' COMMENT 'ระดับความสำคัญ (low, medium, high, urgent)'",
      "ALTER TABLE documents MODIFY version INT DEFAULT 1 COMMENT 'หมายเลขเวอร์ชันปัจจุบันของเอกสาร'",
      "ALTER TABLE documents MODIFY versionHistory LONGTEXT COMMENT 'ประวัติไฟล์ทุกเวอร์ชันที่เคยอัปโหลดแก้ไข (JSON Array)'",
      "ALTER TABLE documents MODIFY signatures LONGTEXT COMMENT 'ประวัติลายเซ็นที่ประทับลงในเอกสาร (JSON Array)'",
      "ALTER TABLE documents MODIFY comments LONGTEXT COMMENT 'ข้อคิดเห็นและบันทึกแนบท้ายเอกสาร (JSON Array)'",
      "ALTER TABLE documents ADD COLUMN IF NOT EXISTS approvalWorkflow LONGTEXT COMMENT 'เส้นทางการอนุมัติ (JSON Array)'",
      "ALTER TABLE documents MODIFY approvalWorkflow LONGTEXT COMMENT 'เส้นทางการอนุมัติ (JSON Array)'",
      "ALTER TABLE documents MODIFY createdAt VARCHAR(50) COMMENT 'วันเวลาที่สร้างเอกสาร'",
      "ALTER TABLE documents MODIFY updatedAt VARCHAR(50) COMMENT 'วันเวลาที่มีการแก้ไขเอกสารล่าสุด'",
      "ALTER TABLE documents MODIFY deadline VARCHAR(50) NULL COMMENT 'กำหนดเวลาสิ้นสุดการดำเนินงาน (Deadline)'",
      "ALTER TABLE documents MODIFY expiryDate VARCHAR(50) NULL COMMENT 'วันหมดอายุของเอกสาร (Expiry Date)'",
      "ALTER TABLE documents MODIFY rejectReason TEXT NULL COMMENT 'เหตุผลที่ปฏิเสธเอกสาร'",

      // Signatures
      "ALTER TABLE signatures COMMENT = 'ตารางลายมือชื่ออิเล็กทรอนิกส์ส่วนบุคคล'",
      "ALTER TABLE signatures MODIFY id VARCHAR(50) COMMENT 'รหัสลายเซ็น'",
      "ALTER TABLE signatures MODIFY userId VARCHAR(50) NOT NULL COMMENT 'รหัสผู้ใช้เจ้าของลายเซ็น'",
      "ALTER TABLE signatures MODIFY signatureType VARCHAR(50) COMMENT 'รูปแบบลายเซ็น (draw = วาด, image = รูปภาพ, type = พิมพ์)'",
      "ALTER TABLE signatures MODIFY signatureData LONGTEXT COMMENT 'ข้อมูลรูปภาพลายเซ็น (Base64 Data URI)'",
      "ALTER TABLE signatures MODIFY iv VARCHAR(100) NULL COMMENT 'เวกเตอร์เริ่มต้นสำหรับการเข้ารหัส AES-256 GCM'",
      "ALTER TABLE signatures MODIFY tag VARCHAR(100) NULL COMMENT 'Authentication Tag ตรวจสอบความถูกต้องของการถอดรหัส'",
      "ALTER TABLE signatures MODIFY createdAt VARCHAR(50) COMMENT 'วันเวลาที่บันทึกลายเซ็น'",
      "ALTER TABLE signatures MODIFY updatedAt VARCHAR(50) COMMENT 'วันเวลาที่แก้ไขลายเซ็นล่าสุด'",

      // Certificates
      "ALTER TABLE certificates COMMENT = 'ตารางใบรับรองดิจิทัล (CA Certificates)'",
      "ALTER TABLE certificates MODIFY id VARCHAR(50) COMMENT 'รหัสใบรับรอง'",
      "ALTER TABLE certificates MODIFY userId VARCHAR(50) NOT NULL COMMENT 'รหัสผู้ใช้ผู้ถือครองใบรับรอง'",
      "ALTER TABLE certificates MODIFY userName VARCHAR(255) NOT NULL COMMENT 'ชื่อผู้ถือครองใบรับรอง'",
      "ALTER TABLE certificates MODIFY certSerial VARCHAR(100) NOT NULL COMMENT 'หมายเลขซีเรียลของใบรับรอง (Serial Number)'",
      "ALTER TABLE certificates MODIFY issuedBy VARCHAR(255) NOT NULL COMMENT 'ผู้ออกใบรับรอง (Issuer)'",
      "ALTER TABLE certificates MODIFY issuedDate VARCHAR(50) NOT NULL COMMENT 'วันที่ออกใบรับรอง (YYYY-MM-DD)'",
      "ALTER TABLE certificates MODIFY expiredDate VARCHAR(50) NOT NULL COMMENT 'วันหมดอายุของใบรับรอง (YYYY-MM-DD)'",
      "ALTER TABLE certificates MODIFY certStatus VARCHAR(50) DEFAULT 'active' COMMENT 'สถานะใบรับรอง (active, revoked, expired)'",
      "ALTER TABLE certificates MODIFY publicKey TEXT COMMENT 'กุญแจสาธารณะ (Public Key)'",
      "ALTER TABLE certificates MODIFY createdAt VARCHAR(50) COMMENT 'วันเวลาที่สร้างข้อมูลใบรับรอง'",

      // Notifications
      "ALTER TABLE notifications COMMENT = 'ตารางการแจ้งเตือนผู้ใช้งาน'",
      "ALTER TABLE notifications MODIFY id VARCHAR(50) COMMENT 'รหัสการแจ้งเตือน'",
      "ALTER TABLE notifications MODIFY userId VARCHAR(50) NOT NULL COMMENT 'รหัสผู้รับการแจ้งเตือน'",
      "ALTER TABLE notifications MODIFY type VARCHAR(50) COMMENT 'ประเภทการแจ้งเตือน (status_change, access_request, ฯลฯ)'",
      "ALTER TABLE notifications MODIFY title VARCHAR(255) COMMENT 'หัวข้อการแจ้งเตือน'",
      "ALTER TABLE notifications MODIFY message TEXT COMMENT 'ข้อความรายละเอียดการแจ้งเตือน'",
      "ALTER TABLE notifications MODIFY documentId VARCHAR(50) NULL COMMENT 'รหัสเอกสารที่เกี่ยวข้อง'",
      "ALTER TABLE notifications MODIFY isRead TINYINT(1) DEFAULT 0 COMMENT 'สถานะการเปิดอ่าน (0 = ยังไม่อ่าน, 1 = อ่านแล้ว)'",
      "ALTER TABLE notifications MODIFY createdAt VARCHAR(50) COMMENT 'วันเวลาที่ส่งการแจ้งเตือน'",

      // Access Requests
      "ALTER TABLE access_requests COMMENT = 'ตารางคำร้องขอสิทธิ์เข้าถึงเอกสาร'",
      "ALTER TABLE access_requests MODIFY id VARCHAR(50) COMMENT 'รหัสคำร้องขอสิทธิ์'",
      "ALTER TABLE access_requests MODIFY userId VARCHAR(50) NOT NULL COMMENT 'รหัสผู้ยื่นคำร้อง'",
      "ALTER TABLE access_requests MODIFY userName VARCHAR(255) NOT NULL COMMENT 'ชื่อผู้ยื่นคำร้อง'",
      "ALTER TABLE access_requests MODIFY documentId VARCHAR(50) NOT NULL COMMENT 'รหัสเอกสารที่ขอเข้าถึง'",
      "ALTER TABLE access_requests MODIFY documentTitle VARCHAR(255) COMMENT 'ชื่อเอกสารที่ขอเข้าถึง'",
      "ALTER TABLE access_requests MODIFY reason TEXT COMMENT 'เหตุผลความจำเป็นในการขอเข้าถึง'",
      "ALTER TABLE access_requests MODIFY status VARCHAR(50) DEFAULT 'pending' COMMENT 'สถานะคำร้อง (pending = รอดำเนินการ, approved = อนุมัติ, rejected = ปฏิเสธ)'",
      "ALTER TABLE access_requests MODIFY statusText VARCHAR(100) COMMENT 'ชื่อภาษาไทยของสถานะคำร้อง'",
      "ALTER TABLE access_requests MODIFY createdAt VARCHAR(50) COMMENT 'วันเวลาที่ยื่นคำร้อง'",
      "ALTER TABLE access_requests MODIFY reviewedBy VARCHAR(50) NULL COMMENT 'รหัสผู้พิจารณาคำร้อง'",
      "ALTER TABLE access_requests MODIFY reviewedByName VARCHAR(255) NULL COMMENT 'ชื่อผู้พิจารณาคำร้อง'",
      "ALTER TABLE access_requests MODIFY reviewedAt VARCHAR(50) NULL COMMENT 'วันเวลาที่พิจารณาคำร้อง'",

      // Document Access
      "ALTER TABLE document_access COMMENT = 'ตารางสิทธิ์การเข้าถึงเอกสารเฉพาะบุคคล'",
      "ALTER TABLE document_access MODIFY id VARCHAR(50) COMMENT 'รหัสรายการสิทธิ์'",
      "ALTER TABLE document_access MODIFY docId VARCHAR(50) NOT NULL COMMENT 'รหัสเอกสาร'",
      "ALTER TABLE document_access MODIFY docTitle VARCHAR(255) COMMENT 'ชื่อเอกสาร'",
      "ALTER TABLE document_access MODIFY roleId VARCHAR(50) NULL COMMENT 'รหัสบทบาทที่ได้รับสิทธิ์'",
      "ALTER TABLE document_access MODIFY userId VARCHAR(50) NULL COMMENT 'รหัสผู้ใช้ที่ได้รับสิทธิ์เฉพาะบุคคล'",
      "ALTER TABLE document_access MODIFY userName VARCHAR(255) COMMENT 'ชื่อผู้ใช้ที่ได้รับสิทธิ์'",
      "ALTER TABLE document_access MODIFY canView TINYINT(1) DEFAULT 1 COMMENT 'สิทธิ์ดูเอกสาร (1 = ได้, 0 = ไม่ได้)'",
      "ALTER TABLE document_access MODIFY canDownload TINYINT(1) DEFAULT 1 COMMENT 'สิทธิ์ดาวน์โหลดไฟล์ (1 = ได้, 0 = ไม่ได้)'",
      "ALTER TABLE document_access MODIFY canEdit TINYINT(1) DEFAULT 0 COMMENT 'สิทธิ์แก้ไขเอกสาร (1 = ได้, 0 = ไม่ได้)'",
      "ALTER TABLE document_access MODIFY canSign TINYINT(1) DEFAULT 0 COMMENT 'สิทธิ์ลงนามเอกสาร (1 = ได้, 0 = ไม่ได้)'",
      "ALTER TABLE document_access MODIFY createdAt VARCHAR(50) COMMENT 'วันเวลาที่ให้สิทธิ์'",

      // Activity Logs
      "ALTER TABLE activity_logs COMMENT = 'ตารางบันทึกประวัติการใช้งานระบบ (Audit Logs)'",
      "ALTER TABLE activity_logs MODIFY id VARCHAR(50) COMMENT 'รหัสบันทึกกิจกรรม'",
      "ALTER TABLE activity_logs MODIFY userId VARCHAR(50) COMMENT 'รหัสผู้ใช้ที่ทำกิจกรรม'",
      "ALTER TABLE activity_logs MODIFY userName VARCHAR(255) COMMENT 'ชื่อผู้ทำกิจกรรม'",
      "ALTER TABLE activity_logs MODIFY action VARCHAR(100) COMMENT 'รหัสกิจกรรมที่ทำ (login, upload, sign, approve, ฯลฯ)'",
      "ALTER TABLE activity_logs MODIFY actionText VARCHAR(255) COMMENT 'คำอธิบายกิจกรรมภาษาไทย'",
      "ALTER TABLE activity_logs MODIFY target VARCHAR(100) COMMENT 'รหัสเป้าหมายที่ถูกกระทำ'",
      "ALTER TABLE activity_logs MODIFY targetName VARCHAR(255) COMMENT 'ชื่อเป้าหมายที่ถูกกระทำ'",
      "ALTER TABLE activity_logs MODIFY timestamp VARCHAR(50) COMMENT 'วันเวลาที่ทำกิจกรรม (ISO 8601)'",
      "ALTER TABLE activity_logs MODIFY ip VARCHAR(100) COMMENT 'หมายเลข IP Address ของผู้ใช้'"
    ];

    for (const q of alterQueries) {
      await pool.query(q).catch(e => console.warn('[Comment Warning]', e.message));
    }
  } catch (err) {
    console.warn('[Apply Comments Warning]', err.message);
  }
}

function readJSONFile(filename) {
  try {
    const p = path.join(__dirname, 'data', filename);
    if (!fs.existsSync(p)) return [];
    const content = fs.readFileSync(p, 'utf8').trim();
    if (!content) return [];
    return JSON.parse(content);
  } catch (err) {
    console.error(`[Data Migration Error] Failed to read ${filename}:`, err.message);
    return [];
  }
}

async function migrateDataFromJSON() {
  // 1. Migrate Users
  const [usersCount] = await pool.query('SELECT COUNT(*) as count FROM users');
  if (usersCount[0].count === 0) {
    const users = readJSONFile('users.json');
    for (const u of users) {
      await pool.query(
        `INSERT INTO users (id, username, password, name, email, role, roleName, department, status, avatar, failedAttempts, lockedUntil, pinHash, pinSalt, createdAt, lastLogin)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          u.id, u.username, u.password, u.name, u.email || '', u.role, u.roleName || '', u.department || '',
          u.status || 'active', u.avatar || '', u.failedAttempts || 0, u.lockedUntil || null,
          u.pinHash || null, u.pinSalt || null, u.createdAt || new Date().toISOString(), u.lastLogin || null
        ]
      );
    }
    if (users.length > 0) console.log(`[Data Migration] Migrated ${users.length} users from JSON.`);
  }

  // 2. Migrate Documents
  const [docsCount] = await pool.query('SELECT COUNT(*) as count FROM documents');
  if (docsCount[0].count === 0) {
    const docs = readJSONFile('documents.json');
    for (const d of docs) {
      await pool.query(
        `INSERT INTO documents (id, title, description, category, fileName, fileStorageName, fileSize, uploadedBy, uploadedByName, assignedTo, status, statusText, priority, version, versionHistory, signatures, comments, approvalWorkflow, createdAt, updatedAt, deadline, expiryDate, rejectReason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          d.id, d.title, d.description || '', d.category || 'ทั่วไป', d.fileName || '', d.fileStorageName || '',
          d.fileSize || 0, d.uploadedBy || '', d.uploadedByName || '', JSON.stringify(d.assignedTo || []),
          d.status || 'draft', d.statusText || '', d.priority || 'medium', d.version || 1,
          JSON.stringify(d.versionHistory || []), JSON.stringify(d.signatures || []), JSON.stringify(d.comments || []),
          JSON.stringify(d.approvalWorkflow || []), d.createdAt || new Date().toISOString(), d.updatedAt || new Date().toISOString(),
          d.deadline || null, d.expiryDate || null, d.rejectReason || null
        ]
      );
    }
    if (docs.length > 0) console.log(`[Data Migration] Migrated ${docs.length} documents from JSON.`);
  }

  // 3. Migrate Signatures
  const [signaturesCount] = await pool.query('SELECT COUNT(*) as count FROM signatures');
  if (signaturesCount[0].count === 0) {
    const sigs = readJSONFile('signatures.json');
    for (const s of sigs) {
      await pool.query(
        `INSERT INTO signatures (id, userId, signatureType, signatureData, iv, tag, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.id, s.userId, s.signatureType || 'draw', s.signatureData || '',
          s.iv || null, s.tag || null, s.createdAt || new Date().toISOString(), s.updatedAt || new Date().toISOString()
        ]
      );
    }
    if (sigs.length > 0) console.log(`[Data Migration] Migrated ${sigs.length} signatures from JSON.`);
  }

  // 4. Migrate Certificates
  const [certsCount] = await pool.query('SELECT COUNT(*) as count FROM certificates');
  if (certsCount[0].count === 0) {
    const certs = readJSONFile('certificates.json');
    for (const c of certs) {
      await pool.query(
        `INSERT INTO certificates (id, userId, userName, certSerial, issuedBy, issuedDate, expiredDate, certStatus, publicKey, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          c.id, c.userId, c.userName, c.certSerial, c.issuedBy, c.issuedDate,
          c.expiredDate, c.certStatus || 'active', c.publicKey || '', c.createdAt || new Date().toISOString()
        ]
      );
    }
    if (certs.length > 0) console.log(`[Data Migration] Migrated ${certs.length} certificates from JSON.`);
  }

  // 5. Migrate Notifications
  const [notifsCount] = await pool.query('SELECT COUNT(*) as count FROM notifications');
  if (notifsCount[0].count === 0) {
    const notifs = readJSONFile('notifications.json');
    for (const n of notifs) {
      await pool.query(
        `INSERT INTO notifications (id, userId, type, title, message, documentId, isRead, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          n.id, n.userId, n.type || 'status_change', n.title, n.message || '',
          n.documentId || null, n.read ? 1 : 0, n.createdAt || new Date().toISOString()
        ]
      );
    }
    if (notifs.length > 0) console.log(`[Data Migration] Migrated ${notifs.length} notifications from JSON.`);
  }

  // 6. Migrate Access Requests
  const [reqsCount] = await pool.query('SELECT COUNT(*) as count FROM access_requests');
  if (reqsCount[0].count === 0) {
    const reqs = readJSONFile('access_requests.json');
    for (const r of reqs) {
      await pool.query(
        `INSERT INTO access_requests (id, userId, userName, documentId, documentTitle, reason, status, statusText, createdAt, reviewedBy, reviewedByName, reviewedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r.id, r.userId, r.userName, r.documentId, r.documentTitle || '', r.reason || '',
          r.status || 'pending', r.statusText || 'รอดำเนินการ', r.createdAt || new Date().toISOString(),
          r.reviewedBy || null, r.reviewedByName || null, r.reviewedAt || null
        ]
      );
    }
    if (reqs.length > 0) console.log(`[Data Migration] Migrated ${reqs.length} access requests from JSON.`);
  }

  // 7. Migrate Document Access
  const [accessCount] = await pool.query('SELECT COUNT(*) as count FROM document_access');
  if (accessCount[0].count === 0) {
    const accesses = readJSONFile('document_access.json');
    for (const a of accesses) {
      await pool.query(
        `INSERT INTO document_access (id, docId, docTitle, roleId, userId, userName, canView, canDownload, canEdit, canSign, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          a.id, a.docId, a.docTitle || '', a.roleId || null, a.userId || null, a.userName || '',
          a.canView !== undefined ? (a.canView ? 1 : 0) : 1,
          a.canDownload !== undefined ? (a.canDownload ? 1 : 0) : 1,
          a.canEdit ? 1 : 0, a.canSign ? 1 : 0, a.createdAt || new Date().toISOString()
        ]
      );
    }
    if (accesses.length > 0) console.log(`[Data Migration] Migrated ${accesses.length} document access rules from JSON.`);
  }

  // 8. Migrate Activity Logs
  const [logsCount] = await pool.query('SELECT COUNT(*) as count FROM activity_logs');
  if (logsCount[0].count === 0) {
    const logs = readJSONFile('logs.json');
    for (const l of logs) {
      await pool.query(
        `INSERT INTO activity_logs (id, userId, userName, action, actionText, target, targetName, timestamp, ip)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          l.id, l.userId || '', l.userName || '', l.action || '', l.actionText || '',
          l.target || '', l.targetName || '', l.timestamp || new Date().toISOString(), l.ip || ''
        ]
      );
    }
    if (logs.length > 0) console.log(`[Data Migration] Migrated ${logs.length} activity logs from JSON.`);
  }
}

module.exports = {
  dbConfig,
  getPool,
  query,
  execute,
  initDB
};
