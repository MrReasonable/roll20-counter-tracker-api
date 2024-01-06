var CounterTokens = CounterTokens || (function () {
  'use strict'
  const version = '0.0.1'
  const lastUpdate = 1488056728
  const schemaVersion = 0.3
  let tokenStore = {}
  let tokens = {}
  let debug = false

  const checkInstall = () => {
    log('-=> CounterTokens v' + version + ' <=-  [' + (new Date(lastUpdate * 1000)) + ']')
    if (!_.has(state, 'CounterTokens') || state.CounterTokens.version === undefined || state.CounterTokens.version < schemaVersion) {
      log('  > Updating Schema to v' + schemaVersion + ' <')

      if (!_.has(state, 'CounterTokens')
        || state.CounterTokens.version === undefined
        || state.CounterTokens.version < 0.1) {
        state.CounterTokens = {
          version: 0.1,
          tokens: {}
        }
      }
      if (state.CounterTokens.version < 0.3) {
        state.CounterTokens.debug = false
        state.CounterTokens.version = 0.3
      }
    }

    tokenStore = state.CounterTokens.tokens
    debug = state.CounterTokens.debug

    if (debug) {
      log("Debugging enabled.  Disable with !counter-tokens.debug-off")
      log("Token store: ")
      log(tokenStore)
    }

    _.each(tokenStore, (tokenRef) => {
      if (debug) {
        log("Reattaching token: " + tokenRef.tokenName + " to counter: " + tokenRef.counterName)
      }
      attachTokenToCounter(tokenRef)
    })
  }

  const reset = () => {
    state.CounterTokens.tokens = {}
    checkInstall()
  }

  const createToken = (tokenName, counterName, imgSrc) => {
    if (!tokenName) {
      throw new Error("tokenName is required.")
    } else if (!counterName) {
      throw new Error("counterName is required.")
    } else if (!imgSrc) {
      throw new Error("imgSrc is required.")
    }
    if (debug) {
      log("Creating token: " + tokenName + " for counter: " + counterName + " with imgSrc: " + imgSrc)
    }

    tokenStore[tokenName] = {
      tokenName: tokenName,
      counterName: counterName,
      imgSrc: getCleanImgsrc(imgSrc),
      imgIds: [],
      top: 30,
      left: 30,
      width: 30,
      height: 30,
      spaceX: 30,
      spaceY: 30
    }
    attachTokenToCounter(tokenStore[tokenName])

    if (debug) {
      log("Token created successfully:", tokenStore[tokenName])
    }
  }

  const getImgSrcByTokenName = (tokenObjName) => {
    const img = findObjs({
      _type: 'graphic',
      _pageid: Campaign().get('playerpageid'),
      name: tokenObjName
    })

    if (img.length <= 0) {
      throw new Error('Cannot find token on current page named ' + tokenObjName)
    }

    const src = img[0].get('imgsrc')
    img[0].remove()
    return src
  }

  const listTokens = () => {
    if (tokenStore.length <= 0) {
      return "No counter tokens attached to this game"
    }
    return "<ul>" + _.reduce(tokenStore,
      function (acc, token, name) {
        return acc + "<li>" + name + " -> " + token.counterName + "</li>"
      }, "") + "</ul>"
  }

  const attachTokenToCounter = (tokenRef) => {
    const tokenName = tokenRef.tokenName
    tokens[tokenName] = CounterToken.create(tokenRef)

    const tokenToAttach = tokens[tokenName]
    Counter.ObserveCounterChange(tokenToAttach.onCounterChange)
    Counter.ObserveCounterRemove(_.partial(onCounterRemove, tokenName))
  }

  const onCounterRemove = function (tokenName, counterName) {
    if (tokenName != counterName) {
      return
    }
    removeToken(tokenName)
  }

  const removeToken = function (tokenName) {
    if (!tokenStore.hasOwnProperty(tokenName)) {
      throw new Error(tokenName + " is not attached to this game.")
    }
    Counter.IgnoreCounterChange(tokens[tokenName])
    tokens[tokenName].clearImages()
    delete tokens[tokenName]
    delete tokenStore[tokenName]
  }

  const enableDebug = () => {
    debug = true
    state.CounterTokens.debug = true
  }

  const disableDebug = () => {
    debug = false
    state.CounterTokens.debug = false
  }

  const logToChat = (target, msg) => {
    sendChat('API:CounterTokens', '/w ' + target + ' ' + msg, null, { noarchive: true })
  }

  const getHelp = () => {
    return "<h3>Counter Token Help</h3>"
      + "<p>Provides a mechanism for displaying the state of a <code>CounterTracker</code> in your game.</p>"
      + "<p>It displays one instance of the image provided by imgSrc in <code>!counter-tokens.add</code> per value of the counter tracker.</p>"
      + "<h4>Create and attach a  Counter Token for a Counter Tracker</h4>"
      + "<p><code>imgSrc</code> must refer to an image in your library as per <a href=\"https://wiki.roll20.net/API:Objects#imgsrc_and_avatar_property_restrictions\">Roll20 API documentation.</a></p>"
      + "<p><code>!counter-tokens.add &lt;name&gt; &lt;counterName&gt; &lt;imgSrc&gt;</code></p>"
      + "<p>Instead of supplying an image source, you can specify a named graphic on the page. The graphic will be removed and replaced with the tokens.</p>"
      + "<p><code>!counter-tokens.add-by-name &lt;name&gt; &lt;counterName&gt; &lt;tokenName&gt;</code></p>"
  }

  const handleInput = (msg) => {
    if (msg.type !== 'api') {
      return
    }
    const options = msg.content.split(/--/),
      args = options.shift().split(/\s+/)

    if (!args[0].match(/^!counter-tokens\./)) {
      return
    }
    const cmd = args.shift()
    try {
      switch (cmd) {
        case '!counter-tokens.help':
          logToChat(msg.who, getHelp())
          break
        case '!counter-tokens.add':
          try {
            createToken(args[0], args[1], args[2], options)
            logToChat(msg.who, "Added token: " + args[0] + " for counter: " + args[1] + " with imgSrc: " + args[2])
          } catch (err) {
            logToChat(msg.who, "Unable to add new Counter Token: " + err.message)
            logToChat(msg.who, "Did you mean to use !counter-tokens.add-by-name")
          }
          break
        case '!counter-tokens.add-by-name':
          try {
            const src = getImgSrcByTokenName(args[2])
            createToken(args[0], args[1], src)
            logToChat(msg.who, "Added token: " + args[0] + " for counter: " + args[1] + " with imgSrc: " + src)
          } catch (err) {
            logToChat(msg.who, "Unable to add new Counter Token: " + err.message)
          }
          break

        case '!counter-tokens.remove':
          try {
            removeToken(args[0])
            logToChat(msg.who, "Removed Counter Token: " + args[0])
          } catch (err) {
            logToChat(msg.who, "Unable to remove Counter Token: " + err.message)
          }
          break
        case '!counter-tokens.list':
          logToChat(msg.who, listTokens())
          break
        case '!counter-tokens.total-reset':
          logToChat(msg.who, "Resetting all Counter Tokens.")
          reset()
          break
        case '!counter-tokens.debug':
          log({ tokenStore, tokens })
          logToChat(msg.who, "Debug info sent to console.")
          break
        case '!counter-tokens.debug-on':
          enableDebug()
          logToChat(msg.who, "Debugging enabled.")
          break
        case '!counter-tokens.debug-off':
          disableDebug()
          logToChat(msg.who, "Debugging disabled.")
          break
        default:
          logToChat(msg.who, cmd + ' is not a valid CounterTokens command.  Please use !counter-tokens.help')
          break
      }
    } catch (err) {
      sendChat('API', err.message, null, { noarchive: true })
    }
  }

  const registerEventHandlers = () => {
    on('chat:message', handleInput)
  }

  const getCleanImgsrc = (imgsrc) => {
    const parts = imgsrc.match(/(.*\/images\/.*)(thumb|med|original|max)(.*)$/)
    if (parts) {
      return parts[1] + 'thumb' + parts[3]
    }
  }

  const CounterToken = (function () {
    const getIndexFromName = (name) => {
      const findNumber = /\s(\d+)$/g
      const foundMatch = findNumber.exec(name)
      if (debug) {
        log("Finding index from name: " + name)
        log("Found match: ")
        log(foundMatch)
      }
      if (foundMatch !== null) {
        return parseInt(foundMatch[1])
      }
      return null
    }

    const tokenNameMatches = (tokenName, objectName) => {
      const nameToMatch = new RegExp('^' + tokenName + '\\s\\d+$')
      return nameToMatch.test(objectName)
    }

    const getGraphicRefsBefore = (graphicRefs, current) => {
      if (debug) {
        log("Finding graphics before current graphic: ")
        log(current)
      }

      const index = getIndexFromName(current.get('name'))

      if (debug) {
        log("Current index: " + index)
      }

      const graphicsBefore = _.filter(graphicRefs, (g) => getIndexFromName(g.get('name')) < index)

      if (debug) {
        log("Found " + graphicsBefore.length + " graphics before current.")
        log("Graphics before: ")
        log(graphicsBefore)
      }

      return graphicsBefore
    }

    const findGraphicRefIndexByImgId = (graphicRefs, imgId) => {
      return _.findIndex(graphicRefs, function (g) {
        return g.get('id') === imgId
      })
    }

    const findStartLeft = (numGraphicsBefore, rowsOfTen, rowsOfFive, currentLeft, spaceRight) => {
      const left = rowsOfFive > 0 ?
        ((numGraphicsBefore - (rowsOfTen * 10) - (rowsOfFive * 5)) % 5) * spaceRight :
        ((numGraphicsBefore - (rowsOfTen * 10)) % 10) * spaceRight
      return currentLeft - left
    }

    const findStartLeftAndTop = (graphicRefs, current, spaceRight, spaceBottom) => {
      if (debug) {
        log("Finding start left and top for current graphic: ")
        log(current)
      }

      const graphicRefsBefore = getGraphicRefsBefore(graphicRefs, current)
      if (debug) {
        log("Scanning " + graphicRefsBefore.length + " graphics before current.")
      }
      const currentLeft = current.get('left')
      const currentTop = current.get('top')
      if (graphicRefsBefore.length <= 0) {
        if (debug) {
          log("No graphics before, returning current left and top: " + currentLeft + ", " + currentTop)
        }
        return [currentLeft, currentTop]
      }

      const rowsOfTen = Math.floor(graphicRefsBefore.length / 10)
      const remainingGraphicsAfterTens = graphicRefs.length - (rowsOfTen * 10)
      const rowsOfFive = remainingGraphicsAfterTens < 10 ? Math.floor((graphicRefsBefore.length - (rowsOfTen * 10)) / 5) : 0
      const remainingGraphicsAfter5s = remainingGraphicsAfterTens - (rowsOfFive * 5)
      const rowsOfLtFive = remainingGraphicsAfter5s < 5 ? (graphicRefsBefore.length - (rowsOfTen * 10) - (rowsOfFive * 5) > 0 ? 1 : 0) : 0
      const top = currentTop -
        (rowsOfTen > 0 ? rowsOfTen * spaceBottom : 0) -
        (rowsOfFive > 0 ? rowsOfFive * spaceBottom : 0)

      if (debug) {
        log("Found rows of ten: " + rowsOfTen)
        log("Found rows of five: " + rowsOfFive)
        log("Found rows of less than five: " + rowsOfLtFive)
        log("Current is on row: " + (rowsOfTen + rowsOfFive + rowsOfLtFive))
      }

      const left = findStartLeft(graphicRefsBefore.length, rowsOfTen, rowsOfFive, currentLeft, spaceRight)

      if (debug) {
        log("Calculated start left and top: " + left + ", " + top)
      }
      return [left, top]
    }

    //10 items per row when > 10 items, 5 items per row when <= 10 items and > 5 items, all items when <= 5 items
    const getNewLeftAndTop = (numOnRow, remainingItems, startLeft, currentLeft, currentTop, spaceRight, spaceBottom) =>
      (numOnRow >= 10 || numOnRow >= 5 && numOnRow + remainingItems < 10) ?
        [startLeft, currentTop + spaceBottom] : [currentLeft + spaceRight, currentTop]

    const rearrangeImages = (graphicRefs, startLeft, startTop, spaceRight, spaceBottom) => {
      if (debug) {
        log("Rearranging images  with startLeft: " + startLeft + ", startTop: " + startTop + ", spaceRight: " + spaceRight + ", spaceBottom: " + spaceBottom)
        log("Image refs: ")
        log(graphicRefs)
      }

      _.reduce(graphicRefs, (acc, g) => {
        if (acc.remainingItems === 0) {
          return acc
        }

        if (debug) {
          log("Acc: ")
          log(acc)
          log("Graphic: ")
          log(g)
        }

        const [left, top] = acc.numOnRow > 0 ? getNewLeftAndTop(acc.numOnRow, acc.remainingItems, startLeft, acc.left, acc.top, spaceRight, spaceBottom) : [acc.left, acc.top];

        if (debug) {
          log("Moving image to left: " + left + ", top: " + top)
        }

        g.set('left', left)
        g.set('top', top)

        return {
          left,
          top,
          remainingItems: (acc.remainingItems - 1),
          numOnRow: (left === startLeft ? 1 : acc.numOnRow + 1),
        }
      }, { left: startLeft, top: startTop, remainingItems: graphicRefs.length, numOnRow: 0 })
    }

    const normalizeObjKeys = (obj) => {
      return _.reduce(obj, function (acc, val, key) {
        const newKey = key.replace(/_/, '').toLowerCase()
        if (newKey !== 'id') {
          acc[newKey] = val
        }
        return acc
      }, {})
    }

    const undoDeleteIfGraphicShouldExist = (graphicRefs, token, obj) => {
      const objName = obj.get('name')

      if (!tokenNameMatches(token.tokenName, objName)) {
        return
      }

      const objId = obj.get('id')
      const graphicRefId = findGraphicRefIndexByImgId(graphicRefs, objId)

      if (graphicRefId > -1) {
        const img = createObj('graphic', normalizeObjKeys(obj.attributes)),
          tokenImgIdId = _.indexOf(token.imgIds, objId)
        graphicRefs.splice(graphicRefId, 1, img)
        token.imgIds.splice(tokenImgIdId, 1, img.get('id'))
        toFront(img)
      }
    }

    const keepImagesTogether = (graphicRefs, token, obj, prev) => {

      if (
        (obj.get('left') === prev.left && obj.get('top') === prev.top)
        || !tokenNameMatches(token.tokenName, obj.get('name'))
      ) {
        return
      }

      if (debug) {
        log("Keeping images together for token: " + token.tokenName)
      }

      const [left, top] = findStartLeftAndTop(graphicRefs, obj, token.spaceX, token.spaceY)

      rearrangeImages(graphicRefs, left, top, token.spaceX, token.spaceY)
    }

    const removeTokenImages = (graphicRefs, token, numberToRemove) => {
      const numberToKeep = token.imgIds.length - numberToRemove - 1
      _.map(_.range(token.imgIds.length - 1, numberToKeep, -1), (function (i) {
        const idx = findGraphicRefIndexByImgId(graphicRefs, token.imgIds[i]),
          img = graphicRefs[idx]
        token.imgIds.splice(i)
        graphicRefs.splice(idx)
        img.remove()
      }))
    }

    const addTokenImages = (graphicRefs, token, numberToAdd) => {
      const pageId = Campaign().get("playerpageid")
      const startValue = (token.imgIds.length > 0 ? token.imgIds.length : 0)
      _.each(_.range(startValue, startValue + numberToAdd), function (i) {
        const left = token.left
        const top = token.top
        const img = createObj('graphic', {
          name: token.tokenName + ' ' + i,
          pageid: pageId,
          layer: 'map',
          imgsrc: token.imgSrc,
          top: top,
          left: left,
          width: token.width,
          height: token.height,
          isdrawing: true
        })
        graphicRefs.push(img)
        token.imgIds.push(img.id)
        toFront(img)
      })
    }

    const updateImages = (graphicRefs, token, counterValue) => {
      const graphicCount = graphicRefs.length
      if (counterValue < graphicCount) {
        removeTokenImages(graphicRefs, token, token.imgIds.length - counterValue)
      } else if (counterValue > graphicCount) {
        addTokenImages(graphicRefs, token, counterValue - token.imgIds.length)
      }
      rearrangeImages(graphicRefs, token.left, token.top, token.spaceX, token.spaceY)
    }

    //Bind each reference of on-page graphical objects to the supplied variable
    const getGraphicReferences = (token) => {
      const pageId = Campaign().get('playerpageid');
      const graphics = filterObjs(obj =>
        obj.get('type') === 'graphic'
        && obj.get('pageid') === pageId
        && _.contains(token.imgIds, obj.get('id'))
      )

      //Remove all imgIds from token for images that that haven't been found on the page.
      _.each(
        _.difference(token.imgIds, _.map(graphics, (g) => g.get('id'))),
        (imgId) => token.imgIds.splice(_.indexOf(token.imgIds, imgId))
      )

      return graphics
    }

    const onCounterChange = (graphicRefs, token, counterName, counter) => {
      if (counterName !== token.counterName) {
        return
      }
      try {
        updateImages(graphicRefs, token, counter.current, counter.max)
      } catch (err) {
        logToChat('gm', "Unable to update Counter Token images: " + err.message)
      }
    }

    const clearImages = (graphicRefs, token) => {
      token.imgIds = []
      _.each(graphicRef, function (obj) {
        obj.remove()
      })
    }

    const create = (token) => {
      const graphicRefs = getGraphicReferences(token)
      on('change:graphic', _.partial(keepImagesTogether, graphicRefs, token))
      return {
        onCounterChange: _.partial(onCounterChange, graphicRefs, token),
        clearImages: _.partial(clearImages, graphicRefs, token)
      }
    }

    return {
      create: create
    }
  }())

  return {
    checkInstall: checkInstall,
    registerEventHandlers: registerEventHandlers
  }
}())

on('ready', function () {
  'use strict'
  let tries = 0
  const intId = setInterval(() => {
    if (undefined !== Counter && undefined !== Counter.ObserveCounterChange) {
      CounterTokens.checkInstall()
      CounterTokens.registerEventHandlers()
      clearInterval(intId)
    } else if (tries++ > 20) {
      clearInterval(intId)
      throw new Error("Unable to find state.Counter.ObserveCounterChange, have you installed Counter?")
    }
  }, 200)
})
