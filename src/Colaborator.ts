import { ColaboratorEditor, CollaboratorManagerForOnes } from './ColaborationManager'

export const DEFAULT_COLABORATION_URL = 'http://localhost:9000/api/realtime/convergence/default'

export class ColaboratorForOnes {
  private manager?: CollaboratorManagerForOnes
  private colaborationUrl: string
  private username: string

  constructor(private readonly editor: ColaboratorEditor) {
    this.colaborationUrl = DEFAULT_COLABORATION_URL
    this.username = 'user' + Date.now()
  }

  setUserName(name: string) {
    this.username = name
    if (this.manager) {
      this.manager.setUserName(name)
    }
  }

  setColaborationUrl(url: string) {
    if (this.manager) {
      return
    }

    this.colaborationUrl = url
  }

  start(sessionId: string): boolean {
    if (this.manager) {
      return false
    }

    this.manager = new CollaboratorManagerForOnes({
      editor: this.editor,
      colaborationUrl: this.colaborationUrl,
      username: this.username,
      colabSessionId: sessionId
    })
    this.manager.connect()
    return true
  }

  close() {
    if (!this.manager) {
      return
    }

    this.manager.close(() => {
      console.log('good close')
    })
  }
}
