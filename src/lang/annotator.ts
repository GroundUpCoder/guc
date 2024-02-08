import { Uri } from 'vscode';
import * as ast from './ast'
import { Location, StaticError } from './error';
import {
  StaticValue, UnknownValue, KnownValue, HTML, formatValue,
  reprValue, strValue
} from './value';

export class Variable {
  /** location of declaration */
  readonly location: Location;
  readonly isConst: boolean;
  readonly identifier: ast.Identifier;
  readonly suppressInlayHint: boolean;
  staticValue: StaticValue;

  constructor(
    location: Location,
    isConst: boolean,
    identifier: ast.Identifier,
    suppressInlayHint: boolean,
    staticValue: StaticValue) {
    this.location = location;
    this.isConst = isConst;
    this.identifier = identifier;
    this.suppressInlayHint = suppressInlayHint;
    this.staticValue = staticValue;
  }
}

export class Reference {
  readonly identifier: ast.Identifier;
  readonly variable: Variable;

  constructor(identifier: ast.Identifier, variable: Variable) {
    this.identifier = identifier;
    this.variable = variable;
  }
}

export class ShowValue {
  readonly location: Location;
  readonly value: StaticValue;

  constructor(location: Location, value: StaticValue) {
    this.location = location;
    this.value = value;
  }
}

export interface FileAnnotation {
  readonly errors: StaticError[];
  readonly variables: Variable[];
  readonly references: Reference[];
  readonly showValues: ShowValue[];
}

type Scope = { [key: string]: Variable | undefined };

export const BUILTIN_LOCATION: Location = {
  uri: Uri.parse(''),
  range: { start: { index: 0, line: 0, column: 0 }, end: { index: 0, line: 0, column: 0 } },
};

function newRootScope(): Scope {
  const scope: Scope = Object.create(null);
  function addFunc(f: (args: StaticValue[]) => StaticValue) {
    scope[f.name] = new Variable(
      BUILTIN_LOCATION, true, new ast.Identifier(BUILTIN_LOCATION, f.name), true, f);
  }
  addFunc(function len(args: StaticValue[]): StaticValue {
    if (args.length < 1) {
      return UnknownValue;
    }
    const value = args[0];
    if (typeof value === 'string') {
      return value.length;
    }
    if (Array.isArray(value)) {
      return value.length;
    }
    if (value instanceof Map) {
      return value.size;
    }
    return UnknownValue;
  });
  addFunc(function sum(args: StaticValue[]): StaticValue {
    if (args.length === 1) {
      const args0 = args[0];
      if (Array.isArray(args0)) {
        let total = 0;
        for (const arg of args0) {
          if (typeof arg === 'number') {
            total += arg;
          } else {
            return UnknownValue;
          }
        }
        return total;
      }
      return UnknownValue;
    } else {
      let total = 0;
      for (const arg of args) {
        if (typeof arg === 'number') {
          total += arg;
        } else {
          return UnknownValue;
        }
      }
      return total;
    }
  });
  addFunc(function range(args: StaticValue[]): StaticValue {
    let start: number = 0, end: number = 0, step: number = 1;
    switch (args.length) {
      case 1: {
        const args0 = args[0];
        if (typeof args0 === 'number') {
          end = args0;
          break;
        }
        return UnknownValue;
      }
      case 2: {
        const args0 = args[0];
        const args1 = args[1];
        if (typeof args0 === 'number' && typeof args1 === 'number') {
          start = args0;
          end = args1;
          break;
        }
        return UnknownValue;
      }
      case 3: {
        const args0 = args[0];
        const args1 = args[1];
        const args2 = args[2];
        if (typeof args0 === 'number' && typeof args1 === 'number' && typeof args2 === 'number') {
          start = args0;
          end = args1;
          step = args2;
          break;
        }
        return UnknownValue;
      }
      default:
        return UnknownValue;
    }
    const ret: number[] = [];
    if (step > 0) {
      for (let i = start; i < end; i += step) {
        ret.push(i);
      }
    } else {
      for (let i = start; i > end; i += step) {
        ret.push(i);
      }
    }
    return ret;
  });
  addFunc(function html(args: StaticValue[]): StaticValue {
    if (args.length === 1) {
      if (typeof args[0] === 'string') {
        return new HTML(args[0]);
      }
    }
    return UnknownValue;
  });
  addFunc(function str(args: StaticValue[]): StaticValue {
    if (args.length === 1) {
      return strValue(args[0]);
    }
    return UnknownValue;
  });
  addFunc(function repr(args: StaticValue[]): StaticValue {
    if (args.length === 1) {
      return reprValue(args[0]);
    }
    return UnknownValue;
  });
  addFunc(function join(args: StaticValue[]): StaticValue {
    if (args.length === 2) {
      if (typeof args[0] === 'string' && Array.isArray(args[1])) {
        return args[1].map(arg => strValue(arg)).join(args[0]);
      }
    }
    return UnknownValue;
  });
  return scope;
}

