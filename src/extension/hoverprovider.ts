import * as vscode from 'vscode';
import * as guc from '../lang/guc'
import { Registry } from './registry';

function lt(p1: vscode.Position, p2: guc.Position) {
  return p1.line < p2.line || (p1.line === p2.line && p1.character < p2.column);
}

function le(p1: guc.Position, p2: vscode.Position) {
  return p1.line < p2.line || (p1.line === p2.line && p1.column <= p2.character);
}

function inRange(position: vscode.Position, range: guc.Range) {
  return le(range.start, position) && lt(position, range.end);
}

function formatVariableForHover(variable: guc.Variable): vscode.MarkdownString {
  const ms = new vscode.MarkdownString();
  const storageClass = variable.isConst ? 'const' : 'var';
  const value = variable.isConst ? ` = ${guc.formatValue(variable.staticValue)}` : '';
  const builtin = variable.location === guc.BUILTIN_LOCATION ? ' (builtin)' : '';
  ms.appendCodeblock(`${storageClass} ${variable.identifier.name}${value}${builtin}`);
  return ms;
}

export function newHoverProvider(registry: Registry): vscode.HoverProvider {
  return {
    provideHover(document, position, token) {
      const annotation = registry.update(document);
      const mss: vscode.MarkdownString[] = [];
      for (const variable of annotation.variables) {
        if (inRange(position, variable.identifier.location.range)) {
          mss.push(formatVariableForHover(variable));
          if (variable.staticValue instanceof guc.HTML) {
            const ms = new vscode.MarkdownString();
            ms.supportHtml = true;
            ms.appendMarkdown(variable.staticValue.value);
            mss.push(ms);
          }
        }
      }
      for (const ref of annotation.references) {
        if (inRange(position, ref.identifier.location.range)) {
          mss.push(formatVariableForHover(ref.variable));
        }
      }
      return new vscode.Hover(mss);
    },
  }
}
