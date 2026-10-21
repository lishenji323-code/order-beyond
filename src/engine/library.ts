import type { Book } from '../types/story'
import { parseBook, parseStory } from './validation'
const DB = 'order-beyond-library'
let database: Promise<IDBDatabase> | undefined
function open() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () =>
      req.result.createObjectStore('books', { keyPath: 'id' })
    req.onsuccess = () => {
      req.result.onversionchange = () => {
        req.result.close()
        database = undefined
      }
      resolve(req.result)
    }
    req.onerror = () => {
      database = undefined
      reject(new Error('无法打开本机书架，请检查浏览器是否允许存储。'))
    }
    req.onblocked = () =>
      reject(new Error('请关闭另一个旧版本页面，再重新打开书架。'))
  }))
}
export async function listBooks(): Promise<Book[]> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const req = db.transaction('books').objectStore('books').getAll()
    req.onsuccess = () => {
      try {
        resolve(
          req.result
            .map(parseBook)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        )
      } catch {
        reject(
          new Error('书架中有无法读取的存档。请先保留浏览器数据，不要清除。'),
        )
      }
    }
    req.onerror = () => reject(req.error)
  })
}
export async function saveBook(
  book: Book,
  expected = book.revision,
): Promise<Book> {
  const db = await open(),
    next = parseBook({
      ...book,
      revision: expected + 1,
      updatedAt: new Date().toISOString(),
    })
  return new Promise((resolve, reject) => {
    const tx = db.transaction('books', 'readwrite'),
      store = tx.objectStore('books'),
      req = store.get(book.id)
    let conflict = false
    req.onsuccess = () => {
      if ((req.result?.revision ?? 0) !== expected) {
        conflict = true
        tx.abort()
      } else store.put(next)
    }
    tx.oncomplete = () => resolve(next)
    tx.onabort = () =>
      reject(
        new Error(
          conflict
            ? '另一个页面已更新这个故事。请先导出未保存内容，再刷新页面。'
            : '本机存储未成功，请导出备份或释放空间后重试。',
        ),
      )
  })
}
export async function importBooks(books: Book[]) {
  const copies = books.map((book) => {
    const id = crypto.randomUUID()
    return parseBook({
      ...book,
      id,
      title: book.title.slice(0, 70) + ' · 导入',
      state: { ...book.state, config: { ...book.state.config, id } },
      revision: 1,
      updatedAt: new Date().toISOString(),
    })
  })
  const db = await open()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('books', 'readwrite')
    for (const b of copies) tx.objectStore('books').add(b)
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(new Error('导入失败，原有故事未改变。'))
  })
  return copies
}
export async function migrateLegacy() {
  const raw = localStorage.getItem('order-beyond:story')
  if (!raw) return
  const state = parseStory(JSON.parse(raw))
  const all = await listBooks()
  if (!all.some((b) => b.id === state.config.id)) {
    try {
      await saveBook({
        id: state.config.id,
        title: `${state.config.player.name}与${state.config.maleLead.name}`,
        state,
        updatedAt: state.lastInteractionAt,
        revision: 0,
        archived: false,
        draft: '',
      })
    } catch (error) {
      // Another tab (or Strict Mode initialization) may finish this migration first.
      if (!(await listBooks()).some((b) => b.id === state.config.id))
        throw error
    }
  }
  // Keep the original until the user chooses to clear browser data.
}
export function downloadFile(
  name: string,
  content: string,
  type = 'application/json',
) {
  const url = URL.createObjectURL(new Blob([content], { type })),
    a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
