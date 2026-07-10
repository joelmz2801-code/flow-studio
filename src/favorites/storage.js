const DB_NAME = 'joel-flow-studio-favorites'
const DB_VERSION = 2
const FAVORITES_STORE = 'images'
const SETTINGS_STORE = 'settings'

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(FAVORITES_STORE)) {
        const store = db.createObjectStore(FAVORITES_STORE, { keyPath: 'id' })
        store.createIndex('source', 'source', { unique: true })
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) db.createObjectStore(SETTINGS_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore(name, mode, action) {
  const db = await openDatabase()
  const tx = db.transaction(name, mode)
  const result = await action(tx.objectStore(name))
  return result
}

export async function listFavorites() {
  const items = await withStore(FAVORITES_STORE, 'readonly', (store) => requestResult(store.getAll()))
  return (items || []).sort((a, b) => b.createdAt - a.createdAt)
}

export const addFavorite = (item) => withStore(FAVORITES_STORE, 'readwrite', (store) => requestResult(store.put(item)))
export const removeFavorite = (id) => withStore(FAVORITES_STORE, 'readwrite', (store) => requestResult(store.delete(id)))
export const findBySource = (source) => withStore(FAVORITES_STORE, 'readonly', (store) => requestResult(store.index('source').get(source)))
export const saveDownloadFolder = (handle) => withStore(SETTINGS_STORE, 'readwrite', (store) => requestResult(store.put(handle, 'downloadFolder')))
export const getDownloadFolder = () => withStore(SETTINGS_STORE, 'readonly', (store) => requestResult(store.get('downloadFolder')))
export const clearDownloadFolder = () => withStore(SETTINGS_STORE, 'readwrite', (store) => requestResult(store.delete('downloadFolder')))
