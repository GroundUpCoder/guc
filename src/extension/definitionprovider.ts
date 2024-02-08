import * as vscode from 'vscode';
import * as convert from './convert'
import * as guc from '../lang/guc'
import { Registry } from './registry';

function le2(p1: vscode.Position, p2: guc.Position) {
  return p1.line < p2.line || (p1.line === p2.line && p1.character <= p2.column);
}

function le(p1: guc.Position, p2: vscode.Position) {
  return p1.line < p2.line || (p1.line === p2.line && p1.column <= p2.character);
}

function inRange(position: vscode.Position, range: guc.Range) {
  return le(range.start, position) && le2(position, range.end);
}

export function newDefinitionProvider(registry: Registry): vscode.DefinitionProvider {
  return {
    provideDefinition(document, position, token) {
      const annotation = registry.update(document);
      const locationLinks: vscode.LocationLink[] = [];
      for (const ref of annotation.references) {
        if (inRange(position, ref.identifier.location.range)) {
          if (ref.variable.location === guc.BUILTIN_LOCATION) {
            // There really isn't a definition to point to if this is a builtin
            continue;
          }
          locationLinks.push({
            originSelectionRange: convert.range(ref.identifier.location.range),
            targetUri: ref.variable.location.uri,
            targetRange: convert.range(ref.variable.identifier.location.range),
          });
        }
      }
      return locationLinks;
    },
  }
}
