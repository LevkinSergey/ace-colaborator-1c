// import { AppTo1CWindow } from '@/app-env'
import { connectAnonymously, ConvergenceDomain, IConvergenceEvent, IndexReference, LocalIndexReference, ModelReference, RealTimeElement, RealTimeModel, RealTimeString, RemoteReferenceCreatedEvent, StringInsertEvent, StringRemoveEvent, StringSetValueEvent } from '@convergence/convergence'
import ace, { Ace } from 'ace-builds'
import { AppTo1CWindow } from './app-env'
import { AceMultiCursorManager, AceRadarView } from '@convergencelabs/ace-collab-ext'
import { ColorAssigner } from '@convergence/color-assigner'

const COLABORATION_CURSOR_KEY = 'cursor'

const AceRange = ace.require('ace/range').Range

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

  collectionId: string

  domain?: ConvergenceDomain
  editorSession?: ColaboratorEditorSession
  editorDocument?: ColaboratorEditorDoc
  model?: RealTimeModel
  textModel?: RealTimeString
  cursorManager?: AceMultiCursorManager
  cursorReference?: LocalIndexReference
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

    this.editorSession = this.editor.getSession()
    this.editorDocument = this.editorSession.getDocument()

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

    if (this.colaborationType === 'SOURSE') {
      console.log('SOURSE')
      this.textModel.value(this.editor.getValue())
    } else {
      this.editor.setValue(this.textModel.value())
    }

    console.log('model open')

    //Увязка текста

    this.textModel.on(RealTimeString.Events.VALUE, this.handlerTextModelOnRealTimeStringEventsVALUE.bind(this))
    this.textModel.on(RealTimeString.Events.INSERT, this.handlerTextModelOnRealTimeStringEventsINSERT.bind(this))
    this.textModel.on(RealTimeString.Events.REMOVE, this.handlerTextModelOnRealTimeStringEventsREMOVE.bind(this))

    this.model.root().on('model_changed', evt => {
      console.log('model change', evt)
    })

    this.editor.on('change', this.handlerEditorChangeEvent.bind(this))

    // увязка курсора
    this.cursorManager = new AceMultiCursorManager(window.editor.getSession())
    this.cursorReference = this.textModel.indexReference(COLABORATION_CURSOR_KEY)

    const references = this.textModel.references({ key: COLABORATION_CURSOR_KEY })
    references.forEach((reference: ModelReference) => {
      if (!reference.isLocal()) {
        this.addCursor(reference)
      }
    })

    this.setLocalCursor()
    this.cursorReference.share()

    this.editor.getSession().selection.on('changeCursor', this.handlerEditorChangeCursorEvent.bind(this))

    this.textModel.on('reference', this.handlerTextModelReferenceEvent.bind(this))
  }

  private setLocalCursor() {
    if (!this.editorDocument || !this.cursorReference) {
      return
    }

    const position = this.editor.getCursorPosition()
    const index = this.editorDocument.positionToIndex(position)
    this.cursorReference.set(index)
  }

  private addCursor(reference: ModelReference<number>) {
    if (!this.editorDocument || !this.cursorManager) {
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
      if (!this.editorDocument || !this.cursorManager) {
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

  private handlerEditorChangeEvent(delta: Ace.Delta) {
    if (this.suppressEvents) {
      return
    }

    if (!this.textModel) {
      return
    }
    if (!this.editorDocument) {
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
    this.setLocalCursor()
  }

  private handlerTextModelOnRealTimeStringEventsVALUE(evt: IConvergenceEvent) {
    if (!this.editorDocument) {
      return
    }

    const event = evt as StringSetValueEvent

    console.log('VALUE', event)
    this.suppressEvents = true
    const pos = this.editor.setValue(event.element.value())
    this.suppressEvents = false
  }

  private handlerTextModelOnRealTimeStringEventsREMOVE(evt: IConvergenceEvent) {
    console.log(evt)
    if (!this.editorDocument) {
      return
    }
    const event = evt as StringRemoveEvent
    const start = this.editorDocument.indexToPosition(event.index, 0)
    const end = this.editorDocument.indexToPosition(event.index + event.value.length, 0)
    this.suppressEvents = true
    this.editorDocument.remove(new AceRange(start.row, start.column, end.row, end.column))
    this.suppressEvents = false
  }

  private handlerTextModelOnRealTimeStringEventsINSERT(evt: IConvergenceEvent) {
    if (!this.editorDocument) {
      return
    }
    const event = evt as StringInsertEvent
    console.log('INSERT', evt)
    const pos = this.editorDocument.indexToPosition(event.index, 0)
    this.suppressEvents = true
    this.editorDocument.insert(pos, event.value)
    this.suppressEvents = false
  }

  private handlerTextModelReferenceEvent(evt: IConvergenceEvent) {
    const event = evt as RemoteReferenceCreatedEvent
    console.log('reference', evt)
    if (event.reference.key() === COLABORATION_CURSOR_KEY) {
      this.addCursor(event.reference)
    }
  }

  private handlerReferenseClearedEvent(evt: IConvergenceEvent) {}
}

declare var window: AppTo1CWindow
