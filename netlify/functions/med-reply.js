export default async (req) => {
  const SUPA_URL = process.env.SUPA_URL
  const SUPA_KEY = process.env.SUPA_KEY
  const MY_PHONE = process.env.MY_PHONE

  const body = await req.text()
  const params = new URLSearchParams(body)
  const from = params.get('From')?.replace(/\D/g,'')
  const myNum = MY_PHONE?.replace(/\D/g,'')
  const rawMessage = params.get('Body')?.trim() || ''
  const message = rawMessage.toUpperCase()

  // Only accept replies from your own number
  if(!from || !from.endsWith(myNum?.slice(-10))) {
    return new Response('<Response></Response>', {headers:{'Content-Type':'text/xml'}})
  }

  // Parse status and optional time
  // Accepts: TAKEN, SKIP, TAKEN 7:30, TAKEN 7:30AM, TAKEN 7AM, TAKEN 7
  let status = null
  let customTime = null

  if(message.startsWith('TAKEN')){
    status = 'taken'
    const timePart = rawMessage.slice(5).trim()
    if(timePart){
      // Try to parse time like "7:30am", "7:30", "7am", "7"
      const match = timePart.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i)
      if(match){
        let hours = parseInt(match[1])
        const mins = parseInt(match[2]||'0')
        const ampm = match[3]?.toLowerCase()
        if(ampm==='pm' && hours<12) hours+=12
        if(ampm==='am' && hours===12) hours=0
        customTime = {hours, mins}
      }
    }
  } else if(message.startsWith('SKIP')){
    status = 'skip'
  }

  if(!status) return new Response('<Response></Response>', {headers:{'Content-Type':'text/xml'}})

  const now = new Date()
  const pacific = new Date(now.toLocaleString('en-US', {timeZone:'America/Los_Angeles'}))
  const today = pacific.toISOString().slice(0,10)

  // Build taken_at timestamp
  let takenAt = now.toISOString()
  if(customTime){
    const d = new Date(today + 'T00:00:00')
    d.setHours(customTime.hours, customTime.mins, 0, 0)
    takenAt = d.toISOString()
  }

  const timeStr = new Date(takenAt).toLocaleTimeString('en-US',{
    hour:'numeric', minute:'2-digit', timeZone:'America/Los_Angeles'
  })

  // Get all active meds
  const medsRes = await fetch(`${SUPA_URL}/rest/v1/medications?active=eq.true`, {
    headers:{'apikey':SUPA_KEY,'Authorization':`Bearer ${SUPA_KEY}`}
  })
  const meds = await medsRes.json()

  let logged = 0
  for(const med of meds){
    const logRes = await fetch(`${SUPA_URL}/rest/v1/med_logs?med_id=eq.${med.id}&date=eq.${today}`, {
      headers:{'apikey':SUPA_KEY,'Authorization':`Bearer ${SUPA_KEY}`}
    })
    const logs = await logRes.json()
    const existing = logs.find(l=>['taken','skip','missed'].includes(l.status))

    if(existing){
      // Update existing log
      await fetch(`${SUPA_URL}/rest/v1/med_logs?id=eq.${existing.id}`, {
        method:'PATCH',
        headers:{'apikey':SUPA_KEY,'Authorization':`Bearer ${SUPA_KEY}`,'Content-Type':'application/json'},
        body: JSON.stringify({status, taken_at: takenAt})
      })
    } else {
      await fetch(`${SUPA_URL}/rest/v1/med_logs`, {
        method:'POST',
        headers:{'apikey':SUPA_KEY,'Authorization':`Bearer ${SUPA_KEY}`,'Content-Type':'application/json'},
        body: JSON.stringify({
          id: Date.now().toString(36)+Math.random().toString(36).slice(2),
          med_id: med.id,
          taken_at: takenAt,
          status,
          date: today
        })
      })
    }
    logged++
  }

  const reply = status === 'taken'
    ? `✅ Logged at ${timeStr}! Great job.`
    : `⏭️ Skipped for today. Stay on track tomorrow!`

  return new Response(
    `<Response><Message>${reply}</Message></Response>`,
    {headers:{'Content-Type':'text/xml'}}
  )
}

export const config = { path: '/api/med-reply' }
