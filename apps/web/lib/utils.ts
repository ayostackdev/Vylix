export function cn(...classNames: Array<string | undefined | false | null>) {
  return classNames.filter(Boolean).join(' ');
}
