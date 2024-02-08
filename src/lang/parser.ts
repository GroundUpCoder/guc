import { Uri } from 'vscode';
import * as ast from './ast';
import { lex } from './lexer';
import { Position, Token, TokenType } from './token';
import { Location, StaticError } from './error';

const PrecList: TokenType[][] = [
  [],
  ['??'],
  ['or'],
  ['and'],
  [],        // precedence for unary operator 'not'
  ['==', '!=', '<', '>', '<=', '>=', 'in', 'not', 'is', 'as', '!'],
  ['<<', '>>'],
  ['&'],
  ['^'],
  ['|'],
  ['+', '-'],
  ['*', '/', '//', '%'],
  [],        // precedence for unary operators '-', '+' and '~'
  ['**'],
  ['.', '(', '['],
];
const PrecMap: Map<TokenType, number> = new Map();
for (let i = 0; i < PrecList.length; i++) {
  for (const tokenType of PrecList[i]) {
    PrecMap.set(tokenType, i);
  }
}
const PREC_UNARY_NOT = PrecMap.get('and')! + 1;
const PREC_UNARY_MINUS = PrecMap.get('*')! + 1;
const PREC_PRIMARY = PrecMap.get('.')! + 1;
const BinopOperatorMap: Map<TokenType, ast.Operator> = new Map([
  ['+', '+'],
  ['-', '-'],
  ['*', '*'],
  ['/', '/'],
  ['**', '**'],
  ['and', 'AND'],
  ['or', 'OR'],
  ['==', '=='],
  ['!=', '!='],
  ['<', '<'],
  ['<=', '<='],
  ['>', '>'],
  ['>=', '>='],
  ['??', '??'],
]);

