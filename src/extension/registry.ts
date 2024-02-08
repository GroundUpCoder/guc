import * as guc from "../lang/guc";
import * as vscode from "vscode";
import * as debug from "../debug";

export class Registry {
  readonly map: {
    [uri: string]:
    { version: number, annotation: guc.FileAnnotation } | undefined
  } = Object.create(null);
  readonly diagnostics: vscode.DiagnosticCollection;

  constructor(diagnostics: vscode.DiagnosticCollection) {
    this.diagnostics = diagnostics;
  }

  update(document: vscode.TextDocument): guc.FileAnnotation {
    const start = Date.now();
    const uri = document.uri;
    const key = uri.toString();
    const version = document.version;
    const prior = this.map[key];
    if (prior && version === prior.version) {
      return prior.annotation;
    }
    const fileNode = guc.parse(uri, document.getText());
    const annotation = guc.annotate(fileNode);
    this.diagnostics.set(document.uri, [...annotation.errors, ...fileNode.errors].map(e => {
      return {
        message: e.message,
        range: new vscode.Range(
          new vscode.Position(e.location.range.start.line, e.location.range.start.column),
          new vscode.Position(e.location.range.end.line, e.location.range.end.column)),
        severity: vscode.DiagnosticSeverity.Warning,
      }
    }));
    this.map[uri.toString()] = { version, annotation };
    const end = Date.now();
    debug.info(`Registry.update: ${end - start}ms, ${key}`);
    return annotation;
  }

  get(uri: vscode.Uri): guc.FileAnnotation | null {
    const cache = this.map[uri.toString()];
    return cache?.annotation || null;
  }

  delete(uri: vscode.Uri) {
    delete this.map[uri.toString()];
  }
}
