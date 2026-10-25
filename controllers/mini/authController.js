const jwt = require('jsonwebtoken');
const MiniUser = require('../../models/mini/MiniUser');
const MiniProduct = require('../../models/mini/MiniProduct');

// Generate next Mini ID (e.g., BM26001, BM26002, ...)
const getNextMiniId = async () => {
  const currentYear = new Date().getFullYear().toString().slice(-2); // Get last 2 digits of year
  const prefix = `BM${currentYear}`;

  // Find all mini IDs with current year prefix
  const lastUser = await MiniUser.findOne({
    miniId: new RegExp(`^${prefix}`),
  })
    .sort({ miniId: -1 })
    .select('miniId');

  if (!lastUser) {
    return `${prefix}001`;
  }

  const lastNumber = parseInt(lastUser.miniId.slice(-3));
  const nextNumber = String(lastNumber + 1).padStart(3, '0');
  return `${prefix}${nextNumber}`;
};

// POST: Verify mini key
const verifyKey = async (req, res) => {
  try {
    const { miniId } = req.body;

    if (!miniId || miniId.trim() === '') {
      return res.status(400).json({ success: false, message: 'Mini ID is required' });
    }

    const miniUser = await MiniUser.findOne({ miniId: miniId.trim() });

    if (!miniUser) {
      return res.status(404).json({ success: false, message: 'Invalid Mini ID' });
    }

    if (miniUser.status !== 'published') {
      return res.status(403).json({ success: false, message: 'This Mini ID is not active' });
    }

    // Generate JWT token for mini user
    const token = jwt.sign(
      { id: miniUser._id, role: 'miniUser' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      success: true,
      message: 'Mini ID verified',
      token,
      miniUser: {
        id: miniUser._id,
        miniId: miniUser.miniId,
        name: miniUser.name,
      },
    });
  } catch (error) {
    console.error('Error verifying mini key:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// GET: Get next suggested Mini ID
const getNextId = async (req, res) => {
  try {
    const nextId = await getNextMiniId();
    res.status(200).json({ success: true, nextId });
  } catch (error) {
    console.error('Error getting next mini ID:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = {
  verifyKey,
  getNextId,
  getNextMiniId,
};
