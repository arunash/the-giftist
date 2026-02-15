import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import crypto from 'crypto'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.redirect(new URL('/login', process.env.NEXTAUTH_URL))
  }

  const userId = (session.user as any).id

  // Set linking token in DB
  await prisma.user.update({
    where: { id: userId },
    data: { linkingToken: `link_${Date.now()}` },
  })

  // Build Google OAuth URL directly
  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
  const state = crypto.randomBytes(32).toString('hex')
  const codeVerifier = crypto.randomBytes(32).toString('base64url')
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')

  // Store state and code_verifier in a cookie for the callback
  const params = new URLSearchParams({
    client_id: clientId!,
    scope: 'openid email profile',
    response_type: 'code',
    redirect_uri: redirectUri,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  const googleUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

  // We need NextAuth to handle the callback, so use its signIn flow
  // Instead of building OAuth manually, redirect to NextAuth's CSRF-free internal flow
  // The simplest approach: redirect to the NextAuth signIn page which auto-redirects to Google
  const signInUrl = new URL('/api/auth/signin/google', process.env.NEXTAUTH_URL)
  signInUrl.searchParams.set('callbackUrl', '/feed')

  // Actually, we need to POST to this URL with CSRF token, which is the whole problem.
  // So instead, let's use a form-based approach via an HTML page
  return new NextResponse(
    `<!DOCTYPE html>
<html>
<body>
<form id="f" method="POST" action="${process.env.NEXTAUTH_URL}/api/auth/signin/google">
  <input type="hidden" name="callbackUrl" value="/feed" />
  <input type="hidden" name="csrfToken" id="csrf" />
</form>
<script>
fetch('/api/auth/csrf').then(r=>r.json()).then(d=>{
  document.getElementById('csrf').value=d.csrfToken;
  document.getElementById('f').submit();
});
</script>
</body>
</html>`,
    {
      headers: { 'Content-Type': 'text/html' },
    }
  )
}
