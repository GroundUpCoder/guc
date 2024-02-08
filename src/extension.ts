import * as vscode from 'vscode';
import { tokenizeCommand } from './extension/tokenize';
import { parseCommand } from './extension/parse';
import { newHoverProvider } from './extension/hoverprovider';
import { newInlayHintsProvider } from './extension/inlayhintsprovider';
import { newDefinitionProvider } from './extension/definitionprovider';
import { Registry } from './extension/registry';


export function activate(context: vscode.ExtensionContext) {
  const sub = (item: vscode.Disposable) => context.subscriptions.push(item);

  const diagnostics = vscode.languages.createDiagnosticCollection('guc');
  const registry = new Registry(diagnostics);

  if (vscode.window.activeTextEditor &&
    vscode.window.activeTextEditor.document.languageId === 'guc') {
    const document = vscode.window.activeTextEditor.document;
    registry.update(document);
  }

  sub(vscode.workspace.onDidSaveTextDocument(document => {
    if (document.languageId === 'guc') {
      registry.update(document);
    }
  }));

  sub(vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor?.document.languageId === 'guc') {
      registry.update(editor.document);
    }
  }));

  sub(vscode.workspace.onDidCloseTextDocument(document => {
    // NOTE that there is some asymmetry here.
    // We do not want to refresh the registry for a document
    // that is merely opened. We intentionally try to only run it
    // if a user has opened the document and made it visible.
    //
    // On the other hand, we might not necessarily want to
    // delete data for a tab that the user just closed. They might
    // want to open it again.
    registry.delete(document.uri);
  }));

  sub(vscode.commands.registerCommand(
    'guc.tokenize',
    tokenizeCommand));
  sub(vscode.commands.registerCommand(
    'guc.parse',
    parseCommand));
  sub(vscode.languages.registerHoverProvider(
    { language: 'guc' }, newHoverProvider(registry)));
  sub(vscode.languages.registerInlayHintsProvider(
    { language: 'guc' }, newInlayHintsProvider(registry)));
  sub(vscode.languages.registerDefinitionProvider(
    { language: 'guc' }, newDefinitionProvider(registry)));
}
