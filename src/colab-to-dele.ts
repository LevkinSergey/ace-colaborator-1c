import { AceMultiCursorManager, AceMultiSelectionManager, AceRadarView, AceViewportUtil } from '@convergencelabs/ace-collab-ext'
import Convergence, { connectAnonymously, ConvergenceDomain, RealTimeModel, RealTimeElement } from '@convergence/convergence'
// import { ColorAssigner } from '@convergence/color-assigner'
import ace from 'ace-builds'
import { AppTo1CWindow } from '../app-env'

export const CONVERGENCE_URL = 'http://192.168.110.35:9000/api/realtime/convergence/default'
const username = 'Sergey'

const convergenceExampleId = (function () {
  function createUUID() {
    let dt = new Date().getTime()
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (dt + Math.random() * 16) % 16 | 0
      dt = Math.floor(dt / 16)
      return (c == 'x' ? r : (r & 0x3) | 0x8).toString(16)
    })
    return uuid
  }

  const url = new URL(location.href)
  let id = url.searchParams.get('id')
  if (!id) {
    id = createUUID()
    url.searchParams.append('id', id)
    window.history.pushState({}, '', url.href)
  }
  return id
})()

export const connectColab = () => {
  Convergence.connectAnonymously(CONVERGENCE_URL, username)
    .then(domain => {
      // domain = d
      // Now open the model, creating it using the initial data if it does not exist.
      return domain.models().openAutoCreate({
        collection: 'example-ace',
        id: convergenceExampleId,
        ephemeral: true,
        data: { text: 'Процедура Сообщий() Экспорт \n ф=1; \n КонецПроцедуры' }
      })
    })
    .then(handleOpen)
    .catch(error => {
      console.error('Could not open model ', error)
    })
}

const AceRange = ace.require('ace/range').Range

// const colorAssigner = new ColorAssigner()

// let editor = null
// let session = null
// let doc = null

function handleOpen(model: RealTimeModel) {
  const textModel = model.elementAt('text')
  // Listen to course-grained events on the entire model
  textModel.root().on('model_changed', evt => {
    console.log('change')
  })
  initModel(textModel)
  initSharedCursors(textModel)
  initSharedSelection(textModel)

  const radarViewElement = document.getElementById('radar-view')
  initRadarView(textModel, radarViewElement)
}

/////////////////////////////////////////////////////////////////////////////
// Text Binding
/////////////////////////////////////////////////////////////////////////////
let suppressEvents = false

function initModel(textModel: RealTimeElement<string>) {
  const session = window.editor.getSession()
  session.setValue(textModel.value())

  const doc = session.getDocument()

  textModel.on('insert', e => {
    console.log('textModelinsert', e)
    // const pos = doc.indexToPosition(e.index)
    // suppressEvents = true
    // doc.insert(pos, e.value)
    // suppressEvents = false
  })

  textModel.on('remove', e => {
    console.log('textModelremove', e)
    // const start = doc.indexToPosition(e.index)
    // const end = doc.indexToPosition(e.index + e.value.length)
    // suppressEvents = true
    // doc.remove(new AceRange(start.row, start.column, end.row, end.column))
    // suppressEvents = false
  })

  textModel.on('value', function (e) {
    console.log('textModelvalue', e)
    // suppressEvents = true
    // doc.setValue(e.value)
    // suppressEvents = false
  })

  window.editor.on('change', delta => {
    if (suppressEvents) {
      return
    }

    const pos = doc.positionToIndex(delta.start)
    switch (delta.action) {
      case 'insert':
        console.log('insert', delta)
        textModel.insert(pos, delta.lines.join('\n'))
        break
      case 'remove':
        console.log('remove', delta)
        textModel.remove(pos, delta.lines.join('\n').length)
        break
      default:
        throw new Error('unknown action: ' + delta.action)
    }
  })
}

/////////////////////////////////////////////////////////////////////////////
// Cursor Binding
/////////////////////////////////////////////////////////////////////////////
const cursorKey = 'cursor'
let cursorReference: any = null
let cursorManager: any = null

function initSharedCursors(textElement: any) {
  cursorManager = new AceMultiCursorManager(window.editor.getSession())
  cursorReference = textElement.indexReference(cursorKey)

  const references = textElement.references({ key: cursorKey })
  references.forEach((reference: any) => {
    if (!reference.isLocal()) {
      addCursor(reference)
    }
  })

  setLocalCursor()
  cursorReference.share()

  window.editor.getSession().selection.on('changeCursor', () => setLocalCursor())

  textElement.on('reference', (e: any) => {
    if (e.reference.key() === cursorKey) {
      addCursor(e.reference)
    }
  })
}

function setLocalCursor() {
  const position = window.editor.getCursorPosition()
  const doc = window.editor.session.getDocument()

  const index = doc.positionToIndex(position)
  cursorReference.set(index)
}

