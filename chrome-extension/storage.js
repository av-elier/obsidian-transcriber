const database = new Promise((resolve, reject) => {
  const request = indexedDB.open('transcription-studio', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('recordings', { keyPath: 'id' });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
async function operation(mode, action) {
  const db = await database;
  return new Promise((resolve, reject) => {
    const tx = db.transaction('recordings', mode);
    const request = action(tx.objectStore('recordings'));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Storage operation aborted.'));
  });
}
export const recordings = {
  list: () => operation('readonly', store => store.getAll()),
  save: item => operation('readwrite', store => store.put(item)),
  remove: id => operation('readwrite', store => store.delete(id))
};
