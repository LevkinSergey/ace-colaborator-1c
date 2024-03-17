// import { AppTo1CWindow } from '@/app-env'
import { connectAnonymously, ConvergenceDomain, IConvergenceEvent, RealTimeElement, RealTimeModel, RealTimeString, StringInsertEvent, StringRemoveEvent, StringSetValueEvent } from '@convergence/convergence'
import ace, { Ace } from 'ace-builds'
import { AppTo1CWindow } from './app-env'

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

    let modelValue: string = ''
    if (this.textModel) {
      modelValue = this.textModel.value()
    }

    this.editorSession?.setValue(modelValue)
    console.log('model open')

    this.textModel = this.model.elementAt('text') as RealTimeString

    this.textModel.on(RealTimeString.Events.VALUE, evt => {
      if (!this.editorDocument) {
        return
      }
      const event = evt as StringSetValueEvent
      console.log('VALUE', evt)
      this.suppressEvents = true
      const pos = this.editor.setValue(event.element.value())
      this.suppressEvents = false
    })

    this.textModel.on(RealTimeString.Events.INSERT, evt => {
      if (!this.editorDocument) {
        return
      }
      const event = evt as StringInsertEvent
      console.log('INSERT', evt)
      const pos = this.editorDocument.indexToPosition(event.index, 0)
      this.suppressEvents = true
      this.editorDocument.insert(pos, event.value)
      this.suppressEvents = false
    })
    this.textModel.on(RealTimeString.Events.REMOVE, evt => {
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
    })

    if (this.colaborationType === 'SOURSE') {
      this.textModel.value(this.editor.getValue())
    }

    this.model.root().on('model_changed', evt => {
      console.log('change', evt)
    })

    this.editor.on('change', this.handlerEditorChangeEvent.bind(this))
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
}

declare var window: AppTo1CWindow
