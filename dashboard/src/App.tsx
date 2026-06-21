import { useState } from 'react'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { CanvasPanel, type CanvasView } from './components/CanvasPanel'
import { KpiCards } from './components/KpiCards'
import type { Metric, Year } from './types'

function App() {
  const [year, setYear] = useState<Year>(2024)
  const [metric, setMetric] = useState<Metric>('attackRate')
  const [selected, setSelected] = useState<string | null>(null)
  const [view, setView] = useState<CanvasView>('map')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="app-bg flex h-screen min-w-[1180px] flex-col text-ink">
      <Header />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          year={year}
          metric={metric}
          selected={selected}
          open={sidebarOpen}
          onToggle={() => setSidebarOpen((v) => !v)}
          onYear={setYear}
          onMetric={setMetric}
          onSelect={setSelected}
        />
        <main className="flex min-w-0 flex-1 flex-col gap-3 p-4">
          <CanvasPanel
            view={view}
            onView={setView}
            year={year}
            metric={metric}
            selected={selected}
            onSelect={setSelected}
          />
          <KpiCards year={year} selected={selected} />
        </main>
      </div>
    </div>
  )
}

export default App
