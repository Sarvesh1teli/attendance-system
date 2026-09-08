/**
 * Utility functions for time formatting (12-hour AM/PM) and timetable day conversions.
 */

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * Formats a single time string like "19:45" or "09:00:00" into 12-hour format "7:45 PM" or "9:00 AM".
 */
export function formatSingleTime(t: string): string {
  if (!t) return ''
  const trimmed = t.trim()
  if (/am|pm/i.test(trimmed)) return trimmed

  const parts = trimmed.split(':')
  if (parts.length < 2) return trimmed

  const h = parseInt(parts[0], 10)
  const m = parts[1].slice(0, 2).padStart(2, '0')
  if (isNaN(h)) return trimmed

  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${m} ${ampm}`
}

/**
 * Formats any time range or single time string into 12-hour AM/PM format:
 * - "19:45 - 19:59" -> "7:45 PM – 7:59 PM"
 * - "09:00 - 10:00" -> "9:00 AM – 10:00 AM"
 * - "19:45 - 19:59 [DOW:1]" -> "7:45 PM – 7:59 PM"
 */
export function formatTo12Hour(timeStr?: string): string {
  if (!timeStr) return ''
  const clean = timeStr.replace(/\[DOW:\d+\]/gi, '').trim()
  if (!clean) return ''

  if (clean.includes('-')) {
    const parts = clean.split('-')
    return parts.map((p) => formatSingleTime(p)).join(' – ')
  }
  return formatSingleTime(clean)
}

/**
 * Extracts day of week (0..6) from a class object or schedule string:
 * 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday
 */
export function extractDayOfWeek(classObj: any): number | null {
  if (classObj.day_of_week !== undefined && classObj.day_of_week !== null) {
    const d = Number(classObj.day_of_week)
    if (!isNaN(d) && d >= 0 && d <= 6) return d
  }
  if (classObj.dayOfWeek !== undefined && classObj.dayOfWeek !== null) {
    const d = Number(classObj.dayOfWeek)
    if (!isNaN(d) && d >= 0 && d <= 6) return d
  }

  const rawStr = classObj.schedule_time || classObj.scheduleTime || ''
  const match = rawStr.match(/\[DOW:(\d+)\]/i)
  if (match) {
    const parsed = parseInt(match[1], 10)
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 6) return parsed
  }

  return null
}
