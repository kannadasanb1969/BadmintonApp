import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'

const dataDirectory = path.resolve(process.cwd(), 'mock-server/data')
const filePath = (collection) => path.join(dataDirectory, `${collection}.json`)

export const readCollection = async (collection) => {
  const file = filePath(collection)
  try { await access(file, constants.F_OK) } catch { await mkdir(dataDirectory, { recursive: true }); await writeFile(file, '[]\n') }
  return JSON.parse(await readFile(file, 'utf8'))
}
const writeCollection = (collection, items) => writeFile(filePath(collection), `${JSON.stringify(items, null, 2)}\n`)
export const findById = async (collection, id) => (await readCollection(collection)).find(item => item.id === id)
export const create = async (collection, item) => { const items = await readCollection(collection); items.push(item); await writeCollection(collection, items); return item }
export const replace = async (collection, id, item) => { const items = await readCollection(collection); const index = items.findIndex(current => current.id === id); if (index < 0) return null; items[index] = item; await writeCollection(collection, items); return item }
export const patch = async (collection, id, partial) => { const item = await findById(collection, id); return item ? replace(collection, id, { ...item, ...partial, id }) : null }
export const remove = async (collection, id) => { const items = await readCollection(collection); const remaining = items.filter(item => item.id !== id); if (remaining.length === items.length) return false; await writeCollection(collection, remaining); return true }
