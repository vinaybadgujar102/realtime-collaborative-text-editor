import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '#/lib/api-client'
import { setToken } from '#/lib/auth'
import { queryKeys } from '#/lib/queries/keys'
import type {
  CreateDocumentResponse,
  DocumentDetailResponse,
  DocumentsListResponse,
  LoginResponse,
} from '#/lib/types'

export function useLogin() {
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      apiClient<LoginResponse>('/auth/login', {
        method: 'POST',
        body,
        auth: false,
      }),
    onSuccess: (data) => {
      setToken(data.token)
    },
  })
}

export function useSignup() {
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      apiClient<undefined>('/auth/signup', {
        method: 'POST',
        body,
        auth: false,
      }),
  })
}

export function useDocuments() {
  return useQuery({
    queryKey: queryKeys.documents,
    queryFn: async () => {
      const data = await apiClient<DocumentsListResponse>('/document')
      return data.documents
    },
  })
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: queryKeys.document(id),
    queryFn: async () => {
      const data = await apiClient<DocumentDetailResponse>(`/document/${id}`)
      return data.documents
    },
    enabled: Boolean(id),
  })
}

export function useCreateDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: { name: string }) =>
      apiClient<CreateDocumentResponse>('/document', {
        method: 'POST',
        body,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.documents })
    },
  })
}

export function useDeleteDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      apiClient<undefined>(`/document/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.documents })
    },
  })
}
