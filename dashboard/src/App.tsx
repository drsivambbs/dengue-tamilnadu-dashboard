import { useState } from 'react'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { MapView } from './components/MapView'
import { ChartsStrip } from './components/ChartsStrip'
import type { Metric, Year } from './types'

function App() {
  const [year, setYear] = useState<Year>(2024)
  const [metric, setMetric] = useState<Metric>('attackRate')
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div className="app-bg flex h-screen min-w-[1180px] flex-col text-ink">
      <Header />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          year={year}
          metric={metric}
          selected={selected}
          onYear={setYear}
          onMetric={setMetric}
          onSelect={setSelected}
        />
        <main className="flex min-w-0 flex-1 flex-col gap-4 p-5">
          <MapView year={year} metric={metric} selected={selected} onSelect={setSelected} />
          <ChartsStrip year={year} selected={selected} />
        </main>
      </div>
    </div>
  )
}

export default App
