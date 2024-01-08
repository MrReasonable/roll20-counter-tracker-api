var CounterTokens = CounterTokens || (function () {
  'use strict'
  const version = '0.0.2'
  const lastUpdate = 1704566167
  const schemaVersion = 0.1
  let persistentTokens = {}
  let tokens = {}
  let debug = false
  let updateStates = {}
  let updateTimers = {}
  let counterRemoveHandlers = {}

  const checkInstall = () => {
    log('-=> CounterTokens v' + version + ' <=-  [' + (new Date(lastUpdate * 1000)) + ']')

    const storedVersion = state?.CounterTokens?.version || 0

    if (storedVersion < 0.1) {
      log('  > Updating CounterTokens Schema to v0.1 < ')
      state.CounterTokens = {
        version: version,
        schemaVersion: 0.1,
        tokens: {}
      }
    }

    log('-=>Counter Tokens schema version: [' + state.CounterTokens.schemaVersion + ']<=-')

    persistentTokens = state.CounterTokens.tokens
    debug = state.CounterTokens.debug

    if (debug) {
      log("Debugging enabled.  Disable with !counter-tokens.debug-off")
      log("Token store: ")
      log(persistentTokens)
    }

    _.each(persistentTokens, (persistentToken) => {
      if (debug) {
        log("Reattaching token: " + persistentToken.tokenName + " to counter: " + persistentToken.counterName)
      }
      attachTokenToCounterForAllPlayerPages(persistentToken)
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

    // if (_.size(findObjs({ type: 'graphic', 'imgsrc': imgSrc })) <= 0) {
    //   throw new Error("imgSrc must refer to an image in your library.  You supplied " + imgSrc)
    // }

    if (debug) {
      log("Creating token: " + tokenName + " for counter: " + counterName + " with imgSrc: " + imgSrc)
    }

    const pageIds = PageWatcher.GetAllPagesWithPlayers()

    persistentTokens[tokenName] = {
      tokenName: tokenName,
      counterName: counterName,
      imgSrc: getCleanImgSrc(imgSrc),
      pages: pageIds.reduce((acc, pageId) => {
        acc[pageId] = { imgIds: [], startY: 0, lastY: 0 }
        return acc
      }, {}),
      top: 30,
      left: 30,
      width: 25,
      height: 25,
      spaceX: 25,
      spaceY: 25,
      lastY: 30,
    }

    attachTokenToCounterForAllPlayerPages(persistentTokens[tokenName])

    if (debug) {
      log("Token created successfully:", persistentTokens[tokenName])
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
    if (persistentTokens.length <= 0) {
      return "No counter tokens attached to this game"
    }
    return "<ul>" + _.reduce(persistentTokens,
      function (acc, token, name) {
        return acc + "<li>" + name + " -> " + token.counterName + "</li>"
      }, "") + "</ul>"
  }

  const attachTokenToCounterForAllPlayerPages = (persistentToken) => {
    if (debug) {
      log("Attaching token to counter for all pages: ")
      log(persistentToken)
    }
    const pageIds = PageWatcher.GetAllPagesWithPlayers()
    if (debug) {
      log("Found pages: ")
      log(pageIds)
    }
    const tokenName = persistentToken.tokenName
    if (debug) {
      log("Found player pages: ")
      log(pageIds)
    }
    _.each(pageIds, (pageId) => attachTokenToCounter(persistentToken, pageId))
    counterRemoveHandlers[tokenName] = _.partial(onCounterRemove, tokenName)
    Counter.ObserveCounterRemove(counterRemoveHandlers[tokenName])
  }

  const attachTokenToCounter = (persistentToken, pageId) => {
    if (debug) {
      log("Attaching token to counter for page: ")
      log(pageId)
      log(persistentToken)
    }
    const tokenName = persistentToken.tokenName

    if (!('pages' in persistentToken)) {
      token.pages = { imgIds: [], startY: 0, lastY: 0 }
    }

    if (!(tokenName in tokens)) {
      tokens[tokenName] = {}
    }

    tokens[tokenName][pageId] = CounterToken.create(persistentToken, pageId)
    if (debug) {
      log("Attaching token to in memory storage for page: ")
      log(pageId)
      log(persistentToken)
    }
    const tokenForCallback = tokens[tokenName][pageId]
    Counter.ObserveCounterChange(tokenForCallback.onCounterChange)
  }

  const detachTokenFromCounter = (token, pageId) => {
    if (debug) {
      log("Detaching token for page: ")
      log(pageId)
      log(persistentTokens)
    }
    const tokenName = token.tokenName
    if (!(tokenName in tokens)) {
      if (debug) {
        log("Token not attached to counter, skipping.")
      }
      return
    }

    if (!(pageId in tokens[tokenName])) {
      if (debug) {
        log("Token not attached to counter for page, skipping.")
      }
      return
    }

    const tokenForCallback = tokens[tokenName][pageId]
    if ('onCounterChange' in (tokenForCallback)) {
      Counter.IgnoreCounterChange(tokenForCallback.onCounterChange)
    }
    if ('onClearImages' in tokenForCallback && _.isFunction(tokenForCallback.onClearImages)) {
      tokenForCallback.onClearImages()
    }
  }

  const onPageFirstPlayer = (pageId) => {
    if (debug) {
      log("Page first joined: " + pageId)
      log("Attaching tokens to counter for page: " + pageId)
    }

    _.each(persistentTokens, (persistentToken) => attachTokenToCounter(persistentToken, pageId))
  }

  const onPageNoPlayersRemaining = (pageId) => {
    if (debug) {
      log("Page players left: " + pageId)
      log("Detaching tokens from counter for page: " + pageId)
      log("Persistent tokens:")
      log(persistentTokens)
      log("In memory tokens:")
      log(tokens)
    }

    _.each(persistentTokens, (persistentToken) => {
      if (debug) {
        log("Detaching token: " + persistentToken.tokenName)
        log(persistentToken)
      }
      const tokenName = persistentToken.tokenName
      detachTokenFromCounter(persistentToken, pageId)
      delete tokens[tokenName][pageId]
      delete persistentToken.pages[pageId]
    })
  }

  const onCounterRemove = function (tokenName, counterName) {
    if (tokenName != counterName) {
      return
    }
    removeToken(tokenName)
  }

  const removeToken = function (tokenName) {
    if (!(tokenName in persistentTokens)) {
      if (tokenName in tokens) {
        delete tokens[tokenName]
      }
      return
    }

    Object.keys(persistentTokens[tokenName].pages).forEach((pageId) => {
      if (debug) {
        log("Removing token from page: " + pageId)
        log(pageToken)
      }
      detachTokenFromCounter(persistentTokens[tokenName], pageId)
    })

    delete tokens[tokenName]
    delete persistentTokens[tokenName]
  }

  const removeCollisions = (tokenName, pageId, startY, lastY) => {
    if (!(tokenName in persistentTokens)) {
      throw new Error(tokenName + " is not attached to this game.")
    }
    const token = persistentTokens[tokenName]
    //   if (lastY != persistentTokens[tokenName].lastY) {
    //     persistentTokens[tokenName].lastY = lastY
    //   }

    // _.filter(tokens[tokenName], (token) => token.pageId === pageId)
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
          log({ persistentTokens, tokens })
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
    if (debug) {
      log("Registering event handlers")
    }
    on('chat:message', handleInput)
    if (debug) {
      log("Registered chat watcher event handler")
    }
    PageWatcher.ObservePageFirstPlayer(onPageFirstPlayer)
    if (debug) {
      log("Registered first player joining page event handler")
    }
    PageWatcher.ObservePageNoPlayers(onPageNoPlayersRemaining)
    if (debug) {
      log("Registered last player leaving page event handler")
    }
  }

  const getCleanImgSrc = (imgsrc) => {

    if (debug) {
      log("Cleaning imgSrc: " + imgsrc)
    }

    const parts = imgsrc.match(/(.*\/images\/.*)(thumb|med|original|max)(.*)$/)

    if (debug) {
      log("Found image parts: ")
      log(parts)
    }

    if (parts) {
      const size = 'thumb'
      const clean = parts[1] + size + parts[3]
      if (debug) {
        log("Cleaned imgSrc: " + clean)
      }
      return clean
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

    const debounce = (key, func, wait) => {
      const timeout = updateTimers[key]
      if (timeout) {
        if (debug) {
          log(`Clearing existing timer for ${key}`)
        }
        clearTimeout(timeout)
      }
      updateTimers[key] = setTimeout(() => {
        updateTimers[key] = false
        func()
      }, wait)
    }

    const rearrangeImages = (graphicRefs, startLeft, startTop, token) => {
      const [spaceRight, spaceBottom] = [token.spaceX, token.spaceY]

      if (debug) {
        log("Rearranging images")
        log("Image refs: ")
        log(graphicRefs)
      }

      if (graphicRefs.length <= 0) {
        if (debug) {
          log("No images to rearrange.")
        }

        return
      }

      const graphicRefsId = graphicRefs[0].get('id')
      if (updateStates[graphicRefsId]) {
        debounce(graphicRefsId, () => {
          if (debug) {
            log(`Rearranging images for ${graphicRefsId} after delay.`)
          }
          rearrangeImages(graphicRefs, startLeft, startTop, spaceRight, spaceBottom)
        }, 1000)
      }

      updateStates[graphicRefsId] = true

      if (debug) {
        log("Rearranging images  with startLeft: " + startLeft + ", startTop: " + startTop + ", spaceRight: " + spaceRight + ", spaceBottom: " + spaceBottom)
        log("Image refs: ")
        log(graphicRefs)
      }

      const finalLocation = _.reduce(graphicRefs, (acc, g) => {
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
      updateStates[graphicRefsId] = false
      const pageId = graphicRefs[0].get('pageid')
      removeCollisions(token.tokenName, pageId, startTop, finalLocation.top)
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
        if (debug) {
          log("No change in position or graphic name doesn't match token, skipping.")
        }
        return
      }

      if (debug) {
        log("Keeping images together for token: " + token.tokenName)
        log("Graphic refs: ")
        log(graphicRefs)
        log("Token: ")
        log(token)
        log("Object: ")
        log(obj)
        log("Previous: ")
        log(prev)
      }      

      const [left, top] = findStartLeftAndTop(graphicRefs, obj, token.spaceX, token.spaceY)

      rearrangeImages(graphicRefs, left, top, token)
    }

    const removeTokenImages = (graphicRefs, token, pageId, numberToRemove) => {
      if (debug) {
        log("Removing " + numberToRemove + " images from token: " + token.tokenName)
      }
      const tokenImgIds = token.pages[pageId].imgIds
      const numberToKeep = tokenImgIds.length - numberToRemove - 1
      _.each(_.range(tokenImgIds.length - 1, numberToKeep, -1), (function (i) {
        const idx = findGraphicRefIndexByImgId(graphicRefs, tokenImgIds[i])
        if (debug) {
          log("Removing image: " + tokenImgIds[i] + " from token: " + token.tokenName)
        }
        const img = graphicRefs[idx]
        tokenImgIds.splice(i)
        graphicRefs.splice(idx)

        if (debug) {
          log("Removing image: ")
          log(img)
        }
        if (img) {
          img.remove()
        }
      }))
    }

    const addTokenImages = (graphicRefs, token, pageId, numberToAdd) => {
      const startValue = token.pages[pageId].imgIds.length || 0

      if (debug) {
        log(`Adding ${numberToAdd} images to token ${token.tokenName} on page ${pageId} starting at ${startValue}`)
      }

      _.each(_.range(startValue, startValue + numberToAdd), function (i) {
        const existingImages = findObjs({ type: 'graphic', name: token.tokenName + ' ' + i, pageid: pageId })
        const existingImage = existingImages.length > 0 ? existingImages[0] : null

        if (debug) {
          if (existingImage) {
            log("Found existing image for index " + i + ": ")
            log(existingImage)
          }
          else {
            log("No existing image found for index " + i + ", creating new image.")
            log("Using imgSrc from following token: ")
            log(token)
          }
        }

        const left = token.left
        const top = token.top

        const img = existingImage || createObj('graphic', {
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

        if (debug) {
          log("Created image: ")
          log(img)
        }

        graphicRefs.push(img)
        token.pages[pageId].imgIds.push(img.id)
        toFront(img)
      })
    }

    const updateImages = (graphicRefs, token, pageId, counterValue) => {
      if (debug) {
        log(`Updating images for token ${token.tokenName} on page ${pageId} with counter value ${counterValue}`)
        log("Graphic refs: ")
        log(graphicRefs)
        log("Existing token image IDs: ")
        log(token.pages[pageId].imgIds)
      }

      const graphicCount = graphicRefs.length

      if (counterValue < graphicCount) {
        if (debug) {
          log("Removing " + (graphicCount - counterValue) + " images from token: " + token.tokenName)
        }
        removeTokenImages(graphicRefs, token, pageId, token.pages[pageId].imgIds.length - counterValue)
      } else if (counterValue > graphicCount) {
        if (debug) {
          log("Adding " + (counterValue - graphicCount) + " images to token: " + token.tokenName)
        }
        addTokenImages(graphicRefs, token, pageId, counterValue - token.pages[pageId].imgIds.length)
      }
      if (graphicRefs.length <= 0) {
        return
      }
      rearrangeImages(graphicRefs, graphicRefs[0].get('left'), graphicRefs[0].get('top'), token)
    }

    //Bind each reference of on-page graphical objects to the supplied variable
    const getExistingGraphicReferences = (token, pageId) => {
      const graphics = findObjs({
        _type: 'graphic',
        _pageid: pageId
      }).filter(o => _.contains(token.pages[pageId].imgIds, o.get('id')))

      //Remove all imgIds from token for images that that haven't been found on the page.
      _.each(
        _.difference(token.pages[pageId].imgIds, _.map(graphics, (g) => g.get('id'))),
        (imgId) => token.pages[pageId].imgIds.splice(_.indexOf(token.pages[pageId].imgIds, imgId))
      )

      return graphics
    }

    const onCounterChange = (graphicRefs, token, pageId, counterName, counter) => {
      if (counterName !== token.counterName) {
        return
      }
      if (debug) {
        log("Counter changed for token: " + token.tokenName + " on page: " + pageId + " to value: " + counter.current + "from value: " + counter.prev)
      }

      try {
        const lastY = updateImages(graphicRefs, token, pageId, counter.current)
        token.lastY = lastY
      } catch (err) {
        logToChat('gm', "Unable to update Counter Token images: " + err.message)
      }
    }

    const clearImages = (graphicRefs, tokenName, pageId) => {
      _.each(graphicRefs, function (obj) {
        obj.remove()
      })
      removeCollisions(tokenName, pageId, 0, 0)
    }

    const create = (token, pageId) => {
      if (debug) {
        log("Creating CounterToken on page " + pageId + " for token: ")
        log(token)
      }

      if (!(pageId in token.pages) || !_.isArray(token.pages[pageId])) {
        token.pages[pageId] = { imgIds: [], startY: 0, lastY: 0 }
      }

      //Get all graphical objects on the page that match the token name
      const graphicRefs = getExistingGraphicReferences(token, pageId)

      const graphicsChangeHandler = _.partial(keepImagesTogether, graphicRefs, token)
      const counterChangeHandler = _.partial(onCounterChange, graphicRefs, token, pageId)
      const clearImageHandler = _.partial(clearImages, graphicRefs, token.tokenName, pageId)

      on('change:graphic', graphicsChangeHandler)

      return {
        onCounterChange: counterChangeHandler,
        onClearImages: clearImageHandler
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
  const counterIntId = setInterval(() => {
    if (undefined !== Counter && undefined !== Counter.ObserveCounterChange) {
      CounterTokens.checkInstall()
      CounterTokens.registerEventHandlers()
      clearInterval(counterIntId)
    } else if (tries++ > 20) {
      clearInterval(counterIntId)
      throw new Error("Unable to find state.Counter.ObserveCounterChange, have you installed Counter?")
    }
  }, 200)

  const pageWatchIntId = setInterval(() => {
    if (undefined !== PageWatcher) {
      clearInterval(pageWatchIntId)
    } else if (tries++ > 20) {
      clearInterval(pageWatchIntId)
      throw new Error("Unable to find state.PageWatcher.ObservePageAddPlayer, have you installed PageWatcher?")
    }
  }, 200)
})
