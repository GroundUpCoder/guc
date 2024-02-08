import { Location, StaticError } from './error';

export type LiteralValue =
  null | boolean | number | string;

export type Operator =
  'FUNCTION-CALL' | 'LIST-DISPLAY' | 'MAP-DISPLAY' |
  'SUBSCRIPT' |
  'OR' | 'AND' | 'IF' |
  '==' | '!=' | '<' | '<=' | '>' | '>=' |
  '+' | '-' | '*' | '/' | '**' | '??';

export interface Visitor<R> {
  visitFile(e: File): R
  visitPass(e: Pass): R
  visitBlock(e: Block): R
  visitLiteral(e: Literal): R
  visitIdentifier(e: Identifier): R
  visitAssignment(e: Assignment): R
  visitDeclaration(e: Declaration): R
  visitOperation(e: Operation): R
  visitShowExpression(e: ShowExpression): R
  visitFunctionDisplay(e: FunctionDisplay): R
}

export interface Node {
  readonly location: Location;
  accept<R>(visitor: Visitor<R>): R;
}

export class File implements Node {
  readonly location: Location;
  readonly statements: Node[];
  readonly errors: StaticError[];
  constructor(location: Location, statements: Node[], errors: StaticError[]) {
    this.location = location;
    this.statements = statements;
    this.errors = errors;
  }
  accept<R>(visitor: Visitor<R>): R { return visitor.visitFile(this); }
}

export class Pass implements Node {
  readonly location: Location;
  readonly comments: string | null;
  constructor(location: Location, comments: string | null = null) {
    this.location = location;
    this.comments = comments;
  }
  accept<R>(visitor: Visitor<R>): R { return visitor.visitPass(this); }
}

export class Block implements Node {
  readonly location: Location;
  readonly statements: Node[];
  constructor(location: Location, statements: Node[]) {
    this.location = location;
    this.statements = statements;
  }
  accept<R>(visitor: Visitor<R>): R { return visitor.visitBlock(this); }
}

export class Literal implements Node {
  readonly location: Location;
  readonly value: LiteralValue;
  constructor(location: Location, value: LiteralValue) {
    this.location = location;
    this.value = value;
  }
  accept<R>(visitor: Visitor<R>): R { return visitor.visitLiteral(this); }
}

export class Identifier implements Node {
  readonly location: Location;
  readonly name: string;
  constructor(location: Location, name: string) {
    this.location = location;
    this.name = name;
  }
  accept<R>(visitor: Visitor<R>): R { return visitor.visitIdentifier(this); }
}

export class Assignment implements Node {
  readonly location: Location;
  readonly target: Identifier;
  readonly value: Node;
  constructor(location: Location, target: Identifier, value: Node) {
    this.location = location;
    this.target = target;
    this.value = value;
  }
  accept<R>(visitor: Visitor<R>): R { return visitor.visitAssignment(this); }
}

export class Declaration implements Node {
  readonly location: Location;
  readonly isConst: boolean;
  readonly identifier: Identifier;
  readonly suppressInlayHint: boolean;
  readonly value: Node;
  constructor(
    location: Location,
    isConst: boolean,
    identifier: Identifier,
    suppressInlayHint: boolean,
    value: Node) {
    this.location = location;
    this.isConst = isConst;
    this.identifier = identifier;
    this.suppressInlayHint = suppressInlayHint;
    this.value = value;
  }
  accept<R>(visitor: Visitor<R>): R { return visitor.visitDeclaration(this); }
}

export class Operation implements Node {
  readonly location: Location;
  readonly operator: Operator;
  readonly args: Node[];
  constructor(location: Location, operator: Operator, args: Node[]) {
    this.location = location;
    this.operator = operator;
    this.args = args;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitOperation(this);
  }
}

export class ShowExpression implements Node {
  readonly location: Location;
  readonly expression: Node;
  constructor(location: Location, expression: Node) {
    this.location = location;
    this.expression = expression;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitShowExpression(this);
  }
}

export class FunctionDisplay implements Node {
  readonly location: Location;
  readonly parameters: Identifier[];
  readonly body: Node;
  constructor(location: Location, parameters: Identifier[], body: Node) {
    this.location = location;
    this.parameters = parameters;
    this.body = body;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitFunctionDisplay(this);
  }
}
