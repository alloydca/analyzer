import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { name, email, url } = await req.json()

    if (!name || !email || !url) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const payload = {
      name,
      email,
      companyName: '', // Required but can be empty
      url,
      companyType: 'other', // Required field
      source: 'product-content-analyzer'
    }

    console.log('[LEAD API] Attempting to submit to Brevo:', payload)
    
    const brevoUrl = process.env.BREVO_SUBMISSION_URL
    if (!brevoUrl) {
      console.log('[LEAD API] BREVO_SUBMISSION_URL not configured')
      return NextResponse.json({ error: 'Service configuration error' }, { status: 500 })
    }

    const res = await fetch(brevoUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    console.log('[LEAD API] Brevo response status:', res.status)
    
    if (!res.ok) {
      const text = await res.text()
      console.log('[LEAD API] Brevo error response:', text)
      return NextResponse.json({ error: text || 'Lead submission failed' }, { status: 502 })
    }

    const data = await res.json().catch(() => ({}))
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unexpected error' }, { status: 500 })
  }
}


