const jwt = require('jsonwebtoken');
const MiniUser = require('../models/mini/MiniUser');

// Protect mini user routes
const protectMiniUser = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return res.status(401).json({ success: false, message: 'Not authorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'miniUser') {
      return res.status(401).json({ success: false, message: 'Not a mini user token' });
    }
    req.miniUser = await MiniUser.findById(decoded.id).select('-__v');
    if (!req.miniUser) {
      return res.status(404).json({ success: false, message: 'Mini user not found' });
    }
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

module.exports = { protectMiniUser };
