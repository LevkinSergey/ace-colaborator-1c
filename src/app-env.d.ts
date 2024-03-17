/// <reference types="node" />

import { Ace } from 'ace-builds'

interface AppTo1CWindow extends Window {
  editor: Ace.Editor
}
