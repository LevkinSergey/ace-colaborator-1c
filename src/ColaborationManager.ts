// import { AppTo1CWindow } from '@/app-env'
import { CancellationToken, CollaboratorClosedEvent, CollaboratorOpenedEvent, connectAnonymously, ConvergenceDomain, IConvergenceEvent, IndexRange, IndexReference, LocalIndexReference, LocalRangeReference, ModelCollaborator, ModelReference, RealTimeElement, RealTimeModel, RealTimeString, ReferenceClearedEvent, ReferenceSetEvent, RemoteReferenceCreatedEvent, StringInsertEvent, StringRemoveEvent, StringSetValueEvent } from '@convergence/convergence'
// import { Ace } from 'ace-builds'
import { Ace, Range } from 'ace-code'
import { AppTo1CWindow } from './app-env'
import { AceMultiCursorManager, AceMultiSelectionManager, AceRadarView, AceViewportUtil } from '@convergencelabs/ace-collab-ext'
import { ColorAssigner } from '@convergence/color-assigner'

const COLABORATION_CURSOR_KEY = 'cursor'
const COLABORATION_SELECTION_KEY = 'selection'
const COLABORATION_VIEW_KEY = 'view'

const AceRange = Range

export type ColaboratorEditor = Ace.Editor
export type ColaboratorEditorSession = Ace.EditSession
export type ColaboratorEditorDoc = Ace.Document

export type ColaborationCloseCallback = () => void

export interface CollaboratorManagerForOnesOptions {
  editor: ColaboratorEditor
  colaborationUrl: string
  username: string
  colabSessionId: string
  collectionId?: string
}

export class CollaboratorManagerForOnes {
  private readonly editor: ColaboratorEditor
  private readonly colaborationUrl: string
  private username: string
  private readonly colabSessionId: string
  private readonly editorDocument: ColaboratorEditorDoc
  private readonly cancelationToken: CancellationToken

  private readonly selectionManager: AceMultiSelectionManager
  private readonly cursorManager: AceMultiCursorManager
  private readonly radarView?: AceRadarView

  collectionId: string
  cursors: Record<string, string>
  selections: Record<string, string>

  domain?: ConvergenceDomain
  model?: RealTimeModel
  textModel?: RealTimeString

  cursorReference?: LocalIndexReference
  selectionReference?: LocalRangeReference
  viewReference?: LocalRangeReference

  colorAssigner: ColorAssigner
  suppressEvents: boolean

  constructor(options: CollaboratorManagerForOnesOptions) {
    this.editor = options.editor
    this.colaborationUrl = options.colaborationUrl
    this.username = options.username
    this.colabSessionId = options.colabSessionId

    if (options.collectionId) {
      this.collectionId = options.collectionId
    } else {
      this.collectionId = 'ace-for-1c'
    }

    this.editorDocument = this.editor.getSession().getDocument()

    this.suppressEvents = false
    this.colorAssigner = new ColorAssigner()
    this.cancelationToken = new CancellationToken()

    const session = this.editor.getSession()
    this.selectionManager = new AceMultiSelectionManager(session)
    this.cursorManager = new AceMultiCursorManager(session)

    const radarViewElement = document.getElementById('radar-view')
    if (radarViewElement) {
      this.radarView = new AceRadarView(radarViewElement, this.editor)
    }

    this.cursors = {}
    this.selections = {}
  }

  setUserName(name: string) {
    if (!name) {
      return
    }
    this.username = name
  }

  isConnected(): boolean {
    if (!this.domain) {
      return false
    }

    return true
  }

  connect() {
    if (this.domain) {
      if (this.domain.isConnected()) {
        return
      }
    }
    connectAnonymously(this.colaborationUrl, this.username, undefined, this.cancelationToken)
      .then(this.handlerDomainOpen.bind(this))
      .catch(error => {
        console.log('Connection failure', error)
      })
  }

  close(callback: ColaborationCloseCallback) {
    if (this.cursorReference) {
      this.cursorReference.removeAllListeners()
      this.cursorReference.unshare()
      this.cursorReference.dispose()
    }
    if (this.selectionReference) {
      this.selectionReference.removeAllListeners()
      this.selectionReference.unshare()
      this.selectionReference.dispose()
    }
    if (this.viewReference) {
      this.viewReference.removeAllListeners()
      this.viewReference.unshare()
      this.viewReference.dispose()
    }

    if (this.textModel) {
      this.textModel.references().forEach(val => {
        val.removeAllListeners()
      })
      this.textModel.removeAllListeners()
    }
    if (this.model) {
      this.model.removeAllListeners()
      this.model
        .close()
        .then(() => {
          this.cancelationToken.cancel()

          delete this.cursorReference
          delete this.selectionReference
          delete this.viewReference
          delete this.textModel
          delete this.model
          delete this.domain

          console.log('model close')

          callback()
        })
        .catch(error => {
          console.log('model close error', error)
        })
    }
  }

