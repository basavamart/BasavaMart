const mongoose = require('mongoose');
const MiniUser = require('../../models/mini/MiniUser');
const { getNextMiniId } = require('./authController');

// GET: All mini users (admin only)
const getAllMiniUsers = async (req, res) => {
  try {
    const { q, status } = req.query;
    let filter = {};

    if (q) {
      filter.$or = [
        { miniId: new RegExp(q, 'i') },
        { name: new RegExp(q, 'i') },
        { phone: new RegExp(q, 'i') },
        { email: new RegExp(q, 'i') },
      ];
    }

    if (status) {
      filter.status = status;
    }

    const users = await MiniUser.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    console.error('Error fetching mini users:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// POST: Create a new mini user (admin only)
const createMiniUser = async (req, res) => {
  try {
    const { miniId: customMiniId, memberId, name, phone, email, address, note } = req.body;

    // Determine mini ID
    let miniId = customMiniId;
    if (!miniId || miniId.trim() === '') {
      miniId = await getNextMiniId();
    }

    // Check uniqueness of custom ID if provided
    const existingUser = await MiniUser.findOne({ miniId });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Mini ID already exists' });
    }

    const createdBy = req.admin?.id && mongoose.Types.ObjectId.isValid(req.admin.id)
      ? req.admin.id
      : new mongoose.Types.ObjectId().toHexString();

    const newMiniUser = await MiniUser.create({
      miniId: miniId.trim(),
      memberId: memberId || '',
      name: name || '',
      phone: phone || '',
      email: email || '',
      address: address || '',
      note: note || '',
      status: 'draft',
      createdBy,
    });

    res.status(201).json({
      success: true,
      message: 'Mini user created successfully',
      data: newMiniUser,
    });
  } catch (error) {
    console.error('Error creating mini user:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// PUT: Update a mini user (admin only)
const updateMiniUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { miniId, memberId, name, phone, email, address, note } = req.body;

    const updateData = {};
    if (miniId !== undefined) updateData.miniId = miniId;
    if (memberId !== undefined) updateData.memberId = memberId;
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (address !== undefined) updateData.address = address;
    if (note !== undefined) updateData.note = note;

    const updatedUser = await MiniUser.findByIdAndUpdate(id, updateData, { new: true });

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'Mini user not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Mini user updated successfully',
      data: updatedUser,
    });
  } catch (error) {
    console.error('Error updating mini user:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// DELETE: Delete a mini user (admin only)
const deleteMiniUser = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedUser = await MiniUser.findByIdAndDelete(id);

    if (!deletedUser) {
      return res.status(404).json({ success: false, message: 'Mini user not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Mini user deleted successfully',
      data: deletedUser,
    });
  } catch (error) {
    console.error('Error deleting mini user:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// PATCH: Update status (draft/published) (admin only)
const updateMiniUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['draft', 'published'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const updatedUser = await MiniUser.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'Mini user not found' });
    }

    res.status(200).json({
      success: true,
      message: `Mini user status updated to ${status}`,
      data: updatedUser,
    });
  } catch (error) {
    console.error('Error updating mini user status:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = {
  getAllMiniUsers,
  createMiniUser,
  updateMiniUser,
  deleteMiniUser,
  updateMiniUserStatus,
};
