/**
 * Notification backend for B4L Lineup Planner.
 *
 * Planning logic: NotificationPlanning.gs
 * Script properties: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
 * Trigger: auto-installed on first push subscription, or run setupTriggers manually
 */

var VAPID_SUBJECT_ = 'https://palo124.github.io/fstvalsignup/';

var NOTIFICATION_PREFS_DEFAULTS_ = {
  // Matches src/domain/notifications.ts defaultNotificationPreferences
  startsSoon: true,
  dailyOpener: true,
  nowPlaying: true,
  startsSoonLeadMinutes: 15,
  dailyOpenerHour: 10,
};

var PUSH_SUBSCRIPTIONS_SHEET_ = '_push_subscriptions';
var PUSH_SENT_SHEET_ = '_push_sent';
var PUSH_PENDING_SHEET_ = '_push_pending';
var PUSH_LOG_SHEET_ = '_push_log';

function handleNotificationAction_(params) {
  try {
    return handleNotificationActionImpl_(params);
  } catch (error) {
    return { error: error && error.message ? error.message : String(error) };
  }
}

function handleNotificationActionImpl_(params) {
  var action = params.action;

  if (action === 'savePushSubscription') {
    if (params.nickname && params.endpoint && params.p256dh && params.auth) {
      return savePushSubscription_({
        nickname: params.nickname,
        subscription: {
          endpoint: params.endpoint,
          keys: { p256dh: params.p256dh, auth: params.auth },
        },
        preferences: params.preferences ? JSON.parse(params.preferences) : undefined,
      });
    }
    throw new Error('Missing nickname or subscription.');
  }

  if (action === 'removePushSubscription') {
    if (params.endpoint) return removePushSubscription_({ endpoint: params.endpoint });
    throw new Error('Missing endpoint.');
  }

  if (action === 'pendingNotifications') {
    return getPendingNotifications_(params.endpoint);
  }

  if (action === 'ackNotifications') {
    if (params.endpoint && params.ids) {
      return ackNotifications_({
        endpoint: params.endpoint,
        ids: String(params.ids).split(',').filter(Boolean),
      });
    }
    return { ok: true };
  }

  return null;
}

function savePushSubscription_(payload) {
  var body = normalizeRequestBody_(payload);
  if (!body.nickname || !body.subscription || !body.subscription.endpoint) {
    throw new Error('Missing nickname or subscription.');
  }

  ensureSheetHeaders_(
    PUSH_SUBSCRIPTIONS_SHEET_,
    ['endpoint', 'nickname', 'p256dh', 'auth', 'preferences', 'updatedAt'],
  );

  var sheet = getSheet_(PUSH_SUBSCRIPTIONS_SHEET_);
  var rows = sheet.getDataRange().getValues();
  var preferences = JSON.stringify(body.preferences || NOTIFICATION_PREFS_DEFAULTS_);
  var updatedAt = new Date().toISOString();
  var rowIndex = -1;

  for (var i = 1; i < rows.length; i += 1) {
    if (rows[i][0] === body.subscription.endpoint) {
      rowIndex = i + 1;
      break;
    }
  }

  var values = [
    body.subscription.endpoint,
    body.nickname,
    body.subscription.keys.p256dh,
    body.subscription.keys.auth,
    preferences,
    updatedAt,
  ];

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);
  } else {
    sheet.appendRow(values);
  }

  var triggerInstalled = false;
  try {
    triggerInstalled = ensureNotificationTrigger_();
  } catch (triggerError) {
    // Saving the subscription must succeed even if trigger creation is blocked in this context.
  }

  return { ok: true, triggerInstalled: triggerInstalled };
}

function removePushSubscription_(payload) {
  var body = normalizeRequestBody_(payload);
  if (!body.endpoint) {
    throw new Error('Missing endpoint.');
  }

  deleteRowsByColumnValue_(PUSH_SUBSCRIPTIONS_SHEET_, 0, body.endpoint);
  deleteRowsByColumnValue_(PUSH_PENDING_SHEET_, 0, body.endpoint);
  return { ok: true };
}