  private handlerDomainOpen(domain: ConvergenceDomain) {
    domain
      .models()
      .openAutoCreate({
        id: this.colabSessionId,
        collection: this.collectionId,
        ephemeral: true,
        data: {
          text: ''
        }
      })
      .then(this.handlerModelOpen.bind(this))
      .catch(error => {
        console.log('Could not open the model', error)
      })
  }

  private handlerModelOpen(model: RealTimeModel) {
    this.model = model
    this.textModel = this.model.elementAt('text') as RealTimeString

    this.textModel.on('reference', this.handlerTextModelReferenceEvent.bind(this))

    const firsConnection = this.model.collaborators().length === 1

    this.initTextColaboration()
    // this.initRadarView()
    if (!firsConnection) {
      this.initCursorColaboration()
      this.initSelectionColaboration()
    }

    // this.model.root().on('model_changed', evt => {
    //   console.log('model change', evt)
    // })

    //отправляем или принимаем значения
    //Если первые, значит наше код будут смотреть
    if (this.model.collaborators().length === 1) {
      this.textModel.value(this.editor.getValue())
    } else {
      this.suppressEvents = true
      this.editorDocument.setValue(this.textModel.value())
      this.suppressEvents = false
    }

    this.model.on(RealTimeModel.Events.COLLABORATOR_OPENED, this.handlerCollaboratorOpenedEvent.bind(this))
    this.model.on(RealTimeModel.Events.COLLABORATOR_CLOSED, this.handlerColaboratorCloseEvent.bind(this))
    this.model.on(RealTimeModel.Events.REFERENCE, even => {
      console.log('RealTimeModel.Events.REFERENCE', even)
    })
  }

  private initTextColaboration() {
    if (!this.textModel) {
      return
    }
    this.textModel.on(RealTimeString.Events.VALUE, this.handlerTextModelOnRealTimeStringEventsVALUE.bind(this))
    this.textModel.on(RealTimeString.Events.INSERT, this.handlerTextModelOnRealTimeStringEventsINSERT.bind(this))
    this.textModel.on(RealTimeString.Events.REMOVE, this.handlerTextModelOnRealTimeStringEventsREMOVE.bind(this))

    this.editor.on('change', this.handlerEditorChangeEvent.bind(this))
  }

  private initCursorColaboration() {
    if (!this.textModel) {
      return
    }
    this.cursorReference = this.textModel.indexReference(COLABORATION_CURSOR_KEY)

    this.editor.getSession().selection.on('changeCursor', this.handlerEditorChangeCursorEvent.bind(this))

    const cursorReferences = this.textModel.references({ key: COLABORATION_CURSOR_KEY })
    cursorReferences.forEach((reference: ModelReference) => {
      if (!reference.isLocal()) {
        this.addCursor(reference)
      }
    })

    this.setLocalCursor()
    this.cursorReference.share()
  }

  private initSelectionColaboration() {
    if (!this.textModel) {
      return
    }

    this.selectionReference = this.textModel.rangeReference(COLABORATION_SELECTION_KEY)

    this.setLocalSelection()
    this.selectionReference.share()

    this.editor.on('changeSelection', this.handlerEditorChangeSelectionEvent.bind(this))

    console.log('this.model?.collaborators()', this.model?.collaborators())
    const selectionsReferences = this.textModel.references({ key: COLABORATION_SELECTION_KEY })
    console.log('selectionsReferences', selectionsReferences)
    selectionsReferences.forEach((reference: any) => {
      if (!reference.isLocal()) {
        this.addSelection(reference)
      }
    })
  }

  private initRadarView() {
    if (!this.textModel) {
      return
    }
    this.viewReference = this.textModel.rangeReference(COLABORATION_VIEW_KEY)

    const references = this.textModel.references({ key: COLABORATION_VIEW_KEY })
    references.forEach((reference: any) => {
      if (!reference.isLocal()) {
        this.addView(reference)
      }
    })

    this.editor.session.on('changeScrollTop', () => {
      setTimeout(() => this.setLocalView(), 0)
    })

    setTimeout(() => {
      if (!this.viewReference) {
        return
      }
      this.setLocalView()
      this.viewReference.share()
    }, 0)
  }

