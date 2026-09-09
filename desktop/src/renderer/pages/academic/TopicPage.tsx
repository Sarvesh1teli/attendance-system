import { useState, useEffect } from 'react'
import { Plus, Pencil, Tag, Check, X } from 'lucide-react'
import type { Topic, Subject, CreateTopicInput } from '@main/ipc/types'

export default function TopicPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [selectedSubject, setSelectedSubject] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Topic | null>(null)
  const [form, setForm] = useState({
    topic_name: '', description: '', unit_name: '', chapter_name: '', sequence_number: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    window.api.subject.list({ active: true }).then(setSubjects)
  }, [])

  const loadTopics = async (subjectId: string) => {
    setLoading(true)
    try { setTopics(await window.api.topic.list(subjectId)) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (selectedSubject) loadTopics(selectedSubject)
    else setTopics([])
  }, [selectedSubject])

  const openCreate = () => {
    if (!selectedSubject) { alert('Select a subject first'); return }
    setEditing(null)
    setForm({ topic_name: '', description: '', unit_name: '', chapter_name: '', sequence_number: '' })
    setError(''); setShowForm(true)
  }

  const openEdit = (t: Topic) => {
    setEditing(t)
    setForm({
      topic_name: t.topic_name, description: t.description ?? '',
      unit_name: t.unit_name ?? '', chapter_name: t.chapter_name ?? '',
      sequence_number: t.sequence_number != null ? String(t.sequence_number) : '',
    })
    setError(''); setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.topic_name.trim()) { setError('Topic name is required'); return }
    setSaving(true)
    try {
      if (editing) {
        await window.api.topic.update(editing.topic_id, {
          topic_name: form.topic_name, description: form.description || undefined,
          unit_name: form.unit_name || undefined, chapter_name: form.chapter_name || undefined,
          sequence_number: form.sequence_number ? Number(form.sequence_number) : undefined,
        })
      } else {
        const input: CreateTopicInput = {
          subject_id: selectedSubject, topic_name: form.topic_name,
          description: form.description || undefined, unit_name: form.unit_name || undefined,
          chapter_name: form.chapter_name || undefined,
          sequence_number: form.sequence_number ? Number(form.sequence_number) : undefined,
        }
        await window.api.topic.create(input)
      }
      setShowForm(false); await loadTopics(selectedSubject)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally { setSaving(false) }
  }

  const handleToggleActive = async (t: Topic) => {
    try {
      const nextActive = t.active === false ? true : false
      await window.api.topic.update(t.topic_id, { ...t, active: nextActive })
      await loadTopics(selectedSubject)
    }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Update failed') }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Topics</h1>
          <p className="text-muted-foreground text-sm">Manage subject topics and syllabus</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
          <Plus className="h-4 w-4" /> Add Topic
        </button>
      </div>

      <div>
        <label className="text-sm font-medium">Select Subject</label>
        <select className="mt-1 border rounded-md px-3 py-2 text-sm bg-background w-full max-w-sm"
          value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
          <option value="">— Choose a subject —</option>
          {subjects.map(s => <option key={s.subject_id} value={s.subject_id}>{s.subject_name} ({s.subject_code})</option>)}
        </select>
      </div>

      {showForm && (
        <div className="bg-card border rounded-lg p-6 space-y-4">
          <h2 className="font-semibold">{editing ? 'Edit Topic' : 'New Topic'}</h2>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-sm font-medium">Topic Name *</label>
              <input className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.topic_name} onChange={e => setForm(f => ({ ...f, topic_name: e.target.value }))}
                placeholder="e.g. Introduction to Cell Biology" />
            </div>
            <div>
              <label className="text-sm font-medium">Unit</label>
              <input className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.unit_name} onChange={e => setForm(f => ({ ...f, unit_name: e.target.value }))}
                placeholder="e.g. Unit 1" />
            </div>
            <div>
              <label className="text-sm font-medium">Chapter</label>
              <input className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.chapter_name} onChange={e => setForm(f => ({ ...f, chapter_name: e.target.value }))}
                placeholder="e.g. Chapter 3" />
            </div>
            <div>
              <label className="text-sm font-medium">Sequence #</label>
              <input type="number" className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.sequence_number} onChange={e => setForm(f => ({ ...f, sequence_number: e.target.value }))}
                placeholder="Order in syllabus" />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <input className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border text-sm">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-60">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-card border rounded-lg overflow-hidden">
        {!selectedSubject ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Select a subject to view its topics.</div>
        ) : loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
        ) : topics.length === 0 ? (
          <div className="p-8 text-center">
            <Tag className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground text-sm">No topics for this subject yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3 font-medium">#</th>
                <th className="text-left px-4 py-3 font-medium">Topic</th>
                <th className="text-left px-4 py-3 font-medium">Unit</th>
                <th className="text-left px-4 py-3 font-medium">Chapter</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {topics.map((t, i) => (
                <tr key={t.topic_id} className={i % 2 === 0 ? '' : 'bg-muted/10'}>
                  <td className="px-4 py-3 text-muted-foreground">{t.sequence_number ?? '—'}</td>
                  <td className="px-4 py-3 font-medium">{t.topic_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.unit_name ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.chapter_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleToggleActive(t)}
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${t.active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {t.active !== false ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      {t.active !== false ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(t)} className="p-1.5 rounded hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
