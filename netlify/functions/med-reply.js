export default async (req) => {
  const SUPA_URL = process.env.SUPA_URL
  const SUPA_KEY = process.env.SUPA_KEY
  const MY_PHONE = process.env.MY_PHONE

  const body = await req.text()
  const params = new URLSearchParams(body)
  const from = params.get('From')?.replace(/\D/g,'')
  const myNum = MY_PHONE?.replace(/\D/g,'')
  const message = params.get('Body')?.trim().toUpperCase()

  // Only accept replies from your own number
  if(!from || !from.endsWith(myNum?.slice(-10))) {
    return new Response('<Response></Response>', {headers:{'Content-Type':'text/xml'}})
  }

  const status = message === 'TAKEN' ? 'taken' : message === 'SKIP' ? 'skip' : null
  if(!status) return new Response('<Response></Response>', {headers:{'Content-Type':'text/xml'}})

  const now = new Date()
  const pacific = new Date(now.toLocaleString('en-US', {timeZone:'America/Los_Angeles'}))
  const today = pacific.toISOString().slice(0,10)

  // Get all active meds
  const medsRes = await fetch(`${SUPA_URL}/rest/v1/medications?active=eq.true`, {
    headers:{'apikey':SUPA_KEY,'Authorization':`Bearer ${SUPA_KEY}`}
  })
  const meds = await medsRes.json()

  for(const med of meds){
    // Skip if already logged today
    const logRes = await fetch(`${SUPA_URL}/rest/v1/med_logs?med_id=eq.${med.id}&date=eq.${today}`, {
      headers:{'apikey':SUPA_KEY,'Authorization':`Bearer ${SUPA_KEY}`}
    })
    const logs = await logRes.json()
    const alreadyLogged = logs.some(l=>['taken','skip'].includes(l.status))
    if(alreadyLogged) continue

    // Log it
    await fetch(`${SUPA_URL}/rest/v1/med_logs`, {
      method:'POST',
      headers:{
        'apikey':SUPA_KEY,'Authorization':`Bearer ${SUPA_KEY}`,
        'Content-Type':'application/json'
      },
      body: JSON.stringify({
        id: Date.now().toString(36)+Math.random().toString(36).slice(2),
        med_id: med.id,
        taken_at: now.toISOString(),
        status,
        date: today
      })
    })
  }

  const reply = status === 'taken'
    ? '✅ Logged! Great job taking your meds.'
    : '⏭️ Skipped for today. Stay on track tomorrow!'

  return new Response(
    `<Response><Message>${reply}</Message></Response>`,
    {headers:{'Content-Type':'text/xml'}}
  )
}

export const config = { path: '/api/med-reply' }