class Annotator implements ast.Visitor<StaticValue> {
  private scope: Scope = newRootScope();
  private errors: StaticError[] = [];
  private variables: Variable[] = [];
  private references: Reference[] = [];
  private showValues: ShowValue[] = [];
  private todos: (() => void)[] = [];
  private staticScopeDepth: number = 0;
  private callstackDepth: number = 0;
  annotate(e: ast.File): FileAnnotation {
    this.visitFile(e);
    let todo = null;
    while (todo = this.todos.pop()) {
      todo();
    }
    return {
      errors: this.errors,
      variables: this.variables,
      references: this.references,
      showValues: this.showValues,
    };
  }
  error(location: Location, message: string) {
    if (this.callstackDepth === 0) {
      this.errors.push(new StaticError(location, message));
    }
  }
  visitFile(e: ast.File): StaticValue {
    for (const statement of e.statements) {
      statement.accept(this);
    }
    return UnknownValue;
  }
  visitPass(e: ast.Pass): StaticValue { return UnknownValue; }
  visitBlock(e: ast.Block): StaticValue {
    let value: StaticValue = UnknownValue;
    for (const statement of e.statements) {
      value = statement.accept(this);
    }
    return value;
  }
  visitLiteral(e: ast.Literal): StaticValue { return e.value; }
  visitIdentifier(e: ast.Identifier): StaticValue {
    const variable = this.scope[e.name];
    if (!variable) {
      this.error(e.location, `Variable ${e.name} not found`);
      return UnknownValue;
    }
    if (this.callstackDepth === 0) {
      this.references.push(new Reference(e, variable));
    }
    return variable.staticValue;
  }
  visitAssignment(e: ast.Assignment): StaticValue {
    const variable = this.scope[e.target.name];
    if (!variable) {
      this.error(e.location, `Variable ${e.target.name} not found`);
      return UnknownValue;
    }
    if (variable.isConst) {
      this.error(e.location, `Variable ${e.target.name} is const`);
      return UnknownValue;
    }
    if (this.callstackDepth === 0) {
      this.references.push(new Reference(e.target, variable));
    }
    const value = e.value.accept(this);
    return variable.staticValue = value;
  }
  private valueIsObvious(e: ast.Node): boolean {
    if (e instanceof ast.Literal) {
      return true;
    }
    if (e instanceof ast.Identifier) {
      const variable = this.scope[e.name];
      if (!variable || !variable.isConst || variable.staticValue === UnknownValue) {
        return false;
      }
      return true;
    }
    if (e instanceof ast.Operation) {
      if (e.operator === 'FUNCTION-CALL') {
        return false;
      }
      return e.args.every(c => this.valueIsObvious(c));
    }
    return false;
  }
  visitDeclaration(e: ast.Declaration): StaticValue {
    const value = e.value.accept(this);
    const variable = new Variable(
      e.location,
      e.isConst,
      e.identifier,
      e.suppressInlayHint || this.valueIsObvious(e.value),
      this.callstackDepth === 0 ? value : UnknownValue);
    if (this.callstackDepth === 0) {
      this.variables.push(variable);
    }
    this.scope[e.identifier.name] = variable;
    return value;
  }
  visitOperation(e: ast.Operation): StaticValue {
    if (e.operator === 'AND' || e.operator === 'OR') {
      if (e.args.length === 2) {
        const lhs = e.args[0].accept(this);
        if (lhs === UnknownValue) {
          // lhs result is unknown - annotate both branches
          // and return Unknown
          e.args[1].accept(this);
          return UnknownValue;
        }
        // avoid looking at rhs if we we can short circuit.
        return lhs ?
          (e.operator === 'OR' ? lhs : e.args[1].accept(this)) :
          (e.operator === 'OR' ? e.args[1].accept(this) : lhs);
      }
      this.error(
        e.location,
        `AND and OR operators require exactly 2 arguments but got ${e.args.length}`);
      return UnknownValue;
    }
    if (e.operator === 'IF') {
      if (e.args.length === 3) {
        const condition = e.args[0].accept(this);
        if (condition === UnknownValue) {
          // condition result is unknown - annotate both branches
          // and return Unknown
          e.args[1].accept(this);
          e.args[2].accept(this);
          return UnknownValue;
        }
        // If we know the condition value, we can avoid looking
        // at the branch we don't need to look at.
        return e.args[condition ? 1 : 2].accept(this);
      }
      this.error(
        e.location,
        `IF operator requires exactly 3 arguments but got ${e.args.length}`);
      return UnknownValue;
    }
    if (e.operator === '??') {
      if (e.args.length === 2) {
        const lhs = e.args[0].accept(this);
        if (lhs === UnknownValue) {
          e.args[1].accept(this);
          return UnknownValue;
        }
        return lhs === null ? e.args[1].accept(this) : lhs;
      }
      this.error(
        e.location,
        `'??' operator requires exactly 2 arguments but got ${e.args.length}`);
      return UnknownValue;
    }
    const args = e.args.map(arg => arg.accept(this));
    switch (e.operator) {
      case 'FUNCTION-CALL': {
        const f = args[0];
        if (typeof f === 'function' && args.every(a => a !== UnknownValue)) {
          return f(args.slice(1) as KnownValue[]);
        }
        return UnknownValue;
      }
      case 'LIST-DISPLAY':
        return args;
      case 'MAP-DISPLAY': {
        const map = new Map<KnownValue, StaticValue>();
        for (let i = 0; i + 1 < args.length; i += 2) {
          const key = args[i];
          const value = args[i + 1];
          if (key === UnknownValue) {
            return UnknownValue;
          }
          map.set(key, value);
        }
        return map;
      }
      case 'SUBSCRIPT': {
        if (args.length === 2) {
          const [owner, index] = args;
          if (owner === UnknownValue || index === UnknownValue) {
            return UnknownValue;
          }
          if (Array.isArray(owner)) {
            if (typeof index === 'number') {
              const ret = owner[index];
              if (ret === undefined) {
                this.error(
                  e.location,
                  `Invalid index (i = ${index}, length = ${owner.length})`);
                return UnknownValue;
              }
              return ret;
            }
          }
          if (owner instanceof Map) {
            const ret = owner.get(index);
            if (ret === undefined) {
              this.error(e.location, `Key not found in map`);
              return UnknownValue;
            }
            return ret;
          }
        }
        this.error(
          e.location,
          `Unrecognized arguments for ${e.operator}: ` +
          `${args.map(arg => formatValue(arg)).join(',')}`);
        return UnknownValue;
      }
      case '+': {
        switch (args.length) {
          case 1:
            return args[0];
          case 2:
            if (typeof args[0] === 'number' && typeof args[1] === 'number') {
              return args[0] + args[1];
            }
            if (typeof args[0] === 'string' && typeof args[1] === 'string') {
              return args[0] + args[1];
            }
            return UnknownValue;
        }
        return UnknownValue;
      }
      case '-': {
        switch (args.length) {
          case 1:
            if (typeof args[0] === 'number') {
              return -args[0];
            }
            return UnknownValue;
          case 2:
            if (typeof args[0] === 'number' && typeof args[1] === 'number') {
              return args[0] - args[1];
            }
            return UnknownValue;
        }
        return UnknownValue;
      }
      case '*': {
        switch (args.length) {
          case 2:
            if (typeof args[0] === 'number' && typeof args[1] === 'number') {
              return args[0] * args[1];
            }
        }
        return UnknownValue;
      }
      case '/': {
        switch (args.length) {
          case 2:
            if (typeof args[0] === 'number' && typeof args[1] === 'number') {
              return args[0] / args[1];
            }
        }
        return UnknownValue;
      }
      case '**': {
        switch (args.length) {
          case 2:
            if (typeof args[0] === 'number' && typeof args[1] === 'number') {
              return args[0] ** args[1];
            }
        }
        return UnknownValue;
      }
      case '==': {
        switch (args.length) {
          case 2:
            return args[0] === args[1];
        }
        return UnknownValue;
      }
      case '<': {
        switch (args.length) {
          case 2:
            if (typeof args[0] === 'number' && typeof args[1] === 'number') {
              return args[0] < args[1];
            }
        }
        return UnknownValue;
      }
      case '<=': {
        switch (args.length) {
          case 2:
            if (typeof args[0] === 'number' && typeof args[1] === 'number') {
              return args[0] <= args[1];
            }
        }
        return UnknownValue;
      }
      case '>': {
        switch (args.length) {
          case 2:
            if (typeof args[0] === 'number' && typeof args[1] === 'number') {
              return args[0] > args[1];
            }
        }
        return UnknownValue;
      }
      case '>=': {
        switch (args.length) {
          case 2:
            if (typeof args[0] === 'number' && typeof args[1] === 'number') {
              return args[0] >= args[1];
            }
        }
        return UnknownValue;
      }
    }
    this.error(e.location, `Unrecognized operator ${e.operator}`);
    return UnknownValue;
  }
  visitShowExpression(e: ast.ShowExpression): StaticValue {
    const value = e.expression.accept(this);
    if (this.callstackDepth === 0 && this.staticScopeDepth === 0) {
      this.showValues.push(new ShowValue(e.location, value));
    }
    return value;
  }
  visitFunctionDisplay(e: ast.FunctionDisplay): StaticValue {
    const outerScope = this.scope;
    this.todos.push(() => {
      const scopeForAnnotation: Scope = Object.create(outerScope);
      this.scope = scopeForAnnotation;
      for (let i = 0; i < e.parameters.length; i++) {
        scopeForAnnotation[e.parameters[i].name] = new Variable(
          e.parameters[i].location, true, e.parameters[i], true, UnknownValue);
      }
      this.staticScopeDepth++;
      e.body.accept(this);
      this.staticScopeDepth--;
      this.scope = outerScope;
    });
    return (args: StaticValue[]): StaticValue => {
      const oldScope = this.scope;
      const innerScope: Scope = Object.create(outerScope);
      for (let i = 0; i < args.length && i < e.parameters.length; i++) {
        innerScope[e.parameters[i].name] = new Variable(
          e.parameters[i].location, true, e.parameters[i], true, args[i]);
      }
      for (let i = args.length; i < e.parameters.length; i++) {
        innerScope[e.parameters[i].name] = new Variable(
          e.parameters[i].location, true, e.parameters[i], true, UnknownValue);
      }
      this.scope = innerScope;
      this.callstackDepth++;
      const value = e.body.accept(this);
      this.callstackDepth--;
      this.scope = oldScope;
      return value;
    };
  }
}

export function annotate(e: ast.File): FileAnnotation {
  return new Annotator().annotate(e);
}