  private setLocalCursor() {
    if (!this.cursorReference) {
      return
    }

    const position = this.editor.getCursorPosition()
    const index = this.editorDocument.positionToIndex(position)
    this.cursorReference.set(index)
  }

  private addCursor(reference: ModelReference<number>) {
    const cursor = this.cursors[reference.sessionId()]
    if (cursor) {
      return
    }
    this.cursors[reference.sessionId()] = reference.sessionId()

    console.log('addCursor', reference)
    const displayName = reference.user().displayName || 'User' + Date.now()

    const color = this.colorAssigner.getColorAsHex(reference.sessionId())
    const remoteCursorIndex = reference.value()
    this.cursorManager.addCursor(reference.sessionId(), displayName, color, remoteCursorIndex)
    reference.on(ModelReference.Events.CLEARED, () => {
      this.cursorManager.clearCursor(reference.sessionId())
    })
    reference.on(ModelReference.Events.DISPOSED, () => {
      this.cursorManager.removeCursor(reference.sessionId())
    })
    reference.on(ModelReference.Events.SET, () => {
      const cursorIndex = reference.value()
      const cursorRow = this.editorDocument.indexToPosition(cursorIndex, 0).row
      this.cursorManager.setCursor(reference.sessionId(), cursorIndex)
      if (this.radarView) {
        if (this.radarView.hasView(reference.sessionId())) {
          this.radarView.setCursorRow(reference.sessionId(), cursorRow)
        }
      }
    })
  }

  private setLocalSelection() {
    if (!this.selectionReference) {
      return
    }
    console.log('this.editor.selection.isEmpty()', this.editor.selection.isEmpty())
    if (!this.editor.selection.isEmpty()) {
      const indexRanges: IndexRange[] = []

      for (const curAceRagne of this.editor.selection.getAllRanges()) {
        const start = this.editorDocument.positionToIndex(curAceRagne.start, 0)
        const end = this.editorDocument.positionToIndex(curAceRagne.end, 0)
        indexRanges.push({ start: start, end: end })
      }
      console.log('indexRanges', indexRanges)
      this.selectionReference.set(indexRanges)
    } else if (this.selectionReference.isSet() && !this.selectionReference.isDisposed()) {
      this.selectionReference.clear()
    }
  }

  private addSelection(reference: ModelReference<number>) {
    const select = this.selections[reference.sessionId()]
    if (select) {
      return
    }
    this.selections[reference.sessionId()] = reference.sessionId()

    const color = this.colorAssigner.getColorAsHex(reference.sessionId())
    const remoteSelections: Ace.Range[] = []

    for (const refvalue of reference.values()) {
      const newRange = this.toAceRange(refvalue)
      if (!newRange) {
        continue
      }
      remoteSelections.push(newRange)
    }

    // const remoteSelection = reference.values().map((range: any) => {
    //   console.log('remoteSelection range: any', range)

    //   return this.toAceRange(range)
    // })

    this.selectionManager.addSelection(reference.sessionId(), reference.user().username, color, remoteSelections)
    reference.on(ModelReference.Events.CLEARED, () => {
      console.log('ReferenceClearedEvent.NAME')

      this.selectionManager.clearSelection(reference.sessionId())
    })
    reference.on(ModelReference.Events.DISPOSED, () => {
      this.selectionManager.removeSelection(reference.sessionId())
    })
    reference.on(ModelReference.Events.SET, (ev: any) => {
      console.log('set', ev)
      const newSelectionsRanges: Ace.Range[] = []

      for (const refvalue of reference.values()) {
        const newRange = this.toAceRange(refvalue)
        if (!newRange) {
          continue
        }
        newSelectionsRanges.push(newRange)
      }

      this.selectionManager.setSelection(reference.sessionId(), newSelectionsRanges)
    })
  }

  private handlerEditorChangeEvent(delta: Ace.Delta) {
    if (this.suppressEvents) {
      return
    }

    if (!this.textModel) {
      return
    }

    const pos = this.editorDocument.positionToIndex(delta.start)
    switch (delta.action) {
      case 'insert':
        console.log('insert', delta)
        this.textModel.insert(pos, delta.lines.join('\n'))
        break
      case 'remove':
        console.log('remove', delta)
        this.textModel.remove(pos, delta.lines.join('\n').length)
        break
      default:
        throw new Error('unknown action: ' + delta.action)
    }
  }

