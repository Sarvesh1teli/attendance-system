import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  GraduationCap,
  Users,
  BookOpen,
  Settings,
  ClipboardList,
  Building2,
  ChevronDown,
  Shield,
  ScanFace,
  Bell,
  Calendar,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '../../lib/utils'

interface NavItem {
  label: string
  to?: string
  icon: React.ComponentType<{ className?: string }>
  children?: { label: string; to: string }[]
}

const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  {
    label: 'Academic',
    icon: Building2,
    children: [
      { label: 'Programs', to: '/academic/programs' },
      { label: 'Departments', to: '/academic/departments' },
      { label: 'Batches', to: '/academic/batches' },
      { label: 'Academic Years', to: '/academic/years' },
      { label: 'Subjects', to: '/academic/subjects' },
      { label: 'Groups', to: '/academic/groups' },
      { label: 'Topics', to: '/academic/topics' },
    ],
  },
  {
    label: 'People',
    icon: Users,
    children: [
      { label: 'Faculty', to: '/people/faculty' },
      { label: 'Students', to: '/people/students' },
    ],
  },
  {
    label: 'Face Enrollment',
    icon: ScanFace,
    children: [
      { label: 'Student Enrollment', to: '/face/students' },
      { label: 'Faculty Enrollment', to: '/face/faculty' },
    ],
  },
  {
    label: 'Attendance',
    icon: ClipboardList,
    children: [
      { label: 'Class Sessions', to: '/attendance' },
      { label: 'Faculty Daily Log', to: '/attendance/faculty' },
    ],
  },
  { label: 'Timetable', to: '/timetable', icon: Calendar },
  { label: 'Reports', to: '/reports', icon: BookOpen },
  { label: 'Notifications', to: '/notifications', icon: Bell },
  {
    label: 'Admin',
    icon: Shield,
    children: [{ label: 'Audit Log', to: '/admin/audit' }],
  },
  { label: 'Settings', to: '/settings', icon: Settings },
]

export function Sidebar() {
  const [expanded, setExpanded] = useState<string[]>(['Academic', 'People', 'Face Enrollment'])

  const toggle = (label: string) =>
    setExpanded((p) => (p.includes(label) ? p.filter((l) => l !== label) : [...p, label]))

  return (
    <aside className="w-56 flex-shrink-0 border-r bg-card flex flex-col">
      <div className="h-14 flex items-center px-4 border-b">
        <GraduationCap className="h-6 w-6 text-primary mr-2" />
        <span className="font-bold text-sm">Teli Attendance</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {navItems.map((item) => {
          if (item.children) {
            const isOpen = expanded.includes(item.label)
            return (
              <div key={item.label} className="mb-1">
                <button
                  onClick={() => toggle(item.label)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <item.icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown
                    className={cn('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-180')}
                  />
                </button>
                {isOpen && (
                  <div className="ml-6 mt-0.5 space-y-0.5">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        className={({ isActive }) =>
                          cn(
                            'block px-3 py-1.5 rounded-md text-sm transition-colors',
                            isActive
                              ? 'bg-primary text-primary-foreground font-medium'
                              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                          )
                        }
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          }
          return (
            <NavLink
              key={item.to}
              to={item.to!}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium mb-1 transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
