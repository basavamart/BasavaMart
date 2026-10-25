const express = require('express');
const router = express.Router();

// Auth routes
const { verifyKey, getNextId } = require('../controllers/mini/authController');
const { protectAdmin } = require('../middleware/auth');
const { protectMiniUser } = require('../middleware/miniAuth');

// Public auth endpoint
router.post('/auth/verify-key', verifyKey);
router.get('/auth/next-id', protectAdmin, getNextId);

// ========== ADMIN ROUTES ==========

// Mini Users
const {
  getAllMiniUsers,
  createMiniUser,
  updateMiniUser,
  deleteMiniUser,
  updateMiniUserStatus,
} = require('../controllers/mini/userController');

router.get('/admin/users', protectAdmin, getAllMiniUsers);
router.post('/admin/users', protectAdmin, createMiniUser);
router.put('/admin/users/:id', protectAdmin, updateMiniUser);
router.delete('/admin/users/:id', protectAdmin, deleteMiniUser);
router.patch('/admin/users/:id/status', protectAdmin, updateMiniUserStatus);

// Products (sphere)
const {
  getAdminProducts,
  createProducts,
  uploadProductMedia,
  updateProduct,
  deleteProduct,
  updateProductStatus,
  getMiniUserProducts,
  getPublicProducts,
} = require('../controllers/mini/productController');
const { miniProductUpload } = require('../middleware/miniUpload');

router.get('/admin/products', protectAdmin, getAdminProducts);
router.post('/admin/products', protectAdmin, createProducts);
router.post('/admin/products/:id/media', protectAdmin, miniProductUpload.fields([
  { name: 'media', maxCount: 5 },
  { name: 'catalogs', maxCount: 3 },
]), uploadProductMedia);
router.put('/admin/products/:id', protectAdmin, updateProduct);
router.delete('/admin/products/:id', protectAdmin, deleteProduct);
router.patch('/admin/products/:id/status', protectAdmin, updateProductStatus);

// Public products
router.get('/admin/public-products', protectAdmin, getPublicProducts);
router.post('/admin/public-products', protectAdmin, createProducts);
router.put('/admin/public-products/:id', protectAdmin, updateProduct);
router.delete('/admin/public-products/:id', protectAdmin, deleteProduct);
router.patch('/admin/public-products/:id/status', protectAdmin, updateProductStatus);

// Tracking
const { getTrackingDashboard, addAdminNote } = require('../controllers/mini/trackingController');

router.get('/admin/tracking/:userId', protectAdmin, getTrackingDashboard);
router.post('/admin/tracking/:userId/notes/:orderId', protectAdmin, addAdminNote);

// Requests inbox
const {
  submitRequests,
  getAllRequests,
  updateRequestStatus,
  createRequestVendorForm,
} = require('../controllers/mini/requestController');
const { miniRequestUpload } = require('../middleware/miniUpload');

router.get('/admin/requests', protectAdmin, getAllRequests);
router.patch('/admin/requests/:id/status', protectAdmin, updateRequestStatus);
router.post('/admin/requests/:id/vendor-form', protectAdmin, createRequestVendorForm);

// ========== MINI USER ROUTES (PROTECTED) ==========

// Products
router.get('/products', protectMiniUser, getMiniUserProducts);
router.get('/products/public', getPublicProducts); // No auth - public endpoint

// Cart
const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
} = require('../controllers/mini/cartController');

router.get('/cart', protectMiniUser, getCart);
router.post('/cart', protectMiniUser, addToCart);
router.put('/cart', protectMiniUser, updateCartItem);
router.delete('/cart', protectMiniUser, removeFromCart);
router.delete('/cart/clear', protectMiniUser, clearCart);

// Wishlist
const {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
} = require('../controllers/mini/wishlistController');

router.get('/wishlist', protectMiniUser, getWishlist);
router.post('/wishlist', protectMiniUser, addToWishlist);
router.delete('/wishlist', protectMiniUser, removeFromWishlist);

// Orders
const {
  getUserOrders,
  createOrder,
  getOrder,
  addOrderNote,
} = require('../controllers/mini/orderController');

router.get('/orders', protectMiniUser, getUserOrders);
router.post('/orders', protectMiniUser, createOrder);
router.get('/orders/:orderId', protectMiniUser, getOrder);
router.post('/orders/:orderId/notes', protectMiniUser, addOrderNote);

// Payment
const {
  createRazorpayOrder,
  verifyPayment,
} = require('../controllers/mini/paymentController');

router.post('/orders/:orderId/create-razorpay-order', protectMiniUser, createRazorpayOrder);
router.post('/orders/:orderId/verify-payment', protectMiniUser, verifyPayment);

// ========== PUBLIC ROUTES ==========

// Request Sphere (public)
router.post('/requests', miniRequestUpload.any(), submitRequests);

module.exports = router;
