import { KeywordsMap, SymbolsMap, Token } from "./token";

export function lex(s: string): Token[] {
  const len = s.length;
  const tokens: Token[] = [];
  let line = 0;
  let column = 0;
  let index = 0;

  while (true) {
    // skip whitespace
    while (index < len && /[ \t\r]/.test(s[index])) {
      index++;
      column++;
    }

    const tokenStartIndex = index;
    const tokenStart = { line, column, index: tokenStartIndex };

    if (index >= len) {
      // If the file does not end in a newline, artificially insert one
      if (tokens.length > 0 && tokens[tokens.length - 1].type !== 'NEWLINE') {
        tokens.push({
          range: { start: tokenStart, end: tokenStart },
          type: 'NEWLINE',
          value: null,
        });
      }
      tokens.push({
        range: { start: tokenStart, end: tokenStart },
        type: 'EOF',
        value: null,
      });
      break;
    }

    if (s.startsWith('//', index)) {
      while (index < len && s[index] !== '\n') {
        column++;
        index++;
      }
      tokens.push({
        range: { start: tokenStart, end: { line, column, index } },
        type: 'COMMENT',
        value: s.substring(tokenStartIndex, index),
      });
      continue;
    }

    if (s[index] === '\n') {
      index++;
      line++;
      column = 0;
      tokens.push({
        range: { start: tokenStart, end: { line, column, index } },
        type: 'NEWLINE',
        value: null,
      });
      continue;
    }

    // (multiline) raw string literal
    if (s.startsWith('r"', index) || s.startsWith("r'", index)) {
      const quote = s.startsWith('r"""', index) ? '"""' :
        s.startsWith("r'''") ? "'''" : s[index + 1];
      index += 1 + quote.length;
      column += 1 + quote.length;
      while (index < len && !s.startsWith(quote, index)) {
        if (s[index] === '\n') {
          line++;
          column = 0;
        } else {
          column++;
        }
        index++;
      }
      index += quote.length;
      column += quote.length;
      tokens.push({
        range: { start: tokenStart, end: { line, column, index } },
        type: 'STRING',
        value: s.substring(tokenStartIndex + 1 + quote.length, index - quote.length),
      });
      continue;
    }

    // string literal
    if (s[index] === '"' || s[index] === "'") {
      const quote = s[index];
      const escape = '\\' + quote;
      index++;
      column++;
      while (index < len && !s.startsWith(quote, index)) {
        if (s.startsWith(escape, index)) {
          index++;
          column++;
        }
        if (index < len && s[index] === '\n') {
          line++;
          column = 0;
        } else {
          column++;
        }
        index++;
      }
      index++;
      column++;
      const rawValue = quote === '"' ? s.substring(tokenStartIndex, index) :
        (`"${s.substring(tokenStartIndex + 1, index - 1).replace('"', '\\"')}"`);
      try {
        const value = JSON.parse(rawValue);
        tokens.push({
          range: { start: tokenStart, end: { line, column, index } },
          type: 'STRING',
          value: value,
        });
      } catch (e) {
        tokens.push({
          range: { start: tokenStart, end: { line, column, index } },
          type: 'ERROR-BAD-STRING-LITERAL',
          value: rawValue,
        })
      }
      continue;
    }

    // keywords and identifiers
    if (/[_a-zA-Z]/.test(s[index])) {
      while (index < len && /[_a-zA-Z0-9]/.test(s[index])) {
        index++;
        column++;
      }
      const value = s.substring(tokenStartIndex, index);
      const type = KeywordsMap.get(value) || 'IDENTIFIER';
      tokens.push({
        range: { start: tokenStart, end: { line, column, index } },
        type: type,
        value: type === 'IDENTIFIER' ? value : null,
      });
      continue;
    }

    // number
    if (/[0-9]/.test(s[index])) {
      const radix = s.startsWith('0x', index) ? 16 :
        s.startsWith('0o', index) ? 8 :
          s.startsWith('0b', index) ? 2 : 10;
      if (radix !== 10) {
        index += 2;
        column += 2;
      }
      const re = radix === 16 ? /[0-9a-fA-F]/ :
        radix === 8 ? /[0-8]/ :
          radix === 2 ? /[01]/ : /[0-9]/;
      while (index < len && re.test(s[index])) {
        index++;
        column++;
      }
      if (radix === 10) {
        // decimal (possibly non-integer)
        if (index < len && s[index] === '.') {
          index++;
          column++;
          while (index < len && /[0-9]/.test(s[index])) {
            index++;
            column++;
          }
        }
        if (index < len && (s[index] === 'e' || s[index] === 'E')) {
          index++;
          column++;
          if (index < len && (s[index] === '+' || s[index] === '-')) {
            index++;
            column++;
          }
          while (index < len && /[0-9]/.test(s[index])) {
            index++;
            column++;
          }
        }
        tokens.push({
          range: { start: tokenStart, end: { line, column, index } },
          type: 'NUMBER',
          value: parseFloat(s.substring(tokenStartIndex, index)),
        });
      } else {
        // integer
        tokens.push({
          range: { start: tokenStart, end: { line, column, index } },
          type: 'NUMBER',
          value: parseInt(s.substring(tokenStartIndex, index), radix),
        });
      }
      continue;
    }

    // 2 character symbols
    if (index + 1 < len) {
      const sym2 = SymbolsMap.get(s.substring(index, index + 2));
      if (sym2) {
        index += 2;
        column += 2;
        tokens.push({
          range: { start: tokenStart, end: { line, column, index } },
          type: sym2,
          value: null,
        });
        continue;
      }
    }

    // 1 character symbols
    const sym1 = SymbolsMap.get(s[index]);
    if (sym1) {
      index++;
      column++;
      tokens.push({
        range: { start: tokenStart, end: { line, column, index } },
        type: sym1,
        value: null,
      });
      continue;
    }

    // unrecognized token
    while (index < len && !/[ \t\r\n]/.test(s[index])) {
      index++;
      column++;
    }
    tokens.push({
      range: { start: tokenStart, end: { line, column, index } },
      type: 'ERROR-UNRECOGNIZED-TOKEN',
      value: s.substring(tokenStartIndex, index),
    });
  }

  return tokens;
}
