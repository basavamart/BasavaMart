const mongoose = require('mongoose');

const visitorPageVisitSchema = new mongoose.Schema({
  visitorId: { type: String, required: true, maxlength: 64 },
  sessionId: { type: String, required: true, maxlength: 64 },
  pageVisitId: { type: String, required: true, maxlength: 64 },
  path: { type: String, required: true, maxlength: 500 },
  pageTitle: { type: String, default: '', maxlength: 120 },
  device: { type: String, enum: ['mobile', 'tablet', 'desktop', 'unknown'], default: 'unknown' },
  browser: { type: String, enum: ['Chrome', 'Edge', 'Firefox', 'Safari', 'Opera', 'Other'], default: 'Other' },
  startedAt: { type: Date, default: Date.now, required: true },
  lastSeenAt: { type: Date, default: Date.now, required: true },
  endedAt: { type: Date, default: null },
  durationSeconds: { type: Number, default: 0, min: 0 },
}, { versionKey: false });

visitorPageVisitSchema.index({ visitorId: 1, sessionId: 1, pageVisitId: 1 }, { unique: true });
visitorPageVisitSchema.index({ startedAt: -1 });

module.exports = mongoose.model('VisitorPageVisit', visitorPageVisitSchema);
