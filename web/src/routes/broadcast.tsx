import { createFileRoute } from '@tanstack/react-router'
import React, { useState } from 'react'

export const Route = createFileRoute('/broadcast')({ component: Broadcast })

function Broadcast() {
  const [text, setText] = useState('')
  const [status, setStatus] = useState('')
  const [sending, setSending] = useState(false)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const msg = text.trim()
    if (!msg || sending) return
    setSending(true)
    setStatus('发送中…')
    try {
      const res = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ msg }),
      })
      const data = await res.json()
      setStatus(res.ok ? '已发送' : `失败：${data.error}`)
      if (res.ok) setText('')
    } catch (err) {
      setStatus(`请求失败：${(err as Error).message}`)
    } finally {
      setSending(false)
    }
  }

  return (
    <main>
      <h1>广播</h1>
      <form onSubmit={send}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoComplete="off"
          placeholder="输入内容"
        />
        <button disabled={!text.trim() || sending}>发送</button>
      </form>
      <p>{status}</p>
    </main>
  )
}
