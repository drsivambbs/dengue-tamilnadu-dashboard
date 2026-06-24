import { useState } from 'react'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { CanvasPanel, type CanvasView } from './components/CanvasPanel'
import { RightPanel } from './components/RightPanel'
import { DataTable } from './components/DataTable'
import { PopulationTab } from './components/PopulationTab'
import { AdvancedAnalytics } from './components/AdvancedAnalytics'
import { GisDashboard } from './components/GisDashboard'
import { LATEST_YEAR, LATEST_MONTH, loadData } from './dataService'
import type { ClassMethod, Metric, Page, Year } from './types'

function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [dataVersion, setDataVersion] = useState(0) // bumped to re-read live data

  // Re-fetch live data and remount the dashboard so edits/imports appear.
  const refresh = () => { loadData().then(() => setDataVersion((v) => v + 1)).catch(() => {}) }
  // Navigate; when returning to the dashboard from an editor, pull fresh data.
  const goPage = (p: Page) => {
    if (p === 'dashboard' && (page === 'data' || page === 'population')) refresh()
    setPage(p)
  }
  // Default to the most recent period available in the data.
  const [year, setYear] = useState<Year>(LATEST_YEAR)
  const [metric, setMetric] = useState<Metric>('attackRate')
  const [selected, setSelected] = useState<string | null>(null)
  const [view, setView] = useState<CanvasView>('map')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [classMethod, setClassMethod] = useState<ClassMethod>('quantile')
  const [month, setMonth] = useState(LATEST_MONTH) // 0-11; latest month with data

  // Default filter state + a one-click reset for the dashboard workbench.
  const isDefault = year === LATEST_YEAR && metric === 'attackRate' && selected === null && month === LATEST_MONTH && classMethod === 'quantile'
  const resetFilters = () => {
    setYear(LATEST_YEAR)
    setMetric('attackRate')
    setSelected(null)
    setMonth(LATEST_MONTH)
    setClassMethod('quantile')
  }

  if (page === 'data') {
    return (
      <div className="app-bg flex h-screen min-w-[1180px] flex-col text-ink">
        <Header page={page} onPage={goPage} />
        <DataTable
          onOpenDistrict={(d, y) => {
            setSelected(d)
            setYear(y)
            setView('map')
            refresh()
            setPage('dashboard')
          }}
        />
      </div>
    )
  }

  if (page === 'population') {
    return (
      <div className="app-bg flex h-screen min-w-[1180px] flex-col text-ink">
        <Header page={page} onPage={goPage} />
        <PopulationTab />
      </div>
    )
  }

  if (page === 'analytics') {
    return (
      <div className="app-bg flex h-screen min-w-[1180px] flex-col text-ink">
        <Header page={page} onPage={goPage} />
        <AdvancedAnalytics selected={selected} onSelect={setSelected} />
      </div>
    )
  }

  if (page === 'gis') {
    return (
      <div className="app-bg flex h-screen min-w-[1180px] flex-col text-ink">
        <Header page={page} onPage={goPage} />
        <GisDashboard />
      </div>
    )
  }

  return (
    <div key={dataVersion} className="app-bg flex h-screen min-w-[1180px] flex-col text-ink">
      <Header page={page} onPage={goPage} />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          metric={metric}
          open={sidebarOpen}
          onToggle={() => setSidebarOpen((v) => !v)}
          classMethod={classMethod}
          onClassMethod={setClassMethod}
          onMetric={setMetric}
          onReset={resetFilters}
          canReset={!isDefault}
        />
        <main className="flex min-w-0 flex-1 flex-col p-4">
          <CanvasPanel
            view={view}
            onView={setView}
            year={year}
            month={month}
            metric={metric}
            selected={selected}
            classMethod={classMethod}
            onYear={setYear}
            onMonth={setMonth}
            onSelect={setSelected}
          />
        </main>
        <RightPanel
          year={year}
          selected={selected}
          month={month}
          open={rightOpen}
          onToggle={() => setRightOpen((v) => !v)}
        />
      </div>
    </div>
  )
}

export default App
