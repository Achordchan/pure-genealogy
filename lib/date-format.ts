export function formatDateOnly(dateText: string | null | undefined) {
  if (!dateText) return "-";

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateText);
  if (!match) return dateText;

  const [, year, month, day] = match;
  return `${year}年${month}月${day}日`;
}
