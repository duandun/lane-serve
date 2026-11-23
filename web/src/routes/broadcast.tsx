import { createFileRoute } from '@tanstack/react-router'
import React, { useEffect, useState } from 'react'
import { Button, Card, Container, Flex, Heading, Text, TextArea } from '@radix-ui/themes'

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

  const isError = status.includes('失败')
  const isOk = status === '已发送'

  return (
    <main>
      <Container size="2" px="4" py="6">
        <Heading size="6" mb="2">
          广播
        </Heading>
        <Text size="2" color="gray" as="p" mb="4">
          {code ? `连接码：${code}` : '缺少连接码，请从 agent 端扫码进入'}
        </Text>
        <Card size="3">
          <form onSubmit={send}>
            <Flex direction="column" gap="3">
              <TextArea
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoComplete="off"
                placeholder="输入要广播的内容"
                rows={4}
                resize="vertical"
              />
              <Flex align="center" justify="between" gap="3" wrap="wrap">
                <Text size="2" color={isError ? 'red' : isOk ? 'green' : 'gray'}>
                  {status}
                </Text>
                <Button type="submit" loading={sending} disabled={!text.trim() || !code}>
                  发送广播
                </Button>
              </Flex>
            </Flex>
          </form>
        </Card>
      </Container>
    </main>
  )
}
