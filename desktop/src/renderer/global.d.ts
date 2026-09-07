import type { IpcApi } from '../main/ipc/types'

declare global {
  interface Window {
    api: IpcApi
  }
}

export {}
