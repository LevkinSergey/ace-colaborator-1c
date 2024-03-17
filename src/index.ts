// entry point
// DO NOT mess this file!
import './index.scss'

import { CollaboratorManagerForOnes } from './ColaborationManager'
import { AppTo1CWindow } from './app-env'

export const CONVERGENCE_URL = 'http://192.168.110.35:9000/api/realtime/convergence/default'

let colaborator: CollaboratorManagerForOnes | undefined = undefined

export const connectColaborator = () => {
  colaborator = new CollaboratorManagerForOnes(window.editor, CONVERGENCE_URL, 'Sergey')
  colaborator.connect()
}

window.addEventListener('load', ev => {
  connectColaborator()
})

declare var window: AppTo1CWindow
