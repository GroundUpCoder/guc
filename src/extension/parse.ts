import * as vscode from 'vscode';
import * as ast from '../lang/ast';
import { getSelectionOrAllText, writeToNewEditor } from './utils';
import * as guc from '../lang/guc';


class TreePrinter implements ast.Visitor<void> {
  out: string = '';
  depth: number = 0;
  private indent() {
    this.out += '\n' + '  '.repeat(this.depth);
  }
  visitFile(e: ast.File): void {
    this.out += `FILE ${e.location.uri}`;
    this.indent();
    this.depth++;
    this.out += `STATEMENTS (${e.statements.length})`;
    for (const stmt of e.statements) {
      stmt.accept(this);
    }
    this.out += `\nERRORS (${e.errors.length})`;
    for (const error of e.errors) {
      this.indent();
      this.out += `${error.message}` +
        `@ ${error.location.range.start.line + 1}:${error.location.range.start.column + 1}` +
        ` - ${error.location.range.end.line + 1}:${error.location.range.end.column + 1}`;
    }
  }
  visitPass(_: ast.Pass): void {
    this.indent();
    this.out += `PASS`;
  }
  visitBlock(e: ast.Block): void {
    this.indent();
    this.depth++;
    this.out += `BLOCK`;
    for (const stmt of e.statements) {
      stmt.accept(this);
    }
    this.depth--;
  }
  visitLiteral(e: ast.Literal): void {
    this.indent();
    this.out += `LITERAL ${JSON.stringify(e.value)}`;
  }
  visitIdentifier(e: ast.Identifier): void {
    this.indent();
    this.out += `IDENTIFIER ${JSON.stringify(e.name)}`;
  }
  visitAssignment(e: ast.Assignment): void {
    this.indent();
    this.out += `ASSIGNMENT ${JSON.stringify(e.target.name)}`;
    this.depth++;
    e.value.accept(this);
    this.depth--;
  }
  visitDeclaration(e: ast.Declaration): void {
    this.indent();
    this.out += `DECLARATION ${JSON.stringify(e.identifier.name)}`;
    this.depth++;
    e.value.accept(this);
    this.depth--;
  }
  visitOperation(e: ast.Operation): void {
    this.indent();
    this.out += `OPERATION ${e.operator} (${e.args.length})`;
    this.depth++;
    for (const arg of e.args) {
      arg.accept(this);
    }
    this.depth--;
  }
  visitShowExpression(e: ast.ShowExpression): void {
    this.indent();
    this.out += `SHOW EXPRESSION`;
    this.depth++;
    e.expression.accept(this);
    this.depth--;
  }
  visitFunctionDisplay(e: ast.FunctionDisplay): void {
    this.indent();
    this.out += `FUNCTION ${e.parameters.map(p => p.name).join(',')}`;
    this.depth++;
    e.body.accept(this);
    this.depth--;
  }
}

function astFileToString(file: ast.File) {
  const printer = new TreePrinter();
  file.accept(printer);
  return printer.out;
}

export async function parseCommand() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  const text = getSelectionOrAllText(editor);
  const astFile = guc.parse(editor.document.uri, text);
  await writeToNewEditor(emit => {
    emit(astFileToString(astFile) + '\n');
  });
}
