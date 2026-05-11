import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useMissionaryPosts } from '../../hooks/useMissionaryPosts';
import { Button, Card, EmptyState, Input, Label, Modal, Textarea } from '../../components/ui';

const POST_TYPES = ['Field story', 'Prayer request', 'Monthly update', 'Win/testimony'];

function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full bg-mission-blue/10 px-2.5 py-1 text-xs font-semibold text-mission-blue">
      {children}
    </span>
  );
}

function PostActionsMenu({ onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        className="rounded-btn px-2 py-1 text-lg leading-none text-neutral-600 hover:bg-neutral-100"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Post options"
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 min-w-[11rem] rounded-btn border border-neutral-200 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="block w-full px-4 py-2.5 text-left text-sm font-medium text-neutral-900 hover:bg-neutral-50"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            Edit post
          </button>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-4 py-2.5 text-left text-sm font-medium text-red-700 hover:bg-red-50"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            Delete post
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function MissionaryUpdates() {
  const { user } = useAuth();
  const mid = user?.id;
  const { posts, loading, addPost, updatePost, deletePost } = useMissionaryPosts(mid);

  const [type, setType] = useState(POST_TYPES[0]);
  const [locationName, setLocationName] = useState('');
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const [locationWarning, setLocationWarning] = useState('');

  const [editingPost, setEditingPost] = useState(null);
  const [editType, setEditType] = useState(POST_TYPES[0]);
  const [editLocation, setEditLocation] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const [deletingPost, setDeletingPost] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [flashSuccess, setFlashSuccess] = useState('');

  const recent = useMemo(() => posts, [posts]);

  const canPost = body.trim().length > 0;
  const canSaveEdit = editBody.trim().length > 0;

  useEffect(() => {
    if (!flashSuccess) return;
    const t = setTimeout(() => setFlashSuccess(''), 4000);
    return () => clearTimeout(t);
  }, [flashSuccess]);

  const submitPost = async () => {
    setPostError('');
    setLocationWarning('');
    setPosting(true);
    try {
      const res = await addPost({
        typeUi: type,
        locationName,
        body,
      });
      if (!res.ok) {
        setPostError(res.error || 'Could not publish.');
        setPosting(false);
        return;
      }
      if (res.locationWarning) {
        setLocationWarning(
          `We couldn't place "${locationName.trim()}" on the map. Try a broader place name (e.g. city and country). Your post was still published.`,
        );
      }
      setBody('');
      setLocationName('');
      setType(POST_TYPES[0]);
    } catch (e) {
      setPostError(e?.message || 'Could not publish.');
    } finally {
      setPosting(false);
    }
  };

  const openEdit = (p) => {
    setEditingPost(p);
    setEditType(p.type);
    setEditLocation(p.locationName || '');
    setEditBody(p.body || '');
    setEditError('');
  };

  const closeEdit = () => {
    setEditingPost(null);
    setEditSaving(false);
    setEditError('');
  };

  const saveEdit = async () => {
    if (!editingPost || !canSaveEdit) return;
    setEditError('');
    setEditSaving(true);
    try {
      const res = await updatePost(
        editingPost.id,
        { typeUi: editType, locationName: editLocation, body: editBody },
        editingPost,
      );
      if (!res.ok) {
        setEditError(res.error || 'Could not save changes.');
        return;
      }
      if (res.locationWarning) {
        setLocationWarning(
          `We couldn't place "${editLocation.trim()}" on the map. Try a broader place name (e.g. city and country). Your post was still saved.`,
        );
      }
      closeEdit();
    } catch (e) {
      setEditError(e?.message || 'Could not save changes.');
    } finally {
      setEditSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingPost) return;
    setDeleteBusy(true);
    try {
      const res = await deletePost(deletingPost.id);
      if (!res.ok) {
        setFlashSuccess('');
        setPostError(res.error || 'Could not delete post.');
        setDeletingPost(null);
        return;
      }
      setDeletingPost(null);
      setFlashSuccess('Post deleted');
    } catch (e) {
      setPostError(e?.message || 'Could not delete post.');
      setDeletingPost(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Updates</h1>
        <p className="text-sm text-neutral-600">
          Share with supporters. Locations use plain text — we look up coordinates automatically for your map.
        </p>
      </header>

      {flashSuccess ? (
        <p className="rounded-btn border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{flashSuccess}</p>
      ) : null}

      {postError ? (
        <p className="rounded-btn border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{postError}</p>
      ) : null}

      {locationWarning ? (
        <p className="rounded-btn border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-[#854F0B]">{locationWarning}</p>
      ) : null}

      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Label title="Post type">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-btn border border-neutral-200 px-4 py-[14px] text-[16px] outline-none focus:border-mission-blue"
            >
              {POST_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Label>
          <Label title="Location (optional)">
            <Input
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="e.g. Dublin, Ireland — plain text only"
            />
          </Label>
        </div>

        <div className="mt-4">
          <Label title="Post">
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share what God is doing..." rows={6} />
          </Label>
        </div>

        <div className="mt-4 flex justify-end">
          <Button type="button" disabled={!canPost || posting} onClick={submitPost}>
            {posting ? 'Posting…' : 'Post'}
          </Button>
        </div>
      </Card>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-neutral-900">Recent posts</p>
        {loading ? (
          <p className="text-sm text-neutral-500">Loading posts…</p>
        ) : recent.length === 0 ? (
          <EmptyState title="No posts yet — share what God is doing" />
        ) : (
          <div className="space-y-3">
            {recent.map((p) => (
              <Card key={p.id} id={`post-${p.id}`} className="relative scroll-mt-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex flex-wrap items-center gap-2">
                    <Badge>{p.type}</Badge>
                    <p className="text-xs text-neutral-500">{new Date(p.createdAt).toLocaleString()}</p>
                  </div>
                  <PostActionsMenu onEdit={() => openEdit(p)} onDelete={() => setDeletingPost(p)} />
                </div>
                {p.locationName ? <p className="mt-2 text-sm font-medium text-neutral-700">{p.locationName}</p> : null}
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">{p.body}</p>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={Boolean(editingPost)}
        title="Edit post"
        onClose={closeEdit}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeEdit} disabled={editSaving}>
              Cancel
            </Button>
            <Button type="button" disabled={!canSaveEdit || editSaving} onClick={saveEdit}>
              {editSaving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        }
      >
        {editError ? <p className="mb-3 text-sm text-red-700">{editError}</p> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <Label title="Post type">
            <select
              value={editType}
              onChange={(e) => setEditType(e.target.value)}
              className="w-full rounded-btn border border-neutral-200 px-4 py-[14px] text-[16px] outline-none focus:border-mission-blue"
            >
              {POST_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Label>
          <Label title="Location (optional)">
            <Input
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
              placeholder="e.g. Dublin, Ireland — plain text only"
            />
          </Label>
        </div>
        <div className="mt-4">
          <Label title="Post">
            <Textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              placeholder="Share what God is doing..."
              rows={6}
            />
          </Label>
        </div>
      </Modal>

      <Modal
        open={Boolean(deletingPost)}
        title="Delete post?"
        onClose={() => {
          if (deleteBusy) return;
          setDeletingPost(null);
        }}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDeletingPost(null)} disabled={deleteBusy}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={confirmDelete} disabled={deleteBusy}>
              {deleteBusy ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-neutral-700">Are you sure you want to delete this post? This cannot be undone.</p>
      </Modal>
    </div>
  );
}
