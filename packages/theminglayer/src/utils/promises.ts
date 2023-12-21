export function parallel(...promises) {
  return Promise.all(promises)
}

export function serial(...promises) {
  return promises.reduce((p, next) => p.then(() => next()), Promise.resolve())
}

type Callback<T> = (item: T, i?: number) => Promise<any>

export function mapParallel<T>(items: T[], cb: Callback<T>) {
  return Promise.all(items.map(cb))
}

export async function mapSerial<T>(items: T[], cb: Callback<T>) {
  const results: ReturnType<Callback<T>>[] = []

  for (let i = 0; i < items.length; i++) {
    results.push(await cb(items[i], i))
  }

  return results
}

// export function mapSerial<T>(items: T[], cb: Callback<T>) {
//   return items.reduce(
//     (acc, curr, i) => acc.then(() => cb(curr, i)),
//     Promise.resolve()
//   )
// }

export function pool<T>(items: T[], cb: Callback<T>, concurrency: number) {
  return new Promise((resolve, reject) => {
    let running = 0
    let index = 0
    const results: ReturnType<Callback<T>>[] = []

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
      cb(items[index++])
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

export function batch<T>(items: T[], cb: Callback<T>, size: number) {
  return new Promise((resolve, reject) => {
    let index = 0
    const results: ReturnType<Callback<T>>[] = []

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

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
