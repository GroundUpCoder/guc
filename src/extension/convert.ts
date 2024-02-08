import * as vscode from 'vscode';
import * as guc from '../lang/guc'

export function position(p: guc.Position): vscode.Position {
  return new vscode.Position(p.line, p.column);
}

export function range(r: guc.Range): vscode.Range {
  return new vscode.Range(position(r.start), position(r.end));
}

export function location(loc: guc.Location): vscode.Location {
  return new vscode.Location(loc.uri, range(loc.range));
}
