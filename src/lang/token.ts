export interface Position {
  /** Line number, zero indexed */
  readonly line: number;

  /** Column number, zero indexed */
  readonly column: number;

  /** UTF-16 offset */
  readonly index: number;
};

export interface Range {
  readonly start: Position;
  readonly end: Position;
};

export const Keywords = [
  'and', 'class', 'const', 'def', 'do', 'elif', 'else', 'false', 'for',
  'function', 'if', 'nil', 'null', 'or', 'return', 'super', 'this', 'true',
  'var', 'while', 'as', 'assert', 'async', 'await', 'break',
  'continue', 'del', 'except', 'final', 'finally', 'from',
  'global', 'import', 'in', 'is', 'lambda', 'not', 'pass',
  'raise', 'static', 'then', 'trait', 'try', 'with', 'yield',
] as const;

export const Symbols = [
  // grouping tokens
  '(', ')',
  '[', ']',
  '{', '}',

  // other single character tokens
  ':', ';', ',', '.', '-', '+', '/', '%', '*', '#',
  '@', '|', '&', '^', '~', '?', '!', '=', '<', '>',

  // double character tokens
  '//', '**', '!=', '==', '<<', '<=', '>>', '>=', '??',
  '=>',
] as const;

export type TokenTypeKeyword = typeof Keywords[number];
export type TokenTypeSymbol = typeof Symbols[number];
export type TokenType = (
  'ERROR-UNRECOGNIZED-TOKEN' | 'ERROR-BAD-STRING-LITERAL' |
  'EOF' | 'COMMENT' | 'IDENTIFIER' | 'STRING' |
  'NUMBER' | 'NEWLINE' | TokenTypeKeyword | TokenTypeSymbol
);
export type TokenValue = number | string | null;

export const SymbolsMap: Map<string, TokenTypeSymbol> = new Map(
  Symbols.map(symbol => [symbol, symbol])
);

export const KeywordsMap: Map<string, TokenTypeKeyword> = new Map(
  Keywords.map(keyword => [keyword, keyword])
);

export interface Token {
  readonly range: Range;
  readonly type: TokenType;
  readonly value: TokenValue;
};
