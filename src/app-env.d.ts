/// <reference types="node" />

import { Ace } from 'ace-builds'
import { ColaboratorForOnes } from './Colaborator'

interface AppTo1CWindow extends Window {
  isWebClient: boolean
  editor: Ace.Editor
  colaborator: {
    instanse: ColaboratorForOnes | undefined
    start: (sessionId: string) => boolean
    close: () => void
    setUserName: (name: string) => void
    setColaborationUrl: (url: string) => void
  }
}
