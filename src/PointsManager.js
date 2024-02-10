var PointsManager =
  PointsManager ||
  (() => {
    const logToChat = function (target, msg) {
      sendChat('API:PointsManager', '/w ' + target + ' ' + msg, null, {
        noarchive: true,
      })
    }

    const handleInput = (msg) => {
      if (msg.type !== 'api') {
        return
      }
      const args = msg.content.split(/\s+/)
      if (args[0].match(/^!points-manager(?:\.|$)/)) {
        const cmd = args.shift()
        const [name, number] = args
        try {
          switch (cmd) {
            case '!points-manager.spend':
              if (isNaN(number)) {
                throw new Error('Invalid number: ' + number)
              }
              const points = parseInt(number)
              if (name.toLowerCase() !== 'vitality') {
                sendChat('gm', `!counter.subtract ${name} ${number}`, {
                  noarchive: true,
                })
              } else {
                sendChat('gm', `!shared-vitality-manager.distribute-spend a-team ${number}`, {
                  noarchive: true,
                })
              }
              break
            default:
              logToChat(msg.who, 'Unknown command: ' + cmd)
          }
        } catch (err) {
          logToChat(msg.who, err.message)
        }
      }
    }

    const registerHandlers = () => {
      on('chat:message', handleInput)
    }

    const checkInstall = () => {
      log('PointsManager installed')
    }

    return {
      checkInstall,
      registerHandlers,
    }
  })()

on('ready', () => {
  const counterIntId = setInterval(() => {
    if (
      undefined !== Counter &&
      undefined !== Counter.ObserveCounterChange &&
      undefined !== SharedVitalityManager &&
      undefined !== SharedVitalityManager.CheckInstall
    ) {
      PointsManager.checkInstall()
      PointsManager.registerHandlers()
      clearInterval(counterIntId)
    } else if (tries++ > 20) {
      clearInterval(counterIntId)
      throw new Error(
        'Unable to find state.Counter.ObserveCounterChange and SharedVitalityManager.CheckInstall, have you installed Counter and SharedVitalityManager?'
      )
    }
  }, 200)
})
