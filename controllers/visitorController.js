const VisitorPageVisit = require('../models/VisitorPageVisit');

const MAX_HEARTBEAT_SECONDS = 30;
const VALID_EVENTS = new Set(['start', 'heartbeat', 'pause', 'resume', 'end']);

const parseClient = (userAgent = '') => {
  const ua = userAgent.toLowerCase();
  if (/bot|crawler|spider|slurp|headless|preview|facebookexternalhit|monitoring|uptime/.test(ua)) {
    return { isBot: true, device: 'unknown', browser: 'Other' };
  }

  let device = 'desktop';
  if (/ipad|tablet|playbook|silk|android(?!.*mobile)/.test(ua)) device = 'tablet';
  else if (/mobile|iphone|ipod|android/.test(ua)) device = 'mobile';

  let browser = 'Other';
  if (/edg(e|a|ios)?\//.test(ua)) browser = 'Edge';
  else if (/opr\/|opera/.test(ua)) browser = 'Opera';
  else if (/firefox|fxios/.test(ua)) browser = 'Firefox';
  else if (/chrome|crios/.test(ua)) browser = 'Chrome';
  else if (/safari/.test(ua)) browser = 'Safari';

  return { isBot: false, device, browser };
};

const getDateRange = (startDate, endDate, timezoneOffset) => {
  const offset = Number(timezoneOffset);
  if (!Number.isInteger(offset) || offset < -720 || offset > 840) {
    throw new Error('Invalid timezone offset');
  }

  const parseDate = (value, label) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new Error(`Invalid ${label} date`);
    }
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      throw new Error(`Invalid ${label} date`);
    }
    return parsed;
  };

  const range = {};
  if (startDate) {
    const start = parseDate(startDate, 'start');
    start.setUTCMinutes(start.getUTCMinutes() + offset);
    range.$gte = start;
  }
  if (endDate) {
    const end = parseDate(endDate, 'end');
    end.setUTCDate(end.getUTCDate() + 1);
    end.setUTCMinutes(end.getUTCMinutes() + offset);
    range.$lt = end;
  }
  if (range.$gte && range.$lt && range.$gte >= range.$lt) {
    throw new Error('Start date must be on or before end date');
  }
  return range;
};

const trackPageVisit = async (req, res) => {
  try {
    const { visitorId, sessionId, pageVisitId, path, pageTitle, event } = req.body;
    if (
      typeof visitorId !== 'string' || visitorId.length < 8 || visitorId.length > 64 ||
      typeof sessionId !== 'string' || sessionId.length < 8 || sessionId.length > 64 ||
      typeof pageVisitId !== 'string' || pageVisitId.length < 8 || pageVisitId.length > 64 ||
      typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') ||
      path.length > 500 || path.startsWith('/admin') ||
      typeof event !== 'string' || !VALID_EVENTS.has(event)
    ) {
      return res.status(400).json({ success: false, message: 'Invalid visitor event' });
    }

    const client = parseClient(req.get('user-agent'));
    if (client.isBot) return res.status(204).end();

    const now = new Date();
    const filter = { visitorId, sessionId, pageVisitId };

    if (event === 'start') {
      await VisitorPageVisit.updateOne(filter, {
        $setOnInsert: {
          ...filter,
          path,
          pageTitle: typeof pageTitle === 'string' ? pageTitle.slice(0, 120) : '',
          device: client.device,
          browser: client.browser,
          startedAt: now,
          lastSeenAt: now,
          durationSeconds: 0,
        },
        $set: { endedAt: null },
      }, { upsert: true, setDefaultsOnInsert: true });
      return res.status(204).end();
    }

    const visit = await VisitorPageVisit.findOne(filter).select('lastSeenAt endedAt');
    if (!visit) return res.status(404).json({ success: false, message: 'Page visit was not started' });

    if (event === 'resume') {
      await VisitorPageVisit.updateOne(
        { ...filter, lastSeenAt: visit.lastSeenAt },
        { $set: { lastSeenAt: now, endedAt: null } }
      );
      return res.status(204).end();
    }

    const elapsedSeconds = visit.endedAt
      ? 0
      : Math.min(MAX_HEARTBEAT_SECONDS, Math.max(0, Math.floor((now.getTime() - visit.lastSeenAt.getTime()) / 1000)));
    const update = {
      $set: { lastSeenAt: now },
      $inc: { durationSeconds: elapsedSeconds },
    };
    if (event === 'pause' || event === 'end') {
      update.$set.endedAt = now;
    } else {
      update.$set.endedAt = null;
    }
    await VisitorPageVisit.updateOne({ ...filter, lastSeenAt: visit.lastSeenAt }, update);
    return res.status(204).end();
  } catch (error) {
    if (error && error.code === 11000) return res.status(204).end();
    console.error('Error tracking visitor page:', error);
    return res.status(500).json({ success: false, message: 'Could not track page visit' });
  }
};

const getVisitorAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const timezoneOffset = req.query.timezoneOffset === undefined ? 0 : req.query.timezoneOffset;
    const dateRange = getDateRange(startDate, endDate, timezoneOffset);
    const match = Object.keys(dateRange).length ? { startedAt: dateRange } : {};
    const offset = Number(timezoneOffset);
    const absoluteOffset = Math.abs(offset);
    const timezone = `${offset <= 0 ? '+' : '-'}${String(Math.floor(absoluteOffset / 60)).padStart(2, '0')}:${String(absoluteOffset % 60).padStart(2, '0')}`;

    const [
      pageViews,
      visitorCounts,
      sessionCounts,
      timeTotals,
      pages,
      devices,
      browsers,
      dailyPairs,
      recentVisits,
      sessionDurations,
    ] = await Promise.all([
      VisitorPageVisit.countDocuments(match),
      VisitorPageVisit.aggregate([
        { $match: match },
        { $group: { _id: '$visitorId' } },
        { $count: 'count' },
      ]).allowDiskUse(true),
      VisitorPageVisit.aggregate([
        { $match: match },
        { $group: { _id: '$sessionId' } },
        { $count: 'count' },
      ]).allowDiskUse(true),
      VisitorPageVisit.aggregate([
        { $match: match },
        { $group: { _id: null, totalTimeSeconds: { $sum: '$durationSeconds' } } },
      ]),
      VisitorPageVisit.aggregate([
        { $match: match },
        { $group: {
          _id: { path: '$path', visitorId: '$visitorId' },
          pageTitle: { $first: '$pageTitle' },
          pageViews: { $sum: 1 },
          totalTimeSeconds: { $sum: '$durationSeconds' },
        } },
        { $group: {
          _id: '$_id.path',
          pageTitle: { $first: '$pageTitle' },
          pageViews: { $sum: '$pageViews' },
          totalTimeSeconds: { $sum: '$totalTimeSeconds' },
          uniqueVisitors: { $sum: 1 },
        } },
        { $project: {
          _id: 0,
          path: '$_id',
          pageTitle: 1,
          pageViews: 1,
          totalTimeSeconds: 1,
          uniqueVisitors: 1,
          averageTimeSeconds: { $cond: [{ $gt: ['$pageViews', 0] }, { $divide: ['$totalTimeSeconds', '$pageViews'] }, 0] },
        } },
        { $sort: { totalTimeSeconds: -1, pageViews: -1 } },
        { $limit: 25 },
      ]).allowDiskUse(true),
      VisitorPageVisit.aggregate([
        { $match: match },
        { $group: { _id: { device: '$device', visitorId: '$visitorId' }, pageViews: { $sum: 1 } } },
        { $group: { _id: '$_id.device', pageViews: { $sum: '$pageViews' }, uniqueVisitors: { $sum: 1 } } },
        { $project: { _id: 0, name: '$_id', pageViews: 1, uniqueVisitors: 1 } },
        { $sort: { uniqueVisitors: -1 } },
      ]).allowDiskUse(true),
      VisitorPageVisit.aggregate([
        { $match: match },
        { $group: { _id: { browser: '$browser', visitorId: '$visitorId' }, pageViews: { $sum: 1 } } },
        { $group: { _id: '$_id.browser', pageViews: { $sum: '$pageViews' }, uniqueVisitors: { $sum: 1 } } },
        { $project: { _id: 0, name: '$_id', pageViews: 1, uniqueVisitors: 1 } },
        { $sort: { uniqueVisitors: -1 } },
      ]).allowDiskUse(true),
      VisitorPageVisit.aggregate([
        { $match: match },
        { $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$startedAt', timezone } },
            visitorId: '$visitorId',
          },
          pageViews: { $sum: 1 },
        } },
        { $group: {
          _id: '$_id.date',
          uniqueVisitors: { $sum: 1 },
          pageViews: { $sum: '$pageViews' },
        } },
        { $sort: { _id: 1 } },
      ]).allowDiskUse(true),
      VisitorPageVisit.find(match)
        .sort({ startedAt: -1 })
        .limit(50)
        .select('visitorId path pageTitle device browser startedAt lastSeenAt durationSeconds')
        .lean(),
      VisitorPageVisit.aggregate([
        { $match: match },
        { $group: { _id: { visitorId: '$visitorId', sessionId: '$sessionId' }, seconds: { $sum: '$durationSeconds' } } },
        { $group: { _id: null, averageSeconds: { $avg: '$seconds' } } },
      ]).allowDiskUse(true),
    ]);

    res.json({
      success: true,
      data: {
        pageViews,
        totalTimeSeconds: timeTotals[0]?.totalTimeSeconds || 0,
        uniqueVisitors: visitorCounts[0]?.count || 0,
        sessions: sessionCounts[0]?.count || 0,
        averageSessionSeconds: Math.round(sessionDurations[0]?.averageSeconds || 0),
        pages,
        devices,
        browsers,
        daily: dailyPairs.map((item) => ({ date: item._id, ...item })),
        recentVisits: recentVisits.map((visit) => ({
          ...visit,
          visitorId: `${visit.visitorId.slice(0, 8)}…`,
        })),
      },
    });
  } catch (error) {
    if (error instanceof Error && (error.message.startsWith('Invalid ') || error.message.startsWith('Start date'))) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('Error loading visitor analytics:', error);
    return res.status(500).json({ success: false, message: 'Could not load visitor analytics' });
  }
};

module.exports = { trackPageVisit, getVisitorAnalytics };
