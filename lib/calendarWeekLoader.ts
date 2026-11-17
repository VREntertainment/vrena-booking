import { getSupabase } from './booking/client'
import type { BlockedTime, Session, SessionListPageResult } from './bookingWidgetDomain'

/** Fetch a complete week before committing any rows, including paginated busy weeks. */
export async function loadCalendarWeekRows(
  startDate: string,
  endDate: string,
  signal: AbortSignal,
  parse: (value: unknown) => SessionListPageResult,
) {
  const client = await getSupabase()
  const rows: Session[] = []
  const blocks: BlockedTime[] = []
  for (let offset = 0; ; offset += 250) {
    const { data, error } = await client.rpc('booking_calendar_list_page', {
      p_start_date: startDate, p_end_date: endDate, p_limit: 250, p_offset: offset, p_include_blocked_times: offset === 0,
    }).abortSignal(signal)
    if (error) throw new Error(error.message)
    const page = parse(data)
    rows.push(...page.sessions)
    blocks.push(...page.blockedTimes)
    if (page.sessions.length < 250) break
  }
  return { rows, blocks }
}
