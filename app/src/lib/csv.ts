// CSV 生成（Excel で文字化けしないよう BOM 付き UTF-8、数式インジェクション対策つき）

export const BOM = '﻿';

// 先頭がこれらの文字だと Excel 等が数式として解釈する（全角も念のため対象）
const FORMULA_START = /^[=+\-@\t\r＝＋－＠]/;

export type CsvValue = string | number | boolean | null | undefined | Date;

/** 数式として実行されないよう無害化する（先頭に ' を付ける） */
export function neutralize(value: string): string {
  return FORMULA_START.test(value) ? `'${value}` : value;
}

export function toCell(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) return value.toISOString();
  return neutralize(String(value));
}

export function quote(cell: string): string {
  return `"${cell.replace(/"/g, '""')}"`;
}

/** ヘッダーと行から BOM 付き CSV 文字列を作る（改行は CRLF） */
export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers, ...rows].map((r) => r.map((v) => quote(toCell(v))).join(','));
  return BOM + lines.join('\r\n') + '\r\n';
}
