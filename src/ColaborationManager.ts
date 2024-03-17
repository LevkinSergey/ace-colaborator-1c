// import { AppTo1CWindow } from '@/app-env'
import { connectAnonymously, ConvergenceDomain, IConvergenceEvent, RealTimeElement, RealTimeModel, RealTimeString, StringInsertEvent } from '@convergence/convergence'
import { Ace } from 'ace-builds'
import { AppTo1CWindow } from './app-env'

export const CONVERGENCE_URL = 'http://192.168.110.35:9000/api/realtime/convergence/default'
const username = 'Sergey' + Date.now()

const modelId = 'testmodel'
const collectionId = 'testcollection' + Date.now()

const initModels = (domain: ConvergenceDomain) => {
  domain
    .models()
    .openAutoCreate({
      id: modelId,
      collection: collectionId,
      ephemeral: true,
      data: {
        text: ''
      }
    })
    .then(model => {
      console.log('model open')
      // use the model

      // the model is {firstName: “Fred”, lastName: “Flanders”}
      // A real time string
      const firstName: RealTimeString = model.elementAt('text') as RealTimeString

      firstName.on(RealTimeString.Events.VALUE, evt => {
        console.log(evt)
      })

      firstName.on(RealTimeString.Events.INSERT, evt => {
        console.log(evt)
      })
      firstName.on(RealTimeString.Events.REMOVE, evt => {
        console.log(evt)
      })

      firstName.value('Процедура ссс() \n КонецПроцедуры')
      // Set the string's value
      // firstName.value('Ted') // "Ted", "change"

      // Delete the "T" at index 1
      // firstName.remove(0, 1) // "ed", "change"

      // Insert an "N" at index 0.
      // firstName.insert(0, 'N') // "Ned", "change"

      // Listen to course-grained events on the entire model
      model.root().on('model_changed', evt => {
        console.log('change', evt)
      })

      window.editor.on('change', delta => {
        console.log(delta)
        const doc = window.editor.getSession().getDocument()

        const pos = doc.positionToIndex(delta.start)
        switch (delta.action) {
          case 'insert':
            console.log('insert', delta)
            firstName.insert(pos, delta.lines.join('\n'))
            break
          case 'remove':
            console.log('remove', delta)
            firstName.remove(pos, delta.lines.join('\n').length)
            break
          default:
            throw new Error('unknown action: ' + delta.action)
        }
      })
    })
    .catch(error => {
      console.log('Could not open the model', error)
    })
}

export const connectColab = () => {
  connectAnonymously(CONVERGENCE_URL, username)
    .then(domain => {
      console.log('Connection success')
      console.log(domain)

      initModels(domain)

      domain
        .presence()
        .subscribe('Sergey')
        .then(presence => {
          presence.events().subscribe(event => console.log(event))
        })
        .catch(error => {
          console.log('Could not subscribe to user, error')
        })
      const activityType = 'test-activity-type'
      const activityId = 'testActivity'
      domain
        .activities()
        .join(activityType, activityId)
        .then(activity => {
          console.log('activity joined')
          // use the activity
        })
        .catch(error => {
          console.log('Could not join the activity', error)
        })

      domain
        .presence()
        .subscribe('Sergey')
        .then(presence => {
          console.log(presence)
          presence.events().subscribe(event => console.log(event))
        })
        .catch(error => {
          console.log('Could not subscribe to user, error')
        })
    })
    .catch(error => {
      console.log('Connection failure', error)
    })
}

export type ColaboratorEditor = Ace.Editor
export type ColaboratorEditorSession = Ace.EditSession
export type ColaboratorEditorDoc = Ace.Document

export class CollaboratorManagerForOnes {
  domain?: ConvergenceDomain
  editorSession?: ColaboratorEditorSession
  editorDocument?: ColaboratorEditorDoc
  modelId?: string
  model?: RealTimeModel
  private readonly collectionId: string
  textModel?: RealTimeString
  suppressEvents: boolean

  constructor(private readonly editor: ColaboratorEditor, private readonly colaborateUrl: string, private username: string, collectionId?: string) {
    if (!collectionId) {
      this.collectionId = 'tools_ui_1c'
    } else {
      this.collectionId = collectionId
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
    connectAnonymously(this.colaborateUrl, this.username)
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

  setModelId(id: string) {
    this.modelId = id
  }

  private handlerDomainOpen(domain: ConvergenceDomain) {
    domain
      .models()
      .openAutoCreate({
        id: modelId,
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
    // use the model

    // the model is {firstName: “Fred”, lastName: “Flanders”}
    // A real time string
    this.textModel = this.model.elementAt('text') as RealTimeString

    this.textModel.on(RealTimeString.Events.VALUE, evt => {
      if (!this.editorDocument) {
        return
      }
      console.log(evt)
      // const pos = this.editorDocument.indexToPosition(evt.index, 0)
      // suppressEvents = true
      // doc.insert(pos, e.value)
      // suppressEvents = false
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
    })

    this.model.root().on('model_changed', evt => {
      console.log('change', evt)
    })

    this.editor.on('change', delta => {
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
    })
  }
}

declare var window: AppTo1CWindow
