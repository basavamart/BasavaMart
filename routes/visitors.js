const express = require('express');
const router = express.Router();
const { trackPageVisit, getVisitorAnalytics } = require('../controllers/visitorController');
const { protectAdmin } = require('../middleware/auth');

router.post('/track', trackPageVisit);
router.get('/admin', protectAdmin, getVisitorAnalytics);

module.exports = router;
