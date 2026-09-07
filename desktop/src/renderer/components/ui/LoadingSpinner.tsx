import { cn } from '../../lib/utils'

interface Props { fullScreen?: boolean; className?: string }

export function LoadingSpinner({ fullScreen, className }: Props) {
  if (fullScreen) {
    return (
      <div className="flex items-center justify-center h-screen w-full">
        <Spinner className={className} />
      </div>
    )
  }
  return <Spinner className={className} />
}

function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn(
      'h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent',
      className
    )} />
  )
}
