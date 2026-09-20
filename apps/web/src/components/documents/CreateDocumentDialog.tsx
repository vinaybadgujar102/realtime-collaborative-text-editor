import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { ApiClientError } from '#/lib/api-client'
import { useCreateDocument } from '#/lib/queries'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '#/components/ui/form'
import { Input } from '#/components/ui/input'

const createDocumentSchema = z.object({
  name: z.string().min(1, 'Document name is required'),
})

type CreateDocumentValues = z.infer<typeof createDocumentSchema>

export function CreateDocumentDialog() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const createDocument = useCreateDocument()

  const form = useForm<CreateDocumentValues>({
    resolver: zodResolver(createDocumentSchema),
    defaultValues: { name: '' },
  })

  async function onSubmit(values: CreateDocumentValues) {
    try {
      const result = await createDocument.mutateAsync(values)
      toast.success('Document created')
      setOpen(false)
      form.reset()
      await navigate({
        to: '/documents/$documentId',
        params: { documentId: result.documentId },
      })
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : 'Unable to create document.'
      toast.error(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          New document
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create document</DialogTitle>
          <DialogDescription>
            Give your document a name to get started.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Untitled document" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createDocument.isPending}>
                {createDocument.isPending ? 'Creating…' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
