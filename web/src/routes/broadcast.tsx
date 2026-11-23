import { createFileRoute } from '@tanstack/react-router'
import React, { useEffect, useState } from 'react'

export const Route = createFileRoute('/broadcast')({ component: Broadcast })

function Broadcast() {
  const [text, setText] = useState('')
  const [status, setStatus] = useState('')
  const [sending, setSending] = useState(false)
  const [code, setCode] = useState('')

  useEffect(() => {
    setCode(new URLSearchParams(window.location.search).get('code')?.trim() ?? '')
  }, [])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const msg = text.trim()
    if (!msg || sending || !code) return
    setSending(true)
    setStatus('发送中…')
    try {
      const res = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ msg, code }),
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
      <p>{code ? `连接码：${code}` : '缺少连接码，请从 agent 端扫码进入'}</p>
      <form onSubmit={send}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoComplete="off"
          placeholder="输入内容"
        />
        <button disabled={!text.trim() || sending || !code}>发送</button>
      </form>
      <p>{status}</p>
    </main>
  )
}
