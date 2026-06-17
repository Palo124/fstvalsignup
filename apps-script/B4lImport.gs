/**
 * Import new sets from https://www.b4l.cz/timetable/ into festival day sheets.
 *
 * Sheet columns: Time | Stage | Artist | Attendees
 * Day sheet tabs: 1.7. 2026 Wednesday
 *
 * Run from the Apps Script editor:
 *   importB4lTimetableDryRun()       → preview without writing
 *   importB4lTimetable()             → append only rows that are not already present
 *   importB4lTimetable(2027)         → force a year when creating new day tabs
 *   importB4lTimetableDryRun(2027)
 *
 * Spreadsheet menu: Festival lineup → Import B4L timetable
 */
var B4L_TIMETABLE_URL_ = 'https://www.b4l.cz/timetable/';
var B4L_SCHEDULE_HEADERS_ = ['Time', 'Stage', 'Artist', 'Attendees'];
var B4L_PRE_DAWN_CUTOFF_MINUTES_ = 9 * 60;
var B4L_CZECH_TO_ENGLISH_WEEKDAY_ = {
  'Pondělí': 'Monday',
  'Úterý': 'Tuesday',
  'Středa': 'Wednesday',
  'Čtvrtek': 'Thursday',
  'Pátek': 'Friday',
  'Sobota': 'Saturday',
  'Neděle': 'Sunday',
};
var B4L_ENGLISH_WEEKDAYS_ = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Festival lineup')
    .addItem('Import B4L timetable (preview)', 'importB4lTimetableDryRun')
    .addItem('Import B4L timetable (append new)', 'importB4lTimetable')
    .addToUi();
}

function importB4lTimetableDryRun(yearOverride) {
  return importB4lTimetable_({ dryRun: true, year: yearOverride });
}

function importB4lTimetable(yearOverride) {
  return importB4lTimetable_({ dryRun: false, year: yearOverride });
}

function importB4lTimetable_(options) {
  options = options || {};
  var dryRun = !!options.dryRun;
  var html = fetchB4lTimetableHtml_();
  var parsed = parseB4lTimetableHtml_(html, options.year);
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var activeSheets = getActiveFestivalSheets_();
  var summary = {
    dryRun: dryRun,
    year: parsed.year,
    yearSource: parsed.yearSource,
    appended: 0,
    skippedExisting: 0,
    days: {},
  };

  Object.keys(parsed.days).forEach(function(dayLabel) {
    var entries = parsed.days[dayLabel];
    var sheetName = resolveB4lDaySheetName_(dayLabel, parsed.year, activeSheets);
    var sheet = spreadsheet.getSheetByName(sheetName);
    var daySummary = {
      sheetName: sheetName,
      parsed: entries.length,
      appended: 0,
      skippedExisting: 0,
      createdSheet: false,
    };

    if (!sheet) {
      daySummary.createdSheet = true;
      if (dryRun) {
        daySummary.appended = entries.length;
        summary.appended += entries.length;
        summary.days[sheetName] = daySummary;
        return;
      }

      sheet = spreadsheet.insertSheet(sheetName);
      sheet.appendRow(B4L_SCHEDULE_HEADERS_);
    } else {
      ensureB4lScheduleHeaders_(sheet);
    }

    var existingKeys = readExistingScheduleKeys_(sheet);
    var newRows = [];

    entries.forEach(function(entry) {
      var key = scheduleRowKey_(entry.time, entry.stage, entry.artist);
      if (existingKeys[key]) {
        daySummary.skippedExisting += 1;
        summary.skippedExisting += 1;
        return;
      }

      existingKeys[key] = true;
      newRows.push([entry.time, entry.stage, entry.artist, '']);
    });

    if (!dryRun && newRows.length) {
      var startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, startRow + newRows.length - 1, B4L_SCHEDULE_HEADERS_.length)
        .setValues(newRows);
      invalidateSheetCaches_(sheetName);
    }

    daySummary.appended = newRows.length;
    summary.appended += newRows.length;
    summary.days[sheetName] = daySummary;
  });

  if (!dryRun && summary.appended > 0) {
    invalidateScheduleCache_();
  }

  Logger.log(JSON.stringify(summary, null, 2));
  return summary;
}

