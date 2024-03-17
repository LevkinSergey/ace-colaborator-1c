// entry point
// DO NOT mess this file!
import './index.scss'

import { CollaboratorManagerForOnes } from './ColaborationManager'
import { AppTo1CWindow } from './app-env'
import { ColaboratorForOnes } from './Colaborator'

function initColaborator() {
  window.colaborator = new ColaboratorForOnes(window.editor)
}

window.addEventListener('load', ev => {
  initColaborator()
})

declare var window: AppTo1CWindow
