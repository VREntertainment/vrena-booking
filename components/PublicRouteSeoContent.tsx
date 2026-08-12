import { publicAppRoutes } from '../lib/appRoutes'

type PublicRouteSeoContentProps = {
  currentPath: string
  title: string
}

const publicRouteLinks = [
  { href: publicAppRoutes.sessions, label: 'Sessions' },
  { href: publicAppRoutes.tickets, label: 'Tickets' },
  { href: publicAppRoutes.leaderboard, label: 'Hall of Fame' },
  { href: publicAppRoutes.clubs, label: 'Clubs' },
]

export default function PublicRouteSeoContent({ currentPath, title }: PublicRouteSeoContentProps) {
  return (
    <>
      <h1 className="sr-only">{title}</h1>
      <noscript>
        <nav aria-label="VRena public pages">
          <ul>
            {publicRouteLinks
              .filter(({ href }) => href !== currentPath)
              .map(({ href, label }) => (
                <li key={href}>
                  <a href={href}>{label}</a>
                </li>
              ))}
          </ul>
        </nav>
      </noscript>
    </>
  )
}
