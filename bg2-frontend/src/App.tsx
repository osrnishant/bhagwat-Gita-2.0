import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

// Critical path — loaded eagerly so there's no flash on first render
import Splash from './screens/Splash'
import Welcome from './screens/Welcome'
import VoiceMode from './screens/VoiceMode'

// Only needed after the user interacts — lazy-load to keep initial bundle small
const Response = lazy(() => import('./screens/Response'))
const History = lazy(() => import('./screens/History'))

export default function App() {
  return (
    <BrowserRouter>
      <div className="h-full w-full bg-background font-body">
        <Suspense fallback={<div className="h-full w-full bg-background" />}>
          <Routes>
            <Route path="/" element={<Splash />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/voice" element={<VoiceMode />} />
            <Route path="/response" element={<Response />} />
            <Route path="/history" element={<History />} />
          </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  )
}