function getPendingNotifications_(endpoint) {
  if (!endpoint) return { notifications: [] };

  ensureSheetHeaders_(PUSH_PENDING_SHEET_, ['endpoint', 'notificationId', 'title', 'body', 'tag', 'createdAt', 'stage', 'stageColor']);
  var sheet = getSheet_(PUSH_PENDING_SHEET_);
  var rows = sheet.getDataRange().getValues();
  var notifications = [];

  for (var i = 1; i < rows.length; i += 1) {
    if (rows[i][0] !== endpoint) continue;
    notifications.push({
      id: rows[i][1],
      title: rows[i][2],
      body: rows[i][3],
      tag: rows[i][4],
      stage: rows[i][6] || '',
      stageColor: rows[i][7] || '',
    });
  }

  return { notifications: notifications };
}

function ackNotifications_(payload) {
  var body = normalizeRequestBody_(payload);
  if (!body.endpoint || !body.ids || !body.ids.length) {
    return { ok: true };
  }

  var sheet = getSheet_(PUSH_PENDING_SHEET_);
  var rows = sheet.getDataRange().getValues();
  var ids = {};
  body.ids.forEach(function(id) { ids[id] = true; });

  for (var i = rows.length - 1; i >= 1; i -= 1) {
    if (rows[i][0] === body.endpoint && ids[rows[i][1]]) {
      sheet.deleteRow(i + 1);
    }
  }

  return { ok: true };
}

function processScheduledNotifications() {
  var keys = requireVapidKeys_();
  var subscriptions = readPushSubscriptions_();
  if (!subscriptions.length) return;

  var schedule = loadScheduleByDay_();
  var nowMs = Date.now();
  ensureSheetHeaders_(PUSH_SENT_SHEET_, ['notificationId', 'endpoint', 'sentAt']);
  var sentKeys = readSentNotificationKeys_();

  subscriptions.forEach(function(subscription) {
    var planned = planNotificationsForUser_(
      subscription.nickname,
      schedule.days,
      schedule.scheduleByDay,
      subscription.preferences,
      nowMs,
    );
    var due = dueNotifications_(planned, nowMs);
    var fresh = due.filter(function(notification) {
      return !sentKeys[notification.id + '::' + subscription.endpoint];
    });

    if (!fresh.length) return;

    fresh.forEach(function(notification) {
      queuePendingNotification_(subscription.endpoint, notification);
      var status = sendAndLogPush_(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        keys.vapidPublicKey,
        keys.vapidPrivateKey,
        notification,
      );
      if (status >= 200 && status < 300) {
        recordSentNotification_(notification.id, subscription.endpoint);
      }
    });
  });
}

function sendAndLogPush_(subscription, vapidPublicKey, vapidPrivateKey, notification) {
  var payload = notification
    ? JSON.stringify({
        id: notification.id,
        title: notification.title,
        body: notification.body,
        tag: notification.tag,
        stage: notification.stage,
        stageColor: notification.stageColor,
        type: notification.type,
      })
    : null;
  var response = sendWebPush_(
    subscription,
    vapidPublicKey,
    vapidPrivateKey,
    payload,
    VAPID_SUBJECT_,
  );
  logPushResult_(subscription.endpoint, response.getResponseCode(), response.getContentText());
  return response.getResponseCode();
}

function logPushResult_(endpoint, status, body) {
  ensureSheetHeaders_(PUSH_LOG_SHEET_, ['sentAt', 'endpoint', 'status', 'body']);
  getSheet_(PUSH_LOG_SHEET_).appendRow([
    new Date().toISOString(),
    endpoint,
    status,
    String(body || '').slice(0, 500),
  ]);
}

/**
 * Run in the editor to test push delivery. Check _push_log for HTTP status.
 * 201 = push service accepted. 403 = VAPID keys wrong. 410 = subscription expired (re-enable in app).
 */
function testPushDelivery() {
  var keys = requireVapidKeys_();
  var subscriptions = readPushSubscriptions_();
  if (!subscriptions.length) {
    throw new Error('No subscriptions in _push_subscriptions');
  }

  var results = subscriptions.map(function(subscription) {
    var notification = {
      id: 'test:' + Date.now() + ':' + subscription.endpoint.slice(-8),
      title: 'B4L test',
      body: 'Push delivery works!\nLOVE · 22:00',
      tag: 'b4l-test',
      stage: 'LOVE',
      stageColor: '#e07599',
      type: 'test',
    };
    queuePendingNotification_(subscription.endpoint, notification);
    var status = sendAndLogPush_(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      keys.vapidPublicKey,
      keys.vapidPrivateKey,
      notification,
    );
    return {
      endpoint: subscription.endpoint,
      nickname: subscription.nickname,
      ok: status >= 200 && status < 300,
      status: status,
    };
  });

  return { sent: results.length, results: results };
}

