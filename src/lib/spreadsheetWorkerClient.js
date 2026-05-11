/**
 * Parse CSV / Excel in a Web Worker so the main thread stays responsive.
 */

let worker;
let seq = 0;

function getWorker() {
  if (typeof Worker === 'undefined') return null;
  if (!worker) {
    try {
      worker = new Worker(new URL('../workers/importSpreadsheet.worker.js', import.meta.url));
    } catch {
      return null;
    }
  }
  return worker;
}

export function parseSpreadsheetFileWithWorker(file, { onProgress, signal } = {}) {
  const ext = (file?.name || '').toLowerCase().split('.').pop() || '';

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const w = getWorker();
    const id = seq++;

    const cleanup = () => {
      w?.removeEventListener('message', onMsg);
      signal?.removeEventListener?.('abort', onAbort);
    };

    const onAbort = () => {
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };

    const onMsg = (e) => {
      const data = e.data;
      if (!data || data.id !== id) return;

      if (data.type === 'progress') {
        onProgress?.({
          pct: data.pct,
          processed: data.processed,
          total: data.total,
          note: data.note,
        });
        return;
      }

      cleanup();
      if (data.ok) resolve(data.result);
      else reject(new Error(data.error || 'Parse failed'));
    };

    signal?.addEventListener?.('abort', onAbort);
    if (!w) {
      reject(new Error('Worker unavailable'));
      return;
    }

    w.addEventListener('message', onMsg);

    if (ext === 'csv') {
      file
        .text()
        .then((text) => {
          if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
          w.postMessage({ id, kind: 'csv', payload: { text } });
        })
        .catch((err) => {
          cleanup();
          reject(err);
        });
    } else if (ext === 'xlsx' || ext === 'xls') {
      file
        .arrayBuffer()
        .then((buffer) => {
          if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
          w.postMessage({ id, kind: 'excel', payload: { buffer } }, [buffer]);
        })
        .catch((err) => {
          cleanup();
          reject(err);
        });
    } else {
      cleanup();
      reject(new Error('Use .csv, .xlsx, or .xls'));
    }
  });
}
