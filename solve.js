// Fast drop-in for make.fun's csv-reader 1.0.0 (csv-reader-speed-01-run-20261121).
// Written from the reference's stated policy (RULES.txt / baselines/csv-reader/vendor/csv-reader/index.js),
// not copied from it: same answers on every input, faster by scanning with native
// indexOf/regex searches and building each field from slices instead of one
// character at a time, with a fast path for record lines that hold no quote
// and no stray CR (one native split instead of a field parse each).
//
// Policy (csv-reader 1.0.0):
// - U+FEFF at the very start is dropped.
// - A record ends at LF or CRLF; a line left with no characters is no record.
// - Outside quotes a CR not followed by LF is dropped (error stray_cr).
// - A field opening with a quote runs to the next quote that is not doubled;
//   "" inside it is one quote, each CRLF or lone CR inside it reads as LF;
//   what follows its closing quote, up to the next comma or line break, is
//   appended as it stands (quote_junk, when the field ends); a quote that
//   never closes is a literal character and the text after it is read again
//   as unquoted (unterminated_quote).
// - A quote inside an unquoted field is a literal character.
// - Fields stay strings, never trimmed or converted.
// - columns is the first record when header is true, else null; rows holds
//   the records after it, each padded with "" (short_row, with fields: its
//   count) or cut (long_row, with extra: the cut fields) to the first
//   record's width.
// - Each error is {code, line, row}, in the order met; line is the 1-based
//   line its record starts on, row its record's index in rows (null for the
//   header).

const Q = 34; // "
const COMMA = 44; // ,
const LF = 10; // \n
const CR = 13; // \r
const BOM = 0xfeff;

const ENDED_COMMA = 0;
const ENDED_BREAK = 1;
const ENDED_END = 2;

