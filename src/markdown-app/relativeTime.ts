import { translate, type Language } from './i18nMessages'

/** 把时间戳格式化为相对时间(用于「最近打开」列表),文案随界面语言切换。 */
export function formatRelativeTime(ts: number, language: Language, now: number = Date.now()): string {
  const diff = Math.max(0, now - ts)
  const min = 60_000
  const hour = 60 * min
  const day = 24 * hour

  if (diff < min) return translate(language, 'time.justNow')
  if (diff < hour) return translate(language, 'time.minutesAgo', { n: Math.floor(diff / min) })

  const then = new Date(ts)
  const today = new Date(now)
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

  // 同一天:6 小时内显示「N 小时前」,更早显示「今天 HH:mm」
  if (isSameDay(then, today)) {
    if (diff < 6 * hour) return translate(language, 'time.hoursAgo', { n: Math.floor(diff / hour) })
    return translate(language, 'time.todayAt', { time: `${pad(then.getHours())}:${pad(then.getMinutes())}` })
  }

  const yesterday = new Date(now - day)
  if (isSameDay(then, yesterday)) return translate(language, 'time.yesterday')

  if (diff < 7 * day) return translate(language, 'time.daysAgo', { n: Math.floor(diff / day) })

  // 绝对日期按语言格式化:中文用「年 / 月 / 日」,其余用本地化短日期。
  const sameYear = then.getFullYear() === today.getFullYear()
  if (language === 'zh-CN') {
    return sameYear
      ? `${then.getMonth() + 1} 月 ${then.getDate()} 日`
      : `${then.getFullYear()} 年 ${then.getMonth() + 1} 月 ${then.getDate()} 日`
  }
  return then.toLocaleDateString(
    'en-US',
    sameYear ? { month: 'short', day: 'numeric' } : { year: 'numeric', month: 'short', day: 'numeric' },
  )
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}
