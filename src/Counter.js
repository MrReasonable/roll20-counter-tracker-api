var Counter =
  Counter ||
  (function () {
    'use strict'

    let version = '0.0.1',
      lastUpdate = 1704566167,
      schemaVersion = 0.2,
      counters,
      observers = {
        counterChange: [],
        counterRemove: [],
      }

    const checkInstall = function () {
      log(
        '-=> Counter v' +
          version +
          ' <=-  [' +
          new Date(lastUpdate * 1000) +
          ']'
      )

      if (!_.has(state, 'Counter') || state.Counter.version !== schemaVersion) {
        log('  > Updating Schema to v' + schemaVersion + ' <')
        state.Counter = {
          version: schemaVersion,
          counters: {},
        }
      }
      counters = state.Counter.counters
    }

    const reset = function () {
      state.Counter.counters = {}
      observers.counterChange = []
      observers.counterRemove = []
      checkInstall()
    }

    const createCounter = function (name, max, initial) {
      if (!name) {
        throw new Error(
          'Unable to create new counter.  You must specify a name for the counter'
        )
      }

      if (max && (isNaN(max) || max < 0)) {
        throw new Error(
          'Unable to create new counter.  You must specify a positive integer for the max value'
        )
      }

      if (initial && (isNaN(initial) || (max && initial > max))) {
        throw new Error(
          'Unable to create new counter.  You must specify a positive integer for the initial value that is less than or equal to maxValue'
        )
      }

      if (name in counters) {
        throw new Error(
          'Unable to create counter.  ' +
            name +
            ' already exists with an current and max value of ' +
            counters[name].current +
            '/' +
            counters[name].max
        )
      }

      max = parseInt(max) || null
      initial = parseInt(initial) || 0
      counters[name] = { max: max, current: initial }
    }

    const deleteCounter = function (name) {
      getCounter(name)
      notifyCounterRemove(name)
      delete counters[name]
    }

    const setCounterValue = function (name, value) {
      const counter = getCounter(name)
      const intVal = getIntVal(value)

      if (counter.max && intVal > counter.max) {
        throw new Error(
          'Unable to set value of ' +
            name +
            '.  New value must be less than max possible value (' +
            counter.max +
            ').'
        )
      } else if (intVal < 0) {
        throw new Error(
          'Unable to set value of ' +
            name +
            '.  New value must be greater than zero.'
        )
      }

      counter.current = intVal

      notifyCounterChange(name)
    }

    const setCounterMax = function (name, value) {
      const counter = getCounter(name)
      const intVal = parseInt(value)
      counter.max = intVal

      if (intVal < counter.current) {
        setCounterValue(name, intVal)
      }
    }

    const setCounterToMax = function (name) {
      const counter = getCounter(name)
      if (!counter.max) {
        throw new Error('Counter ' + name + ' does not have a max value.')
      }
      setCounterValue(name, counter.max)
    }

    const listCounters = function () {
      let msg = '<h3>Current counters</h3>'
      if (_.keys(counters).length <= 0) {
        msg += '<p>No counters attached to this game.</p>'
      } else {
        msg += '<ul>'
        _.each(counters, function (counter, name) {
          msg +=
            '<li>' +
            name +
            ': (' +
            counter.current +
            ' / ' +
            counter.max +
            ')</li>'
        })
        msg += '</ul>'
      }
      return msg
    }

    const displayCounter = function (name, who) {
      const counter = getCounter(name)
      logToChat(
        who,
        'Counter: {name: ' +
          name +
          ', maximum: ' +
          counter.max +
          ', current: ' +
          counter.current +
          '}'
      )
    }

    const addToCounter = function (name, value) {
      const counter = getCounter(name)
      const intVal = parseInt(value)

      setCounterValue(name, counter.current + intVal)
    }

    const subtractFromCounter = function (name, value) {
      const counter = getCounter(name)
      const intVal = parseInt(value)

      setCounterValue(name, counter.current - intVal)
    }

    const getCounter = function (name) {
      if (!name) {
        throw new Error('Cannot get counter.  Please provide counter name')
      } else if (!(name in counters)) {
        throw new Error(
          'Counter named "' +
            name +
            '" does not exist, have you created it with <code>!counter.create ' +
            name +
            '</code>?'
        )
      } else {
        return counters[name]
      }
    }

    const getIntVal = function (value) {
      if (isNaN(value)) {
        throw new Error('Supplied value ' + value + ' is not a number')
      }
      return parseInt(value)
    }

    const logToChat = function (target, msg) {
      sendChat('API:Counter', '/w ' + target + ' ' + msg, null, {
        noarchive: true,
      })
    }

    const getHelp = function () {
      return (
        '<h3>Counter tracker help</h3>' +
        '<p>Provides counters for your game.  These can be used to track points that are not attached to characters.</p>' +
        '<h4>Create a counter and attach it to this game</h4>' +
        '<p>New counters require a unique name and can optionally have a maximum value and a starting value.</p>' +
        '<p><code>!counter.create &lt;name&gt; [maximum_value] [starting_value]</code></p>' +
        '<h4>List counters</h4>' +
        '<p>Display all counters for the game in the chat</p>' +
        '<p><code>!counter.list</code></p>' +
        '<h4>Remove counter from game</h4>' +
        '<p><code>!counter.delete &lt;name&gt;</code></p>' +
        '<h4>Set counter value</h4>' +
        '<p><code>!counter.set &lt;name&gt; &lt;value&gt;</code></p>' +
        '<h4>Set counter maximum value</h4>' +
        "<p>Setting a counter's maximum value to less than its current value will automatically lower the current value to the new maximum.</p>" +
        '<p><code>!counter.setMax &lt;name&gt; &lt;value&gt;</code></p>' +
        '<h4>Add to counter</h4>' +
        "<p>Add a value to the named counter.  If the new value is greater than the counter's max_value, an error will be generated and the counter's current value will not be changed.</p>" +
        '<p><code>!counter.add &lt;name&gt; [number_to_add]</code></p>' +
        '<h4>Subtract from a counter</h4>' +
        "<p>Subtract a value from the named counter.  If the new value is less than 0, an error will be generated and the counter's current value will not be changed.</p>" +
        '<p><code>!counter.subtract &lt;name&gt; [number_to_subtract]</code></p>' +
        '<h4>Set a counter to its maximum value</h4>' +
        "<p>Set a counter's current value to equal its maximum value.</p>" +
        '<p><code>!counter.reset &lt;name&gt;</code>'
      )
    }

    const handleInput = function (msg) {
      if (msg.type !== 'api') {
        return
      }

      const args = msg.content.split(/\s+/)
      if (args[0].match(/^!counter(?:\.|$)/)) {
        const cmd = args.shift()
        try {
          switch (cmd) {
            case '!counter.help':
              logToChat(msg.who, getHelp())
              break
            case '!counter.list':
              logToChat(msg.who, listCounters())
              break
            case '!counter.create':
              createCounter(args[0], args[1], args[2])
              displayCounter(args[0], msg.who)
              break
            case '!counter.delete':
              deleteCounter(args[0])
              logToChat(msg.who, args[0] + ' deleted.')
              break
            case '!counter.set':
              setCounterValue(args[0], args[1])
              break
            case '!counter.setMax':
              setCounterMax(args[0], args[1])
              break
            case '!counter.add':
              addToCounter(args[0], args[1])
              break
            case '!counter.subtract':
              subtractFromCounter(args[0], args[1])
              break
            case '!counter.reset':
              setCounterToMax(args[0])
              break
            case '!counter.total-reset':
              reset()
              logToChat(msg.who, 'All counters deleted.')
              break
            default:
              logToChat(
                msg.who,
                cmd +
                  ' is not a valid Counter command.  Please use !counter.help'
              )
              break
          }
        } catch (err) {
          logToChat(msg.who, err.message)
        }
      }
    }

    const observeCounterChange = function (handler) {
      if (typeof handler !== 'function') {
        throw new Error('CounterChangeObserver must be a function')
      }
      observers.counterChange.push(handler)
      _.each(counters, function (counter, counterName) {
        handler(counterName, counter)
      })
    }

    const ignoreCounterChange = function (handler) {
      const i = observers.counterChange.indexOf(handler)
      if (i >= 0) {
        observers.counterChange.splice(i, 1)
      }
    }

    const notifyCounterChange = function (counterName) {
      const counter = counters[counterName]
      _.each(observers.counterChange, function (handler) {
        handler(counterName, counter)
      })
    }

    const observeCounterRemove = function (handler) {
      if (typeof handler !== 'function') {
        throw new Error('CounterRemoveObserver must be a function')
      }
      observers.counterRemove.push(handler)
    }

    const ignoreCounterRemove = function (handler) {
      const i = observers.counterRemove.indexOf(handler)
      if (i >= 0) {
        observers.counterRemove.splice(i, 1)
      }
    }

    const notifyCounterRemove = function (counterName) {
      _.each(observers.counterRemove, function (handler) {
        handler(counterName)
      })
    }

    const registerEventHandlers = function () {
      on('chat:message', handleInput)
    }

    return {
      CheckInstall: checkInstall,
      RegisterEventHandlers: registerEventHandlers,
      ObserveCounterChange: observeCounterChange,
      IgnoreCounterChange: ignoreCounterChange,
      ObserveCounterRemove: observeCounterRemove,
      IgnoreCounterRemove: ignoreCounterRemove,
    }
  })()

on('ready', function () {
  'use strict'

  Counter.CheckInstall()
  Counter.RegisterEventHandlers()
})
