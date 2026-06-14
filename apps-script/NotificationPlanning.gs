/**
 * Notification planning for the Apps Script cron job.
 * Keep rules aligned with src/domain/notifications.ts, src/config.ts, and src/stageColors.ts.
 */

var STAGE_COLORS_ = {
  'LOVE': '#e07599',
  'D&B FORGE': '#03A9F4',
  'HARMONY HOUSE SQUARE': '#4db6ac',
  'TECHNO DOME': '#ba68c8',
  'EMPIRE': '#e57373',
  'FUTURE': '#9570ff',
};

function colorForStage_(stage) {
  var trimmed = String(stage || '').trim();
  if (!trimmed) return '#e07599';

  if (STAGE_COLORS_[trimmed]) return STAGE_COLORS_[trimmed];

  var upper = trimmed.toUpperCase();
  var keys = Object.keys(STAGE_COLORS_);
  for (var i = 0; i < keys.length; i += 1) {
    if (keys[i].toUpperCase() === upper) return STAGE_COLORS_[keys[i]];
  }

  return '#e07599';
}

function planNotificationsForUser_(nickname, days, scheduleByDay, preferences, nowMs) {
  var trimmed = String(nickname || '').trim();
  if (!trimmed) return [];

  var planned = [];
  var timeZoneOffset = getFestivalTimeZoneOffset_();
  var preDawnCutoffMinutes = getPreDawnCutoffMinutes_();

  days.forEach(function(day) {
    var dayDate = calendarIsoDateForDayLabel_(day);
    if (!dayDate) return;

    var joined = (scheduleByDay[day] || []).filter(function(item) {
      return item.attendees.indexOf(trimmed) !== -1;
    });
    if (!joined.length) return;

    if (preferences.dailyOpener) {
      var opener = planDailyOpener_(day, dayDate, joined, preferences, nowMs, timeZoneOffset);
      if (opener) planned.push(opener);
    }

    joined.forEach(function(item) {
      var start = intervalStartDate_(dayDate, item.time, timeZoneOffset, preDawnCutoffMinutes);
      var end = intervalEndDate_(dayDate, item.time, timeZoneOffset, preDawnCutoffMinutes);
      var stageColor = colorForStage_(item.stage);
      var timeLabel = formatClock_(item.time.startMinutes);

      if (preferences.nowPlaying && end.getTime() > nowMs) {
        planned.push({
          id: 'now:' + day + ':' + item.id,
          type: 'now_playing',
          fireAtMs: start.getTime(),
          title: 'On stage now',
          body: item.artist + '\n' + item.stage + ' · ' + timeLabel,
          tag: 'now-' + item.id,
          stage: item.stage,
          stageColor: stageColor,
        });
      }

      if (preferences.startsSoon && start.getTime() > nowMs) {
        var fireAtMs = start.getTime() - preferences.startsSoonLeadMinutes * 60 * 1000;
        planned.push({
          id: 'soon:' + day + ':' + item.id,
          type: 'starts_soon',
          fireAtMs: fireAtMs,
          title: 'Starting in ' + preferences.startsSoonLeadMinutes + ' min',
          body: item.artist + '\n' + item.stage + ' · ' + timeLabel,
          tag: 'soon-' + item.id,
          stage: item.stage,
          stageColor: stageColor,
        });
      }
    });
  });

  planned.sort(function(left, right) {
    return left.fireAtMs - right.fireAtMs;
  });

  return planned;
}

function dueNotifications_(planned, nowMs, windowMs) {
  var window = windowMs || 5 * 60 * 1000;
  return planned.filter(function(notification) {
    var delta = nowMs - notification.fireAtMs;
    return delta >= 0 && delta < window;
  });
}

function planDailyOpener_(day, dayDate, joined, preferences, nowMs, timeZoneOffset) {
  var openerMs = dailyOpenerTimestamp_(dayDate, preferences.dailyOpenerHour, timeZoneOffset);
  var dueWindowMs = 5 * 60 * 1000;
  if (openerMs + dueWindowMs <= nowMs) return null;

  return buildDailyOpenerNotification_(day, dayDate, joined, openerMs);
}

