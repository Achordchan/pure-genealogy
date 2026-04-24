export function isGoApiEnabled() {
  return Boolean(process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL);
}
