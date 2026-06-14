/**
 * JSONP Web API for multi-day festival sheets with dynamic tabs.
 *
 * Lineup API (GET, supports ?callback= for JSONP):
 *   action=listDays              → array of festival sheet names
 *   action=toggle&day&rowIndex&nickname
 *   day=…                        → row data for that sheet
 *
 * Notification API (GET):
 *   action=savePushSubscription&nickname&endpoint&p256dh&auth&preferences
 *   action=removePushSubscription&endpoint
 *   action=pendingNotifications&endpoint
 *   action=ackNotifications&endpoint&ids
 *
 * Time-driven trigger: processScheduledNotifications (every 5 minutes)
 *
 * Script properties:
 *   VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY
 */
function doGet(e) {
  var params = e.parameter || {};
  var cb = params.callback;

  var notificationResult = handleNotificationAction_(params);
  if (notificationResult !== null) {
    return buildJsonOutput_(notificationResult, cb);
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var payload;

  if (params.action === 'listDays') {
    payload = listFestivalDays_();
  } else {
    var activeSheets = getActiveFestivalSheets_();
    var sheet = params.day
      ? SpreadsheetApp.getActiveSpreadsheet().getSheetByName(params.day) || activeSheets[0]
      : activeSheets[0];

    if (!sheet) {
      payload = [];
    } else if (params.action === 'toggle' && params.rowIndex && params.nickname) {
      toggleAttendance_(sheet, Number(params.rowIndex), params.nickname);
      payload = readSheetPayload_(sheet);
    } else {
      payload = readSheetPayload_(sheet);
    }
  }

  return buildJsonOutput_(payload, cb);
}

function buildJsonOutput_(payload, callback) {
  var json = JSON.stringify(payload);
  var body = callback ? callback + '(' + json + ');' : json;
  return ContentService
    .createTextOutput(body)
    .setMimeType(callback
      ? ContentService.MimeType.JAVASCRIPT
      : ContentService.MimeType.JSON);
}

function listFestivalDays_() {
  return getActiveFestivalSheets_().map(function(sheet) {
    return sheet.getName();
  });
}

function getFestivalSheets_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets().filter(function(sheet) {
    return sheet.getName().charAt(0) !== '_';
  });
}

function isArchivedFestivalSheet_(sheetName) {
  return /OLD/i.test(String(sheetName || ''));
}

function getActiveFestivalSheets_() {
  return getFestivalSheets_().filter(function(sheet) {
    return !isArchivedFestivalSheet_(sheet.getName());
  });
}

var SCHEDULE_CACHE_PREFIX_ = 'scheduleByDay:v1:';
var SCHEDULE_CACHE_TTL_SEC_ = 360;

function loadScheduleByDay_() {
  var sheets = getActiveFestivalSheets_();
  var days = sheets.map(function(sheet) {
    return sheet.getName();
  });
  if (!days.length) {
    return { days: [], scheduleByDay: {} };
  }

  var cache = CacheService.getScriptCache();
  var scheduleByDay = {};
  var missingSheets = [];

  days.forEach(function(day) {
    var cached = cache.get(SCHEDULE_CACHE_PREFIX_ + day);
    if (cached) {
      scheduleByDay[day] = JSON.parse(cached);
      return;
    }
    missingSheets.push(day);
  });

  if (!missingSheets.length) {
    return { days: days, scheduleByDay: scheduleByDay };
  }

  sheets.forEach(function(sheet) {
    var day = sheet.getName();
    if (missingSheets.indexOf(day) === -1) return;

    var rows = readScheduleRowsFromSheet_(sheet);
    scheduleByDay[day] = rows;
    cacheScheduleDay_(cache, day, rows);
  });

  return { days: days, scheduleByDay: scheduleByDay };
}

function cacheScheduleDay_(cache, day, rows) {
  var serialized = JSON.stringify(rows);
  if (serialized.length >= 100000) return;

  cache.put(SCHEDULE_CACHE_PREFIX_ + day, serialized, SCHEDULE_CACHE_TTL_SEC_);
}

function invalidateScheduleCache_() {
  var cache = CacheService.getScriptCache();
  listFestivalDays_().forEach(function(day) {
    cache.remove(SCHEDULE_CACHE_PREFIX_ + day);
  });
}

function readScheduleRowsFromSheet_(sheet) {
  return readSheetRowsAsObjects_(sheet).map(function(row) {
    return normalizeScheduleItem_(row, row.rowIndex);
  }).filter(function(item) {
    return item !== null;
  });
}

function readScheduleRows_(day) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(day);
  if (!sheet) return [];

  return readScheduleRowsFromSheet_(sheet);
}

function readSheetRowsAsObjects_(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  var headers = data.shift();
  return data.map(function(row, index) {
    var obj = {};
    headers.forEach(function(header, columnIndex) {
      obj[header] = row[columnIndex];
    });
    obj.rowIndex = index + 2;
    return obj;
  });
}

function readSheetPayload_(sheet) {
  return readSheetRowsAsObjects_(sheet);
}

function toggleAttendance_(sheet, rowIndex, nickname) {
  var nick = String(nickname || '').trim();
  if (!nick) return;

  var col = 4;
  if (sheet.getRange(1, 4).getValue() !== 'Attendees') {
    col = sheet.getLastColumn() + 1;
    sheet.getRange(1, col).setValue('Attendees');
  }

  var cell = sheet.getRange(rowIndex, col);
  var list = cell.getValue().toString().split(',')
    .map(function(value) { return value.trim(); })
    .filter(Boolean);

  if (list.indexOf(nick) !== -1) {
    list = list.filter(function(value) { return value !== nick; });
  } else {
    list.push(nick);
  }

  cell.setValue(list.join(', '));
  invalidateScheduleCache_();
}

function normalizeScheduleItem_(row, rowIndex) {
  var artist = String(row.Artist || '').trim();
  var stage = String(row.Stage || '').trim();
  var timeLabel = String(row.Time || '').trim();
  var time = parseTimeRange_(timeLabel);

  if (!artist || !stage || !time) return null;

  return {
    id: rowIndex,
    artist: artist,
    stage: stage,
    time: time,
    attendees: splitAttendees_(row.Attendees),
  };
}

function parseTimeRange_(value) {
  var match = /^\s*(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})\s*$/.exec(value);
  if (!match) return null;

  var startHour = Number(match[1]);
  var startMinute = Number(match[2]);
  var endHour = Number(match[3]);
  var endMinute = Number(match[4]);

  if (!isValidClock_(startHour, startMinute) || !isValidClock_(endHour, endMinute)) {
    return null;
  }

  var startMinutes = startHour * 60 + startMinute;
  var endMinutes = endHour * 60 + endMinute;
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }

  return {
    label: value.trim(),
    startMinutes: startMinutes,
    endMinutes: endMinutes,
  };
}

function splitAttendees_(value) {
  if (value === null || value === undefined || value === '') return [];
  return String(value).split(',')
    .map(function(name) { return name.trim(); })
    .filter(Boolean);
}

function isValidClock_(hour, minute) {
  return Number.isInteger(hour) && Number.isInteger(minute)
    && hour >= 0 && hour < 24 && minute >= 0 && minute < 60;
}