/**
 * Manual preview: send today's daily opener notification to every subscription.
 * Uses your real joined shows from the sheet (today's tab if possible).
 * Does not write to _push_sent, so the real 10:00 opener can still fire later.
 */
function testDailyOpenerNotification() {
  var keys = requireVapidKeys_();
  var subscriptions = readPushSubscriptions_();
  if (!subscriptions.length) {
    throw new Error('No subscriptions in _push_subscriptions');
  }

  var schedule = loadScheduleByDay_();
  var results = [];

  subscriptions.forEach(function(subscription) {
    var match = findDailyOpenerDayForUser_(subscription.nickname, schedule.days, schedule.scheduleByDay);
    if (!match) {
      results.push({
        nickname: subscription.nickname,
        ok: false,
        error: 'No joined shows found for this nickname.',
      });
      return;
    }

    var planned = buildDailyOpenerNotification_(match.day, match.dayDate, match.joined, Date.now());
    var notification = {
      id: 'preview:daily:' + match.dayDate + ':' + Date.now(),
      type: planned.type,
      title: planned.title,
      body: planned.body,
      tag: 'preview-' + planned.tag,
      stage: planned.stage,
      stageColor: planned.stageColor,
    };

    queuePendingNotification_(subscription.endpoint, notification);
    var status = sendAndLogPush_(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      keys.vapidPublicKey,
      keys.vapidPrivateKey,
      notification,
    );

    results.push({
      nickname: subscription.nickname,
      day: match.day,
      title: notification.title,
      body: notification.body,
      stage: notification.stage,
      stageColor: notification.stageColor,
      ok: status >= 200 && status < 300,
      status: status,
    });
  });

  return { sent: results.filter(function(row) { return row.ok; }).length, results: results };
}

/**
 * Test helper: resend encrypted pushes for rows already in _push_pending.
 */
function flushPendingPushNotifications() {
  var keys = requireVapidKeys_();

  ensureSheetHeaders_(PUSH_PENDING_SHEET_, ['endpoint', 'notificationId', 'title', 'body', 'tag', 'createdAt', 'stage', 'stageColor']);
  var pendingRows = getSheet_(PUSH_PENDING_SHEET_).getDataRange().getValues();
  if (pendingRows.length <= 1) {
    return { ok: true, sent: 0, message: 'No rows in _push_pending' };
  }

  var subscriptions = readPushSubscriptions_();
  var sent = 0;
  for (var i = 1; i < pendingRows.length; i += 1) {
    var endpoint = pendingRows[i][0];
    if (!endpoint) continue;

    var subscription = subscriptions.filter(function(row) {
      return row.endpoint === endpoint;
    })[0];
    if (!subscription) continue;

    sendAndLogPush_(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      keys.vapidPublicKey,
      keys.vapidPrivateKey,
      {
        id: pendingRows[i][1],
        title: pendingRows[i][2],
        body: pendingRows[i][3],
        tag: pendingRows[i][4],
        stage: pendingRows[i][6] || '',
        stageColor: pendingRows[i][7] || '',
      },
    );
    sent += 1;
  }

  return { ok: true, sent: sent };
}

/**
 * Benchmark planning workload without sending pushes.
 * Run from the Apps Script editor: benchmarkNotificationProcessing(12)
 */
