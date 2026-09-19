const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'backend/.env' });
const fs = require('fs');
const path = require('path');

async function check() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'docms_db'
  });
  
  const [docs] = await conn.query(
    'SELECT id, title, fileStorageName, fileName, status, signatures FROM documents WHERE title LIKE ? OR title LIKE ?',
    ['%พาเท%', '%มานามาน%']
  );
  
  console.log('Documents found:', docs.length);
  
  for (const doc of docs) {
    console.log('---');
    console.log('ID:', doc.id);
    console.log('Title:', doc.title);
    console.log('fileStorageName:', doc.fileStorageName);
    console.log('Status:', doc.status);
    
    // Show signatures summary only
    let signaturesObj = null;
    try {
      signaturesObj = typeof doc.signatures === 'string' ? JSON.parse(doc.signatures) : doc.signatures;
      if (Array.isArray(signaturesObj)) {
        console.log('Number of signatures:', signaturesObj.length);
        signaturesObj.forEach((s, i) => {
          console.log('  Sig', i+1, '| signer:', s.signerName || s.userId, '| at:', s.signedAt || s.serverTimestamp || s.timestamp);
          console.log('    stampImage present:', !!(s.stampImage));
          console.log('    signature_data present:', !!(s.signatureData || s.signature));
          if (s.stampImage) {
            console.log('    stampImage length:', s.stampImage.length);
          }
        });
      } else {
        console.log('Signatures is not array:', typeof signaturesObj);
      }
    } catch(e) {
      console.log('Signatures parse error:', e.message);
    }
    
    // Check file on disk
    const uploadsDir = path.resolve(__dirname, 'uploads');
    const fileName = doc.fileStorageName || doc.fileName;
    if (fileName) {
      const filePath = path.join(uploadsDir, fileName);
      const exists = fs.existsSync(filePath);
      console.log('File exists:', exists, '- Size:', exists ? fs.statSync(filePath).size : 0, 'bytes');
    }
  }
  
  await conn.end();
}

check().catch(console.error);
