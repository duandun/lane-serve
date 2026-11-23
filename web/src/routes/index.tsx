import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
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
  TextField,
} from '@radix-ui/themes'

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
      <Container size="2" px="4" py="6">
        <Flex align="center" justify="between" gap="3" wrap="wrap" mb="2">
          <Heading size="6">聊天</Heading>
          <Badge size="2" color={socketId ? 'green' : 'gray'} variant="soft">
            {socketId ? `已连接 · ${socketId.slice(0, 6)}` : '连接中…'}
          </Badge>
        </Flex>
        <Text size="2" color="gray" as="p" mb="4">
          {code ? `连接码：${code}` : '缺少连接码，请从 /broadcast?code=… 进入'}
        </Text>
        <Card size="2">
          {messages.length === 0 ? (
            <Flex className="chat-scroll" align="center" justify="center">
              <Text size="2" color="gray">
                暂无消息
              </Text>
            </Flex>
          ) : (
            <ScrollArea className="chat-scroll">
              <Flex direction="column" gap="2" pr="3">
                {messages.map((m, i) => (
                  <div key={i} className={`msg-row${m.id === socketId ? ' own' : ''}`}>
                    <div className="msg">
                      <Text size="2" as="div">
                        {m.msg}
                      </Text>
                      <Text size="1" color="gray" as="div" mt="1">
                        {m.id.slice(0, 6)}
                      </Text>
                    </div>
                  </div>
                ))}
              </Flex>
            </ScrollArea>
          )}
          <Separator size="4" my="3" />
          <form onSubmit={send}>
            <Flex gap="2">
              <TextField.Root
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoComplete="off"
                placeholder="输入消息"
                required
                style={{ flexGrow: 1 }}
              />
              <Button type="submit" disabled={!text.trim() || !code}>
                发送
              </Button>
            </Flex>
          </form>
        </Card>
      </Container>
    </main>
  )
}
