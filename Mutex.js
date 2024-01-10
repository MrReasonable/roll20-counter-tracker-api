const Mutex = (function () {
  const create = () => {
    let busy = false
    let queue = []

    const execute = (task) => {
      task()
      dequeue()
    }

    const dequeue = () => {
      busy = true
      const next = queue.shift()
      if (next) {
        execute(next)
      } else {
        busy = false
      }
    }

    const synchronize = (callback) => {
      queue.push(callback)
      if (!busy) {
        dequeue()
      }
    }

    return synchronize
  }

  return { create }
}())