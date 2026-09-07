import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react'

interface Props {
  status: 'ENROLLED' | 'PENDING' | 'NOT_ENROLLED' | string
}

export function EnrollmentStatusBadge({ status }: Props) {
  switch (status) {
    case 'ENROLLED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Enrolled
        </span>
      )
    case 'PENDING':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20">
          <Clock className="h-3.5 w-3.5" />
          In Progress
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-500 border border-slate-500/20">
          <AlertTriangle className="h-3.5 w-3.5" />
          Not Enrolled
        </span>
      )
  }
}
