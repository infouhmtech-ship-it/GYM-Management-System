export function money(value) {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function when(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function clock(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function whenTime(value) {
  if (!value) return '—';
  return `${when(value)} · ${clock(value)}`;
}

export function inputDate(value = new Date()) {
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function startOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function addDays(value, days) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

export function dueInfo(value) {
  if (!value) return { text: 'No date', tone: 'muted' };
  const diff = Math.round((startOfDay(value) - startOfDay(new Date())) / 86400000);
  if (diff < 0) return { text: `${-diff}d overdue`, tone: 'danger' };
  if (diff === 0) return { text: 'Due today', tone: 'warn' };
  if (diff === 1) return { text: 'Tomorrow', tone: 'info' };
  return { text: when(value), tone: 'muted' };
}

export function remaining(days) {
  if (days == null) return '—';
  if (days < 0) return 'Expired';
  if (days === 0) return 'Ends today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

export function labelFor(list, id) {
  return list.find((item) => item.id === id)?.label || '—';
}

export function tomorrowInput() {
  return inputDate(addDays(new Date(), 1));
}
