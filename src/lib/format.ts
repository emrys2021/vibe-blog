import { format, formatDistanceToNowStrict } from 'date-fns';

export function formatDate(iso: string): string {
  return format(new Date(iso), 'yyyy-MM-dd');
}

export function formatDateLong(iso: string): string {
  return format(new Date(iso), 'PPP');
}

export function timeAgo(iso: string): string {
  return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
}
