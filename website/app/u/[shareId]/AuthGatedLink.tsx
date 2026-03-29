'use client'

export default function AuthGatedLink({
  href,
  isLoggedIn,
  shareId,
  className,
  children,
}: {
  href: string
  isLoggedIn: boolean
  shareId: string
  className?: string
  children: React.ReactNode
}) {
  const handleClick = (e: React.MouseEvent) => {
    if (!isLoggedIn) {
      e.preventDefault()
      window.location.href = `/login?callbackUrl=${encodeURIComponent(`/u/${shareId}`)}`
    }
  }

  return (
    <a
      href={isLoggedIn ? href : '#'}
      target={isLoggedIn ? '_blank' : undefined}
      rel={isLoggedIn ? 'noopener noreferrer' : undefined}
      onClick={handleClick}
      className={className}
    >
      {children}
    </a>
  )
}
