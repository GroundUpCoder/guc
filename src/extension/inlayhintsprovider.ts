import * as vscode from 'vscode';
import * as convert from './convert'
import * as guc from '../lang/guc'
import { Registry } from './registry';

function formatValue(value: guc.StaticValue): string {
  return guc.strValue(value);
}

export function newInlayHintsProvider(registry: Registry): vscode.InlayHintsProvider {
  return {
    provideInlayHints(document, range, token) {
      const annotation = registry.update(document);
      const hints: vscode.InlayHint[] = [];
      for (const variable of annotation.variables) {
        if (variable.suppressInlayHint) {
          continue;
        }
        if (variable.isConst &&
          typeof variable.staticValue !== 'function' &&
          variable.staticValue !== guc.UnknownValue) {
          hints.push(new vscode.InlayHint(
            convert.position(variable.location.range.end),
            ': ' + formatValue(variable.staticValue)));
        }
      }
      for (const showValue of annotation.showValues) {
        hints.push(new vscode.InlayHint(
          convert.position(showValue.location.range.end),
          ' = ' + formatValue(showValue.value)));
      }
      return hints;
    },
  }
}
