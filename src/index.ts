// entry point
// DO NOT mess this file!
import './index.scss'

import { AppTo1CWindow } from './app-env'
import { ColaboratorForOnes } from './Colaborator'

function initColaborator() {
  window.colaborator = {
    instanse: new ColaboratorForOnes(window.editor),
    start: (sessionId: string) => {
      return window.colaborator.instanse.start(sessionId)
    },
    close: () => {
      window.colaborator.instanse.close()
    },
    setUserName: (name: string) => {
      window.colaborator.instanse.setUserName(name)
    },
    setColaborationUrl: (url: string) => {
      window.colaborator.instanse.setColaborationUrl(url)
    }
  }
}

initColaborator()

declare var window: AppTo1CWindow
