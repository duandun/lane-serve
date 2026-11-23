import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

export const Route = createFileRoute('/')({ component: Chat })

type Message = { id: string; msg: string; code?: string }

function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [socketId, setSocketId] = useState('')
  const [text, setText] = useState('')
  const [code, setCode] = useState('')
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    setCode(new URLSearchParams(window.location.search).get('code')?.trim() ?? '')
  }, [])

  useEffect(() => {
    const socket = io()
    socketRef.current = socket

    socket.on('connect', () => {
      setSocketId(socket.id ?? '')
      const c = new URLSearchParams(window.location.search).get('code')?.trim()
      if (c) socket.emit('phone join', { code: c })
    })
    socket.on('disconnect', () => setSocketId(''))
    socket.on('chat message', (m: Message) => setMessages((prev) => [...prev, m]))

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  function send(e: React.FormEvent) {
    e.preventDefault()
    const msg = text.trim()
    if (!msg || !code) return
    socketRef.current?.emit('chat message', { msg, code })
    setText('')
  }

  return (
    <main>
      <h1>lane-serve chat</h1>
      <p>{socketId ? `已连接 ${socketId}` : '连接中…'}</p>
      <p>{code ? `连接码：${code}` : '缺少连接码，请从 /broadcast?code=… 进入'}</p>
      <ul>
        {messages.map((m, i) => (
          <li key={i}>
            {m.id.slice(0, 6)}: {m.msg}
          </li>
        ))}
      </ul>
      <form onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" required />
        <button disabled={!text.trim() || !code}>发送</button>
      </form>
    </main>
  )
}