export function parse(uri: Uri, s: string): ast.File {
  const errors: StaticError[] = [];
  const tokens = lex(s);
  let i = 0;

  function eof() {
    return i >= tokens.length || tokens[i].type === 'EOF';
  }

  function at(type: TokenType): boolean {
    return tokens[i].type === type;
  }

  function consume(type: TokenType): boolean {
    if (at(type)) {
      i++;
      return true;
    }
    return false;
  }

  function expect(type: TokenType): Token {
    if (at(type)) {
      return tokens[i++];
    }
    throw new StaticError(
      { uri, range: tokens[i].range },
      `Expected ${type} but got ${tokens[i].type}`);
  }

  function expectStatementDelimiter(): void {
    if (!at('}') && !consume('NEWLINE')) {
      expect(';');
    }
  }

  function parseIdentifier(): ast.Identifier {
    const tok = expect('IDENTIFIER');
    return new ast.Identifier(
      { uri, range: tok.range }, tok.value as string);
  }

  function parseDeclaration(): ast.Declaration {
    const start = tokens[i].range.start;
    const isConst = consume('const');
    if (!isConst) expect('var');
    const identifier = parseIdentifier();
    const suppressInlayHint = consume(':');
    expect('=');
    const value = parseExpression();
    expectStatementDelimiter();
    const end = value.location.range.end;
    return new ast.Declaration(
      { uri, range: { start, end } },
      isConst, identifier, suppressInlayHint, value);
  }

  function parseBlock(): ast.Block {
    const start = expect('{').range.start;
    const statements: ast.Node[] = [];
    while (consume('NEWLINE'));
    while (!eof() && !at('}')) {
      try {
        statements.push(parseStatement());
      } catch (e) {
        // If we encounter a syntax error, try to recover
        // by skipping the rest of the line
        if (e instanceof StaticError) {
          errors.push(e);
          while (!eof() && !at('NEWLINE')) {
            i++;
          }
          consume('NEWLINE');
        } else {
          throw e;
        }
      }
      while (consume('NEWLINE'));
    }
    const end = expect('}').range.end;
    return new ast.Block({ uri, range: { start, end } }, statements);
  }

  function parseIf(): ast.Node {
    const start = expect('if').range.start;
    const condition = parseExpression();
    const body = parseBlock();
    const other = consume('else') ?
      (at('if') ? parseIf() : parseBlock()) :
      new ast.Literal(body.location, null);
    const end = other.location.range.end;
    const location = { uri, range: { start, end } };
    return new ast.Operation(location, 'IF', [condition, body, other]);
  }

  function parseStatement(): ast.Node {
    switch (tokens[i].type) {
      case ';':
      case 'NEWLINE': {
        const range = tokens[i].range;
        expectStatementDelimiter();
        return new ast.Pass({ uri, range: range });
      }
      case 'var':
      case 'const':
        return parseDeclaration();
      case 'if':
        return parseIf();
      case '{':
        return parseBlock();
      case '#': {
        i++;
        const expression = parseExpression();
        expectStatementDelimiter();
        return expression;
      }
      case 'COMMENT': {
        const tok = tokens[i++];
        expectStatementDelimiter();
        return new ast.Pass({ uri, range: tok.range }, tok.value as string);
      }
    }
    const start = tokens[i].range.start;
    const expression = parseExpression();
    const end = tokens[i - 1].range.end;
    expectStatementDelimiter();
    return new ast.ShowExpression({ uri, range: { start, end } }, expression);
  }

  function parsePrefix(): ast.Node {
    const tloc: Location = { uri, range: tokens[i].range };
    const start = tloc.range.start;
    const tokenType = tokens[i].type;
    switch (tokenType) {
      case 'IDENTIFIER': {
        i++;
        const identifier = new ast.Identifier(tloc, tokens[i - 1].value as string);
        if (consume('=>')) {
          while (consume('NEWLINE'));
          const body = parseExpression();
          const end = body.location.range.end;
          return new ast.FunctionDisplay({ uri, range: { start, end } }, [identifier], body);
        } else if (consume('=')) {
          const rhs = parseExpression();
          const end = rhs.location.range.end;
          return new ast.Assignment({ uri, range: { start, end } }, identifier, rhs);
        }
        return identifier;
      }
      case 'STRING':
      case 'NUMBER':
        i++;
        return new ast.Literal(tloc, tokens[i - 1].value);
      case 'null':
        i++;
        return new ast.Literal(tloc, null);
      case 'true':
        i++;
        return new ast.Literal(tloc, true);
      case 'false':
        i++;
        return new ast.Literal(tloc, false);
      case 'if': {
        i++;
        const condition = parseExpression();
        expect('then');
        const lhs = parseExpression();
        expect('else');
        const rhs = parseExpression();
        const end = rhs.location.range.end;
        return new ast.Operation(
          { uri, range: { start, end } }, 'IF', [condition, lhs, rhs]);
      }
      case 'do': {
        i++;
        return parseBlock();
      }
      case '+':
      case '-': {
        i++;
        const arg = parsePrec(PREC_UNARY_MINUS);
        const end = arg.location.range.end;
        return new ast.Operation(tloc, tokenType, [arg]);
      }
      case '[': {
        i++;
        const elements = parseArgsBody(']');
        const end = expect(']').range.end;
        return new ast.Operation({ uri, range: { start, end } }, 'LIST-DISPLAY', elements);
      }
      case '{': {
        i++;
        const values: ast.Node[] = []; // should always be a multiple of 2
        while (consume('NEWLINE'));
        while (!eof() && !at('}')) {
          while (consume('NEWLINE'));
          values.push(parseExpression());
          while (consume('NEWLINE'));
          expect(':');
          while (consume('NEWLINE'));
          values.push(parseExpression());
          if (!consume(',')) {
            break;
          }
        }
        const end = expect('}').range.end;
        return new ast.Operation({ uri, range: { start, end } }, 'MAP-DISPLAY', values);
      }
      case '(': {
        i++;
        const j = i;
        while (consume('IDENTIFIER') || consume(','));
        const atLambda = consume(')') && at('=>');
        i = j;
        if (atLambda) {
          const parameters: ast.Identifier[] = [];
          while (!eof() && !at(')')) {
            parameters.push(parseIdentifier());
            if (!consume(',')) {
              break;
            }
          }
          expect(')');
          expect('=>');
          while (consume('NEWLINE'));
          const body = at('{') ? parseBlock() : parseExpression();
          const end = body.location.range.end;
          return new ast.FunctionDisplay(
            { uri, range: { start, end } }, parameters, body);
        }
        const innerExpression = parseExpression();
        expect(')');
        return innerExpression;
      }
    }
    throw new StaticError(tloc, `Expected expression but got ${JSON.stringify(tokens[i].type)}`);
  }

  function parseArgsBody(closingToken: TokenType): ast.Node[] {
    const args: ast.Node[] = [];
    while (consume('NEWLINE'));
    while (!eof() && !at(closingToken)) {
      while (consume('NEWLINE'));
      args.push(parseExpression());
      while (consume('NEWLINE'));
      if (!consume(',')) {
        break;
      }
    }
    return args;
  }

  function parseInfix(lhs: ast.Node, start: Position): ast.Node {
    const tokenType = tokens[i].type;
    const precedence = PrecMap.get(tokenType);
    if (!precedence) {
      throw new StaticError(
        { uri, range: tokens[i].range },
        `Expected infix expression token but found ${tokens[i].type}`);
    }
    switch (tokenType) {
      case '(': {
        i++;
        while (consume('NEWLINE'));
        const args = parseArgsBody(')');
        const end = expect(')').range.end;
        return new ast.Operation(
          { uri, range: { start, end } },
          'FUNCTION-CALL',
          [lhs].concat(...args));
      }
      case '[': {
        i++;
        while (consume('NEWLINE'));
        const index = parseExpression();
        const end = expect(']').range.end;
        return new ast.Operation(
          { uri, range: { start, end } },
          'SUBSCRIPT',
          [lhs, index]);
      }
    }
    const operator = BinopOperatorMap.get(tokenType);
    if (operator) {
      i++;
      while (consume('NEWLINE'));
      const rightAssociative = operator === '**';
      const rhs = rightAssociative ?
        parsePrec(precedence) :
        parsePrec(precedence + 1);
      const end = rhs.location.range.end;
      return new ast.Operation({ uri, range: { start, end } }, operator, [lhs, rhs]);
    }
    throw new StaticError(
      { uri, range: tokens[i].range },
      `Expected infix expression token but found ${tokens[i].type}`);
  }

  function parsePrec(precedence: number): ast.Node {
    const start = tokens[i].range.start;
    let expr = parsePrefix();
    while (precedence <= (PrecMap.get(tokens[i].type) || 0)) {
      expr = parseInfix(expr, start);
    }
    return expr;
  }

  function parseExpression(): ast.Node {
    return parsePrec(1);
  }

  const fileStatements: ast.Node[] = [];
  while (!eof()) {
    try {
      fileStatements.push(parseStatement());
    } catch (e) {
      // If we encounter a syntax error, try to recover
      // by skipping the rest of the line
      if (e instanceof StaticError) {
        errors.push(e);
        while (!eof() && !at('NEWLINE')) {
          i++;
        }
        consume('NEWLINE');
      } else {
        throw e;
      }
    }
  }

  return new ast.File({
    uri,
    range: {
      start: tokens[0].range.start,
      end: tokens[tokens.length - 1].range.end,
    }
  }, fileStatements, errors);
}
