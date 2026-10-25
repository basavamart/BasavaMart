const MiniRequest = require('../../models/mini/MiniRequest');
const { Vendor } = require('../../models/Basket');
const { v4: uuidv4 } = require('uuid');

// POST: Submit public request(s)
const submitRequests = async (req, res) => {
  try {
    let { requests } = req.body;

    if (typeof requests === 'string') {
      try {
        requests = JSON.parse(requests);
      } catch (error) {
        return res.status(400).json({ success: false, message: 'Invalid requests payload' });
      }
    }

    if (!Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({ success: false, message: 'Requests array is required' });
    }

    const createdRequests = [];

    for (let index = 0; index < requests.length; index += 1) {
      const request = requests[index];
      const { productName, note, description, qty, name, phone } = request;
      const requestFiles = (req.files || []).filter((file) => file.fieldname === `media_${index}`);

      if (requestFiles.length > 10) {
        return res.status(400).json({ success: false, message: `Request ${index + 1} can have at most 10 files` });
      }

      if (!productName || !name || !phone) {
        return res.status(400).json({
          success: false,
          message: 'productName, name, and phone are required for each request',
        });
      }

      const newRequest = await MiniRequest.create({
        productName: productName.trim(),
        note: note || '',
        description: description || '',
        qty: qty || 1,
        name: name.trim(),
        phone: phone.trim(),
        status: 'new',
        media: requestFiles.map((file) => ({
          url: `/uploads/mini/requests/${file.filename}`,
          type: file.mimetype.startsWith('image/')
            ? 'image'
            : file.mimetype.startsWith('video/')
              ? 'video'
              : 'document',
          name: file.originalname,
        })),
      });

      createdRequests.push(newRequest);
    }

    res.status(201).json({
      success: true,
      message: `${createdRequests.length} request(s) submitted successfully`,
      data: createdRequests,
    });
  } catch (error) {
    console.error('Error submitting requests:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// GET: All requests (admin only)
const getAllRequests = async (req, res) => {
  try {
    const { status, q } = req.query;
    let filter = {};

    if (status) {
      filter.status = status;
    }

    if (q) {
      filter.$or = [
        { productName: new RegExp(q, 'i') },
        { name: new RegExp(q, 'i') },
        { phone: new RegExp(q, 'i') },
      ];
    }

    const requests = await MiniRequest.find(filter).sort({ createdAt: -1 });
    const requestIds = requests.map((request) => request._id);
    const vendorSubmissions = await Vendor.find({
      miniRequest: { $in: requestIds },
      submitted: true,
    }).select('miniRequest vendorName vendorEmail vendorPhone submittedPrices submittedAt').lean();
    const vendorsByRequest = vendorSubmissions.reduce((result, vendor) => {
      const requestId = String(vendor.miniRequest);
      if (!result[requestId]) result[requestId] = [];
      result[requestId].push(vendor);
      return result;
    }, {});
    const requestData = requests.map((request) => ({
      ...request.toObject(),
      vendorSubmissions: vendorsByRequest[String(request._id)] || [],
    }));

    res.status(200).json({
      success: true,
      count: requestData.length,
      data: requestData,
    });
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// PATCH: Update request status (admin only)
const updateRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['new', 'reviewed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const updatedRequest = await MiniRequest.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updatedRequest) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    res.status(200).json({
      success: true,
      message: `Request status updated to ${status}`,
      data: updatedRequest,
    });
  } catch (error) {
    console.error('Error updating request status:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// POST: Create a vendor pricing form for a public request (admin only)
const createRequestVendorForm = async (req, res) => {
  try {
    const request = await MiniRequest.findById(req.params.id).select('productName qty description note media');
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const token = uuidv4();
    await Vendor.create({ miniRequest: request._id, formToken: token });
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const shareLink = `${clientUrl}/vendor-form/${token}`;

    res.json({ success: true, shareLink, token });
  } catch (error) {
    console.error('Error creating request vendor form:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = {
  submitRequests,
  getAllRequests,
  updateRequestStatus,
  createRequestVendorForm,
};
