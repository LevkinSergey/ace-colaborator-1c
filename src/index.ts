// entry point
// DO NOT mess this file!
import './index.scss'

import { AppTo1CWindow } from './app-env'
import { ColaboratorForOnes } from './Colaborator'
import { COLABORATOR_READY, emitEventTo1C } from './eventDispatcherTo1C'

function initColaborator() {
  window.colaborator = {
    instanse: undefined,
    start: (sessionId: string) => {
      if (!window.colaborator.instanse) {
        window.colaborator.instanse = new ColaboratorForOnes(window.editor)
      }
      return window.colaborator.instanse.start(sessionId)
    },
    close: () => {
      if (!window.colaborator.instanse) {
        return
      }
      window.colaborator.instanse.close()
    },
    setUserName: (name: string) => {
      if (!window.colaborator.instanse) {
        window.colaborator.instanse = new ColaboratorForOnes(window.editor)
      }
      window.colaborator.instanse.setUserName(name)
    },
    setColaborationUrl: (url: string) => {
      if (!window.colaborator.instanse) {
        window.colaborator.instanse = new ColaboratorForOnes(window.editor)
      }
      window.colaborator.instanse.setColaborationUrl(url)
    }
  }
}

initColaborator()

emitEventTo1C(COLABORATOR_READY, undefined, undefined)

declare var window: AppTo1CWindow
