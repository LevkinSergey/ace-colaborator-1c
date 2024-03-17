/// <reference types="node" />

import { Ace } from 'ace-builds'
import { AceColaborator } from './Colaborator'

interface AppTo1CWindow extends Window {
  editor: Ace.Editor
  colaborator: AceColaborator
}
