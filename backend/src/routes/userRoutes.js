const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireAuth, requireRole } = require('../middlewares/auth');

router.get('/', requireRole('admin'), userController.getUsers);
router.get('/all-basic', requireAuth, userController.getAllBasic);
router.post('/', requireRole('admin'), userController.createUser);
router.put('/:id', requireRole('admin'), userController.updateUser);
router.delete('/:id', requireRole('admin'), userController.deleteUser);

module.exports = router;
