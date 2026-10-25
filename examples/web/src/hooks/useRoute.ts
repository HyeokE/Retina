import { useCallback, useEffect, useState } from 'react'
import { pushAppPath, replaceAppPath } from '../infrastructure/retina-run.ts'

export type Route = 'profile' | 'edit'

// Path-based entry: "/" opens Profile, "/edit" opens Edit profile.
// Vite dev and preview servers fall back to index.html for unknown paths.
// History writes go through push/replaceAppPath so a test build keeps its
// ?retinaRun=<id> across navigation and reloads.
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
      replaceAppPath(ROUTE_PATHS.profile)
    }
    const onPopState = () => setRoute(currentRoute())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = useCallback((to: Route) => {
    pushAppPath(ROUTE_PATHS[to])
    setRoute(to)
  }, [])

  return { route, navigate }
}
