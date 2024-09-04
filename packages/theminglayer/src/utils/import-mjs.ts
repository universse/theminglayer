import URL from 'node:url'
import { isMainThread, parentPort, Worker } from 'node:worker_threads'

let worker: Worker
let requests: any = {}
let uid = 0
let lastMS: number

const filename =
  typeof __filename === 'undefined'
    ? URL.fileURLToPath(import.meta.url)
    : __filename

export function importMjs(src: string, ms: number) {
  if (ms !== lastMS) {
    lastMS = ms
    worker?.terminate()

    requests = {}
    uid = 0
    worker = new Worker(filename)

    worker.on('message', ({ id, result, error }) => {
      if (error) {
        requests[id].reject(error)
      } else {
        requests[id].resolve(result)
      }
    })
  }

  return new Promise((resolve, reject) => {
    const id = uid++
    requests[id] = { resolve, reject }
    worker.postMessage({ id, src })
  })
}

if (!isMainThread) {
  parentPort!.on('message', async ({ id, src }) => {
    try {
      const module = await import(src)
      parentPort!.postMessage({ id, result: module.default })
    } catch (error) {
      parentPort!.postMessage({ id, error })
    }
  })
}