  private handlerEditorChangeCursorEvent(ev: any) {
    console.log('handlerEditorChangeCursorEvent')
    this.setLocalCursor()
  }

  private handlerEditorChangeSelectionEvent(ev: any) {
    console.log(ev)
    this.setLocalSelection()
  }

  private handlerTextModelOnRealTimeStringEventsVALUE(evt: IConvergenceEvent) {
    if (!this.textModel) {
      return
    }

    const event = evt as StringSetValueEvent

    this.suppressEvents = true
    this.editorDocument.setValue(this.textModel.value())
    this.suppressEvents = false
  }

  private handlerTextModelOnRealTimeStringEventsREMOVE(evt: IConvergenceEvent) {
    const event = evt as StringRemoveEvent
    const start = this.editorDocument.indexToPosition(event.index, 0)
    const end = this.editorDocument.indexToPosition(event.index + event.value.length, 0)
    this.suppressEvents = true
    this.editorDocument.remove(new AceRange(start.row, start.column, end.row, end.column))
    this.suppressEvents = false
  }

  private handlerTextModelOnRealTimeStringEventsINSERT(evt: IConvergenceEvent) {
    const event = evt as StringInsertEvent

    const pos = this.editorDocument.indexToPosition(event.index, 0)
    this.suppressEvents = true
    this.editorDocument.insert(pos, event.value)
    this.suppressEvents = false
  }

  private handlerTextModelReferenceEvent(evt: IConvergenceEvent) {
    const event = evt as RemoteReferenceCreatedEvent
    console.log('handlerTextModelReferenceEvent', evt)
    const refkey: string = event.reference.key()

    if (refkey === COLABORATION_CURSOR_KEY) {

      this.addCursor(event.reference)
      if (!this.cursorReference) {
        this.initCursorColaboration()
      }
    } else if (refkey === COLABORATION_SELECTION_KEY) {
      this.addSelection(event.reference)
      if (!this.selectionReference) {
        this.initSelectionColaboration()
      }
    } else if (refkey === COLABORATION_VIEW_KEY) {
      this.addView(event.reference)
    }
  }

  private toAceRange(range: any) {
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

    const rangeAnchor = this.editorDocument.indexToPosition(start, 0)
    const rangeLead = this.editorDocument.indexToPosition(end, 0)

    return new AceRange(rangeAnchor.row, rangeAnchor.column, rangeLead.row, rangeLead.column)
  }

  private setLocalView() {
    if (!this.viewReference) {
      return
    }
    const viewportIndices = AceViewportUtil.getVisibleIndexRange(window.editor)
    this.viewReference.set({ start: viewportIndices.start, end: viewportIndices.end })
  }

  private addView(reference: any) {
    if (!this.radarView) {
      return
    }
    const color = this.colorAssigner.getColorAsHex(reference.sessionId())

    // fixme need the cursor
    let cursorRow = 0
    let viewRows = null

    if (reference.isSet()) {
      const remoteViewIndices = reference.value()
      viewRows = AceViewportUtil.indicesToRows(window.editor, remoteViewIndices.start, remoteViewIndices.end)
    }

    if (viewRows) {
      this.radarView.addView(reference.sessionId(), reference.user().username, color, viewRows, cursorRow)
    }

    // fixme need to implement this on the ace collab side
    reference.on(ModelReference.Events.CLEARED, () => {
      if (!this.radarView) {
        return
      }
      this.radarView.clearView(reference.sessionId())
    })
    reference.on(ModelReference.Events.DISPOSED, () => {
      if (!this.radarView) {
        return
      }
      this.radarView.removeView(reference.sessionId())
    })
    reference.on(ModelReference.Events.SET, () => {
      if (!this.radarView) {
        return
      }
      const v = reference.value()
      const rows = AceViewportUtil.indicesToRows(window.editor, v.start, v.end)
      this.radarView.setViewRows(reference.sessionId(), rows)
    })
  }

  private handlerColaboratorCloseEvent(evt: IConvergenceEvent) {
    const event = evt as CollaboratorClosedEvent

    console.log(evt)
  }

  private handlerCollaboratorOpenedEvent(evt: IConvergenceEvent) {
    const event = evt as CollaboratorOpenedEvent

    console.log(evt)
  }
}

declare var window: AppTo1CWindow
