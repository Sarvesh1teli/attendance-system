import { Outlet } from 'react-router-dom'

export function SetupLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">Teli Attendance</h1>
          <p className="text-muted-foreground mt-2">Institution Setup</p>
        </div>
        <div className="bg-card rounded-xl shadow-lg border p-8">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
