import { useState, useEffect } from 'react'
import {
  Users2,
  Plus,
  Search,
  Calendar,
  Layers,
  GraduationCap,
  BookOpen,
  UserPlus,
  Trash2,
  X,
  CheckCircle2,
  Clock
} from 'lucide-react'

export default function StudentGroupPage() {
  const [groups, setGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState<string>('ALL')

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [batches, setBatches] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [formData, setFormData] = useState({
    group_name: '',
    group_type: 'CLINICAL',
    batch_id: '',
    subject_id: '',
    valid_from: new Date().toISOString().split('T')[0],
    valid_to: '',
  })

  // Group Details / Manage Members Slide-over
  const [selectedGroup, setSelectedGroup] = useState<any>(null)
  const [availableStudents, setAvailableStudents] = useState<any[]>([])
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)

  const fetchGroups = async () => {
    try {
      setLoading(true)
      const list = await (window.api as any).studentGroup.list()
      setGroups(list)
    } catch (err) {
      console.error('Failed to load student groups', err)
    } finally {
      setLoading(false)
    }
  }

  const loadDropdowns = async () => {
    try {
      const [batList, subList] = await Promise.all([
        window.api.batch.list(),
        window.api.subject.list(),
      ])
      setBatches(batList)
      setSubjects(subList)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchGroups()
    loadDropdowns()
  }, [])

  const handleOpenGroupDetails = async (groupId: string) => {
    try {
      setLoadingMembers(true)
      const [groupData, avail] = await Promise.all([
        (window.api as any).studentGroup.getById(groupId),
        (window.api as any).studentGroup.getAvailableStudents(groupId),
      ])
      setSelectedGroup(groupData)
      setAvailableStudents(avail)
      setSelectedStudentIds([])
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to fetch group details')
    } finally {
      setLoadingMembers(false)
    }
  }

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await (window.api as any).studentGroup.create({
        ...formData,
        batch_id: formData.batch_id || undefined,
        subject_id: formData.subject_id || undefined,
        valid_to: formData.valid_to || undefined,
      })
      setShowCreateModal(false)
      setFormData({
        group_name: '',
        group_type: 'CLINICAL',
        batch_id: '',
        subject_id: '',
        valid_from: new Date().toISOString().split('T')[0],
        valid_to: '',
      })
      await fetchGroups()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create group')
    }
  }

  const handleAddStudents = async () => {
    if (!selectedGroup || selectedStudentIds.length === 0) return
    try {
      await (window.api as any).studentGroup.addMembers(selectedGroup.student_group_id, {
        student_ids: selectedStudentIds,
        effective_from: new Date().toISOString().split('T')[0],
      })
      await handleOpenGroupDetails(selectedGroup.student_group_id)
      await fetchGroups()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add members')
    }
  }

  const handleRemoveMember = async (membershipId: string) => {
    if (!confirm('Are you sure you want to remove this student from the group?')) return
    try {
      await (window.api as any).studentGroup.removeMember(membershipId)
      if (selectedGroup) {
        await handleOpenGroupDetails(selectedGroup.student_group_id)
      }
      await fetchGroups()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove student')
    }
  }

  const filteredGroups = groups.filter((g) => {
    const matchesSearch = g.group_name.toLowerCase().includes(search.toLowerCase())
    const matchesType = selectedType === 'ALL' || g.group_type === selectedType
    return matchesSearch && matchesType
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users2 className="h-6 w-6 text-primary" />
            Advanced Student Groups
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage clinical postings, lab sub-batches, seminars, elective cohorts, and cross-batch groupings.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Create Student Group
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search group name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded border bg-background text-foreground"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {['ALL', 'CLINICAL', 'LAB', 'PRACTICAL', 'SEMINAR', 'PROJECT', 'CUSTOM'].map((t) => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`px-2.5 py-1 text-xs rounded font-medium transition ${
                selectedType === t
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Groups Grid */}
      {loading ? (
        <div className="text-center py-12 text-sm text-muted-foreground">Loading groups...</div>
      ) : filteredGroups.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-card border-dashed">
          <Users2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-foreground">No Student Groups Found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
            Create clinical postings or laboratory groups to assign specific student cohorts for specialized attendance sessions.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Create First Group
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.map((g) => {
            const isDissolved = g.status === 'DISSOLVED'

            return (
              <div
                key={g.student_group_id}
                onClick={() => handleOpenGroupDetails(g.student_group_id)}
                className="group relative border rounded-lg bg-card p-5 hover:border-primary/50 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary uppercase">
                      {g.group_type}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        isDissolved
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                      }`}
                    >
                      {g.status}
                    </span>
                  </div>

                  <h3 className="font-semibold text-base text-foreground group-hover:text-primary transition line-clamp-1">
                    {g.group_name}
                  </h3>

                  <div className="text-xs text-muted-foreground mt-3 space-y-1.5">
                    {g.batch_name && (
                      <div className="flex items-center gap-1.5">
                        <GraduationCap className="h-3.5 w-3.5" />
                        <span>{g.batch_name}</span>
                      </div>
                    )}
                    {g.subject_name && (
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>{g.subject_name} ({g.subject_code})</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>
                        Valid: {g.valid_from} {g.valid_to ? `to ${g.valid_to}` : '(Ongoing)'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-foreground font-semibold">
                    <Users2 className="h-3.5 w-3.5 text-primary" />
                    <span>{g.member_count} enrolled</span>
                  </div>
                  <span className="text-primary text-xs font-medium group-hover:translate-x-0.5 transition-transform">
                    Manage Roster &rarr;
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Group Detail Modal / Drawer */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b flex items-start justify-between bg-muted/30">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary uppercase">
                    {selectedGroup.group_type}
                  </span>
                  <h2 className="text-lg font-bold text-foreground">{selectedGroup.group_name}</h2>
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3">
                  {selectedGroup.batch_name && <span><strong>Batch:</strong> {selectedGroup.batch_name}</span>}
                  {selectedGroup.subject_name && <span><strong>Subject:</strong> {selectedGroup.subject_name}</span>}
                  <span><strong>Valid From:</strong> {selectedGroup.valid_from}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedGroup(null)}
                className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto flex-1 space-y-5">
              {/* Add Members Section */}
              <div className="p-3 border rounded-lg bg-muted/20 space-y-2">
                <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <UserPlus className="h-4 w-4 text-primary" />
                  Enroll Students from Batch
                </div>
                {availableStudents.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    All students in this batch are already enrolled in this group.
                  </p>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                    <select
                      multiple
                      value={selectedStudentIds}
                      onChange={(e) =>
                        setSelectedStudentIds(Array.from(e.target.selectedOptions, (o) => o.value))
                      }
                      className="flex-1 w-full px-2.5 py-1.5 text-xs rounded border bg-background text-foreground h-20"
                    >
                      {availableStudents.map((s) => (
                        <option key={s.student_id} value={s.student_id}>
                          {s.admission_number} — {s.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleAddStudents}
                      disabled={selectedStudentIds.length === 0}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition self-end sm:self-center"
                    >
                      Add Selected ({selectedStudentIds.length})
                    </button>
                  </div>
                )}
              </div>

              {/* Members Table */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Enrolled Members ({selectedGroup.members?.length || 0})</span>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 border-b text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Roll No</th>
                        <th className="px-3 py-2 font-medium">Student Name</th>
                        <th className="px-3 py-2 font-medium">Biometric</th>
                        <th className="px-3 py-2 font-medium">Enrolled Date</th>
                        <th className="px-3 py-2 font-medium text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {!selectedGroup.members || selectedGroup.members.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-6 text-muted-foreground">
                            No students enrolled in this group yet.
                          </td>
                        </tr>
                      ) : (
                        selectedGroup.members.map((m: any) => (
                          <tr key={m.membership_id} className="hover:bg-muted/30 transition">
                            <td className="px-3 py-2 font-mono font-medium text-foreground">
                              {m.admission_number}
                            </td>
                            <td className="px-3 py-2 font-semibold text-foreground">
                              {m.name}
                            </td>
                            <td className="px-3 py-2">
                              {m.face_enrolled ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                                  <CheckCircle2 className="h-3 w-3" /> Enrolled
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">Pending</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {m.effective_from}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                onClick={() => handleRemoveMember(m.membership_id)}
                                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                                title="Remove from group"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t bg-muted/20 flex items-center justify-end">
              <button
                onClick={() => setSelectedGroup(null)}
                className="px-4 py-1.5 text-xs font-medium border rounded hover:bg-muted"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-lg max-w-md w-full p-6 shadow-xl space-y-4">
            <h2 className="text-lg font-bold text-foreground">Create Student Group</h2>
            <p className="text-xs text-muted-foreground">
              Define a specialized clinical posting, laboratory division, or elective cohort.
            </p>

            <form onSubmit={handleCreateGroup} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground">Group Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ward 4 Surgery Rotation / Lab Batch A1"
                  value={formData.group_name}
                  onChange={(e) => setFormData({ ...formData, group_name: e.target.value })}
                  className="mt-1 w-full px-3 py-1.5 text-xs rounded border bg-background text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-foreground">Group Type</label>
                  <select
                    value={formData.group_type}
                    onChange={(e) => setFormData({ ...formData, group_type: e.target.value })}
                    className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border bg-background text-foreground"
                  >
                    <option value="CLINICAL">CLINICAL</option>
                    <option value="LAB">LAB</option>
                    <option value="PRACTICAL">PRACTICAL</option>
                    <option value="SEMINAR">SEMINAR</option>
                    <option value="PROJECT">PROJECT</option>
                    <option value="SPORTS">SPORTS</option>
                    <option value="CUSTOM">CUSTOM</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">Batch (Optional)</label>
                  <select
                    value={formData.batch_id}
                    onChange={(e) => setFormData({ ...formData, batch_id: e.target.value })}
                    className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border bg-background text-foreground"
                  >
                    <option value="">-- All Batches --</option>
                    {batches.map((b) => (
                      <option key={b.batch_id} value={b.batch_id}>
                        {b.batch_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Associated Subject (Optional)</label>
                <select
                  value={formData.subject_id}
                  onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
                  className="mt-1 w-full px-3 py-1.5 text-xs rounded border bg-background text-foreground"
                >
                  <option value="">-- None / Cross-Subject --</option>
                  {subjects.map((s) => (
                    <option key={s.subject_id} value={s.subject_id}>
                      {s.subject_name} ({s.subject_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-foreground">Valid From</label>
                  <input
                    type="date"
                    required
                    value={formData.valid_from}
                    onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                    className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border bg-background text-foreground"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">Valid To (Optional)</label>
                  <input
                    type="date"
                    value={formData.valid_to}
                    onChange={(e) => setFormData({ ...formData, valid_to: e.target.value })}
                    className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border bg-background text-foreground"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 text-xs font-medium border rounded hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
