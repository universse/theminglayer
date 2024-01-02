export function parallel(...promises: Promise<any>[]) {
  return Promise.all(promises)
}

export function serial(...promises: Promise<any>[]) {
  return promises.reduce((p, next) => p.then(() => next), Promise.resolve())
}

type Callback<T, V> = (item: T, i?: number) => Promise<V>

export function mapParallel<T, V>(items: T[], cb: Callback<T, V>) {
  return Promise.all(items.map(cb))
}

export async function mapSerial<T, V>(items: T[], cb: Callback<T, V>) {
  const results: V[] = []

  for (let i = 0; i < items.length; i++) {
    results.push(await cb(items[i]!, i))
  }

  return results
}

// export function mapSerial<T>(items: T[], cb: Callback<T>) {
//   return items.reduce(
//     (acc, curr, i) => acc.then(() => cb(curr, i)),
//     Promise.resolve()
//   )
// }

export function pool<T, V>(
  items: T[],
  cb: Callback<T, V>,
  concurrency: number
) {
  return new Promise((resolve, reject) => {
    let running = 0
    let index = 0
    const results: V[] = []

    let done = false

    function run() {
      if (done) return
      if (running >= concurrency) return

      if (index >= items.length) {
        if (running === 0) {
          done = true
          resolve(results)
        }
        return
      }

      running++
      cb(items[index++]!)
        .then((result) => {
          results.push(result)
          running--
          run()
        })
        .catch((err) => {
          done = true
          reject(err)
        })
    }

    run()
  })
}

export function batch<T, V>(items: T[], cb: Callback<T, V>, size: number) {
  return new Promise((resolve, reject) => {
    let index = 0
    const results: V[] = []

    let done = false

    function run() {
      if (done) return

      if (index >= items.length) {
        done = true
        resolve(results)
        return
      }

      const batch = items.slice(index, (index += size))

      Promise.all(batch.map(cb))
        .then((batchResults) => {
          results.push(...batchResults)
          run()
        })
        .catch((err) => {
          done = true
          reject(err)
        })
    }

    run()
  })
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
