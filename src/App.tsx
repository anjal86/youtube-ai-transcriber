import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Clean SVG Icons (Professional & Linear-styled)
const Icons = {
  Play: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  History: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  ),
  Settings: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Sparkles: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z" />
    </svg>
  ),
  Chat: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Copy: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  Check: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Close: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Trash: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  Captions: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M7 15h3a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1H7v6z" />
      <path d="M14 15h3a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1h-3v6z" />
    </svg>
  ),
  Send: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  Search: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
}

type Segment = {
  id: number
  start: number
  end: number
  text: string
}

type VideoMeta = {
  id: string
  title: string
  uploader?: string
  duration?: number
  thumbnail?: string
  webpage_url?: string
}

type TranscriptionResult = {
  id?: string
  url?: string
  video: VideoMeta
  text: string
  segments: Segment[]
  language?: string
  language_name?: string
  model: string
  processing_seconds: number
  studyNotes?: string
  createdAt?: string
}

type HistoryItem = TranscriptionResult & {
  id: string
}

type Health = {
  ok: boolean
  platform: string
  default_model: string
}

type ChatMsg = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''
const DEFAULT_GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY || ''

const LANGUAGES_LIST = [
  { code: '', label: 'Auto-detect Language' },
  { code: 'ne', label: 'Nepali (नेपाली)' },
  { code: 'ja', label: 'Japanese (日本語)' },
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi (हिन्दी)' },
  { code: 'zh', label: 'Chinese (中文)' },
  { code: 'es', label: 'Spanish (Español)' },
  { code: 'fr', label: 'French (Français)' },
  { code: 'de', label: 'German (Deutsch)' },
]

const PROMPT_SUGGESTIONS = [
  'Summarize the key grammar points covered in this lesson',
  'मुख्य बुँदाहरू नेपालीमा स्पष्ट व्याख्या गर्नुस्',
  'List all Japanese example sentences with Romaji',
  'Create a 3-question practice quiz based on this video',
]

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
  if (!seconds) return ''
  return formatTime(seconds)
}

function formatDate(isoString?: string) {
  if (!isoString) return ''
  try {
    const d = new Date(isoString)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return isoString
  }
}

