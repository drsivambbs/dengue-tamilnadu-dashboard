import { useState } from 'react'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { CanvasPanel, type CanvasView } from './components/CanvasPanel'
import { RightPanel } from './components/RightPanel'
import type { ClassMethod, Metric, Year } from './types'

function App() {
  const [year, setYear] = useState<Year>(2024)
  const [metric, setMetric] = useState<Metric>('attackRate')
  const [selected, setSelected] = useState<string | null>(null)
  const [view, setView] = useState<CanvasView>('map')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [classMethod, setClassMethod] = useState<ClassMethod>('quantile')

  return (
    <div className="app-bg flex h-screen min-w-[1180px] flex-col text-ink">
      <Header />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          year={year}
          metric={metric}
          open={sidebarOpen}
          onToggle={() => setSidebarOpen((v) => !v)}
          classMethod={classMethod}
          onClassMethod={setClassMethod}
          onYear={setYear}
          onMetric={setMetric}
        />
        <main className="flex min-w-0 flex-1 flex-col p-4">
          <CanvasPanel
            view={view}
            onView={setView}
            year={year}
            metric={metric}
            selected={selected}
            classMethod={classMethod}
            onSelect={setSelected}
          />
        </main>
        <RightPanel
          year={year}
          metric={metric}
          selected={selected}
          open={rightOpen}
          onToggle={() => setRightOpen((v) => !v)}
          onSelect={setSelected}
        />
      </div>
    </div>
  )
}

export default App
