import type Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import type { Topic, CreateTopicInput, UpdateTopicInput } from '../ipc/types'

export class TopicRepository {
  constructor(private db: Database.Database) {}

  private institutionId(): string {
    const row = this.db.prepare('SELECT id FROM institution LIMIT 1').get() as { id: string } | undefined
    if (!row) throw new Error('Institution not configured')
    return row.id
  }

  list(subjectId?: string): Topic[] {
    let sql = 'SELECT * FROM topic WHERE institution_id = ?'
    const params: unknown[] = [this.institutionId()]
    if (subjectId) {
      sql += ' AND subject_id = ?'
      params.push(subjectId)
    }
    sql += ' ORDER BY sequence_number ASC, created_at DESC'
    return this.db.prepare(sql).all(...params) as Topic[]
  }

  getById(id: string): Topic | null {
    return this.db.prepare('SELECT * FROM topic WHERE topic_id = ?').get(id) as Topic | null
  }

  create(data: CreateTopicInput): Topic {
    const id = uuidv4()
    const institutionId = this.institutionId()
    this.db
      .prepare(`
        INSERT INTO topic
          (topic_id, institution_id, subject_id, topic_name, description,
           unit_name, chapter_name, sequence_number, is_custom)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `)
      .run(
        id, institutionId, data.subject_id, data.topic_name,
        data.description ?? null, data.unit_name ?? null,
        data.chapter_name ?? null, data.sequence_number ?? null
      )
    return this.getById(id)!
  }

  update(id: string, data: UpdateTopicInput): Topic {
    const sets: string[] = []
    const params: unknown[] = []

    if (data.topic_name !== undefined) { sets.push('topic_name = ?'); params.push(data.topic_name) }
    if (data.description !== undefined) { sets.push('description = ?'); params.push(data.description) }
    if (data.unit_name !== undefined) { sets.push('unit_name = ?'); params.push(data.unit_name) }
    if (data.chapter_name !== undefined) { sets.push('chapter_name = ?'); params.push(data.chapter_name) }
    if (data.sequence_number !== undefined) { sets.push('sequence_number = ?'); params.push(data.sequence_number) }
    if (data.active !== undefined) { sets.push('active = ?'); params.push(data.active ? 1 : 0) }

    if (sets.length === 0) return this.getById(id)!

    sets.push("updated_at = datetime('now')")
    params.push(id)
    this.db.prepare(`UPDATE topic SET ${sets.join(', ')} WHERE topic_id = ?`).run(...params)
    return this.getById(id)!
  }
}
