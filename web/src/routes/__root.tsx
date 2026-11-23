import { HeadContent, Link, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import { Box, Container, Flex, Text, Theme } from '@radix-ui/themes'

import radixCss from '@radix-ui/themes/styles.css?url'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { title: 'lane-serve' },
    ],
    links: [
      { rel: 'stylesheet', href: radixCss },
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function RootLayout() {
  return (
    <Theme
      accentColor="indigo"
      radius="large"
      style={{
        minHeight: '100dvh',
        background: 'var(--gray-2)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <Box
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          borderBottom: '1px solid var(--gray-a5)',
          background: 'var(--color-panel-solid)',
        }}
      >
        <Container size="2" px="4">
          <Flex align="center" justify="between" py="3">
            <Text weight="bold" size="3">
              lane-serve
            </Text>
            <nav>
              <Link
                to="/"
                activeOptions={{ exact: true, includeSearch: false }}
                activeProps={{ className: 'active' }}
              >
                聊天
              </Link>
              <Link to="/broadcast" activeOptions={{ includeSearch: false }} activeProps={{ className: 'active' }}>
                广播
              </Link>
              <Link to="/phone" activeOptions={{ includeSearch: false }} activeProps={{ className: 'active' }}>
                手机
              </Link>
            </nav>
          </Flex>
        </Container>
      </Box>
      <Outlet />
    </Theme>
  )
}
