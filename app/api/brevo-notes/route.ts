import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { contactEmail, message, noteType, additionalData } = await req.json()

    if (!contactEmail || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const brevoNotesUrl = process.env.BREVO_RESULT_URL
    if (!brevoNotesUrl) {
      console.log('[BREVO NOTES API] BREVO_RESULT_URL not configured')
      return NextResponse.json({ error: 'Service configuration error' }, { status: 500 })
    }

    console.log('[BREVO NOTES API] Sending analysis to Brevo notes:', { contactEmail, noteType })
    
    const res = await fetch(brevoNotesUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactEmail,
        message,
        noteType,
        additionalData
      })
    })

    console.log('[BREVO NOTES API] Brevo notes response status:', res.status)
    
    if (!res.ok) {
      const text = await res.text()
      console.log('[BREVO NOTES API] Brevo notes error response:', text)
      return NextResponse.json({ error: text || 'Notes submission failed' }, { status: 502 })
    }

    const data = await res.json().catch(() => ({}))
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[BREVO NOTES API] Error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unexpected error' }, { status: 500 })
  }
}
