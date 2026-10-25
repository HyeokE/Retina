import { useCallback, useEffect, useState } from 'react'

export type Route = 'profile' | 'edit'

// Path-based entry: "/" opens Profile, "/edit" opens Edit profile.
// Vite dev and preview servers fall back to index.html for unknown paths.
const ROUTE_PATHS: Readonly<Record<Route, string>> = { profile: '/', edit: '/edit' }

function routeFromPath(pathname: string): Route | undefined {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return (Object.keys(ROUTE_PATHS) as Route[]).find((route) => ROUTE_PATHS[route] === normalized)
}

function currentRoute(): Route {
  return routeFromPath(window.location.pathname) ?? 'profile'
}

export function useRoute(): { route: Route; navigate: (to: Route) => void } {
  const [route, setRoute] = useState<Route>(currentRoute)

  useEffect(() => {
    // Unknown paths land on Profile; keep the address bar honest about it.
    if (routeFromPath(window.location.pathname) === undefined) {
      window.history.replaceState(null, '', ROUTE_PATHS.profile)
    }
    const onPopState = () => setRoute(currentRoute())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = useCallback((to: Route) => {
    window.history.pushState(null, '', ROUTE_PATHS[to])
    setRoute(to)
  }, [])

  return { route, navigate }
}