function fetchB4lTimetableHtml_() {
  var response = UrlFetchApp.fetch(B4L_TIMETABLE_URL_, {
    muteHttpExceptions: true,
    headers: {
      'User-Agent': 'fstvalsignup-b4l-import/1.0',
    },
  });

  var status = response.getResponseCode();
  if (status !== 200) {
    throw new Error('Failed to fetch B4L timetable: HTTP ' + status);
  }

  return response.getContentText('UTF-8');
}

function parseB4lTimetableHtml_(html, yearOverride) {
  var resolvedYear = resolveB4lFestivalYear_(html, yearOverride);
  var dayLabels = parseB4lDayLabels_(html);
  var blockStarts = findTimetableDayBlockStarts_(html);
  var blockHtmls = splitTimetableDayBlocks_(html);
  var days = {};

  if (!blockHtmls.length) {
    throw new Error('No timetable-day-data blocks found on B4L page');
  }

  for (var index = 0; index < blockHtmls.length; index += 1) {
    var rawDay = index < dayLabels.length ? dayLabels[index] : ('Day ' + (index + 1));
    var dayLabel = formatB4lDaySheetLabel_(rawDay, resolvedYear.year);
    var stageNames = stageNamesBeforeBlock_(html, blockStarts[index]);
    var columns = splitStageColumns_(blockHtmls[index]);
    var entries = [];

    for (var stageIndex = 0; stageIndex < columns.length; stageIndex += 1) {
      var stage = stageIndex < stageNames.length
        ? stageNames[stageIndex]
        : ('Stage ' + (stageIndex + 1));
      var cards = parseB4lCards_(columns[stageIndex]);

      cards.forEach(function(card) {
        entries.push({
          time: card.time,
          stage: stage,
          artist: card.artist,
        });
      });
    }

    days[dayLabel] = sortB4lEntries_(entries);
  }

  if (!Object.keys(days).length) {
    throw new Error('Parsed B4L timetable is empty');
  }

  return {
    year: resolvedYear.year,
    yearSource: resolvedYear.source,
    days: days,
  };
}

function resolveB4lFestivalYear_(html, yearOverride) {
  if (yearOverride !== undefined && yearOverride !== null && yearOverride !== '') {
    var overrideYear = Number(yearOverride);
    if (!isValidFestivalYear_(overrideYear)) {
      throw new Error('Invalid year override: ' + yearOverride);
    }
    return { year: overrideYear, source: 'override' };
  }

  var detected = detectB4lFestivalYear_(html);
  if (detected) {
    return detected;
  }

  var propertyYear = Number(PropertiesService.getScriptProperties().getProperty('B4L_FESTIVAL_YEAR'));
  if (isValidFestivalYear_(propertyYear)) {
    return { year: propertyYear, source: 'script-property' };
  }

  throw new Error('Could not detect festival year from B4L timetable page');
}

function isValidFestivalYear_(year) {
  return Number.isInteger(year) && year >= 2000 && year <= 2100;
}

function detectB4lFestivalYear_(html) {
  var rangeMatch = /\d{1,2}\.\s*[—\-–]\s*\d{1,2}\.\s*\d{1,2}\.\s*((?:19|20)\d{2})/.exec(html);
  if (rangeMatch) {
    return { year: Number(rangeMatch[1]), source: 'page-range' };
  }

  var counts = {};
  var datePattern = /\b(\d{1,2})\.\s*(\d{1,2})\.\s*((?:19|20)\d{2})\b/g;
  var match;
  while ((match = datePattern.exec(html)) !== null) {
    var year = Number(match[3]);
    if (!isValidFestivalYear_(year)) continue;
    counts[year] = (counts[year] || 0) + 1;
  }

  var bestYear = null;
  var bestCount = 0;
  Object.keys(counts).forEach(function(key) {
    var count = counts[key];
    if (count > bestCount) {
      bestYear = Number(key);
      bestCount = count;
    }
  });

  if (bestYear) {
    return { year: bestYear, source: 'page-dates' };
  }

  return null;
}