function benchmarkNotificationProcessing(userLimit) {
  var limit = userLimit || 12;
  var timings = {};
  var startedAt = Date.now();

  var stepStartedAt = Date.now();
  requireVapidKeys_();
  timings.requireVapidKeysMs = Date.now() - stepStartedAt;

  stepStartedAt = Date.now();
  var allSubscriptions = readPushSubscriptions_();
  var subscriptions = allSubscriptions.slice(0, limit);
  timings.readSubscriptionsMs = Date.now() - stepStartedAt;
  timings.subscriptionCount = subscriptions.length;
  timings.totalSubscriptions = allSubscriptions.length;

  invalidateScheduleCache_();
  stepStartedAt = Date.now();
  loadScheduleByDay_();
  timings.loadScheduleColdMs = Date.now() - stepStartedAt;

  stepStartedAt = Date.now();
  var schedule = loadScheduleByDay_();
  timings.loadScheduleWarmMs = Date.now() - stepStartedAt;
  timings.loadScheduleMs = timings.loadScheduleColdMs;
  timings.dayCount = schedule.days.length;

  stepStartedAt = Date.now();
  ensureSheetHeaders_(PUSH_SENT_SHEET_, ['notificationId', 'endpoint', 'sentAt']);
  var sentKeys = readSentNotificationKeys_();
  timings.readSentKeysMs = Date.now() - stepStartedAt;
  timings.sentKeyCount = Object.keys(sentKeys).length;

  var nowMs = Date.now();
  var planAllUsersMs = 0;
  var plannedNotifications = 0;
  var dueNow = 0;

  subscriptions.forEach(function(subscription) {
    stepStartedAt = Date.now();
    var planned = planNotificationsForUser_(
      subscription.nickname,
      schedule.days,
      schedule.scheduleByDay,
      subscription.preferences,
      nowMs,
    );
    planAllUsersMs += Date.now() - stepStartedAt;
    plannedNotifications += planned.length;
    dueNow += dueNotifications_(planned, nowMs).length;
  });

  timings.planAllUsersMs = planAllUsersMs;
  timings.plannedNotifications = plannedNotifications;
  timings.dueNow = dueNow;
  timings.totalMs = Date.now() - startedAt;
  timings.totalWarmMs =
    timings.requireVapidKeysMs +
    timings.readSubscriptionsMs +
    timings.loadScheduleWarmMs +
    timings.readSentKeysMs +
    timings.planAllUsersMs;

  var triggerQuotaMs = 90 * 60 * 1000;
  timings.estimatedDailyMsAt1Min = timings.totalMs * 1440;
  timings.estimatedDailyMsAt5Min = timings.totalMs * 288;
  timings.estimatedDailyWarmMsAt1Min = timings.totalWarmMs * 1440;
  timings.estimatedDailyWarmMsAt5Min = timings.totalWarmMs * 288;
  timings.triggerQuotaMs = triggerQuotaMs;
  timings.headroomAt1MinMs = triggerQuotaMs - timings.estimatedDailyMsAt1Min;
  timings.headroomAt5MinMs = triggerQuotaMs - timings.estimatedDailyMsAt5Min;
  timings.headroomWarmAt1MinMs = triggerQuotaMs - timings.estimatedDailyWarmMsAt1Min;
  timings.headroomWarmAt5MinMs = triggerQuotaMs - timings.estimatedDailyWarmMsAt5Min;

  Logger.log(JSON.stringify(timings, null, 2));
  return timings;
}

/**
 * Debug helper: see what processScheduledNotifications would plan right now.
 */
function debugNotificationPlan() {
  var subscriptions = readPushSubscriptions_();
  var schedule = loadScheduleByDay_();
  var nowMs = Date.now();

  return subscriptions.map(function(subscription) {
    var planned = planNotificationsForUser_(
      subscription.nickname,
      schedule.days,
      schedule.scheduleByDay,
      subscription.preferences,
      nowMs,
    );
    var due = dueNotifications_(planned, nowMs);
    return {
      nickname: subscription.nickname,
      planned: planned.length,
      due: due.length,
      items: due,
    };
  });
}

function requireVapidKeys_() {
  var vapidPublicKey = getScriptProperty_('VAPID_PUBLIC_KEY');
  var vapidPrivateKey = getScriptProperty_('VAPID_PRIVATE_KEY');
  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error('Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY script properties.');
  }
  return { vapidPublicKey: vapidPublicKey, vapidPrivateKey: vapidPrivateKey };
}

