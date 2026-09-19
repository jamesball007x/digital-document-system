const db = require('../config/db');
const { logActivity } = require('../services/activityService');
const { validatePassword, sanitize } = require('../services/cryptoService');

exports.getUsers = async (req, res) => {
  try {
    const users = await db.query('SELECT id, username, name, email, role, roleName, department, status, avatar, createdAt, lastLogin FROM users ORDER BY createdAt DESC');
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้' });
  }
};

exports.getAllBasic = async (req, res) => {
  try {
    const users = await db.query('SELECT id, name, role, roleName, department FROM users WHERE status = "active"');
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้' });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { username, password, name, email, role, department } = req.body;

    const existing = await db.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' });
    }

    const pwErr = validatePassword(password);
    if (pwErr) return res.status(400).json({ error: pwErr });

    const roleNames = {
      admin: 'ผู้ดูแลระบบ',
      secretary: 'ธุรการ',
      user: 'ผู้ใช้งานทั่วไป',
      executive: 'ผู้บริหารระดับสูง'
    };

    const newUser = {
      id: 'u' + Date.now(),
      username: sanitize(username),
      password,
      name: sanitize(name),
      email: sanitize(email) || '',
      role: role || 'user',
      roleName: roleNames[role] || role,
      department: sanitize(department) || '',
      status: 'active',
      avatar: '',
      createdAt: new Date().toISOString()
    };

    await db.query(
      `INSERT INTO users (id, username, password, name, email, role, roleName, department, status, avatar, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newUser.id, newUser.username, newUser.password, newUser.name, newUser.email, newUser.role, newUser.roleName, newUser.department, newUser.status, newUser.avatar, newUser.createdAt]
    );

    await logActivity(req.session.user.id, req.session.user.name, 'create_user', 'สร้างผู้ใช้ใหม่', newUser.id, newUser.name, req.ip);

    const { password: _, ...safeUser } = newUser;
    res.json({ success: true, user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสร้างผู้ใช้' });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const users = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!users.length) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });

    const roleNames = {
      admin: 'ผู้ดูแลระบบ',
      secretary: 'ธุรการ',
      user: 'ผู้ใช้งานทั่วไป',
      executive: 'ผู้บริหารระดับสูง'
    };

    const updates = req.body;
    const name = updates.name ? sanitize(updates.name) : users[0].name;
    const email = updates.email ? sanitize(updates.email) : users[0].email;
    const department = updates.department ? sanitize(updates.department) : users[0].department;
    const role = updates.role || users[0].role;
    const roleName = roleNames[role] || role;
    const status = updates.status || users[0].status;
    const password = updates.password ? updates.password : users[0].password;

    await db.query(
      `UPDATE users SET name = ?, email = ?, department = ?, role = ?, roleName = ?, status = ?, password = ? WHERE id = ?`,
      [name, email, department, role, roleName, status, password, req.params.id]
    );

    await logActivity(req.session.user.id, req.session.user.name, 'update_user', 'แก้ไขข้อมูลผู้ใช้', req.params.id, name, req.ip);

    const updatedUser = { ...users[0], name, email, department, role, roleName, status };
    delete updatedUser.password;
    res.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการแก้ไขผู้ใช้' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const users = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!users.length) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });

    await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    await logActivity(req.session.user.id, req.session.user.name, 'delete_user', 'ลบผู้ใช้', users[0].id, users[0].name, req.ip);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบผู้ใช้' });
  }
};
