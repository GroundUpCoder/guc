import { Uri } from 'vscode';
import * as token from './token';

export interface Location {
  uri: Uri;
  range: token.Range;
}

export class StaticError {
  readonly location: Location;
  readonly message: string;
  constructor(location: Location, message: string) {
    this.location = location;
    this.message = message;
  }
}
