export default async () => {
  const SUPA_URL = process.env.SUPA_URL
  const SUPA_KEY = process.env.SUPA_KEY
  const TWILIO_SID = process.env.TWILIO_SID
  const TWILIO_TOKEN = process.env.TWILIO_TOKEN
  const TWILIO_FROM = process.env.TWILIO_FROM
  const MY_PHONE = process.env.MY_PHONE

  const now = new Date()
  const pacific = new Date(now.toLocaleString('en-US', {timeZone:'America/Los_Angeles'}))
  const hour = pacific.getHours()
  const today = pacific.toISOString().slice(0,10)
  const dayOfWeek = pacific.getDay() // 0=Sun 1=Mon

  if(hour < 6 || hour > 21) return new Response('outside window')

  async function dbGet(table, filter=''){
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${filter}`, {
      headers:{'apikey':SUPA_KEY,'Authorization':`Bearer ${SUPA_KEY}`}
    })
    return r.json()
  }
  async function dbInsert(table, data){
    await fetch(`${SUPA_URL}/rest/v1/${table}`, {
      method:'POST',
      headers:{'apikey':SUPA_KEY,'Authorization':`Bearer ${SUPA_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify(data)
    })
  }
  async function sendSMS(msg){
    const params = new URLSearchParams({To:MY_PHONE,From:TWILIO_FROM,Body:msg})
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,{
      method:'POST',
      headers:{
        'Authorization':'Basic '+Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'),
        'Content-Type':'application/x-www-form-urlencoded'
      },
      body:params
    })
  }

  const meds = await dbGet('medications','active=eq.true')
  for(const med of meds){
    // Weekly med — only on its day
    if(med.frequency==='weekly'){
      const dayMap={sunday:0,monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6}
      if(dayOfWeek !== dayMap[med.reminder_day?.toLowerCase()]) continue
    }

    // Check if already handled today
    const logs = await dbGet('med_logs',`med_id=eq.${med.id}&date=eq.${today}`)
    const handled = logs.some(l=>['taken','skip','missed'].includes(l.status))
    if(handled) continue

    // Past 9pm — mark missed
    if(hour >= 21){
      await dbInsert('med_logs',{
        id: Date.now().toString(36)+Math.random().toString(36).slice(2),
        med_id:med.id, taken_at:now.toISOString(), status:'missed', date:today
      })
      await sendSMS(`📋 ${med.name} was not logged today — marked as missed. Reply TAKEN if you did take it.`)
      continue
    }

    // Check if this hour is a reminder hour
    const reminders = med.reminders || []
    const isReminderHour = reminders.some(r => r.hour === hour)
    if(!isReminderHour) continue

    const reminderNum = reminders.filter(r=>r.hour<=hour).length
    const total = reminders.length
    let msg
    if(reminderNum===1) msg=`🌅 Good morning! Time to take your ${med.name}. Reply TAKEN when done.`
    else if(reminderNum===total) msg=`⚠️ Last reminder for ${med.name} today. Reply TAKEN or SKIP.`
    else msg=`💊 Reminder #${reminderNum}: ${med.name} still pending. Reply TAKEN when done.`

    await sendSMS(msg)
  }

  return new Response('ok')
}

export const config = { schedule: '0 * * * *' }
