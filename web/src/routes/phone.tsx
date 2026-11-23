import { createFileRoute } from '@tanstack/react-router'
import React, { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import {
  Badge,
  Button,
  Card,
  Container,
  Flex,
  Heading,
  ScrollArea,
  Separator,
  Text,
  TextArea,
} from '@radix-ui/themes'

export const Route = createFileRoute('/phone')({ component: Phone })

type PhoneMessage = { role: 'user' | 'assistant' | 'system' | 'change'; text: string }

function Phone() {
  const [code, setCode] = useState('')
  const [messages, setMessages] = useState<PhoneMessage[]>([])
  const [connected, setConnected] = useState(false)
  const [working, setWorking] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState('')
  const socketRef = useRef<Socket | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setCode(new URLSearchParams(window.location.search).get('code')?.trim() ?? '')
  }, [])

  useEffect(() => {
    if (!code) return
    const socket = io()
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      socket.emit('phone join', { code })
      // 加入房间后请 agent 补一次当前对话。
      socket.emit('agent sync', { code })
    })
    socket.on('disconnect', () => {
      setConnected(false)
      setWorking(false)
    })
    socket.on('agent messages', (payload: { messages?: PhoneMessage[]; working?: boolean }) => {
      setMessages(payload.messages ?? [])
      setWorking(payload.working === true)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [code])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, working])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const msg = text.trim()
    if (!msg || !code || sending || working) return
    setSending(true)
    setStatus('发送中…')
    try {
      const res = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ msg, code }),
      })
      const data = await res.json()
      setStatus(res.ok ? '已发送，等待 agent 处理' : `失败：${data.error}`)
      if (res.ok) setText('')
    } catch (err) {
      setStatus(`请求失败：${(err as Error).message}`)
    } finally {
      setSending(false)
    }
  }

  const isError = status.includes('失败')

  return (
    <main>
      <Container size="2" px="4" py="6">
        <Flex align="center" justify="between" gap="3" wrap="wrap" mb="2">
          <Heading size="6">手机对话</Heading>
          <Badge size="2" color={connected ? 'green' : 'gray'} variant="soft">
            {connected ? '已连接' : code ? '连接中…' : '缺少连接码'}
          </Badge>
        </Flex>
        <Text size="2" color="gray" as="p" mb="4">
          {code ? `连接码：${code}` : '请从 agent 端点击「手机连接」后扫码进入'}
        </Text>

        <Card size="2">
          <ScrollArea className="phone-scroll">
            <Flex direction="column" gap="2" pr="3">
              {messages.length === 0 ? (
                <Flex align="center" justify="center" py="8">
                  <Text size="2" color="gray">
                    等待 agent 输出…
                  </Text>
                </Flex>
              ) : (
                messages.map((message, index) => (
                  <div key={`${index}-${message.role}`} className={`phone-row ${message.role}`}>
                    <div className="phone-bubble">
                      <Text size="2" as="div">
                        {message.text}
                      </Text>
                    </div>
                  </div>
                ))
              )}
              {working && (
                <div className="phone-working">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                  <Text size="1" color="gray">
                    Agent 正在处理…
                  </Text>
                </div>
              )}
              <div ref={endRef} />
            </Flex>
          </ScrollArea>

          <Separator size="4" my="3" />

          <form onSubmit={send}>
            <Flex direction="column" gap="2">
              <TextArea
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoComplete="off"
                placeholder={code ? '给 agent 发消息' : '缺少连接码'}
                rows={2}
                resize="vertical"
                disabled={!code}
              />
              <Flex align="center" justify="between" gap="3" wrap="wrap">
                <Text size="2" color={isError ? 'red' : 'gray'}>
                  {status}
                </Text>
                <Button type="submit" loading={sending} disabled={!text.trim() || !code || working}>
                  发送
                </Button>
              </Flex>
            </Flex>
          </form>
        </Card>
      </Container>
    </main>
  )
}
