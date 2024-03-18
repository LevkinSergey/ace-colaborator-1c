import 'core-js/stable'
import './ace.scss'

import ace from 'ace-builds'
import 'ace-builds/src-noconflict/ext-language_tools'
// import "ace-builds/src-noconflict/ext-emmet";
import 'ace-builds/src-noconflict/ext-inline_autocomplete'

import 'ace-builds/esm-resolver'
import { AppTo1CWindow } from '@/app-env'

window.editor = ace.edit('aceeditor')

window.editor.setTheme('ace/theme/eclipse')
window.editor.session.setMode('ace/mode/javascript')

window.editor.setOptions({
  selectionStyle: 'line',
  highlightSelectedWord: true,
  showLineNumbers: true,
  enableBasicAutocompletion: true,
  enableSnippets: true,
  enableLiveAutocompletion: true,
  enableInlineAutocompletion: true
})
window.editor.setHighlightSelectedWord(true)

declare var window: AppTo1CWindow