function addCursor(reference: any) {
  const doc = window.editor.session.getDocument()
  // const color = colorAssigner.getColorAsHex(reference.sessionId())
  const remoteCursorIndex = reference.value()
  cursorManager.addCursor(reference.sessionId(), reference.user().displayName, '#008000', remoteCursorIndex)

  reference.on('cleared', () => cursorManager.clearCursor(reference.sessionId()))
  reference.on('disposed', () => cursorManager.removeCursor(reference.sessionId()))
  reference.on('set', () => {
    const cursorIndex = reference.value()
    // const cursorRow = doc.indexToPosition(cursorIndex).row
    // cursorManager.setCursor(reference.sessionId(), cursorIndex)

    // if (radarView.hasView(reference.sessionId())) {
    //   radarView.setCursorRow(reference.sessionId(), cursorRow)
    // }
  })
}

/////////////////////////////////////////////////////////////////////////////
// Selection Binding
/////////////////////////////////////////////////////////////////////////////
let selectionManager: any = null
let selectionReference: any = null
const selectionKey = 'selection'

function initSharedSelection(textModel: any) {
  selectionManager = new AceMultiSelectionManager(window.editor.getSession())

  selectionReference = textModel.rangeReference(selectionKey)
  setLocalSelection()
  selectionReference.share()

  window.editor.session.selection.on('changeSelection', () => setLocalSelection())

  const references = textModel.references({ key: selectionKey })
  references.forEach((reference: any) => {
    if (!reference.isLocal()) {
      addSelection(reference)
    }
  })

  textModel.on('reference', (e: any) => {
    if (e.reference.key() === selectionKey) {
      addSelection(e.reference)
    }
  })
}

function setLocalSelection() {
  const doc = window.editor.session.getDocument()
  if (!window.editor.selection.isEmpty()) {
    const aceRanges = window.editor.selection.getAllRanges()
    const indexRanges = aceRanges.map(aceRagne => {
      const start = doc.positionToIndex(aceRagne.start)
      const end = doc.positionToIndex(aceRagne.end)
      return { start: start, end: end }
    })

    selectionReference.set(indexRanges)
  } else if (selectionReference.isSet()) {
    selectionReference.clear()
  }
}

function addSelection(reference: any) {
  // const color = colorAssigner.getColorAsHex(reference.sessionId())
  const remoteSelection = reference.values().map((range: any) => toAceRange(range))
  selectionManager.addSelection(reference.sessionId(), reference.user().username, '#151568', remoteSelection)

  reference.on('cleared', () => selectionManager.clearSelection(reference.sessionId()))
  reference.on('disposed', () => selectionManager.removeSelection(reference.sessionId()))
  reference.on('set', () => {
    selectionManager.setSelection(
      reference.sessionId(),
      reference.values().map((range: any) => toAceRange(range))
    )
  })
}

function toAceRange(range: any) {
  if (typeof range !== 'object') {
    return null
  }

  let start = range.start
  let end = range.end

  if (start > end) {
    const temp = start
    start = end
    end = temp
  }
  const doc = window.editor.session.getDocument()

  const rangeAnchor = doc.indexToPosition(start, 0)
  const rangeLead = doc.indexToPosition(end, 0)
  return new AceRange(rangeAnchor.row, rangeAnchor.column, rangeLead.row, rangeLead.column)
}

/////////////////////////////////////////////////////////////////////////////
// Radar View Binding
/////////////////////////////////////////////////////////////////////////////
let radarView: any = null
let viewReference: any = null
const viewKey = 'view'

function initRadarView(textModel: any, radarViewElement: any) {
  radarView = new AceRadarView(radarViewElement, window.editor)
  viewReference = textModel.rangeReference(viewKey)

  const references = textModel.references({ key: viewKey })
  references.forEach((reference: any) => {
    if (!reference.isLocal()) {
      addView(reference)
    }
  })

  window.editor.session.on('changeScrollTop', () => {
    setTimeout(() => setLocalView(), 0)
  })

  textModel.on('reference', (e: any) => {
    if (e.reference.key() === viewKey) {
      addView(e.reference)
    }
  })

  setTimeout(() => {
    setLocalView()
    viewReference.share()
  }, 0)
}

function setLocalView() {
  const viewportIndices = AceViewportUtil.getVisibleIndexRange(window.editor)
  viewReference.set({ start: viewportIndices.start, end: viewportIndices.end })
}

function addView(reference: any) {
  // const color = colorAssigner.getColorAsHex(reference.sessionId())

  // fixme need the cursor
  let cursorRow = null
  let viewRows = null

  if (reference.isSet()) {
    const remoteViewIndices = reference.value()
    viewRows = AceViewportUtil.indicesToRows(window.editor, remoteViewIndices.start, remoteViewIndices.end)
  }

  radarView.addView(reference.sessionId(), reference.user().username, '#897941', viewRows, cursorRow)

  // fixme need to implement this on the ace collab side
  reference.on('cleared', () => radarView.clearView(reference.sessionId()))
  reference.on('disposed', () => radarView.removeView(reference.sessionId()))
  reference.on('set', () => {
    const v = reference.value()
    const rows = AceViewportUtil.indicesToRows(window.editor, v.start, v.end)
    radarView.setViewRows(reference.sessionId(), rows)
  })
}

declare var window: AppTo1CWindow
