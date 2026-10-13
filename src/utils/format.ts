export const currency = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value)
export const dateLabel = (value: string) => value.split('-').reverse().join('/')
export const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
export function dateOffset(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return localDate(date)
}
