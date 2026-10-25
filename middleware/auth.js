const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Member = require('../models/Member');

// Protect user routes
const protectUser = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return res.status(401).json({ success: false, message: 'Not authorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'user') return res.status(401).json({ success: false, message: 'Not a user token' });
    req.user = await User.findById(decoded.id).select('-__v');
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

// Protect member routes
const protectMember = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return res.status(401).json({ success: false, message: 'Not authorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'member') return res.status(401).json({ success: false, message: 'Not a member token' });
    req.member = await Member.findById(decoded.id).select('-password -__v');
    if (!req.member) return res.status(401).json({ success: false, message: 'Member account not found' });
    if (req.member.status !== 'active' || req.member.isActive === false) {
      return res.status(403).json({ success: false, message: 'Member account is on hold' });
    }
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

// Protect admin routes
const protectAdmin = (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return res.status(401).json({ success: false, message: 'Not authorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin access required' });
    req.admin = {
      ...decoded,
      id: mongoose.Types.ObjectId.isValid(decoded.id) ? decoded.id : new mongoose.Types.ObjectId().toHexString(),
    };
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

const generateToken = (id, role) => {
  const normalizedId =
    role === 'admin' && (!id || !mongoose.Types.ObjectId.isValid(id))
      ? new mongoose.Types.ObjectId().toHexString()
      : id;

  return jwt.sign({ id: normalizedId, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '30d' });
};

module.exports = { protectUser, protectMember, protectAdmin, generateToken };
