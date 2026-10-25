const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Member = require('../models/Member');
const User = require('../models/User');
const { generateToken, protectUser, protectMember } = require('../middleware/auth');

// ============ ADMIN LOGIN ============
router.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;
  if (
    email === process.env.ADMIN_EMAIL &&
    password === process.env.ADMIN_PASSWORD
  ) {
    const token = generateToken('admin', 'admin');
    return res.json({ success: true, token, role: 'admin' });
  }
  res.status(401).json({ success: false, message: 'Invalid admin credentials' });
});

// ============ GOOGLE OAUTH ============
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.CLIENT_URL}/login?error=google_failed` }),
  async (req, res) => {
    const loginHistoryEntry = {
      loginAt: new Date(),
      ipAddress: req.ip || '',
      userAgent: req.get('User-Agent') || '',
    };

    await User.findByIdAndUpdate(req.user._id, {
      lastLoginAt: new Date(),
      lastSeenAt: new Date(),
      isOnline: true,
      $push: { loginHistory: { $each: [loginHistoryEntry], $slice: -20 } },
    });

    const token = generateToken(req.user._id, 'user');
    res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}&role=user`);
  }
);

// ============ MEMBER LOGIN ============
router.post('/member/login', async (req, res) => {
  const { memberId, password } = req.body;
  try {
    const member = await Member.findOne({ memberId });
    if (!member) return res.status(401).json({ success: false, message: 'Invalid Member ID or password' });
    if (!member.isActive) return res.status(403).json({ success: false, message: 'Account suspended' });

    const isMatch = await member.matchPassword(password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid Member ID or password' });

    const token = generateToken(member._id, 'member');
    res.json({
      success: true,
      token,
      role: 'member',
      member: {
        id: member._id,
        memberId: member.memberId,
        name: member.name,
        email: member.email,
        businessProfile: member.businessProfile,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============ GET CURRENT USER ============
router.get('/me/user', protectUser, async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    lastSeenAt: new Date(),
    isOnline: true,
  });
  res.json({ success: true, user: req.user });
});

router.get('/me/member', protectMember, (req, res) => {
  res.json({ success: true, member: req.member });
});

module.exports = router;
