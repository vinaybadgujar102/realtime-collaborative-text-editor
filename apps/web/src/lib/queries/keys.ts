export const queryKeys = {
  documents: ['documents'] as const,
  document: (id: string) => ['documents', id] as const,
}
