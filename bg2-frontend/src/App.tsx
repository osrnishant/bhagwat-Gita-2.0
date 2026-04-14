import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import BgMusicControl from './components/BgMusicControl'
import ErrorBoundary from './components/ErrorBoundary'

declare const umami: { track: (event?: string) => void } | undefined

function Analytics() {
  const location = useLocation()
  useEffect(() => {
    if (typeof umami !== 'undefined') umami.track()
  }, [location.pathname])
  return null
}

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
      <ErrorBoundary>
        <Analytics />
        <div className="h-full w-full bg-background font-body">
          <Suspense fallback={<div className="h-full w-full bg-background" />}>
            <Routes>
              <Route path="/" element={<Splash />} />
              <Route path="/welcome" element={<Welcome />} />
              <Route path="/voice" element={<VoiceMode />} />
              <Route path="/response" element={<Response />} />
              <Route path="/history" element={<History />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          {/* Background music — persists across all screens */}
          <BgMusicControl />
        </div>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
