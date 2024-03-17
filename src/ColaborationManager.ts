// import { AppTo1CWindow } from '@/app-env'
import { connectAnonymously, ConvergenceDomain, IConvergenceEvent, IndexRange, IndexReference, LocalIndexReference, LocalRangeReference, ModelReference, RealTimeElement, RealTimeModel, RealTimeString, ReferenceSetEvent, RemoteReferenceCreatedEvent, StringInsertEvent, StringRemoveEvent, StringSetValueEvent } from '@convergence/convergence'
// import { Ace } from 'ace-builds'
import { Ace, Range } from 'ace-code'
import { AppTo1CWindow } from './app-env'
import { AceMultiCursorManager, AceMultiSelectionManager, AceRadarView } from '@convergencelabs/ace-collab-ext'
import { ColorAssigner } from '@convergence/color-assigner'

const COLABORATION_CURSOR_KEY = 'cursor'
const COLABORATION_SELECTION_KEY = 'selection'

const AceRange = Range

export type CalaborationType = 'SOURSE' | 'FORK'

export type ColaboratorEditor = Ace.Editor
export type ColaboratorEditorSession = Ace.EditSession
export type ColaboratorEditorDoc = Ace.Document

export interface CollaboratorManagerForOnesOptions {
  editor: ColaboratorEditor
  colaborationUrl: string
  colaborationType: CalaborationType
  username: string
  colabSessionId: string
  collectionId?: string
}

export class CollaboratorManagerForOnes {
  private readonly editor: ColaboratorEditor
  private readonly colaborationUrl: string
  private readonly colaborationType: CalaborationType
  private username: string
  private readonly colabSessionId: string
  private readonly editorDocument: ColaboratorEditorDoc

  collectionId: string

  domain?: ConvergenceDomain
  model?: RealTimeModel
  textModel?: RealTimeString
  cursorManager?: AceMultiCursorManager
  cursorReference?: LocalIndexReference
  selectionManager?: AceMultiSelectionManager
  selectionReference?: LocalRangeReference

  radarView?: AceRadarView

  colorAssigner: ColorAssigner
  suppressEvents: boolean

  constructor(options: CollaboratorManagerForOnesOptions) {
    this.editor = options.editor
    this.colaborationUrl = options.colaborationUrl
    this.colaborationType = options.colaborationType
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
    connectAnonymously(this.colaborationUrl, this.username)
      .then(this.handlerDomainOpen.bind(this))
      .catch(error => {
        console.log('Connection failure', error)
      })
  }

  close() {
    if (!this.domain) {
      return
    }
    if (!this.domain.isDisconnected()) {
      this.domain.disconnect()
    }
    if (!this.domain.isDisposed()) {
      this.domain.dispose()
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

    this.initTextColaboration()
    // this.initCursorColaboration()
    this.initSelectionColaboration()

    // this.model.root().on('model_changed', evt => {
    //   console.log('model change', evt)
    // })

    this.textModel.on('reference', this.handlerTextModelReferenceEvent.bind(this))

    //отправляем или принимаем значения
    if (this.colaborationType === 'SOURSE') {
      console.log('SOURSE')
      this.textModel.value(this.editor.getValue())
    } else {
      this.suppressEvents = true
      this.editorDocument.setValue(this.textModel.value())
      this.suppressEvents = false
    }
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
    this.cursorManager = new AceMultiCursorManager(this.editor.getSession())
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
    this.selectionManager = new AceMultiSelectionManager(this.editor.getSession())
    this.selectionReference = this.textModel.rangeReference(COLABORATION_SELECTION_KEY)

    this.editor.on('changeSelection', this.handlerEditorChangeSelectionEvent.bind(this))

    const selectionsReferences = this.textModel.references({ key: COLABORATION_SELECTION_KEY })
    selectionsReferences.forEach((reference: any) => {
      if (!reference.isLocal()) {
        this.addSelection(reference)
      }
    })
    this.setLocalSelection()
    this.selectionReference.share()
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
    if (!this.cursorManager) {
      return
    }
    console.log('addCursor', reference)
    const displayName = reference.user().displayName || 'User' + Date.now()

    const color = this.colorAssigner.getColorAsHex(reference.sessionId())
    const remoteCursorIndex = reference.value()
    this.cursorManager.addCursor(reference.sessionId(), displayName, color, remoteCursorIndex)
    reference.on('cleared', () => {
      this.cursorManager?.clearCursor(reference.sessionId())
    })
    reference.on('disposed', () => {
      this.cursorManager?.removeCursor(reference.sessionId())
    })
    reference.on('set', () => {
      if (!this.cursorManager) {
        return
      }
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
    if (!this.selectionManager) {
      return
    }
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
    reference.on('cleared', () => this.selectionManager?.clearSelection(reference.sessionId()))
    reference.on('disposed', () => this.selectionManager?.removeSelection(reference.sessionId()))
    reference.on('set', (ev: any) => {
      console.log('set', ev)

      const newSelectionsRanges: Ace.Range[] = []

      for (const refvalue of reference.values()) {
        const newRange = this.toAceRange(refvalue)
        if (!newRange) {
          continue
        }
        newSelectionsRanges.push(newRange)
      }

      this.selectionManager?.setSelection(reference.sessionId(), newSelectionsRanges)
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

    console.log('VALUE', event)
    this.suppressEvents = true
    this.editorDocument.setValue(this.textModel.value())
    this.suppressEvents = false
  }

  private handlerTextModelOnRealTimeStringEventsREMOVE(evt: IConvergenceEvent) {
    console.log(evt)

    const event = evt as StringRemoveEvent
    const start = this.editorDocument.indexToPosition(event.index, 0)
    const end = this.editorDocument.indexToPosition(event.index + event.value.length, 0)
    this.suppressEvents = true
    this.editorDocument.remove(new AceRange(start.row, start.column, end.row, end.column))
    this.suppressEvents = false
  }

  private handlerTextModelOnRealTimeStringEventsINSERT(evt: IConvergenceEvent) {
    const event = evt as StringInsertEvent
    console.log('INSERT', evt)
    const pos = this.editorDocument.indexToPosition(event.index, 0)
    this.suppressEvents = true
    this.editorDocument.insert(pos, event.value)
    this.suppressEvents = false
  }

  private handlerTextModelReferenceEvent(evt: IConvergenceEvent) {
    const event = evt as RemoteReferenceCreatedEvent

    const refkey: string = event.reference.key()

    if (refkey === COLABORATION_CURSOR_KEY) {
      this.addCursor(event.reference)
    } else if (refkey === COLABORATION_SELECTION_KEY) {
      this.addSelection(event.reference)
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
}

declare var window: AppTo1CWindow