function readPushSubscriptions_() {
  ensureSheetHeaders_(
    PUSH_SUBSCRIPTIONS_SHEET_,
    ['endpoint', 'nickname', 'p256dh', 'auth', 'preferences', 'updatedAt'],
  );

  var rows = getSheet_(PUSH_SUBSCRIPTIONS_SHEET_).getDataRange().getValues();
  var subscriptions = [];

  for (var i = 1; i < rows.length; i += 1) {
    if (!rows[i][0]) continue;
    subscriptions.push({
      endpoint: rows[i][0],
      nickname: rows[i][1],
      p256dh: rows[i][2],
      auth: rows[i][3],
      preferences: parsePreferences_(rows[i][4]),
    });
  }

  return subscriptions;
}

function queuePendingNotification_(endpoint, notification) {
  ensureSheetHeaders_(PUSH_PENDING_SHEET_, ['endpoint', 'notificationId', 'title', 'body', 'tag', 'createdAt', 'stage', 'stageColor']);
  var sheet = getSheet_(PUSH_PENDING_SHEET_);
  var rows = sheet.getDataRange().getValues();

  for (var i = 1; i < rows.length; i += 1) {
    if (rows[i][0] === endpoint && rows[i][1] === notification.id) {
      return;
    }
  }

  sheet.appendRow([
    endpoint,
    notification.id,
    notification.title,
    notification.body,
    notification.tag,
    new Date().toISOString(),
    notification.stage || '',
    notification.stageColor || '',
  ]);
}

function readSentNotificationKeys_() {
  ensureSheetHeaders_(PUSH_SENT_SHEET_, ['notificationId', 'endpoint', 'sentAt']);
  var rows = getSheet_(PUSH_SENT_SHEET_).getDataRange().getValues();
  var keys = {};

  for (var i = 1; i < rows.length; i += 1) {
    if (!rows[i][0] || !rows[i][1]) continue;
    keys[rows[i][0] + '::' + rows[i][1]] = true;
  }

  return keys;
}

function recordSentNotification_(notificationId, endpoint) {
  ensureSheetHeaders_(PUSH_SENT_SHEET_, ['notificationId', 'endpoint', 'sentAt']);
  getSheet_(PUSH_SENT_SHEET_).appendRow([notificationId, endpoint, new Date().toISOString()]);
}

function parsePreferences_(value) {
  if (!value) return NOTIFICATION_PREFS_DEFAULTS_;
  try {
    var parsed = JSON.parse(value);
    return {
      startsSoon: parsed.startsSoon !== false,
      dailyOpener: parsed.dailyOpener !== false,
      nowPlaying: parsed.nowPlaying !== false,
      startsSoonLeadMinutes: Number(parsed.startsSoonLeadMinutes) || 15,
      dailyOpenerHour: Number(parsed.dailyOpenerHour) || 10,
    };
  } catch (error) {
    return NOTIFICATION_PREFS_DEFAULTS_;
  }
}

function normalizeRequestBody_(payload) {
  if (!payload) return {};
  if (typeof payload === 'object') return payload;
  return JSON.parse(payload);
}

function getScriptProperty_(name) {
  return PropertiesService.getScriptProperties().getProperty(name);
}

function ensureSheetHeaders_(name, headers) {
  var sheet = getSheet_(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }
}

function getSheet_(name) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }
  return sheet;
}

function deleteRowsByColumnValue_(sheetName, columnIndex, value) {
  var sheet = getSheet_(sheetName);
  var rows = sheet.getDataRange().getValues();
  for (var i = rows.length - 1; i >= 1; i -= 1) {
    if (rows[i][columnIndex] === value) {
      sheet.deleteRow(i + 1);
    }
  }
}

/**
 * Creates the 5-minute notification trigger if missing.
 * Called automatically on first push subscription save.
 * Can also be run manually from the Apps Script editor.
 */
function setupTriggers() {
  var triggerInstalled = ensureNotificationTrigger_();
  return { ok: true, triggerInstalled: triggerInstalled };
}

function ensureNotificationTrigger_() {
  var triggers = ScriptApp.getProjectTriggers();
  var exists = triggers.some(function(trigger) {
    return trigger.getHandlerFunction() === 'processScheduledNotifications';
  });

  if (!exists) {
    ScriptApp.newTrigger('processScheduledNotifications')
      .timeBased()
      .everyMinutes(5)
      .create();
    return true;
  }

  return false;
}
