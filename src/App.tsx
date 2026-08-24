import { FormEvent, useEffect, useMemo, useState } from 'react'

type Segment = {
  id: number
  start: number
  end: number
  text: string
}

type TranscriptionResult = {
  video: {
    id: string
    title: string
    uploader?: string
    duration?: number
    thumbnail?: string
    webpage_url?: string
  }
  text: string
  segments: Segment[]
  language?: string
  model: string
  processing_seconds: number
}

type Health = {
  ok: boolean
  platform: string
  default_model: string
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

function formatTime(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remaining = seconds % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
    : `${minutes}:${String(remaining).padStart(2, '0')}`
}

function formatDuration(seconds?: number) {
  if (!seconds) return 'Unknown length'
  return formatTime(seconds)
}

function App() {
  const [url, setUrl] = useState('')
  const [model, setModel] = useState('turbo')
  const [customModel, setCustomModel] = useState('')
  const [result, setResult] = useState<TranscriptionResult | null>(null)
  const [health, setHealth] = useState<Health | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then(setHealth)
      .catch(() => setHealth(null))
  }, [])

  const filteredSegments = useMemo(() => {
    if (!result) return []
    const term = query.trim().toLowerCase()
    if (!term) return result.segments
    return result.segments.filter((segment) => segment.text.toLowerCase().includes(term))
  }, [query, result])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setResult(null)

    if (!url.trim()) {
      setError('Paste a YouTube URL first.')
      return
    }

    const resolvedModel = model === 'custom' ? customModel.trim() : model
    if (!resolvedModel) {
      setError('Enter an MLX Hugging Face model ID.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/api/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), model: resolvedModel }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Transcription failed.')
      setResult(data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Transcription failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="shell">
      <nav className="nav">
        <div className="brand">
          <div className="brandMark">Y</div>
          <div>
            <strong>LocalScribe</strong>
            <span>MLX transcription</span>
          </div>
        </div>
        <div className={`status ${health?.ok ? 'ready' : ''}`}>
          <span className="statusDot" />
          {health?.ok ? 'Local engine ready' : 'Start local API'}
        </div>
      </nav>

      <section className="hero">
        <div className="eyebrow">PRIVATE · LOCAL · APPLE SILICON</div>
        <h1>Turn any YouTube video into a clean, searchable transcript.</h1>
        <p>
          Audio is downloaded temporarily and transcribed on your Mac with Whisper + MLX. No paid transcription API required.
        </p>

        <form className="transcribeForm" onSubmit={handleSubmit}>
          <div className="urlRow">
            <div className="urlField">
              <span className="youtubeIcon">▶</span>
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="Paste a YouTube URL"
                aria-label="YouTube URL"
              />
            </div>
            <button disabled={loading} type="submit">
              {loading ? <><span className="spinner" />Transcribing</> : 'Transcribe locally'}
            </button>
          </div>

          <div className="modelRow">
            <label>
              Model
              <select value={model} onChange={(event) => setModel(event.target.value)}>
                <option value="turbo">Large v3 Turbo · recommended</option>
                <option value="accurate">Large v3 · max accuracy</option>
                <option value="custom">Custom MLX model</option>
              </select>
            </label>
            {model === 'custom' && (
              <label className="customModel">
                Hugging Face model ID
                <input
                  value={customModel}
                  onChange={(event) => setCustomModel(event.target.value)}
                  placeholder="mlx-community/whisper-..."
                />
              </label>
            )}
            <div className="modelHint">
              <strong>M4 Pro optimized</strong>
              <span>First run downloads the model once.</span>
            </div>
          </div>
        </form>

        {error && <div className="errorBanner">{error}</div>}

        {loading && (
          <div className="progressCard">
            <div className="progressHeader">
              <div>
                <strong>Working locally</strong>
                <span>Download → audio extraction → MLX inference</span>
              </div>
              <span className="privacyPill">Nothing sent to an AI API</span>
            </div>
            <div className="progressTrack"><div className="progressBar" /></div>
            <p>The first transcription can take longer while model weights are downloaded and cached.</p>
          </div>
        )}
      </section>

      {!result && !loading && (
        <section className="featureGrid">
          <article>
            <span>01</span>
            <h3>Local GPU inference</h3>
            <p>MLX runs Whisper directly on Apple Silicon and uses unified memory efficiently.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Timestamped transcript</h3>
            <p>Every returned segment keeps its start and end time for later video seeking and citations.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Ready for AI understanding</h3>
            <p>The transcript structure is ready for Mistral summaries, chapters, embeddings and video Q&A next.</p>
          </article>
        </section>
      )}

      {result && (
        <section className="workspace">
          <aside className="videoPanel">
            {result.video.thumbnail && <img src={result.video.thumbnail} alt="Video thumbnail" />}
            <div className="videoMeta">
              <span className="label">TRANSCRIBED</span>
              <h2>{result.video.title}</h2>
              <div className="metaLine">
                <span>{result.video.uploader || 'YouTube'}</span>
                <span>•</span>
                <span>{formatDuration(result.video.duration)}</span>
              </div>
            </div>
            <div className="stats">
              <div><strong>{result.segments.length}</strong><span>segments</span></div>
              <div><strong>{result.language?.toUpperCase() || 'AUTO'}</strong><span>language</span></div>
              <div><strong>{result.processing_seconds.toFixed(1)}s</strong><span>processing</span></div>
            </div>
            <div className="engineCard">
              <span>Local model</span>
              <code>{result.model}</code>
            </div>
          </aside>

          <div className="transcriptPanel">
            <div className="transcriptHeader">
              <div>
                <span className="label">TRANSCRIPT</span>
                <h2>Search the spoken content</h2>
              </div>
              <input
                className="searchInput"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search transcript…"
              />
            </div>

            <div className="segments">
              {filteredSegments.map((segment) => (
                <div className="segment" key={`${segment.id}-${segment.start}`}>
                  <button className="timestamp" type="button" title="Video seeking comes next">
                    {formatTime(segment.start)}
                  </button>
                  <p>{segment.text.trim()}</p>
                </div>
              ))}
              {filteredSegments.length === 0 && <div className="emptySearch">No transcript segments match “{query}”.</div>}
            </div>
          </div>
        </section>
      )}

      <footer>
        <span>LocalScribe · Phase 1</span>
        <span>React + FastAPI + MLX Whisper</span>
      </footer>
    </main>
  )
}

export default App