function formatSrtTime(totalSeconds: number) {
  const ms = Math.floor((totalSeconds % 1) * 1000)
  const secs = Math.floor(totalSeconds)
  const hours = Math.floor(secs / 3600)
  const minutes = Math.floor((secs % 3600) / 60)
  const remainingSecs = secs % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

function formatVttTime(totalSeconds: number) {
  const ms = Math.floor((totalSeconds % 1) * 1000)
  const secs = Math.floor(totalSeconds)
  const hours = Math.floor(secs / 3600)
  const minutes = Math.floor((secs % 3600) / 60)
  const remainingSecs = secs % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
}

export function App() {
  const [url, setUrl] = useState('')
  const [engine, setEngine] = useState<'groq' | 'youtube' | 'gemini'>('groq')
  const [groqApiKey, setGroqApiKey] = useState(() => localStorage.getItem('groq_api_key') || DEFAULT_GROQ_KEY)
  const [model, setModel] = useState('whisper-large-v3')
  const [language, setLanguage] = useState('')
  const [showOptions, setShowOptions] = useState(false)
  const [health, setHealth] = useState<Health | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // History State
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [historySearch, setHistorySearch] = useState('')

  // Workspace Tabs & State
  const [activeTab, setActiveTab] = useState<'transcript' | 'notes' | 'chat'>('transcript')
  const [studyNotes, setStudyNotes] = useState<string | null>(null)
  const [refining, setRefining] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  // Live streaming states
  const [statusMessage, setStatusMessage] = useState('')
  const [progressPercent, setProgressPercent] = useState<number>(0)
  const [processedSecs, setProcessedSecs] = useState<number>(0)
  const [totalSecs, setTotalSecs] = useState<number>(0)
  const [detectedLang, setDetectedLang] = useState<{ code: string; name: string } | null>(null)
  const [liveVideo, setLiveVideo] = useState<VideoMeta | null>(null)
  const [liveSegments, setLiveSegments] = useState<Segment[]>([])
  const [finalResult, setFinalResult] = useState<TranscriptionResult | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [copiedAll, setCopiedAll] = useState(false)

  const segmentsContainerRef = useRef<HTMLDivElement | null>(null)
  const chatBottomRef = useRef<HTMLDivElement | null>(null)

  const fetchHistory = () => {
    fetch(`${API_BASE}/api/history`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (data && Array.isArray(data.items)) {
          setHistoryItems(data.items)
        }
      })
      .catch(() => {})
  }

  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setHealth)
      .catch(() => setHealth(null))

    fetchHistory()
  }, [])

  useEffect(() => {
    if (groqApiKey) localStorage.setItem('groq_api_key', groqApiKey)
  }, [groqApiKey])

  useEffect(() => {
    if (autoScroll && loading && segmentsContainerRef.current) {
      segmentsContainerRef.current.scrollTop = segmentsContainerRef.current.scrollHeight
    }
  }, [liveSegments, autoScroll, loading])

  useEffect(() => {
    if (activeTab === 'chat' && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages, activeTab, chatLoading])

  const displayedSegments = finalResult ? finalResult.segments : liveSegments
  const displayedVideo = finalResult ? finalResult.video : liveVideo

  const filteredSegments = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return displayedSegments
    return displayedSegments.filter((segment) => segment.text.toLowerCase().includes(term))
  }, [query, displayedSegments])

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase()
    if (!q) return historyItems
    return historyItems.filter(
      (item) =>
        (item.video?.title || '').toLowerCase().includes(q) ||
        (item.video?.uploader || '').toLowerCase().includes(q) ||
        (item.text || '').toLowerCase().includes(q)
    )
  }, [historyItems, historySearch])

  function loadHistoryRecord(item: HistoryItem) {
    setFinalResult(item)
    setLiveVideo(item.video)
    setLiveSegments(item.segments)
    setUrl(item.url || item.video.webpage_url || '')
    setStudyNotes(item.studyNotes || null)
    setChatMessages([])
    setActiveTab('transcript')
    setShowHistory(false)
    setError('')
  }

  async function handleDeleteHistoryItem(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await fetch(`${API_BASE}/api/history/${id}`, { method: 'DELETE' })
      setHistoryItems((prev) => prev.filter((h) => h.id !== id && h.video?.id !== id))
    } catch {}
  }

  async function handleClearAllHistory() {
    if (!window.confirm('Clear all saved transcription history?')) return
    try {
      await fetch(`${API_BASE}/api/history`, { method: 'DELETE' })
      setHistoryItems([])
    } catch {}
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setFinalResult(null)
    setStudyNotes(null)
    setChatMessages([])
    setActiveTab('transcript')
    setLiveSegments([])
    setLiveVideo(null)
    setDetectedLang(null)
    setProgressPercent(0)
    setProcessedSecs(0)
    setTotalSecs(0)

    if (!url.trim()) {
      setError('Please enter a valid YouTube URL.')
      return
    }

    setLoading(true)
    setStatusMessage('Connecting to Groq LPU...')

    try {
      const response = await fetch(`${API_BASE}/api/transcribe/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          engine,
          model,
          language: language || null,
          groq_api_key: groqApiKey.trim() || DEFAULT_GROQ_KEY,
        }),
      })

      if (!response.ok) {
        let errDetail = 'Transcription failed.'
        try {
          const errJson = await response.json()
          errDetail = errJson.detail || errDetail
        } catch {}
        throw new Error(errDetail)
      }

      if (!response.body) throw new Error('Streaming response not supported.')

      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''

        for (const rawEvent of events) {
          const lines = rawEvent.split('\n')
          let eventType = 'message'
          let eventData = ''

          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim()
            else if (line.startsWith('data: ')) eventData = line.slice(6)
          }

          if (!eventData) continue

          try {
            const data = JSON.parse(eventData)

            if (eventType === 'metadata') {
              setLiveVideo(data.video)
              if (data.video.duration) setTotalSecs(data.video.duration)
            } else if (eventType === 'status') {
              setStatusMessage(data.message || '')
              if (data.download_percent !== undefined) {
                setProgressPercent(Math.min(30, Math.round(data.download_percent * 0.3)))
              }
            } else if (eventType === 'language') {
              setDetectedLang({ code: data.language, name: data.language_name })
              if (data.duration) setTotalSecs(data.duration)
              setStatusMessage(`Transcribing spoken audio (${data.language_name || data.language})...`)
            } else if (eventType === 'segment') {
              setLiveSegments((prev) => {
                const exists = prev.some((s) => s.id === data.segment.id && s.start === data.segment.start)
                if (exists) return prev
                return [...prev, data.segment]
              })
              if (data.progress !== undefined) {
                setProgressPercent(Math.min(99, Math.round(35 + data.progress * 0.64)))
              }
              if (data.processed_seconds !== undefined) setProcessedSecs(data.processed_seconds)
              if (data.total_seconds !== undefined) setTotalSecs(data.total_seconds)
            } else if (eventType === 'done') {
              setFinalResult(data)
              setProgressPercent(100)
              setLoading(false)
              setStatusMessage('Complete')
              fetchHistory()
            } else if (eventType === 'error') {
              setLoading(false)
              throw new Error(data.message || 'An error occurred during transcription.')
            }
          } catch (err) {
            if (err instanceof Error && eventType === 'error') throw err
          }
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Transcription failed.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateStudyNotes() {
    const textContent = finalResult?.text || displayedSegments.map((s) => `[${formatTime(s.start)}] ${s.text}`).join('\n')
    if (!textContent) return

    setRefining(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE}/api/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textContent,
          title: displayedVideo?.title || 'Japanese Lesson',
          groq_api_key: groqApiKey.trim() || DEFAULT_GROQ_KEY,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Refinement failed.')
      setStudyNotes(data.notes)
      setActiveTab('notes')
      fetchHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate study notes.')
    } finally {
      setRefining(false)
    }
  }

  async function handleSendChatMessage(customPrompt?: string) {
    const promptText = (customPrompt || chatInput).trim()
    if (!promptText || chatLoading) return

    const fullTranscript = finalResult?.text || displayedSegments.map((s) => `[${formatTime(s.start)}] ${s.text}`).join('\n')
    if (!fullTranscript) {
      setError('Transcribe a video first to enable chat.')
      return
    }

    const userMessage: ChatMsg = {
      id: String(Date.now()),
      role: 'user',
      content: promptText,
    }

    const updatedMessages = [...chatMessages, userMessage]
    setChatMessages(updatedMessages)
    setChatInput('')
    setChatLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          transcript: fullTranscript,
          title: displayedVideo?.title || 'YouTube Video',
          groq_api_key: groqApiKey.trim() || DEFAULT_GROQ_KEY,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Chat request failed.')

      const assistantMessage: ChatMsg = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: data.reply,
      }
      setChatMessages((prev) => [...prev, assistantMessage])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response.')
    } finally {
      setChatLoading(false)
    }
  }

  function handleCopyAll() {
    let textToCopy = ''
    if (activeTab === 'notes' && studyNotes) {
      textToCopy = studyNotes
    } else if (activeTab === 'chat') {
      textToCopy = chatMessages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')
    } else {
      textToCopy = finalResult?.text || displayedSegments.map((s) => `[${formatTime(s.start)}] ${s.text}`).join('\n')
    }
    navigator.clipboard.writeText(textToCopy)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
  }

  function downloadFile(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
  }

  function handleDownloadTxt() {
    const title = displayedVideo?.title || 'transcript'
    if (activeTab === 'notes' && studyNotes) {
      downloadFile(studyNotes, `${title.slice(0, 40).replace(/[^a-zA-Z0-9_-]/g, '_')}_notes.md`, 'text/markdown;charset=utf-8')
      return
    }
    if (activeTab === 'chat') {
      const chatText = chatMessages.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}:\n${m.content}`).join('\n\n---\n\n')
      downloadFile(chatText, `${title.slice(0, 40).replace(/[^a-zA-Z0-9_-]/g, '_')}_chat.md`, 'text/markdown;charset=utf-8')
      return
    }
    const header = `${title}\n${displayedVideo?.webpage_url || ''}\nDuration: ${formatDuration(displayedVideo?.duration)}\n\n---\n\n`
    const body = displayedSegments.map((s) => `[${formatTime(s.start)} - ${formatTime(s.end)}] ${s.text}`).join('\n\n')
    downloadFile(header + body, `${title.slice(0, 40).replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`, 'text/plain;charset=utf-8')
  }

  function handleDownloadSrt() {
    const title = displayedVideo?.title || 'subtitles'
    const srtContent = displayedSegments
      .map((s, idx) => `${idx + 1}\n${formatSrtTime(s.start)} --> ${formatSrtTime(s.end)}\n${s.text}\n`)
      .join('\n')
    downloadFile(srtContent, `${title.slice(0, 40).replace(/[^a-zA-Z0-9_-]/g, '_')}.srt`, 'text/plain;charset=utf-8')
  }

  function handleDownloadVtt() {
    const title = displayedVideo?.title || 'subtitles'
    const vttContent = `WEBVTT - ${title}\n\n` + displayedSegments
      .map((s, idx) => `${idx + 1}\n${formatVttTime(s.start)} --> ${formatVttTime(s.end)}\n${s.text}\n`)
      .join('\n')
    downloadFile(vttContent, `${title.slice(0, 40).replace(/[^a-zA-Z0-9_-]/g, '_')}.vtt`, 'text/vtt;charset=utf-8')
  }

  function handleDownloadJson() {
    const title = displayedVideo?.title || 'transcript'
    const payload = finalResult || {
      video: displayedVideo,
      segments: displayedSegments,
      text: displayedSegments.map((s) => s.text).join(' '),
      language: detectedLang?.code,
    }
    downloadFile(JSON.stringify(payload, null, 2), `${title.slice(0, 40).replace(/[^a-zA-Z0-9_-]/g, '_')}.json`, 'application/json')
  }

  function openTimestampUrl(startTime: number) {
    const baseUrl = displayedVideo?.webpage_url || url
    if (!baseUrl) return
    const seekSeconds = Math.floor(startTime)
    const separator = baseUrl.includes('?') ? '&' : '?'
    const timestampedUrl = `${baseUrl}${separator}t=${seekSeconds}s`
    window.open(timestampedUrl, '_blank', 'noopener,noreferrer')
  }

  const activeLanguage = finalResult?.language_name || detectedLang?.name || (finalResult?.language ? finalResult.language.toUpperCase() : null)

  return (
    <div className="app">
      {/* Minimalist Top Navigation */}
      <nav className="navbar">
        <div className="navBrand">
          <span className="brandDot" />
          <span className="brandTitle">LocalScribe</span>
          <span className="brandBadge">Groq Whisper</span>
        </div>

        <div className="navActions">
          <button
            type="button"
            className="btnSecondary btnSmall"
            onClick={() => setShowHistory(true)}
            title="Transcription History"
          >
            <Icons.History />
            <span>History</span>
            {historyItems.length > 0 && <span className="counterBadge">{historyItems.length}</span>}
          </button>

          <div className="navStatus">
            <span className={`statusIndicatorDot ${health?.ok ? 'active' : ''}`} />
            <span>{health?.ok ? 'Ready' : 'Offline'}</span>
          </div>
        </div>
      </nav>

      {/* Centered Clean Search Bar */}
      <header className="heroSection">
        <form className="searchContainer" onSubmit={handleSubmit}>
          <div className="searchBar">
            <span className="searchIconPrefix">
              <Icons.Play />
            </span>
            <input
              className="searchInput"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste a YouTube URL to transcribe..."
              disabled={loading}
            />
            <button className="btnPrimary" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Transcribe'}
            </button>
          </div>

          <div className="searchMetaRow">
            <div className="engineSwitcherGroup">
              <button
                type="button"
                className={`engineChip ${engine === 'groq' ? 'active' : ''}`}
                onClick={() => setEngine('groq')}
                title="Transcribe spoken audio with Groq Whisper Large v3"
              >
                <span>⚡ Whisper Large v3</span>
              </button>
              <button
                type="button"
                className={`engineChip ${engine === 'youtube' ? 'active' : ''}`}
                onClick={() => setEngine('youtube')}
                title="Extract official or auto-generated YouTube subtitles (Instant)"
              >
                <Icons.Captions />
                <span>YouTube Captions</span>
              </button>
            </div>

            <button
              type="button"
              className={`btnGhost ${showOptions ? 'active' : ''}`}
              onClick={() => setShowOptions(!showOptions)}
            >
              <Icons.Settings />
              <span>Options</span>
            </button>
          </div>

          {/* Options Drawer */}
          {showOptions && (
            <div className="optionsPanel">
              <div className="optionField">
                <label>Language</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                  {LANGUAGES_LIST.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="optionField">
                <label>Inference Engine</label>
                <select value={engine} onChange={(e) => setEngine(e.target.value as any)}>
                  <option value="groq">Groq Cloud (Fastest · Large v3)</option>
                  <option value="youtube">YouTube Captions (Instant)</option>
                  <option value="gemini">Google Gemini AI</option>
                </select>
              </div>

              <div className="optionField">
                <label>Model Preset</label>
                <select value={model} onChange={(e) => setModel(e.target.value)}>
                  <option value="whisper-large-v3">Whisper Large v3 (Full Accuracy)</option>
                  <option value="whisper-large-v3-turbo">Whisper Large v3 Turbo</option>
                </select>
              </div>
            </div>
          )}
        </form>

        {error && <div className="errorNotice">{error}</div>}

        {/* Minimalist Linear Progress Bar */}
        {loading && (
          <div className="progressWidget">
            <div className="progressWidgetHeader">
              <span className="progressStatus">{statusMessage || 'Transcribing...'}</span>
              <span className="progressNumber">{progressPercent}%</span>
            </div>
            <div className="progressBar">
              <div className="progressBarInner" style={{ width: `${Math.max(4, progressPercent)}%` }} />
            </div>
          </div>
        )}
      </header>

      {/* Main Workspace */}
      {(displayedVideo || displayedSegments.length > 0) && (
        <main className="workspaceGrid">
          {/* Left Column: Video Metadata & Tools */}
          <aside className="sidebar">
            <div className="card sidebarCard">
              {displayedVideo?.thumbnail && (
                <div className="thumbContainer">
                  <img src={displayedVideo.thumbnail} alt="Thumbnail" />
                  {displayedVideo.duration ? (
                    <span className="durationTag">{formatDuration(displayedVideo.duration)}</span>
                  ) : null}
                </div>
              )}

              <div className="videoMetaBlock">
                <h2 className="metaTitle">{displayedVideo?.title || 'YouTube Video'}</h2>
                <span className="metaAuthor">{displayedVideo?.uploader || 'YouTube Channel'}</span>
              </div>

              <div className="metaStatsRow">
                <div className="metaStat">
                  <span className="metaStatVal">{displayedSegments.length}</span>
                  <span className="metaStatKey">Segments</span>
                </div>
                <div className="metaStat">
                  <span className="metaStatVal">{activeLanguage || 'Auto'}</span>
                  <span className="metaStatKey">Language</span>
                </div>
                <div className="metaStat">
                  <span className="metaStatVal">
                    {finalResult ? `${finalResult.processing_seconds.toFixed(1)}s` : `${progressPercent}%`}
                  </span>
                  <span className="metaStatKey">{finalResult ? 'Time' : 'Status'}</span>
                </div>
              </div>

              <div className="actionGroup">
                <button
                  type="button"
                  className="btnSecondary btnFull"
                  disabled={refining || loading || displayedSegments.length === 0}
                  onClick={handleGenerateStudyNotes}
                >
                  <Icons.Sparkles />
                  <span>{refining ? 'Generating...' : 'Generate JLPT Notes'}</span>
                </button>
              </div>

              <div className="exportContainer">
                <span className="sectionHeading">Export</span>
                <div className="exportRow">
                  <button type="button" className="btnSmall btnSecondary" onClick={handleCopyAll}>
                    {copiedAll ? <Icons.Check /> : <Icons.Copy />}
                    <span>{copiedAll ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button type="button" className="btnSmall btnSecondary" onClick={handleDownloadTxt}>TXT</button>
                  <button type="button" className="btnSmall btnSecondary" onClick={handleDownloadSrt}>SRT</button>
                  <button type="button" className="btnSmall btnSecondary" onClick={handleDownloadVtt}>VTT</button>
                  <button type="button" className="btnSmall btnSecondary" onClick={handleDownloadJson}>JSON</button>
                </div>
              </div>
            </div>
          </aside>

          {/* Right Column: Multi-tab Viewer */}
          <section className="mainContent">
            <div className="card contentCard">
              <div className="tabHeader">
                <div className="tabGroup">
                  <button
                    type="button"
                    className={`tabItem ${activeTab === 'transcript' ? 'active' : ''}`}
                    onClick={() => setActiveTab('transcript')}
                  >
                    Transcript ({displayedSegments.length})
                  </button>
                  <button
                    type="button"
                    className={`tabItem ${activeTab === 'notes' ? 'active' : ''}`}
                    onClick={() => {
                      if (!studyNotes) handleGenerateStudyNotes()
                      else setActiveTab('notes')
                    }}
                  >
                    Study Notes {studyNotes ? '•' : ''}
                  </button>
                  <button
                    type="button"
                    className={`tabItem ${activeTab === 'chat' ? 'active' : ''}`}
                    onClick={() => setActiveTab('chat')}
                  >
                    Chat {chatMessages.length > 0 ? `(${chatMessages.length})` : ''}
                  </button>
                </div>

                {activeTab === 'transcript' && (
                  <div className="transcriptHeaderControls">
                    {loading && (
                      <button
                        type="button"
                        className={`btnGhost btnSmall ${autoScroll ? 'active' : ''}`}
                        onClick={() => setAutoScroll(!autoScroll)}
                      >
                        Auto-scroll
                      </button>
                    )}
                    <div className="searchFilterBox">
                      <Icons.Search />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Filter text..."
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* TAB 1: Clean Transcript */}
              {activeTab === 'transcript' && (
                <div className="transcriptList" ref={segmentsContainerRef}>
                  {filteredSegments.map((segment, index) => {
                    const isLatest = loading && index === filteredSegments.length - 1
                    return (
                      <div className={`segmentItem ${isLatest ? 'latest' : ''}`} key={`${segment.id}-${segment.start}`}>
                        <button
                          className="timeTag"
                          type="button"
                          onClick={() => openTimestampUrl(segment.start)}
                          title="Seek on YouTube"
                        >
                          {formatTime(segment.start)}
                        </button>
                        <p className="segmentText">{segment.text.trim()}</p>
                      </div>
                    )
                  })}

                  {filteredSegments.length === 0 && displayedSegments.length > 0 && (
                    <div className="emptyState">No segments matching filter.</div>
                  )}
                </div>
              )}

              {/* TAB 2: Clean JLPT Study Notes */}
              {activeTab === 'notes' && (
                <div className="notesView">
                  {refining ? (
                    <div className="loadingState">
                      <span className="spinner" />
                      <p>Generating structured bilingual study notes...</p>
                    </div>
                  ) : studyNotes ? (
                    <div className="proseContent">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{studyNotes}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="emptyState">
                      <p>Generate clean, structured study notes with Kanji, Romaji, and Nepali translations.</p>
                      <button type="button" className="btnSecondary" onClick={handleGenerateStudyNotes}>
                        <Icons.Sparkles />
                        <span>Generate JLPT Notes</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Interactive Video Chat */}
              {activeTab === 'chat' && (
                <div className="chatView">
                  <div className="chatHistory">
                    {chatMessages.length === 0 ? (
                      <div className="chatEmptyState">
                        <div className="emptyStateIcon">
                          <Icons.Chat />
                        </div>
                        <h3>Ask questions about this video</h3>
                        <p>Ask for grammar explanations, Nepali translations, or practice questions.</p>

                        <div className="promptPills">
                          {PROMPT_SUGGESTIONS.map((sugg, idx) => (
                            <button
                              key={idx}
                              type="button"
                              className="promptPill"
                              onClick={() => handleSendChatMessage(sugg)}
                            >
                              {sugg}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      chatMessages.map((msg) => (
                        <div key={msg.id} className={`messageRow ${msg.role}`}>
                          <div className="messageAuthor">{msg.role === 'user' ? 'You' : 'AI'}</div>
                          <div className="messageContent">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                          </div>
                        </div>
                      ))
                    )}

                    {chatLoading && (
                      <div className="messageRow assistant loading">
                        <div className="messageAuthor">AI</div>
                        <div className="messageContent">
                          <div className="typingIndicator">
                            <span />
                            <span />
                            <span />
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={chatBottomRef} />
                  </div>

                  <form
                    className="chatInputBar"
                    onSubmit={(e) => {
                      e.preventDefault()
                      handleSendChatMessage()
                    }}
                  >
                    <input
                      className="chatInput"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask a question about this video (e.g. 'Explain the rule at 5:58')..."
                      disabled={chatLoading}
                    />
                    <button
                      type="submit"
                      className="btnPrimary btnSmall"
                      disabled={chatLoading || !chatInput.trim()}
                    >
                      <Icons.Send />
                    </button>
                  </form>
                </div>
              )}
            </div>
          </section>
        </main>
      )}

      {/* History Slide-over Modal */}
      {showHistory && (
        <div className="modalBackdrop" onClick={() => setShowHistory(false)}>
          <div className="modalContainer" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div>
                <h2 className="modalHeading">Transcription History</h2>
                <span className="modalSubheading">{historyItems.length} saved transcripts</span>
              </div>

              <div className="modalActions">
                {historyItems.length > 0 && (
                  <button type="button" className="btnGhost btnSmall textDanger" onClick={handleClearAllHistory}>
                    Clear All
                  </button>
                )}
                <button type="button" className="iconButton" onClick={() => setShowHistory(false)}>
                  <Icons.Close />
                </button>
              </div>
            </div>

            <div className="modalSearch">
              <div className="searchFilterBox fullWidth">
                <Icons.Search />
                <input
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search history..."
                />
              </div>
            </div>

            <div className="modalBody">
              {filteredHistory.length === 0 ? (
                <div className="emptyState">
                  {historyItems.length === 0 ? 'No history yet.' : 'No matching items.'}
                </div>
              ) : (
                filteredHistory.map((item) => (
                  <div
                    key={item.id}
                    className="historyRow"
                    onClick={() => loadHistoryRecord(item)}
                  >
                    {item.video?.thumbnail && (
                      <div className="historyThumb">
                        <img src={item.video.thumbnail} alt="thumb" />
                        {item.video.duration ? (
                          <span className="thumbDuration">{formatDuration(item.video.duration)}</span>
                        ) : null}
                      </div>
                    )}

                    <div className="historyInfo">
                      <h3 className="historyTitle">{item.video?.title || 'Untitled'}</h3>
                      <div className="historySubText">
                        <span>{item.video?.uploader || 'YouTube'}</span>
                        {item.createdAt && (
                          <>
                            <span>•</span>
                            <span>{formatDate(item.createdAt)}</span>
                          </>
                        )}
                      </div>
                      <div className="historyBadges">
                        <span className="badge">{item.segments?.length || 0} segments</span>
                        <span className="badge">{item.language_name || item.language?.toUpperCase() || 'Auto'}</span>
                        {item.studyNotes && <span className="badge accent">Notes Ready</span>}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="iconButton deleteBtn"
                      onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                      title="Delete"
                    >
                      <Icons.Trash />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <footer className="footer">
        <span>LocalScribe · Groq Speech Intelligence</span>
      </footer>
    </div>
  )
}

export default App
