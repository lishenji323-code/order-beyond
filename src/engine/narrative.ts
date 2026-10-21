import { archetypes, backgrounds, getTrope, tropes } from '../data/catalog'
import type { StoryState, StoryTime } from '../types/story'

const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']
function dayNumber(day: number): string {
  if (day < 10) return digits[day]
  if (day < 100)
    return `${day < 20 ? '' : digits[Math.floor(day / 10)]}十${day % 10 ? digits[day % 10] : ''}`
  return String(day)
}

export function timeLabel(time?: StoryTime) {
  return (
    time?.label ||
    (time
      ? `第${dayNumber(time.day)}${time.period === 'night' ? '夜' : '天'}`
      : '此刻')
  )
}

export function sameTime(a?: StoryTime, b?: StoryTime) {
  return a?.day === b?.day && a?.period === b?.period
}

export function validNarrativeTitle(title: string) {
  return (
    ![...tropes, ...archetypes, ...backgrounds].some(
      (t) => t.title === title.trim(),
    ) &&
    !['久别重逢', '暗恋成真', '相爱相杀'].includes(title.trim()) &&
    !/第[\s\d一二三四五六七八九十百]+[章节回天夜]/.test(title)
  )
}

export function readingTitle(state: StoryState) {
  const title = state.narrative?.title
  return title &&
    validNarrativeTitle(title) &&
    title !== getTrope(state.config.trope).title
    ? title
    : '未题'
}

export function timeOrder(time: StoryTime) {
  return time.day * 2 + (time.period === 'night' ? 1 : 0)
}
