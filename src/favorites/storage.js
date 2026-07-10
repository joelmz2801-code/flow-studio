const DB_NAME = 'joel-flow-studio-favorites'
const STORE = 'images'
const VERSION = 1

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('source', 'source', { unique: true })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transact(mode, action) {
  return openDatabase().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const store = tx.objectStore(STORE)
    let result
    try { result = action(store) } catch (error) { reject(error); return }
    tx.oncomplete = () => resolve(result?.result)
    tx.onerror = () => reject(tx.error)
  }))
}

export function listFavorites() {
  return transact('readonly', (store) => store.getAll()).then((items = []) =>
    items.sort((a, b) => b.createdAt - a.createdAt),
  )
}

export function addFavorite(item) {
  return transact('readwrite', (store) => store.put(item))
}

export function removeFavorite(id) {
  return transact('readwrite', (store) => store.delete(id))
}

export function findBySource(source) {
  return openDatabase().then((db) => new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).index('source').get(source)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  }))
}