function parseB4lDayLabels_(html) {
  var labels = [];
  var seen = {};
  var pattern = /<button[^>]*>((?:Středa|Čtvrtek|Pátek|Sobota|Neděle|Pondělí|Úterý)\s+\d{1,2}\.\s*\d{1,2}\.)[^<]*<\/button>/gi;
  var match;

  while ((match = pattern.exec(html)) !== null) {
    var text = normalizeInlineText_(decodeHtmlEntities_(stripHtmlTags_(match[1])));
    if (!text || seen[text]) continue;
    seen[text] = true;
    labels.push(text);
  }

  return labels;
}

function escapeRegExp_(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function divClassOpenTagPattern_(className) {
  return new RegExp('<div\\s+class=[\'"]' + escapeRegExp_(className) + '[^>]*>', 'gi');
}

function findDivClassStarts_(html, className) {
  var pattern = divClassOpenTagPattern_(className);
  var starts = [];
  var match;

  while ((match = pattern.exec(html)) !== null) {
    starts.push(match.index);
  }

  return starts;
}

function lastDivClassStartBefore_(html, className) {
  var pattern = divClassOpenTagPattern_(className);
  var last = -1;
  var match;

  while ((match = pattern.exec(html)) !== null) {
    last = match.index;
  }

  return last;
}

function splitByDivClass_(html, className) {
  var pattern = divClassOpenTagPattern_(className);
  var parts = [];
  var lastIndex = 0;
  var foundFirst = false;
  var match;

  while ((match = pattern.exec(html)) !== null) {
    if (!foundFirst) {
      foundFirst = true;
      lastIndex = match.index + match[0].length;
      continue;
    }

    parts.push(html.substring(lastIndex, match.index));
    lastIndex = match.index + match[0].length;
  }

  if (foundFirst) {
    parts.push(html.substring(lastIndex));
  }

  return parts;
}

function findTimetableDayBlockStarts_(html) {
  return findDivClassStarts_(html, 'timetable-day-data');
}

function splitTimetableDayBlocks_(html) {
  return splitByDivClass_(html, 'timetable-day-data');
}

function stageNamesBeforeBlock_(html, blockStartIndex) {
  var before = html.substring(0, blockStartIndex);
  var wrapperStart = lastDivClassStartBefore_(before, 'stage-titles-wrapper');
  if (wrapperStart === -1) return [];

  return extractButtonTexts_(before.substring(wrapperStart));
}

function extractButtonTexts_(html) {
  var texts = [];
  var pattern = /<button[^>]*>([\s\S]*?)<\/button>/gi;
  var match;

  while ((match = pattern.exec(html)) !== null) {
    var text = normalizeInlineText_(decodeHtmlEntities_(stripHtmlTags_(match[1])));
    if (text) texts.push(text);
  }

  return texts;
}

function splitStageColumns_(blockHtml) {
  return splitByDivClass_(blockHtml, 'stage-timetable');
}

function parseB4lCards_(columnHtml) {
  var entries = [];
  var pattern = /<div class=['"]card-body['"][\s\S]*?<strong>([\s\S]*?)<\/strong>[\s\S]*?<br\s*\/?>[\s\S]*?(\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2})/gi;
  var match;

  while ((match = pattern.exec(columnHtml)) !== null) {
    var artist = normalizeInlineText_(decodeHtmlEntities_(stripHtmlTags_(match[1])));
    var time = normalizeTimeLabel_(match[2]);
    if (!artist || !time) continue;

    entries.push({
      artist: artist,
      time: time,
    });
  }

  return entries;
}

function formatB4lDaySheetLabel_(dayLabel, year) {
  var parts = parseB4lDayLabelParts_(dayLabel, year);
  if (!parts) {
    return String(dayLabel || '').trim();
  }

  return formatCanonicalDaySheetName_(parts);
}

function formatCanonicalDaySheetName_(parts) {
  if (!isValidFestivalYear_(parts.year)) {
    throw new Error('Cannot format day sheet name without a valid year');
  }

  var weekday = parts.weekdayEnglish || czechWeekdayToEnglish_(parts.weekdayCzech) || 'Day';
  return parts.day + '.' + parts.month + '. ' + parts.year + ' ' + weekday;
}

function czechWeekdayToEnglish_(weekday) {
  return B4L_CZECH_TO_ENGLISH_WEEKDAY_[String(weekday || '').trim()] || null;
}

function normalizeEnglishWeekday_(weekday) {
  var value = String(weekday || '').trim();
  if (!value) return null;

  var lower = value.toLowerCase();
  for (var index = 0; index < B4L_ENGLISH_WEEKDAYS_.length; index += 1) {
    if (B4L_ENGLISH_WEEKDAYS_[index].toLowerCase() === lower) {
      return B4L_ENGLISH_WEEKDAYS_[index];
    }
  }

  return null;
}

function extractEnglishWeekdayFromLabel_(label) {
  var text = String(label || '');
  for (var index = 0; index < B4L_ENGLISH_WEEKDAYS_.length; index += 1) {
    var weekday = B4L_ENGLISH_WEEKDAYS_[index];
    if (new RegExp('\\b' + weekday + '\\b', 'i').test(text)) {
      return weekday;
    }
  }
  return null;
}

function parseB4lDayLabelParts_(dayLabel, fallbackYear) {
  var label = String(dayLabel || '').trim();
  var czechMatch = /^(Středa|Čtvrtek|Pátek|Sobota|Neděle|Pondělí|Úterý)\s+(\d{1,2})\.\s*(\d{1,2})\.(?:\s*((?:19|20)\d{2}))?/.exec(label);
  if (czechMatch) {
    return {
      weekdayCzech: czechMatch[1],
      weekdayEnglish: czechWeekdayToEnglish_(czechMatch[1]),
      day: Number(czechMatch[2]),
      month: Number(czechMatch[3]),
      year: czechMatch[4] ? Number(czechMatch[4]) : (fallbackYear || null),
    };
  }

  var canonicalMatch = /^(\d{1,2})\.(\d{1,2})\.\s*((?:19|20)\d{2})\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i.exec(label);
  if (canonicalMatch) {
    return {
      weekdayEnglish: normalizeEnglishWeekday_(canonicalMatch[4]),
      day: Number(canonicalMatch[1]),
      month: Number(canonicalMatch[2]),
      year: Number(canonicalMatch[3]),
    };
  }

  var englishFirstMatch = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(\d{1,2})\.(\d{1,2})\.\s*((?:19|20)\d{2})\b/i.exec(label);
  if (englishFirstMatch) {
    return {
      weekdayEnglish: normalizeEnglishWeekday_(englishFirstMatch[1]),
      day: Number(englishFirstMatch[2]),
      month: Number(englishFirstMatch[3]),
      year: Number(englishFirstMatch[4]),
    };
  }

  var embeddedDateMatch = /(\d{1,2})\.\s*(\d{1,2})\.\s*((?:19|20)\d{2})/.exec(label);
  if (embeddedDateMatch) {
    return {
      weekdayEnglish: extractEnglishWeekdayFromLabel_(label),
      day: Number(embeddedDateMatch[1]),
      month: Number(embeddedDateMatch[2]),
      year: Number(embeddedDateMatch[3]),
    };
  }

  return null;
}

function dayLabelPartsMatch_(left, right) {
  if (!left || !right) return false;
  if (left.day !== right.day || left.month !== right.month) return false;
  if (left.year && !right.year) return false;
  if (!left.year && right.year) return false;
  if (left.year && right.year && left.year !== right.year) return false;

  var leftWeekday = left.weekdayEnglish || czechWeekdayToEnglish_(left.weekdayCzech);
  var rightWeekday = right.weekdayEnglish || czechWeekdayToEnglish_(right.weekdayCzech);
  if (leftWeekday && rightWeekday && leftWeekday !== rightWeekday) return false;

  return true;
}

function resolveB4lDaySheetName_(dayLabel, year, sheets) {
  var target = parseB4lDayLabelParts_(dayLabel, year);
  var preferred = formatB4lDaySheetLabel_(dayLabel, year);
  var candidates = sheets.map(function(sheet) {
    return {
      name: sheet.getName(),
      parts: parseB4lDayLabelParts_(sheet.getName(), null),
    };
  });

  for (var exactIndex = 0; exactIndex < candidates.length; exactIndex += 1) {
    if (candidates[exactIndex].name === preferred || candidates[exactIndex].name === dayLabel) {
      return candidates[exactIndex].name;
    }
  }

  if (target) {
    var matches = candidates.filter(function(candidate) {
      return dayLabelPartsMatch_(target, candidate.parts);
    });

    if (matches.length === 1) {
      return matches[0].name;
    }

    if (matches.length > 1 && target.weekdayEnglish) {
      var weekdayMatches = matches.filter(function(candidate) {
        var weekday = candidate.parts.weekdayEnglish || czechWeekdayToEnglish_(candidate.parts.weekdayCzech);
        return weekday === target.weekdayEnglish;
      });
      if (weekdayMatches.length === 1) {
        return weekdayMatches[0].name;
      }
    }
  }

  return preferred;
}

function ensureB4lScheduleHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(B4L_SCHEDULE_HEADERS_);
    return;
  }

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function(value) { return String(value).trim(); });

  if (headers.indexOf('Time') !== -1
      && headers.indexOf('Stage') !== -1
      && headers.indexOf('Artist') !== -1
      && headers.indexOf('Attendees') !== -1) {
    return;
  }

  sheet.insertRowsBefore(1, 1);
  sheet.getRange(1, 1, 1, B4L_SCHEDULE_HEADERS_.length)
    .setValues([B4L_SCHEDULE_HEADERS_]);
}

