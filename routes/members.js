const express = require('express');
const router = express.Router();
const Member = require('../models/Member');
const { MembershipApplication } = require('../models/Misc');
const User = require('../models/User');
const { protectAdmin, protectUser, protectMember } = require('../middleware/auth');
const upload = require('../config/multer');

// Helper: generate member ID
async function generateMemberId() {
  const count = await Member.countDocuments();
  return `BM${String(count + 1).padStart(3, '0')}`;
}

// Helper: generate password
function generatePassword(name, count) {
  const firstLetter = name.charAt(0).toUpperCase();
  return `BM${firstLetter}${String(count + 1).padStart(3, '0')}`;
}

// ===== USER: Apply for membership =====
router.post('/apply', protectUser, async (req, res) => {
  try {
    const { businessName, gstNumber, address, phone } = req.body;
    const existing = await MembershipApplication.findOne({ user: req.user._id, status: 'pending' });
    if (existing) return res.status(400).json({ success: false, message: 'Application already pending' });

    const application = await MembershipApplication.create({
      user: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      userPhone: req.user.phone || phone,
      businessName, gstNumber, address, phone,
    });

    await User.findByIdAndUpdate(req.user._id, { membershipStatus: 'pending' });
    res.status(201).json({ success: true, application });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== USER: Check membership status =====
router.get('/status', protectUser, async (req, res) => {
  try {
    const application = await MembershipApplication.findOne({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, application, user: { membershipStatus: req.user.membershipStatus } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== ADMIN: Get all applications =====
router.get('/admin/applications', protectAdmin, async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (search) query.$or = [{ userName: { $regex: search, $options: 'i' } }, { userEmail: { $regex: search, $options: 'i' } }];

    const applications = await MembershipApplication.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('user', 'name email avatar phone');

    const total = await MembershipApplication.countDocuments(query);
    res.json({ success: true, applications, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== ADMIN: Manage membership applications =====
router.put('/admin/applications/:applicationId', protectAdmin, async (req, res) => {
  try {
    const updates = {};
    ['userName', 'userEmail', 'userPhone', 'businessName', 'gstNumber', 'address', 'phone'].forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    const application = await MembershipApplication.findByIdAndUpdate(req.params.applicationId, updates, { new: true });
    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });
    res.json({ success: true, application });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/admin/applications/:applicationId/status', protectAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'on_hold'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid application status' });
    }
    const application = await MembershipApplication.findByIdAndUpdate(req.params.applicationId, { status }, { new: true });
    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });
    await User.findByIdAndUpdate(application.user, { membershipStatus: 'pending' });
    res.json({ success: true, application });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/admin/applications/:applicationId', protectAdmin, async (req, res) => {
  try {
    const application = await MembershipApplication.findByIdAndDelete(req.params.applicationId);
    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });
    if (['pending', 'on_hold'].includes(application.status)) {
      await User.findByIdAndUpdate(application.user, { membershipStatus: 'none' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== ADMIN: Approve membership =====
router.post('/admin/approve/:applicationId', protectAdmin, async (req, res) => {
  try {
    const application = await MembershipApplication.findById(req.params.applicationId).populate('user');
    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });

    const count = await Member.countDocuments();
    const memberId = req.body.memberId || await generateMemberId();
    const plainPassword = req.body.password || generatePassword(application.userName, count);

    // Create member account
    const member = await Member.create({
      memberId,
      password: plainPassword,
      name: application.userName,
      email: application.userEmail,
      phone: application.userPhone,
      userId: application.user._id,
      businessProfile: {
        companyName: application.businessName || '',
        gstNumber: application.gstNumber || '',
        address: application.address || '',
      },
    });

    // Update application
    await MembershipApplication.findByIdAndUpdate(req.params.applicationId, {
      status: 'approved',
      approvedMemberId: memberId,
      processedAt: new Date(),
      adminNote: req.body.adminNote || '',
    });

    // Update user status
    await User.findByIdAndUpdate(application.user._id, {
      membershipStatus: 'approved',
    });

    res.json({ success: true, member: { ...member.toObject(), plainPassword }, memberId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== ADMIN: Reject application =====
router.post('/admin/reject/:applicationId', protectAdmin, async (req, res) => {
  try {
    const application = await MembershipApplication.findByIdAndUpdate(
      req.params.applicationId,
      { status: 'rejected', adminNote: req.body.adminNote, processedAt: new Date() },
      { new: true }
    );
    await User.findByIdAndUpdate(application.user, { membershipStatus: 'rejected' });
    res.json({ success: true, application });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== ADMIN: Get all members =====
router.get('/admin/all', protectAdmin, async (req, res) => {
  try {
    const { search, status, page = 1, limit = 20, name, reference1, reference2, gstNumber, companyName } = req.query;
    const query = {};
    if (status) query.status = status;
    if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }, { memberId: { $regex: search, $options: 'i' } }];
    if (name) query.name = { $regex: name, $options: 'i' };
    if (reference1) query.reference1 = reference1;
    if (reference2) query.reference2 = reference2;
    if (gstNumber) query['businessProfile.gstNumber'] = { $regex: gstNumber, $options: 'i' };
    if (companyName) query['businessProfile.companyName'] = { $regex: companyName, $options: 'i' };
    const members = await Member.find(query).select('-password').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
    const total = await Member.countDocuments(query);
    res.json({ success: true, members, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/admin/reference-options', protectAdmin, async (req, res) => {
  try {
    const reference1Options = await Member.distinct('reference1', { reference1: { $nin: ['', null] } });
    const reference2Query = { reference2: { $nin: ['', null] } };
    if (req.query.reference1) reference2Query.reference1 = req.query.reference1;
    const reference2Options = await Member.distinct('reference2', reference2Query);
    res.json({
      success: true,
      reference1Options: reference1Options.sort(),
      reference2Options: reference2Options.sort(),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== ADMIN: Update member =====
router.put('/admin/:memberId', protectAdmin, upload.fields([
  { name: 'companyLogo', maxCount: 1 },
  { name: 'memberImage', maxCount: 1 },
]), async (req, res) => {
  try {
    const member = await Member.findById(req.params.memberId);
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });

    const { memberId, name, email, phone, address, gstNumber, reference1, reference2, companyName } = req.body;
    if (memberId !== undefined && memberId !== member.memberId) {
      const existing = await Member.findOne({ memberId, _id: { $ne: member._id } });
      if (existing) return res.status(400).json({ success: false, message: 'Member ID already exists' });
      member.memberId = memberId;
    }
    if (name !== undefined) member.name = name;
    if (email !== undefined) member.email = email;
    if (phone !== undefined) member.phone = phone;
    if (reference1 !== undefined) member.reference1 = reference1;
    if (reference2 !== undefined) member.reference2 = reference2;
    member.businessProfile = member.businessProfile || {};
    if (address !== undefined) member.businessProfile.address = address;
    if (gstNumber !== undefined) member.businessProfile.gstNumber = gstNumber;
    if (companyName !== undefined) member.businessProfile.companyName = companyName;
    if (req.files?.companyLogo) member.businessProfile.companyLogo = `/uploads/members/${req.files.companyLogo[0].filename}`;
    if (req.files?.memberImage) member.memberImage = `/uploads/members/${req.files.memberImage[0].filename}`;

    await member.save();
    res.json({ success: true, member: await Member.findById(member._id).select('-password') });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/admin/:memberId/status', protectAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid member status' });
    }
    const member = await Member.findByIdAndUpdate(
      req.params.memberId,
      { status, isActive: status === 'active' },
      { new: true }
    ).select('-password');
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });
    res.json({ success: true, member });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/admin/:memberId', protectAdmin, async (req, res) => {
  try {
    const member = await Member.findByIdAndDelete(req.params.memberId);
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });
    if (member.userId) await User.findByIdAndUpdate(member.userId, { membershipStatus: 'none' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== ADMIN: Create member directly =====
router.post('/admin/create', protectAdmin, upload.fields([
  { name: 'companyLogo', maxCount: 1 },
  { name: 'memberImage', maxCount: 1 },
]), async (req, res) => {
  try {
    const { memberId, name, email, phone, address, gstNumber, companyName, reference1, reference2, password } = req.body;

    if (!name || !phone || !memberId || !password) {
      return res.status(400).json({ success: false, message: 'Name, phone, member ID and password are required' });
    }

    const existingMember = await Member.findOne({ memberId });
    if (existingMember) {
      return res.status(400).json({ success: false, message: 'Member ID already exists' });
    }

    const member = await Member.create({
      memberId,
      password,
      name,
      email: email || '',
      phone,
      reference1: reference1 || '',
      reference2: reference2 || '',
      memberImage: req.files?.memberImage ? `/uploads/members/${req.files.memberImage[0].filename}` : '',
      isActive: true,
      status: 'active',
      businessProfile: {
        address: address || '',
        gstNumber: gstNumber || '',
        companyName: companyName || '',
        companyLogo: req.files?.companyLogo ? `/uploads/members/${req.files.companyLogo[0].filename}` : '',
      },
    });

    res.status(201).json({
      success: true,
      member: {
        ...member.toObject(),
        plainPassword: password,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== MEMBER: Update business profile =====
router.put('/profile', protectMember, upload.fields([
  { name: 'companyLogo', maxCount: 1 },
  { name: 'gstCertificate', maxCount: 1 },
  { name: 'aadhaarCard', maxCount: 1 },
]), async (req, res) => {
  try {
    const body = req.body;
    const businessProfile = {
      companyName: body.companyName,
      companyLogoText: body.companyLogoText,
      companyDescription: body.companyDescription,
      gstNumber: body.gstNumber,
      address: body.address,
    };
    if (req.files?.companyLogo) businessProfile.companyLogo = `/uploads/members/${req.files.companyLogo[0].filename}`;
    if (req.files?.gstCertificate) businessProfile.gstCertificate = `/uploads/members/${req.files.gstCertificate[0].filename}`;
    if (req.files?.aadhaarCard) businessProfile.aadhaarCard = `/uploads/members/${req.files.aadhaarCard[0].filename}`;

    const member = await Member.findByIdAndUpdate(req.member._id, { businessProfile }, { new: true }).select('-password');
    res.json({ success: true, member });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== MEMBER: Add address =====
router.post('/address', protectMember, async (req, res) => {
  try {
    const member = await Member.findByIdAndUpdate(
      req.member._id,
      { $push: { addresses: req.body } },
      { new: true }
    ).select('-password');
    res.json({ success: true, member });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