function buildDailyOpenerNotification_(day, dayDate, joined, fireAtMs) {
  var sorted = joined.slice().sort(function(left, right) {
    return left.time.startMinutes - right.time.startMinutes;
  });
  var first = sorted[0];
  var dayLabel = day.replace(/\s*\d{1,2}\.\s*\d{1,2}\.\s*\d{4}\s*/, '').trim() || day;

  return {
    id: 'daily:' + dayDate,
    type: 'daily_opener',
    fireAtMs: fireAtMs || Date.now(),
    title: 'Your lineup · ' + dayLabel,
    body: joined.length + ' show' + (joined.length === 1 ? '' : 's') + ' today\nFirst up: ' + first.artist + ' at ' + formatClock_(first.time.startMinutes) + ' · ' + first.stage,
    tag: 'daily-' + dayDate,
    stage: first.stage,
    stageColor: colorForStage_(first.stage),
  };
}

function findDailyOpenerDayForUser_(nickname, days, scheduleByDay) {
  var trimmed = String(nickname || '').trim();
  if (!trimmed) return null;

  var todayIso = Utilities.formatDate(new Date(), 'GMT+2', 'yyyy-MM-dd');
  var firstMatch = null;

  for (var i = 0; i < days.length; i += 1) {
    var day = days[i];
    var dayDate = calendarIsoDateForDayLabel_(day);
    if (!dayDate) continue;

    var joined = (scheduleByDay[day] || []).filter(function(item) {
      return item.attendees.indexOf(trimmed) !== -1;
    });
    if (!joined.length) continue;

    if (dayDate === todayIso) {
      return { day: day, dayDate: dayDate, joined: joined };
    }

    if (!firstMatch) {
      firstMatch = { day: day, dayDate: dayDate, joined: joined };
    }
  }

  return firstMatch;
}

function dailyOpenerTimestamp_(dayDate, hour, timeZoneOffset) {
  var hh = String(hour).length === 1 ? '0' + hour : String(hour);
  return new Date(dayDate + 'T' + hh + ':00:00' + timeZoneOffset).getTime();
}

function formatClock_(minutes) {
  var hh = Math.floor(minutes / 60) % 24;
  var mm = minutes % 60;
  return pad2_(hh) + ':' + pad2_(mm);
}

function pad2_(value) {
  return value < 10 ? '0' + value : String(value);
}

function calendarIsoDateForDayLabel_(dayLabel) {
  var match = /(\d{1,2})\.\s*(\d{1,2})\.\s*((?:19|20)\d{2})\b/.exec(String(dayLabel).trim());
  if (!match) return null;

  var d = Number(match[1]);
  var m = Number(match[2]);
  var y = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;

  var date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }

  return y + '-' + pad2_(m) + '-' + pad2_(d);
}

function intervalStartDate_(dayDate, range, timeZoneOffset, preDawnCutoffMinutes) {
  var base = new Date(dayDate + 'T00:00:00' + timeZoneOffset);
  var start = addMinutes_(base, range.startMinutes);
  if (range.startMinutes < preDawnCutoffMinutes) {
    start.setDate(start.getDate() + 1);
  }
  return start;
}

function intervalEndDate_(dayDate, range, timeZoneOffset, preDawnCutoffMinutes) {
  var base = new Date(dayDate + 'T00:00:00' + timeZoneOffset);
  var end = addMinutes_(base, range.endMinutes);
  if (range.startMinutes < preDawnCutoffMinutes) {
    end.setDate(end.getDate() + 1);
  }
  return end;
}

function addMinutes_(date, minutes) {
  var copy = new Date(date.getTime());
  copy.setMinutes(copy.getMinutes() + minutes);
  return copy;
}

function getFestivalTimeZoneOffset_() {
  // Matches src/config.ts festivalTimeZoneOffset
  return '+02:00';
}

function getPreDawnCutoffMinutes_() {
  // Matches src/config.ts preDawnCutoffMinutes
  return 9 * 60;
}
