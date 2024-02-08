
export const UnknownValue = Symbol("UnknownValue");

export type KnownValue = |
  null | boolean | number | string | StaticValue[] |
  Map<KnownValue, StaticValue> |
  HTML |
  ((args: KnownValue[]) => StaticValue);

export type StaticValue = typeof UnknownValue | KnownValue;

export class HTML {
  readonly value: string;
  constructor(value: string) {
    this.value = value;
  }
}

export function reprValue(value: StaticValue): string {
  return typeof value === 'string' ? JSON.stringify(value) : strValue(value);
}

export function strValue(value: StaticValue): string {
  if (value === UnknownValue) {
    return 'UnknownValue';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'function') {
    return value.name === '' ? '<function>' : `<function ${value.name}>`;
  }
  if (Array.isArray(value)) {
    return `[${value.map(v => reprValue(v)).join(',')}]`;
  }
  if (value instanceof Map) {
    let body = '';
    for (const [k, v] of value) {
      if (body !== '') {
        body += ',';
      }
      body += `${reprValue(k)}:${reprValue(v)}`;
    }
    return `{${body}}`;
  }
  if (value instanceof HTML) {
    return `HTML(${JSON.stringify(value.value)})`;
  }
  return JSON.stringify(value);
}

export function formatValue(value: StaticValue): string {
  if (value === UnknownValue) {
    return '(UnknownValue)';
  }
  if (typeof value === 'function') {
    return value.name === '' ? '<function>' : `<function ${value.name}>`;
  }
  if (Array.isArray(value)) {
    return `[${value.map(v => formatValue(v)).join(',')}]`;
  }
  if (value instanceof Map) {
    let body = '';
    for (const [k, v] of value) {
      if (body !== '') {
        body += ',';
      }
      body += `${formatValue(k)}:${formatValue(v)}`;
    }
    return `{${body}}`;
  }
  if (value instanceof HTML) {
    return `html(${value.value})`;
  }
  return JSON.stringify(value);
}
