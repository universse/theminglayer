export function filterAndMap(arr, cb, predicate) {
  return arr.reduce((acc, curr, i) => {
    if (predicate(curr, i)) {
      acc.push(cb(curr, i))
    }
    return acc
  }, [])
}
