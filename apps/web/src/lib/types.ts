export type DocumentListItem = {
  id: string
  userId: string
  name: string
  createdAt: string
  updatedAt: string
}

export type DocumentStateBuffer = {
  type: 'Buffer'
  data: number[]
}

export type DocumentDetail = {
  id: string
  name: string
  userId: string
  state: DocumentStateBuffer | null
  createdAt: string
  updatedAt: string
}

export type LoginResponse = {
  token: string
}

export type CreateDocumentResponse = {
  documentId: string
}

export type DocumentsListResponse = {
  documents: DocumentListItem[]
}

export type DocumentDetailResponse = {
  documents: DocumentDetail
}