function readExistingScheduleKeys_(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return {};

  var headers = data[0].map(function(value) { return String(value).trim(); });
  var timeIndex = headers.indexOf('Time');
  var stageIndex = headers.indexOf('Stage');
  var artistIndex = headers.indexOf('Artist');

  if (timeIndex === -1 || stageIndex === -1 || artistIndex === -1) {
    return {};
  }

  var keys = {};
  for (var rowIndex = 1; rowIndex < data.length; rowIndex += 1) {
    var row = data[rowIndex];
    keys[scheduleRowKey_(row[timeIndex], row[stageIndex], row[artistIndex])] = true;
  }

  return keys;
}

function scheduleRowKey_(time, stage, artist) {
  return [
    normalizeTimeLabel_(String(time || '')),
    String(stage || '').trim().toLowerCase(),
    String(artist || '').trim().toLowerCase(),
  ].join('\u0000');
}

function normalizeTimeLabel_(value) {
  var match = /(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/.exec(String(value || '').trim());
  if (!match) return String(value || '').trim();
  return match[1] + '\u2013' + match[2];
}

function sortB4lEntries_(entries) {
  return entries.slice().sort(function(left, right) {
    var leftStart = sortStartMinutesForLabel_(left.time);
    var rightStart = sortStartMinutesForLabel_(right.time);
    if (leftStart !== rightStart) return leftStart - rightStart;
    if (left.stage !== right.stage) return left.stage.localeCompare(right.stage);
    return left.artist.localeCompare(right.artist);
  });
}

function sortStartMinutesForLabel_(timeLabel) {
  var parsed = parseTimeRange_(normalizeTimeLabel_(timeLabel));
  if (!parsed) return 0;

  if (parsed.startMinutes < B4L_PRE_DAWN_CUTOFF_MINUTES_) {
    return parsed.startMinutes + 24 * 60;
  }

  return parsed.startMinutes;
}

function stripHtmlTags_(value) {
  return String(value || '').replace(/<[^>]+>/g, '');
}

function decodeHtmlEntities_(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function normalizeInlineText_(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}
