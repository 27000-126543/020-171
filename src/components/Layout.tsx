import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Tag, GitCompareArrows, BookOpen, Stethoscope, ClipboardList } from 'lucide-react'

const navItems = [
  { path: '/', label: '质检看板', icon: LayoutDashboard },
  { path: '/annotation', label: '话术标注', icon: Tag },
  { path: '/ledger', label: '标注台账', icon: ClipboardList },
  { path: '/comparison', label: '门店对比', icon: GitCompareArrows },
  { path: '/library', label: '话术库', icon: BookOpen },
]

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-bg">
      <aside className="w-64 bg-surface border-r border-slate-200 flex flex-col fixed h-full z-10 shadow-sm">
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-serif text-base font-semibold text-slate-800 leading-tight">话术质检</h1>
              <p className="text-xs text-slate-400">连锁口腔运营看板</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-primary-50 text-primary-dark shadow-sm'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`
              }
            >
              <Icon className="w-[18px] h-[18px]" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent text-xs font-semibold">
              运
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">运营经理</p>
              <p className="text-xs text-slate-400">全部门店</p>
            </div>
          </div>
        </div>
      </aside>
      <main className="flex-1 ml-64">
        <Outlet />
      </main>
    </div>
  )
}
