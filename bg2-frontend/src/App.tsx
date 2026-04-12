import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Splash from './screens/Splash'
import Welcome from './screens/Welcome'
import VoiceMode from './screens/VoiceMode'
import Response from './screens/Response'
import History from './screens/History'

export default function App() {
  return (
    <BrowserRouter>
      <div className="h-full w-full bg-background font-body">
        <Routes>
          <Route path="/" element={<Splash />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/voice" element={<VoiceMode />} />
          <Route path="/response" element={<Response />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
