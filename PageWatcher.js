var PageWatcher = PageWatcher || (function () {
  'use strict'
  const version = '0.0.1'
  const lastUpdate = 1704566167
  const schemaVersion = 0.1
  const observers = {
    pageAddPlayer: [],
    pageRemovePlayer: [],
    pageFirstPlayer: [],
    pageNoPlayers: [],
  }

  const checkInstall = () => {
    log('-=> PageWatcher v' + version + ' <=-  [' + (new Date(lastUpdate * 1000)) + ']')
    if (!_.has(state, 'PageWatcher') || state.PageWatcher.version === undefined || state.PageWatcher.version < schemaVersion) {
      log('  > Updating Schema to v' + schemaVersion + ' <')
      if (!_.has(state, 'PageWatcher')
        || state.PageWatcher.version === undefined
        || state.PageWatcher.version < 0.1) {
        state.PageWatcher = {
          version: 0.1,
        }
      }
    }
  }

  const registerObserver = (observer, type) => {
    if (undefined === observers[type]) {
      throw new Error(`Unknown observer type ${type}, observer must be one 'pageAddPlayer', 'pageRemovePlayer', 'pageFirstPlayer', or 'pageNoPlayers'`)
    }
    observers[type].push(observer)
  }

  const unregisterObserver = (observer, type) => {
    if (undefined === observers[type]) {
      throw new Error(`Unknown observer type ${type}, observer must be one 'pageAddPlayer', 'pageRemovePlayer', 'pageFirstPlayer', or 'pageNoPlayers'`)
    }
    observers[type] = observers[type].filter(o => o !== observer)
  }

  const handleChange = (obj, prev) => {

    const pageCount = (acc, page) => {
      const count = acc[page] ? acc[page] + 1 : 1
      return { ...acc, [page]: count }
    }

    const allPrevPages = [prev['playerpageid'], ...Object.values(prev['playerspecificpages'])]
    const allCurrPages = [obj.get('playerpageid'), ...Object.values(obj.get('playerspecificpages'))]
    const prevPlayerPages = _.uniq(allPrevPages)
    const currPlayerPages = _.uniq(allCurrPages)
    const pagesWithNoPlayers = _.difference(prevPlayerPages, currPlayerPages)
    const pagesWithFirstPlayer = _.difference(currPlayerPages, prevPlayerPages)
    const prevPlayerPageCount = _.reduce(allPrevPages, pageCount, {})
    const currPlayerPageCount = _.reduce(allCurrPages, pageCount, {})
    const pagesWithAddedPlayers = Object.keys(currPlayerPageCount).filter(p => currPlayerPageCount[p] > (prevPlayerPageCount[p] || 0) && currPlayerPageCount[p] > 0)
    const pagesWithRemovedPlayers = Object.keys(prevPlayerPageCount).filter(p => prevPlayerPageCount[p] > (currPlayerPageCount[p] || 0) && currPlayerPageCount[p] > 0)

    if (pagesWithAddedPlayers.length > 0) {
      _.each(pagesWithAddedPlayers, p => notifyObservers('pageAddPlayer', p))
    }

    if (pagesWithNoPlayers.length > 0) {
      _.each(pagesWithNoPlayers, p => notifyObservers('pageNoPlayers', p))
    }

    if (pagesWithRemovedPlayers.length > 0) {
      _.each(pagesWithRemovedPlayers, p => notifyObservers('pageRemovePlayer', p))
    }

    if (pagesWithFirstPlayer.length > 0) {
      _.each(pagesWithFirstPlayer, p => notifyObservers('pageFirstPlayer', p))
    }
  }

  const notifyObservers = (type, page) => {
    if (undefined === observers[type]) {
      throw new Error(`Unknown observer type ${type}, observer must be one 'pageAddPlayer', 'pageRemovePlayer', 'pageFirstPlayer', or 'pageNoPlayers'`)
    }
    observers[type].forEach(o => o(page))
  }

  const getAllPagesWithPlayers = () => _.uniq(
    [Campaign().get('playerpageid'), ...Object.values(Campaign().get('playerspecificpages'))]
  )

  on('change:campaign:playerpageid', (obj, prev) => {
    handleChange(obj, prev)
  })

  on('change:campaign:playerspecificpages', (obj, prev) => {
    handleChange(obj, prev)
  })

  return {
    GetAllPagesWithPlayers: getAllPagesWithPlayers,
    CheckInstall: checkInstall,
    ObservePageAddPlayer: (observer) => registerObserver(observer, 'pageAddPlayer'),
    ObservePageRemovePlayer: (observer) => registerObserver(observer, 'pageRemovePlayer'),
    ObservePageFirstPlayer: (observer) => registerObserver(observer, 'pageFirstPlayer'),
    ObservePageNoPlayers: (observer) => registerObserver(observer, 'pageNoPlayers'),
  }
}())

on('ready', () => {
  'use strict'
  PageWatcher.CheckInstall()
})