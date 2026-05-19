const QUEUE_KEY = 'event_queue'

// 上报事件（先存队列，再尝试发送）
export const reportEvent = async (supabase, studentId, eventType, dimension, data = {}) => {
  if (!studentId) return

  const event = {
    student_id: studentId,
    event_type: eventType,
    dimension,
    data,
    client_timestamp: new Date().toISOString()
  }

  // 1. 先存 localStorage 队列
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
  queue.push(event)
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))

  // 2. 尝试上报
  try {
    const { error } = await supabase.from('student_events').insert({
      student_id: event.student_id,
      event_type: event.event_type,
      dimension: event.dimension,
      data: event.data
    })

    if (!error) {
      // 成功 → 从队列移除（只移除第一个匹配的）
      const remaining = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
      const idx = remaining.findIndex(e =>
        e.client_timestamp === event.client_timestamp &&
        e.event_type === event.event_type
      )
      if (idx !== -1) {
        remaining.splice(idx, 1)
        localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining))
      }
    }
  } catch (err) {
    console.warn('Event queued for retry:', event.event_type)
  }
}

// 定期 flush 队列（10秒）
export const startEventFlush = (supabase) => {
  return setInterval(async () => {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
    if (queue.length === 0) return

    try {
      const eventsToInsert = queue.map(e => ({
        student_id: e.student_id,
        event_type: e.event_type,
        dimension: e.dimension,
        data: e.data
      }))

      const { error } = await supabase.from('student_events').insert(eventsToInsert)

      if (!error) {
        localStorage.setItem(QUEUE_KEY, '[]')
        console.log(`Flushed ${queue.length} queued events`)
      }
    } catch (err) {
      console.warn('Event flush failed, will retry')
    }
  }, 10000)
}

// 获取队列中的事件数量（调试用）
export const getQueuedEventCount = () => {
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
  return queue.length
}
