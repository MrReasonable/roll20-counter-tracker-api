var SharedVitalityManager =
  SharedVitalityManager ||
  (function () {
    'use strict'
    const currentVersion = 0.2
    let crucibles = {}
    let charactersToObserve = {}
    let crucibleVitalityCounters = {}
    let availableCounters = {}

    const checkInstall = () => {
      log(
        '-=> SharedVitalityManager v0.0.2 <=-  [' +
          new Date(1707493443 * 1000) +
          ']'
      )
      if (
        !_.has(state, 'SharedVitalityManager') ||
        state.SharedVitalityManager.version === undefined ||
        state.SharedVitalityManager.version < currentVersion
      ) {
        if (
          !_.has(state, 'SharedVitalityManager') ||
          state.SharedVitalityManager.version === undefined ||
          state.SharedVitalityManager.version < 0.1
        ) {
          log('  > Updating Schema to v0.1 <')
          state.SharedVitalityManager = {
            version: 0.1,
          }
        }

        if (state.SharedVitalityManager.version < 0.2) {
          log('  > Updating Schema to v0.2 <')
          state.SharedVitalityManager.crucibleVitalityCounters = {}
          state.SharedVitalityManager.version = 0.2
        }
      }

      crucibleVitalityCounters =
        state.SharedVitalityManager.crucibleVitalityCounters
      registerCrucibles()
      _.each(crucibleVitalityCounters, (counterName, crucible) => {
        availableCounters[counterName] = true
        updateVitalityCounterMax(crucible, calculateTotalMaxVitality(crucible))
        updateVitalityCounter(crucible, calculateTotalVitality(crucible))
      })
    }

    const registerCounterObservers = () => {
      Counter.ObserveCounterRemove((counterName) => {
        if (availableCounters[counterName]) {
          delete availableCounters[counterName]
        }
      })

      Counter.ObserveCounterChange((counterName) => {
        if (_.find(crucibleVitalityCounters, counterName)) {
          availableCounters[counterName] = true
          log(`Counter ${counterName} is available`)
        }
      })
    }

    const registerCrucibles = () => {
      charactersToObserve = findObjs({ type: 'attribute', name: 'crucible' })
        .filter(
          (a) =>
            a.get('current') !== '' &&
            _.has(crucibleVitalityCounters, a.get('current')) &&
            getAttrByName(a.get('_characterid'), 'shared_vitality')
        )
        .reduce((acc, attr) => {
          const name = attr.get('current')
          const charId = attr.get('_characterid')
          return {
            ...acc,
            [charId]: name,
          }
        }, {})

      crucibles = _.chain(charactersToObserve)
        .keys()
        .reduce((acc, charId) => {
          const crucible = charactersToObserve[charId]
          if (!acc[crucible]) {
            acc[crucible] = []
          }
          return {
            ...acc,
            [crucible]: [...acc[crucible], charId],
          }
        }, {})
        .value()
    }

    const addCrucibleToTrack = (crucible, vitalityCounterName) => {
      crucibleVitalityCounters[crucible] = vitalityCounterName
      state.SharedVitalityManager.crucibleVitalityCounters =
        crucibleVitalityCounters
      registerCrucibles()
      updateVitalityCounterMax(crucible, calculateTotalMaxVitality(crucible))
      updateVitalityCounter(crucible, calculateTotalVitality(crucible))
    }

    const removeCrucibleToTrack = (crucible) => {
      delete crucibleVitalityCounters[crucible]
      delete state.SharedVitalityManager.crucibleVitalityCounters[crucible]
      registerCrucibles()
      delete availableCounters[crucible]
    }

    const issueCounterCommand = (counter, cmd) => {
      log(`Issuing command to counter ${counter}: ${cmd}`)
      if (availableCounters[counter]) {
        sendChat('gm', cmd, { noarchive: true })
      }
    }

    const updateVitalityCounter = (crucible, vitality) => {
      const counterName = crucibleVitalityCounters[crucible]
      issueCounterCommand(
        counterName,
        `!counter.set ${counterName} ${vitality}`
      )
    }

    const updateVitalityCounterMax = (crucible, maxVitality) => {
      const counterName = crucibleVitalityCounters[crucible]
      issueCounterCommand(
        counterName,
        `!counter.setMax ${counterName} ${maxVitality}`
      )
    }

    const distributeVitalitySpend = (crucible, amount) => {
      const counter = crucibleVitalityCounters[crucible]
      if (!counter) {
        throw new Error(`No counter registered for crucible '${crucible}'`)
      }

      if (amount <= 0) {
        throw new Error(`Amount must be greater than 0`)
      }

      const chars = crucibles[crucible]
      const charVitality = _.reduce(
        chars,
        (acc, charId) => {
          const vitality = getAttrByName(charId, 'current_vitality')
          return { ...acc, [charId]: vitality }
        },
        {}
      )

      const totalVitality = _.reduce(charVitality, (acc, v) => acc + v, 0)

      if (amount > totalVitality) {
        throw new Error(`Amount is greater than total vitality`)
      }

      const charVitalityRatio = _.chain(charVitality)
        .keys()
        .reduce((acc, k) => {
          return { ...acc, [k]: charVitality[k] / totalVitality }
        }, {})
        .value()

      const charVitalitySpend = _.chain(charVitalityRatio)
        .keys()
        .sortBy((k) => charVitalityRatio[k])
        .reverse()
        .reduce(
          (acc, v) => {
            if (amount <= 0 || charVitalityRatio[v] <= 0) {
              return acc
            }
            const spend = Math.ceil(charVitalityRatio[v] * amount)
            const amountRemaining = acc.amountRemaining
            const amountRemainingAfterSpend = amountRemaining - spend
            return {
              amountRemaining:
                amountRemainingAfterSpend > 0 ? amountRemainingAfterSpend : 0,
              charSpend: {
                ...acc.charSpend,
                [v]: amountRemainingAfterSpend < 0 ? amountRemaining : spend,
              },
            }
          },
          { amountRemaining: amount, charSpend: {} }
        )
        .value()

      const triggerVitalityCounterUpdate = _.debounce(() => {
        updateVitalityCounter(crucible, calculateTotalVitality(crucible))
      }, 250)

      _.each(charVitalitySpend.charSpend, (v, k) => {
        if (v <= 0) {
          return
        }

        const currentVitality = charVitality[k]
        const vitalityAttr = findObjs({
          type: 'attribute',
          characterid: k,
          name: 'current_vitality',
        })[0]

        onSheetWorkerCompleted(triggerVitalityCounterUpdate)

        vitalityAttr.setWithWorker({ current: currentVitality - v })
      })
    }

    const logToChat = function (target, msg) {
      sendChat('API:SharedVitalityManager', '/w ' + target + ' ' + msg, null, {
        noarchive: true,
      })
    }

    getHelp = function () {
      return (
        '<h3>Shared Vitality Manager</h3>' +
        '<p>Manages shared vitality across multiple characters</p>' +
        '<p>Usage: !shared-vitality-manager.command [args]</p>' +
        'Commands: register, unregister, list, distribute-spend, help</p>' +
        '<p><pre>!shared-vitality-manager.register &lt;crucible&gt; &lt;counter&gt;</pre> - Registers a crucible to be tracked by a counter</p>' +
        '<p><pre>!shared-vitality-manager.unregister &lt;crucible&gt;</pre> - Unregisters a crucible from being tracked by a counter</p>' +
        '<p><pre>!shared-vitality-manager.list</pre> - Lists all registered crucibles</p>' +
        '<p><pre>!shared-vitality-manager.distribute-spend &lt;crucible&gt; &lt;amount&gt;</pre> - Distributes a spend of vitality across a crucible</p>' +
        '<p><pre>!shared-vitality-manager.help</pre> - Shows this help message</p>' +
        '<p><h4>Examples</h4></p>' +
        '<p><pre>!shared-vitality-manager.register party shared-vitality-counte</pre></p>' +
        '<p><pre>!shared-vitality-manager.unregister party</pre></p>`'
      )
    }

    const handleInput = (msg) => {
      if (msg.type !== 'api') {
        return
      }
      const args = msg.content.split(/\s+/)
      if (args[0].match(/^!shared-vitality-manager(?:\.|$)/)) {
        const cmd = args.shift()
        try {
          switch (cmd) {
            case '!shared-vitality-manager.register':
              addCrucibleToTrack(args[0], args[1])
              logToChat(
                msg.who,
                `Registered crucible '${args[0]}' for counter '${args[1]}'`
              )
              break
            case '!shared-vitality-manager.unregister':
              removeCrucibleToTrack(args[0])
              logToChat(msg.who, `Unregistered crucible '${args[0]}'`)
              break
            case '!shared-vitality-manager.list':
              logToChat(
                msg.who,
                `Registered crucibles: ${Object.keys(crucibleVitalityCounters).join(', ')}`
              )
              break
            case '!shared-vitality-manager.distribute-spend':
              const [crucible, amount] = args
              distributeVitalitySpend(crucible, amount)
              break
            case '!shared-vitality-manager.help':
              logToChat(msg.who, getHelp())
              break
            default:
              logToChat(msg.who, `Unknown command '${cmd}'`)
              logToChat(
                msg.who,
                `Use '!shared-vitality-manager.help' to see available commands`
              )
          }
        } catch (err) {
          logToChat(msg.who, err.message)
        }
      }
    }

    const handleAttributeChange = (obj) => {
      const name = obj.get('name')
      const charId = obj.get('_characterid')
      if (['crucible', 'shared_vitality'].includes(name)) {
        registerCrucibles()
        const crucible = charactersToObserve[charId]
        if (crucible) {
          updateVitalityCounterMax(
            crucible,
            calculateTotalMaxVitality(crucible)
          )
        }
      }
      const crucible = charactersToObserve[charId]
      if (
        ['crucible', 'shared_vitality', 'current_vitality'].includes(name) &&
        crucible
      ) {
        updateVitalityCounter(crucible, calculateTotalVitality(crucible))
      }
      if ('vitality' === name && crucible) {
        updateVitalityCounterMax(
          charactersToObserve[charId],
          calculateTotalMaxVitality
        )
      }
    }

    const registerHandlers = () => {
      registerCounterObservers()
      on('change:attribute', (obj) => handleAttributeChange(obj))
      on('chat:message', (msg) => handleInput(msg))
    }

    const calculateTotalMaxVitality = (crucible) => {
      if (!crucibles[crucible]) {
        return 0
      }

      return crucibles[crucible].reduce((acc, charId) => {
        const lament = getAttrByName(charId, 'lament')
        const luminousAttr = getAttrByName(charId, 'luminous')
        return (
          acc +
          (lament === 'hue' ? 7 : 10) +
          (luminousAttr ? parseInt(luminousAttr) : 0)
        )
      }, 0)
    }

    const calculateTotalVitality = (crucible) => {
      if (!crucibles[crucible]) {
        return 0
      }

      return crucibles[crucible].reduce((acc, charId) => {
        const vitality = getAttrByName(charId, 'current_vitality')
        return acc + vitality
      }, 0)
    }

    return {
      CheckInstall: checkInstall,
      registerEventHandlers: registerHandlers,
    }
  })()

on('ready', () => {
  'use strict'
  let tries = 0
  const counterIntId = setInterval(() => {
    if (undefined !== Counter && undefined !== Counter.ObserveCounterChange) {
      SharedVitalityManager.CheckInstall()
      SharedVitalityManager.registerEventHandlers()
      clearInterval(counterIntId)
    } else if (tries++ > 20) {
      clearInterval(counterIntId)
      throw new Error(
        'Unable to find state.Counter.ObserveCounterChange, have you installed Counter?'
      )
    }
  }, 200)
})