/** Next comma, CR or LF at or after lastIndex. */
const DELIM = /[,\r\n]/g;
/** Any line break inside a quoted segment. */
const HAS_BREAK = /[\r\n]/;

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const n = text.length;
  let pos = text.charCodeAt(0) === BOM ? 1 : 0;
  let line = 1;

  // The record being read: the line it starts on and the index in rows it
  // takes (null: the header). Errors raised while reading it carry these.
  let recordLine = 1;
  let recordRow = null;

  // The field just read: its value, how it ended, and how many characters
  // were kept onto it (the initial value is not counted).
  let fValue = '';
  let fEnded = ENDED_END;
  let fAdded = 0;

  // Reads unquoted characters onto `value` up to the next comma or line
  // break. A CR not followed by LF is dropped (stray_cr).
  function readUnquoted(value) {
    let added = 0;
    for (;;) {
      DELIM.lastIndex = pos;
      const m = DELIM.exec(text);
      if (m === null) {
        if (pos < n) {
          value += text.slice(pos, n);
          added += n - pos;
        }
        pos = n;
        fValue = value;
        fEnded = ENDED_END;
        fAdded = added;
        return;
      }
      const i = m.index;
      const c = text.charCodeAt(i);
      if (c === COMMA) {
        if (i > pos) {
          value += text.slice(pos, i);
          added += i - pos;
        }
        pos = i + 1;
        fValue = value;
        fEnded = ENDED_COMMA;
        fAdded = added;
        return;
      }
      if (c === LF) {
        if (i > pos) {
          value += text.slice(pos, i);
          added += i - pos;
        }
        pos = i + 1;
        line += 1;
        fValue = value;
        fEnded = ENDED_BREAK;
        fAdded = added;
        return;
      }
      // CR: a line break when followed by LF, else a stray CR, dropped.
      if (text.charCodeAt(i + 1) === LF) {
        if (i > pos) {
          value += text.slice(pos, i);
          added += i - pos;
        }
        pos = i + 2;
        line += 1;
        fValue = value;
        fEnded = ENDED_BREAK;
        fAdded = added;
        return;
      }
      errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
      if (i > pos) {
        value += text.slice(pos, i);
        added += i - pos;
      }
      pos = i + 1;
    }
  }

  // Reads a quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    let value = '';
    let parts = null; // pieces kept when a doubled quote or a line break splits the field
    let cur = pos + 1; // start of the segment still to scan
    for (;;) {
      const q = text.indexOf('"', cur);
      if (q === -1) {
        // The quote never closes: it is a literal character, and the text
        // after it is read again as an unquoted field.
        pos = open + 1;
        line = openLine;
        errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
        readUnquoted('"');
        return;
      }
      const seg = text.slice(cur, q);
      if (!HAS_BREAK.test(seg)) {
        if (text.charCodeAt(q + 1) === Q) {
          // A doubled quote: one quote, and the field goes on.
          parts = parts === null ? seg + '"' : parts + seg + '"';
          cur = q + 2;
          continue;
        }
        value = parts === null ? seg : parts + seg;
        pos = q + 1;
        break;
      }
      // A line break inside the quotes: walk this segment alone, counting
      // every LF, CRLF and lone CR and reading each as one LF.
      let s = '';
      for (let i = cur; i < q; i++) {
        const c = text.charCodeAt(i);
        if (c === CR) {
          s += '\n';
          line += 1;
          if (text.charCodeAt(i + 1) === LF) i += 1;
        } else {
          if (c === LF) line += 1;
          s += text[i];
        }
      }
      if (text.charCodeAt(q + 1) === Q) {
        parts = parts === null ? s + '"' : parts + s + '"';
        cur = q + 2;
        continue;
      }
      value = parts === null ? s : parts + s;
      pos = q + 1;
      break;
    }
    if (pos >= n) {
      fValue = value;
      fEnded = ENDED_END;
      fAdded = 0;
      return;
    }
    const c = text.charCodeAt(pos);
    if (c === COMMA) {
      pos += 1;
      fValue = value;
      fEnded = ENDED_COMMA;
      fAdded = 0;
      return;
    }
    if (c === LF) {
      pos += 1;
      line += 1;
      fValue = value;
      fEnded = ENDED_BREAK;
      fAdded = 0;
      return;
    }
    if (c === CR && text.charCodeAt(pos + 1) === LF) {
      pos += 2;
      line += 1;
      fValue = value;
      fEnded = ENDED_BREAK;
      fAdded = 0;
      return;
    }
    // What follows the closing quote is appended as it stands, up to the
    // next comma or line break.
    readUnquoted(value);
    if (fAdded > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
  }

  // Files one record's fields: the header, or a row padded/cut to the
  // first record's width. A line left with no characters is no record.
  function finishRecord(fields, quoted) {
    if (fields.length === 1 && fields[0] === '' && !quoted) return;
    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      return;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === LF) {
        pos += 1;
        line += 1;
      } else if (c === CR && text.charCodeAt(pos + 1) === LF) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;

    // Fast path: the record's line holds no quote and no stray CR, so it
    // holds no quoted field and ends at its line break. One native split
    // reads the whole record. Anything else falls through to the field
    // parser below, which is the only reader of quotes and stray CRs.
    const le = text.indexOf('\n', pos);
    let lineEnd = le === -1 ? n : le;
    if (le !== -1 && lineEnd > pos && text.charCodeAt(lineEnd - 1) === CR) lineEnd -= 1;
    const lineSlice = text.slice(pos, lineEnd);
    if (lineSlice.indexOf('"') === -1 && lineSlice.indexOf('\r') === -1) {
      finishRecord(lineSlice.split(','), false);
      if (le === -1) {
        pos = n;
      } else {
        pos = le + 1;
        line += 1;
      }
      continue;
    }

    const fields = [];
    let quoted;
    do {
      quoted = text.charCodeAt(pos) === Q;
      if (quoted) readQuoted();
      else readUnquoted('');
      fields.push(fValue);
    } while (fEnded === ENDED_COMMA);
    finishRecord(fields, quoted);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
